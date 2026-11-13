import React from 'react';
import { Menu, Settings, Search, X, Camera } from 'lucide-react';
import { PostLogo } from './PostLogo';

interface AppHeaderProps {
  onOpenMenu: () => void;
  onOpenSettings: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearching: boolean;
  onToggleSearch: () => void;
  onOpenLens?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenMenu,
  onOpenSettings,
  searchQuery,
  onSearchChange,
  isSearching,
  onToggleSearch,
  onOpenLens,
}) => {
  return (
    <header className="relative w-full bg-[#1D86C4] text-white px-3 py-2.5 z-30 select-none shrink-0">
      {isSearching ? (
        <div className="flex items-center gap-2 px-1">
          <Search className="w-5 h-5 text-white/90 shrink-0" />
          <input
            type="text"
            placeholder="Buscar notas, lembretes ou anexos..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent text-white placeholder-white/75 text-sm focus:outline-none text-left"
          />
          <button
            type="button"
            onClick={onToggleSearch}
            className="p-1 rounded-full hover:bg-white/15 active:bg-white/25 transition-colors cursor-pointer"
            title="Fechar busca"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          {/* Left: White hamburger menu icon */}
          <button
            type="button"
            onClick={onOpenMenu}
            title="Abrir Menu Lateral"
            aria-label="Menu de Navegação"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/15 active:bg-white/25 transition-colors cursor-pointer text-white shrink-0"
          >
            <Menu className="w-5 h-5 stroke-[2.2] text-white" />
          </button>

          {/* Center: Brand Logo Matching Visual Identity */}
          <div className="flex-1 flex items-center justify-center">
            <div
              className="cursor-pointer"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              title="Post+ Início"
            >
              <PostLogo size="md" />
            </div>
          </div>

          {/* Right: Camera Lens, Quick search and White gear icon for settings */}
          <div className="flex items-center gap-1 shrink-0">
            {onOpenLens && (
              <button
                type="button"
                onClick={onOpenLens}
                title="Post+ Lens: Foto e Leitura com IA Gemini"
                aria-label="Câmera Post+ Lens com IA"
                className="h-8 px-2 flex items-center gap-1 rounded-full bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-all cursor-pointer text-xs font-bold active:scale-95 shadow-2xs"
              >
                <Camera className="w-3.5 h-3.5 text-[#FEE725]" />
                <span className="hidden sm:inline text-[11px] text-white font-bold">Lens IA</span>
              </button>
            )}
            <button
              type="button"
              onClick={onToggleSearch}
              title="Pesquisar anotações"
              aria-label="Buscar"
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/15 active:bg-white/25 transition-colors cursor-pointer text-white"
            >
              <Search className="w-4 h-4 stroke-[2.2] text-white" />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              title="Configurações"
              aria-label="Configurações do Aplicativo"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/15 active:bg-white/25 transition-colors cursor-pointer text-white"
            >
              <Settings className="w-5 h-5 stroke-[2.2] text-white" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
