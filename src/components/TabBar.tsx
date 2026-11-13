import React, { useState, useEffect, useRef } from 'react';
import { CategoryTab, ColorPaletteStyle } from '../types';
import {
  Users,
  Plus,
  ChevronDown,
  Check,
  FileText,
  Briefcase,
  Folder,
} from 'lucide-react';

interface TabBarProps {
  tabs: CategoryTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  getTabCount: (tabId: string) => number;
  onOpenShareModal: (tab: CategoryTab) => void;
  onAddNewTab: () => void;
  colorPalette?: ColorPaletteStyle;
}

interface TabBadgeTheme {
  tagClass: string;
  countClass: string;
  iconClass: string;
  dotClass: string;
  dropdownActiveClass: string;
}

const VIBRANT_TAB_THEMES: TabBadgeTheme[] = [
  {
    // Azul Post+ (Principal)
    tagClass: 'bg-[#1D86C4] text-white border-[#146596]',
    countClass: 'bg-white/20 text-white border-white/30',
    iconClass: 'text-[#FEE725]',
    dotClass: 'bg-[#1D86C4]',
    dropdownActiveClass: 'bg-sky-50 border-[#1D86C4] text-[#1D86C4]',
  },
  {
    // Amarelo Mostarda Post+ (Trabalho)
    tagClass: 'bg-[#F4C430] text-slate-900 border-[#D9A711]',
    countClass: 'bg-slate-900/12 text-slate-900 border-slate-900/20',
    iconClass: 'text-slate-900',
    dotClass: 'bg-[#F4C430]',
    dropdownActiveClass: 'bg-amber-50 border-[#D9A711] text-amber-900',
  },
  {
    // Verde Bandeira Post+ (Família / Compartilhadas)
    tagClass: 'bg-[#049A35] text-white border-[#037829]',
    countClass: 'bg-white/20 text-white border-white/30',
    iconClass: 'text-[#FEE725]',
    dotClass: 'bg-[#049A35]',
    dropdownActiveClass: 'bg-emerald-50 border-[#049A35] text-[#049A35]',
  },
  {
    // Turquesa Post+
    tagClass: 'bg-[#0D9488] text-white border-[#0F766E]',
    countClass: 'bg-white/20 text-white border-white/30',
    iconClass: 'text-[#CCFBF1]',
    dotClass: 'bg-[#0D9488]',
    dropdownActiveClass: 'bg-teal-50 border-[#0D9488] text-teal-800',
  },
  {
    // Coral Post+
    tagClass: 'bg-[#EA6A47] text-white border-[#C95232]',
    countClass: 'bg-white/20 text-white border-white/30',
    iconClass: 'text-[#FFF176]',
    dotClass: 'bg-[#EA6A47]',
    dropdownActiveClass: 'bg-orange-50 border-[#EA6A47] text-orange-800',
  },
  {
    // Azul Lavanda / Índigo Post+
    tagClass: 'bg-[#5B6EE1] text-white border-[#4455C2]',
    countClass: 'bg-white/20 text-white border-white/30',
    iconClass: 'text-[#E0E7FF]',
    dotClass: 'bg-[#5B6EE1]',
    dropdownActiveClass: 'bg-indigo-50 border-[#5B6EE1] text-indigo-800',
  },
  {
    // Roxo Orquídea Post+
    tagClass: 'bg-[#9333EA] text-white border-[#7E22CE]',
    countClass: 'bg-white/20 text-white border-white/30',
    iconClass: 'text-[#F3E8FF]',
    dotClass: 'bg-[#9333EA]',
    dropdownActiveClass: 'bg-purple-50 border-[#9333EA] text-purple-800',
  },
];

