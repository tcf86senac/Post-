import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import {
  X,
  Check,
  Sparkles,
  Link2,
  Type,
  Eye,
  Save,
  Loader2,
  ShieldCheck,
  LogIn,
  Megaphone,
  Users,
  Trash2,
  Plus,
  RefreshCw,
  Webhook,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  ClipboardPaste,
  SlidersHorizontal,
  Layers,
  Tag,
  Target,
} from 'lucide-react';
import {
  AudienceSegmentRecord,
  ColorPaletteStyle,
  DailyPromo,
  MarketplacePlatform,
  NoteColor,
  PromoCampaign,
  TargetGenderOption,
  UserDemographicProfile,
} from '../types';
import { getNoteColorList } from '../data/noteColors';
import {
  GENERAL_INTEREST_CARDS,
  computeAudienceIntersections,
  filterAudienceIntersection,
} from '../data/interestsCatalog';
import { computeAgeBracket } from '../services/googlePeopleService';
import {
  ADMIN_EMAIL,
  PLATFORM_LABELS,
  formatTargetAudienceSummary,
  isPromoAdmin,
} from '../services/dailyPromoService';

type ModalTab = 'curation' | 'audience' | 'active' | 'fallback' | 'apis';

interface SourcesStatusResponse {
  geminiReady: boolean;
  webhookProtected: boolean;
  sources: Record<
    'mercadolivre' | 'shopee' | 'tiktok' | 'amazon',
    {
      id: string;
      name: string;
      partnerApiConfigured: boolean;
      liveDiscoveryAvailable: boolean;
      modeLabel: string;
    }
  >;
}

interface MonetizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  promo: DailyPromo;
  campaigns: PromoCampaign[];
  audienceSegments?: AudienceSegmentRecord[];
  currentUserProfile?: UserDemographicProfile;
  authUser: User | null;
  colorPalette?: ColorPaletteStyle;
  onSavePromo: (nextPromo: DailyPromo, publishToCloud: boolean) => Promise<void>;
  onSaveCampaign: (campaign: PromoCampaign, publishToCloud: boolean) => Promise<void>;
  onDeleteCampaign: (campaignId: string, publishToCloud: boolean) => Promise<void>;
  onPreviewPromo: (draftPromo: DailyPromo) => void;
  onSignInGoogle?: () => void;
}

