import React, { useEffect, useState, useCallback } from 'react';
import { GoogleAccount } from '../types';
import {
  DrivePortalItem,
  getAccessTokenForEmail,
  getAppRootFolderPortal,
  listFilesInDriveFolder,
  connectGoogleAccount,
} from '../services/googleDriveService';
import {
  X,
  HardDrive,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogIn,
} from 'lucide-react';

interface BreadcrumbEntry {
  id: string;
  name: string;
  webViewLink: string;
}

interface DrivePortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleAccounts: GoogleAccount[];
  initialEmail?: string;
  onAccountConnected?: (account: GoogleAccount, accessToken: string) => void;
}

export const DrivePortalModal: React.FC<DrivePortalModalProps> = ({
  isOpen,
  onClose,
  googleAccounts,
  initialEmail,
  onAccountConnected,
}) => {
  const [selectedEmail, setSelectedEmail] = useState<string>('');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([]);
  const [items, setItems] = useState<DrivePortalItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const preferred =
      initialEmail ||
      googleAccounts.find((acc) => Boolean(getAccessTokenForEmail(acc.email)))?.email ||
      googleAccounts[0]?.email ||
      '';
    setSelectedEmail(preferred);
    setBreadcrumbs([]);
    setItems([]);
    setErrorMsg(null);
  }, [isOpen, initialEmail, googleAccounts]);

  const loadRootPortal = useCallback(async (email: string) => {
    if (!email) return;
    const token = getAccessTokenForEmail(email);
    if (!token) {
      setItems([]);
      setBreadcrumbs([]);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const portal = await getAppRootFolderPortal(token);
      setBreadcrumbs([
        {
          id: portal.rootId,
          name: 'Post+',
          webViewLink: portal.webViewLink,
        },
      ]);
      setItems(portal.items);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao carregar pastas do Google Drive.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && selectedEmail && getAccessTokenForEmail(selectedEmail)) {
      void loadRootPortal(selectedEmail);
    }
  }, [isOpen, selectedEmail, loadRootPortal]);

  if (!isOpen) return null;

  const activeToken = getAccessTokenForEmail(selectedEmail);
  const currentCrumb = breadcrumbs[breadcrumbs.length - 1];

  const handleOpenFolder = async (folder: DrivePortalItem) => {
    if (!activeToken) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const children = await listFilesInDriveFolder(activeToken, folder.id);
      setBreadcrumbs((prev) => [
        ...prev,
        { id: folder.id, name: folder.name, webViewLink: folder.webViewLink },
      ]);
      setItems(children);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Não foi possível abrir esta pasta.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigateCrumb = async (index: number) => {
    if (!activeToken) return;
    const target = breadcrumbs[index];
    if (!target) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const children = await listFilesInDriveFolder(activeToken, target.id);
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
      setItems(children);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao navegar pela pasta.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthorizeAccount = async (hintEmail?: string) => {
    setIsAuthorizing(true);
    setErrorMsg(null);
    try {
      const { account, accessToken } = await connectGoogleAccount(hintEmail);
      onAccountConnected?.(account, accessToken);
      setSelectedEmail(account.email);
      await loadRootPortal(account.email);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao autorizar acesso ao Google Drive.');
    } finally {
      setIsAuthorizing(false);
    }
  };

  const renderItemIcon = (item: DrivePortalItem) => {
    if (item.isFolder) {
      return <FolderOpen className="w-5 h-5 text-amber-600 shrink-0" />;
    }
    if (item.mimeType.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5 text-emerald-600 shrink-0" />;
    }
    if (
      item.mimeType.includes('spreadsheet') ||
      item.mimeType.includes('excel') ||
      item.name.endsWith('.xlsx')
    ) {
      return <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />;
    }
    return <FileText className="w-5 h-5 text-sky-600 shrink-0" />;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="bg-[#1D86C4] px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/15">
              <HardDrive className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">
                Portal Google Drive (Post+/)
              </h2>
              <p className="text-[11px] text-sky-100">
                Navegue pelas pastas pré-organizadas por Aba e Data no seu Drive
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/15 cursor-pointer transition-colors"
            title="Fechar Portal Drive"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account Selector */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          {googleAccounts.length > 0 ? (
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider shrink-0">
                Conta:
              </span>
              <select
                value={selectedEmail}
                onChange={(e) => {
                  setSelectedEmail(e.target.value);
                  setBreadcrumbs([]);
                  setItems([]);
                }}
                className="flex-1 min-w-[180px] text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-[#1D86C4]"
              >
                {googleAccounts.map((acc) => (
                  <option key={acc.id} value={acc.email}>
                    {acc.label ? `${acc.label} — ` : ''}
                    {acc.email}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="text-xs font-semibold text-slate-600">
              Nenhuma conta Google conectada ainda.
            </span>
          )}

          {activeToken && (
            <button
              type="button"
              onClick={() =>
                currentCrumb
                  ? void handleNavigateCrumb(breadcrumbs.length - 1)
                  : void loadRootPortal(selectedEmail)
              }
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          )}
        </div>

        {/* Breadcrumb Bar */}
        {activeToken && breadcrumbs.length > 0 && (
          <div className="px-5 py-2.5 bg-sky-50/70 border-b border-sky-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto text-xs font-bold text-slate-700">
              {breadcrumbs.length > 1 && (
                <button
                  type="button"
                  onClick={() => void handleNavigateCrumb(breadcrumbs.length - 2)}
                  className="p-1 mr-1 rounded-md hover:bg-sky-100 text-[#1D86C4] cursor-pointer shrink-0"
                  title="Voltar uma pasta"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.id}>
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  <button
                    type="button"
                    onClick={() => void handleNavigateCrumb(idx)}
                    className={`px-1.5 py-0.5 rounded truncate max-w-[150px] cursor-pointer ${
                      idx === breadcrumbs.length - 1
                        ? 'text-[#1D86C4] bg-white shadow-xs border border-sky-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {currentCrumb && (
              <a
                href={currentCrumb.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1D86C4] hover:underline shrink-0"
              >
                <span>Abrir no Drive</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!activeToken ? (
            <div className="py-8 px-4 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-300 space-y-3">
              <Cloud className="w-10 h-10 text-[#1D86C4] mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800">
                  {selectedEmail
                    ? 'Sessão do Google Drive expirada ou desconectada'
                    : 'Conecte sua conta Google para abrir o Portal Drive'}
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Por segurança, o acesso ao seu Google Drive é mantido apenas na sessão ativa. Toque abaixo para liberar a visualização da pasta organizada <span className="font-bold">Post+/</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleAuthorizeAccount(selectedEmail || undefined)}
                disabled={isAuthorizing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D86C4] hover:bg-[#166FA3] text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-60"
              >
                {isAuthorizing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <span>
                  {selectedEmail
                    ? `Autorizar Drive (${selectedEmail})`
                    : 'Conectar Conta Google'}
                </span>
              </button>
            </div>
          ) : isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
              <Loader2 className="w-7 h-7 animate-spin text-[#1D86C4]" />
              <span className="text-xs font-semibold">
                Consultando pastas e arquivos no Google Drive...
              </span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 space-y-2">
              <FolderOpen className="w-9 h-9 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Esta pasta está vazia</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Ao anexar fotos, PDFs ou documentos em uma nota pelo botão de clipe, o Post+ cria automaticamente a hierarquia <span className="font-semibold">Post+ / Aba / aa-mm-dd - Título</span> aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-[#1D86C4]/40 hover:bg-sky-50/30 transition-all flex items-center justify-between gap-3"
                >
                  {item.isFolder ? (
                    <button
                      type="button"
                      onClick={() => void handleOpenFolder(item)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
                        {renderItemIcon(item)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {item.name}
                        </p>
                        <p className="text-[10.5px] text-slate-500">
                          Pasta organizada · Toque para abrir
                        </p>
                      </div>
                    </button>
                  ) : (
                    <a
                      href={item.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        {renderItemIcon(item)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {item.name}
                        </p>
                        <p className="text-[10.5px] text-slate-500">
                          {item.size ? `${item.size} · ` : ''}
                          Salvo no Google Drive
                        </p>
                      </div>
                    </a>
                  )}

                  <a
                    href={item.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir diretamente no Google Drive"
                    className="p-2 rounded-lg text-[#1D86C4] hover:bg-sky-100 shrink-0 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Organization Legend */}
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-[11px] text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Pré-organização ativa:</strong> O Post+ organiza seus documentos no Google Drive dentro de{' '}
              <span className="font-mono font-bold">Post+ / Aba / aa-mm-dd - Nota</span> para você encontrar tudo com facilidade também fora do app.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
