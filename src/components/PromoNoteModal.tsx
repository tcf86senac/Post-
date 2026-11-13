import React from 'react';
import {
  DailyPromo,
  ColorPaletteStyle,
  NoteFontStyle,
  PenColor,
} from '../types';
import { X, ExternalLink, Sparkles, SlidersHorizontal } from 'lucide-react';
import { PushPin } from './PushPin';
import { getNoteColorConfig } from '../data/noteColors';
import { getFontOption, getReadablePenHex } from '../data/penStyles';
import { normalizeExternalUrl } from '../services/dailyPromoService';

interface PromoNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  promo: DailyPromo;
  colorPalette?: ColorPaletteStyle;
  fontStyle?: NoteFontStyle;
  penColor?: PenColor;
  isAdmin?: boolean;
  onOpenAdminEditor?: () => void;
}

const getSafeHostname = (rawUrl: string): string => {
  try {
    const url = new URL(normalizeExternalUrl(rawUrl));
    return url.hostname.replace(/^www\./, '');
  } catch {
    return rawUrl;
  }
};

export const PromoNoteModal: React.FC<PromoNoteModalProps> = ({
  isOpen,
  onClose,
  promo,
  colorPalette = 'vibrant',
  fontStyle = 'handwriting',
  penColor = 'blue',
  isAdmin = false,
  onOpenAdminEditor,
}) => {
  if (!isOpen) return null;

  const paper = getNoteColorConfig(promo.noteColor || 'yellow', colorPalette);
  const font = getFontOption(fontStyle);
  const inkHex = getReadablePenHex(penColor, promo.noteColor || 'yellow');
  const safeUrl = normalizeExternalUrl(promo.targetUrl);
  const hostname = getSafeHostname(safeUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={promo.title}
        className={`relative w-full max-w-sm rounded-[6px] border ${paper.bgClass} ${paper.borderClass} note-paper note-soft-shadow pt-7 pb-4 px-5 flex flex-col gap-3 animate-in zoom-in-95 duration-150 text-left`}
      >
        {/* 3D PushPin matching real Post+ cards */}
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <PushPin color="yellow" size="md" />
        </div>

        {/* Top Row: Honest Sponsored/Partner badge + Close button */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/10 text-slate-900 text-[10px] font-black uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-[#1D86C4]" />
            <span>Patrocinado · {promo.sponsorName || 'Destaque do Dia'}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Fechar nota"
            className="p-1 rounded-full hover:bg-black/10 text-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Promo Note Title & Description in the user's Post+ typography */}
        <div className="space-y-2 py-1">
          <h3
            className={`${font.titleSizeClass} font-bold leading-snug`}
            style={{ color: inkHex, fontFamily: font.fontFamily }}
          >
            {promo.title}
          </h3>
          {promo.priceLabel && (
            <div className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-700/15 text-emerald-950 text-xs font-extrabold border border-emerald-700/20">
              {promo.priceLabel}
            </div>
          )}
          {promo.description && (
            <p
              className={`${font.bodySizeClass} leading-relaxed whitespace-pre-wrap opacity-95`}
              style={{ color: inkHex, fontFamily: font.fontFamily }}
            >
              {promo.description}
            </p>
          )}
        </div>

        {/* Link Preview & 2nd-Click Optional CTA */}
        <div className="pt-2 border-t border-black/10 space-y-2.5">
          <div className="text-[10.5px] font-semibold text-slate-800/80 flex items-center justify-between gap-2">
            <span className="truncate">Destino: {hostname}</span>
            <span className="shrink-0 text-[9.5px] uppercase tracking-wider font-bold opacity-75">
              2º clique opcional
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1D86C4] hover:bg-[#166FA3] text-white text-xs font-extrabold shadow-sm transition-colors"
            >
              <span>{promo.ctaLabel || 'Acessar Promoção'}</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-white/65 hover:bg-white/90 text-slate-800 text-xs font-bold border border-black/10 cursor-pointer transition-colors"
            >
              Fechar
            </button>
          </div>

          {isAdmin && onOpenAdminEditor && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAdminEditor();
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-black/8 hover:bg-black/15 text-slate-900 text-[11px] font-bold cursor-pointer transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Editar Letreiro & Link do Dia (Admin)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
