import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, WifiOff, X } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'drawer' | 'card' | 'compact';
  onAction?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'drawer',
  onAction,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      onAction?.();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      {variant === 'drawer' ? (
        <button
          type="button"
          onClick={handleClick}
          className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-[#125882] bg-sky-50 hover:bg-sky-100 cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
            <img
              src="/pwa-192x192.png"
              alt="Ícone Post+"
              className="w-5 h-5 rounded-md shadow-2xs shrink-0"
            />
            <span className="text-left leading-snug">Instalar Post+ no Dispositivo</span>
          </div>
          <Download className="w-3.5 h-3.5 text-[#1D86C4] shrink-0 ml-2" />
        </button>
      ) : variant === 'card' ? (
        <div className="p-3 rounded-xl bg-sky-50/90 border border-sky-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
            <img
              src="/pwa-192x192.png"
              alt="Ícone Post+"
              className="w-9 h-9 rounded-xl shadow-xs shrink-0"
            />
            <div className="min-w-0 text-left">
              <h4 className="text-xs font-bold text-slate-900 text-left leading-tight">
                Instalar Aplicativo Post+
              </h4>
              <p className="text-[11px] text-slate-600 text-left leading-snug">
                Adicione o ícone oficial na tela inicial do celular ou computador.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClick}
            className="px-3 py-1.5 rounded-lg bg-[#1D86C4] hover:bg-[#166FA3] text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Instalar</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          title="Instalar Post+ no dispositivo"
          className="h-8 px-2.5 flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white border border-white/25 transition-all cursor-pointer text-[11px] font-bold shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-[#FFE91F]" />
          <span className="hidden sm:inline">Instalar</span>
        </button>
      )}

      {showGuide && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-[#1D86C4] text-white">
              <div className="flex items-center gap-2.5 text-left">
                <img
                  src="/pwa-192x192.png"
                  alt="Ícone Post+"
                  className="w-7 h-7 rounded-lg bg-white/10 p-0.5 shrink-0"
                />
                <div className="text-left">
                  <h3 className="text-xs font-bold leading-tight text-left">
                    Instalar Post+ na Tela Inicial
                  </h3>
                  <p className="text-[10px] text-white/85 text-left">
                    {isIOS ? 'Passo a passo no iPhone / iPad (Safari)' : 'Atalho rápido de aplicativo'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1 rounded-full hover:bg-white/15 text-white cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-left text-xs text-slate-700">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <img
                  src="/pwa-512x512.png"
                  alt="Ícone oficial Post+"
                  className="w-14 h-14 rounded-2xl shadow-md shrink-0"
                />
                <div className="text-left">
                  <p className="font-bold text-slate-900 text-xs">Post+</p>
                  <p className="text-[11px] text-slate-500">
                    Ícone oficial na tela do seu dispositivo com abertura em tela cheia.
                  </p>
                </div>
              </div>

              {isIOS ? (
                <ol className="space-y-2 text-[11.5px] leading-relaxed text-slate-700 list-decimal pl-4">
                  <li>
                    Toque no botão{' '}
                    <span className="inline-flex items-center gap-1 font-bold text-[#1D86C4]">
                      <Share className="w-3.5 h-3.5" /> Compartilhar
                    </span>{' '}
                    na barra do Safari.
                  </li>
                  <li>
                    Role para baixo e escolha{' '}
                    <span className="inline-flex items-center gap-1 font-bold text-slate-900">
                      <PlusSquare className="w-3.5 h-3.5" /> Adicionar à Tela de Início
                    </span>
                    .
                  </li>
                  <li>
                    Confirme em <strong>Adicionar</strong> no canto superior direito.
                  </li>
                </ol>
              ) : (
                <div className="space-y-2 text-[11.5px] leading-relaxed text-slate-700">
                  <p className="flex items-start gap-2">
                    <Smartphone className="w-4 h-4 text-[#1D86C4] shrink-0 mt-0.5" />
                    <span>
                      No Chrome / Edge (Android ou Desktop), abra o menu do navegador (<strong>⋮</strong>) e toque em{' '}
                      <strong>&ldquo;Instalar aplicativo&rdquo;</strong> ou{' '}
                      <strong>&ldquo;Adicionar à tela inicial&rdquo;</strong>.
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#1D86C4] hover:bg-[#166FA3] rounded-lg cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-full bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Modo Offline — Dados em cache local</span>
    </div>
  );
};
