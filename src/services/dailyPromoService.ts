import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import {
  DailyPromo,
  MarketplacePlatform,
  NoteColor,
  PromoCampaign,
  PromoCampaignStatus,
  TargetGenderOption,
  UserDemographicProfile,
} from '../types';
import { db, handleFirestoreError, OperationType } from './firebaseClient';

export const ADMIN_EMAIL = 'thiagocfraga86@gmail.com';
export const DAILY_PROMO_DOC_ID = 'active';
const LOCAL_DAILY_PROMO_KEY = 'postplus_daily_promo_v1';
const LOCAL_CAMPAIGNS_KEY = 'postplus_promo_campaigns_v1';

export const PLATFORM_LABELS: Record<MarketplacePlatform, string> = {
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  tiktok: 'TikTok Shop',
  amazon: 'Amazon',
  manual: 'Manual',
};

export const DEFAULT_DAILY_PROMO: DailyPromo = {
  id: DAILY_PROMO_DOC_ID,
  tickerText:
    'Dica do Dia no Post+: Organize suas tarefas com backups automáticos no Google Drive — toque para abrir o recado!',
  title: 'Dica & Recomendação do Dia',
  description:
    'Você pode editar este texto corrido, o título, a descrição e colocar o link promocional ou parceiro do dia diretamente no painel Gerenciar Letreiro (disponível para o administrador).',
  sponsorName: 'Destaque Post+',
  ctaLabel: 'Acessar Link do Dia',
  targetUrl: 'https://workspace.google.com/products/drive/',
  noteColor: 'yellow',
  isActive: true,
};

export const isPromoAdmin = (user?: User | null): boolean => {
  return Boolean(
    user?.email &&
      user.emailVerified &&
      user.email.trim().toLowerCase() === ADMIN_EMAIL
  );
};

export const loadLocalDailyPromo = (): DailyPromo => {
  try {
    const raw = localStorage.getItem(LOCAL_DAILY_PROMO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DailyPromo>;
      return {
        ...DEFAULT_DAILY_PROMO,
        ...parsed,
        id: DAILY_PROMO_DOC_ID,
      };
    }
  } catch {
    // ignore storage read error
  }
  return DEFAULT_DAILY_PROMO;
};

export const saveLocalDailyPromo = (promo: DailyPromo): void => {
  try {
    localStorage.setItem(LOCAL_DAILY_PROMO_KEY, JSON.stringify(promo));
  } catch {
    // ignore storage write error
  }
};

