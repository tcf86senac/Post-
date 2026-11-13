import { CategoryTab, Note, UserPreferences } from '../types';

export const CURRENT_APP_VERSION = '2.9.0';
export const CURRENT_SCHEMA_VERSION = 4;

const APP_VERSION_KEY = 'postplus_app_version';
const SCHEMA_VERSION_KEY = 'postplus_schema_version';
const LAST_UPGRADE_META_KEY = 'postplus_last_upgrade_meta';

const IDB_NAME = 'postplus_safety_db';
const IDB_STORE = 'snapshots';

export interface UpgradeReport {
  upgraded: boolean;
  fromVersion: string | null;
  toVersion: string;
  fromSchema: number;
  toSchema: number;
  notesPreserved: number;
  tabsPreserved: number;
  snapshotSavedAt: string | null;
}

export interface UpgradeSnapshotMeta {
  fromVersion: string | null;
  toVersion: string;
  fromSchema: number;
  toSchema: number;
  notesPreserved: number;
  tabsPreserved: number;
  upgradedAt: string;
}

interface SafetySnapshotRecord {
  id: string;
  capturedAt: string;
  fromVersion: string | null;
  fromSchema: number;
  entries: Record<string, string>;
}

const openSafetyDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível neste navegador.'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Erro ao abrir IndexedDB'));
  });
};

const saveSnapshotToIndexedDb = async (record: SafetySnapshotRecord): Promise<void> => {
  try {
    const db = await openSafetyDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Non-fatal in private browsing or restricted environments
  }
};

export const restoreLatestSafetySnapshot = async (): Promise<{
  restored: boolean;
  capturedAt?: string;
  keysCount?: number;
}> => {
  try {
    const db = await openSafetyDb();
    const record = await new Promise<SafetySnapshotRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get('latest_pre_update');
      req.onsuccess = () => resolve(req.result as SafetySnapshotRecord | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();

    if (!record || !record.entries) {
      return { restored: false };
    }

    const keys = Object.keys(record.entries);
    keys.forEach((key) => {
      if (key.startsWith('postplus_')) {
        localStorage.setItem(key, record.entries[key]);
      }
    });

    return {
      restored: true,
      capturedAt: record.capturedAt,
      keysCount: keys.length,
    };
  } catch {
    return { restored: false };
  }
};

const normalizeNote = (raw: Partial<Note>): Note => {
  return {
    id: raw.id || `nota-${Date.now()}`,
    category: raw.category || 'principal',
    title: raw.title || 'Lembrete',
    previewText: raw.previewText || '',
    fullContent: raw.fullContent ?? raw.previewText ?? '',
    color: raw.color || 'yellow',
    createdAt: raw.createdAt || 'Anterior',
    updatedAt: raw.updatedAt,
    isPinned: Boolean(raw.isPinned),
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    driveFolderUrl: raw.driveFolderUrl,
    driveFolderId: raw.driveFolderId,
    driveFolderName: raw.driveFolderName,
    rotation: typeof raw.rotation === 'number' ? raw.rotation : 0,
    pinColor: raw.pinColor || 'red',
    penColor: raw.penColor || 'blue',
    fontStyle: raw.fontStyle || 'handwriting',
    calendarEvent: raw.calendarEvent,
    isSponsored: raw.isSponsored,
    sponsorName: raw.sponsorName,
    sponsorUrl: raw.sponsorUrl,
    firestoreTabId: raw.firestoreTabId,
    authorUid: raw.authorUid,
    authorEmail: raw.authorEmail,
    authorName: raw.authorName,
    commentsCount: typeof raw.commentsCount === 'number' ? raw.commentsCount : raw.comments?.length || 0,
    comments: Array.isArray(raw.comments) ? raw.comments : undefined,
  };
};

const normalizeTab = (raw: Partial<CategoryTab>): CategoryTab => {
  return {
    id: raw.id || `tab-${Date.now()}`,
    label: raw.label || 'ABA',
    isShared: Boolean(raw.isShared),
    sharedWith: Array.isArray(raw.sharedWith) ? raw.sharedWith : undefined,
    shareCode: raw.shareCode,
    linkedGoogleEmail: raw.linkedGoogleEmail,
    firestoreId: raw.firestoreId,
    ownerUid: raw.ownerUid,
    ownerEmail: raw.ownerEmail,
    ownerName: raw.ownerName,
    memberEmails: Array.isArray(raw.memberEmails) ? raw.memberEmails : undefined,
    editorEmails: Array.isArray(raw.editorEmails) ? raw.editorEmails : undefined,
  };
};

const collectAllPostPlusStorageEntries = (): Record<string, string> => {
  const entries: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('postplus_')) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        entries[key] = val;
      }
    }
  }
  return entries;
};

