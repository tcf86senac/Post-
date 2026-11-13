import React, { useState, useRef, useEffect } from 'react';
import { Note, NoteAttachment, CategoryTab, GoogleAccount } from '../types';
import {
  X,
  Paperclip,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Plus,
  Trash2,
  ExternalLink,
  Download,
  Upload,
  Camera,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link2,
  RefreshCw,
} from 'lucide-react';
import {
  suggestDriveFolderName,
  createNoteFolderInDrive,
  uploadFileToDriveFolder,
  deleteFileFromDrive,
  listFilesInDriveFolder,
  listPostPlusFolders,
  DrivePortalItem,
  getAccessTokenForEmail,
  connectGoogleAccount,
} from '../services/googleDriveService';

const formatBytesLabel = (bytes?: number): string => {
  if (!bytes || Number.isNaN(bytes)) return 'Drive';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${Math.max(0.1, bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const detectTypeFromMime = (mimeType: string): NoteAttachment['type'] => {
  if (mimeType === 'application/vnd.google-apps.folder') return 'drive_folder';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('pdf')) return 'pdf';
  if (
    mimeType.includes('sheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv') ||
    mimeType.includes('spreadsheet')
  ) {
    return 'sheet';
  }
  return 'doc';
};

/**
 * Compresses image dataUrls into tiny thumbnails (<35KB) after Drive upload so localStorage never overflows.
 */
const createCompactThumbnail = (dataUrl: string): Promise<string | undefined> =>
  new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        const maxDim = 260;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(undefined);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const thumb = canvas.toDataURL('image/jpeg', 0.62);
        resolve(thumb.length < 48000 ? thumb : undefined);
      };
      img.onerror = () => resolve(undefined);
      img.src = dataUrl;
    } catch {
      resolve(undefined);
    }
  });

interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note | null;
  tab?: CategoryTab;
  googleAccounts?: GoogleAccount[];
  onAddOrUpdateAccount?: (account: GoogleAccount) => void;
  onOpenAccountsModal?: () => void;
  onUpdateAttachments: (
    noteId: string,
    attachments: NoteAttachment[],
    driveFolderUrl?: string,
    driveFolderId?: string,
    driveFolderName?: string
  ) => void;
}