export const loadLocalPromoCampaigns = (): PromoCampaign[] => {
  try {
    const raw = localStorage.getItem(LOCAL_CAMPAIGNS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
};

export const saveLocalPromoCampaigns = (campaigns: PromoCampaign[]): void => {
  try {
    localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(campaigns));
  } catch {
    // ignore
  }
};

export const normalizeExternalUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return 'https://';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const normalizeCampaignId = (rawId: string): string => {
  const clean = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return clean || `camp_${Date.now()}`;
};

const parseCampaignDoc = (docId: string, d: Record<string, any>): PromoCampaign => {
  const platform: MarketplacePlatform = [
    'mercadolivre',
    'shopee',
    'tiktok',
    'amazon',
    'manual',
  ].includes(String(d.sourcePlatform))
    ? (String(d.sourcePlatform) as MarketplacePlatform)
    : 'manual';

  const status: PromoCampaignStatus = [
    'pending_curation',
    'approved',
    'rejected',
    'archived',
  ].includes(String(d.status))
    ? (String(d.status) as PromoCampaignStatus)
    : 'pending_curation';

  const targetGender: TargetGenderOption = [
    'all',
    'Feminino',
    'Masculino',
    'Não-binário',
  ].includes(String(d.targetGender))
    ? (String(d.targetGender) as TargetGenderOption)
    : 'all';

  return {
    id: docId,
    sourcePlatform: platform,
    status,
    isActive: Boolean(d.isActive),
    tickerText: typeof d.tickerText === 'string' ? d.tickerText : DEFAULT_DAILY_PROMO.tickerText,
    title: typeof d.title === 'string' ? d.title : DEFAULT_DAILY_PROMO.title,
    description: typeof d.description === 'string' ? d.description : '',
    sponsorName: typeof d.sponsorName === 'string' ? d.sponsorName : PLATFORM_LABELS[platform],
    priceLabel: typeof d.priceLabel === 'string' ? d.priceLabel : '',
    ctaLabel: typeof d.ctaLabel === 'string' ? d.ctaLabel : 'Acessar Link',
    targetUrl: typeof d.targetUrl === 'string' ? d.targetUrl : DEFAULT_DAILY_PROMO.targetUrl,
    noteColor: (typeof d.noteColor === 'string' ? d.noteColor : 'yellow') as NoteColor,
    targetGender,
    targetAgeMin: typeof d.targetAgeMin === 'number' ? d.targetAgeMin : 0,
    targetAgeMax: typeof d.targetAgeMax === 'number' ? d.targetAgeMax : 99,
    targetLocation:
      typeof d.targetLocation === 'string' && d.targetLocation.trim()
        ? d.targetLocation
        : 'Brasil (Todos)',
    targetInterests: Array.isArray(d.targetInterests)
      ? d.targetInterests.filter((v: unknown) => typeof v === 'string')
      : [],
    curationRationale:
      typeof d.curationRationale === 'string' ? d.curationRationale : '',
    sourceMethod: typeof d.sourceMethod === 'string' ? d.sourceMethod : 'manual',
    updatedByEmail: typeof d.updatedByEmail === 'string' ? d.updatedByEmail : undefined,
    updatedAt:
      d.updatedAt?.toDate?.()?.toISOString?.() ||
      (typeof d.updatedAt === 'string' ? d.updatedAt : undefined),
    createdAt:
      d.createdAt?.toDate?.()?.toISOString?.() ||
      (typeof d.createdAt === 'string' ? d.createdAt : undefined),
  };
};

export const subscribeActiveDailyPromo = (
  onUpdate: (promo: DailyPromo) => void
): (() => void) => {
  const path = `dailyPromos/${DAILY_PROMO_DOC_ID}`;
  const ref = doc(db, 'dailyPromos', DAILY_PROMO_DOC_ID);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      const loaded: DailyPromo = {
        id: DAILY_PROMO_DOC_ID,
        tickerText: typeof d.tickerText === 'string' ? d.tickerText : DEFAULT_DAILY_PROMO.tickerText,
        title: typeof d.title === 'string' ? d.title : DEFAULT_DAILY_PROMO.title,
        description: typeof d.description === 'string' ? d.description : '',
        sponsorName: typeof d.sponsorName === 'string' ? d.sponsorName : 'Destaque Post+',
        ctaLabel: typeof d.ctaLabel === 'string' ? d.ctaLabel : 'Acessar Link',
        targetUrl: typeof d.targetUrl === 'string' ? d.targetUrl : DEFAULT_DAILY_PROMO.targetUrl,
        noteColor: (typeof d.noteColor === 'string' ? d.noteColor : 'yellow') as NoteColor,
        isActive: Boolean(d.isActive),
        updatedByEmail: typeof d.updatedByEmail === 'string' ? d.updatedByEmail : undefined,
      };
      saveLocalDailyPromo(loaded);
      onUpdate(loaded);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
};

export const subscribeApprovedPromoCampaigns = (
  onUpdate: (campaigns: PromoCampaign[]) => void
): (() => void) => {
  const path = 'promoCampaigns';
  const q = query(
    collection(db, 'promoCampaigns'),
    where('status', '==', 'approved'),
    where('isActive', '==', true)
  );

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => parseCampaignDoc(d.id, d.data()));
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
};

