import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { AudienceSegmentRecord, UserDemographicProfile } from '../types';
import { db, handleFirestoreError, OperationType } from './firebaseClient';

// In-memory cache of Google People API demographic info (never written to localStorage unless user saves)
const inMemoryDemographicsByEmail = new Map<string, UserDemographicProfile>();

export const GENDER_OPTIONS = [
  'Feminino',
  'Masculino',
  'Não-binário',
  'Outro',
  'Prefiro não declarar',
] as const;

export const SEXUAL_ORIENTATION_OPTIONS = [
  'Prefiro não declarar',
  'Heterossexual',
  'Homossexual',
  'Bissexual',
  'Pansexual',
  'Assexual',
  'Outro',
] as const;

interface PeopleApiBirthday {
  metadata?: { primary?: boolean };
  date?: { year?: number; month?: number; day?: number };
}

interface PeopleApiGender {
  metadata?: { primary?: boolean };
  value?: string;
  formattedValue?: string;
}

interface PeopleApiAddress {
  metadata?: { primary?: boolean };
  formattedValue?: string;
  city?: string;
  region?: string;
  country?: string;
}

interface PeopleApiLocation {
  metadata?: { primary?: boolean };
  value?: string;
  current?: boolean;
}

interface PeopleApiResponse {
  birthdays?: PeopleApiBirthday[];
  genders?: PeopleApiGender[];
  addresses?: PeopleApiAddress[];
  locations?: PeopleApiLocation[];
}

const calculateAgeFromBirthDate = (
  year: number,
  month?: number,
  day?: number
): number | null => {
  const now = new Date();
  const currentYear = now.getFullYear();
  if (year < 1900 || year > currentYear) return null;

  let age = currentYear - year;
  if (month && month >= 1 && month <= 12) {
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    if (
      currentMonth < month ||
      (currentMonth === month && day && day >= 1 && currentDay < day)
    ) {
      age -= 1;
    }
  }
  return age >= 0 && age <= 130 ? age : null;
};

const mapGoogleGender = (g?: PeopleApiGender): string | undefined => {
  if (!g) return undefined;
  const raw = (g.value || '').trim().toLowerCase();
  if (raw === 'female') return 'Feminino';
  if (raw === 'male') return 'Masculino';
  if (raw === 'unspecified' || raw === '') return undefined;

  const formatted = (g.formattedValue || '').trim().toLowerCase();
  if (formatted.includes('non-binary') || formatted.includes('não-binário') || formatted.includes('nao-binario')) {
    return 'Não-binário';
  }
  if (formatted.includes('prefer not to say') || formatted.includes('prefiro não')) {
    return 'Prefiro não declarar';
  }
  return 'Outro';
};

export const getCachedGoogleDemographics = (
  email?: string
): UserDemographicProfile | undefined => {
  if (!email) return undefined;
  return inMemoryDemographicsByEmail.get(email.toLowerCase());
};

export const clearCachedGoogleDemographics = (email?: string): void => {
  if (!email) {
    inMemoryDemographicsByEmail.clear();
    return;
  }
  inMemoryDemographicsByEmail.delete(email.toLowerCase());
};

/**
 * Queries Google People API within Google's permitted policies & user-granted scopes
 * to automatically populate age (from birthday), gender, and address/location.
 * Note: Google policies do NOT expose sexual orientation via API.
 */
