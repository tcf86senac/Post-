import React, { useState } from 'react';
import { GoogleAccount, CategoryTab } from '../types';
import {
  connectGoogleAccount,
  hasActiveTokenForEmail,
} from '../services/googleDriveService';
import { fetchGoogleProfileDemographics } from '../services/googlePeopleService';
import {
  X,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Trash2,
  FolderOpen,
  RefreshCw,
  Loader2,
  Tag,
} from 'lucide-react';

interface GoogleAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: GoogleAccount[];
  onAddOrUpdateAccount: (account: GoogleAccount) => void;
  onRemoveAccount: (email: string) => void;
  tabs: CategoryTab[];
  onBindTabToAccount: (tabId: string, googleEmail?: string) => void;
  onOpenDrivePortal?: () => void;
}

export const GoogleAccountsModal: React.FC<GoogleAccountsModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onAddOrUpdateAccount,
  onRemoveAccount,
  tabs,
  onBindTabToAccount,
  onOpenDrivePortal,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmRemoveEmail, setConfirmRemoveEmail] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState('');

  if (!isOpen) return null;

  const handleConnectNewAccount = async (loginHint?: string) => {
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      const { account, accessToken } = await connectGoogleAccount(loginHint);
      void fetchGoogleProfileDemographics(accessToken, account.email);
      const accountWithLabel: GoogleAccount = {
        ...account,
        label: customLabel.trim() || account.label || (accounts.length === 0 ? 'Principal' : 'Secundária'),
      };
      onAddOrUpdateAccount(accountWithLabel);
      setCustomLabel('');
    } catch (err: any) {
      console.error(err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Login cancelado antes de concluir.');
      } else {
        setErrorMsg(err?.message || 'Não foi possível conectar a conta Google.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-[#1D86C4] text-white">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-[#F9DD36]" />
            <div>
              <h3 className="text-xs font-bold leading-tight">Contas Google & Nuvem Drive</h3>
              <p className="text-[10px] text-white/85">
                Vincule contas pessoais e profissionais às suas abas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/15 text-white cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
          {/* Explanation */}
          <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/70 text-[11px] text-blue-950 leading-relaxed space-y-2">
            <p>
              Conecte quantas contas Google quiser (ex.: <strong>Pessoal</strong> e <strong>Trabalho</strong>). O Post+ cria automaticamente a hierarquia <strong>Post+ / Aba / aa-mm-dd</strong> no Drive da conta vinculada.
            </p>
            {onOpenDrivePortal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDrivePortal();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D86C4] hover:bg-[#166FA3] text-white text-[11px] font-bold cursor-pointer shadow-2xs"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Abrir Portal Google Drive (Post+/)</span>
              </button>
            )}
          </div>

          {/* Connected Accounts List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Contas Conectadas ({accounts.length})
              </span>
            </div>

            {accounts.length > 0 ? (
              <div className="space-y-2">
                {accounts.map((acc) => {
                  const isActiveSession = hasActiveTokenForEmail(acc.email);
                  return (
                    <div
                      key={acc.email}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {acc.avatarUrl ? (
                          <img
                            src={acc.avatarUrl}
                            alt={acc.name}
                            className="w-9 h-9 rounded-full border border-slate-300 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#1D86C4] text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {acc.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {acc.name}
                            </span>
                            {acc.label && (
                              <span className="text-[9px] bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-bold">
                                {acc.label}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">{acc.email}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {isActiveSession ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                                <CheckCircle2 className="w-3 h-3" />
                                Drive pronto nesta sessão
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleConnectNewAccount(acc.email)}
                                className="inline-flex items-center gap-1 text-[10px] text-amber-700 hover:text-amber-900 font-semibold underline cursor-pointer"
                              >
                                <RefreshCw className="w-2.5 h-2.5" />
                                Reautorizar Drive desta conta
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {confirmRemoveEmail === acc.email ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              onRemoveAccount(acc.email);
                              setConfirmRemoveEmail(null);
                            }}
                            className="px-2 py-1 text-[10px] font-bold text-white bg-rose-600 rounded cursor-pointer"
                          >
                            Remover
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveEmail(null)}
                            className="px-1.5 py-1 text-[10px] text-slate-600 cursor-pointer"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveEmail(acc.email)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer shrink-0"
                          title="Desconectar conta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic text-center py-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Nenhuma conta Google conectada ainda.
              </p>
            )}
          </div>

          {/* Add Google Account Section (Official Sign in with Google Style) */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Etiqueta opcional (ex: Pessoal, Trabalho, Família)"
                className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1D86C4]"
              />
            </div>

            {/* Official Google Sign-In Button Styling */}
            <button
              type="button"
              onClick={() => handleConnectNewAccount()}
              disabled={isConnecting}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-[#1f1f1f] border border-[#747775] rounded-full shadow-xs transition-all cursor-pointer disabled:opacity-60 font-medium text-xs"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#1D86C4]" />
                  <span>Conectando ao Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span className="font-semibold">
                    {accounts.length > 0
                      ? 'Conectar outra conta Google (Sign in with Google)'
                      : 'Entrar com Google (Sign in with Google)'}
                  </span>
                </>
              )}
            </button>

            {errorMsg && (
              <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-700 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Tab-to-Account Binding Section */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-[#1D86C4]" />
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Conta Google Drive por Aba / Assunto
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Escolha qual conta do Google Drive receberá as pastas e anexos de cada aba:
            </p>

            <div className="space-y-2">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200"
                >
                  <span className="text-xs font-bold text-slate-800 uppercase truncate">
                    {tab.label}
                  </span>
                  <select
                    value={tab.linkedGoogleEmail || ''}
                    onChange={(e) => onBindTabToAccount(tab.id, e.target.value || undefined)}
                    className="max-w-[195px] px-2 py-1 text-[11px] bg-white border border-slate-300 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1D86C4]"
                  >
                    <option value="">Selecionar conta...</option>
                    {accounts.map((acc) => (
                      <option key={acc.email} value={acc.email}>
                        {acc.label ? `${acc.label} (${acc.email})` : acc.email}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#1D86C4] hover:bg-[#166FA3] rounded-lg cursor-pointer"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