export const subscribeAllPromoCampaignsForAdmin = (
  onUpdate: (campaigns: PromoCampaign[]) => void
): (() => void) => {
  const path = 'promoCampaigns';
  const ref = collection(db, 'promoCampaigns');

  return onSnapshot(
    ref,
    (snap) => {
      const items = snap.docs
        .map((d) => parseCampaignDoc(d.id, d.data()))
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      saveLocalPromoCampaigns(items);
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
};

export const saveDailyPromoToFirestore = async (
  promo: DailyPromo,
  user: User
): Promise<void> => {
  const email = (user.email || '').trim().toLowerCase().slice(0, 120);
  if (!email || !user.emailVerified) {
    throw new Error('Faça login com sua conta Google verificada de administrador.');
  }

  const path = `dailyPromos/${DAILY_PROMO_DOC_ID}`;
  const ref = doc(db, 'dailyPromos', DAILY_PROMO_DOC_ID);

  const payload = {
    tickerText: promo.tickerText.trim().slice(0, 240) || DEFAULT_DAILY_PROMO.tickerText,
    title: promo.title.trim().slice(0, 120) || 'Destaque do Dia',
    description: promo.description.trim().slice(0, 1200),
    sponsorName: promo.sponsorName.trim().slice(0, 80) || 'Parceiro Post+',
    ctaLabel: promo.ctaLabel.trim().slice(0, 60) || 'Acessar Link',
    targetUrl: normalizeExternalUrl(promo.targetUrl).slice(0, 500),
    noteColor: (promo.noteColor || 'yellow').slice(0, 24),
    isActive: Boolean(promo.isActive),
    updatedByEmail: email,
  };

  let existed = false;
  try {
    const snap = await getDoc(ref);
    existed = snap.exists();
    if (!existed) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, existed ? OperationType.UPDATE : OperationType.CREATE, path);
  }
};

export const savePromoCampaignToFirestore = async (
  campaign: PromoCampaign,
  user: User
): Promise<PromoCampaign> => {
  const email = (user.email || '').trim().toLowerCase().slice(0, 120);
  if (!email || !user.emailVerified) {
    throw new Error('Faça login com sua conta Google verificada de administrador.');
  }

  const campaignId = normalizeCampaignId(campaign.id);
  const path = `promoCampaigns/${campaignId}`;
  const ref = doc(db, 'promoCampaigns', campaignId);

  const ageMin = Math.max(0, Math.min(120, Math.round(Number(campaign.targetAgeMin) || 0)));
  const ageMax = Math.max(ageMin, Math.min(120, Math.round(Number(campaign.targetAgeMax) || 99)));

  const payload = {
    campaignId,
    sourcePlatform: campaign.sourcePlatform || 'manual',
    status: campaign.status || 'pending_curation',
    isActive: campaign.status === 'approved' ? Boolean(campaign.isActive) : false,
    tickerText: campaign.tickerText.trim().slice(0, 240) || 'Achado em alta no Post+!',
    title: campaign.title.trim().slice(0, 120) || 'Produto em Alta',
    description: campaign.description.trim().slice(0, 1200),
    sponsorName: campaign.sponsorName.trim().slice(0, 80) || PLATFORM_LABELS[campaign.sourcePlatform || 'manual'],
    priceLabel: (campaign.priceLabel || '').trim().slice(0, 40),
    ctaLabel: campaign.ctaLabel.trim().slice(0, 60) || 'Acessar Oferta',
    targetUrl: normalizeExternalUrl(campaign.targetUrl).slice(0, 800),
    noteColor: ((campaign.noteColor || 'yellow').slice(0, 24) as NoteColor),
    targetGender: campaign.targetGender || 'all',
    targetAgeMin: ageMin,
    targetAgeMax: ageMax,
    targetLocation: (campaign.targetLocation || 'Brasil (Todos)').trim().slice(0, 120) || 'Brasil (Todos)',
    targetInterests: Array.isArray(campaign.targetInterests)
      ? campaign.targetInterests
          .map((t) => String(t || '').trim().slice(0, 60))
          .filter(Boolean)
          .slice(0, 15)
      : [],
    curationRationale: (campaign.curationRationale || '').trim().slice(0, 600),
    sourceMethod: (campaign.sourceMethod || 'manual').trim().slice(0, 60) || 'manual',
    updatedByEmail: email,
  };

  let existed = false;
  try {
    const snap = await getDoc(ref);
    existed = snap.exists();
    if (!existed) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, existed ? OperationType.UPDATE : OperationType.CREATE, path);
  }

  return {
    ...campaign,
    ...payload,
    id: campaignId,
  };
};