const PASTEL_TAB_THEMES: TabBadgeTheme[] = [
  {
    // Azul Céu Pastel
    tagClass: 'bg-[#CFEAFB] text-[#0D3B66] border-[#7CC4F0]',
    countClass: 'bg-[#1D86C4] text-white border-[#1D86C4]',
    iconClass: 'text-[#1D86C4]',
    dotClass: 'bg-[#7CC4F0]',
    dropdownActiveClass: 'bg-sky-50 border-[#1D86C4] text-[#0D3B66]',
  },
  {
    // Amarelo Pastel
    tagClass: 'bg-[#FFF3B0] text-slate-900 border-[#EBD26B]',
    countClass: 'bg-slate-900/12 text-slate-900 border-slate-900/15',
    iconClass: 'text-amber-700',
    dotClass: 'bg-[#F4C430]',
    dropdownActiveClass: 'bg-amber-50 border-[#D9A711] text-amber-900',
  },
  {
    // Verde Menta Pastel
    tagClass: 'bg-[#CCF5DA] text-[#064E23] border-[#7EE0A3]',
    countClass: 'bg-[#049A35] text-white border-[#049A35]',
    iconClass: 'text-[#049A35]',
    dotClass: 'bg-[#4FD176]',
    dropdownActiveClass: 'bg-emerald-50 border-[#049A35] text-[#064E23]',
  },
  {
    // Turquesa Pastel
    tagClass: 'bg-[#C6F6EC] text-teal-950 border-[#6EE7D5]',
    countClass: 'bg-teal-700 text-white border-teal-700',
    iconClass: 'text-teal-700',
    dotClass: 'bg-[#2DD4BF]',
    dropdownActiveClass: 'bg-teal-50 border-[#0D9488] text-teal-900',
  },
  {
    // Coral Suave Pastel
    tagClass: 'bg-[#FFE0D1] text-orange-950 border-[#F7B294]',
    countClass: 'bg-[#D95A38] text-white border-[#D95A38]',
    iconClass: 'text-[#D95A38]',
    dotClass: 'bg-[#FF8C6B]',
    dropdownActiveClass: 'bg-orange-50 border-[#EA6A47] text-orange-900',
  },
  {
    // Lavanda Pastel
    tagClass: 'bg-[#DCE3FF] text-indigo-950 border-[#A5B4FC]',
    countClass: 'bg-indigo-600 text-white border-indigo-600',
    iconClass: 'text-indigo-700',
    dotClass: 'bg-[#818CF8]',
    dropdownActiveClass: 'bg-indigo-50 border-[#5B6EE1] text-indigo-900',
  },
  {
    // Lilás Pastel
    tagClass: 'bg-[#EEDBFF] text-purple-950 border-[#D0A4FC]',
    countClass: 'bg-purple-700 text-white border-purple-700',
    iconClass: 'text-purple-700',
    dotClass: 'bg-[#C084FC]',
    dropdownActiveClass: 'bg-purple-50 border-[#9333EA] text-purple-900',
  },
];

