import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPreferences,
  UserDemographicProfile,
  GoogleAccount,
  ColorPaletteStyle,
  NoteColorMode,
  NoteColor,
  PenColor,
  NoteFontStyle,
} from '../types';
import {
  X,
  Check,
  Sparkles,
  Mail,
  PenTool,
  Type,
  Palette,
  Shuffle,
  MousePointerClick,
  Bookmark,
  Loader2,
  UserCheck,
  MapPin,
  HeartHandshake,
  Crosshair,
  ArrowRight,
  ArrowLeft,
  Search,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { PushPin } from './PushPin';
import { PEN_OPTIONS, FONT_OPTIONS, getReadablePenHex, getFontOption } from '../data/penStyles';
import {
  NOTE_COLOR_LIST,
  PASTEL_COLOR_LIST,
  getNoteColorList,
  getNoteColorConfig,
} from '../data/noteColors';
import {
  GENERAL_INTEREST_CARDS,
  INTEREST_AREAS,
  InterestArea,
  RelatedSubtopicCard,
  buildFallbackSubtopicsForInterests,
  findInterestLabel,
} from '../data/interestsCatalog';
import {
  connectGoogleAccount,
  getAccessTokenForEmail,
} from '../services/googleDriveService';
import {
  GENDER_OPTIONS,
  SEXUAL_ORIENTATION_OPTIONS,
  fetchGoogleProfileDemographics,
  getCachedGoogleDemographics,
  detectApproximateLocation,
} from '../services/googlePeopleService';

type OnboardingStep = 'profile' | 'general_50' | 'related_50';

interface PreferencesOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  initialEmail?: string;
  googleAccounts?: GoogleAccount[];
  onAddOrUpdateAccount?: (account: GoogleAccount) => void;
  onSavePreferences: (prefs: UserPreferences, email?: string) => void;
}

