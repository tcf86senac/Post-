export type NoteColor =
  | 'yellow'
  | 'lime'
  | 'green'
  | 'teal'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink'
  | 'red'
  | 'coral'
  | 'orange'
  | 'cream';

export type PinColor = 'red' | 'blue' | 'yellow' | 'green' | 'silver' | 'purple';
export type PenColor = 'blue' | 'black' | 'darkblue' | 'red' | 'green' | 'purple';
export type NoteFontStyle = 'handwriting' | 'casual' | 'clean' | 'typewriter';
export type ColorPaletteStyle = 'vibrant' | 'pastel';
export type NoteColorMode = 'random' | 'fixed' | 'choose';

export interface GoogleAccount {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  label?: string; // Ex: "Pessoal", "Trabalho"
  connectedAt: string;
}

export interface UserDemographicProfile {
  age?: number | null;
  ageNotDeclared?: boolean;
  location?: string;
  locationNotDeclared?: boolean;
  gender?: string;
  sexualOrientation?: string;
  generalInterests?: string[]; // Top 10 general interests chosen during registration
  relatedInterests?: string[]; // Chosen related subtopics from the 50 generated cards
  autoFilledFromGoogle?: {
    age?: boolean;
    location?: boolean;
    gender?: boolean;
  };
  updatedAt?: string;
}

export interface AudienceSegmentRecord {
  uid: string;
  ageBracket: string;
  gender: string;
  regionLabel: string;
  generalInterests: string[];
  relatedInterests: string[];
  updatedAt?: string;
}

export interface UserPreferences {
  defaultNoteColor: NoteColor;
  defaultPinColor: PinColor;
  defaultPenColor: PenColor;
  defaultFontStyle: NoteFontStyle;
  colorPalette: ColorPaletteStyle;
  colorSelectionMode: NoteColorMode;
  onboardingCompleted?: boolean;
  registeredEmail?: string;
  profile?: UserDemographicProfile;
}

export interface NoteAttachment {
  id: string;
  name: string;
  type: 'drive_folder' | 'pdf' | 'image' | 'doc' | 'sheet' | 'link';
  driveUrl?: string;
  driveFileId?: string;
  uploadedToDrive?: boolean;
  size?: string;
  addedAt: string;
  dataUrl?: string; // For photos taken with Post+ Lens or direct camera
}

export interface CalendarEventInfo {
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime?: string; // HH:MM
  durationMinutes?: number;
  googleCalendarUrl?: string;
  isSynced?: boolean;
  reminderMinutes?: number;
}

export type InviteStatus = 'pending' | 'accepted' | 'declined';

export interface NoteComment {
  id: string;
  noteId: string;
  tabDocId: string;
  authorUid: string;
  authorEmail: string;
  authorName: string;
  text: string;
  createdAtLabel: string;
  createdAtMs: number;
}

export interface TabInviteRecord {
  id: string;
  tabDocId: string;
  tabId: string;
  tabLabel: string;
  inviterUid: string;
  inviterEmail: string;
  inviterName: string;
  inviteeEmail: string;
  inviteeName: string;
  role: 'editor' | 'viewer';
  status: InviteStatus;
  shareCode: string;
}

export interface Note {
  id: string;
  category: string; // 'principal', 'trabalho', 'familia', etc.
  title: string;
  previewText: string;
  fullContent?: string;
  color: NoteColor;
  createdAt: string;
  updatedAt?: string;
  isPinned?: boolean;
  attachments?: NoteAttachment[];
  driveFolderUrl?: string;
  driveFolderId?: string;
  driveFolderName?: string;
  rotation?: number; // natural tilt on the mural (-2 to +2 degrees)
  pinColor?: PinColor;
  penColor?: PenColor;
  fontStyle?: NoteFontStyle;
  calendarEvent?: CalendarEventInfo;
  isSponsored?: boolean;
  sponsorName?: string;
  sponsorUrl?: string;
  // Shared tab collaboration metadata
  firestoreTabId?: string;
  authorUid?: string;
  authorEmail?: string;
  authorName?: string;
  commentsCount?: number;
  comments?: NoteComment[];
  trashedAt?: string;
}

export interface SharedMember {
  email: string;
  name: string;
  role: 'editor' | 'viewer';
  avatar?: string;
  status?: InviteStatus;
}

export interface CategoryTab {
  id: string;
  label: string;
  isShared?: boolean;
  sharedWith?: SharedMember[];
  shareCode?: string;
  linkedGoogleEmail?: string; // Google account linked to this tab for Drive backups
  firestoreId?: string;
  ownerUid?: string;
  ownerEmail?: string;
  ownerName?: string;
  memberEmails?: string[];
  editorEmails?: string[];
}

export interface MonetizationProfile {
  ageRange?: string;
  gender?: string;
  city?: string;
  locationPermissionGranted: boolean;
  adMode: 'standby' | 'google_ads' | 'custom_links';
  customSponsoredLink?: string;
}

export type MarketplacePlatform =
  | 'mercadolivre'
  | 'shopee'
  | 'tiktok'
  | 'amazon'
  | 'manual';

export type PromoCampaignStatus =
  | 'pending_curation'
  | 'approved'
  | 'rejected'
  | 'archived';

export type TargetGenderOption =
  | 'all'
  | 'Feminino'
  | 'Masculino'
  | 'Não-binário';

export interface DailyPromo {
  id: string;
  tickerText: string;
  title: string;
  description: string;
  sponsorName: string;
  ctaLabel: string;
  targetUrl: string;
  noteColor: NoteColor;
  isActive: boolean;
  priceLabel?: string;
  sourcePlatform?: MarketplacePlatform;
  updatedByEmail?: string;
  updatedAt?: string;
}

export interface PromoCampaign extends DailyPromo {
  sourcePlatform: MarketplacePlatform;
  status: PromoCampaignStatus;
  priceLabel: string;
  targetGender: TargetGenderOption;
  targetAgeMin: number;
  targetAgeMax: number;
  targetLocation: string;
  targetInterests?: string[];
  curationRationale: string;
  sourceMethod?: string;
  createdAt?: string;
}