/**
 * Executed synchronously on boot before state hydration.
 * Detects any previous installed version or schema, snapshots the previous DB into IndexedDB,
 * preserves every note/tab/preference across versions, and applies schema upgrades idempotently.
 */
export const runSafeAppUpgradeIfNeeded = (): UpgradeReport => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return {
      upgraded: false,
      fromVersion: null,
      toVersion: CURRENT_APP_VERSION,
      fromSchema: CURRENT_SCHEMA_VERSION,
      toSchema: CURRENT_SCHEMA_VERSION,
      notesPreserved: 0,
      tabsPreserved: 0,
      snapshotSavedAt: null,
    };
  }

  try {
    const prevVersion = localStorage.getItem(APP_VERSION_KEY);
    const prevSchemaRaw = localStorage.getItem(SCHEMA_VERSION_KEY);
    const allKeys = Object.keys(localStorage).filter((k) => k.startsWith('postplus_'));

    const hasPreviousDb = allKeys.some(
      (k) =>
        k === 'postplus_notes_v1' ||
        k === 'postplus_notes_v2' ||
        k === 'postplus_notes_v3' ||
        k.startsWith('postplus_notes_uid_') ||
        k === 'postplus_tabs_v1' ||
        k.startsWith('postplus_tabs_uid_')
    );

    let inferredPrevSchema = 0;
    if (prevSchemaRaw) {
      inferredPrevSchema = parseInt(prevSchemaRaw, 10) || 0;
    } else if (
      localStorage.getItem('postplus_notes_v3') ||
      allKeys.some((k) => k.startsWith('postplus_notes_uid_'))
    ) {
      inferredPrevSchema = 3;
    } else if (localStorage.getItem('postplus_notes_v2')) {
      inferredPrevSchema = 2;
    } else if (localStorage.getItem('postplus_notes_v1')) {
      inferredPrevSchema = 1;
    }

    const needsUpgrade =
      (Boolean(prevVersion) && prevVersion !== CURRENT_APP_VERSION) ||
      (hasPreviousDb && inferredPrevSchema < CURRENT_SCHEMA_VERSION) ||
      (hasPreviousDb && !prevVersion);

    if (!needsUpgrade) {
      localStorage.setItem(APP_VERSION_KEY, CURRENT_APP_VERSION);
      localStorage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));
      return {
        upgraded: false,
        fromVersion: prevVersion,
        toVersion: CURRENT_APP_VERSION,
        fromSchema: CURRENT_SCHEMA_VERSION,
        toSchema: CURRENT_SCHEMA_VERSION,
        notesPreserved: 0,
        tabsPreserved: 0,
        snapshotSavedAt: null,
      };
    }

    const nowIso = new Date().toISOString();

    // 1. Create non-blocking safety snapshot in IndexedDB BEFORE touching anything
    const snapshotEntries = collectAllPostPlusStorageEntries();
    void saveSnapshotToIndexedDb({
      id: 'latest_pre_update',
      capturedAt: nowIso,
      fromVersion: prevVersion,
      fromSchema: inferredPrevSchema,
      entries: snapshotEntries,
    });
    void saveSnapshotToIndexedDb({
      id: `backup_v_${prevVersion || `schema_${inferredPrevSchema}`}`,
      capturedAt: nowIso,
      fromVersion: prevVersion,
      fromSchema: inferredPrevSchema,
      entries: snapshotEntries,
    });

    // 2. Migrate legacy v1 / v2 notes -> v3 if v3 isn't already populated
    if (!localStorage.getItem('postplus_notes_v3')) {
      const legacyRaw =
        localStorage.getItem('postplus_notes_v2') ||
        localStorage.getItem('postplus_notes_v1');
      if (legacyRaw) {
        try {
          const parsedLegacy = JSON.parse(legacyRaw);
          if (Array.isArray(parsedLegacy)) {
            const migrated = parsedLegacy.map((item) => normalizeNote(item));
            localStorage.setItem('postplus_notes_v3', JSON.stringify(migrated));
          }
        } catch {
          // ignore malformed legacy key
        }
      }
    }

    // 3. Normalize & preserve ALL notes collections (guest + per-UID databases)
    let notesPreserved = 0;
    const noteKeys = Object.keys(localStorage).filter(
      (k) => k === 'postplus_notes_v3' || k.startsWith('postplus_notes_uid_')
    );
    noteKeys.forEach((key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((n) => normalizeNote(n));
          notesPreserved += normalized.length;
          localStorage.setItem(key, JSON.stringify(normalized));
        }
      } catch {
        // leave raw intact if unparseable
      }
    });

    // 4. Normalize & preserve ALL tabs collections (guest + per-UID databases)
    let tabsPreserved = 0;
    const tabKeys = Object.keys(localStorage).filter(
      (k) => k === 'postplus_tabs_v1' || k.startsWith('postplus_tabs_uid_')
    );
    tabKeys.forEach((key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((t) => normalizeTab(t));
          tabsPreserved += normalized.length;
          localStorage.setItem(key, JSON.stringify(normalized));
        }
      } catch {
        // leave raw intact
      }
    });

    // 5. Upgrade user preferences schema without overwriting existing choices
    const rawPrefs = localStorage.getItem('postplus_user_preferences');
    if (rawPrefs) {
      try {
        const parsed = JSON.parse(rawPrefs) as Partial<UserPreferences>;
        const upgradedPrefs: UserPreferences = {
          defaultNoteColor: parsed.defaultNoteColor || 'yellow',
          defaultPinColor: parsed.defaultPinColor || 'red',
          defaultPenColor: parsed.defaultPenColor || 'blue',
          defaultFontStyle: parsed.defaultFontStyle || 'handwriting',
          colorPalette: parsed.colorPalette || 'vibrant',
          colorSelectionMode: parsed.colorSelectionMode || 'random',
          onboardingCompleted: parsed.onboardingCompleted,
          registeredEmail: parsed.registeredEmail,
          profile: parsed.profile,
        };
        localStorage.setItem('postplus_user_preferences', JSON.stringify(upgradedPrefs));
      } catch {
        // ignore
      }
    }

    // 6. Stamp new version and save upgrade audit record
    const fromLabel = prevVersion || (inferredPrevSchema > 0 ? `Schema v${inferredPrevSchema}` : 'Versão Anterior');
    const meta: UpgradeSnapshotMeta = {
      fromVersion: fromLabel,
      toVersion: CURRENT_APP_VERSION,
      fromSchema: inferredPrevSchema,
      toSchema: CURRENT_SCHEMA_VERSION,
      notesPreserved,
      tabsPreserved,
      upgradedAt: nowIso,
    };

    localStorage.setItem(APP_VERSION_KEY, CURRENT_APP_VERSION);
    localStorage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));
    localStorage.setItem(LAST_UPGRADE_META_KEY, JSON.stringify(meta));

    return {
      upgraded: true,
      fromVersion: fromLabel,
      toVersion: CURRENT_APP_VERSION,
      fromSchema: inferredPrevSchema,
      toSchema: CURRENT_SCHEMA_VERSION,
      notesPreserved,
      tabsPreserved,
      snapshotSavedAt: nowIso,
    };
  } catch {
    return {
      upgraded: false,
      fromVersion: null,
      toVersion: CURRENT_APP_VERSION,
      fromSchema: CURRENT_SCHEMA_VERSION,
      toSchema: CURRENT_SCHEMA_VERSION,
      notesPreserved: 0,
      tabsPreserved: 0,
      snapshotSavedAt: null,
    };
  }
};

export const getSafetyBackupStatus = (): UpgradeSnapshotMeta | null => {
  try {
    const raw = localStorage.getItem(LAST_UPGRADE_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UpgradeSnapshotMeta;
  } catch {
    return null;
  }
};

export const exportAllAppDataAsJson = (): string => {
  const data = collectAllPostPlusStorageEntries();
  return JSON.stringify(
    {
      app: 'Post+',
      version: CURRENT_APP_VERSION,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      entries: data,
    },
    null,
    2
  );
};
