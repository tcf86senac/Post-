import React from 'react';
import { User } from 'firebase/auth';
import {
  X,
  Pin,
  Trash2,
  Settings,
  FolderPlus,
  HelpCircle,
  Share2,
  CloudCheck,
  Camera,
  Sparkles,
  LogOut,
  LogIn,
  Bell,
  HardDrive,
} from 'lucide-react';
import { PostLogo } from './PostLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { CURRENT_APP_VERSION } from '../services/appMigrationService';

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onAddNewTab: () => void;
  onOpenMonetization?: () => void;
  onOpenLens?: () => void;
  onOpenAccountsModal?: () => void;
  onOpenOnboardingModal?: () => void;
  googleAccountsCount?: number;
  registeredEmail?: string;
  authUser?: User | null;
  onSignInGoogle?: () => void;
  onLogout?: () => void;
  pendingInvitesCount?: number;
  onOpenPendingInvites?: () => void;
  showPinnedOnly?: boolean;
  onTogglePinnedOnly?: () => void;
  trashedCount?: number;
  onOpenTrash?: () => void;
  onShareApp?: () => void;
  onOpenHelp?: () => void;
  onOpenDrivePortal?: () => void;
}

const getInitials = (name?: string | null, email?: string | null): string => {
  const source = (name || email || 'U').trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
};

