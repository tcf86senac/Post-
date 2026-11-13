import React from 'react';
import { Note, ColorPaletteStyle } from '../types';
import { PushPin } from './PushPin';
import { Paperclip, FolderOpen, Pin, Calendar, ExternalLink, MessageCircle } from 'lucide-react';
import { getReadablePenHex, getFontOption } from '../data/penStyles';
import { getNoteColorConfig } from '../data/noteColors';
import { RichNoteText } from './RichNoteText';

interface NoteCardProps {
  note: Note;
  colorPalette?: ColorPaletteStyle;
  isSharedTab?: boolean;
  swayDirection?: 'left' | 'right' | null;
  swayIndex?: number;
  onClick: (note: Note) => void;
  onOpenAttachments: (note: Note, e: React.MouseEvent) => void;
  onOpenComments?: (note: Note, e: React.MouseEvent) => void;
  onPinToggle?: (id: string, e: React.MouseEvent) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  colorPalette = 'vibrant',
  isSharedTab = false,
  swayDirection = null,
  swayIndex = 0,
  onClick,
  onOpenAttachments,
  onOpenComments,
  onPinToggle,
}) => {
  const colorConfig = getNoteColorConfig(note.color, colorPalette);
  const rotationDeg = note.rotation ?? 0;
  const attachmentsCount = note.attachments?.length || 0;
  const commentsCount = note.commentsCount ?? note.comments?.length ?? 0;
  const showCommentsButton = isSharedTab || commentsCount > 0;
  const hasDrive = Boolean(note.driveFolderUrl);
  const calendarEvent = note.calendarEvent;

  const penColorHex = getReadablePenHex(note.penColor, note.color);
  const fontOption = getFontOption(note.fontStyle);

  // Use fullContent when available so [Title](url) links stay intact and clickable
  const displayContent = note.fullContent || note.previewText;

  const swayClass =
    swayDirection === 'left'
      ? 'note-sway-left'
      : swayDirection === 'right'
      ? 'note-sway-right'
      : '';

  return (
    <div
      onClick={() => onClick(note)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(note);
        }
      }}
      style={
        {
          '--note-rot': `${rotationDeg}deg`,
          transform: `rotate(${rotationDeg}deg)`,
          animationDelay: swayDirection ? `${Math.min(swayIndex, 8) * 28}ms` : undefined,
        } as React.CSSProperties
      }
      className={`relative group rounded-[4px] pt-5 pb-3.5 px-3 transition-all duration-200 cursor-pointer select-none border ${colorConfig.bgClass} ${colorConfig.borderClass} note-paper note-soft-shadow hover:note-hover-shadow hover:scale-[1.02] hover:z-20 active:scale-[0.99] flex flex-col justify-between min-h-[154px] max-h-[215px] ${swayClass}`}
    >
      {/* 3D Realistic Pushpin (Alfinete de fixação no mural) */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
        <PushPin color={note.pinColor || 'red'} size="md" />
      </div>

      <div>
        {/* Header with Title and Pin indicator */}
        <div className="flex items-start justify-between gap-1 mb-1">
          <div className="flex-1 min-w-0 text-left">
            {note.isSponsored && (
              <span className="inline-block text-[9px] bg-amber-200/90 text-amber-900 font-extrabold px-1.5 py-0.2 rounded mb-0.5 tracking-wider uppercase">
                Parceiro Post+
              </span>
            )}
            <h2
              className={`text-left leading-tight line-clamp-2 ${fontOption.titleSizeClass}`}
              style={{
                color: penColorHex,
                fontFamily: fontOption.fontFamily,
              }}
            >
              {note.title}
            </h2>
          </div>

          {note.isPinned && (
            <span
              onClick={(e) => onPinToggle && onPinToggle(note.id, e)}
              className="text-amber-700 shrink-0 ml-0.5 p-0.5 rounded hover:bg-black/5"
              title="Nota fixada no topo"
            >
              <Pin className="w-3 h-3 fill-amber-600 stroke-amber-700" />
            </span>
          )}
        </div>

        {/* Google Calendar Scheduled Badge (if active) */}
        {calendarEvent?.scheduledDate && (
          calendarEvent.googleCalendarUrl ? (
            <a
              href={calendarEvent.googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Compromisso agendado na Google Agenda (toque para abrir)"
              className="mb-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1D86C4]/15 hover:bg-[#1D86C4]/25 text-[#125882] border border-[#1D86C4]/30 text-[10px] font-bold cursor-pointer transition-colors max-w-full truncate"
            >
              <Calendar className="w-3 h-3 text-[#1D86C4] shrink-0" />
              <span className="truncate">
                {calendarEvent.scheduledDate.split('-').reverse().slice(0, 2).join('/')}
                {calendarEvent.scheduledTime ? ` · ${calendarEvent.scheduledTime}` : ''}
              </span>
            </a>
          ) : (
            <div
              title="Compromisso agendado"
              className="mb-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1D86C4]/15 text-[#125882] border border-[#1D86C4]/30 text-[10px] font-bold max-w-full truncate"
            >
              <Calendar className="w-3 h-3 text-[#1D86C4] shrink-0" />
              <span className="truncate">
                {calendarEvent.scheduledDate.split('-').reverse().slice(0, 2).join('/')}
                {calendarEvent.scheduledTime ? ` · ${calendarEvent.scheduledTime}` : ''}
              </span>
            </div>
          )
        )}

        {/* Note Body Text with Pen Ink, Handwriting & Clickable Titled Hyperlinks */}
        <p
          className={`text-left line-clamp-4 ${fontOption.bodySizeClass} opacity-95`}
          style={{
            color: penColorHex,
            fontFamily: fontOption.fontFamily,
          }}
        >
          <RichNoteText
            text={displayContent}
            style={{
              color: penColorHex,
              fontFamily: fontOption.fontFamily,
            }}
          />
        </p>
      </div>

      {/* Footer Area with Timestamp, Comments (for Shared Tabs) & Attachments Button */}
      <div className="mt-2 pt-1.5 border-t border-black/5 flex items-center justify-between text-[10px] gap-1">
        <span className="text-black/50 truncate max-w-[65px] sm:max-w-[85px]">
          {note.createdAt}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {showCommentsButton && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenComments) {
                  onOpenComments(note, e);
                } else {
                  onClick(note);
                }
              }}
              title="Abrir comentários deste post compartilhado"
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold text-[10px] cursor-pointer transition-colors ${
                commentsCount > 0
                  ? 'bg-[#1D86C4]/18 hover:bg-[#1D86C4]/28 text-[#0D3B66]'
                  : 'bg-black/8 hover:bg-black/15 text-slate-800'
              }`}
            >
              <MessageCircle className="w-3 h-3 text-[#1D86C4]" />
              <span>{commentsCount}</span>
            </button>
          )}

          {attachmentsCount > 0 || hasDrive ? (
            <button
              type="button"
              onClick={(e) => onOpenAttachments(note, e)}
              title="Ver anexos e Google Drive"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/10 hover:bg-black/15 text-slate-800 font-semibold text-[10px] cursor-pointer transition-colors"
            >
              {hasDrive ? (
                <FolderOpen className="w-3 h-3 text-amber-700" />
              ) : (
                <Paperclip className="w-3 h-3 text-slate-700" />
              )}
              <span>{attachmentsCount}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => onOpenAttachments(note, e)}
              title="Anexar arquivo, foto ou pasta do Google Drive"
              className="p-1 text-black/45 hover:text-black/85 rounded hover:bg-black/5 cursor-pointer opacity-75 group-hover:opacity-100 transition-opacity"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
          )}

          {note.isSponsored && note.sponsorUrl && (
            <a
              href={note.sponsorUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 text-amber-700 hover:text-amber-900 rounded hover:bg-black/5"
              title="Visitar anunciante"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