export const PreferencesOnboardingModal: React.FC<PreferencesOnboardingModalProps> = ({
  isOpen,
  onClose,
  preferences,
  initialEmail,
  googleAccounts = [],
  onAddOrUpdateAccount,
  onSavePreferences,
}) => {
  const [step, setStep] = useState<OnboardingStep>('profile');
  const [email, setEmail] = useState(
    initialEmail || preferences.registeredEmail || googleAccounts[0]?.email || ''
  );

  // Demographic profile states
  const [ageInput, setAgeInput] = useState<string>('');
  const [ageNotDeclared, setAgeNotDeclared] = useState<boolean>(false);
  const [locationInput, setLocationInput] = useState<string>('');
  const [locationNotDeclared, setLocationNotDeclared] = useState<boolean>(false);
  const [gender, setGender] = useState<string>('Prefiro não declarar');
  const [sexualOrientation, setSexualOrientation] = useState<string>('Prefiro não declarar');
  const [autoFilledFromGoogle, setAutoFilledFromGoogle] = useState<{
    age?: boolean;
    location?: boolean;
    gender?: boolean;
  }>({});
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [googleSyncNotice, setGoogleSyncNotice] = useState<string | null>(null);

  // Visual style preferences
  const [fontStyle, setFontStyle] = useState<NoteFontStyle>(preferences.defaultFontStyle);
  const [penColor, setPenColor] = useState<PenColor>(preferences.defaultPenColor);
  const [colorPalette, setColorPalette] = useState<ColorPaletteStyle>(
    preferences.colorPalette || 'vibrant'
  );
  const [colorSelectionMode, setColorSelectionMode] = useState<NoteColorMode>(
    preferences.colorSelectionMode || 'random'
  );
  const [defaultNoteColor, setDefaultNoteColor] = useState<NoteColor>(
    preferences.defaultNoteColor || 'yellow'
  );
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Step 2 & 3: 50 General Interests (choose 10) -> 50 Related Subtopics
  const [selectedGeneral, setSelectedGeneral] = useState<string[]>([]);
  const [generalSearch, setGeneralSearch] = useState('');
  const [generalAreaFilter, setGeneralAreaFilter] = useState<InterestArea | 'Todas'>('Todas');
  const [generatedSubtopics, setGeneratedSubtopics] = useState<RelatedSubtopicCard[]>([]);
  const [selectedRelated, setSelectedRelated] = useState<string[]>([]);
  const [relatedSearch, setRelatedSearch] = useState('');
  const [relatedParentFilter, setRelatedParentFilter] = useState<string>('Todos');
  const [isGeneratingSubtopics, setIsGeneratingSubtopics] = useState(false);
  const [subtopicsNotice, setSubtopicsNotice] = useState<string | null>(null);

  const applyDemographicData = (
    demo?: UserDemographicProfile,
    onlyIfEmpty = false
  ) => {
    if (!demo) return;

    if (typeof demo.age === 'number' && demo.age > 0) {
      if (!onlyIfEmpty || (!ageInput && !ageNotDeclared)) {
        setAgeInput(String(demo.age));
        setAgeNotDeclared(false);
        if (demo.autoFilledFromGoogle?.age) {
          setAutoFilledFromGoogle((prev) => ({ ...prev, age: true }));
        }
      }
    } else if (demo.ageNotDeclared && !onlyIfEmpty) {
      setAgeInput('');
      setAgeNotDeclared(true);
    }

    if (demo.location && demo.location.trim()) {
      if (!onlyIfEmpty || (!locationInput.trim() && !locationNotDeclared)) {
        setLocationInput(demo.location.trim());
        setLocationNotDeclared(false);
        if (demo.autoFilledFromGoogle?.location) {
          setAutoFilledFromGoogle((prev) => ({ ...prev, location: true }));
        }
      }
    } else if (demo.locationNotDeclared && !onlyIfEmpty) {
      setLocationInput('');
      setLocationNotDeclared(true);
    }

    if (demo.gender && demo.gender.trim()) {
      if (!onlyIfEmpty || gender === 'Prefiro não declarar') {
        setGender(demo.gender);
        if (demo.autoFilledFromGoogle?.gender) {
          setAutoFilledFromGoogle((prev) => ({ ...prev, gender: true }));
        }
      }
    }

    if (demo.sexualOrientation && demo.sexualOrientation.trim() && !onlyIfEmpty) {
      setSexualOrientation(demo.sexualOrientation);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const targetEmail =
      initialEmail || preferences.registeredEmail || googleAccounts[0]?.email || '';
    setStep('profile');
    setEmail(targetEmail);
    setFontStyle(preferences.defaultFontStyle);
    setPenColor(preferences.defaultPenColor);
    setColorPalette(preferences.colorPalette || 'vibrant');
    setColorSelectionMode(preferences.colorSelectionMode || 'random');
    setDefaultNoteColor(preferences.defaultNoteColor || 'yellow');
    setAuthError(null);
    setGoogleSyncNotice(null);
    setGeneralSearch('');
    setGeneralAreaFilter('Todas');
    setRelatedSearch('');
    setRelatedParentFilter('Todos');
    setSubtopicsNotice(null);

    const savedProfile = preferences.profile;
    const cachedGoogle = getCachedGoogleDemographics(targetEmail);

    const initialAge =
      savedProfile?.age && savedProfile.age > 0
        ? String(savedProfile.age)
        : cachedGoogle?.age && cachedGoogle.age > 0
        ? String(cachedGoogle.age)
        : '';
    const initialAgeNotDeclared =
      Boolean(savedProfile?.ageNotDeclared) && !initialAge;

    const initialLocation =
      savedProfile?.location?.trim() || cachedGoogle?.location?.trim() || '';
    const initialLocationNotDeclared =
      Boolean(savedProfile?.locationNotDeclared) && !initialLocation;

    const initialGender =
      savedProfile?.gender || cachedGoogle?.gender || 'Prefiro não declarar';

    const initialOrientation =
      savedProfile?.sexualOrientation || 'Prefiro não declarar';

    setAgeInput(initialAge);
    setAgeNotDeclared(initialAgeNotDeclared);
    setLocationInput(initialLocation);
    setLocationNotDeclared(initialLocationNotDeclared);
    setGender(initialGender);
    setSexualOrientation(initialOrientation);
    setAutoFilledFromGoogle({
      age:
        savedProfile?.autoFilledFromGoogle?.age ??
        Boolean(cachedGoogle?.age && !savedProfile?.age),
      location:
        savedProfile?.autoFilledFromGoogle?.location ??
        Boolean(cachedGoogle?.location && !savedProfile?.location),
      gender:
        savedProfile?.autoFilledFromGoogle?.gender ??
        Boolean(cachedGoogle?.gender && !savedProfile?.gender),
    });

    const savedGeneral = (savedProfile?.generalInterests || []).map(findInterestLabel);
    const savedRelated = savedProfile?.relatedInterests || [];
    setSelectedGeneral(savedGeneral);
    setSelectedRelated(savedRelated);
    if (savedGeneral.length > 0) {
      setGeneratedSubtopics(buildFallbackSubtopicsForInterests(savedGeneral, 50));
    } else {
      setGeneratedSubtopics([]);
    }

    const activeToken = getAccessTokenForEmail(targetEmail);
    if (activeToken && !cachedGoogle) {
      void fetchGoogleProfileDemographics(activeToken, targetEmail).then((demo) => {
        applyDemographicData(demo, true);
      });
    }
  }, [isOpen, initialEmail, preferences, googleAccounts]);

  const filteredGeneralCards = useMemo(() => {
    const q = generalSearch.trim().toLowerCase();
    return GENERAL_INTEREST_CARDS.filter((card) => {
      if (generalAreaFilter !== 'Todas' && card.area !== generalAreaFilter) return false;
      if (!q) return true;
      return (
        card.label.toLowerCase().includes(q) ||
        card.area.toLowerCase().includes(q) ||
        card.relatedSubtopics.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [generalSearch, generalAreaFilter]);

  const filteredRelatedCards = useMemo(() => {
    const q = relatedSearch.trim().toLowerCase();
    return generatedSubtopics.filter((item) => {
      if (
        relatedParentFilter !== 'Todos' &&
        item.parentLabel.toLowerCase() !== relatedParentFilter.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        item.parentLabel.toLowerCase().includes(q)
      );
    });
  }, [generatedSubtopics, relatedSearch, relatedParentFilter]);

  if (!isOpen) return null;

  const activeColorList = getNoteColorList(colorPalette);
  const previewCardColor =
    colorSelectionMode === 'fixed'
      ? defaultNoteColor
      : colorPalette === 'vibrant'
      ? 'lime'
      : 'yellow';
  const previewPaper = getNoteColorConfig(previewCardColor, colorPalette);
  const previewFont = getFontOption(fontStyle);
  const previewPenHex = getReadablePenHex(penColor, previewCardColor);

  const handleGoogleConnect = async () => {
    setIsConnectingGoogle(true);
    setAuthError(null);
    setGoogleSyncNotice(null);
    try {
      const { account, accessToken } = await connectGoogleAccount(email.trim() || undefined);
      onAddOrUpdateAccount?.(account);
      setEmail(account.email);

      const demo = await fetchGoogleProfileDemographics(accessToken, account.email);
      const foundCount = [demo.age, demo.location, demo.gender].filter(Boolean).length;
      applyDemographicData(demo, false);

      if (foundCount > 0) {
        setGoogleSyncNotice(
          `Preenchemos ${foundCount} dado(s) direto do seu Google! Confira abaixo ou escolha "Prefiro não declarar".`
        );
      } else {
        setGoogleSyncNotice(
          'Conta conectada! Seu Google não expôs idade, local ou gênero — preencha ou use "Prefiro não declarar".'
        );
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setAuthError(err?.message || 'Não foi possível conectar com o Google.');
      }
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleDetectBrowserLocation = async () => {
    setIsDetectingLocation(true);
    try {
      const detected = await detectApproximateLocation();
      if (detected) {
        setLocationInput(detected);
        setLocationNotDeclared(false);
        setAutoFilledFromGoogle((prev) => ({ ...prev, location: false }));
      } else {
        setGoogleSyncNotice(
          'Não foi possível detectar sua localização agora. Digite ou escolha "Prefiro não declarar".'
        );
      }
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const toggleGeneralInterest = (label: string) => {
    setSelectedGeneral((prev) => {
      if (prev.includes(label)) {
        return prev.filter((item) => item !== label);
      }
      if (prev.length >= 10) {
        return prev;
      }
      return [...prev, label];
    });
  };

  const toggleRelatedInterest = (label: string) => {
    setSelectedRelated((prev) => {
      if (prev.includes(label)) {
        return prev.filter((item) => item !== label);
      }
      if (prev.length >= 15) {
        return prev;
      }
      return [...prev, label];
    });
  };

  const generate50RelatedCards = async (forceRefresh = false) => {
    if (selectedGeneral.length === 0) return;
    if (!forceRefresh && generatedSubtopics.length === 50 && step === 'general_50') {
      // Still try AI refresh if choices changed or user hasn't generated yet
    }

    setIsGeneratingSubtopics(true);
    setSubtopicsNotice(null);
    setStep('related_50');

    const parsedAge = parseInt(ageInput.trim(), 10);
    const validAge =
      !ageNotDeclared && !Number.isNaN(parsedAge) && parsedAge > 0 ? parsedAge : null;

    const fallbackList = buildFallbackSubtopicsForInterests(selectedGeneral, 50);

    try {
      const res = await fetch('/api/interests/generate-subtopics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedInterests: selectedGeneral,
          age: validAge,
          gender,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.success && Array.isArray(data.subtopics) && data.subtopics.length > 0) {
        const aiItems = data.subtopics as RelatedSubtopicCard[];
        const seen = new Set(aiItems.map((i) => i.label.toLowerCase()));
        const completed = [...aiItems];
        for (const fb of fallbackList) {
          if (completed.length >= 50) break;
          if (!seen.has(fb.label.toLowerCase())) {
            seen.add(fb.label.toLowerCase());
            completed.push(fb);
          }
        }
        setGeneratedSubtopics(completed.slice(0, 50));
        setSubtopicsNotice(
          '50 assuntos relacionados gerados sob medida com base nas suas 10 escolhas!'
        );
      } else {
        setGeneratedSubtopics(fallbackList);
        setSubtopicsNotice('50 assuntos relacionados preparados com base nas suas 10 escolhas!');
      }
    } catch {
      setGeneratedSubtopics(fallbackList);
      setSubtopicsNotice('50 assuntos relacionados preparados com base nas suas 10 escolhas!');
    } finally {
      setIsGeneratingSubtopics(false);
    }
  };

  const finalizeAndSave = () => {
    const cleanEmail = email.trim().toLowerCase() || undefined;

    const parsedAge = parseInt(ageInput.trim(), 10);
    const hasValidAge =
      !ageNotDeclared && !Number.isNaN(parsedAge) && parsedAge >= 1 && parsedAge <= 130;

    const cleanLocation = locationNotDeclared ? '' : locationInput.trim().slice(0, 160);
    const finalLocationNotDeclared = locationNotDeclared || !cleanLocation;

    const profile: UserDemographicProfile = {
      age: hasValidAge ? parsedAge : null,
      ageNotDeclared: !hasValidAge,
      location: cleanLocation,
      locationNotDeclared: finalLocationNotDeclared,
      gender: gender || 'Prefiro não declarar',
      sexualOrientation: sexualOrientation || 'Prefiro não declarar',
      generalInterests: selectedGeneral.slice(0, 10),
      relatedInterests: selectedRelated.slice(0, 15),
      autoFilledFromGoogle,
      updatedAt: new Date().toISOString(),
    };

    const nextPrefs: UserPreferences = {
      ...preferences,
      defaultFontStyle: fontStyle,
      defaultPenColor: penColor,
      colorPalette,
      colorSelectionMode,
      defaultNoteColor,
      registeredEmail: cleanEmail,
      onboardingCompleted: true,
      profile,
    };
    onSavePreferences(nextPrefs, cleanEmail);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[93vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-[#1D86C4] text-white shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-[#F9DD36] shrink-0" />
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold leading-tight truncate">
                Cadastro, Estilo &amp; Interesses do Post+
              </h3>
              <p className="text-[10px] text-white/85 truncate">
                {step === 'profile'
                  ? 'Etapa 1 de 3 — Conta, perfil e estilo das suas notas'
                  : step === 'general_50'
                  ? 'Etapa 2 de 3 — Escolha 10 entre 50 interesses gerais'
                  : 'Etapa 3 de 3 — 50 assuntos relacionados às suas escolhas'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/15 text-white cursor-pointer shrink-0"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3-Step Navigation Strip */}
        <div className="px-3 sm:px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setStep('profile')}
            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1 ${
              step === 'profile'
                ? 'bg-[#1D86C4] text-white shadow-2xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>1. Perfil &amp; Estilo</span>
          </button>
          <span className="text-slate-300 text-xs">›</span>
          <button
            type="button"
            onClick={() => setStep('general_50')}
            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1 ${
              step === 'general_50'
                ? 'bg-[#1D86C4] text-white shadow-2xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>2. Interesses ({selectedGeneral.length}/10)</span>
          </button>
          <span className="text-slate-300 text-xs">›</span>
          <button
            type="button"
            disabled={selectedGeneral.length === 0}
            onClick={() => {
              if (generatedSubtopics.length > 0) {
                setStep('related_50');
              } else {
                void generate50RelatedCards();
              }
            }}
            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1 disabled:opacity-45 ${
              step === 'related_50'
                ? 'bg-[#1D86C4] text-white shadow-2xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>3. Relacionados ({selectedRelated.length})</span>
          </button>
        </div>

        {/* STEP 1: PROFILE & VISUAL PREFERENCES */}
        {step === 'profile' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-left">
            {/* Live Preview Card */}
            <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center">
              <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Prévia da sua Nota ({colorPalette === 'vibrant' ? 'Paleta Vibrante' : 'Paleta Pastel'})
              </span>
              <div
                className={`relative w-full max-w-[260px] rounded-[5px] border ${previewPaper.bgClass} ${previewPaper.borderClass} note-paper note-soft-shadow pt-4 pb-2.5 px-3 transition-colors duration-200`}
              >
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <PushPin color={preferences.defaultPinColor || 'red'} size="sm" />
                </div>
                <p
                  className={`${previewFont.titleSizeClass} leading-tight`}
                  style={{ color: previewPenHex, fontFamily: previewFont.fontFamily }}
                >
                  Lembrete Personalizado
                </p>
                <p
                  className={`${previewFont.bodySizeClass} mt-1 opacity-95`}
                  style={{ color: previewPenHex, fontFamily: previewFont.fontFamily }}
                >
                  É assim que seus recados vão aparecer no mural!
                </p>
              </div>
            </div>

            {/* 1. Cadastro / E-mail */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <Mail className="w-3.5 h-3.5 text-[#1D86C4]" />
                <span>1. Seu E-mail de Cadastro</span>
              </label>

              <div className="flex items-center gap-1.5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@gmail.com"
                  className="flex-1 px-3 py-1.5 text-xs text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D86C4]"
                />
                <button
                  type="button"
                  onClick={handleGoogleConnect}
                  disabled={isConnectingGoogle}
                  className="px-2.5 py-1.5 text-[11px] font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg cursor-pointer inline-flex items-center gap-1.5 shrink-0 shadow-2xs"
                  title="Conectar e buscar dados permitidos pelo Google"
                >
                  {isConnectingGoogle ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1D86C4]" />
                  ) : (
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                  )}
                  <span>Google</span>
                </button>
              </div>
              {googleAccounts.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  {googleAccounts.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => setEmail(acc.email)}
                      className={`px-2 py-0.5 text-[10px] rounded-full border cursor-pointer ${
                        email.toLowerCase() === acc.email.toLowerCase()
                          ? 'bg-[#1D86C4] text-white border-[#1D86C4] font-bold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {acc.email}
                    </button>
                  ))}
                </div>
              )}
              {authError && (
                <p className="text-[10.5px] text-rose-600 font-medium">{authError}</p>
              )}
              {googleSyncNotice && (
                <p className="text-[10.5px] text-sky-900 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5 font-medium">
                  {googleSyncNotice}
                </p>
              )}
            </div>

            {/* 2. Dados do Perfil */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <UserCheck className="w-3.5 h-3.5 text-[#1D86C4]" />
                <span>2. Sobre Você</span>
              </label>

              <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/90 flex items-center gap-2 text-amber-950">
                <HeartHandshake className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-[11px] font-semibold leading-snug">
                  Usamos esses dados só para entender você melhor e aprimorar o Post+!
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Idade */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">Idade</span>
                    {autoFilledFromGoogle.age && !ageNotDeclared && (
                      <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        Via Google
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={120}
                      disabled={ageNotDeclared}
                      value={ageNotDeclared ? '' : ageInput}
                      onChange={(e) => {
                        setAgeInput(e.target.value);
                        setAgeNotDeclared(false);
                        setAutoFilledFromGoogle((prev) => ({ ...prev, age: false }));
                      }}
                      placeholder={ageNotDeclared ? 'Não declarada' : 'Ex: 28'}
                      className="w-24 px-2.5 py-1.5 text-xs text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D86C4] disabled:bg-slate-100 disabled:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = !ageNotDeclared;
                        setAgeNotDeclared(next);
                        if (next) setAgeInput('');
                      }}
                      className={`px-2 py-1.5 text-[10.5px] font-semibold rounded-lg border cursor-pointer transition-colors ${
                        ageNotDeclared
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      Prefiro não declarar
                    </button>
                  </div>
                </div>

                {/* Localização */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#1D86C4]" />
                      Localização
                    </span>
                    {autoFilledFromGoogle.location && !locationNotDeclared && (
                      <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        Via Google
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      maxLength={160}
                      disabled={locationNotDeclared}
                      value={locationNotDeclared ? '' : locationInput}
                      onChange={(e) => {
                        setLocationInput(e.target.value);
                        setLocationNotDeclared(false);
                        setAutoFilledFromGoogle((prev) => ({ ...prev, location: false }));
                      }}
                      placeholder={locationNotDeclared ? 'Não declarada' : 'Cidade, Estado'}
                      className="flex-1 min-w-0 px-2.5 py-1.5 text-xs text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D86C4] disabled:bg-slate-100 disabled:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={handleDetectBrowserLocation}
                      disabled={isDetectingLocation || locationNotDeclared}
                      title="Detectar localização aproximada"
                      className="px-2 py-1.5 text-[10.5px] font-bold text-[#125882] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg cursor-pointer inline-flex items-center gap-1 shrink-0 disabled:opacity-50"
                    >
                      {isDetectingLocation ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Crosshair className="w-3 h-3" />
                      )}
                      <span>Detectar</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !locationNotDeclared;
                      setLocationNotDeclared(next);
                      if (next) setLocationInput('');
                    }}
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded border cursor-pointer transition-colors ${
                      locationNotDeclared
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Prefiro não declarar localização
                  </button>
                </div>
              </div>

              {/* Gênero */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">Gênero</span>
                  {autoFilledFromGoogle.gender && gender !== 'Prefiro não declarar' && (
                    <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      Via Google
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {GENDER_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setGender(option);
                        setAutoFilledFromGoogle((prev) => ({ ...prev, gender: false }));
                      }}
                      className={`px-2.5 py-1 text-[11px] rounded-lg border cursor-pointer transition-colors ${
                        gender === option
                          ? option === 'Prefiro não declarar'
                            ? 'bg-slate-800 text-white border-slate-800 font-bold'
                            : 'bg-[#1D86C4] text-white border-[#1D86C4] font-bold'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orientação sexual declarada */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 block">
                  Orientação sexual declarada
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SEXUAL_ORIENTATION_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSexualOrientation(option)}
                      className={`px-2.5 py-1 text-[11px] rounded-lg border cursor-pointer transition-colors ${
                        sexualOrientation === option
                          ? option === 'Prefiro não declarar'
                            ? 'bg-slate-800 text-white border-slate-800 font-bold'
                            : 'bg-[#1D86C4] text-white border-[#1D86C4] font-bold'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Escrita & Tinta */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <Type className="w-3.5 h-3.5 text-[#1D86C4]" />
                <span>3. Como você prefere a escrita</span>
              </label>

              <div className="grid grid-cols-2 gap-1.5">
                {FONT_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFontStyle(f.id)}
                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                      fontStyle === f.id
                        ? 'bg-sky-50 border-[#1D86C4] ring-1 ring-[#1D86C4]'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800">
                        {f.label.split(' (')[0]}
                      </span>
                      <span className="text-[8.5px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">
                        {f.tag}
                      </span>
                    </div>
                    <span
                      className="text-[12px] block truncate text-slate-700 mt-0.5"
                      style={{ fontFamily: f.fontFamily }}
                    >
                      Exemplo de escrita
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10.5px] font-bold text-slate-600 flex items-center gap-1">
                  <PenTool className="w-3 h-3 text-[#1D86C4]" />
                  Tinta da Caneta:
                </span>
                <div className="flex items-center gap-1.5">
                  {PEN_OPTIONS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPenColor(p.id)}
                      title={p.label}
                      className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-transform ${
                        penColor === p.id
                          ? 'ring-2 ring-offset-1 ring-[#1D86C4] scale-110'
                          : 'opacity-85 hover:scale-105'
                      }`}
                      style={{ backgroundColor: p.inkColor }}
                    >
                      {penColor === p.id && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Paleta */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <Palette className="w-3.5 h-3.5 text-[#1D86C4]" />
                <span>4. Paleta dos Cards (12 Cores)</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setColorPalette('vibrant')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                    colorPalette === 'vibrant'
                      ? 'bg-amber-50/60 border-[#1D86C4] ring-1 ring-[#1D86C4]'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">12 Vibrantes</span>
                    {colorPalette === 'vibrant' && (
                      <Check className="w-3.5 h-3.5 text-[#1D86C4] stroke-[3]" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    {NOTE_COLOR_LIST.map((c) => (
                      <span
                        key={c.id}
                        className={`w-3.5 h-3.5 rounded-full ${c.bgClass} border border-black/15`}
                      />
                    ))}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setColorPalette('pastel')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                    colorPalette === 'pastel'
                      ? 'bg-sky-50/70 border-[#1D86C4] ring-1 ring-[#1D86C4]'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">12 Pastel</span>
                    {colorPalette === 'pastel' && (
                      <Check className="w-3.5 h-3.5 text-[#1D86C4] stroke-[3]" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    {PASTEL_COLOR_LIST.map((c) => (
                      <span
                        key={c.id}
                        className={`w-3.5 h-3.5 rounded-full ${c.bgClass} border border-black/15`}
                      />
                    ))}
                  </div>
                </button>
              </div>
            </div>

            {/* 5. Cor ao criar */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                5. Cor ao criar nova Nota (+)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setColorSelectionMode('random')}
                  className={`p-2 rounded-xl border text-left flex items-start gap-2 cursor-pointer transition-colors ${
                    colorSelectionMode === 'random'
                      ? 'bg-sky-50 border-[#1D86C4] ring-1 ring-[#1D86C4]'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Shuffle className="w-3.5 h-3.5 text-[#1D86C4] shrink-0 mt-0.5" />
                  <span className="text-[11px] font-bold text-slate-800">Aleatória</span>
                </button>

                <button
                  type="button"
                  onClick={() => setColorSelectionMode('choose')}
                  className={`p-2 rounded-xl border text-left flex items-start gap-2 cursor-pointer transition-colors ${
                    colorSelectionMode === 'choose'
                      ? 'bg-sky-50 border-[#1D86C4] ring-1 ring-[#1D86C4]'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <MousePointerClick className="w-3.5 h-3.5 text-[#1D86C4] shrink-0 mt-0.5" />
                  <span className="text-[11px] font-bold text-slate-800">Escolher na hora</span>
                </button>

                <button
                  type="button"
                  onClick={() => setColorSelectionMode('fixed')}
                  className={`p-2 rounded-xl border text-left flex items-start gap-2 cursor-pointer transition-colors ${
                    colorSelectionMode === 'fixed'
                      ? 'bg-sky-50 border-[#1D86C4] ring-1 ring-[#1D86C4]'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5 text-[#1D86C4] shrink-0 mt-0.5" />
                  <span className="text-[11px] font-bold text-slate-800">Cor Fixa</span>
                </button>
              </div>

              {colorSelectionMode === 'fixed' && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">
                    Cor padrão ({getNoteColorConfig(defaultNoteColor, colorPalette).label}):
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {activeColorList.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setDefaultNoteColor(c.id)}
                        title={c.label}
                        className={`w-6 h-6 rounded-full ${c.bgClass} border transition-transform cursor-pointer flex items-center justify-center ${
                          defaultNoteColor === c.id
                            ? 'border-slate-900 scale-115 ring-2 ring-slate-400'
                            : 'border-slate-300 hover:scale-105'
                        }`}
                      >
                        {defaultNoteColor === c.id && (
                          <Check className="w-3 h-3 text-slate-900 stroke-[3]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: 50 GENERAL INTEREST CARDS (CHOOSE 10) */}
        {step === 'general_50' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar text-left">
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-extrabold text-[#0D3B66] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#1D86C4]" />
                  <span>O que você curte no dia a dia?</span>
                </h4>
                <p className="text-[11px] text-sky-900 leading-snug mt-0.5">
                  Escolha <strong>10 interesses gerais</strong> entre os 50 temas abaixo. Com base neles, vamos montar 50 assuntos específicos para descobrir recomendações que realmente combinem com você!
                </p>
              </div>
              <div
                className={`px-3 py-1.5 rounded-xl text-xs font-black tabular-nums border shrink-0 ${
                  selectedGeneral.length === 10
                    ? 'bg-[#049A35] text-white border-[#049A35]'
                    : 'bg-white text-[#125882] border-sky-300'
                }`}
              >
                {selectedGeneral.length} / 10
              </div>
            </div>

            {/* Search & Area Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={generalSearch}
                  onChange={(e) => setGeneralSearch(e.target.value)}
                  placeholder="Filtrar entre os 50 interesses (ex: música, tecnologia, esporte, fé...)"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D86C4]"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                <button
                  type="button"
                  onClick={() => setGeneralAreaFilter('Todas')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap cursor-pointer border ${
                    generalAreaFilter === 'Todas'
                      ? 'bg-[#1D86C4] text-white border-[#1D86C4]'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Todas (50)
                </button>
                {INTEREST_AREAS.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setGeneralAreaFilter(area)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap cursor-pointer border ${
                      generalAreaFilter === area
                        ? 'bg-[#1D86C4] text-white border-[#1D86C4]'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected summary chips */}
            {selectedGeneral.length > 0 && (
              <div className="flex flex-wrap gap-1 p-2 rounded-xl bg-amber-50/70 border border-amber-200">
                {selectedGeneral.map((lbl) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => toggleGeneralInterest(lbl)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-amber-300 text-[10px] font-bold text-amber-950 hover:bg-rose-50 cursor-pointer"
                    title="Toque para remover"
                  >
                    <span>{lbl}</span>
                    <X className="w-2.5 h-2.5 text-slate-400" />
                  </button>
                ))}
              </div>
            )}

            {/* 50 Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredGeneralCards.map((card) => {
                const isSelected = selectedGeneral.includes(card.label);
                const isLockedOut = !isSelected && selectedGeneral.length >= 10;
                return (
                  <button
                    key={card.id}
                    type="button"
                    disabled={isLockedOut}
                    onClick={() => toggleGeneralInterest(card.label)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2 relative ${
                      isSelected
                        ? 'bg-sky-50 border-[#1D86C4] ring-2 ring-[#1D86C4]/40 shadow-xs'
                        : isLockedOut
                        ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                        : 'bg-white border-slate-200 hover:border-sky-300 hover:bg-sky-50/30'
                    }`}
                  >
                    <span className="text-lg leading-none shrink-0 mt-0.5">{card.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-extrabold text-slate-900 leading-tight">
                        {card.label}
                      </p>
                      <p className="text-[9.5px] text-slate-500 mt-0.5 truncate">{card.area}</p>
                    </div>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-[#1D86C4] text-white flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: 50 GENERATED RELATED SUB-TOPICS */}
        {step === 'related_50' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar text-left">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#049A35]" />
                  <span>50 Assuntos Relacionados às Suas Escolhas</span>
                </h4>
                <p className="text-[11px] text-emerald-900 leading-snug mt-0.5">
                  Selecione até <strong>15 subtemas</strong> que mais chamam sua atenção — isso ajuda o Post+ a filtrar promoções úteis e evitar anúncios fora do seu gosto.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2.5 py-1 rounded-xl bg-white border border-emerald-300 text-[11px] font-black text-emerald-900">
                  {selectedRelated.length} / 15
                </span>
                <button
                  type="button"
                  disabled={isGeneratingSubtopics}
                  onClick={() => void generate50RelatedCards(true)}
                  className="p-1.5 rounded-lg bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-800 cursor-pointer disabled:opacity-50"
                  title="Gerar novos 50 temas relacionados"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingSubtopics ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {subtopicsNotice && (
              <p className="text-[10.5px] font-semibold text-sky-900 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5">
                {subtopicsNotice}
              </p>
            )}

            {isGeneratingSubtopics ? (
              <div className="py-14 flex flex-col items-center justify-center gap-2.5 text-center">
                <Loader2 className="w-7 h-7 animate-spin text-[#1D86C4]" />
                <p className="text-xs font-bold text-slate-800">
                  Montando 50 temas exclusivos com base nos seus 10 interesses...
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  Combinando áreas como {selectedGeneral.slice(0, 4).join(', ')}...
                </p>
              </div>
            ) : (
              <>
                {/* Search + Parent Topic Filter */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={relatedSearch}
                      onChange={(e) => setRelatedSearch(e.target.value)}
                      placeholder="Buscar nos 50 assuntos relacionados..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D86C4]"
                    />
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                    <button
                      type="button"
                      onClick={() => setRelatedParentFilter('Todos')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap cursor-pointer border ${
                        relatedParentFilter === 'Todos'
                          ? 'bg-[#049A35] text-white border-[#049A35]'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Todos ({generatedSubtopics.length})
                    </button>
                    {selectedGeneral.map((parent) => (
                      <button
                        key={parent}
                        type="button"
                        onClick={() => setRelatedParentFilter(parent)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap cursor-pointer border ${
                          relatedParentFilter === parent
                            ? 'bg-[#049A35] text-white border-[#049A35]'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {parent}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 50 Related Subtopic Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredRelatedCards.map((sub) => {
                    const isSelected = selectedRelated.includes(sub.label);
                    const isLockedOut = !isSelected && selectedRelated.length >= 15;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        disabled={isLockedOut}
                        onClick={() => toggleRelatedInterest(sub.label)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                          isSelected
                            ? 'bg-emerald-50 border-[#049A35] ring-2 ring-[#049A35]/30 shadow-xs'
                            : isLockedOut
                            ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                            : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30'
                        }`}
                      >
                        <span className="text-base leading-none shrink-0">{sub.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-slate-900 leading-tight">
                            {sub.label}
                          </p>
                          <p className="text-[9.5px] text-slate-500 mt-0.5 truncate">
                            Relacionado a {sub.parentLabel}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-[#049A35] text-white flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50 shrink-0 flex-wrap">
          {step === 'profile' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/70 rounded-lg cursor-pointer"
              >
                Agora não
              </button>
              <div className="flex items-center gap-2">
                {preferences.onboardingCompleted && (
                  <button
                    type="button"
                    onClick={finalizeAndSave}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer"
                  >
                    Salvar Só Perfil
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStep('general_50')}
                  className="px-4 py-1.5 text-xs font-extrabold text-white bg-[#1D86C4] hover:bg-[#166FA3] rounded-lg cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <span>Avançar: 50 Interesses</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : step === 'general_50' ? (
            <>
              <button
                type="button"
                onClick={() => setStep('profile')}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200/70 rounded-lg cursor-pointer inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar</span>
              </button>
              <button
                type="button"
                disabled={selectedGeneral.length < 10}
                onClick={() => void generate50RelatedCards()}
                className="px-4 py-1.5 text-xs font-extrabold text-white bg-[#1D86C4] hover:bg-[#166FA3] rounded-lg cursor-pointer shadow-xs inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>
                  {selectedGeneral.length < 10
                    ? `Escolha mais ${10 - selectedGeneral.length} interesse(s)`
                    : 'Gerar 50 Temas Relacionados'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('general_50')}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200/70 rounded-lg cursor-pointer inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Alterar os 10</span>
              </button>
              <button
                type="button"
                onClick={finalizeAndSave}
                className="px-4 py-1.5 text-xs font-extrabold text-white bg-[#049A35] hover:bg-emerald-700 rounded-lg cursor-pointer shadow-xs inline-flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Salvar Cadastro Completo</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