const PLATFORM_OPTIONS: Array<{
  id: Exclude<MarketplacePlatform, 'manual'>;
  label: string;
  badgeClass: string;
}> = [
  { id: 'shopee', label: 'Shopee', badgeClass: 'bg-orange-100 text-orange-800 border-orange-300' },
  { id: 'tiktok', label: 'TikTok', badgeClass: 'bg-slate-900 text-white border-slate-700' },
  { id: 'amazon', label: 'Amazon', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300' },
  { id: 'mercadolivre', label: 'Mercado Livre', badgeClass: 'bg-yellow-100 text-yellow-900 border-yellow-300' },
];

const getPlatformBadgeClass = (platform: MarketplacePlatform): string => {
  switch (platform) {
    case 'shopee':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'tiktok':
      return 'bg-slate-900 text-white border-slate-700';
    case 'amazon':
      return 'bg-amber-100 text-amber-900 border-amber-300';
    case 'mercadolivre':
      return 'bg-yellow-100 text-yellow-900 border-yellow-400';
    default:
      return 'bg-sky-100 text-sky-900 border-sky-300';
  }
};

export const MonetizationModal: React.FC<MonetizationModalProps> = ({
  isOpen,
  onClose,
  promo,
  campaigns,
  audienceSegments = [],
  currentUserProfile,
  authUser,
  colorPalette = 'vibrant',
  onSavePromo,
  onSaveCampaign,
  onDeleteCampaign,
  onPreviewPromo,
  onSignInGoogle,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('curation');

  // Fallback general ticker state (dailyPromos/active)
  const [tickerText, setTickerText] = useState(promo.tickerText);
  const [targetUrl, setTargetUrl] = useState(promo.targetUrl);
  const [title, setTitle] = useState(promo.title);
  const [description, setDescription] = useState(promo.description);
  const [sponsorName, setSponsorName] = useState(promo.sponsorName);
  const [ctaLabel, setCtaLabel] = useState(promo.ctaLabel);
  const [noteColor, setNoteColor] = useState<NoteColor>(promo.noteColor || 'yellow');
  const [isActive, setIsActive] = useState(promo.isActive);

  // Trend Capture controls
  const [selectedPlatforms, setSelectedPlatforms] = useState<
    Array<Exclude<MarketplacePlatform, 'manual'>>
  >(['shopee', 'tiktok', 'amazon', 'mercadolivre']);
  const [categoryHint, setCategoryHint] = useState('');
  const [selectedInterestHints, setSelectedInterestHints] = useState<string[]>([]);
  const [showInterestPicker, setShowInterestPicker] = useState(false);
  const [audienceGenderHint, setAudienceGenderHint] = useState<TargetGenderOption>('all');
  const [audienceAgeMinHint, setAudienceAgeMinHint] = useState<number>(18);
  const [audienceAgeMaxHint, setAudienceAgeMaxHint] = useState<number>(60);
  const [isCapturing, setIsCapturing] = useState(false);

  // Audience Intersection Builder state
  const [selectedIntersectionTopics, setSelectedIntersectionTopics] = useState<string[]>([]);
  const [intersectionTopicSearch, setIntersectionTopicSearch] = useState('');

  // Manual external paste / normalize
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pastePlatform, setPastePlatform] = useState<MarketplacePlatform>('shopee');
  const [pasteInput, setPasteInput] = useState('');
  const [isNormalizingPaste, setIsNormalizingPaste] = useState(false);

  // Local editable state for pending drafts + editing an approved campaign
  const [draftEdits, setDraftEdits] = useState<Record<string, PromoCampaign>>({});
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [sourcesStatus, setSourcesStatus] = useState<SourcesStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!isOpen) return;
    setTickerText(promo.tickerText);
    setTargetUrl(promo.targetUrl);
    setTitle(promo.title);
    setDescription(promo.description);
    setSponsorName(promo.sponsorName);
    setCtaLabel(promo.ctaLabel);
    setNoteColor(promo.noteColor || 'yellow');
    setIsActive(promo.isActive);
    setFeedback(null);
  }, [isOpen, promo]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoadingStatus(true);
    fetch('/api/promos/sources-status')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.success) {
          setSourcesStatus(data);
        }
      })
      .catch(() => {
        // ignore network error
      })
      .finally(() => {
        if (!cancelled) setIsLoadingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Build effective audience segments (Firestore records or local fallback preview if empty)
  const { effectiveSegments, isUsingLocalSample } = useMemo(() => {
    if (audienceSegments.length > 0) {
      return { effectiveSegments: audienceSegments, isUsingLocalSample: false };
    }
    if (currentUserProfile && (currentUserProfile.generalInterests?.length || 0) > 0) {
      const sample: AudienceSegmentRecord = {
        uid: 'local_preview',
        ageBracket: computeAgeBracket(
          currentUserProfile.age,
          currentUserProfile.ageNotDeclared
        ),
        gender: currentUserProfile.gender || 'Prefiro não declarar',
        regionLabel: currentUserProfile.locationNotDeclared
          ? 'Não declarada'
          : currentUserProfile.location || 'Brasil',
        generalInterests: currentUserProfile.generalInterests || [],
        relatedInterests: currentUserProfile.relatedInterests || [],
      };
      return { effectiveSegments: [sample], isUsingLocalSample: true };
    }
    return { effectiveSegments: [] as AudienceSegmentRecord[], isUsingLocalSample: false };
  }, [audienceSegments, currentUserProfile]);

  const audienceStats = useMemo(
    () => computeAudienceIntersections(effectiveSegments),
    [effectiveSegments]
  );

  const customIntersection = useMemo(
    () => filterAudienceIntersection(effectiveSegments, selectedIntersectionTopics),
    [effectiveSegments, selectedIntersectionTopics]
  );

  const estimateCampaignReach = (camp: PromoCampaign): number => {
    if (effectiveSegments.length === 0) return 0;
    const campTopics = (camp.targetInterests || []).map((t) => t.trim().toLowerCase()).filter(Boolean);
    return effectiveSegments.filter((seg) => {
      if (camp.targetGender && camp.targetGender !== 'all') {
        if (seg.gender && seg.gender !== 'Prefiro não declarar' && seg.gender !== camp.targetGender) {
          return false;
        }
      }
      if (campTopics.length === 0) return true;
      const segText = [...(seg.generalInterests || []), ...(seg.relatedInterests || [])]
        .join(' ')
        .toLowerCase();
      return campTopics.some((t) => segText.includes(t));
    }).length;
  };

  if (!isOpen) return null;

  const isAdmin = isPromoAdmin(authUser);
  const isNonAdminSignedIn = Boolean(authUser && !isAdmin);
  const paletteList = getNoteColorList(colorPalette);

  const pendingCampaigns = campaigns.filter((c) => c.status === 'pending_curation');
  const approvedCampaigns = campaigns.filter((c) => c.status === 'approved');

  const getEditableCampaign = (camp: PromoCampaign): PromoCampaign => {
    return draftEdits[camp.id] || camp;
  };

  const updateEditableCampaign = (
    camp: PromoCampaign,
    patch: Partial<PromoCampaign>
  ) => {
    const base = getEditableCampaign(camp);
    setDraftEdits((prev) => ({
      ...prev,
      [camp.id]: { ...base, ...patch },
    }));
  };

  const togglePlatform = (id: Exclude<MarketplacePlatform, 'manual'>) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleInterestHint = (label: string) => {
    setSelectedInterestHints((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
    );
  };

  const toggleIntersectionTopic = (label: string) => {
    setSelectedIntersectionTopics((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
    );
  };

  const handleCaptureTrends = async (override?: {
    categoryHint?: string;
    interests?: string[];
    gender?: TargetGenderOption;
    ageMin?: number;
    ageMax?: number;
  }) => {
    if (selectedPlatforms.length === 0) {
      setFeedback({
        type: 'err',
        text: 'Selecione pelo menos um marketplace (Shopee, TikTok, Amazon ou Mercado Livre).',
      });
      return;
    }

    const effectiveCategory =
      override?.categoryHint !== undefined ? override.categoryHint : categoryHint.trim();
    const effectiveInterests =
      override?.interests !== undefined ? override.interests : selectedInterestHints;
    const effectiveGender =
      override?.gender !== undefined ? override.gender : audienceGenderHint;
    const effectiveAgeMin =
      override?.ageMin !== undefined ? override.ageMin : audienceAgeMinHint;
    const effectiveAgeMax =
      override?.ageMax !== undefined ? override.ageMax : audienceAgeMaxHint;

    setIsCapturing(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/promos/capture-trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: selectedPlatforms,
          categoryHint: effectiveCategory,
          audienceHint: {
            gender: effectiveGender,
            ageMin: effectiveAgeMin,
            ageMax: effectiveAgeMax,
            location: 'Brasil (Todos)',
            interests: effectiveInterests,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Falha ao captar produtos em alta.');
      }

      const generatedDrafts = (data.drafts || []) as PromoCampaign[];
      for (const draft of generatedDrafts) {
        await onSaveCampaign(
          {
            ...draft,
            targetInterests:
              draft.targetInterests && draft.targetInterests.length > 0
                ? draft.targetInterests
                : effectiveInterests,
            status: 'pending_curation',
            isActive: false,
            updatedByEmail: authUser?.email || ADMIN_EMAIL,
          },
          isAdmin
        );
      }

      setFeedback({
        type: 'ok',
        text: `${generatedDrafts.length} produto(s) captados e tratados na fila de curadoria! Confira o público-alvo e interesses antes de aprovar.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: err?.message || 'Erro ao captar tendências.',
      });
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCaptureForCluster = (
    topics: string[],
    subtopics: string[] = [],
    topGender?: string
  ) => {
    const combinedInterests = [...topics, ...subtopics.slice(0, 3)].slice(0, 8);
    const hintText = `${topics.join(' + ')}${
      subtopics.length > 0 ? ` (${subtopics.slice(0, 2).join(', ')})` : ''
    }`;
    const mappedGender: TargetGenderOption =
      topGender === 'Feminino' || topGender === 'Masculino' || topGender === 'Não-binário'
        ? topGender
        : 'all';

    setSelectedInterestHints(combinedInterests);
    setCategoryHint(hintText);
    setAudienceGenderHint(mappedGender);
    setActiveTab('curation');
    void handleCaptureTrends({
      categoryHint: hintText,
      interests: combinedInterests,
      gender: mappedGender,
      ageMin: audienceAgeMinHint,
      ageMax: audienceAgeMaxHint,
    });
  };

  const handleNormalizePaste = async () => {
    if (!pasteInput.trim()) return;
    setIsNormalizingPaste(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/promos/normalize-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawTextOrUrl: pasteInput.trim(),
          sourcePlatform: pastePlatform,
          audienceHint: {
            gender: audienceGenderHint,
            ageMin: audienceAgeMinHint,
            ageMax: audienceAgeMaxHint,
            interests: selectedInterestHints,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Não foi possível tratar o produto.');
      }

      const drafts = (data.drafts || []) as PromoCampaign[];
      for (const d of drafts) {
        await onSaveCampaign(
          {
            ...d,
            status: 'pending_curation',
            isActive: false,
            updatedByEmail: authUser?.email || ADMIN_EMAIL,
          },
          isAdmin
        );
      }
      setPasteInput('');
      setShowPasteBox(false);
      setFeedback({
        type: 'ok',
        text: 'Produto tratado com IA e adicionado à fila de curadoria para sua aprovação!',
      });
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: err?.message || 'Erro ao tratar produto.',
      });
    } finally {
      setIsNormalizingPaste(false);
    }
  };

  const handleApproveCampaign = async (camp: PromoCampaign) => {
    const edited = getEditableCampaign(camp);
    setBusyId(camp.id);
    setFeedback(null);
    try {
      await onSaveCampaign(
        {
          ...edited,
          status: 'approved',
          isActive: true,
          updatedByEmail: authUser?.email || ADMIN_EMAIL,
        },
        isAdmin
      );
      setEditingCampaignId(null);
      setFeedback({
        type: 'ok',
        text: isAdmin
          ? `Aprovado! "${edited.title}" agora será exibido apenas para: ${formatTargetAudienceSummary(edited)}.`
          : 'Aprovado no preview local! Entre como Admin para publicar na nuvem.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: err?.message || 'Erro ao aprovar campanha.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleCampaignActive = async (camp: PromoCampaign) => {
    setBusyId(camp.id);
    setFeedback(null);
    try {
      await onSaveCampaign(
        {
          ...camp,
          isActive: !camp.isActive,
          updatedByEmail: authUser?.email || ADMIN_EMAIL,
        },
        isAdmin
      );
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: err?.message || 'Erro ao alterar status da campanha.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveCampaign = async (campId: string) => {
    setBusyId(campId);
    setFeedback(null);
    try {
      await onDeleteCampaign(campId, isAdmin);
      setFeedback({ type: 'ok', text: 'Item removido da fila.' });
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: err?.message || 'Erro ao remover campanha.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateBlankCampaign = async () => {
    const blank: PromoCampaign = {
      id: `camp_manual_${Date.now()}`,
      sourcePlatform: 'manual',
      status: 'pending_curation',
      isActive: false,
      tickerText: 'Oferta selecionada no Post+ — toque para abrir!',
      title: 'Nova Oferta Curada',
      description: 'Descreva aqui o produto ou dica de forma acolhedora.',
      sponsorName: 'Destaque Post+',
      priceLabel: '',
      ctaLabel: 'Acessar Oferta',
      targetUrl: 'https://',
      noteColor: 'yellow',
      targetGender: 'all',
      targetAgeMin: 18,
      targetAgeMax: 65,
      targetLocation: 'Brasil (Todos)',
      curationRationale: 'Campanha manual criada pelo administrador para revisão de perfil.',
      sourceMethod: 'manual',
      updatedByEmail: authUser?.email || ADMIN_EMAIL,
    };
    setBusyId(blank.id);
    try {
      await onSaveCampaign(blank, isAdmin);
      setActiveTab('curation');
      setFeedback({
        type: 'ok',
        text: 'Rascunho criado na fila de Curadoria. Defina o público-alvo e clique em Aprovar!',
      });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Erro ao criar rascunho.' });
    } finally {
      setBusyId(null);
    }
  };

  const buildFallbackPromo = (): DailyPromo => ({
    id: promo.id,
    tickerText: tickerText.trim() || 'Confira o destaque de hoje no Post+!',
    targetUrl: targetUrl.trim() || 'https://',
    title: title.trim() || 'Destaque do Dia',
    description: description.trim(),
    sponsorName: sponsorName.trim() || 'Destaque',
    ctaLabel: ctaLabel.trim() || 'Acessar Link',
    noteColor,
    isActive,
    updatedByEmail: authUser?.email || undefined,
  });

  const handleSaveFallback = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      const draft = buildFallbackPromo();
      await onSavePromo(draft, isAdmin);
      setFeedback({
        type: 'ok',
        text: isAdmin
          ? 'Letreiro Geral padrão salvo na nuvem!'
          : 'Salvo para teste local! Entre como Admin para publicar na nuvem.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: err?.message || 'Não foi possível salvar o letreiro geral.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderCampaignEditorCard = (
    rawCamp: PromoCampaign,
    mode: 'pending' | 'approved'
  ) => {
    const camp = getEditableCampaign(rawCamp);
    const isBusy = busyId === camp.id;
    const isEditingApproved = mode === 'approved' && editingCampaignId === camp.id;
    const showFormFields = mode === 'pending' || isEditingApproved;

    return (
      <div
        key={camp.id}
        className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden text-left"
      >
        {/* Top bar: Platform + Status + Price */}
        <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${getPlatformBadgeClass(
                camp.sourcePlatform
              )}`}
            >
              {PLATFORM_LABELS[camp.sourcePlatform]}
            </span>
            {camp.priceLabel && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-extrabold">
                {camp.priceLabel}
              </span>
            )}
            <span className="text-[10px] text-slate-500 font-semibold">
              {mode === 'pending'
                ? 'Aguardando sua curadoria'
                : camp.isActive
                ? 'Ativo e entregando ao perfil'
                : 'Pausado'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPreviewPromo(camp)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-[#125882] border border-sky-200 text-[10.5px] font-bold cursor-pointer"
              title="Visualizar como Nota no mural"
            >
              <Eye className="w-3 h-3" />
              <span>Prévia</span>
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleRemoveCampaign(camp.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer disabled:opacity-50"
              title="Descartar / Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* CRITICAL AUDIENCE CALLOUT: Shows Admin WHO will receive this ad */}
        <div className="px-3.5 py-2.5 bg-indigo-50/80 border-b border-indigo-100 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-indigo-950">
              <Users className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
              <span>Para qual perfil este anúncio vai:</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {effectiveSegments.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-200 text-[10px] font-extrabold">
                  ~{estimateCampaignReach(camp)} compatível(is) na base
                </span>
              )}
              {!showFormFields && (
                <span className="text-[11px] font-bold text-indigo-900">
                  {formatTargetAudienceSummary(camp)}
                </span>
              )}
            </div>
          </div>

          {showFormFields ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[9.5px] font-bold uppercase tracking-wider text-indigo-900 mb-0.5">
                    Gênero
                  </label>
                  <select
                    value={camp.targetGender}
                    onChange={(e) =>
                      updateEditableCampaign(rawCamp, {
                        targetGender: e.target.value as TargetGenderOption,
                      })
                    }
                    className="w-full px-2 py-1 text-[11px] font-bold bg-white border border-indigo-200 rounded-lg text-slate-800"
                  >
                    <option value="all">Todos os gêneros</option>
                    <option value="Feminino">Mulheres (Feminino)</option>
                    <option value="Masculino">Homens (Masculino)</option>
                    <option value="Não-binário">Não-binário</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9.5px] font-bold uppercase tracking-wider text-indigo-900 mb-0.5">
                    Faixa Etária (anos)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={camp.targetAgeMin}
                      onChange={(e) =>
                        updateEditableCampaign(rawCamp, {
                          targetAgeMin: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1 text-[11px] font-bold bg-white border border-indigo-200 rounded-lg text-slate-800"
                    />
                    <span className="text-[10px] font-bold text-indigo-800">a</span>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={camp.targetAgeMax}
                      onChange={(e) =>
                        updateEditableCampaign(rawCamp, {
                          targetAgeMax: Number(e.target.value) || 99,
                        })
                      }
                      className="w-full px-2 py-1 text-[11px] font-bold bg-white border border-indigo-200 rounded-lg text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9.5px] font-bold uppercase tracking-wider text-indigo-900 mb-0.5">
                    Localização
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={camp.targetLocation}
                    onChange={(e) =>
                      updateEditableCampaign(rawCamp, {
                        targetLocation: e.target.value,
                      })
                    }
                    placeholder="Brasil (Todos)"
                    className="w-full px-2 py-1 text-[11px] font-bold bg-white border border-indigo-200 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-wider text-indigo-900 mb-0.5">
                  Interesses & Subtemas Alvo (separados por vírgula)
                </label>
                <input
                  type="text"
                  value={(camp.targetInterests || []).join(', ')}
                  onChange={(e) =>
                    updateEditableCampaign(rawCamp, {
                      targetInterests: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .slice(0, 15),
                    })
                  }
                  placeholder="Ex: Tecnologia, Música, Fones Bluetooth, Casa & Decoração"
                  className="w-full px-2 py-1 text-[11px] font-semibold bg-white border border-indigo-200 rounded-lg text-slate-800"
                />
              </div>
            </div>
          ) : (
            (camp.targetInterests?.length || 0) > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <Tag className="w-3 h-3 text-indigo-700 shrink-0" />
                {camp.targetInterests!.slice(0, 6).map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded bg-white border border-indigo-200 text-indigo-900 text-[10px] font-bold"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )
          )}

          {camp.curationRationale && (
            <p className="text-[11px] text-indigo-950/90 leading-snug bg-white/75 rounded-lg px-2.5 py-1.5 border border-indigo-100">
              <strong className="font-bold">Motivo da indicação:</strong>{' '}
              {camp.curationRationale}
            </p>
          )}
        </div>

        {/* Ad Content Section */}
        <div className="p-3.5 space-y-2.5">
          {showFormFields ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    Título da Nota
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={camp.title}
                    onChange={(e) =>
                      updateEditableCampaign(rawCamp, { title: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    Preço (opcional)
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={camp.priceLabel}
                    onChange={(e) =>
                      updateEditableCampaign(rawCamp, { priceLabel: e.target.value })
                    }
                    placeholder="Ex: R$ 89,90"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  Texto Corrido do Letreiro (1º clique no rodapé)
                </label>
                <input
                  type="text"
                  maxLength={240}
                  value={camp.tickerText}
                  onChange={(e) =>
                    updateEditableCampaign(rawCamp, { tickerText: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  Descrição dentro da Nota
                </label>
                <textarea
                  rows={2}
                  maxLength={1200}
                  value={camp.description}
                  onChange={(e) =>
                    updateEditableCampaign(rawCamp, { description: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    Link de Destino / Afiliado (2º clique)
                  </label>
                  <input
                    type="url"
                    maxLength={800}
                    value={camp.targetUrl}
                    onChange={(e) =>
                      updateEditableCampaign(rawCamp, { targetUrl: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    Texto do Botão
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={camp.ctaLabel}
                    onChange={(e) =>
                      updateEditableCampaign(rawCamp, { ctaLabel: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <div className="flex items-center gap-1 flex-wrap">
                  {paletteList.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => updateEditableCampaign(rawCamp, { noteColor: c.id })}
                      title={c.label}
                      className={`w-5 h-5 rounded-full ${c.bgClass} border cursor-pointer flex items-center justify-center ${
                        camp.noteColor === c.id
                          ? 'border-slate-900 scale-115 ring-2 ring-slate-400'
                          : 'border-slate-300'
                      }`}
                    >
                      {camp.noteColor === c.id && (
                        <Check className="w-2.5 h-2.5 text-slate-900 stroke-[3]" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {isEditingApproved && (
                    <button
                      type="button"
                      onClick={() => setEditingCampaignId(null)}
                      className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleApproveCampaign(camp)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#049A35] hover:bg-emerald-700 text-white text-[11px] font-extrabold cursor-pointer shadow-xs disabled:opacity-60"
                  >
                    {isBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isEditingApproved ? 'Salvar Alterações' : 'Aprovar e Publicar'}
                    </span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs font-extrabold text-slate-900">{camp.title}</p>
              <p className="text-[11px] text-slate-600 line-clamp-2">{camp.tickerText}</p>
              <p className="text-[10px] text-slate-400 truncate">{camp.targetUrl}</p>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCampaignId(camp.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>Editar Perfil / Texto</span>
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleToggleCampaignActive(camp)}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                    camp.isActive
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                      : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900'
                  }`}
                >
                  {camp.isActive ? (
                    <>
                      <PauseCircle className="w-3.5 h-3.5" />
                      <span>Pausar</span>
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>Reativar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-[#1D86C4] text-white shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Megaphone className="w-4 h-4 text-[#FEE725] shrink-0" />
            <div className="text-left min-w-0">
              <h3 className="text-xs sm:text-sm font-bold leading-tight truncate">
                {isNonAdminSignedIn
                  ? 'Destaques & Recomendações'
                  : 'Curadoria de Produtos, APIs & Letreiro'}
              </h3>
              <p className="text-[10px] text-white/85 truncate">
                {isNonAdminSignedIn
                  ? 'Experiência humanista em 2 cliques do Post+'
                  : 'Shopee, TikTok, Amazon e Mercado Livre com aprovação manual por perfil'}
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

        {/* Non-admin regular signed-in view */}
        {isNonAdminSignedIn ? (
          <div className="p-4 space-y-3 text-xs text-slate-700 text-left">
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[#125882]">
                <ShieldCheck className="w-4 h-4 text-[#1D86C4]" />
                <span>Publicidade Confortável em 2 Etapas</span>
              </div>
              <p className="text-[11.5px] text-slate-700 leading-relaxed">
                No Post+, nenhuma propaganda interrompe seu mural. As dicas e achados aparecem de forma discreta no rodapé esquerdo, selecionados com respeito às suas preferências, e só abrem uma Nota quando você toca para ler com calma.
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#1D86C4] hover:bg-[#166FA3] rounded-lg cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Admin Auth Banner + Navigation Tabs */}
            <div className="px-4 pt-3 pb-2 bg-slate-50 border-b border-slate-200 space-y-2.5 shrink-0">
              {isAdmin ? (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ShieldCheck className="w-4 h-4 text-[#049A35] shrink-0" />
                    <span className="text-[11px] font-bold text-emerald-900 truncate">
                      Curador Admin ativo ({authUser?.email})
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#049A35] text-white text-[9.5px] font-bold shrink-0">
                    Nuvem Global
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[11px] text-amber-950 leading-snug flex-1 min-w-[200px] text-left">
                    Entre com <strong>{ADMIN_EMAIL}</strong> para publicar na nuvem. Sem login, a curadoria funciona em modo preview local.
                  </p>
                  {onSignInGoogle && (
                    <button
                      type="button"
                      onClick={onSignInGoogle}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D86C4] hover:bg-[#166FA3] text-white text-[11px] font-bold cursor-pointer shrink-0"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Entrar Admin</span>
                    </button>
                  )}
                </div>
              )}

              {/* Global Master Switch: Ligar / Desligar Barra de Anúncios no App */}
              <div
                className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                  isActive
                    ? 'bg-emerald-50/75 border-emerald-200'
                    : 'bg-slate-100 border-slate-300'
                }`}
              >
                <div className="min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11.5px] font-extrabold text-slate-900">
                      Barra de Anúncios no Rodapé
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                        isActive
                          ? 'bg-[#049A35] text-white'
                          : 'bg-slate-500 text-white'
                      }`}
                    >
                      {isActive ? 'Ligado' : 'Desligado'}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-600 leading-snug">
                    {isActive
                      ? 'Exibindo normalmente para os usuários — clique ao lado para ocultar.'
                      : 'Desligado: nenhuma barra ou anúncio aparece na tela inicial.'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isSaving}
                  aria-label={isActive ? 'Desligar barra de anúncios' : 'Ligar barra de anúncios'}
                  onClick={async () => {
                    const nextActive = !isActive;
                    setIsActive(nextActive);
                    setIsSaving(true);
                    setFeedback(null);
                    try {
                      await onSavePromo(
                        { ...buildFallbackPromo(), isActive: nextActive },
                        isAdmin
                      );
                      setFeedback({
                        type: 'ok',
                        text: nextActive
                          ? 'Barra de anúncios LIGADA no aplicativo!'
                          : 'Barra de anúncios DESLIGADA no aplicativo!',
                      });
                    } catch (err: any) {
                      setIsActive(!nextActive);
                      setFeedback({
                        type: 'err',
                        text: err?.message || 'Erro ao alterar visibilidade da barra.',
                      });
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-60 ${
                    isActive ? 'bg-[#049A35]' : 'bg-slate-400'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                      isActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Modal Sub-tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('curation')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap cursor-pointer transition-colors ${
                    activeTab === 'curation'
                      ? 'bg-[#1D86C4] text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Curadoria ({pendingCampaigns.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('audience')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap cursor-pointer transition-colors ${
                    activeTab === 'audience'
                      ? 'bg-[#1D86C4] text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Públicos & Interseções ({effectiveSegments.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('active')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap cursor-pointer transition-colors ${
                    activeTab === 'active'
                      ? 'bg-[#1D86C4] text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Ativos & Perfis ({approvedCampaigns.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('fallback')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap cursor-pointer transition-colors ${
                    activeTab === 'fallback'
                      ? 'bg-[#1D86C4] text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Letreiro Geral
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('apis')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap cursor-pointer transition-colors ${
                    activeTab === 'apis'
                      ? 'bg-[#1D86C4] text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  APIs & Webhook
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs text-slate-700 custom-scrollbar text-left">
              {feedback && (
                <div
                  className={`p-2.5 rounded-xl text-[11px] font-semibold border ${
                    feedback.type === 'ok'
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {feedback.text}
                </div>
              )}

              {/* TAB 1: CURADORIA & CAPTURA */}
              {activeTab === 'curation' && (
                <div className="space-y-4">
                  {/* Capture Control Panel */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#1D86C4]" />
                          <span>Captar Produtos em Alta para Curadoria</span>
                        </h4>
                        <p className="text-[10.5px] text-slate-500">
                          Nada vai para os usuários sem você revisar o perfil (homem/mulher/idade) e aprovar.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPasteBox((v) => !v)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-[10.5px] font-bold cursor-pointer"
                      >
                        <ClipboardPaste className="w-3 h-3" />
                        <span>Colar Link / Produto</span>
                      </button>
                    </div>

                    {/* Platform selection toggles */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {PLATFORM_OPTIONS.map((plat) => {
                        const selected = selectedPlatforms.includes(plat.id);
                        return (
                          <button
                            key={plat.id}
                            type="button"
                            onClick={() => togglePlatform(plat.id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                              selected
                                ? `${plat.badgeClass} ring-2 ring-[#1D86C4]/40`
                                : 'bg-white text-slate-500 border-slate-200 opacity-70 hover:opacity-100'
                            }`}
                          >
                            {selected && <Check className="w-3 h-3 stroke-[3]" />}
                            <span>{plat.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Optional focus hint */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-[9.5px] font-bold uppercase text-slate-500 mb-0.5">
                          Categoria / Nicho (opcional)
                        </label>
                        <input
                          type="text"
                          value={categoryHint}
                          onChange={(e) => setCategoryHint(e.target.value)}
                          placeholder="Ex: Organização, Beleza, Casa, Tech..."
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[9.5px] font-bold uppercase text-slate-500 mb-0.5">
                          Foco de Gênero
                        </label>
                        <select
                          value={audienceGenderHint}
                          onChange={(e) =>
                            setAudienceGenderHint(e.target.value as TargetGenderOption)
                          }
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-semibold"
                        >
                          <option value="all">Automático / Todos</option>
                          <option value="Feminino">Mulheres (Feminino)</option>
                          <option value="Masculino">Homens (Masculino)</option>
                          <option value="Não-binário">Não-binário</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9.5px] font-bold uppercase text-slate-500 mb-0.5">
                          Idade Foco
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={120}
                            value={audienceAgeMinHint}
                            onChange={(e) =>
                              setAudienceAgeMinHint(Number(e.target.value) || 0)
                            }
                            className="w-full px-1.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                          <span className="text-[10px]">-</span>
                          <input
                            type="number"
                            min={0}
                            max={120}
                            value={audienceAgeMaxHint}
                            onChange={(e) =>
                              setAudienceAgeMaxHint(Number(e.target.value) || 99)
                            }
                            className="w-full px-1.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Interest Filters for Targeted Product Discovery */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-200">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                          <Target className="w-3 h-3 text-[#1D86C4]" />
                          <span>Interesses Alvo na Pesquisa ({selectedInterestHints.length})</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          {selectedInterestHints.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedInterestHints([])}
                              className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                            >
                              Limpar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowInterestPicker((v) => !v)}
                            className="px-2 py-0.5 rounded-lg bg-white hover:bg-sky-50 border border-slate-300 text-[#125882] text-[10px] font-bold cursor-pointer"
                          >
                            {showInterestPicker ? 'Ocultar 50 Temas' : '+ Escolher dos 50 Temas'}
                          </button>
                        </div>
                      </div>

                      {selectedInterestHints.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {selectedInterestHints.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleInterestHint(tag)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-100 text-[#0D3B66] border border-sky-300 text-[10.5px] font-bold cursor-pointer hover:bg-sky-200"
                              title="Remover filtro de interesse"
                            >
                              <span>{tag}</span>
                              <X className="w-2.5 h-2.5" />
                            </button>
                          ))}
                        </div>
                      )}

                      {showInterestPicker && (
                        <div className="p-2 rounded-xl bg-white border border-slate-200 max-h-36 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1 custom-scrollbar">
                          {GENERAL_INTEREST_CARDS.map((card) => {
                            const active = selectedInterestHints.includes(card.label);
                            return (
                              <button
                                key={card.id}
                                type="button"
                                onClick={() => toggleInterestHint(card.label)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border text-left flex items-center gap-1 cursor-pointer transition-colors ${
                                  active
                                    ? 'bg-[#1D86C4] text-white border-[#125882]'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                <span>{card.emoji}</span>
                                <span className="truncate">{card.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => void handleCreateBlankCampaign()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-bold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Criar Rascunho Manual</span>
                      </button>

                      <button
                        type="button"
                        disabled={isCapturing}
                        onClick={() => void handleCaptureTrends()}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#1D86C4] hover:bg-[#166FA3] text-white text-xs font-extrabold cursor-pointer shadow-xs disabled:opacity-60"
                      >
                        {isCapturing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isCapturing
                            ? 'Captando & Classificando...'
                            : 'Captar em Alta + Tratar com IA'}
                        </span>
                      </button>
                    </div>

                    {/* Quick Paste External Product Box */}
                    {showPasteBox && (
                      <div className="p-3 rounded-xl bg-white border border-sky-200 space-y-2 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-[#125882]">
                            Importar e Tratar Link / Produto Externo
                          </span>
                          <select
                            value={pastePlatform}
                            onChange={(e) =>
                              setPastePlatform(e.target.value as MarketplacePlatform)
                            }
                            className="px-2 py-1 text-[11px] font-bold border border-slate-300 rounded-lg"
                          >
                            <option value="shopee">Shopee</option>
                            <option value="tiktok">TikTok Shop</option>
                            <option value="amazon">Amazon</option>
                            <option value="mercadolivre">Mercado Livre</option>
                            <option value="manual">Outro Link</option>
                          </select>
                        </div>
                        <textarea
                          rows={2}
                          value={pasteInput}
                          onChange={(e) => setPasteInput(e.target.value)}
                          placeholder="Cole o link do produto, nome e preço (ex: Kit Organizador Giratório R$ 49,90 https://shopee.com.br/...)"
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowPasteBox(false)}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-600 cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={isNormalizingPaste || !pasteInput.trim()}
                            onClick={() => void handleNormalizePaste()}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#049A35] text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                          >
                            {isNormalizingPaste && (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            )}
                            <span>Tratar para Curadoria</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pending Curation List */}
                  {pendingCampaigns.length === 0 ? (
                    <div className="p-6 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 space-y-1">
                      <p className="text-xs font-bold text-slate-700">
                        Nenhum rascunho pendente na fila de curadoria.
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Clique em <strong>Captar em Alta + Tratar com IA</strong> acima para buscar produtos da Shopee, TikTok, Amazon e Mercado Livre e revisar para qual perfil cada um vai.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingCampaigns.map((camp) =>
                        renderCampaignEditorCard(camp, 'pending')
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 1.5: AUDIENCE INTERSECTIONS & TARGETING CLUSTERS */}
              {activeTab === 'audience' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="text-xs font-extrabold text-[#0D3B66] flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-[#1D86C4]" />
                        <span>Agrupamento por Interseção de Interesses</span>
                      </h4>
                      <span className="px-2 py-0.5 rounded bg-white border border-sky-300 text-[#125882] text-[10px] font-extrabold">
                        {audienceStats.totalProfilesWithInterests} perfil(is) mapeado(s)
                      </span>
                    </div>
                    <p className="text-[11px] text-sky-950 leading-snug">
                      O Post+ cruza os 10 temas gerais e subtemas escolhidos pelos usuários para mostrar quantas pessoas pertencem exatamente à mesma interseção (ex: <em>Tecnologia ∩ Música</em>) e disparar buscas direcionadas.
                    </p>
                    {isUsingLocalSample && (
                      <p className="text-[10.5px] font-semibold text-amber-900 bg-amber-100/80 border border-amber-200 rounded-lg px-2.5 py-1.5">
                        Exibindo os dados do cadastro local deste aparelho como prévia. Quando outros usuários completarem o cadastro conectados à nuvem, todos os perfis aparecerão agrupados aqui.
                      </p>
                    )}
                  </div>

                  {audienceStats.totalProfilesWithInterests === 0 ? (
                    <div className="p-6 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 space-y-1">
                      <p className="text-xs font-bold text-slate-700">
                        Nenhum usuário concluiu a seleção de 10 interesses ainda.
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Assim que o cadastro com os 50 cards for preenchido, os grupos e interseções de público aparecerão aqui automaticamente.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Interactive Custom Intersection Calculator */}
                      <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <h5 className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                              <Target className="w-3.5 h-3.5 text-indigo-700" />
                              <span>Simulador de Interseção (A ∩ B ∩ ...)</span>
                            </h5>
                            <p className="text-[10.5px] text-indigo-900/80">
                              Marque 2 ou mais assuntos para saber quantas pessoas têm TODOS eles juntos.
                            </p>
                          </div>
                          {selectedIntersectionTopics.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedIntersectionTopics([])}
                              className="px-2 py-1 rounded-lg bg-white border border-indigo-200 text-[10.5px] font-bold text-indigo-800 hover:bg-indigo-100 cursor-pointer"
                            >
                              Limpar ({selectedIntersectionTopics.length})
                            </button>
                          )}
                        </div>

                        <input
                          type="text"
                          value={intersectionTopicSearch}
                          onChange={(e) => setIntersectionTopicSearch(e.target.value)}
                          placeholder="Filtrar entre os 50 assuntos..."
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg"
                        />

                        <div className="flex items-center gap-1.5 flex-wrap max-h-32 overflow-y-auto custom-scrollbar">
                          {GENERAL_INTEREST_CARDS.filter(
                            (c) =>
                              !intersectionTopicSearch.trim() ||
                              c.label
                                .toLowerCase()
                                .includes(intersectionTopicSearch.trim().toLowerCase())
                          ).map((card) => {
                            const active = selectedIntersectionTopics.includes(card.label);
                            const countObj = audienceStats.topicCounts.find(
                              (t) => t.label.toLowerCase() === card.label.toLowerCase()
                            );
                            return (
                              <button
                                key={card.id}
                                type="button"
                                onClick={() => toggleIntersectionTopic(card.label)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-bold border cursor-pointer transition-colors ${
                                  active
                                    ? 'bg-indigo-700 text-white border-indigo-900 shadow-2xs'
                                    : countObj
                                    ? 'bg-white text-indigo-950 border-indigo-300 hover:bg-indigo-100'
                                    : 'bg-white/60 text-slate-500 border-slate-200 hover:bg-white'
                                }`}
                              >
                                <span>{card.emoji}</span>
                                <span>{card.label}</span>
                                {countObj && (
                                  <span
                                    className={`px-1 rounded text-[9.5px] font-black ${
                                      active
                                        ? 'bg-white/20 text-white'
                                        : 'bg-indigo-100 text-indigo-900'
                                    }`}
                                  >
                                    {countObj.count}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Live Intersection Result Box */}
                        <div className="p-3 rounded-xl bg-white border border-indigo-200 space-y-2.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 block">
                                {selectedIntersectionTopics.length === 0
                                  ? 'Base Total Analisada'
                                  : `Interseção: ${selectedIntersectionTopics.join(' ∩ ')}`}
                              </span>
                              <div className="flex items-baseline gap-2">
                                <span className="text-xl font-black text-slate-900">
                                  {customIntersection.matchedUsersCount}
                                </span>
                                <span className="text-xs font-bold text-slate-600">
                                  de {customIntersection.totalUsersCount} pessoa(s) ({customIntersection.percentage}%)
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={
                                customIntersection.matchedUsersCount === 0 ||
                                selectedIntersectionTopics.length === 0
                              }
                              onClick={() =>
                                handleCaptureForCluster(
                                  selectedIntersectionTopics,
                                  customIntersection.topSubtopics.map((s) => s.label),
                                  customIntersection.genderBreakdown[0]?.label
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#049A35] hover:bg-emerald-700 text-white text-[11px] font-extrabold cursor-pointer shadow-xs disabled:opacity-45 disabled:cursor-not-allowed"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Buscar Promoções para esta Interseção</span>
                            </button>
                          </div>

                          {customIntersection.matchedUsersCount > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                              <div>
                                <span className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                                  Distribuição por Gênero & Idade
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {customIntersection.genderBreakdown.map((g) => (
                                    <span
                                      key={g.label}
                                      className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px]"
                                    >
                                      {g.label}: {g.count}
                                    </span>
                                  ))}
                                  {customIntersection.ageBreakdown.map((a) => (
                                    <span
                                      key={a.label}
                                      className="px-2 py-0.5 rounded bg-sky-100 text-[#0D3B66] font-bold text-[10px]"
                                    >
                                      {a.label}: {a.count}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <span className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                                  Subtemas Mais Fortes no Grupo
                                </span>
                                {customIntersection.topSubtopics.length === 0 ? (
                                  <span className="text-[10.5px] text-slate-400">
                                    Nenhum subtema específico marcado ainda.
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {customIntersection.topSubtopics.slice(0, 5).map((sub) => (
                                      <span
                                        key={sub.label}
                                        className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 font-bold text-[10px]"
                                      >
                                        {sub.label} ({sub.count})
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Automatic Pair Clusters */}
                      <div className="space-y-2">
                        <h5 className="text-xs font-extrabold text-slate-900">
                          Principais Conjuntos em Comum (Pares A ∩ B)
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {audienceStats.pairClusters.map((cluster) => (
                            <div
                              key={cluster.key}
                              className="p-3 rounded-xl bg-white border border-slate-200 space-y-2 shadow-2xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-extrabold text-slate-900 leading-snug">
                                  {cluster.topics.join(' ∩ ')}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10.5px] font-black shrink-0">
                                  {cluster.count} ({cluster.percentage}%)
                                </span>
                              </div>
                              <p className="text-[10.5px] text-slate-600">
                                Perfil dominante: <strong>{cluster.topGender}</strong> ·{' '}
                                <strong>{cluster.topAgeBracket}</strong>
                              </p>
                              {cluster.topRelatedSubtopics.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {cluster.topRelatedSubtopics.slice(0, 3).map((sub) => (
                                    <span
                                      key={sub.label}
                                      className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[9.5px] font-semibold"
                                    >
                                      {sub.label}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  handleCaptureForCluster(
                                    cluster.topics,
                                    cluster.topRelatedSubtopics.map((s) => s.label),
                                    cluster.topGender
                                  )
                                }
                                className="w-full py-1.5 rounded-lg bg-[#1D86C4] hover:bg-[#166FA3] text-white text-[11px] font-bold cursor-pointer"
                              >
                                Captar Ofertas para este Conjunto
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Automatic Trio Clusters */}
                      {audienceStats.trioClusters.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-extrabold text-slate-900">
                            Super-Nichos (Interseções Triplas A ∩ B ∩ C)
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {audienceStats.trioClusters.slice(0, 6).map((cluster) => (
                              <div
                                key={cluster.key}
                                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <p className="text-[11px] font-extrabold text-slate-900 truncate">
                                    {cluster.topics.join(' ∩ ')}
                                  </p>
                                  <p className="text-[10px] text-slate-600">
                                    {cluster.count} pessoa(s) ({cluster.percentage}%) ·{' '}
                                    {cluster.topAgeBracket}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCaptureForCluster(
                                      cluster.topics,
                                      cluster.topRelatedSubtopics.map((s) => s.label),
                                      cluster.topGender
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-sky-50 border border-sky-300 text-[#125882] text-[10.5px] font-bold shrink-0 cursor-pointer"
                                >
                                  Captar
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Single Topic Ranking */}
                      <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                        <h5 className="text-xs font-extrabold text-slate-900">
                          Temas Mais Populares na Base
                        </h5>
                        <div className="space-y-1.5">
                          {audienceStats.topicCounts.slice(0, 12).map((item) => (
                            <div key={item.label} className="space-y-0.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-slate-800">{item.label}</span>
                                <span className="font-extrabold text-[#125882] tabular-nums">
                                  {item.count} pessoa(s) ({item.percentage}%)
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full bg-[#1D86C4] rounded-full"
                                  style={{ width: `${Math.max(4, item.percentage)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: APPROVED & SEGMENTED CAMPAIGNS */}
              {activeTab === 'active' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[11px] text-sky-950 leading-snug flex-1">
                      O Post+ entrega automaticamente no rodapé do usuário a campanha aprovada que combina com o <strong>gênero, idade e localização</strong> declarados no cadastro dele.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleCreateBlankCampaign()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1D86C4] text-white text-[11px] font-bold cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nova Campanha</span>
                    </button>
                  </div>

                  {approvedCampaigns.length === 0 ? (
                    <div className="p-6 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 space-y-1">
                      <p className="text-xs font-bold text-slate-700">
                        Nenhuma campanha segmentada aprovada ainda.
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Enquanto isso, os usuários visualizam o <strong>Letreiro Geral</strong> padrão.
                      </p>
                    </div>
                  ) : (
                    approvedCampaigns.map((camp) =>
                      renderCampaignEditorCard(camp, 'approved')
                    )
                  )}
                </div>
              )}

              {/* TAB 3: GENERAL FALLBACK TICKER */}
              {activeTab === 'fallback' && (
                <form onSubmit={handleSaveFallback} className="space-y-3.5">
                  <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-950">
                    Este <strong>Letreiro Geral</strong> aparece quando não houver uma campanha segmentada específica para o perfil do usuário (ou quando a pessoa escolheu &ldquo;Prefiro não declarar&rdquo;).
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Exibir Letreiro no Rodapé Esquerdo
                      </span>
                      <span className="text-[10.5px] text-slate-500">
                        Liga ou pausa o texto corrido padrão
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsActive((prev) => !prev)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                        isActive ? 'bg-[#049A35]' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                          isActive ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        <Type className="w-3.5 h-3.5 text-[#1D86C4]" />
                        <span>Texto do Letreiro</span>
                      </label>
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        {tickerText.length}/240
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      maxLength={240}
                      required
                      value={tickerText}
                      onChange={(e) => setTickerText(e.target.value)}
                      className="w-full px-3 py-2 text-xs text-slate-800 border border-slate-300 rounded-xl resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                      <Link2 className="w-3.5 h-3.5 text-[#1D86C4]" />
                      <span>Link do Dia</span>
                    </label>
                    <input
                      type="url"
                      maxLength={500}
                      required
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs text-slate-800 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                          Etiqueta / Parceiro
                        </label>
                        <input
                          type="text"
                          maxLength={80}
                          value={sponsorName}
                          onChange={(e) => setSponsorName(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                          Texto do Botão
                        </label>
                        <input
                          type="text"
                          maxLength={60}
                          value={ctaLabel}
                          onChange={(e) => setCtaLabel(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Título dentro da Nota
                      </label>
                      <input
                        type="text"
                        maxLength={120}
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Descrição
                      </label>
                      <textarea
                        rows={3}
                        maxLength={1200}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {paletteList.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setNoteColor(c.id)}
                          title={c.label}
                          className={`w-6 h-6 rounded-full ${c.bgClass} border transition-transform cursor-pointer flex items-center justify-center ${
                            noteColor === c.id
                              ? 'border-slate-900 scale-115 ring-2 ring-slate-400'
                              : 'border-slate-300 hover:scale-105'
                          }`}
                        >
                          {noteColor === c.id && (
                            <Check className="w-3 h-3 text-slate-900 stroke-[3]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onPreviewPromo(buildFallbackPromo())}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#125882] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Pré-visualizar</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#1D86C4] hover:bg-[#166FA3] rounded-lg cursor-pointer shadow-xs disabled:opacity-60"
                    >
                      {isSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>{isAdmin ? 'Salvar Letreiro Geral' : 'Salvar Preview Local'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 4: APIS & EXTERNAL AUTOMATION STATUS */}
              {activeTab === 'apis' && (
                <div className="space-y-3.5">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-900">
                        Conectores dos 4 Marketplaces (Servidor Seguro)
                      </h4>
                      {isLoadingStatus && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1D86C4]" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      O backend do Post+ integra <strong>Mercado Livre, Shopee, TikTok e Amazon</strong> combinando APIs oficiais (quando credenciais de afiliado estão nos Secrets do servidor), busca web em tempo real via IA e entrada externa via webhook.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {sourcesStatus &&
                        (['mercadolivre', 'shopee', 'tiktok', 'amazon'] as const).map(
                          (key) => {
                            const src = sourcesStatus.sources[key];
                            return (
                              <div
                                key={key}
                                className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-extrabold text-slate-900">
                                    {src.name}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                                      src.partnerApiConfigured
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-sky-100 text-sky-800'
                                    }`}
                                  >
                                    {src.partnerApiConfigured
                                      ? 'API Parceiro Ativa'
                                      : 'Descoberta Ativa'}
                                  </span>
                                </div>
                                <p className="text-[10.5px] text-slate-600">
                                  {src.modeLabel}
                                </p>
                              </div>
                            );
                          }
                        )}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-950">
                      <Webhook className="w-4 h-4 text-indigo-700" />
                      <span>Integração Externa (n8n, Make, Zapier)</span>
                    </div>
                    <p className="text-[11px] text-indigo-950/90 leading-relaxed">
                      Se você captar produtos em alta por fora (via n8n/Make nas APIs de afiliado da Shopee, TikTok, Amazon ou Mercado Livre), envie um <code className="px-1 py-0.5 bg-white rounded border">POST</code> para <code className="px-1 py-0.5 bg-white rounded border">/api/promos/normalize-external</code> para receber o rascunho tratado com gênero, faixa etária e justificativa prontos para sua curadoria.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
