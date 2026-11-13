import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { CategoryTab, SharedMember, TabInviteRecord } from '../types';
import {
  X,
  Users,
  UserPlus,
  Copy,
  Check,
  Trash2,
  Cloud,
  Mail,
  Clock,
  Ban,
  LogIn,
  Loader2,
} from 'lucide-react';

interface ShareTabModalProps {
  isOpen: boolean;
  onClose: () => void;
  tab: CategoryTab | null;
  authUser: User | null;
  sentInvites: TabInviteRecord[];
  onSignInGoogle: () => Promise<void> | void;
  onUpdateTabSharing: (
    tabId: string,
    isShared: boolean,
    members: SharedMember[],
    shareCode: string
  ) => void;
  onInviteEmail: (
    tab: CategoryTab,
    inviteeEmail: string,
    inviteeName: string,
    role: 'editor' | 'viewer'
  ) => Promise<void>;
  onRevokeParticipant: (tab: CategoryTab, email: string) => Promise<void>;
}

export const ShareTabModal: React.FC<ShareTabModalProps> = ({
  isOpen,
  onClose,
  tab,
  authUser,
  sentInvites,
  onSignInGoogle,
  onUpdateTabSharing,
  onInviteEmail,
  onRevokeParticipant,
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [roleInput, setRoleInput] = useState<'editor' | 'viewer'>('editor');
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !tab) return null;

  const isShared = tab.isShared ?? false;
  const currentUserEmail = authUser?.email?.toLowerCase() || '';
  const isOwner =
    !tab.ownerUid || !authUser || tab.ownerUid === authUser.uid;

  const members: SharedMember[] = tab.sharedWith || (authUser?.email
    ? [
        {
          name: authUser.displayName || authUser.email.split('@')[0],
          email: authUser.email,
          role: 'editor',
          status: 'accepted',
        },
      ]
    : []);

  const shareCode =
    tab.shareCode || `SHARE-${tab.id.toUpperCase().slice(0, 10)}-2026`;

  // Filter sent invites for this tab (checking both firestoreId and local tabId)
  const tabInvites = sentInvites.filter(
    (inv) =>
      inv.tabDocId === tab.firestoreId ||
      inv.tabDocId === tab.id ||
      inv.tabId === tab.id
  );

  const handleToggleShare = () => {
    const nextShared = !isShared;
    onUpdateTabSharing(tab.id, nextShared, members, shareCode);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMessage(null);

    const normalizedEmail = emailInput.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setErrorMsg('Informe um endereço de e-mail válido.');
      return;
    }

    if (authUser?.email && normalizedEmail === authUser.email.toLowerCase()) {
      setErrorMsg('Você já é o proprietário desta aba.');
      return;
    }

    const displayName = nameInput.trim() || normalizedEmail.split('@')[0];

    setIsSubmitting(true);
    try {
      await onInviteEmail(tab, normalizedEmail, displayName, roleInput);
      setStatusMessage(
        `Convite registrado para ${normalizedEmail}. Ao entrar no Post+, a pessoa verá o aviso para aceitar ou recusar.`
      );
      setEmailInput('');
      setNameInput('');
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Não foi possível enviar o convite. Tente novamente.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveParticipant = async (email: string) => {
    setErrorMsg(null);
    try {
      await onRevokeParticipant(tab, email);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao remover participante.');
    }
  };

  const inviteUrl = `${window.location.origin}/?tab=${encodeURIComponent(tab.id)}&convite=${encodeURIComponent(shareCode)}`;

  const handleCopyInvite = () => {
    const text = `Oi! Compartilhei a aba "${tab.label}" com você no Post+. Entre no aplicativo com seu e-mail para aceitar o convite: ${inviteUrl}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const buildMailtoHref = (inviteeEmail: string, inviteeName: string) => {
    const subject = encodeURIComponent(
      `Convite Post+: Aba compartilhada "${tab.label}"`
    );
    const body = encodeURIComponent(
      `Olá ${inviteeName},\n\nCompartilhei a aba "${tab.label}" com você no Post+!\n\nPara conectar automaticamente na sua tela, acesse o Post+ (${window.location.origin}) com seu e-mail ${inviteeEmail} e toque em "Aceitar Aba" no aviso de convite.\n\nCódigo do convite: ${shareCode}`
    );
    return `mailto:${encodeURIComponent(inviteeEmail)}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 text-left"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-[#1D86C4] text-white">
          <div className="flex items-center gap-2 min-w-0 text-left">
            <Users className="w-4 h-4 text-[#FEE725] shrink-0" />
            <div className="min-w-0 text-left">
              <h3 className="text-xs font-bold leading-tight truncate text-left">
                Compartilhar Aba: {tab.label}
              </h3>
              <p className="text-[10px] text-white/85 truncate text-left">
                Vínculo semiautomático com aceite do convidado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 active:bg-white/20 text-white cursor-pointer shrink-0"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 custom-scrollbar text-left">
          {!authUser && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-left">
              <p className="text-xs font-bold text-amber-950 text-left">
                Conecte sua conta Google para compartilhar em tempo real
              </p>
              <p className="text-[11px] text-amber-800 leading-relaxed text-left">
                Para que o convite apareça no Post+ de outro e-mail e sincronize as notas e comentários entre celulares, faça login primeiro.
              </p>
              <button
                type="button"
                onClick={() => onSignInGoogle()}
                className="w-full py-2 px-3 rounded-lg bg-[#1D86C4] hover:bg-[#166FA3] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Entrar com Conta Google</span>
              </button>
            </div>
          )}

          {/* Toggle Sharing */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-left">
              <span className="text-xs font-bold text-slate-800 block text-left">
                Compartilhamento da Aba
              </span>
              <p className="text-[11px] text-slate-500 text-left">
                {isShared
                  ? 'Ativo · participantes aceitos veem e comentam'
                  : 'Desativado (somente você vê esta aba)'}
              </p>
            </div>
            <button
              type="button"
              disabled={!isOwner}
              onClick={handleToggleShare}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-50 ${
                isShared ? 'bg-[#049A35]' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isShared ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Sync Information */}
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200/80 text-[11px] text-emerald-950 leading-relaxed text-left">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900 mb-0.5 text-left">
              <Cloud className="w-3.5 h-3.5 text-[#049A35] shrink-0" />
              <span>Como funciona o convite semiautomático</span>
            </div>
            <p className="text-[10.5px] text-emerald-800 text-left">
              Ao convidar um e-mail, a outra pessoa recebe um aviso dentro do Post+ dela e decide se deseja <strong>Aceitar</strong> ou <strong>Recusar</strong>. Depois de aceitar, ela passa a postar e comentar nas notas desta aba!
            </p>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-medium text-left">
              {errorMsg}
            </div>
          )}

          {statusMessage && (
            <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-[11px] font-medium text-left">
              {statusMessage}
            </div>
          )}

          {/* Invite Code / Link */}
          {isShared && (
            <div className="space-y-1.5 text-left">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider text-left">
                Link / Código do Convite
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareCode}
                  className="flex-1 px-2.5 py-1.5 text-xs bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-mono select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="px-2.5 py-1.5 text-xs font-semibold text-white bg-[#1D86C4] hover:bg-[#166FA3] rounded-lg cursor-pointer flex items-center gap-1 transition-colors shrink-0"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-[#FEE725]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Add Member Form */}
          {authUser && isOwner && (
            <form
              onSubmit={handleAddMember}
              className="space-y-2 pt-2 border-t border-slate-100 text-left"
            >
              <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider text-left">
                Convidar por E-mail
              </span>
              <div className="space-y-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Nome (ex: Esposa)"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1D86C4]"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="E-mail Google (ex: pessoa@gmail.com)"
                    className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1D86C4]"
                  />
                  <select
                    value={roleInput}
                    onChange={(e) =>
                      setRoleInput(e.target.value as 'editor' | 'viewer')
                    }
                    className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="editor">Pode editar</option>
                    <option value="viewer">Apenas ver</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2 text-xs font-bold text-white bg-[#049A35] hover:bg-emerald-700 disabled:opacity-60 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5" />
                  )}
                  <span>Enviar Convite</span>
                </button>
              </div>
            </form>
          )}

          {/* Sent Invites Status List */}
          {tabInvites.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100 text-left">
              <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider text-left">
                Convites Enviados ({tabInvites.length})
              </span>
              <div className="space-y-1.5">
                {tabInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-2 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1.5 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-xs font-semibold text-slate-800 truncate text-left">
                          {inv.inviteeName}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate text-left">
                          {inv.inviteeEmail} ·{' '}
                          {inv.role === 'editor' ? 'Editor' : 'Leitor'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {inv.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                            <Clock className="w-2.5 h-2.5" />
                            Pendente
                          </span>
                        )}
                        {inv.status === 'accepted' && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                            <Check className="w-2.5 h-2.5" />
                            Aceito
                          </span>
                        )}
                        {inv.status === 'declined' && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-bold">
                            <Ban className="w-2.5 h-2.5" />
                            Recusado
                          </span>
                        )}

                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(inv.inviteeEmail)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Remover convite/participante"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {inv.status === 'pending' && (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200/70">
                        <a
                          href={buildMailtoHref(inv.inviteeEmail, inv.inviteeName)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1D86C4] hover:underline"
                        >
                          <Mail className="w-3 h-3" />
                          <span>Avisar por E-mail</span>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confirmed Members List */}
          <div className="space-y-2 pt-2 border-t border-slate-100 text-left">
            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider text-left">
              Participantes Conectados ({members.length})
            </span>
            <div className="space-y-1.5">
              {members.map((member) => {
                const isMemberOwner =
                  (tab.ownerEmail &&
                    member.email.toLowerCase() === tab.ownerEmail.toLowerCase()) ||
                  member.email.toLowerCase() === currentUserEmail;
                return (
                  <div
                    key={member.email}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200/80"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
                      <div className="w-7 h-7 rounded-full bg-sky-100 text-[#125882] font-bold text-xs flex items-center justify-center shrink-0">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-xs font-semibold text-slate-800 truncate text-left">
                          {member.name}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate text-left">
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                        {member.role === 'editor' ? 'Editor' : 'Leitor'}
                      </span>
                      {isOwner && !isMemberOwner && (
                        <button
                          type="button"
                          onClick={() => handleRemoveParticipant(member.email)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          title="Remover participante"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
