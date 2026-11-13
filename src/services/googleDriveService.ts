import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { app, auth } from './firebaseClient';
import { GoogleAccount } from '../types';
import { clearCachedGoogleDemographics } from './googlePeopleService';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/user.birthday.read',
  'https://www.googleapis.com/auth/user.gender.read',
  'https://www.googleapis.com/auth/user.addresses.read',
  'https://www.googleapis.com/auth/userinfo.profile',
];

void app;

// Strictly in-memory token cache keyed by lowercase email (NEVER persisted to localStorage/sessionStorage)
const inMemoryTokenMap = new Map<string, string>();
let isSigningIn = false;

export const initGoogleDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthCleared?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user && user.email) {
      const token = inMemoryTokenMap.get(user.email.toLowerCase());
      if (token) {
        onAuthSuccess?.(user, token);
      } else if (!isSigningIn) {
        onAuthCleared?.();
      }
    } else {
      inMemoryTokenMap.clear();
      clearCachedGoogleDemographics();
      onAuthCleared?.();
    }
  });
};

/**
 * Connect or refresh a Google account using Firebase Auth + Google Drive & People scopes.
 * Allows connecting multiple Google accounts (personal, work, etc.) via select_account.
 */
export const connectGoogleAccount = async (
  loginHint?: string
): Promise<{ account: GoogleAccount; accessToken: string }> => {
  const provider = new GoogleAuthProvider();
  SCOPES.forEach((scope) => provider.addScope(scope));

  if (loginHint) {
    provider.setCustomParameters({
      login_hint: loginHint,
      prompt: 'consent',
    });
  } else {
    provider.setCustomParameters({
      prompt: 'select_account',
    });
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter a permissão de acesso à sua conta Google.');
    }

    const email = result.user.email || 'conta@gmail.com';
    const normalizedEmail = email.toLowerCase();
    inMemoryTokenMap.set(normalizedEmail, credential.accessToken);

    const account: GoogleAccount = {
      id: result.user.uid || `gacc-${Date.now()}`,
      email,
      name: result.user.displayName || email.split('@')[0],
      avatarUrl: result.user.photoURL || undefined,
      connectedAt: 'Hoje, ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    return { account, accessToken: credential.accessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessTokenForEmail = (email?: string): string | null => {
  if (!email) return null;
  return inMemoryTokenMap.get(email.toLowerCase()) || null;
};

export const hasActiveTokenForEmail = (email?: string): boolean => {
  return Boolean(getAccessTokenForEmail(email));
};

export const clearAccessTokenForEmail = (email?: string): void => {
  if (!email) return;
  inMemoryTokenMap.delete(email.toLowerCase());
  clearCachedGoogleDemographics(email);
};

export const signOutAllGoogleAccounts = async () => {
  inMemoryTokenMap.clear();
  clearCachedGoogleDemographics();
  await auth.signOut();
};

/**
 * Formats automatic folder name strictly as "aa-mm-dd - nome_gerado"
 */
export const suggestDriveFolderName = (noteTitle: string, date = new Date()): string => {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  const cleanTitle = (noteTitle || 'Anotacao_PostPlus')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);

  return `${yy}-${mm}-${dd} - ${cleanTitle || 'Nota_PostPlus'}`;
};

/**
 * Finds or creates the dedicated root folder "Post+" inside the user's Google Drive.
 */
export const ensureAppRootFolder = async (accessToken: string): Promise<string> => {
  const query = encodeURIComponent(
    "name = 'Post+' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!searchRes.ok) {
    const err = await searchRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Erro ao consultar pasta dedicada Post+ no Google Drive.');
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create dedicated "Post+" root folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Post+',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Não foi possível criar a pasta dedicada Post+ no Drive.');
  }

  const created = await createRes.json();
  return created.id;
};

/**
 * Finds or creates a pre-organized category subfolder inside "Post+/" (e.g. "Post+/PRINCIPAL").
 */
