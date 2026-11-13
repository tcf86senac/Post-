import { NoteColor, ColorPaletteStyle } from '../types';

export interface NoteColorConfig {
  id: NoteColor;
  label: string;
  bgClass: string;
  borderClass: string;
  hex: string;
}

export const NOTE_COLOR_LIST: NoteColorConfig[] = [
  {
    id: 'yellow',
    label: 'Amarelo Mostarda',
    bgClass: 'bg-[#F4C430]',
    borderClass: 'border-[#D9A711]',
    hex: '#F4C430',
  },
  {
    id: 'lime',
    label: 'Verde Limão',
    bgClass: 'bg-[#CEF742]',
    borderClass: 'border-[#AFDB1B]',
    hex: '#CEF742',
  },
  {
    id: 'green',
    label: 'Verde Bandeira',
    bgClass: 'bg-[#7EE89E]',
    borderClass: 'border-[#4FD176]',
    hex: '#7EE89E',
  },
  {
    id: 'teal',
    label: 'Turquesa Vibrante',
    bgClass: 'bg-[#5EEAD4]',
    borderClass: 'border-[#2DD4BF]',
    hex: '#5EEAD4',
  },
  {
    id: 'blue',
    label: 'Azul Celeste',
    bgClass: 'bg-[#7DD3FC]',
    borderClass: 'border-[#38BDF8]',
    hex: '#7DD3FC',
  },
  {
    id: 'indigo',
    label: 'Azul Lavanda',
    bgClass: 'bg-[#A5B4FC]',
    borderClass: 'border-[#818CF8]',
    hex: '#A5B4FC',
  },
  {
    id: 'purple',
    label: 'Roxo Orquídea',
    bgClass: 'bg-[#D8B4FE]',
    borderClass: 'border-[#C084FC]',
    hex: '#D8B4FE',
  },
  {
    id: 'pink',
    label: 'Rosa Pink',
    bgClass: 'bg-[#FF7EB6]',
    borderClass: 'border-[#EC4D94]',
    hex: '#FF7EB6',
  },
  {
    id: 'red',
    label: 'Vermelho Pau-Brasil',
    bgClass: 'bg-[#F26457]',
    borderClass: 'border-[#D44437]',
    hex: '#F26457',
  },
  {
    id: 'coral',
    label: 'Coral Vivo',
    bgClass: 'bg-[#FF8C6B]',
    borderClass: 'border-[#ED6A45]',
    hex: '#FF8C6B',
  },
  {
    id: 'orange',
    label: 'Laranja Tangerina',
    bgClass: 'bg-[#FFB347]',
    borderClass: 'border-[#E69322]',
    hex: '#FFB347',
  },
  {
    id: 'cream',
    label: 'Amarelo Canário',
    bgClass: 'bg-[#FFF176]',
    borderClass: 'border-[#EBD93D]',
    hex: '#FFF176',
  },
];

export const PASTEL_COLOR_LIST: NoteColorConfig[] = [
  {
    id: 'yellow',
    label: 'Amarelo Pastel',
    bgClass: 'bg-[#FFF9C4]',
    borderClass: 'border-[#F7E88B]',
    hex: '#FFF9C4',
  },
  {
    id: 'lime',
    label: 'Verde Limão Pastel',
    bgClass: 'bg-[#ECFCCB]',
    borderClass: 'border-[#D9F99D]',
    hex: '#ECFCCB',
  },
  {
    id: 'green',
    label: 'Verde Menta Pastel',
    bgClass: 'bg-[#DCFCE7]',
    borderClass: 'border-[#BBF7D0]',
    hex: '#DCFCE7',
  },
  {
    id: 'teal',
    label: 'Turquesa Pastel',
    bgClass: 'bg-[#CCFBF1]',
    borderClass: 'border-[#99F6E4]',
    hex: '#CCFBF1',
  },
  {
    id: 'blue',
    label: 'Azul Céu Pastel',
    bgClass: 'bg-[#E0F2FE]',
    borderClass: 'border-[#BAE6FD]',
    hex: '#E0F2FE',
  },
  {
    id: 'indigo',
    label: 'Azul Lavanda Pastel',
    bgClass: 'bg-[#E0E7FF]',
    borderClass: 'border-[#C7D2FE]',
    hex: '#E0E7FF',
  },
  {
    id: 'purple',
    label: 'Lilás Pastel',
    bgClass: 'bg-[#F3E8FF]',
    borderClass: 'border-[#E9D5FF]',
    hex: '#F3E8FF',
  },
  {
    id: 'pink',
    label: 'Rosa Bebê Pastel',
    bgClass: 'bg-[#FCE7F3]',
    borderClass: 'border-[#FBCFE8]',
    hex: '#FCE7F3',
  },
  {
    id: 'red',
    label: 'Vermelho Rosado Pastel',
    bgClass: 'bg-[#FEE2E2]',
    borderClass: 'border-[#FECACA]',
    hex: '#FEE2E2',
  },
  {
    id: 'coral',
    label: 'Coral Suave Pastel',
    bgClass: 'bg-[#FFE4D6]',
    borderClass: 'border-[#FEC8AE]',
    hex: '#FFE4D6',
  },
  {
    id: 'orange',
    label: 'Pêssego Pastel',
    bgClass: 'bg-[#FFEDD5]',
    borderClass: 'border-[#FED7AA]',
    hex: '#FFEDD5',
  },
  {
    id: 'cream',
    label: 'Creme Areia Pastel',
    bgClass: 'bg-[#F7F3E3]',
    borderClass: 'border-[#EAE2C6]',
    hex: '#F7F3E3',
  },
];

export const NOTE_COLOR_MAP: Record<NoteColor, NoteColorConfig> = NOTE_COLOR_LIST.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<NoteColor, NoteColorConfig>
);

export const PASTEL_COLOR_MAP: Record<NoteColor, NoteColorConfig> = PASTEL_COLOR_LIST.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<NoteColor, NoteColorConfig>
);

export const getNoteColorList = (palette: ColorPaletteStyle = 'vibrant'): NoteColorConfig[] => {
  return palette === 'pastel' ? PASTEL_COLOR_LIST : NOTE_COLOR_LIST;
};

export const getNoteColorConfig = (
  color?: NoteColor,
  palette: ColorPaletteStyle = 'vibrant'
): NoteColorConfig => {
  const map = palette === 'pastel' ? PASTEL_COLOR_MAP : NOTE_COLOR_MAP;
  if (color && map[color]) {
    return map[color];
  }
  return map.yellow;
};

export const getRandomNoteColor = (
  excludeColor?: NoteColor,
  palette: ColorPaletteStyle = 'vibrant'
): NoteColor => {
  const list = getNoteColorList(palette);
  const pool = excludeColor ? list.filter((c) => c.id !== excludeColor) : list;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx].id;
};
