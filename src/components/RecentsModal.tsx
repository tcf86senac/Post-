import React from 'react';
import { X, Check } from 'lucide-react';
import { PostLogo } from './PostLogo';

interface RecentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTabName: string;
}

export const RecentsModal: React.FC<RecentsModalProps> = ({
  isOpen,
  onClose,
  activeTabName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col justify-between p-6 select-none animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between text-white/80">
        <span className="text-xs font-semibold tracking-wider uppercase">Aplicativos Recentes</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full hover:bg-white/10 text-white cursor-pointer"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* App Cards Carousel / Preview */}
      <div className="my-auto space-y-4">
        {/* MultiNotes App Card */}
        <div
          onClick={onClose}
          className="bg-white rounded-2xl p-4 shadow-2xl border border-white/20 cursor-pointer transform hover:scale-[1.02] transition-transform"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="bg-[#1D86C4] px-2 py-1 rounded-lg">
              <PostLogo size="sm" />
            </div>
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
              <Check className="w-2.5 h-2.5" />
              Ativo ({activeTabName})
            </span>
          </div>
          <div className="mt-3 h-28 bg-[#F5F5F5] rounded-lg p-2.5 flex items-center justify-center text-center">
            <span className="text-xs font-medium text-slate-500">
              Toque para retomar o mural do Post+
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Action: Close / Clear All */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold tracking-wide border border-white/15 cursor-pointer transition-colors"
        >
          Retornar ao Post+
        </button>
      </div>
    </div>
  );
};
