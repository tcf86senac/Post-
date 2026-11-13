import { PenColor, NoteFontStyle } from '../types';

export interface PenOption {
  id: PenColor;
  label: string;
  inkColor: string;
  sampleHex: string;
  bgClass: string;
}

export const PEN_OPTIONS: PenOption[] = [
  {
    id: 'blue',
    label: 'Azul Caneta (Esferográfica Clássica)',
    inkColor: '#0D3B66',
    sampleHex: '#0D3B66',
    bgClass: 'bg-[#0D3B66]',
  },
  {
    id: 'black',
    label: 'Preto Nanquim / Gel',
    inkColor: '#111827',
    sampleHex: '#111827',
    bgClass: 'bg-[#111827]',
  },
  {
    id: 'darkblue',
    label: 'Azul Escuro Noturno',
    inkColor: '#0F2942',
    sampleHex: '#0F2942',
    bgClass: 'bg-[#0F2942]',
  },
  {
    id: 'red',
    label: 'Vermelho Caneta (Correção)',
    inkColor: '#991B1B',
    sampleHex: '#991B1B',
    bgClass: 'bg-[#991B1B]',
  },
  {
    id: 'green',
    label: 'Verde Caneta',
    inkColor: '#166534',
    sampleHex: '#166534',
    bgClass: 'bg-[#166534]',
  },
  {
    id: 'purple',
    label: 'Roxo Caneta Gel',
    inkColor: '#581C87',
    sampleHex: '#581C87',
    bgClass: 'bg-[#581C87]',
  },
];

export interface FontOption {
  id: NoteFontStyle;
  label: string;
  fontFamily: string;
  titleSizeClass: string;
  bodySizeClass: string;
  previewSample: string;
  tag: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'handwriting',
    label: 'Caligrafia Manuscrita (Caneta)',
    fontFamily: "'Caveat', cursive, sans-serif",
    titleSizeClass: 'text-[17px] font-bold tracking-tight',
    bodySizeClass: 'text-[15.5px] leading-[1.3] font-semibold',
    previewSample: 'Anotado à mão com caneta esferográfica',
    tag: 'Grafia Humana',
  },
  {
    id: 'casual',
    label: 'Letra de Forma / Caderno',
    fontFamily: "'Kalam', cursive, sans-serif",
    titleSizeClass: 'text-[13.5px] font-bold',
    bodySizeClass: 'text-[12px] leading-relaxed font-normal',
    previewSample: 'Letra de forma natural de bloco de notas',
    tag: 'Caderno',
  },
  {
    id: 'typewriter',
    label: 'Máquina de Escrever (Post+)',
    fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
    titleSizeClass: 'text-[12.5px] font-bold tracking-tight',
    bodySizeClass: 'text-[11px] leading-relaxed font-normal',
    previewSample: 'Tipografia clássica mecânica do logo',
    tag: 'Typewriter',
  },
  {
    id: 'clean',
    label: 'Moderna / Digital Limpa',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    titleSizeClass: 'text-[12.5px] font-bold',
    bodySizeClass: 'text-[11px] leading-relaxed font-normal',
    previewSample: 'Fonte digital geométrica e legível',
    tag: 'Padrão',
  },
];

export const getPenColorHex = (penColor?: PenColor): string => {
  const found = PEN_OPTIONS.find((p) => p.id === penColor);
  return found ? found.inkColor : '#0D3B66'; // Default is Azul Caneta Clássico
};

export const getReadablePenHex = (penColor?: PenColor, noteColor?: string): string => {
  const baseHex = getPenColorHex(penColor);
  if (penColor === 'red' && (noteColor === 'red' || noteColor === 'coral' || noteColor === 'pink')) {
    return '#111827'; // Keep text crisp on red/coral/pink cards when red pen is active
  }
  if (penColor === 'green' && (noteColor === 'lime' || noteColor === 'green' || noteColor === 'teal')) {
    return '#0F2942';
  }
  return baseHex;
};

export const getFontOption = (fontStyle?: NoteFontStyle): FontOption => {
  const found = FONT_OPTIONS.find((f) => f.id === fontStyle);
  return found || FONT_OPTIONS[0]; // Default is Caligrafia Manuscrita (Caveat)
};