export const DrawerMenu: React.FC<DrawerMenuProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  onAddNewTab,
  onOpenMonetization,
  onOpenLens,
  onOpenAccountsModal,
  onOpenOnboardingModal,
  googleAccountsCount = 0,
  registeredEmail,
  authUser,
  onSignInGoogle,
  onLogout,
  pendingInvitesCount = 0,
  onOpenPendingInvites,
  showPinnedOnly = false,
  onTogglePinnedOnly,
  trashedCount = 0,
  onOpenTrash,
  onShareApp,
  onOpenHelp,
  onOpenDrivePortal,
}) => {
  if (!isOpen) return null;

  const displayName =
    authUser?.displayName ||
    (authUser?.email ? authUser.email.split('@')[0] : 'Visitante (Local)');
  const displayEmail =
    authUser?.email || registeredEmail || 'Faça login para compartilhar abas';
  const initials = getInitials(authUser?.displayName, authUser?.email);

  return (
    <div className="absolute inset-0 z-50 flex select-none overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer content */}
      <div className="relative w-4/5 max-w-[285px] h-full bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200 text-left">
        {/* Header with Official Brand Blue Branding & Logo & User Profile */}
        <div className="bg-[#1D86C4] text-white p-4 pt-5 text-left">
          <div className="flex items-center justify-between mb-3">
            <PostLogo size="sm" />

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/15 active:bg-white/25 text-white cursor-pointer"
              title="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2.5 mt-2">
            {authUser?.photoURL ? (
              <img
                src={authUser.photoURL}
                alt={displayName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full ring-2 ring-white/50 object-cover shrink-0 bg-white"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white text-[#1D86C4] ring-2 ring-white/40 flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1 text-left">
              <h2 className="font-bold text-xs leading-tight text-white truncate text-left">
                {displayName}
              </h2>
              <p className="text-[10px] text-white/85 truncate text-left">
                {displayEmail}
              </p>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2 bg-black/15 px-2.5 py-1.5 rounded text-left">
            <div className="flex items-center gap-1.5 text-[10px] text-white font-medium min-w-0">
              <CloudCheck className="w-3.5 h-3.5 text-[#FEE725] shrink-0" />
              <span className="truncate text-left">
                {authUser ? 'Conectado (Firebase Ativo)' : 'Modo Local (Offline)'}
              </span>
            </div>

            {authUser && onLogout ? (
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/15 hover:bg-rose-600 text-white text-[10px] font-bold transition-colors cursor-pointer shrink-0"
                title="Sair da conta atual (Logout)"
              >
                <LogOut className="w-3 h-3" />
                <span>Sair</span>
              </button>
            ) : (
              onSignInGoogle && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSignInGoogle();
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FEE725] hover:bg-yellow-300 text-slate-900 text-[10px] font-extrabold transition-colors cursor-pointer shrink-0"
                >
                  <LogIn className="w-3 h-3" />
                  <span>Entrar</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Pending Shared Invites Alert inside Drawer */}
        {pendingInvitesCount > 0 && onOpenPendingInvites && (
          <div className="p-2.5 bg-amber-50 border-b border-amber-200">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPendingInvites();
              }}
              className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-100/90 hover:bg-amber-200/80 text-amber-950 text-xs font-bold cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="w-4 h-4 text-amber-700 shrink-0 animate-bounce" />
                <span className="truncate text-left">Convites de Abas Pendentes</span>
              </div>
              <span className="px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-extrabold shrink-0">
                {pendingInvitesCount}
              </span>
            </button>
          </div>
        )}

        {/* Navigation List (Mural tabs removed from drawer per user request) */}
        <div className="flex-1 overflow-y-auto py-2 divide-y divide-slate-100 text-left">
          <div className="px-2 py-2 space-y-0.5">
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">
              Organização
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLens && onOpenLens();
              }}
              className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-sky-950 bg-sky-50/90 hover:bg-sky-100 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
                <Camera className="w-4 h-4 text-[#1D86C4] shrink-0" />
                <span className="text-left leading-snug">Post+ Lens (Foto & IA)</span>
              </div>
              <span className="text-[9px] bg-[#FEE725] text-slate-900 px-1.5 py-0.5 rounded font-extrabold uppercase shrink-0">
                Gemini
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onAddNewTab();
              }}
              className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-[#125882] hover:bg-sky-50 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-[#1D86C4] shrink-0" />
              <span className="text-left leading-snug">Criar Nova Aba / Categoria</span>
            </button>
            {onOpenAccountsModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAccountsModal();
                }}
                className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-sky-50 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
                  <CloudCheck className="w-4 h-4 text-[#1D86C4] shrink-0" />
                  <span className="text-left leading-snug">Contas Google & Drive</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-[#125882] font-bold tabular-nums shrink-0">
                  {googleAccountsCount}
                </span>
              </button>
            )}
            {onOpenDrivePortal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDrivePortal();
                }}
                className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[#0D3B66] bg-amber-50/70 hover:bg-amber-100/80 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
                  <HardDrive className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-left leading-snug">Portal Google Drive (Post+/)</span>
                </div>
                <span className="text-[9px] bg-amber-200/80 text-amber-950 px-1.5 py-0.5 rounded font-extrabold uppercase shrink-0">
                  Portal
                </span>
              </button>
            )}
            {onOpenOnboardingModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenOnboardingModal();
                }}
                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-amber-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-left leading-snug">Cadastro & Estilo por E-mail</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onClose();
                onTogglePinnedOnly?.();
              }}
              className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                showPinnedOnly
                  ? 'bg-amber-100 text-amber-950 font-bold'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
                <Pin className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-left leading-snug">Notas Fixadas</span>
              </div>
              {showPinnedOnly && (
                <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-600 text-white font-bold shrink-0">
                  Ativo
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTrash?.();
              }}
              className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
                <Trash2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-left leading-snug">Lixeira / Notas Excluídas</span>
              </div>
              {trashedCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold tabular-nums shrink-0">
                  {trashedCount}
                </span>
              )}
            </button>
          </div>

          <div className="px-2 py-2 space-y-0.5">
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">
              Aplicativo & Conta
            </div>
            <PWAInstallButton variant="drawer" onAction={onClose} />
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenMonetization && onOpenMonetization();
              }}
              className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
                <span className="w-4 h-4 flex items-center justify-center text-amber-500 font-bold text-sm shrink-0">📢</span>
                <span className="text-left leading-snug">Letreiro &amp; Link do Dia</span>
              </div>
              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold shrink-0">
                {authUser?.email?.toLowerCase() === 'thiagocfraga86@gmail.com' ? 'Admin' : 'Info'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-left leading-snug">Configurações</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onShareApp?.();
              }}
              className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-left leading-snug">Compartilhar Aplicativo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenHelp?.();
              }}
              className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-left leading-snug">Ajuda & Suporte</span>
            </button>

            {/* Dedicated Logout / Login Button on Left Drawer */}
            {authUser && onLogout ? (
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 mt-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="text-left leading-snug">Sair da Conta (Logout)</span>
              </button>
            ) : (
              onSignInGoogle && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSignInGoogle();
                  }}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 mt-1 rounded-lg text-xs font-bold text-[#125882] bg-sky-50 hover:bg-sky-100 cursor-pointer transition-colors"
                >
                  <LogIn className="w-4 h-4 text-[#1D86C4] shrink-0" />
                  <span className="text-left leading-snug">Entrar com Conta Google</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-500 flex items-center justify-between">
          <span className="font-bold text-[#1D86C4]">Post+ v{CURRENT_APP_VERSION}</span>
          <span>Português (Brasil)</span>
        </div>
      </div>
    </div>
  );
};