export const deletePromoCampaignFromFirestore = async (
  campaignId: string
): Promise<void> => {
  const safeId = normalizeCampaignId(campaignId);
  const path = `promoCampaigns/${safeId}`;
  try {
    await deleteDoc(doc(db, 'promoCampaigns', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

const normalizeText = (s?: string): string =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

/**
 * Selects the best approved & active promo campaign matching the user's declared profile
 * (gender, age, location). If a user chose "Prefiro não declarar", only general ('all')
 * campaigns match, keeping targeting respectful and accurate.
 */
export const selectPromoForUserProfile = (
  campaigns: PromoCampaign[],
  profile?: UserDemographicProfile,
  fallbackPromo?: DailyPromo
): DailyPromo => {
  // Global master switch controlled by Admin: if OFF, hide the ticker bar completely
  if (fallbackPromo && fallbackPromo.isActive === false) {
    return fallbackPromo;
  }

  const activeApproved = campaigns.filter(
    (c) => c.status === 'approved' && c.isActive && c.tickerText.trim()
  );

  if (activeApproved.length === 0) {
    return fallbackPromo || DEFAULT_DAILY_PROMO;
  }

  const userGender = profile?.gender;
  const hasDeclaredGender =
    Boolean(userGender) && userGender !== 'Prefiro não declarar';

  const userAge =
    profile && !profile.ageNotDeclared && typeof profile.age === 'number' && profile.age > 0
      ? profile.age
      : null;

  const userLocation =
    profile && !profile.locationNotDeclared && profile.location
      ? normalizeText(profile.location)
      : '';

  const userGeneralSet = (profile?.generalInterests || [])
    .map(normalizeText)
    .filter(Boolean);
  const userRelatedSet = (profile?.relatedInterests || [])
    .map(normalizeText)
    .filter(Boolean);

  const scored: Array<{ campaign: PromoCampaign; score: number }> = [];

  for (const camp of activeApproved) {
    let score = 1;

    // 1. Gender match
    if (camp.targetGender !== 'all') {
      if (!hasDeclaredGender) continue;
      if (normalizeText(userGender) !== normalizeText(camp.targetGender)) continue;
      score += 40;
    }

    // 2. Age bracket match
    const hasAgeRestriction = camp.targetAgeMin > 0 || camp.targetAgeMax < 99;
    if (hasAgeRestriction) {
      if (userAge === null) continue;
      if (userAge < camp.targetAgeMin || userAge > camp.targetAgeMax) continue;
      score += 30;
    }

    // 3. Location match
    const locTargetNorm = normalizeText(camp.targetLocation);
    const isNational =
      !locTargetNorm ||
      locTargetNorm === 'brasil (todos)' ||
      locTargetNorm === 'brasil' ||
      locTargetNorm === 'todos';

    if (!isNational) {
      if (!userLocation) continue;
      const tokens = locTargetNorm.split(/[,/|-]+/).map((t) => t.trim()).filter(Boolean);
      const matched = tokens.some((tok) => userLocation.includes(tok));
      if (!matched) continue;
      score += 20;
    }

    // 4. Interest & Related Subtopic Affinity Score
    const campInterestTokens = (camp.targetInterests || []).map(normalizeText).filter(Boolean);
    const campTextCorpus = normalizeText(
      `${camp.title} ${camp.description} ${camp.tickerText} ${camp.curationRationale}`
    );

    if (userGeneralSet.length > 0 || userRelatedSet.length > 0) {
      for (const rel of userRelatedSet) {
        const matchedExplicit = campInterestTokens.some(
          (ci) => ci.includes(rel) || rel.includes(ci)
        );
        if (matchedExplicit) {
          score += 55;
        } else {
          const words = rel.split(/\s+/).filter((w) => w.length >= 4);
          if (words.some((w) => campTextCorpus.includes(w))) {
            score += 25;
          }
        }
      }

      for (const gen of userGeneralSet) {
        const matchedExplicit = campInterestTokens.some(
          (ci) => ci.includes(gen) || gen.includes(ci)
        );
        if (matchedExplicit) {
          score += 40;
        } else {
          const words = gen.split(/\s+/).filter((w) => w.length >= 4);
          if (words.some((w) => campTextCorpus.includes(w))) {
            score += 18;
          }
        }
      }
    }

    scored.push({ campaign: camp, score });
  }

  if (scored.length === 0) {
    return fallbackPromo || DEFAULT_DAILY_PROMO;
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.campaign.updatedAt || '').localeCompare(a.campaign.updatedAt || '');
  });

  return scored[0].campaign;
};

export const formatTargetAudienceSummary = (campaign: Pick<
  PromoCampaign,
  'targetGender' | 'targetAgeMin' | 'targetAgeMax' | 'targetLocation' | 'targetInterests'
>): string => {
  const genderLabel =
    campaign.targetGender === 'all'
      ? 'Todos os gêneros'
      : campaign.targetGender === 'Feminino'
      ? 'Mulheres (Feminino)'
      : campaign.targetGender === 'Masculino'
      ? 'Homens (Masculino)'
      : 'Não-binário';

  const ageLabel =
    campaign.targetAgeMin <= 0 && campaign.targetAgeMax >= 99
      ? 'Todas as idades'
      : `${campaign.targetAgeMin} a ${campaign.targetAgeMax} anos`;

  const locLabel = campaign.targetLocation || 'Brasil (Todos)';
  const interestsCount = campaign.targetInterests?.length || 0;
  const interestsLabel =
    interestsCount > 0 ? ` · ${interestsCount} assunto(s)` : '';

  return `${genderLabel} · ${ageLabel} · ${locLabel}${interestsLabel}`;
};

