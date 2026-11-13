import React, { useState } from 'react';
import {
  X,
  Cloud,
  ShieldCheck,
  RotateCcw,
  Check,
  PenTool,
  Type,
  Sliders,
  Sparkles,
  Vibrate,
  DatabaseBackup,
  Download,
} from 'lucide-react';
import { UserPreferences, PinColor } from '../types';
import { PushPin } from './PushPin';
import { PEN_OPTIONS, FONT_OPTIONS } from '../data/penStyles';
import { getNoteColorList } from '../data/noteColors';
import { PWAInstallButton } from './PWAInstallButton';
import {
  isHapticsEnabled,
  setHapticsEnabled,
  triggerHapticFeedback,
} from '../utils/haptics';
import {
  CURRENT_APP_VERSION,
  CURRENT_SCHEMA_VERSION,
  getSafetyBackupStatus,
  exportAllAppDataAsJson,
  restoreLatestSafetySnapshot,
} from '../services/appMigrationService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetDemoNotes: () => void;
  cloudSyncEnabled: boolean;
  onToggleCloudSync: (enabled: boolean) => void;
  adsRemoved: boolean;
  onToggleAds: (removed: boolean) => void;
  columnsCount: number;
  onChangeColumnsCount: (cols: number) => void;
  muralTexture: 'neutral' | 'cork';
  onChangeMuralTexture: (texture: 'neutral' | 'cork') => void;
  onOpenMonetization?: () => void;
  onOpenAccountsModal?: () => void;
  onOpenOnboardingModal?: () => void;
  googleAccountsCount?: number;
  userPreferences?: UserPreferences;
  onUpdatePreferences?: (prefs: Partial<UserPreferences>) => void;
}