export const AttachmentModal: React.FC<AttachmentModalProps> = ({
  isOpen,
  onClose,
  note,
  tab,
  googleAccounts = [],
  onAddOrUpdateAccount,
  onOpenAccountsModal,
  onUpdateAttachments,
}) => {
  const [draftAttachments, setDraftAttachments] = useState<NoteAttachment[]>([]);
  const [driveUrl, setDriveUrl] = useState('');
  const [driveFolderId, setDriveFolderId] = useState<string | undefined>(undefined);
  const [suggestedFolderName, setSuggestedFolderName] = useState('');
  const [showManualDriveLink, setShowManualDriveLink] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileUrl, setNewFileUrl] = useState('');
  const [newFileType, setNewFileType] = useState<NoteAttachment['type']>('link');

  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishingStep, setFinishingStep] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSaveLocalFallback, setShowSaveLocalFallback] = useState(false);

  // Confirmation dialog for destructive Drive delete
  const [pendingDeleteAtt, setPendingDeleteAtt] = useState<NoteAttachment | null>(null);
  const [isDeletingDrive, setIsDeletingDrive] = useState(false);

  // Two-way Drive Portal state (sync files inside folder + browse Post+/ folders)
  const [isSyncingPortal, setIsSyncingPortal] = useState(false);
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [existingPostFolders, setExistingPostFolders] = useState<DrivePortalItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const syncLiveDriveFolder = async (
    folderIdToSync: string,
    tokenToUse: string,
    currentNote: Note,
    currentFolderUrl: string,
    currentFolderName: string
  ) => {
    setIsSyncingPortal(true);
    try {
      const remoteFiles = await listFilesInDriveFolder(tokenToUse, folderIdToSync);
      setDraftAttachments((prev) => {
        const byDriveId = new Map<string, DrivePortalItem>();
        remoteFiles.forEach((rf) => byDriveId.set(rf.id, rf));

        const merged = prev.map((att) => {
          if (att.driveFileId && byDriveId.has(att.driveFileId)) {
            const rf = byDriveId.get(att.driveFileId)!;
            byDriveId.delete(att.driveFileId);
            return {
              ...att,
              name: rf.name,
              driveUrl: rf.webViewLink || att.driveUrl,
              size: rf.sizeBytes ? formatBytesLabel(rf.sizeBytes) : att.size,
              uploadedToDrive: true,
            };
          }
          return att;
        });

        const newlyFound: NoteAttachment[] = [];
        byDriveId.forEach((rf) => {
          newlyFound.push({
            id: `drive-${rf.id}`,
            name: rf.name,
            type: detectTypeFromMime(rf.mimeType),
            size: formatBytesLabel(rf.sizeBytes),
            addedAt: rf.modifiedTime
              ? new Date(rf.modifiedTime).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                })
              : 'Drive',
            driveFileId: rf.id,
            driveUrl: rf.webViewLink,
            uploadedToDrive: true,
          });
        });

        const nextList = [...merged, ...newlyFound];
        if (newlyFound.length > 0) {
          onUpdateAttachments(
            currentNote.id,
            nextList,
            currentFolderUrl || undefined,
            folderIdToSync,
            currentFolderName || undefined
          );
          setStatusMessage(
            `${newlyFound.length} arquivo(s) do portal Google Drive sincronizado(s)!`
          );
        }
        return nextList;
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Não foi possível sincronizar os arquivos da pasta no Drive.');
    } finally {
      setIsSyncingPortal(false);
    }
  };

  useEffect(() => {
    if (note && isOpen) {
      const initialAtts = note.attachments || [];
      setDraftAttachments(initialAtts);
      setDriveUrl(note.driveFolderUrl || '');
      setDriveFolderId(note.driveFolderId);
      const initialFolderName =
        note.driveFolderName || suggestDriveFolderName(note.title);
      setSuggestedFolderName(initialFolderName);
      setShowManualDriveLink(Boolean(note.driveFolderUrl && !note.driveFolderId));
      setShowAddForm(false);
      setShowFolderBrowser(false);
      setExistingPostFolders([]);
      setErrorMsg(null);
      setStatusMessage(null);
      setShowSaveLocalFallback(false);
      setPendingDeleteAtt(null);
      setIsFinishing(false);
      setFinishingStep('');

      const activeEmail = tab?.linkedGoogleEmail || googleAccounts[0]?.email;
      const token = getAccessTokenForEmail(activeEmail);
      if (note.driveFolderId && token) {
        void syncLiveDriveFolder(
          note.driveFolderId,
          token,
          note,
          note.driveFolderUrl || '',
          initialFolderName
        );
      }
    }
  }, [note, isOpen]);

  if (!isOpen || !note) return null;

  const linkedEmail = tab?.linkedGoogleEmail || googleAccounts[0]?.email;
  const activeToken = getAccessTokenForEmail(linkedEmail);
  const pendingUploadCount = draftAttachments.filter(
    (a) => Boolean(a.dataUrl) && !a.uploadedToDrive
  ).length;

  const handleConnectDriveForTab = async () => {
    setIsConnectingGoogle(true);
    setErrorMsg(null);
    setShowSaveLocalFallback(false);
    try {
      const { account, accessToken } = await connectGoogleAccount(linkedEmail);
      onAddOrUpdateAccount?.(account);
      setStatusMessage(`Conta ${account.email} autorizada para o Google Drive!`);
      if (driveFolderId && note) {
        await syncLiveDriveFolder(
          driveFolderId,
          accessToken,
          note,
          driveUrl,
          suggestedFolderName
        );
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setErrorMsg(err?.message || 'Não foi possível autorizar a conta Google.');
      }
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleOpenPostFoldersBrowser = async () => {
    if (showFolderBrowser) {
      setShowFolderBrowser(false);
      return;
    }
    setErrorMsg(null);
    setIsLoadingFolders(true);
    try {
      let token = getAccessTokenForEmail(linkedEmail);
      if (!token) {
        const { account, accessToken } = await connectGoogleAccount(linkedEmail);
        onAddOrUpdateAccount?.(account);
        token = accessToken;
      }
      const folders = await listPostPlusFolders(token);
      setExistingPostFolders(folders);
      setShowFolderBrowser(true);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setErrorMsg(err?.message || 'Não foi possível consultar pastas existentes em Post+/.');
      }
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const handleSelectExistingFolder = async (folder: DrivePortalItem) => {
    setDriveFolderId(folder.id);
    setDriveUrl(folder.webViewLink);
    setSuggestedFolderName(folder.name);
    setShowFolderBrowser(false);
    onUpdateAttachments(
      note.id,
      draftAttachments,
      folder.webViewLink,
      folder.id,
      folder.name
    );
    const token = getAccessTokenForEmail(linkedEmail);
    if (token) {
      await syncLiveDriveFolder(folder.id, token, note, folder.webViewLink, folder.name);
    }
  };

  const processSelectedFiles = async (files: FileList | null, fromCamera = false) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    setStatusMessage(null);

    const newAttachments: NoteAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let detectedType: NoteAttachment['type'] = 'doc';
      if (file.type.startsWith('image/') || fromCamera) detectedType = 'image';
      else if (file.type.includes('pdf')) detectedType = 'pdf';
      else if (
        file.type.includes('sheet') ||
        file.type.includes('csv') ||
        file.type.includes('excel')
      ) {
        detectedType = 'sheet';
      }

      const sizeInMb = Math.max(0.1, file.size / (1024 * 1024)).toFixed(1);
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const fileName = fromCamera
        ? `Foto_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.jpg`
        : file.name;

      newAttachments.push({
        id: `att-${Date.now()}-${i}`,
        name: fileName,
        type: detectedType,
        size: `${sizeInMb} MB`,
        addedAt:
          'Hoje, ' +
          new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        dataUrl,
        uploadedToDrive: false,
      });
    }

    setDraftAttachments((prev) => [...prev, ...newAttachments]);
    setStatusMessage(
      `${newAttachments.length} arquivo(s) adicionado(s). Toque em Concluir para confirmar e salvar no Drive.`
    );
  };

  const handleManualAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim() && !newFileUrl.trim()) return;

    const cleanUrl = newFileUrl.trim()
      ? newFileUrl.trim().startsWith('http')
        ? newFileUrl.trim()
        : `https://${newFileUrl.trim()}`
      : undefined;

    const newAtt: NoteAttachment = {
      id: `att-${Date.now()}`,
      name: newFileName.trim() || 'Link Externo',
      type: newFileType,
      size: 'Link',
      addedAt:
        'Hoje, ' +
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      driveUrl: cleanUrl,
    };

    setDraftAttachments((prev) => [...prev, newAtt]);
    setNewFileName('');
    setNewFileUrl('');
    setShowAddForm(false);
    setStatusMessage('Link adicionado à lista. Toque em Concluir para confirmar.');
  };

  const handleRequestDeleteAttachment = (att: NoteAttachment) => {
    if (att.driveFileId && att.uploadedToDrive) {
      setPendingDeleteAtt(att);
    } else {
      setDraftAttachments((prev) => prev.filter((a) => a.id !== att.id));
    }
  };

  const handleConfirmDeleteAttachment = async (alsoDeleteFromDrive: boolean) => {
    if (!pendingDeleteAtt) return;
    setIsDeletingDrive(true);
    setErrorMsg(null);

    try {
      if (alsoDeleteFromDrive && pendingDeleteAtt.driveFileId) {
        let token = getAccessTokenForEmail(linkedEmail);
        if (!token) {
          const { account, accessToken } = await connectGoogleAccount(linkedEmail);
          onAddOrUpdateAccount?.(account);
          token = accessToken;
        }
        await deleteFileFromDrive(token, pendingDeleteAtt.driveFileId);
      }

      const updated = draftAttachments.filter((a) => a.id !== pendingDeleteAtt.id);
      setDraftAttachments(updated);
      onUpdateAttachments(
        note.id,
        updated,
        driveUrl.trim() || undefined,
        driveFolderId,
        suggestedFolderName.trim() || undefined
      );
      setPendingDeleteAtt(null);
      setStatusMessage(
        alsoDeleteFromDrive
          ? 'Arquivo removido da nota e do Google Drive.'
          : 'Arquivo desvinculado da nota (mantido no Google Drive).'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao excluir arquivo.');
    } finally {
      setIsDeletingDrive(false);
    }
  };

  const handleSaveLocalOnly = () => {
    onUpdateAttachments(
      note.id,
      draftAttachments,
      driveUrl.trim() || undefined,
      driveFolderId,
      suggestedFolderName.trim() || undefined
    );
    onClose();
  };

  /**
   * Unified "Concluir" action:
   * 1. Generates the automatic folder in Google Drive (Post+/aa-mm-dd - nome) if not yet created
   * 2. Uploads any pending photos/files into that Drive folder
   * 3. Confirms & saves all attachments + Drive folder info on the note
   * 4. Closes the modal
   */
  const handleConcludeAll = async () => {
    setErrorMsg(null);
    setStatusMessage(null);
    setShowSaveLocalFallback(false);

    const folderNameToCreate =
      suggestedFolderName.trim() || suggestDriveFolderName(note.title);

    // If user pasted a manual external folder URL and has no local files to upload, save & close directly
    if (!driveFolderId && driveUrl.trim() && pendingUploadCount === 0) {
      onUpdateAttachments(
        note.id,
        draftAttachments,
        driveUrl.trim(),
        undefined,
        folderNameToCreate
      );
      onClose();
      return;
    }

    setIsFinishing(true);
    try {
      let token = getAccessTokenForEmail(linkedEmail);
      if (!token) {
        setFinishingStep('Autorizando Google Drive...');
        const { account, accessToken } = await connectGoogleAccount(linkedEmail);
        onAddOrUpdateAccount?.(account);
        token = accessToken;
      }

      let targetFolderId = driveFolderId;
      let targetFolderUrl = driveUrl.trim();
      let targetFolderName = folderNameToCreate;

      // 1. Generate Drive folder inside Post+/<Aba>/ if it doesn't exist yet
      if (!targetFolderId) {
        setFinishingStep(`Gerando pasta em Post+/${tab?.label || 'Mural'}...`);
        const created = await createNoteFolderInDrive(
          token,
          folderNameToCreate,
          tab?.label
        );
        targetFolderId = created.id;
        targetFolderUrl = created.webViewLink;
        targetFolderName = created.name;
        setDriveFolderId(created.id);
        setDriveUrl(created.webViewLink);
        setSuggestedFolderName(created.name);
      }

      // 2. Upload all pending files/photos to the Drive folder
      const finalAttachments = [...draftAttachments];
      const pendingIndices = finalAttachments
        .map((att, idx) => (att.dataUrl && !att.uploadedToDrive ? idx : -1))
        .filter((idx) => idx >= 0);

      for (let step = 0; step < pendingIndices.length; step++) {
        const idx = pendingIndices[step];
        const att = finalAttachments[idx];
        setFinishingStep(
          `Enviando ${step + 1}/${pendingIndices.length}: ${att.name}...`
        );
        const uploaded = await uploadFileToDriveFolder(
          token,
          targetFolderId,
          att.name,
          att.dataUrl!
        );
        const compactThumb =
          att.type === 'image' && att.dataUrl
            ? await createCompactThumbnail(att.dataUrl)
            : undefined;
        finalAttachments[idx] = {
          ...att,
          driveFileId: uploaded.id,
          driveUrl: uploaded.webViewLink,
          uploadedToDrive: true,
          dataUrl: compactThumb,
        };
      }

      // 3. Confirm all attachments & Drive folder on the note and close
      onUpdateAttachments(
        note.id,
        finalAttachments,
        targetFolderUrl || undefined,
        targetFolderId,
        targetFolderName
      );
      onClose();
    } catch (err: any) {
      const msg =
        err?.code === 'auth/popup-closed-by-user'
          ? 'Autorização do Google Drive não concluída. Você pode tentar novamente ou salvar os anexos apenas nesta nota.'
          : err?.message || 'Não foi possível concluir a geração da pasta no Google Drive.';
      setErrorMsg(msg);
      setShowSaveLocalFallback(true);
    } finally {
      setIsFinishing(false);
      setFinishingStep('');
    }
  };

  const getFileIcon = (type: NoteAttachment['type']) => {
    switch (type) {
      case 'drive_folder':
        return <FolderOpen className="w-5 h-5 text-amber-500 shrink-0" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-500 shrink-0" />;
      case 'image':
        return <ImageIcon className="w-5 h-5 text-blue-500 shrink-0" />;
      case 'sheet':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />;
      default:
        return <Paperclip className="w-5 h-5 text-slate-500 shrink-0" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-[#1D86C4] text-white">
          <div className="flex items-center gap-2 min-w-0">
            <Paperclip className="w-4 h-4 text-sky-100 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-xs font-bold leading-tight">Anexos & Google Drive</h3>
              <p className="text-[10px] text-white/85 truncate max-w-[230px]">
                Nota: {note.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isFinishing}
            className="p-1 rounded-full hover:bg-white/10 active:bg-white/20 text-white cursor-pointer shrink-0 disabled:opacity-50"
            title="Fechar sem concluir"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3.5 custom-scrollbar">
          {/* Google Account for this Tab */}
          <div className="p-2.5 rounded-xl bg-blue-50/85 border border-blue-200/80 text-[11px] text-blue-950 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-blue-950 flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-[#1D86C4]" />
                <span>Drive da Aba {tab?.label || 'PRINCIPAL'}</span>
              </p>
              {onOpenAccountsModal && (
                <button
                  type="button"
                  onClick={onOpenAccountsModal}
                  className="text-[10px] font-bold text-[#1D86C4] hover:underline cursor-pointer"
                >
                  Trocar conta
                </button>
              )}
            </div>

            {linkedEmail ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-blue-900 truncate font-medium">
                  Conta: <strong>{linkedEmail}</strong>
                </span>
                {activeToken ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Conectado
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectDriveForTab}
                    disabled={isConnectingGoogle || isFinishing}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-slate-300 text-[10px] font-bold text-slate-800 hover:bg-slate-50 cursor-pointer shrink-0"
                  >
                    {isConnectingGoogle ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      'Autorizar Drive'
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-blue-900">
                  A pasta será gerada em <strong>Post+/</strong> ao concluir.
                </span>
                <button
                  type="button"
                  onClick={handleConnectDriveForTab}
                  disabled={isConnectingGoogle || isFinishing}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-300 text-[10px] font-bold text-slate-800 hover:bg-slate-50 cursor-pointer shrink-0 shadow-2xs"
                >
                  {isConnectingGoogle ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <span>Entrar Google</span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Automatic Folder Name (aa-mm-dd - nome_revisado) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Pasta no Drive (Post+/{tab?.label || 'Mural'}/aa-mm-dd):
              </label>
              {driveFolderId && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  <CheckCircle2 className="w-3 h-3" />
                  Gerada
                </span>
              )}
            </div>
            <input
              type="text"
              value={suggestedFolderName}
              onChange={(e) => setSuggestedFolderName(e.target.value)}
              disabled={Boolean(driveFolderId) || isFinishing}
              placeholder="26-11-12 - Nome da Pasta"
              className="w-full px-3 py-1.5 text-xs text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D86C4] disabled:bg-slate-50 disabled:text-slate-600"
            />

            <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
              {driveUrl ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-semibold"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Abrir pasta no Drive</span>
                  </a>
                  {driveFolderId && (
                    <button
                      type="button"
                      disabled={isSyncingPortal || isFinishing}
                      onClick={async () => {
                        let token = getAccessTokenForEmail(linkedEmail);
                        if (!token) {
                          await handleConnectDriveForTab();
                          return;
                        }
                        await syncLiveDriveFolder(
                          driveFolderId,
                          token,
                          note,
                          driveUrl,
                          suggestedFolderName
                        );
                      }}
                      className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#125882] bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded border border-sky-200 cursor-pointer disabled:opacity-50"
                      title="Buscar novos arquivos adicionados diretamente na pasta do Drive"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${isSyncingPortal ? 'animate-spin' : ''}`}
                      />
                      <span>{isSyncingPortal ? 'Sincronizando...' : 'Sincronizar Portal'}</span>
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>Gerada automaticamente ao tocar em Concluir</span>
                </span>
              )}

              {!driveFolderId && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isLoadingFolders || isFinishing}
                    onClick={() => void handleOpenPostFoldersBrowser()}
                    className="text-[10px] font-semibold text-[#125882] hover:underline cursor-pointer inline-flex items-center gap-0.5 disabled:opacity-50"
                    title="Vincular a uma pasta existente dentro de Post+/ no Drive"
                  >
                    {isLoadingFolders ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <FolderOpen className="w-3 h-3" />
                    )}
                    <span>{showFolderBrowser ? 'Fechar Pastas' : 'Vincular Existente'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManualDriveLink(!showManualDriveLink)}
                    className="text-[10px] font-semibold text-[#1D86C4] hover:underline cursor-pointer inline-flex items-center gap-0.5"
                  >
                    <Link2 className="w-3 h-3" />
                    <span>{showManualDriveLink ? 'Ocultar URL' : 'Colar URL'}</span>
                  </button>
                </div>
              )}
            </div>

            {showFolderBrowser && !driveFolderId && (
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 animate-in fade-in duration-150">
                <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Pastas existentes em Post+/ no seu Drive:
                </p>
                {existingPostFolders.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic py-1">
                    Nenhuma pasta criada em Post+/ ainda. Toque em Concluir para criar a primeira!
                  </p>
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                    {existingPostFolders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => void handleSelectExistingFolder(folder)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg bg-white hover:bg-sky-50 border border-slate-200 text-xs font-semibold text-slate-800 flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span className="truncate flex items-center gap-1.5">
                          <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">{folder.name}</span>
                        </span>
                        <span className="text-[10px] text-[#1D86C4] font-bold shrink-0">
                          Vincular
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showManualDriveLink && !driveFolderId && (
              <div className="pt-1 animate-in fade-in duration-150">
                <input
                  type="text"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="Opcional: https://drive.google.com/drive/folders/..."
                  className="w-full px-3 py-1.5 text-xs text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D86C4]"
                />
              </div>
            )}
          </div>

          {/* Feedback / Errors */}
          {statusMessage && (
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              <span>{statusMessage}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-700 space-y-1.5">
              <div className="flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              {showSaveLocalFallback && (
                <button
                  type="button"
                  onClick={handleSaveLocalOnly}
                  className="text-[10.5px] font-bold text-slate-800 underline hover:text-black cursor-pointer"
                >
                  Salvar anexos apenas nesta nota (sem Drive agora)
                </button>
              )}
            </div>
          )}

          {/* Mandatory Confirmation Dialog for Deleting Drive Files */}
          {pendingDeleteAtt && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2 animate-in fade-in duration-150">
              <p className="text-xs font-bold text-rose-900">
                Remover "{pendingDeleteAtt.name}"?
              </p>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                Este arquivo também foi salvo na sua pasta do Google Drive. Escolha o que deseja fazer:
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  disabled={isDeletingDrive}
                  onClick={() => handleConfirmDeleteAttachment(true)}
                  className="px-2.5 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer disabled:opacity-60"
                >
                  {isDeletingDrive ? 'Excluindo...' : 'Excluir do Post+ e do Drive'}
                </button>
                <button
                  type="button"
                  disabled={isDeletingDrive}
                  onClick={() => handleConfirmDeleteAttachment(false)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  Só desvincular do Post+
                </button>
                <button
                  type="button"
                  disabled={isDeletingDrive}
                  onClick={() => setPendingDeleteAtt(null)}
                  className="px-2 py-1 text-[11px] text-slate-600 hover:underline cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Hidden Inputs for Camera & File Upload */}
          <input
            type="file"
            ref={cameraInputRef}
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              processSelectedFiles(e.target.files, true);
              e.target.value = '';
            }}
          />
          <input
            type="file"
            ref={fileInputRef}
            multiple
            className="hidden"
            onChange={(e) => {
              processSelectedFiles(e.target.files, false);
              e.target.value = '';
            }}
          />

          {/* Attachments Header & Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Arquivos ({draftAttachments.length})
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isFinishing}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-900 bg-[#F9DD36] hover:bg-amber-300 rounded-md cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                  title="Fotografar agora e anexar foto a esta nota"
                >
                  <Camera className="w-3 h-3" />
                  <span>Fotografar</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isFinishing}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                  title="Enviar arquivos, comprovantes ou imagens do dispositivo"
                >
                  <Upload className="w-3 h-3" />
                  <span>Enviar Arquivo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(!showAddForm)}
                  disabled={isFinishing}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer transition-colors disabled:opacity-50"
                  title="Adicionar anexo por link"
                >
                  <Plus className="w-3 h-3" />
                  <span>Link</span>
                </button>
              </div>
            </div>

            {/* Add Link Form */}
            {showAddForm && (
              <form
                onSubmit={handleManualAddLink}
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-in fade-in duration-150"
              >
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                    Título do Anexo / Link
                  </label>
                  <input
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="Ex: Contrato_Aluguel.pdf ou Link da Pasta"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                      URL / Endereço
                    </label>
                    <input
                      type="text"
                      value={newFileUrl}
                      onChange={(e) => setNewFileUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                      Tipo
                    </label>
                    <select
                      value={newFileType}
                      onChange={(e) => setNewFileType(e.target.value as NoteAttachment['type'])}
                      className="w-full px-1.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                    >
                      <option value="link">🔗 Link</option>
                      <option value="drive_folder">📁 Pasta</option>
                      <option value="pdf">📄 PDF</option>
                      <option value="doc">📝 Doc</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-md cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md cursor-pointer"
                  >
                    Adicionar
                  </button>
                </div>
              </form>
            )}

            {/* Attachments List */}
            {draftAttachments.length > 0 ? (
              <div className="space-y-1.5">
                {draftAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {att.dataUrl && att.type === 'image' ? (
                        <img
                          src={att.dataUrl}
                          alt={att.name}
                          className="w-9 h-9 rounded object-cover border border-slate-300 shrink-0"
                        />
                      ) : (
                        getFileIcon(att.type)
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {att.name}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-500">
                            {att.size} · {att.addedAt}
                          </span>
                          {att.uploadedToDrive ? (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold">
                              Drive
                            </span>
                          ) : att.dataUrl ? (
                            <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-bold">
                              Pendente
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {att.driveUrl && (
                        <a
                          href={att.driveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-slate-500 hover:text-blue-600 rounded cursor-pointer"
                          title="Abrir no Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {att.dataUrl && (
                        <a
                          href={att.dataUrl}
                          download={att.name}
                          className="p-1 text-slate-500 hover:text-blue-600 rounded cursor-pointer"
                          title="Baixar arquivo"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRequestDeleteAttachment(att)}
                        disabled={isFinishing}
                        className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer transition-colors disabled:opacity-40"
                        title="Remover anexo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic py-3 text-center">
                Nenhum arquivo anexado a esta nota. Use Fotografar, Enviar Arquivo ou Link acima.
              </p>
            )}
          </div>
        </div>

        {/* Unified Footer Action */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-500 truncate">
            {finishingStep ||
              (driveFolderId
                ? `${draftAttachments.length} anexo(s) · Pasta pronta`
                : 'Gera pasta e confirma anexos')}
          </span>
          <button
            type="button"
            onClick={handleConcludeAll}
            disabled={isFinishing || isConnectingGoogle}
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#1D86C4] hover:bg-[#166FA3] rounded-lg cursor-pointer inline-flex items-center gap-1.5 shrink-0 disabled:opacity-60 shadow-xs"
          >
            {isFinishing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Concluindo...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Concluir</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
