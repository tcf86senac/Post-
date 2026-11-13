import React, { useState } from 'react';
import { TabInviteRecord } from '../types';
import { X, Users, Check, Ban, Loader2, Shield } from 'lucide-react';

interface PendingInvitesModalProps {
  isOpen: boolean;
  onClose: () => void;
  invites: TabInviteRecord[];
  onAcceptInvite: (invite: TabInviteRecord) => Promise<void>;
  onDeclineInvite: (invite: TabInviteRecord) => Promise<void>;
}

export const PendingInvitesModal: React.FC<PendingInvitesModalProps> = ({
  isOpen,
  onClose,
  invites,
  onAcceptInvite,
  onDeclineInvite,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAction = async (
    invite: TabInviteRecord,
    action: 'accept' | 'decline'
  ) => {
    setErrorMsg(null);
    setBusyId(invite.id);
    try {
      if (action === 'accept') {
        await onAcceptInvite(invite);
      } else {
        await onDeclineInvite(invite);
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Não foi possível processar o convite agora. Tente novamente.'
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150 text-left"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-[#1D86C4] text-white">
          <div className="flex items-center gap-2 min-w-0 text-left">
            <Users className="w-4 h-4 text-[#FEE725] shrink-0" />
            <div className="min-w-0 text-left">
              <h3 className="text-xs font-bold leading-tight text-left">
                Convites de Abas Compartilhadas
              </h3>
              <p className="text-[10px] text-white/85 truncate text-left">
                Aceite para conectar a aba ao seu mural Post+
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/15 text-white cursor-pointer shrink-0"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar text-left">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium text-left">
              {errorMsg}
            </div>
          )}

          {invites.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              Nenhum convite pendente no momento.
            </div>
          ) : (
            invites.map((invite) => {
              const isBusy = busyId === invite.id;
              return (
                <div
                  key={invite.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 text-left">
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 mb-1">
                        Aba: {invite.tabLabel}
                      </span>
                      <p className="text-xs font-bold text-slate-900 text-left">
                        {invite.inviterName} convidou você
                      </p>
                      <p className="text-[11px] text-slate-500 truncate text-left">
                        {invite.inviterEmail}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-700 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                    <Shield className="w-3.5 h-3.5 text-[#1D86C4] shrink-0" />
                    <span>
                      Permissão:{' '}
                      <strong>
                        {invite.role === 'editor'
                          ? 'Editor (criar notas, editar e comentar)'
                          : 'Leitor (visualizar e comentar)'}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAction(invite, 'accept')}
                      className="flex-1 py-2 px-3 rounded-lg bg-[#049A35] hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      )}
                      <span>Aceitar Aba</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAction(invite, 'decline')}
                      className="py-2 px-3 rounded-lg bg-slate-200 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-60 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Recusar</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
