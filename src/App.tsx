import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User } from 'firebase/auth';
import {
  Note,
  NoteColor,
  CategoryTab,
  NoteAttachment,
  SharedMember,
  UserPreferences,
  GoogleAccount,
  TabInviteRecord,
  DailyPromo,
  PromoCampaign,
  AudienceSegmentRecord,
} from './types';
import { INITIAL_NOTES, INITIAL_TABS } from './data/initialNotes';
import { getRandomNoteColor } from './data/noteColors';
import {
  initGoogleDriveAuth,
  connectGoogleAccount,
  clearAccessTokenForEmail,
  signOutAllGoogleAccounts,
} from './services/googleDriveService';
import {
  fetchGoogleProfileDemographics,
  loadUserProfileFromFirestore,
  saveUserProfileToFirestore,
  subscribeAudienceSegmentsForAdmin,
} from './services/googlePeopleService';
import {
  auth,
  subscribeFirebaseAuthUser,
} from './services/firebaseClient';
import {
  ensureSharedTabInFirestore,
  updateSharedTabStatus,
  sendTabInvite,
  revokeSharedTabMember,
  acceptTabInvite,
  declineTabInvite,
  subscribePendingInvitesForEmail,
  subscribeSentInvitesForUser,
  subscribeUserSharedTabs,
  subscribeSharedTabNotes,
  upsertSharedNote,
  deleteSharedNote,
} from './services/sharedTabsService';
import {
  deletePromoCampaignFromFirestore,
  isPromoAdmin,
  loadLocalDailyPromo,
  loadLocalPromoCampaigns,
  saveDailyPromoToFirestore,
  saveLocalDailyPromo,
  saveLocalPromoCampaigns,
  savePromoCampaignToFirestore,
  selectPromoForUserProfile,
  subscribeActiveDailyPromo,
  subscribeAllPromoCampaignsForAdmin,
  subscribeApprovedPromoCampaigns,
} from './services/dailyPromoService';
import { AppHeader } from './components/AppHeader';
import { TabBar } from './components/TabBar';
import { NoteCard } from './components/NoteCard';
import { FloatingActionButton } from './components/FloatingActionButton';
import { BottomPromoTicker } from './components/BottomPromoTicker';
import { PromoNoteModal } from './components/PromoNoteModal';
import { DrawerMenu } from './components/DrawerMenu';
import { SettingsModal } from './components/SettingsModal';
import { NoteModal } from './components/NoteModal';
import { AttachmentModal } from './components/AttachmentModal';
import { ShareTabModal } from './components/ShareTabModal';
import { PendingInvitesModal } from './components/PendingInvitesModal';
import { NewTabModal } from './components/NewTabModal';
import { MonetizationModal } from './components/MonetizationModal';
import { PostPlusLensModal } from './components/PostPlusLensModal';
import { GoogleAccountsModal } from './components/GoogleAccountsModal';
import { PreferencesOnboardingModal } from './components/PreferencesOnboardingModal';
import { DrivePortalModal } from './components/DrivePortalModal';
import { OfflineIndicator } from './components/PWAInstallButton';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  ShieldCheck,
  Pin,
  Trash2,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';
import { installGlobalClickHaptics, triggerHapticFeedback } from './utils/haptics';
import { runSafeAppUpgradeIfNeeded, UpgradeReport } from './services/appMigrationService';

// Execute version & database safety guard synchronously before hydrating any React state
const BOOT_UPGRADE_REPORT: UpgradeReport = runSafeAppUpgradeIfNeeded();

const getNotesStorageKey = (uid?: string) =>
  uid ? `postplus_notes_uid_${uid}` : 'postplus_notes_v3';

const getTrashStorageKey = (uid?: string) =>
  uid ? `postplus_trash_uid_${uid}` : 'postplus_trash_v1';

const getTabsStorageKey = (uid?: string) =>
  uid ? `postplus_tabs_uid_${uid}` : 'postplus_tabs_v1';