const getTabTheme = (
  tab: CategoryTab | undefined,
  palette: ColorPaletteStyle = 'vibrant'
): TabBadgeTheme => {
  const list = palette === 'pastel' ? PASTEL_TAB_THEMES : VIBRANT_TAB_THEMES;
  if (!tab) return list[0];

  const key = tab.id.toLowerCase();
  if (key === 'principal') return list[0];
  if (key === 'trabalho') return list[1];
  if (key === 'familia' || tab.isShared) return list[2];

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const idx = 3 + (hash % (list.length - 3));
  return list[idx] || list[0];
};

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  getTabCount,
  onOpenShareModal,
  onAddNewTab,
  colorPalette = 'vibrant',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const activeCount = activeTab ? getTabCount(activeTab.id) : 0;
  const activeTheme = getTabTheme(activeTab, colorPalette);

  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded]);

  const getTabIcon = (tab: CategoryTab, customColorClass?: string) => {
    const cls = `w-4 h-4 shrink-0 ${customColorClass || ''}`;
    if (tab.id === 'principal') {
      return <FileText className={customColorClass ? cls : 'w-4 h-4 text-[#1D86C4] shrink-0'} />;
    }
    if (tab.id === 'trabalho') {
      return <Briefcase className={customColorClass ? cls : 'w-4 h-4 text-amber-600 shrink-0'} />;
    }
    if (tab.isShared) {
      return <Users className={customColorClass ? cls : 'w-4 h-4 text-[#049A35] shrink-0'} />;
    }
    return <Folder className={customColorClass ? cls : 'w-4 h-4 text-[#1D86C4] shrink-0'} />;
  };

  return (
    <nav
      ref={containerRef}
      className="relative w-full bg-slate-200 border-b border-slate-300 select-none z-25 shrink-0 shadow-xs"
      aria-label="Menu de Abas de Categorias"
    >
      {/* Fixed Bar Right Under AppHeader — Prominent Colored Tag for Active Tab */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-200/95 border-t border-slate-300/80">
        {/* Left balancing slot */}
        <div className="w-8 shrink-0 flex items-center justify-start">
          {activeTab?.isShared && (
            <button
              type="button"
              onClick={() => onOpenShareModal(activeTab)}
              title="Aba compartilhada (toque para gerenciar participantes)"
              className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-[#049A35] border border-emerald-300/90 cursor-pointer shrink-0 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Centered Colored Tab Tag (Etiqueta com cor da paleta do app) */}
        <div className="min-w-0 flex-1 flex items-center justify-center">
          <div
            className={`max-w-full inline-flex items-center gap-2 px-3.5 py-1 rounded-lg border shadow-xs transition-colors duration-200 ${activeTheme.tagClass}`}
          >
            {activeTab && getTabIcon(activeTab, activeTheme.iconClass)}
            <span className="text-[13px] sm:text-sm font-black uppercase tracking-wider truncate leading-tight">
              {activeTab?.label || 'PRINCIPAL'}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-md border text-[11px] font-black tabular-nums leading-none shrink-0 ${activeTheme.countClass}`}
            >
              {activeCount}
            </span>
          </div>
        </div>

        {/* Arrow Button to Expand / Collapse Tabs */}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-controls="sandwich-tabs-dropdown"
          aria-label={isExpanded ? 'Recolher menu de abas' : 'Expandir menu de abas'}
          title={isExpanded ? 'Recolher abas' : 'Escolher outra aba'}
          className="w-8 h-8 rounded-lg bg-white/80 hover:bg-white active:scale-95 text-slate-800 flex items-center justify-center shrink-0 cursor-pointer transition-all border border-slate-300 shadow-2xs"
        >
          <ChevronDown
            className={`w-4 h-4 stroke-[2.5] transition-transform duration-200 ${
              isExpanded ? 'rotate-180 text-[#1D86C4]' : ''
            }`}
          />
        </button>
      </div>

      {/* Expanded Dropdown Menu */}
      {isExpanded && (
        <div
          id="sandwich-tabs-dropdown"
          className="absolute left-0 right-0 top-full bg-white border-b border-slate-300 shadow-xl z-40 max-h-[65vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 fade-in duration-150"
        >
          <div className="p-2 space-y-1">
            <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">
              Selecionar Aba / Assunto
            </div>

            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const count = getTabCount(tab.id);
              const theme = getTabTheme(tab, colorPalette);

              return (
                <div
                  key={tab.id}
                  className={`flex items-center justify-between gap-2 rounded-xl border-l-4 transition-colors ${
                    isActive
                      ? theme.dropdownActiveClass
                      : 'hover:bg-slate-50 border-transparent'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTab(tab.id);
                      setIsExpanded(false);
                    }}
                    className="flex-1 min-w-0 flex items-center justify-between gap-2 px-3 py-2.5 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                      <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${theme.dotClass}`} />
                      {getTabIcon(tab)}
                      <span
                        className={`text-xs uppercase tracking-wider text-left leading-snug break-words ${
                          isActive ? 'font-black' : 'font-semibold text-slate-700'
                        }`}
                      >
                        {tab.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {tab.isShared && (
                        <span className="text-[9.5px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                          Compartilhada
                        </span>
                      )}
                      <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-200/80 text-slate-700 font-bold tabular-nums">
                        {count}
                      </span>
                      {isActive && (
                        <Check className="w-4 h-4 stroke-[2.8]" />
                      )}
                    </div>
                  </button>

                  {tab.isShared && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(false);
                        onOpenShareModal(tab);
                      }}
                      title="Gerenciar participantes"
                      className="mr-2 p-1.5 rounded-lg hover:bg-emerald-100 text-[#049A35] cursor-pointer shrink-0"
                    >
                      <Users className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}

            <div className="pt-1.5 mt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsExpanded(false);
                  onAddNewTab();
                }}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-[#1D86C4] hover:bg-sky-50 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
                <span className="text-left">Criar Nova Aba / Categoria</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