export const fetchGoogleProfileDemographics = async (
  accessToken: string,
  emailForCache?: string
): Promise<UserDemographicProfile> => {
  const result: UserDemographicProfile = {
    autoFilledFromGoogle: {},
  };

  try {
    const res = await fetch(
      'https://people.googleapis.com/v1/people/me?personFields=birthdays,genders,addresses,locations,locales',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) {
      return result;
    }

    const data = (await res.json()) as PeopleApiResponse;

    // 1. Age from birthdays (when birth year is shared by the user)
    if (Array.isArray(data.birthdays)) {
      const primaryBirthday =
        data.birthdays.find((b) => b.metadata?.primary && b.date?.year) ||
        data.birthdays.find((b) => b.date?.year);

      if (primaryBirthday?.date?.year) {
        const computedAge = calculateAgeFromBirthDate(
          primaryBirthday.date.year,
          primaryBirthday.date.month,
          primaryBirthday.date.day
        );
        if (computedAge !== null) {
          result.age = computedAge;
          result.ageNotDeclared = false;
          result.autoFilledFromGoogle = {
            ...result.autoFilledFromGoogle,
            age: true,
          };
        }
      }
    }

    // 2. Gender from Google profile
    if (Array.isArray(data.genders)) {
      const primaryGender =
        data.genders.find((g) => g.metadata?.primary) || data.genders[0];
      const mapped = mapGoogleGender(primaryGender);
      if (mapped && mapped !== 'Prefiro não declarar') {
        result.gender = mapped;
        result.autoFilledFromGoogle = {
          ...result.autoFilledFromGoogle,
          gender: true,
        };
      }
    }

    // 3. Location from Google addresses or locations
    let detectedLocation = '';
    if (Array.isArray(data.addresses) && data.addresses.length > 0) {
      const primaryAddress =
        data.addresses.find((a) => a.metadata?.primary) || data.addresses[0];
      const parts = [
        primaryAddress.city,
        primaryAddress.region,
        primaryAddress.country,
      ]
        .map((p) => (p || '').trim())
        .filter(Boolean);
      detectedLocation =
        parts.length > 0
          ? parts.join(', ')
          : (primaryAddress.formattedValue || '').replace(/\n+/g, ', ').trim();
    }

    if (!detectedLocation && Array.isArray(data.locations) && data.locations.length > 0) {
      const currentLoc =
        data.locations.find((l) => l.current) ||
        data.locations.find((l) => l.metadata?.primary) ||
        data.locations[0];
      detectedLocation = (currentLoc?.value || '').trim();
    }

    if (detectedLocation) {
      result.location = detectedLocation.slice(0, 160);
      result.locationNotDeclared = false;
      result.autoFilledFromGoogle = {
        ...result.autoFilledFromGoogle,
        location: true,
      };
    }

    if (emailForCache) {
      inMemoryDemographicsByEmail.set(emailForCache.toLowerCase(), result);
    }
  } catch {
    // Non-fatal: user can fill manually or choose "Prefiro não declarar"
  }

  return result;
};

/**
 * Optional browser geolocation detection (city/state/country) when Google profile
 * has no address saved.
 */
