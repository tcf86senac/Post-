import React, { useState } from 'react';
import { Camera, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react';

interface FloatingActionButtonProps {
  onClick: () => void;
  onOpenLens?: () => void;
  onScrollUp?: () => void;
  onScrollDown?: () => void;
  inlineDock?: boolean;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onClick,
  onOpenLens,
  onScrollUp,
  onScrollDown,
  inlineDock = false,
}) => {
  const [isScrollOpen, setIsScrollOpen] = useState(false);

  return (
    <div
      className={
        inlineDock
          ? 'relative pointer-events-none shrink-0 select-none'
          : 'fixed bottom-5 right-4 sm:right-6 pointer-events-none z-30 select-none'
      }
    >
      <div className="pointer-events-auto flex items-end gap-2 sm:gap-2.5">
        {/* 1. CRUZ: Yellow note card with discontinuous green cross */}
        <button
          type="button"
          onClick={onClick}
          title="Criar nova nota no mural"
          aria-label="Criar nova nota"
          className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-white text-[#1D86C4] fab-shadow hover:shadow-xl active:scale-95 hover:scale-105 transition-all duration-200 flex items-center justify-center cursor-pointer border border-slate-100 group focus:outline-none focus:ring-2 focus:ring-[#1D86C4] focus:ring-offset-2"
        >
          <div className="relative w-6 h-6 flex items-center justify-center">
            <div className="absolute top-[2px] right-[2px] w-[17px] h-[19px] border-[1.8px] border-slate-300 rounded-[3px] bg-slate-100 -rotate-3 transition-transform group-hover:-rotate-6" />

            <div className="relative w-[21px] h-[23px] border-[1.8px] border-[#1D86C4] rounded-[3px] bg-[#FEE725] flex items-center justify-center shadow-xs">
              <svg
                className="w-3.5 h-3.5 overflow-visible"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle cx="12" cy="4" r="1.7" fill="#049A35" />
                <rect x="10.8" y="7.5" width="2.4" height="12.5" rx="1.2" fill="#049A35" />
                <rect x="4.5" y="11.5" width="15" height="2.4" rx="1.2" fill="#049A35" />
              </svg>
            </div>
          </div>
        </button>

        {/* 2. CAMERA + IA: Compact AI Camera button */}
        {onOpenLens && (
          <button
            type="button"
            onClick={onOpenLens}
            title="Post+ Lens: Foto e leitura com IA"
            aria-label="Câmera Post+ Lens com IA"
            className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#1D86C4] hover:bg-[#166FA3] text-white fab-shadow hover:shadow-xl active:scale-95 hover:scale-105 transition-all duration-200 flex items-center justify-center cursor-pointer border border-sky-300/40 group focus:outline-none focus:ring-2 focus:ring-[#1D86C4]"
          >
            <Camera className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
            <span className="absolute -top-1 -right-1 bg-[#FEE725] text-slate-900 text-[8.5px] font-black px-1.5 py-0.2 rounded-full shadow-xs border border-white">
              IA
            </span>
          </button>
        )}

        {/* 3. SCROLL: Scroll button revealing Up and Down arrows directly above it */}
        <div className="flex flex-col items-center gap-2">
          {isScrollOpen && (
            <div className="flex flex-col items-center gap-2 mb-1 animate-in slide-in-from-bottom-2 fade-in duration-200">
              <button
                type="button"
                onClick={onScrollUp}
                title="Rolar para cima"
                aria-label="Rolar mural para cima"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#1D86C4] hover:bg-[#166FA3] text-white shadow-lg active:scale-90 hover:scale-105 transition-all flex items-center justify-center cursor-pointer border border-white/50"
              >
                <ChevronUp className="w-5 h-5 stroke-[2.5]" />
              </button>

              <button
                type="button"
                onClick={onScrollDown}
                title="Rolar para baixo"
                aria-label="Rolar mural para baixo"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#1D86C4] hover:bg-[#166FA3] text-white shadow-lg active:scale-90 hover:scale-105 transition-all flex items-center justify-center cursor-pointer border border-white/50"
              >
                <ChevronDown className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsScrollOpen(!isScrollOpen)}
            title={isScrollOpen ? 'Fechar controles de rolagem' : 'Controles de rolagem (cima/baixo)'}
            aria-label="Controles de rolagem"
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-md active:scale-95 hover:scale-105 transition-all duration-200 flex items-center justify-center cursor-pointer border ${
              isScrollOpen
                ? 'bg-slate-800 text-white border-slate-700'
                : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
            }`}
          >
            {isScrollOpen ? (
              <X className="w-5 h-5 stroke-[2.2]" />
            ) : (
              <ChevronsUpDown className="w-5 h-5 stroke-[2.2] text-[#1D86C4]" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