const PIN_COLOR_OPTIONS: PinColor[] = ['red', 'blue', 'yellow', 'green', 'silver', 'purple'];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onResetDemoNotes,
  cloudSyncEnabled,
  onToggleCloudSync,
  adsRemoved,
  onToggleAds,
  columnsCount,
  onChangeColumnsCount,
  muralTexture,
  onChangeMuralTexture,
  onOpenMonetization,
  onOpenAccountsModal,
  onOpenOnboardingModal,
  googleAccountsCount = 0,
  userPreferences = {
    defaultNoteColor: 'yellow',
    defaultPinColor: 'red',
    defaultPenColor: 'blue',
    defaultFontStyle: 'handwriting',
    colorPalette: 'vibrant',
    colorSelectionMode: 'random',
  },
  onUpdatePreferences,
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [hapticsActive, setHapticsActive] = useState<boolean>(() => isHapticsEnabled());
  const [safetyMsg, setSafetyMsg] = useState<string | null>(null);
  const lastUpgradeMeta = getSafetyBackupStatus();

  if (!isOpen) return null;

  const handleToggleHaptics = () => {
    const next = !hapticsActive;
    setHapticsEnabled(next);
    setHapticsActive(next);
    if (next) {
      triggerHapticFeedback('medium');
    }
  };

  const handleDownloadJsonBackup = () => {
    try {
      const json = exportAllAppDataAsJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `postplus-backup-v${CURRENT_APP_VERSION}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSafetyMsg('Cópia de segurança (.JSON) exportada com todos os seus dados.');
    } catch {
      setSafetyMsg('Não foi possível gerar o arquivo de backup.');
    }
  };

  const handleRestoreSnapshot = async () => {
    const result = await restoreLatestSafetySnapshot();
    if (result.restored) {
      setSafetyMsg(
        `Snapshot pré-atualização restaurado (${result.keysCount} registro(s)). Recarregando...`
      );
      window.setTimeout(() => window.location.reload(), 900);
    } else {
      setSafetyMsg(
        'Nenhum snapshot pré-atualização anterior encontrado ainda (criado automaticamente ao atualizar versões).'
      );
    }
  };

  const activePalette = userPreferences.colorPalette || 'vibrant';
  const activeColorMode = userPreferences.colorSelectionMode || 'random';
  const paletteColors = getNoteColorList(activePalette);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Settings Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-[#1D86C4] text-white">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight">Configurações do Post+</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Fechar Configurações"
            className="p-1 rounded-full hover:bg-white/10 active:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 divide-y divide-slate-100">
          {/* Cloud Sync & Multi-Account Google Drive Section */}
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-[#1D86C4] shrink-0" />
                <div>
                  <h3 className="text-xs font-bold text-slate-800">Contas Google & Nuvem Drive</h3>
                  <p className="text-[11px] text-slate-500">
                    Vincule contas pessoais e profissionais às suas abas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleCloudSync(!cloudSyncEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  cloudSyncEnabled ? 'bg-[#1D86C4]' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    cloudSyncEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {onOpenAccountsModal && (
              <button
                type="button"
                onClick={onOpenAccountsModal}
                className="w-full py-1.5 px-3 text-xs font-bold text-[#125882] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg cursor-pointer transition-colors flex items-center justify-between"
              >
                <span>Gerenciar Contas Google e Pastas por Aba</span>
                <span className="px-1.5 py-0.5 rounded bg-[#1D86C4] text-white text-[10px]">
                  {googleAccountsCount}
                </span>
              </button>
            )}
          </div>

          {/* Install App PWA Section */}
          <div className="pt-3">
            <PWAInstallButton variant="card" />
          </div>

          {/* Mural Texture & Tactile Haptics */}
          <div className="pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h3 className="text-xs font-bold text-slate-800">Estilo de Fundo do Mural</h3>
                <p className="text-[11px] text-slate-500">Mural digital moderno ou cortiça física</p>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => onChangeMuralTexture('neutral')}
                  className={`px-2 py-1 text-xs font-bold rounded cursor-pointer transition-colors ${
                    muralTexture === 'neutral'
                      ? 'bg-[#1D86C4] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Digital
                </button>
                <button
                  type="button"
                  onClick={() => onChangeMuralTexture('cork')}
                  className={`px-2 py-1 text-xs font-bold rounded cursor-pointer transition-colors ${
                    muralTexture === 'cork'
                      ? 'bg-[#1D86C4] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cortiça
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 text-left">
                <Vibrate className="w-4 h-4 text-[#1D86C4] shrink-0" />
                <div>
                  <h3 className="text-xs font-bold text-slate-800">Vibração Tátil nos Cliques</h3>
                  <p className="text-[11px] text-slate-500">
                    Pequena vibração em todos os toques para resposta física.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleHaptics}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  hapticsActive ? 'bg-[#049A35]' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    hapticsActive ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Letreiro & Destaques do Dia (2 Cliques Humanista) */}
          <div className="pt-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-left">
                <ShieldCheck className="w-4 h-4 text-[#1D86C4] shrink-0" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-slate-800">Letreiro &amp; Destaques do Dia</h3>
                    <span className="text-[9px] bg-sky-100 text-[#125882] px-1.5 py-0.2 rounded font-bold">
                      2 Cliques
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Texto corrido discreto no rodapé esquerdo que abre uma Nota apenas se você tocar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleAds(!adsRemoved)}
                title={adsRemoved ? 'Mostrar letreiro do dia' : 'Ocultar letreiro do dia'}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  !adsRemoved ? 'bg-[#1D86C4]' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    !adsRemoved ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {onOpenMonetization && (
              <button
                type="button"
                onClick={onOpenMonetization}
                className="w-full mt-1 py-1.5 px-2.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200/80 transition-colors cursor-pointer text-center"
              >
                Gerenciar / Configurar Letreiro &amp; Link do Dia
              </button>
            )}
          </div>

          {/* Configuração Prévia de Novas Notas (Geral) */}
          <div className="pt-3 space-y-3">
            <div className="flex items-start gap-2">
              <Sliders className="w-4 h-4 text-[#1D86C4] shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-slate-800">Criação Rápida de Nota (Padrões)</h3>
                <p className="text-[11px] text-slate-500">
                  Defina a aparência padrão para abrir e escrever na hora ao tocar em "+".
                </p>
              </div>
            </div>

            {/* Aviso de dinamismo */}
            <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/70 text-[10.5px] text-blue-900 leading-relaxed">
              ⚡ <strong>Modo Dinâmico:</strong> Ao clicar no botão de criar nota (+), ele abre imediatamente pronto para você digitar. Não há questionários prévios; todas as escolhas abaixo são aplicadas automaticamente.
            </div>

            {/* Botão para abrir Cadastro & Personalização com prévia ao vivo */}
            {onOpenOnboardingModal && (
              <button
                type="button"
                onClick={onOpenOnboardingModal}
                className="w-full py-2 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-xs font-bold text-[#125882] flex items-center justify-between cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#1D86C4]" />
                  <span>Cadastro & Perfil Visual por E-mail</span>
                </span>
                <span className="text-[10px] font-semibold bg-white px-1.5 py-0.5 rounded border border-sky-200">
                  Abrir
                </span>
              </button>
            )}

            {/* 1. Escolha da Paleta (12 Vibrantes vs 12 Pastel) & Regra de Cor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  Paleta de 12 Cores dos Cards
                </label>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => onUpdatePreferences?.({ colorPalette: 'vibrant' })}
                    className={`px-2 py-0.5 text-[10.5px] font-bold rounded cursor-pointer transition-colors ${
                      activePalette === 'vibrant'
                        ? 'bg-[#1D86C4] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Vibrante
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdatePreferences?.({ colorPalette: 'pastel' })}
                    className={`px-2 py-0.5 text-[10.5px] font-bold rounded cursor-pointer transition-colors ${
                      activePalette === 'pastel'
                        ? 'bg-[#1D86C4] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pastel
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {paletteColors.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onUpdatePreferences?.({ defaultNoteColor: c.id })}
                    title={c.label}
                    className={`w-7 h-7 rounded-full ${c.bgClass} border-2 transition-transform cursor-pointer flex items-center justify-center ${
                      userPreferences.defaultNoteColor === c.id
                        ? 'border-slate-800 scale-110 shadow-xs'
                        : 'border-slate-300 hover:scale-105'
                    }`}
                  >
                    {userPreferences.defaultNoteColor === c.id && (
                      <Check className="w-3.5 h-3.5 text-slate-800 stroke-[3]" />
                    )}
                  </button>
                ))}
              </div>

              {/* Regra de escolha de cor ao criar */}
              <div className="pt-1 space-y-1">
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  Cor ao Criar Nova Nota (+)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onUpdatePreferences?.({ colorSelectionMode: 'random' })}
                    className={`py-1.5 px-2 rounded-lg text-[10.5px] font-bold border cursor-pointer transition-colors ${
                      activeColorMode === 'random'
                        ? 'bg-[#1D86C4] text-white border-[#1D86C4]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Aleatória
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdatePreferences?.({ colorSelectionMode: 'choose' })}
                    className={`py-1.5 px-2 rounded-lg text-[10.5px] font-bold border cursor-pointer transition-colors ${
                      activeColorMode === 'choose'
                        ? 'bg-[#1D86C4] text-white border-[#1D86C4]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Escolher
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdatePreferences?.({ colorSelectionMode: 'fixed' })}
                    className={`py-1.5 px-2 rounded-lg text-[10.5px] font-bold border cursor-pointer transition-colors ${
                      activeColorMode === 'fixed'
                        ? 'bg-[#1D86C4] text-white border-[#1D86C4]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Cor Fixa
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Cor Padrão do Alfinete */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Cor Padrão do Alfinete
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PIN_COLOR_OPTIONS.map((pc) => (
                  <button
                    key={pc}
                    type="button"
                    onClick={() => onUpdatePreferences?.({ defaultPinColor: pc })}
                    title={`Alfinete ${pc}`}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                      userPreferences.defaultPinColor === pc
                        ? 'scale-115 ring-2 ring-[#1D86C4] ring-offset-1 bg-slate-100'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    <PushPin color={pc} size="sm" />
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Cor Padrão da Tinta de Caneta */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <PenTool className="w-3 h-3 text-[#1D86C4]" />
                  Tinta Padrão da Caneta
                </label>
                <span className="text-[10px] text-slate-500 font-medium">
                  {PEN_OPTIONS.find((p) => p.id === userPreferences.defaultPenColor)?.label.split(' (')[0]}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {PEN_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onUpdatePreferences?.({ defaultPenColor: p.id })}
                    title={p.label}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer relative shadow-2xs ${
                      userPreferences.defaultPenColor === p.id
                        ? 'ring-2 ring-offset-2 ring-[#1D86C4] scale-110'
                        : 'hover:scale-105 opacity-90 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: p.inkColor }}
                  >
                    {userPreferences.defaultPenColor === p.id && (
                      <Check className="w-3.5 h-3.5 text-white stroke-[3] drop-shadow-xs" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Estilo de Grafia Humana Padrão */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Type className="w-3 h-3 text-[#1D86C4]" />
                Grafia Humana Padrão
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {FONT_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onUpdatePreferences?.({ defaultFontStyle: f.id })}
                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                      userPreferences.defaultFontStyle === f.id
                        ? 'bg-blue-50/80 border-[#1D86C4] shadow-2xs ring-1 ring-[#1D86C4]'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-0.5">
                      <span className="text-[11px] font-bold text-slate-800 leading-tight">
                        {f.label.split(' (')[0]}
                      </span>
                      <span
                        className={`text-[8.5px] px-1 py-0.2 rounded font-semibold ${
                          userPreferences.defaultFontStyle === f.id
                            ? 'bg-[#1D86C4] text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {f.tag}
                      </span>
                    </div>
                    <span
                      className="text-[11px] truncate block opacity-90"
                      style={{ fontFamily: f.fontFamily }}
                    >
                      {f.previewSample}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid Layout View Columns */}
          <div className="pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800">Disposição no Mural</h3>
                <p className="text-[11px] text-slate-500">Quantidade de notas lado a lado</p>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                {[1, 2, 3].map((cols) => (
                  <button
                    key={cols}
                    type="button"
                    onClick={() => onChangeColumnsCount(cols)}
                    className={`px-2 py-0.5 text-xs font-bold rounded cursor-pointer transition-colors ${
                      columnsCount === cols
                        ? 'bg-[#1D86C4] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cols} col
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Safety Upgrade Guard & Database Preservation */}
          <div className="pt-3 space-y-2 text-left">
            <div className="flex items-start gap-2">
              <DatabaseBackup className="w-4 h-4 text-[#049A35] shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-xs font-bold text-slate-800">
                    Proteção de Dados na Atualização
                  </h3>
                  <span className="text-[9.5px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                    v{CURRENT_APP_VERSION} · Schema v{CURRENT_SCHEMA_VERSION}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Ao instalar uma nova versão do Post+, o sistema detecta o banco anterior, salva um snapshot em IndexedDB e migra suas notas, abas e preferências automaticamente.
                </p>
                {lastUpgradeMeta && (
                  <p className="text-[10.5px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 mt-1.5 font-medium">
                    Última atualização segura: {lastUpgradeMeta.fromVersion || 'Anterior'} → v
                    {lastUpgradeMeta.toVersion} ({lastUpgradeMeta.notesPreserved} notas e{' '}
                    {lastUpgradeMeta.tabsPreserved} abas mantidas)
                  </p>
                )}
              </div>
            </div>

            {safetyMsg && (
              <p className="text-[10.5px] text-[#0D3B66] bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5 font-medium">
                {safetyMsg}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              <button
                type="button"
                onClick={handleDownloadJsonBackup}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-[#125882] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Cópia (.JSON)</span>
              </button>
              <button
                type="button"
                onClick={() => void handleRestoreSnapshot()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Restaurar Snapshot</span>
              </button>
            </div>
          </div>

          {/* Reset Demo Notes */}
          <div className="pt-3 space-y-2 text-left">
            <div>
              <h3 className="text-xs font-bold text-slate-800">Restaurar Notas Iniciais</h3>
              <p className="text-[11px] text-slate-500">
                Restaura as notas originais: Parabéns (Amarelo), Anúncios (Rosa) e Backup (Azul).
              </p>
            </div>
            {showResetConfirm ? (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onResetDemoNotes();
                    setShowResetConfirm(false);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer transition-colors"
                >
                  Confirmar Restauração
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Restaurar Notas Padrão</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#1D86C4] hover:bg-[#166FA3] rounded-lg cursor-pointer transition-colors"
          >
            Salvar e Sair
          </button>
        </div>
      </div>
    </div>
  );
};