export const detectApproximateLocation = async (): Promise<string | null> => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }

  const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 }
    );
  });

  if (!coords) return null;

  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
        coords.latitude
      )}&longitude=${encodeURIComponent(coords.longitude)}&localityLanguage=pt`
    );
    if (res.ok) {
      const data = await res.json();
      const parts = [
        data.city || data.locality,
        data.principalSubdivision,
        data.countryName,
      ]
        .map((v: unknown) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean);
      if (parts.length > 0) {
        return parts.join(', ').slice(0, 160);
      }
    }
  } catch {
    // fallback below
  }

  return `${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)}`;
};

const toSafeUid = (uid: string) => uid.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);

const sanitizeInterestList = (list: unknown, maxItems: number): string[] => {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const clean = typeof item === 'string' ? item.trim().slice(0, 80) : '';
    if (!clean) continue;
    const norm = clean.toLowerCase();
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(clean);
      if (out.length >= maxItems) break;
    }
  }
  return out;
};

export const computeAgeBracket = (age?: number | null, ageNotDeclared?: boolean): string => {
  if (ageNotDeclared || typeof age !== 'number' || Number.isNaN(age) || age <= 0) {
    return 'Não declarado';
  }
  if (age < 18) return 'Até 17 anos';
  if (age <= 24) return '18-24 anos';
  if (age <= 34) return '25-34 anos';
  if (age <= 44) return '35-44 anos';
  if (age <= 54) return '45-54 anos';
  return '55+ anos';
};

export const saveUserProfileToFirestore = async (
  user: User,
  profile: UserDemographicProfile
): Promise<void> => {
  const email = (user.email || '').trim().toLowerCase().slice(0, 120);
  if (!email || !user.emailVerified) return;

  const uid = toSafeUid(user.uid);
  const path = `userProfiles/${uid}`;
  const ref = doc(db, 'userProfiles', uid);

  const ageNotDeclared =
    Boolean(profile.ageNotDeclared) ||
    typeof profile.age !== 'number' ||
    Number.isNaN(profile.age) ||
    profile.age <= 0;

  const cleanLocation = (profile.location || '').trim().slice(0, 160);
  const locationNotDeclared = Boolean(profile.locationNotDeclared) || !cleanLocation;
  const generalInterests = sanitizeInterestList(profile.generalInterests, 15);
  const relatedInterests = sanitizeInterestList(profile.relatedInterests, 20);
  const cleanGender =
    (profile.gender || 'Prefiro não declarar').trim().slice(0, 60) || 'Prefiro não declarar';

  const payload = {
    uid,
    email,
    age: ageNotDeclared ? 0 : Math.min(130, Math.max(1, Math.round(profile.age!))),
    ageNotDeclared,
    location: locationNotDeclared ? '' : cleanLocation,
    locationNotDeclared,
    gender: cleanGender,
    sexualOrientation:
      (profile.sexualOrientation || 'Prefiro não declarar').trim().slice(0, 60) ||
      'Prefiro não declarar',
    generalInterests,
    relatedInterests,
    autoFilledFromGoogle: Boolean(
      profile.autoFilledFromGoogle?.age ||
        profile.autoFilledFromGoogle?.location ||
        profile.autoFilledFromGoogle?.gender
    ),
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
        age: payload.age,
        ageNotDeclared: payload.ageNotDeclared,
        location: payload.location,
        locationNotDeclared: payload.locationNotDeclared,
        gender: payload.gender,
        sexualOrientation: payload.sexualOrientation,
        generalInterests: payload.generalInterests,
        relatedInterests: payload.relatedInterests,
        autoFilledFromGoogle: payload.autoFilledFromGoogle,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, existed ? OperationType.UPDATE : OperationType.CREATE, path);
  }

  // Sync non-PII segment doc for Admin audience intersection grouping
  const segPath = `audienceSegments/${uid}`;
  const segRef = doc(db, 'audienceSegments', uid);
  const regionLabel = locationNotDeclared
    ? 'Não declarada'
    : cleanLocation.split(',').slice(-2).join(', ').trim().slice(0, 80) || 'Brasil';
  const segPayload = {
    uid,
    ageBracket: computeAgeBracket(payload.age, ageNotDeclared),
    gender: cleanGender,
    regionLabel,
    generalInterests,
    relatedInterests,
  };

  let segExisted = false;
  try {
    const segSnap = await getDoc(segRef);
    segExisted = segSnap.exists();
    if (!segExisted) {
      await setDoc(segRef, {
        ...segPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(segRef, {
        ageBracket: segPayload.ageBracket,
        gender: segPayload.gender,
        regionLabel: segPayload.regionLabel,
        generalInterests: segPayload.generalInterests,
        relatedInterests: segPayload.relatedInterests,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, segExisted ? OperationType.UPDATE : OperationType.CREATE, segPath);
  }
};

export const loadUserProfileFromFirestore = async (
  user: User
): Promise<UserDemographicProfile | null> => {
  if (!user.emailVerified) return null;
  const uid = toSafeUid(user.uid);
  const path = `userProfiles/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'userProfiles', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      age: d.ageNotDeclared ? null : typeof d.age === 'number' && d.age > 0 ? d.age : null,
      ageNotDeclared: Boolean(d.ageNotDeclared),
      location: d.locationNotDeclared ? '' : typeof d.location === 'string' ? d.location : '',
      locationNotDeclared: Boolean(d.locationNotDeclared),
      gender: typeof d.gender === 'string' ? d.gender : 'Prefiro não declarar',
      sexualOrientation:
        typeof d.sexualOrientation === 'string'
          ? d.sexualOrientation
          : 'Prefiro não declarar',
      generalInterests: Array.isArray(d.generalInterests)
        ? d.generalInterests.filter((v: unknown) => typeof v === 'string')
        : [],
      relatedInterests: Array.isArray(d.relatedInterests)
        ? d.relatedInterests.filter((v: unknown) => typeof v === 'string')
        : [],
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
};

export const subscribeAudienceSegmentsForAdmin = (
  onUpdate: (segments: AudienceSegmentRecord[]) => void
): (() => void) => {
  const path = 'audienceSegments';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: AudienceSegmentRecord[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          uid: typeof d.uid === 'string' ? d.uid : docSnap.id,
          ageBracket: typeof d.ageBracket === 'string' ? d.ageBracket : 'Não declarado',
          gender: typeof d.gender === 'string' ? d.gender : 'Prefiro não declarar',
          regionLabel: typeof d.regionLabel === 'string' ? d.regionLabel : 'Não declarada',
          generalInterests: Array.isArray(d.generalInterests)
            ? d.generalInterests.filter((v: unknown) => typeof v === 'string')
            : [],
          relatedInterests: Array.isArray(d.relatedInterests)
            ? d.relatedInterests.filter((v: unknown) => typeof v === 'string')
            : [],
          updatedAt: d.updatedAt?.toDate?.()?.toISOString?.() || undefined,
        });
      });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
};
