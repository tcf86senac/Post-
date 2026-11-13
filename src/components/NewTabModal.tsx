import React, { useState } from 'react';
import { CategoryTab, GoogleAccount } from '../types';
import { X, FolderPlus, Users, KeyRound, Sparkles, Cloud } from 'lucide-react';

interface NewTabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTab: (newTab: CategoryTab) => void;
  googleAccounts?: GoogleAccount[];
  onOpenAccountsModal?: () => void;
}

export const NewTabModal: React.FC<NewTabModalProps> = ({
  isOpen,
  onClose,
  onAddTab,
  googleAccounts = [],
  onOpenAccountsModal,
}) => {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [label, setLabel] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [partnerEmail, setPartnerEmail] = useState('');
  const [linkedGoogleEmail, setLinkedGoogleEmail] = useState(
    googleAccounts[0]?.email || ''
  );
  const [shareCodeInput, setShareCodeInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleJoinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = shareCodeInput.trim().toUpperCase().replace(/.*\/CONVITE\//i, '');
    if (!cleanCode) {
      setJoinError('Por favor, informe o código do convite.');
      return;
    }

    // Determine tab label from code or default
    let tabName = 'COMPARTILHADA';
    if (cleanCode.includes('FAM') || cleanCode.includes('FAMILIA')) {
      tabName = 'FAMÍLIA';
    } else if (cleanCode.includes('TRAB')) {
      tabName = 'TRABALHO';
    } else {
      const parts = cleanCode.split('-');
      if (parts.length >= 2 && parts[1].length > 2) {
        tabName = parts[1];
      }
    }

    const tabId = tabName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const joinedTab: CategoryTab = {
      id: tabId,
      label: tabName,
      isShared: true,
      shareCode: cleanCode,
      linkedGoogleEmail: linkedGoogleEmail || googleAccounts[0]?.email,
      sharedWith: [
        {
          name: 'Esposa / Parceiro(a)',
          email: 'parceiro@gmail.com',
          role: 'editor',
        },
        {
          name: 'Thiago Fraga (Você)',
          email: 'thiagocfraga86@gmail.com',
          role: 'editor',
        },
      ],
    };

    onAddTab(joinedTab);
    setShareCodeInput('');
    setJoinError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    const id = label.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    const newTab: CategoryTab = {
      id: id || `aba-${Date.now()}`,
      label: label.trim().toUpperCase(),
      isShared,
      linkedGoogleEmail: linkedGoogleEmail || googleAccounts[0]?.email,
      shareCode: isShared ? `TAB-${id.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}` : undefined,
      sharedWith: isShared
        ? [
            {
              name: 'Thiago Fraga (Você)',
              email: 'thiagocfraga86@gmail.com',
              role: 'editor',
            },
            ...(partnerEmail.trim()
              ? [
                  {
                    name: partnerEmail.split('@')[0],
                    email: partnerEmail.trim(),
                    role: 'editor' as const,
                  },
                ]
              : []),
          ]
        : undefined,
    };

    onAddTab(newTab);
    setLabel('');
    setIsShared(false);
    setPartnerEmail('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-[#1D86C4] text-white">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-sky-100" />
            <h3 className="text-xs font-bold leading-tight">
              {mode === 'create' ? 'Nova Aba no Mural' : 'Entrar em Aba com Código'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab mode selector */}
        <div className="grid grid-cols-2 bg-slate-100 p-1 border-b border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`py-1.5 font-bold rounded-md transition-colors cursor-pointer ${
              mode === 'create'
                ? 'bg-white text-[#1D86C4] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Criar Nova
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`py-1.5 font-bold rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'join'
                ? 'bg-white text-[#1D86C4] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Entrar com Código</span>
          </button>
        </div>

        {/* Form Create */}
        {mode === 'create' ? (
          <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Nome da Categoria / Aba
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: FAMÍLIA, ESTUDOS, PROJETOS..."
                className="w-full px-3 py-2 text-xs font-semibold uppercase text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Compartilhar esta aba
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShared(!isShared)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    isShared ? 'bg-purple-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isShared ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {isShared && (
                <div className="pt-2 border-t border-slate-200 space-y-1.5 animate-in fade-in duration-150">
                  <label className="block text-[10px] font-semibold text-slate-600">
                    Convidar por e-mail (Ex: esposa@gmail.com):
                  </label>
                  <input
                    type="email"
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                    placeholder="esposa@gmail.com"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-600"
                  />
                </div>
              )}
            </div>

            {/* Vincular Conta Google Drive à Aba */}
            <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-[#1D86C4]" />
                  <span className="text-xs font-bold text-slate-800">
                    Google Drive da Aba
                  </span>
                </div>
                {onOpenAccountsModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAccountsModal();
                    }}
                    className="text-[10px] font-bold text-[#125882] hover:underline cursor-pointer"
                  >
                    + Contas Google
                  </button>
                )}
              </div>

              {googleAccounts.length > 0 ? (
                <select
                  value={linkedGoogleEmail || googleAccounts[0]?.email || ''}
                  onChange={(e) => setLinkedGoogleEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-medium bg-white border border-sky-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1D86C4]"
                >
                  {googleAccounts.map((acc) => (
                    <option key={acc.email} value={acc.email}>
                      {acc.label ? `${acc.label} — ` : ''}
                      {acc.email}
                    </option>
                  ))}
                  <option value="">Sem conta vinculada</option>
                </select>
              ) : (
                <p className="text-[10.5px] text-slate-600 leading-snug">
                  Nenhuma conta conectada ainda. Você pode vincular seu Google Drive pessoal ou profissional depois em{' '}
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenAccountsModal) {
                        onClose();
                        onOpenAccountsModal();
                      }
                    }}
                    className="font-bold text-[#125882] underline cursor-pointer"
                  >
                    Contas Google
                  </button>
                  .
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#1D86C4] hover:bg-[#166FA3] rounded-lg cursor-pointer shadow-xs"
              >
                Criar Aba
              </button>
            </div>
          </form>
        ) : (
          /* Form Join */
          <form onSubmit={handleJoinWithCode} className="p-4 space-y-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-950 leading-relaxed flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                Cole o código ou link enviado pelo seu cônjuge ou colega de trabalho para sincronizar o mural imediatamente.
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Código do Convite ou Link
              </label>
              <input
                type="text"
                value={shareCodeInput}
                onChange={(e) => {
                  setShareCodeInput(e.target.value);
                  setJoinError(null);
                }}
                placeholder="Ex: FAM-2026-TF ou postplus.app/convite/..."
                className="w-full px-3 py-2 text-xs font-mono font-semibold uppercase text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              {joinError && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">{joinError}</p>
              )}
            </div>

            {/* Quick Presets */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">
                Sugestões Rápidas:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setShareCodeInput('FAM-2026-TF')}
                  className="px-2 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-mono cursor-pointer"
                >
                  FAM-2026-TF (Aba Família)
                </button>
                <button
                  type="button"
                  onClick={() => setShareCodeInput('TRAB-PROJETOS-99')}
                  className="px-2 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-mono cursor-pointer"
                >
                  TRAB-PROJETOS-99
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Conectar e Abrir</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
