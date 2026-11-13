import React from 'react';
import { DailyPromo } from '../types';
import { Sparkles, ChevronRight } from 'lucide-react';

interface BottomPromoTickerProps {
  promo: DailyPromo;
  hidden?: boolean;
  onOpenPromo: () => void;
}

export const BottomPromoTicker: React.FC<BottomPromoTickerProps> = ({
  promo,
  hidden = false,
  onOpenPromo,
}) => {
  if (hidden || !promo.isActive || !promo.tickerText.trim()) {
    return null;
  }

  const displayText = promo.tickerText.trim();

  return (
    <div className="w-full max-w-[440px] min-w-0 select-none pointer-events-auto">
      <button
        type="button"
        onClick={onOpenPromo}
        title="Toque para abrir este destaque em uma Nota"
        aria-label={`Destaque do dia: ${displayText}`}
        className="w-full h-11 sm:h-12 flex items-center gap-2 bg-[#FFF6C7] hover:bg-[#FFF1AD] active:scale-[0.99] text-[#0D3B66] border border-[#E6C235]/80 rounded-2xl px-2 sm:px-2.5 shadow-[0_8px_20px_-4px_rgba(13,59,102,0.22)] cursor-pointer transition-all overflow-hidden group text-left ring-1 ring-white/70"
      >
        {/* Post+ Cobalt Blue badge contrasting cleanly against the warm cream note strip */}
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-[#1D86C4] text-white text-[9.5px] font-black uppercase tracking-wider shrink-0 shadow-2xs">
          <Sparkles className="w-2.5 h-2.5 text-[#FEE725] shrink-0" />
          <span className="truncate max-w-[74px] sm:max-w-[96px]">
            {promo.sponsorName ? promo.sponsorName.slice(0, 14) : 'Dica'}
          </span>
        </span>

        {/* Smooth TV-news horizontal marquee with soft side edge fades */}
        <div className="ticker-marquee-container flex-1 min-w-0 overflow-hidden relative h-full flex items-center">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-[#FFF6C7] group-hover:from-[#FFF1AD] to-transparent z-10 transition-colors" />
          <div className="ticker-marquee-track text-[11.5px] sm:text-xs font-bold text-[#0D3B66] whitespace-nowrap tracking-[0.01em]">
            <span className="pr-10">{displayText}</span>
            <span className="pr-10 text-[#049A35]" aria-hidden="true">
              {displayText}
            </span>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-[#FFF6C7] group-hover:from-[#FFF1AD] to-transparent z-10 transition-colors" />
        </div>

        {/* Crisp Post+ green/blue cue to open the Nota */}
        <span className="w-6 h-6 rounded-full bg-[#1D86C4]/12 group-hover:bg-[#049A35] text-[#1D86C4] group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
          <ChevronRight className="w-3.5 h-3.5 stroke-[2.8] group-hover:translate-x-0.5 transition-transform" />
        </span>
      </button>
    </div>
  );
};