export const ensureTabFolderInDrive = async (
  accessToken: string,
  tabLabel: string
): Promise<string> => {
  const rootId = await ensureAppRootFolder(accessToken);
  const cleanTab = tabLabel.replace(/[\\/:*?"<>|]/g, '').trim() || 'GERAL';
  const safeName = cleanTab.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const query = encodeURIComponent(
    `name = '${safeName}' and '${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: cleanTab,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootId],
    }),
  });

  if (!createRes.ok) {
    return rootId;
  }

  const created = await createRes.json();
  return created.id || rootId;
};

/**
 * Creates a post-specific folder inside "Post+/<Aba>/" (or "Post+/") in the linked account's Google Drive.
 */
export const createNoteFolderInDrive = async (
  accessToken: string,
  folderName: string,
  tabLabel?: string
): Promise<{ id: string; name: string; webViewLink: string }> => {
  const parentId = tabLabel
    ? await ensureTabFolderInDrive(accessToken, tabLabel)
    : await ensureAppRootFolder(accessToken);

  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName.trim(),
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    }
  );

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Falha ao criar a pasta da nota no Google Drive.');
  }

  const data = await createRes.json();
  return {
    id: data.id,
    name: data.name,
    webViewLink: data.webViewLink || `https://drive.google.com/drive/folders/${data.id}`,
  };
};

/**
 * Converts a dataUrl string to Blob for multipart upload.
 */
const dataUrlToBlob = (dataUrl: string, fallbackMime = 'application/octet-stream'): Blob => {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : fallbackMime;
  const byteString = atob(parts[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mime });
};

/**
 * Uploads a real file or photo directly to the note's Google Drive folder.
 */
export const uploadFileToDriveFolder = async (
  accessToken: string,
  folderId: string,
  fileName: string,
  dataUrl: string,
  mimeType?: string
): Promise<{ id: string; name: string; webViewLink: string }> => {
  const blob = dataUrlToBlob(dataUrl, mimeType);
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const formData = new FormData();
  formData.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  formData.append('file', blob);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Erro ao enviar arquivo para o Google Drive.');
  }

  const data = await uploadRes.json();
  return {
    id: data.id,
    name: data.name,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
  };
};

/**
 * Deletes a file from Google Drive (must only be called after explicit user confirmation).
 */
export const deleteFileFromDrive = async (
  accessToken: string,
  fileId: string
): Promise<void> => {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Erro ao remover arquivo do Google Drive.');
  }
};

export interface DrivePortalItem {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size?: string;
  sizeBytes?: number;
  webViewLink: string;
  thumbnailLink?: string;
  modifiedTime?: string;
}

const formatDriveBytes = (rawSize?: string | number): string | undefined => {
  const bytes = Number(rawSize);
  if (!bytes || Number.isNaN(bytes)) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Lists folders and files inside a specific Google Drive folder so the user can browse & sync files added externally.
 */
export const listFilesInDriveFolder = async (
  accessToken: string,
  folderId: string
): Promise<DrivePortalItem[]> => {
  const safeFolderId = folderId.replace(/'/g, '');
  const query = encodeURIComponent(`'${safeFolderId}' in parents and trashed = false`);
  const fields = encodeURIComponent(
    'files(id,name,mimeType,size,webViewLink,thumbnailLink,modifiedTime)'
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=folder,modifiedTime%20desc&pageSize=100&spaces=drive`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Não foi possível listar arquivos da pasta no Drive.');
  }

  const data = await res.json();
  const files: any[] = Array.isArray(data.files) ? data.files : [];
  return files.map((f) => {
    const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
    return {
      id: String(f.id),
      name: String(f.name || 'Arquivo sem nome'),
      mimeType: String(f.mimeType || 'application/octet-stream'),
      isFolder,
      size: formatDriveBytes(f.size),
      sizeBytes: f.size ? Number(f.size) : undefined,
      webViewLink:
        f.webViewLink ||
        (isFolder
          ? `https://drive.google.com/drive/folders/${f.id}`
          : `https://drive.google.com/file/d/${f.id}/view`),
      thumbnailLink: f.thumbnailLink || undefined,
      modifiedTime: f.modifiedTime || undefined,
    };
  });
};

/**
 * Resolves the root "Post+" folder ID, link and top-level items for the graphical Drive portal.
 */
export const getAppRootFolderPortal = async (
  accessToken: string
): Promise<{ rootId: string; webViewLink: string; items: DrivePortalItem[] }> => {
  const rootId = await ensureAppRootFolder(accessToken);
  const items = await listFilesInDriveFolder(accessToken, rootId);
  return {
    rootId,
    webViewLink: `https://drive.google.com/drive/folders/${rootId}`,
    items,
  };
};

/**
 * Lists organized subfolders inside the dedicated "Post+" root folder in the user's Google Drive.
 */
export const listPostPlusFolders = async (
  accessToken: string
): Promise<DrivePortalItem[]> => {
  const rootId = await ensureAppRootFolder(accessToken);
  const query = encodeURIComponent(
    `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const fields = encodeURIComponent('files(id,name,mimeType,webViewLink,modifiedTime)');
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime%20desc&pageSize=30&spaces=drive`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Não foi possível consultar as pastas em Post+/.');
  }

  const data = await res.json();
  const files: any[] = Array.isArray(data.files) ? data.files : [];
  return files.map((f) => ({
    id: String(f.id),
    name: String(f.name),
    mimeType: String(f.mimeType),
    isFolder: true,
    webViewLink: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`,
    modifiedTime: f.modifiedTime || undefined,
  }));
};