const loadLocalTrashForUid = (uid?: string): Note[] => {
  try {
    const saved = localStorage.getItem(getTrashStorageKey(uid));
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const loadLocalNotesForUid = (uid?: string): Note[] => {
  try {
    const key = getNotesStorageKey(uid);
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
    if (!uid) {
      const oldV2 = localStorage.getItem('postplus_notes_v2');
      if (oldV2) {
        const parsed = JSON.parse(oldV2);
        return parsed.map((n: Note) => ({
          ...n,
          penColor: n.penColor || 'blue',
          fontStyle: n.fontStyle || 'handwriting',
        }));
      }
      return INITIAL_NOTES;
    }

    // For authenticated users: migrate existing guest board ONLY for the first account on this device
    const claimedUid = localStorage.getItem('postplus_first_uid_claimed');
    if (!claimedUid || claimedUid === uid) {
      localStorage.setItem('postplus_first_uid_claimed', uid);
      const guestSaved = localStorage.getItem('postplus_notes_v3');
      return guestSaved ? JSON.parse(guestSaved) : INITIAL_NOTES;
    }

    // Subsequent signed-in accounts on the same device get a clean personal board (shared tabs come via invite acceptance)
    return INITIAL_NOTES.filter((n) => n.category !== 'familia');
  } catch {
    return INITIAL_NOTES;
  }
};

const loadLocalTabsForUid = (uid?: string): CategoryTab[] => {
  try {
    const key = getTabsStorageKey(uid);
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
    if (!uid) {
      return INITIAL_TABS;
    }

    const claimedUid = localStorage.getItem('postplus_first_uid_claimed');
    if (!claimedUid || claimedUid === uid) {
      localStorage.setItem('postplus_first_uid_claimed', uid);
      const guestSaved = localStorage.getItem('postplus_tabs_v1');
      return guestSaved ? JSON.parse(guestSaved) : INITIAL_TABS;
    }

    // Clean personal default tabs for additional accounts on the same device
    return INITIAL_TABS.filter((t) => t.id !== 'familia');
  } catch {
    return INITIAL_TABS;
  }
};

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [notes, setNotes] = useState<Note[]>(() => loadLocalNotesForUid());
  const [localTabs, setLocalTabs] = useState<CategoryTab[]>(() => loadLocalTabsForUid());
  const [remoteSharedTabs, setRemoteSharedTabs] = useState<CategoryTab[]>([]);
  const [remoteNotesByTab, setRemoteNotesByTab] = useState<Record<string, Note[]>>({});
  const [pendingInvites, setPendingInvites] = useState<TabInviteRecord[]>([]);
  const [sentInvites, setSentInvites] = useState<TabInviteRecord[]>([]);

  const [activeTabId, setActiveTabId] = useState<string>('principal');
  const [swipeAnim, setSwipeAnim] = useState<'left' | 'right' | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [openNoteWithComments, setOpenNoteWithComments] = useState(false);
  const [attachmentNote, setAttachmentNote] = useState<Note | null>(null);
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [sharingTabId, setSharingTabId] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isPendingInvitesOpen, setIsPendingInvitesOpen] = useState(false);
  const [isNewTabModalOpen, setIsNewTabModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [columnsCount, setColumnsCount] = useState<number>(3);
  const [muralTexture, setMuralTexture] = useState<'neutral' | 'cork'>('neutral');
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);
  const [adsRemoved, setAdsRemoved] = useState(false);
  const [isMonetizationOpen, setIsMonetizationOpen] = useState(false);
  const [dailyPromo, setDailyPromo] = useState<DailyPromo>(() => loadLocalDailyPromo());
  const [promoCampaigns, setPromoCampaigns] = useState<PromoCampaign[]>(() =>
    loadLocalPromoCampaigns()
  );
  const [audienceSegments, setAudienceSegments] = useState<AudienceSegmentRecord[]>([]);
  const [isPromoNoteOpen, setIsPromoNoteOpen] = useState(false);
  const [previewPromoDraft, setPreviewPromoDraft] = useState<DailyPromo | null>(null);
  const [trashedNotes, setTrashedNotes] = useState<Note[]>(() => loadLocalTrashForUid());
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isDrivePortalOpen, setIsDrivePortalOpen] = useState(false);
  const [isLensOpen, setIsLensOpen] = useState(false);
  const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingEmail, setOnboardingEmail] = useState<string | undefined>(undefined);
  const [lastCreatedColor, setLastCreatedColor] = useState<NoteColor | undefined>(undefined);
  const [inviteToast, setInviteToast] = useState<string | null>(null);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState<boolean>(
    BOOT_UPGRADE_REPORT.upgraded
  );

  // Subscribe to global Daily Ticker Promo + Curated Profile Campaigns + Admin Audience Segments from Firestore
  useEffect(() => {
    const unsubPromo = subscribeActiveDailyPromo((remotePromo) => {
      setDailyPromo(remotePromo);
    });
    const adminMode = isPromoAdmin(authUser);
    const unsubCampaigns = adminMode
      ? subscribeAllPromoCampaignsForAdmin((items) => {
          setPromoCampaigns(items);
        })
      : subscribeApprovedPromoCampaigns((items) => {
          setPromoCampaigns(items);
        });
    const unsubAudience = adminMode
      ? subscribeAudienceSegmentsForAdmin((segments) => {
          setAudienceSegments(segments);
        })
      : (() => {
          setAudienceSegments([]);
          return () => {};
        })();

    return () => {
      unsubPromo();
      unsubCampaigns();
      unsubAudience();
    };
  }, [authUser?.uid, authUser?.email, authUser?.emailVerified]);

  // Install global tactile click vibration + service worker safe-update toast
  useEffect(() => {
    const uninstallHaptics = installGlobalClickHaptics();
    const handleSwUpdate = () => {
      setInviteToast(
        'Nova versão do Post+ detectada! Seus dados locais foram preservados com segurança.'
      );
      window.setTimeout(() => setInviteToast(null), 5000);
    };
    window.addEventListener('postplus:sw-updating', handleSwUpdate);
    return () => {
      uninstallHaptics();
      window.removeEventListener('postplus:sw-updating', handleSwUpdate);
    };
  }, []);

  // Multiple connected Google accounts (non-secret profile metadata only; tokens live strictly in memory)
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccount[]>(() => {
    try {
      const saved = localStorage.getItem('postplus_google_accounts_v1');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return [];
  });

  // Per-email saved user preferences map
  const [emailPrefsMap, setEmailPrefsMap] = useState<Record<string, UserPreferences>>(() => {
    try {
      const saved = localStorage.getItem('postplus_email_prefs_v1');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return {};
  });

  // General Note Preferences for instant, dynamic creation
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(() => {
    try {
      const saved = localStorage.getItem('postplus_user_preferences');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
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
      }
    } catch {
      // fallback
    }
    return {
      defaultNoteColor: 'yellow',
      defaultPinColor: 'red',
      defaultPenColor: 'blue',
      defaultFontStyle: 'handwriting',
      colorPalette: 'vibrant',
      colorSelectionMode: 'random',
    };
  });

  // Persist preferences
  useEffect(() => {
    try {
      localStorage.setItem('postplus_user_preferences', JSON.stringify(userPreferences));
    } catch {
      // Ignore
    }
  }, [userPreferences]);

  useEffect(() => {
    try {
      localStorage.setItem('postplus_email_prefs_v1', JSON.stringify(emailPrefsMap));
    } catch {
      // Ignore
    }
  }, [emailPrefsMap]);

  useEffect(() => {
    try {
      localStorage.setItem('postplus_google_accounts_v1', JSON.stringify(googleAccounts));
    } catch {
      // Ignore
    }
  }, [googleAccounts]);

  // Persist current user's local notes, trash & local tabs
  useEffect(() => {
    try {
      localStorage.setItem(getNotesStorageKey(authUser?.uid), JSON.stringify(notes));
    } catch (err: any) {
      if (err?.name === 'QuotaExceededError') {
        setInviteToast(
          'Memória local quase cheia: salve fotos pesadas na pasta do Google Drive da nota!'
        );
        window.setTimeout(() => setInviteToast(null), 5000);
      }
    }
  }, [notes, authUser?.uid]);

  useEffect(() => {
    try {
      localStorage.setItem(getTrashStorageKey(authUser?.uid), JSON.stringify(trashedNotes));
    } catch {
      // Ignore
    }
  }, [trashedNotes, authUser?.uid]);

  useEffect(() => {
    try {
      localStorage.setItem(getTabsStorageKey(authUser?.uid), JSON.stringify(localTabs));
    } catch {
      // Ignore
    }
  }, [localTabs, authUser?.uid]);

  // Subscribe to Firebase Authentication state (Login / Logout / Switch User)
  useEffect(() => {
    const unsubDrive = initGoogleDriveAuth();
    const unsubAuth = subscribeFirebaseAuthUser((user) => {
      setAuthUser(user);
      if (user) {
        setNotes(loadLocalNotesForUid(user.uid));
        setTrashedNotes(loadLocalTrashForUid(user.uid));
        setLocalTabs(loadLocalTabsForUid(user.uid));
        if (user.email) {
          const normalized = user.email.toLowerCase();
          try {
            const rawPrefs = localStorage.getItem('postplus_email_prefs_v1');
            const parsedMap = rawPrefs ? JSON.parse(rawPrefs) : emailPrefsMap;
            if (parsedMap?.[normalized]) {
              setUserPreferences(parsedMap[normalized]);
            }
          } catch {
            // ignore
          }
          void loadUserProfileFromFirestore(user).then((remoteProfile) => {
            if (!remoteProfile) return;
            setUserPreferences((prev) => {
              if (!prev.profile?.updatedAt) {
                return { ...prev, profile: remoteProfile };
              }
              const mergedProfile = {
                ...prev.profile,
                generalInterests:
                  prev.profile.generalInterests && prev.profile.generalInterests.length > 0
                    ? prev.profile.generalInterests
                    : remoteProfile.generalInterests,
                relatedInterests:
                  prev.profile.relatedInterests && prev.profile.relatedInterests.length > 0
                    ? prev.profile.relatedInterests
                    : remoteProfile.relatedInterests,
              };
              return { ...prev, profile: mergedProfile };
            });
          });
        }
      } else {
        setRemoteSharedTabs([]);
        setRemoteNotesByTab({});
        setPendingInvites([]);
        setSentInvites([]);
        setNotes(loadLocalNotesForUid());
        setTrashedNotes(loadLocalTrashForUid());
        setLocalTabs(loadLocalTabsForUid());
      }
      setActiveTabId('principal');
    });

    return () => {
      unsubDrive();
      unsubAuth();
    };
  }, []);

  // Subscribe to Firestore Shared Tabs + Pending/Sent Invites when signed in
  useEffect(() => {
    if (!authUser || !authUser.email) {
      setRemoteSharedTabs([]);
      setPendingInvites([]);
      setSentInvites([]);
      return;
    }

    const unsubSharedTabs = subscribeUserSharedTabs(authUser, (shared) => {
      setRemoteSharedTabs(shared);
    });
    const unsubPending = subscribePendingInvitesForEmail(authUser.email, (invites) => {
      setPendingInvites(invites);
    });
    const unsubSent = subscribeSentInvitesForUser(authUser.uid, (invites) => {
      setSentInvites(invites);
    });

    return () => {
      unsubSharedTabs();
      unsubPending();
      unsubSent();
    };
  }, [authUser?.uid, authUser?.email]);

  // Subscribe to Notes subcollections for every remote SharedTab the user belongs to
  useEffect(() => {
    if (!authUser || remoteSharedTabs.length === 0) {
      setRemoteNotesByTab({});
      return;
    }

    const unsubscribers: Array<() => void> = [];
    remoteSharedTabs.forEach((rt) => {
      if (!rt.firestoreId) return;
      const docId = rt.firestoreId;
      const unsub = subscribeSharedTabNotes(docId, (tabNotesList) => {
        setRemoteNotesByTab((prev) => ({
          ...prev,
          [docId]: tabNotesList,
        }));
      });
      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach((u) => u());
    };
  }, [authUser?.uid, remoteSharedTabs]);

  // Merge local tabs + Firestore shared tabs cleanly without duplicates
  const tabs: CategoryTab[] = useMemo(() => {
    const ownedOrLocal = localTabs
      .filter((t) => !t.ownerUid || t.ownerUid === authUser?.uid)
      .map((lt) => {
        const matchedRemote = lt.firestoreId
          ? remoteSharedTabs.find((rt) => rt.firestoreId === lt.firestoreId)
          : undefined;
        if (!matchedRemote) return lt;
        return {
          ...lt,
          label: matchedRemote.label,
          isShared: matchedRemote.isShared,
          shareCode: matchedRemote.shareCode,
          sharedWith: matchedRemote.sharedWith,
          ownerUid: matchedRemote.ownerUid,
          ownerEmail: matchedRemote.ownerEmail,
          ownerName: matchedRemote.ownerName,
          memberEmails: matchedRemote.memberEmails,
          editorEmails: matchedRemote.editorEmails,
        };
      });

    const extraRemoteTabs = remoteSharedTabs.filter(
      (rt) => !ownedOrLocal.some((lt) => lt.firestoreId === rt.firestoreId)
    );

    return [...ownedOrLocal, ...extraRemoteTabs];
  }, [localTabs, remoteSharedTabs, authUser?.uid]);

  // Ensure activeTabId stays valid when tabs change (e.g. after logout)
  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTabId)) {
      setActiveTabId(tabs[0]?.id || 'principal');
    }
  }, [tabs, activeTabId]);

  // Merge local personal notes + Firestore collaborative notes
  const allNotes: Note[] = useMemo(() => {
    const syncedLocalTabIds = new Set(
      tabs
        .filter((t) => t.firestoreId && remoteNotesByTab[t.firestoreId] !== undefined)
        .map((t) => t.id.toLowerCase())
    );

    const localOnly = notes.filter(
      (n) => !syncedLocalTabIds.has(n.category.toLowerCase())
    );

    const remoteFlattened: Note[] = [];
    tabs.forEach((t) => {
      if (!t.firestoreId) return;
      const docNotes = remoteNotesByTab[t.firestoreId];
      if (!docNotes) return;
      docNotes.forEach((rn) => {
        remoteFlattened.push({
          ...rn,
          category: t.id,
          firestoreTabId: t.firestoreId,
        });
      });
    });

    return [...remoteFlattened, ...localOnly];
  }, [notes, tabs, remoteNotesByTab]);

  // Check URL params for PWA shortcuts (?action=quick|new|lens, ?tab=...) & Web Share Target (?title=&text=&url=)
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const action = urlParams.get('action');
      const tabParam = urlParams.get('tab');
      const sharedTitle = urlParams.get('title')?.trim() || '';
      const sharedText = urlParams.get('text')?.trim() || '';
      const sharedUrl = urlParams.get('url')?.trim() || '';

      if (tabParam) {
        const found = tabs.find((t) => t.id.toLowerCase() === tabParam.toLowerCase());
        if (found) {
          setActiveTabId(found.id);
        }
      }

      if (action === 'share' || sharedTitle || sharedText || sharedUrl) {
        const parts = [sharedText, sharedUrl].filter(Boolean);
        const combinedContent = parts.join('\n\n');
        const assignedColor =
          userPreferences.colorSelectionMode === 'fixed'
            ? userPreferences.defaultNoteColor
            : getRandomNoteColor(lastCreatedColor, userPreferences.colorPalette);

        const draftSharedNote: Note = {
          id: `nota-share-${Date.now()}`,
          title: sharedTitle || 'Conteúdo Compartilhado',
          previewText: combinedContent.slice(0, 110),
          fullContent: combinedContent,
          color: assignedColor,
          pinColor: userPreferences.defaultPinColor,
          penColor: userPreferences.defaultPenColor,
          fontStyle: userPreferences.defaultFontStyle,
          category: tabParam || activeTabId,
          createdAt:
            'Hoje, ' +
            new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          updatedAt: 'Agora',
          attachments: [],
          rotation: Number(((Math.random() * 3.4) - 1.7).toFixed(1)),
        };

        setSelectedNote(draftSharedNote);
        setOpenNoteWithComments(false);
        setIsNoteModalOpen(true);
      } else if (action === 'new' || action === 'quick') {
        setSelectedNote(null);
        setOpenNoteWithComments(false);
        setIsNoteModalOpen(true);
      } else if (action === 'lens') {
        setIsLensOpen(true);
      }

      if (action || tabParam || sharedTitle || sharedText || sharedUrl) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  // Current tab & permissions
  const currentTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const currentUserEmailLower = authUser?.email?.toLowerCase() || '';
  const isCurrentTabViewerOnly = Boolean(
    currentTab?.isShared &&
      authUser &&
      currentTab.ownerUid &&
      currentTab.ownerUid !== authUser.uid &&
      currentTab.editorEmails &&
      !currentTab.editorEmails.includes(currentUserEmailLower)
  );

  const sharingTab = tabs.find((t) => t.id === sharingTabId) || null;

  // Notes filtered by active tab
  const tabNotes = allNotes.filter(
    (n) => n.category.toLowerCase() === activeTabId.toLowerCase()
  );

  // Search + Pinned filter
  const displayedNotes = tabNotes.filter((n) => {
    if (showPinnedOnly && !n.isPinned) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.previewText.toLowerCase().includes(q) ||
      (n.fullContent && n.fullContent.toLowerCase().includes(q)) ||
      (n.attachments && n.attachments.some((a) => a.name.toLowerCase().includes(q)))
    );
  });

  const getTabCount = (tabId: string) => {
    return allNotes.filter((n) => n.category.toLowerCase() === tabId.toLowerCase()).length;
  };

  const swipeTimerRef = useRef<number | null>(null);

  // Carousel tab switching helpers
  const triggerTabSwitch = (nextTabId: string, direction: 'left' | 'right') => {
    if (nextTabId === activeTabId) return;
    triggerHapticFeedback('medium');
    if (swipeTimerRef.current) {
      window.clearTimeout(swipeTimerRef.current);
      swipeTimerRef.current = null;
    }
    setSwipeAnim(direction);
    setActiveTabId(nextTabId);
    swipeTimerRef.current = window.setTimeout(() => {
      setSwipeAnim(null);
      swipeTimerRef.current = null;
    }, 680);
  };

  const handleStepTab = (delta: 1 | -1) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const safeIdx = idx < 0 ? 0 : idx;
    const nextIdx = (safeIdx + delta + tabs.length) % tabs.length;
    triggerTabSwitch(tabs[nextIdx].id, delta > 0 ? 'left' : 'right');
  };

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const mainScrollRef = useRef<HTMLElement>(null);

  const handleMainTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, [data-no-swipe="true"]')) {
      touchStartRef.current = null;
      return;
    }
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  };

  const handleMainTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    if (!touchStartRef.current || tabs.length <= 1) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.35 && dt < 750) {
      if (dx < 0) {
        handleStepTab(1);
      } else {
        handleStepTab(-1);
      }
    }
  };

  const handleMainPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch') return; // Handled by onTouchStart/End
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, button, a')) {
      pointerStartRef.current = null;
      return;
    }
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };
  };

  const handleMainPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch' || !pointerStartRef.current || tabs.length <= 1) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    const dt = Date.now() - pointerStartRef.current.time;
    pointerStartRef.current = null;

    if (Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 650) {
      if (dx < 0) {
        handleStepTab(1);
      } else {
        handleStepTab(-1);
      }
    }
  };

  const handleScrollUp = () => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollBy({
        top: -340,
        behavior: 'smooth',
      });
    }
  };

  const handleScrollDown = () => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollBy({
        top: 340,
        behavior: 'smooth',
      });
    }
  };

  const handleSignInAppUser = async () => {
    try {
      const { account, accessToken } = await connectGoogleAccount();
      await fetchGoogleProfileDemographics(accessToken, account.email);
      handleAddOrUpdateAccount(account);
    } catch {
      // User closed popup or cancelled sign-in
    }
  };

  const handleLogoutAppUser = async () => {
    await signOutAllGoogleAccounts();
    setInviteToast('Você saiu da conta. Entre com outro e-mail quando quiser testar!');
    window.setTimeout(() => setInviteToast(null), 4000);
  };

  const handleOpenNewNote = () => {
    setSelectedNote(null);
    setOpenNoteWithComments(false);
    setIsNoteModalOpen(true);
  };

  const handleNoteClick = (note: Note) => {
    setSelectedNote(note);
    setOpenNoteWithComments(false);
    setIsNoteModalOpen(true);
  };

  const handleOpenNoteComments = (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNote(note);
    setOpenNoteWithComments(true);
    setIsNoteModalOpen(true);
  };

  const handleOpenAttachments = (note: Note, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAttachmentNote(note);
    setIsAttachmentModalOpen(true);
  };

  const handleOpenShareTab = (tab: CategoryTab) => {
    setSharingTabId(tab.id);
    setIsShareModalOpen(true);
  };

  const handleSaveNote = async (savedNote: Note) => {
    const targetTab = tabs.find(
      (t) => t.id.toLowerCase() === savedNote.category.toLowerCase()
    );

    if (targetTab?.firestoreId && authUser) {
      await upsertSharedNote(targetTab.firestoreId, targetTab.id, savedNote, authUser);
      setLastCreatedColor(savedNote.color);
      return;
    }

    setNotes((prev) => {
      const exists = prev.some((n) => n.id === savedNote.id);
      if (exists) {
        return prev.map((n) => (n.id === savedNote.id ? savedNote : n));
      }
      setLastCreatedColor(savedNote.color);
      return [savedNote, ...prev];
    });
  };

  const handleDeleteNote = async (id: string) => {
    const targetNote = allNotes.find((n) => n.id === id);
    const targetTab = targetNote
      ? tabs.find((t) => t.id.toLowerCase() === targetNote.category.toLowerCase())
      : currentTab;

    if (targetTab?.firestoreId && authUser) {
      await deleteSharedNote(targetTab.firestoreId, id);
      return;
    }

    if (targetNote) {
      const nowLabel = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setTrashedNotes((prev) => [
        { ...targetNote, updatedAt: 'Excluída agora', trashedAt: `Hoje, ${nowLabel}` },
        ...prev.filter((t) => t.id !== targetNote.id),
      ]);
      setInviteToast('Nota movida para a Lixeira (você pode restaurar pelo menu).');
      window.setTimeout(() => setInviteToast(null), 3500);
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleRestoreTrashedNote = (noteId: string) => {
    const target = trashedNotes.find((n) => n.id === noteId);
    if (!target) return;
    setTrashedNotes((prev) => prev.filter((n) => n.id !== noteId));
    setNotes((prev) => [{ ...target, updatedAt: 'Restaurada' }, ...prev]);
    setInviteToast(`Nota "${target.title}" restaurada no mural!`);
    window.setTimeout(() => setInviteToast(null), 3000);
  };

  const handleDeleteForeverFromTrash = (noteId: string) => {
    setTrashedNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  const handleEmptyTrash = () => {
    setTrashedNotes([]);
  };

  const handleShareApp = async () => {
    const shareUrl = window.location.origin;
    const shareData = {
      title: 'Post+ — Notas, Lembretes & Google Drive',
      text: 'Estou usando o Post+ para organizar notas adesivas, compromissos na Agenda e pastas no Google Drive!',
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setInviteToast('Link do Post+ copiado para compartilhar!');
      window.setTimeout(() => setInviteToast(null), 3500);
    } catch {
      setInviteToast(`Compartilhe este endereço: ${shareUrl}`);
      window.setTimeout(() => setInviteToast(null), 5000);
    }
  };

  const handlePinToggle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetNote = allNotes.find((n) => n.id === id);
    if (!targetNote) return;

    const targetTab = tabs.find(
      (t) => t.id.toLowerCase() === targetNote.category.toLowerCase()
    );

    if (targetTab?.firestoreId && authUser) {
      await upsertSharedNote(
        targetTab.firestoreId,
        targetTab.id,
        { ...targetNote, isPinned: !targetNote.isPinned },
        authUser
      );
      return;
    }

    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n))
    );
  };

  const handleUpdateAttachments = (
    noteId: string,
    attachments: NoteAttachment[],
    driveFolderUrl?: string,
    driveFolderId?: string,
    driveFolderName?: string
  ) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? {
              ...n,
              attachments,
              driveFolderUrl: driveFolderUrl !== undefined ? driveFolderUrl : n.driveFolderUrl,
              driveFolderId: driveFolderId !== undefined ? driveFolderId : n.driveFolderId,
              driveFolderName: driveFolderName !== undefined ? driveFolderName : n.driveFolderName,
              updatedAt: 'Agora',
            }
          : n
      )
    );
    setAttachmentNote((prev) =>
      prev && prev.id === noteId
        ? {
            ...prev,
            attachments,
            driveFolderUrl: driveFolderUrl !== undefined ? driveFolderUrl : prev.driveFolderUrl,
            driveFolderId: driveFolderId !== undefined ? driveFolderId : prev.driveFolderId,
            driveFolderName: driveFolderName !== undefined ? driveFolderName : prev.driveFolderName,
            updatedAt: 'Agora',
          }
        : prev
    );
    setSelectedNote((prev) =>
      prev && prev.id === noteId
        ? {
            ...prev,
            attachments,
            driveFolderUrl: driveFolderUrl !== undefined ? driveFolderUrl : prev.driveFolderUrl,
            driveFolderId: driveFolderId !== undefined ? driveFolderId : prev.driveFolderId,
            driveFolderName: driveFolderName !== undefined ? driveFolderName : prev.driveFolderName,
            updatedAt: 'Agora',
          }
        : prev
    );
  };

  const handleAddOrUpdateAccount = (account: GoogleAccount) => {
    const normalized = account.email.toLowerCase();
    const isBrandNewAccount = !googleAccounts.some(
      (a) => a.email.toLowerCase() === normalized
    );

    setGoogleAccounts((prev) => {
      const idx = prev.findIndex((a) => a.email.toLowerCase() === normalized);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...account };
        return next;
      }
      return [...prev, account];
    });

    if (emailPrefsMap[normalized]) {
      setUserPreferences(emailPrefsMap[normalized]);
    } else if (isBrandNewAccount && !isAttachmentModalOpen) {
      setOnboardingEmail(account.email);
      setIsOnboardingOpen(true);
    }
  };

  const handleSaveOnboardingPreferences = (
    nextPrefs: UserPreferences,
    email?: string
  ) => {
    setUserPreferences(nextPrefs);
    if (email) {
      const normalized = email.toLowerCase();
      setEmailPrefsMap((prev) => ({
        ...prev,
        [normalized]: nextPrefs,
      }));
    }
    const currentUser = auth.currentUser || authUser;
    if (currentUser && nextPrefs.profile) {
      void saveUserProfileToFirestore(currentUser, nextPrefs.profile);
    }
  };

  const handleRemoveAccount = (email: string) => {
    const normalized = email.toLowerCase();
    clearAccessTokenForEmail(normalized);
    setGoogleAccounts((prev) =>
      prev.filter((a) => a.email.toLowerCase() !== normalized)
    );
    setLocalTabs((prev) =>
      prev.map((t) =>
        t.linkedGoogleEmail?.toLowerCase() === normalized
          ? { ...t, linkedGoogleEmail: undefined }
          : t
      )
    );
  };

  const handleBindTabToAccount = (tabId: string, googleEmail?: string) => {
    setLocalTabs((prev) =>
      prev.map((t) =>
        t.id === tabId ? { ...t, linkedGoogleEmail: googleEmail } : t
      )
    );
  };

  const handleUpdateTabSharing = async (
    tabId: string,
    isShared: boolean,
    members: SharedMember[],
    shareCode: string
  ) => {
    const targetTab = tabs.find((t) => t.id === tabId);
    if (authUser && targetTab) {
      if (targetTab.firestoreId) {
        await updateSharedTabStatus(targetTab.firestoreId, isShared, targetTab.label);
      } else if (isShared) {
        const localTabNotes = notes.filter(
          (n) => n.category.toLowerCase() === tabId.toLowerCase()
        );
        const { tabDocId, shareCode: finalCode } = await ensureSharedTabInFirestore(
          { ...targetTab, shareCode },
          authUser,
          localTabNotes
        );
        setLocalTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  isShared: true,
                  firestoreId: tabDocId,
                  ownerUid: authUser.uid,
                  ownerEmail: authUser.email?.toLowerCase() || undefined,
                  shareCode: finalCode,
                }
              : t
          )
        );
        return;
      }
    }

    setLocalTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? {
              ...t,
              isShared,
              sharedWith: members,
              shareCode,
            }
          : t
      )
    );
  };

  const handleInviteEmailToTab = async (
    tab: CategoryTab,
    inviteeEmail: string,
    inviteeName: string,
    role: 'editor' | 'viewer'
  ) => {
    if (!authUser) {
      throw new Error('Entre com sua conta Google antes de enviar convites.');
    }

    const localTabNotes = notes.filter(
      (n) => n.category.toLowerCase() === tab.id.toLowerCase()
    );
    const { tabDocId, shareCode } = await ensureSharedTabInFirestore(
      tab,
      authUser,
      localTabNotes
    );

    if (!tab.firestoreId) {
      setLocalTabs((prev) =>
        prev.map((t) =>
          t.id === tab.id
            ? {
                ...t,
                isShared: true,
                firestoreId: tabDocId,
                ownerUid: authUser.uid,
                ownerEmail: authUser.email?.toLowerCase() || undefined,
                shareCode,
              }
            : t
        )
      );
    }

    await sendTabInvite({
      tabDocId,
      tabId: tab.id,
      tabLabel: tab.label,
      shareCode,
      inviteeEmail,
      inviteeName,
      role,
      inviterUser: authUser,
    });
  };

  const handleRevokeParticipant = async (tab: CategoryTab, email: string) => {
    if (tab.firestoreId && authUser) {
      await revokeSharedTabMember(tab.firestoreId, email);
    } else {
      setLocalTabs((prev) =>
        prev.map((t) =>
          t.id === tab.id
            ? {
                ...t,
                sharedWith: (t.sharedWith || []).filter(
                  (m) => m.email.toLowerCase() !== email.toLowerCase()
                ),
              }
            : t
        )
      );
    }
  };

  const handleAcceptInvite = async (invite: TabInviteRecord) => {
    if (!authUser) return;
    await acceptTabInvite(invite, authUser);
    setInviteToast(`Aba "${invite.tabLabel}" adicionada ao seu mural!`);
    window.setTimeout(() => setInviteToast(null), 4000);
    setActiveTabId(invite.tabDocId);
    setIsPendingInvitesOpen(false);
  };

  const handleDeclineInvite = async (invite: TabInviteRecord) => {
    if (!authUser) return;
    await declineTabInvite(invite, authUser);
    setInviteToast(`Convite para "${invite.tabLabel}" recusado.`);
    window.setTimeout(() => setInviteToast(null), 3000);
  };

  const handleAddTab = (newTab: CategoryTab) => {
    setLocalTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleLensSuccess = (
    partialNote: Partial<Note>,
    photoAttachment: NoteAttachment
  ) => {
    const targetCategory =
      partialNote.category &&
      tabs.some((t) => t.id.toLowerCase() === partialNote.category?.toLowerCase())
        ? partialNote.category.toLowerCase()
        : activeTabId;

    const assignedColor =
      partialNote.color ||
      (userPreferences.colorSelectionMode === 'fixed'
        ? userPreferences.defaultNoteColor
        : getRandomNoteColor(lastCreatedColor, userPreferences.colorPalette));
    const newNoteFromLens: Note = {
      id: `note-lens-${Date.now()}`,
      title: partialNote.title || 'Anotação Post+ Lens',
      previewText: partialNote.previewText || '',
      fullContent: partialNote.fullContent || '',
      color: assignedColor,
      pinColor: userPreferences.defaultPinColor,
      penColor: partialNote.penColor || userPreferences.defaultPenColor,
      fontStyle: partialNote.fontStyle || userPreferences.defaultFontStyle,
      category: targetCategory,
      createdAt: 'Hoje',
      updatedAt: 'Agora',
      attachments: [photoAttachment],
      calendarEvent: partialNote.calendarEvent,
      rotation: (Math.random() - 0.5) * 4,
    };

    setLastCreatedColor(assignedColor);
    setSelectedNote(newNoteFromLens);
    setOpenNoteWithComments(false);
    setIsNoteModalOpen(true);
  };

  const handleResetDemo = () => {
    setNotes(INITIAL_NOTES);
    setLocalTabs(INITIAL_TABS);
    setActiveTabId('principal');
    setAdsRemoved(false);
    setCloudSyncEnabled(true);
    setMuralTexture('neutral');
    localStorage.removeItem('postplus_notes_v2');
    localStorage.removeItem(getNotesStorageKey(authUser?.uid));
    localStorage.removeItem(getTabsStorageKey(authUser?.uid));
  };

  const gridClass =
    {
      1: 'grid-cols-1 max-w-md mx-auto',
      2: 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
      3: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4',
    }[columnsCount as 1 | 2 | 3] ||
    'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4';

  const currentTabIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeTabId)
  );

  // Pick approved & active campaign matching user's declared profile (gender, age, location)
  const effectiveDailyPromo = useMemo(
    () =>
      selectPromoForUserProfile(
        promoCampaigns,
        userPreferences.profile,
        dailyPromo
      ),
    [promoCampaigns, userPreferences.profile, dailyPromo]
  );

  return (
    <div
      className={`w-full min-h-screen h-[100dvh] flex flex-col overflow-hidden font-sans antialiased select-none ${
        muralTexture === 'cork' ? 'mural-cork' : 'mural-neutral'
      }`}
    >
      {/* 1. TOP UI (Header): Dark blue header bar across the very top */}
      <AppHeader
        onOpenMenu={() => setIsDrawerOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isSearching={isSearching}
        onToggleSearch={() => {
          setIsSearching(!isSearching);
          if (isSearching) setSearchQuery('');
        }}
        onOpenLens={() => setIsLensOpen(true)}
      />

      {/* 2. TAB BAR (Secondary Header): Grayish fixed sandwich menu bar directly beneath blue header */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={(nextId) => {
          const nextIdx = tabs.findIndex((t) => t.id === nextId);
          const dir = nextIdx >= currentTabIndex ? 'left' : 'right';
          triggerTabSwitch(nextId, dir);
        }}
        getTabCount={getTabCount}
        onOpenShareModal={handleOpenShareTab}
        onAddNewTab={() => setIsNewTabModalOpen(true)}
        colorPalette={userPreferences.colorPalette}
      />

      {/* 2.5 PENDING SEMI-AUTOMATIC INVITES NOTIFICATION BANNER */}
      {pendingInvites.length > 0 && (
        <div className="bg-amber-100 border-b border-amber-300 text-amber-950 px-3 py-2 text-xs flex items-center justify-between gap-2 z-20 shrink-0 shadow-2xs text-left animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
            <Bell className="w-4 h-4 text-amber-700 shrink-0 animate-bounce" />
            <div className="min-w-0 flex-1 text-left">
              <p className="font-extrabold text-[11px] leading-tight truncate text-left">
                Convite recebido: Aba "{pendingInvites[0].tabLabel}"
              </p>
              <p className="text-[10px] text-amber-900 truncate text-left">
                De {pendingInvites[0].inviterName} ({pendingInvites[0].inviterEmail})
                {pendingInvites.length > 1 ? ` · +${pendingInvites.length - 1} outro(s)` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => void handleAcceptInvite(pendingInvites[0])}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#049A35] hover:bg-emerald-700 text-white text-[10.5px] font-bold cursor-pointer transition-colors"
              title="Aceitar convite"
            >
              <Check className="w-3 h-3 stroke-[2.5]" />
              <span>Aceitar</span>
            </button>
            <button
              type="button"
              onClick={() => void handleDeclineInvite(pendingInvites[0])}
              className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-white/80 hover:bg-rose-100 text-slate-800 hover:text-rose-700 border border-amber-300 text-[10.5px] font-semibold cursor-pointer transition-colors"
              title="Recusar convite"
            >
              <X className="w-3 h-3" />
            </button>
            {pendingInvites.length > 1 && (
              <button
                type="button"
                onClick={() => setIsPendingInvitesOpen(true)}
                className="px-2 py-1 rounded bg-amber-600 text-white text-[10.5px] font-bold cursor-pointer"
              >
                Ver ({pendingInvites.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Optional version upgrade preservation confirmation banner */}
      {showUpgradeBanner && (
        <div className="bg-emerald-700 text-white px-3.5 py-2 text-[11px] font-semibold flex items-center justify-between gap-2 z-20 shrink-0 text-left animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
            <ShieldCheck className="w-4 h-4 text-[#FEE725] shrink-0" />
            <span className="truncate text-left">
              Post+ atualizado ({BOOT_UPGRADE_REPORT.fromVersion || 'anterior'} → v
              {BOOT_UPGRADE_REPORT.toVersion})! Banco mantido ({BOOT_UPGRADE_REPORT.notesPreserved}{' '}
              notas).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowUpgradeBanner(false)}
            className="text-white/80 hover:text-white cursor-pointer shrink-0"
            title="Fechar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Optional lightweight feedback toast */}
      {inviteToast && (
        <div className="bg-[#0D3B66] text-white px-4 py-1.5 text-[11px] font-semibold flex items-center justify-between z-20 shrink-0 text-left">
          <span className="text-left">{inviteToast}</span>
          <button
            type="button"
            onClick={() => setInviteToast(null)}
            className="text-white/75 hover:text-white cursor-pointer ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4. MAIN CONTENT AREA: Swipe Carousel Mural */}
      <main
        ref={mainScrollRef}
        onTouchStart={handleMainTouchStart}
        onTouchEnd={handleMainTouchEnd}
        onPointerDown={handleMainPointerDown}
        onPointerUp={handleMainPointerUp}
        style={{ touchAction: 'pan-y' }}
        className="relative flex-1 w-full overflow-y-auto custom-scrollbar p-3 sm:p-5 md:p-6"
      >
        <div className="w-full max-w-6xl mx-auto pb-28 sm:pb-32">
          {/* Subtle Carousel Bar at Top of Mural */}
          {tabs.length > 1 && (
            <div className="flex items-center justify-between gap-2 mb-2 px-1 text-[10.5px] text-slate-500">
              <button
                type="button"
                onClick={() => handleStepTab(-1)}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/70 hover:bg-white border border-slate-300/70 text-slate-700 font-semibold cursor-pointer shadow-2xs"
                title="Aba anterior (ou deslize para a direita)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              <div className="flex items-center gap-1.5">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      const nextIdx = tabs.findIndex((item) => item.id === t.id);
                      triggerTabSwitch(t.id, nextIdx >= currentTabIndex ? 'left' : 'right');
                    }}
                    title={t.label}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      t.id === activeTabId
                        ? 'w-5 bg-[#1D86C4]'
                        : 'w-1.5 bg-slate-400/60 hover:bg-slate-500'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleStepTab(1)}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/70 hover:bg-white border border-slate-300/70 text-slate-700 font-semibold cursor-pointer shadow-2xs"
                title="Próxima aba (ou deslize para a esquerda)"
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {showPinnedOnly && (
            <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-amber-100/90 border border-amber-300 text-amber-950 text-[11px] font-bold flex items-center justify-between gap-2 shadow-2xs">
              <span className="inline-flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5 text-amber-700 fill-amber-600" />
                <span>Exibindo apenas Notas Fixadas nesta aba</span>
              </span>
              <button
                type="button"
                onClick={() => setShowPinnedOnly(false)}
                className="px-2 py-0.5 rounded bg-white/85 hover:bg-white text-amber-900 text-[10.5px] font-extrabold border border-amber-300 cursor-pointer"
              >
                Mostrar todas
              </button>
            </div>
          )}

          {/* Grid of Sticky Notes with realistic 3D pushpins & gentle pendulum sway on tab migration */}
          <div key={activeTabId}>
            {displayedNotes.length > 0 ? (
              <div className={`grid ${gridClass} gap-4 sm:gap-5 pt-2 items-start`}>
                {displayedNotes.map((note, idx) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    colorPalette={userPreferences.colorPalette}
                    isSharedTab={Boolean(currentTab?.isShared)}
                    swayDirection={swipeAnim}
                    swayIndex={idx}
                    onClick={handleNoteClick}
                    onOpenAttachments={(n, e) => handleOpenAttachments(n, e)}
                    onOpenComments={handleOpenNoteComments}
                    onPinToggle={isCurrentTabViewerOnly ? undefined : handlePinToggle}
                  />
                ))}
              </div>
            ) : (
              <div className="py-24 text-center text-slate-500">
                <p className="text-base font-bold text-slate-700">
                  {showPinnedOnly ? 'Nenhuma nota fixada nesta aba!' : 'Mural limpo e pronto!'}
                </p>
                <p className="text-xs mt-1 text-slate-400">
                  {showPinnedOnly
                    ? 'Desative o filtro acima para visualizar todas as notas da aba.'
                    : isCurrentTabViewerOnly
                    ? 'Aguarde os editores fixarem notas nesta aba compartilhada.'
                    : 'Toque no botão amarelo com a cruz verde no canto inferior direito para fixar uma nova nota!'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 5. UNIFIED BOTTOM DOCK: Aligned left promo ticker + right floating action controls (zero overlap) */}
        <div className="fixed bottom-4 sm:bottom-5 left-3 right-3 sm:left-5 sm:right-6 z-30 flex items-end justify-between gap-2.5 sm:gap-4 pointer-events-none">
          <div className="flex-1 min-w-0 flex items-center min-h-[48px] sm:min-h-[52px]">
            <BottomPromoTicker
              promo={effectiveDailyPromo}
              hidden={adsRemoved}
              onOpenPromo={() => {
                setPreviewPromoDraft(null);
                setIsPromoNoteOpen(true);
              }}
            />
          </div>

          <FloatingActionButton
            inlineDock
            onClick={handleOpenNewNote}
            onOpenLens={() => setIsLensOpen(true)}
            onScrollUp={handleScrollUp}
            onScrollDown={handleScrollDown}
          />
        </div>

        <OfflineIndicator />
      </main>

      {/* MODALS & DRAWERS */}

      {/* Slide-out Navigation Drawer */}
      <DrawerMenu
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOpenSettings={() => {
          setIsDrawerOpen(false);
          setIsSettingsOpen(true);
        }}
        onAddNewTab={() => {
          setIsDrawerOpen(false);
          setIsNewTabModalOpen(true);
        }}
        onOpenMonetization={() => {
          setIsDrawerOpen(false);
          setIsMonetizationOpen(true);
        }}
        onOpenLens={() => {
          setIsDrawerOpen(false);
          setIsLensOpen(true);
        }}
        onOpenAccountsModal={() => {
          setIsDrawerOpen(false);
          setIsAccountsModalOpen(true);
        }}
        onOpenOnboardingModal={() => {
          setIsDrawerOpen(false);
          setOnboardingEmail(
            authUser?.email || userPreferences.registeredEmail || googleAccounts[0]?.email
          );
          setIsOnboardingOpen(true);
        }}
        googleAccountsCount={googleAccounts.length}
        registeredEmail={
          authUser?.email || userPreferences.registeredEmail || googleAccounts[0]?.email
        }
        authUser={authUser}
        onSignInGoogle={handleSignInAppUser}
        onLogout={handleLogoutAppUser}
        pendingInvitesCount={pendingInvites.length}
        onOpenPendingInvites={() => setIsPendingInvitesOpen(true)}
        showPinnedOnly={showPinnedOnly}
        onTogglePinnedOnly={() => setShowPinnedOnly((prev) => !prev)}
        trashedCount={trashedNotes.length}
        onOpenTrash={() => setIsTrashModalOpen(true)}
        onShareApp={() => void handleShareApp()}
        onOpenHelp={() => setIsHelpModalOpen(true)}
        onOpenDrivePortal={() => setIsDrivePortalOpen(true)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onResetDemoNotes={handleResetDemo}
        cloudSyncEnabled={cloudSyncEnabled}
        onToggleCloudSync={setCloudSyncEnabled}
        adsRemoved={adsRemoved}
        onToggleAds={setAdsRemoved}
        columnsCount={columnsCount}
        onChangeColumnsCount={setColumnsCount}
        muralTexture={muralTexture}
        onChangeMuralTexture={setMuralTexture}
        onOpenMonetization={() => {
          setIsSettingsOpen(false);
          setIsMonetizationOpen(true);
        }}
        onOpenAccountsModal={() => {
          setIsSettingsOpen(false);
          setIsAccountsModalOpen(true);
        }}
        onOpenOnboardingModal={() => {
          setIsSettingsOpen(false);
          setOnboardingEmail(
            authUser?.email || userPreferences.registeredEmail || googleAccounts[0]?.email
          );
          setIsOnboardingOpen(true);
        }}
        googleAccountsCount={googleAccounts.length}
        userPreferences={userPreferences}
        onUpdatePreferences={(partial) =>
          setUserPreferences((prev) => {
            const updated = { ...prev, ...partial };
            if (updated.registeredEmail) {
              setEmailPrefsMap((m) => ({
                ...m,
                [updated.registeredEmail!.toLowerCase()]: updated,
              }));
            }
            return updated;
          })
        }
      />

      {/* Note View / Edit / Create Modal (with Shared Tab Comments) */}
      <NoteModal
        isOpen={isNoteModalOpen}
        onClose={() => {
          setIsNoteModalOpen(false);
          setOpenNoteWithComments(false);
        }}
        note={selectedNote}
        onSave={handleSaveNote}
        onDelete={handleDeleteNote}
        defaultCategory={isCurrentTabViewerOnly ? 'principal' : activeTabId}
        tabs={tabs}
        userPreferences={userPreferences}
        lastCreatedColor={lastCreatedColor}
        initialFocusComments={openNoteWithComments}
        authUser={authUser}
        onSignInGoogle={handleSignInAppUser}
        onOpenAttachments={(noteToAttach) => {
          setIsNoteModalOpen(false);
          handleOpenAttachments(noteToAttach);
        }}
        onOpenLens={() => {
          setIsNoteModalOpen(false);
          setIsLensOpen(true);
        }}
      />

      {/* Attachments & Google Drive Modal */}
      <AttachmentModal
        isOpen={isAttachmentModalOpen}
        onClose={() => setIsAttachmentModalOpen(false)}
        note={attachmentNote}
        tab={
          tabs.find(
            (t) =>
              t.id.toLowerCase() ===
              (attachmentNote?.category || activeTabId).toLowerCase()
          ) || currentTab
        }
        googleAccounts={googleAccounts}
        onAddOrUpdateAccount={handleAddOrUpdateAccount}
        onOpenAccountsModal={() => {
          setIsAttachmentModalOpen(false);
          setIsAccountsModalOpen(true);
        }}
        onUpdateAttachments={handleUpdateAttachments}
      />

      {/* Share Tab Modal (Semi-Automatic Invites & Participant Management) */}
      <ShareTabModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        tab={sharingTab}
        authUser={authUser}
        sentInvites={sentInvites}
        onSignInGoogle={handleSignInAppUser}
        onUpdateTabSharing={handleUpdateTabSharing}
        onInviteEmail={handleInviteEmailToTab}
        onRevokeParticipant={handleRevokeParticipant}
      />

      {/* Pending Semi-Automatic Invites Dialog */}
      <PendingInvitesModal
        isOpen={isPendingInvitesOpen}
        onClose={() => setIsPendingInvitesOpen(false)}
        invites={pendingInvites}
        onAcceptInvite={handleAcceptInvite}
        onDeclineInvite={handleDeclineInvite}
      />

      {/* New Tab Modal */}
      <NewTabModal
        isOpen={isNewTabModalOpen}
        onClose={() => setIsNewTabModalOpen(false)}
        onAddTab={handleAddTab}
        googleAccounts={googleAccounts}
        onOpenAccountsModal={() => setIsAccountsModalOpen(true)}
      />

      {/* Multiple Google Accounts & Tab Drive Binding Modal */}
      <GoogleAccountsModal
        isOpen={isAccountsModalOpen}
        onClose={() => setIsAccountsModalOpen(false)}
        accounts={googleAccounts}
        onAddOrUpdateAccount={handleAddOrUpdateAccount}
        onRemoveAccount={handleRemoveAccount}
        tabs={tabs}
        onBindTabToAccount={handleBindTabToAccount}
        onOpenDrivePortal={() => setIsDrivePortalOpen(true)}
      />

      {/* Daily Promo Ticker & Multi-Source Curation Admin Manager */}
      <MonetizationModal
        isOpen={isMonetizationOpen}
        onClose={() => setIsMonetizationOpen(false)}
        promo={dailyPromo}
        campaigns={promoCampaigns}
        audienceSegments={audienceSegments}
        currentUserProfile={userPreferences.profile}
        authUser={authUser}
        colorPalette={userPreferences.colorPalette}
        onSignInGoogle={handleSignInAppUser}
        onPreviewPromo={(draft) => {
          setPreviewPromoDraft(draft);
          setIsPromoNoteOpen(true);
        }}
        onSavePromo={async (nextPromo, publishToCloud) => {
          saveLocalDailyPromo(nextPromo);
          setDailyPromo(nextPromo);
          if (publishToCloud && (auth.currentUser || authUser)) {
            await saveDailyPromoToFirestore(
              nextPromo,
              (auth.currentUser || authUser)!
            );
          }
        }}
        onSaveCampaign={async (campaign, publishToCloud) => {
          setPromoCampaigns((prev) => {
            const exists = prev.some((c) => c.id === campaign.id);
            const next = exists
              ? prev.map((c) => (c.id === campaign.id ? campaign : c))
              : [campaign, ...prev];
            saveLocalPromoCampaigns(next);
            return next;
          });
          if (publishToCloud && (auth.currentUser || authUser)) {
            await savePromoCampaignToFirestore(
              campaign,
              (auth.currentUser || authUser)!
            );
          }
        }}
        onDeleteCampaign={async (campaignId, publishToCloud) => {
          setPromoCampaigns((prev) => {
            const next = prev.filter((c) => c.id !== campaignId);
            saveLocalPromoCampaigns(next);
            return next;
          });
          if (publishToCloud && (auth.currentUser || authUser)) {
            await deletePromoCampaignFromFirestore(campaignId);
          }
        }}
      />

      {/* 2nd-Click Note Modal for the Daily Promo Ticker */}
      <PromoNoteModal
        isOpen={isPromoNoteOpen}
        onClose={() => {
          setIsPromoNoteOpen(false);
          setPreviewPromoDraft(null);
        }}
        promo={previewPromoDraft || effectiveDailyPromo}
        colorPalette={userPreferences.colorPalette}
        fontStyle={userPreferences.defaultFontStyle}
        penColor={userPreferences.defaultPenColor}
        isAdmin={isPromoAdmin(authUser)}
        onOpenAdminEditor={() => setIsMonetizationOpen(true)}
      />

      {/* Post+ Lens (Gemini Vision AI) Camera Modal */}
      <PostPlusLensModal
        isOpen={isLensOpen}
        onClose={() => setIsLensOpen(false)}
        onSuccess={handleLensSuccess}
      />

      {/* Graphical Google Drive Portal Modal (Post+/Aba/aa-mm-dd) */}
      <DrivePortalModal
        isOpen={isDrivePortalOpen}
        onClose={() => setIsDrivePortalOpen(false)}
        googleAccounts={googleAccounts}
        initialEmail={currentTab?.linkedGoogleEmail || googleAccounts[0]?.email}
        onAccountConnected={(account) => handleAddOrUpdateAccount(account)}
      />

      {/* Email Registration & Style Personalization Modal */}
      <PreferencesOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        preferences={userPreferences}
        initialEmail={onboardingEmail}
        googleAccounts={googleAccounts}
        onAddOrUpdateAccount={handleAddOrUpdateAccount}
        onSavePreferences={handleSaveOnboardingPreferences}
      />

      {/* Trash / Deleted Notes Restore Modal */}
      {isTrashModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-[#1D86C4] text-white">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-[#FEE725]" />
                <h3 className="text-xs font-bold">Lixeira de Notas ({trashedNotes.length})</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTrashModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/15 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-2.5 custom-scrollbar text-left">
              {trashedNotes.length === 0 ? (
                <div className="py-10 text-center space-y-1">
                  <Trash2 className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">Sua lixeira está vazia</p>
                  <p className="text-[11px] text-slate-400">
                    Notas locais excluídas ficam guardadas aqui para você restaurar quando quiser.
                  </p>
                </div>
              ) : (
                trashedNotes.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                          {item.previewText || item.fullContent || 'Sem conteúdo adicional'}
                        </p>
                      </div>
                      <span className="text-[9.5px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 shrink-0">
                        {item.category}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/70">
                      <button
                        type="button"
                        onClick={() => handleDeleteForeverFromTrash(item.id)}
                        className="px-2 py-1 text-[10.5px] font-semibold text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                      >
                        Apagar definitivo
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRestoreTrashedNote(item.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[10.5px] font-bold text-white bg-[#049A35] hover:bg-emerald-700 rounded cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restaurar</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              {trashedNotes.length > 0 ? (
                <button
                  type="button"
                  onClick={handleEmptyTrash}
                  className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Esvaziar lixeira
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setIsTrashModalOpen(false)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#1D86C4] hover:bg-[#166FA3] rounded-lg cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Mobile Test Guide & Help Modal */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-[#1D86C4] text-white">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#FEE725]" />
                <h3 className="text-xs font-bold">Guia Rápido do Post+</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHelpModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/15 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3 text-left text-xs text-slate-700 custom-scrollbar">
              <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200">
                <p className="font-bold text-[#0D3B66]">1. Notas, Voz e Post+ Lens</p>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  Toque no cartão amarelo (+) para criar anotações com voz (IA), links clicáveis e lembretes na Google Agenda, ou use a câmera azul (Lens) para ler manuscritos e objetos.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <p className="font-bold text-amber-950">2. Portal Google Drive (Post+/aa-mm-dd)</p>
                <p className="text-[11px] text-amber-900 mt-0.5 leading-relaxed">
                  Em qualquer nota, abra Anexos (clipe) e toque em Concluir: o Post+ cria a pasta organizada no seu Drive, envia fotos sem pesar o celular e sincroniza arquivos pelo Portal.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="font-bold text-emerald-950">3. Abas Compartilhadas & Perfil</p>
                <p className="text-[11px] text-emerald-900 mt-0.5 leading-relaxed">
                  Deslize o mural para trocar de aba, convide familiares por e-mail e personalize seu perfil (idade, gênero e região) para recomendações mais assertivas.
                </p>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHelpModalOpen(false)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#1D86C4] hover:bg-[#166FA3] rounded-lg cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
