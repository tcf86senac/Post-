import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  Note,
  NoteColor,
  PinColor,
  CategoryTab,
  CalendarEventInfo,
  PenColor,
  NoteFontStyle,
  UserPreferences,
  NoteComment,
} from '../types';
import {
  X,
  Trash2,
  Pin,
  Check,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Link2,
  ExternalLink,
  Pencil,
  Eye,
  Mic,
  Square,
  Loader2,
  MessageCircle,
  Send,
} from 'lucide-react';
import {
  subscribeNoteComments,
  addNoteComment,
  deleteNoteComment,
} from '../services/sharedTabsService';
import { PushPin } from './PushPin';
import { RichNoteText } from './RichNoteText';
import { PEN_OPTIONS, FONT_OPTIONS, getReadablePenHex, getFontOption } from '../data/penStyles';
import {
  getNoteColorList,
  getNoteColorConfig,
  getRandomNoteColor,
} from '../data/noteColors';
import {
  convertRawUrlsToTitledLinks,
  extractLinksFromContent,
  updateLinkTitleInContent,
  buildReadablePreview,
} from '../utils/linkUtils';

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note | null;
  onSave: (note: Note) => void;
  onDelete?: (id: string) => void;
  defaultCategory?: string;
  tabs?: CategoryTab[];
  onOpenAttachments?: (note: Note) => void;
  onOpenLens?: () => void;
  userPreferences?: UserPreferences;
  lastCreatedColor?: NoteColor;
  initialFocusComments?: boolean;
  authUser?: User | null;
  onSignInGoogle?: () => Promise<void> | void;
}

const PIN_OPTIONS: PinColor[] = ['red', 'blue', 'yellow', 'green', 'silver', 'purple'];

export const NoteModal: React.FC<NoteModalProps> = ({
  isOpen,
  onClose,
  note,
  onSave,
  onDelete,
  defaultCategory = 'principal',
  tabs = [],
  onOpenAttachments,
  userPreferences = {
    defaultNoteColor: 'yellow',
    defaultPinColor: 'red',
    defaultPenColor: 'blue',
    defaultFontStyle: 'handwriting',
    colorPalette: 'vibrant',
    colorSelectionMode: 'random',
  },
  lastCreatedColor,
  initialFocusComments = false,
  authUser = null,
  onSignInGoogle,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [color, setColor] = useState<NoteColor>('yellow');
  const [pinColor, setPinColor] = useState<PinColor>('red');
  const [isPinned, setIsPinned] = useState(false);
  const [penColor, setPenColor] = useState<PenColor>('blue');
  const [fontStyle, setFontStyle] = useState<NoteFontStyle>('handwriting');

  const [showOptions, setShowOptions] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(true);

  // Voice recording & AI transcription states
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Google Calendar Integration states
  const [hasSchedule, setHasSchedule] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [durationMinutes] = useState(60);
  const [reminderMinutes] = useState(15);

  // Shared tab comments state
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [comments, setComments] = useState<NoteComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const commentsSectionRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const cancelRecordingFlagRef = useRef<boolean>(false);

  const activeCategoryTab = tabs.find(
    (t) => t.id.toLowerCase() === category.toLowerCase()
  );
  const sharedTabDocId =
    note?.firestoreTabId || activeCategoryTab?.firestoreId || undefined;
  const isSharedTab = Boolean(activeCategoryTab?.isShared || note?.firestoreTabId);
  const currentUserEmailLower = authUser?.email?.toLowerCase() || '';
  const isReadOnlyViewer = Boolean(
    isSharedTab &&
      authUser &&
      activeCategoryTab?.ownerUid &&
      activeCategoryTab.ownerUid !== authUser.uid &&
      activeCategoryTab.editorEmails &&
      !activeCategoryTab.editorEmails.includes(currentUserEmailLower)
  );

  useEffect(() => {
    if (!isOpen) return;

    if (note) {
      const initialContent = note.fullContent || note.previewText || '';
      setTitle(note.title);
      setContent(initialContent);
      setCategory(note.category);
      setColor(note.color);
      setPinColor(note.pinColor || userPreferences.defaultPinColor);
      setIsPinned(Boolean(note.isPinned));
      setPenColor(note.penColor || userPreferences.defaultPenColor);
      setFontStyle(note.fontStyle || userPreferences.defaultFontStyle);
      // Open existing notes with text (or viewer-only shared notes) in Reading Mode so links are immediately clickable inline
      setIsEditingContent(
        !isReadOnlyViewer && initialContent.trim().length === 0
      );
      setComments(note.comments || []);
      setShowCommentsPanel(Boolean(initialFocusComments));
      setCommentDraft('');
      setCommentError(null);
      setConfirmDelete(false);

      if (note.calendarEvent) {
        setHasSchedule(true);
        setScheduledDate(note.calendarEvent.scheduledDate || '');
        setScheduledTime(note.calendarEvent.scheduledTime || '09:00');
        setShowOptions(true);
      } else {
        setHasSchedule(false);
        const today = new Date().toISOString().split('T')[0];
        setScheduledDate(today);
        setScheduledTime('10:00');
        setShowOptions(false);
      }
    } else {
      const activePalette = userPreferences.colorPalette || 'vibrant';
      const initialColor =
        userPreferences.colorSelectionMode === 'fixed'
          ? userPreferences.defaultNoteColor
          : getRandomNoteColor(lastCreatedColor, activePalette);
      setTitle('');
      setContent('');
      setCategory(defaultCategory);
      setColor(initialColor);
      setPinColor(userPreferences.defaultPinColor);
      setPenColor(userPreferences.defaultPenColor);
      setFontStyle(userPreferences.defaultFontStyle);
      setIsPinned(false);
      setIsEditingContent(true);
      setShowOptions(false);
      setHasSchedule(false);
      setComments([]);
      setShowCommentsPanel(false);
      setCommentDraft('');
      setCommentError(null);
      setConfirmDelete(false);
      const today = new Date().toISOString().split('T')[0];
      setScheduledDate(today);
      setScheduledTime('10:00');
    }
  }, [note, defaultCategory, isOpen, initialFocusComments]);

  // Real-time Firestore comments listener for synced shared tab notes
  useEffect(() => {
    if (!isOpen || !note || !sharedTabDocId || !authUser) {
      return;
    }
    const unsubscribe = subscribeNoteComments(sharedTabDocId, note.id, (list) => {
      setComments(list);
    });
    return () => unsubscribe();
  }, [isOpen, note?.id, sharedTabDocId, authUser?.uid]);

  // Auto-scroll to comments section when opened directly via the card Comment button (without forcing keyboard)
  useEffect(() => {
    if (isOpen && initialFocusComments && showCommentsPanel) {
      const timer = setTimeout(() => {
        commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialFocusComments, showCommentsPanel]);

  // Reset voice state whenever modal opens/closes and clean up recorder on close
  useEffect(() => {
    if (isOpen) {
      setVoiceStatus(null);
      setVoiceError(null);
      setIsTranscribingVoice(false);
    } else {
      cancelRecordingFlagRef.current = true;
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      setIsRecordingVoice(false);
      setRecordingSeconds(0);
    }
  }, [isOpen]);


  if (!isOpen) return null;

  const buildGoogleCalendarUrl = (t: string, desc: string, d: string, tm: string) => {
    try {
      const eventTime = tm || '09:00';
      const start = new Date(`${d}T${eventTime}:00`);
      const end = new Date(start.getTime() + durationMinutes * 60000);
      const format = (dt: Date) => dt.toISOString().replace(/-|:|\.\d\d\d/g, '');
      const encodedTitle = encodeURIComponent(t || 'Compromisso Post+');
      const encodedDetails = encodeURIComponent(desc || 'Criado via Post+');
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodedTitle}&dates=${format(start)}/${format(end)}&details=${encodedDetails}`;
    } catch {
      return '';
    }
  };

  const buildNoteObject = (allowEmpty = false): Note | null => {
    if (!allowEmpty && !title.trim() && !content.trim()) return null;

    const normalizedContent = convertRawUrlsToTitledLinks(content.trim());
    const randomRotation = Number(((Math.random() * 3.4) - 1.7).toFixed(1));

    let calendarEvent: CalendarEventInfo | undefined;
    if (hasSchedule && scheduledDate) {
      calendarEvent = {
        scheduledDate,
        scheduledTime,
        durationMinutes,
        reminderMinutes,
        googleCalendarUrl: buildGoogleCalendarUrl(title, normalizedContent, scheduledDate, scheduledTime),
        isSynced: true,
      };
    }

    return {
      id: note ? note.id : `nota-${Date.now()}`,
      title: title.trim() || 'Lembrete Sem Título',
      previewText: buildReadablePreview(normalizedContent, 110),
      fullContent: normalizedContent,
      category,
      color,
      pinColor,
      penColor,
      fontStyle,
      isPinned,
      rotation: note?.rotation ?? randomRotation,
      attachments: note?.attachments || [],
      driveFolderUrl: note?.driveFolderUrl,
      driveFolderId: note?.driveFolderId,
      driveFolderName: note?.driveFolderName,
      calendarEvent,
      createdAt: note
        ? note.createdAt
        : 'Hoje, ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      updatedAt: 'Agora',
      firestoreTabId: note?.firestoreTabId || activeCategoryTab?.firestoreId,
      authorUid: note?.authorUid,
      authorEmail: note?.authorEmail,
      authorName: note?.authorName,
      commentsCount: comments.length > 0 ? comments.length : note?.commentsCount ?? 0,
      comments: note?.comments,
    };
  };

  const handleSendComment = async () => {
    const trimmed = commentDraft.trim();
    if (!trimmed) return;
    if (!note) {
      setCommentError('Salve a nota no mural primeiro para adicionar comentários.');
      return;
    }

    setCommentError(null);
    setIsSendingComment(true);
    try {
      if (sharedTabDocId && authUser) {
        await addNoteComment(sharedTabDocId, note.id, trimmed, authUser);
        setCommentDraft('');
      } else {
        const localComment: NoteComment = {
          id: `local-cmt-${Date.now()}`,
          noteId: note.id,
          tabDocId: category,
          authorUid: authUser?.uid || 'local-user',
          authorEmail: authUser?.email || 'voce@postplus.app',
          authorName: authUser?.displayName || 'Você',
          text: trimmed,
          createdAtLabel: 'Agora',
          createdAtMs: Date.now(),
        };
        const updatedComments = [...comments, localComment];
        setComments(updatedComments);
        setCommentDraft('');
        onSave({
          ...note,
          comments: updatedComments,
          commentsCount: updatedComments.length,
        });
      }
    } catch (err: any) {
      setCommentError(err?.message || 'Erro ao enviar comentário.');
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleDeleteCommentItem = async (commentItem: NoteComment) => {
    if (!note) return;
    if (sharedTabDocId && authUser) {
      try {
        await deleteNoteComment(sharedTabDocId, note.id, commentItem.id);
      } catch (err: any) {
        setCommentError(err?.message || 'Não foi possível excluir o comentário.');
      }
    } else {
      const updatedComments = comments.filter((c) => c.id !== commentItem.id);
      setComments(updatedComments);
      onSave({
        ...note,
        comments: updatedComments,
        commentsCount: updatedComments.length,
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedNote = buildNoteObject(false);
    if (!updatedNote) return;

    onSave(updatedNote);
    onClose();
  };

  const handleOpenAttachmentsDirect = () => {
    if (!onOpenAttachments) return;
    // Save current note draft first so attachments & Drive folder work immediately even on a new note
    const draftNote = buildNoteObject(true);
    if (draftNote) {
      onSave(draftNote);
      onOpenAttachments(draftNote);
    }
  };

  // Automatically convert raw pasted URLs into titled hyperlinks [Title](url)
  const handleContentPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (/(https?:\/\/[^\s]+|www\.[^\s]+)/i.test(pastedText)) {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart ?? content.length;
      const end = target.selectionEnd ?? content.length;
      const convertedPaste = convertRawUrlsToTitledLinks(pastedText);
      const nextContent =
        content.slice(0, start) + convertedPaste + content.slice(end);
      setContent(nextContent);
    }
  };

  const handleContentBlur = () => {
    const converted = convertRawUrlsToTitledLinks(content);
    if (converted !== content) {
      setContent(converted);
    }
    if (converted.trim().length > 0 && extractLinksFromContent(converted).length > 0) {
      setIsEditingContent(false);
    }
  };

  const handleEnterEditContent = () => {
    setIsEditingContent(true);
  };

  const handleSwitchToReadMode = () => {
    const converted = convertRawUrlsToTitledLinks(content);
    if (converted !== content) {
      setContent(converted);
    }
    setIsEditingContent(false);
  };

  const cleanupRecordingResources = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsRecordingVoice(false);
  };

  const handleStopAndTranscribeVoice = (cancel = false) => {
    cancelRecordingFlagRef.current = cancel;
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupRecordingResources();
    }
  };

  const handleStartVoiceRecording = async () => {
    setVoiceError(null);
    setVoiceStatus(null);
    cancelRecordingFlagRef.current = false;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoiceError('Seu navegador não suporta gravação de microfone neste ambiente.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const candidateTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const supportedType =
        typeof MediaRecorder !== 'undefined'
          ? candidateTypes.find((t) => MediaRecorder.isTypeSupported(t)) || ''
          : '';

      const recorder = supportedType
        ? new MediaRecorder(stream, { mimeType: supportedType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || supportedType || 'audio/webm';
        const chunks = audioChunksRef.current;
        cleanupRecordingResources();

        if (cancelRecordingFlagRef.current) {
          return;
        }

        const audioBlob = new Blob(chunks, { type: mimeType });
        if (audioBlob.size < 400) {
          setVoiceError('Gravação muito curta. Segure e fale sua mensagem antes de parar.');
          return;
        }

        setIsTranscribingVoice(true);
        try {
          const audioBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Falha ao ler áudio gravado.'));
            reader.readAsDataURL(audioBlob);
          });

          const response = await fetch('/api/voice/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64, mimeType }),
          });

          const payload = await response.json();
          if (!response.ok || !payload.success) {
            throw new Error(payload.error || 'Não foi possível transcrever o áudio.');
          }

          const { title: aiTitle, content: aiContent } = payload.data || {};
          if (aiTitle && !title.trim()) {
            setTitle(aiTitle);
          }
          if (aiContent) {
            const formatted = convertRawUrlsToTitledLinks(aiContent);
            setContent((prev) =>
              prev.trim() ? `${prev.trimEnd()}\n${formatted}` : formatted
            );
            setIsEditingContent(extractLinksFromContent(formatted).length === 0);
          }
          setVoiceStatus('Mensagem de voz transcrita e título gerado pela IA!');
        } catch (err: any) {
          setVoiceError(err?.message || 'Erro ao processar a mensagem de voz com a IA.');
        } finally {
          setIsTranscribingVoice(false);
        }
      };

      recorder.start();
      setRecordingSeconds(0);
      setIsRecordingVoice(true);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 119) {
            handleStopAndTranscribeVoice(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      cleanupRecordingResources();
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setVoiceError('Permissão de microfone negada. Libere o microfone no navegador para gravar.');
      } else {
        setVoiceError(err?.message || 'Não foi possível iniciar o microfone.');
      }
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const rem = (secs % 60).toString().padStart(2, '0');
    return `${mins}:${rem}`;
  };

  const colorPalette = userPreferences.colorPalette || 'vibrant';
  const activeColorList = getNoteColorList(colorPalette);
  const detectedLinks = extractLinksFromContent(content);
  const selectedPenHex = getReadablePenHex(penColor, color);
  const selectedFont = getFontOption(fontStyle);
  const currentPaperStyle = getNoteColorConfig(color, colorPalette);
  const currentAttachmentsCount = note?.attachments?.length || 0;
  const imageAttachment = note?.attachments?.find((a) => a.type === 'image' && a.dataUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Real Note Card Structure */}
      <div
        className={`w-full max-w-sm rounded-[6px] border ${currentPaperStyle.bgClass} ${currentPaperStyle.borderClass} note-paper shadow-2xl relative flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150`}
        role="dialog"
        aria-modal="true"
      >
        {/* 3D Realistic Pushpin */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
          <PushPin color={pinColor} size="md" />
        </div>

        {/* Note Header Bar with Direct Tab Selector */}
        <div className="pt-4 px-4 pb-2 flex items-center justify-between border-b border-black/10 gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              disabled={isReadOnlyViewer}
              onClick={() => setIsPinned(!isPinned)}
              title={isPinned ? 'Desafixar do topo' : 'Fixar no topo do mural'}
              className={`p-1 rounded-md transition-colors shrink-0 disabled:opacity-60 ${
                isReadOnlyViewer ? 'cursor-default' : 'cursor-pointer'
              } ${
                isPinned ? 'bg-amber-200/80 text-amber-900' : 'text-black/45 hover:text-black/75'
              }`}
            >
              <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-700' : ''}`} />
            </button>

            {tabs.length > 0 && !isReadOnlyViewer ? (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Selecionar aba do assunto"
                title="Escolher em qual aba esta nota será salva"
                className="text-[11px] font-extrabold text-black/80 uppercase tracking-wider bg-black/[0.07] hover:bg-black/[0.12] border border-black/15 rounded-md px-2 py-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-black/35 max-w-[138px] truncate"
              >
                {tabs.map((t) => (
                  <option key={t.id} value={t.id} className="bg-white text-slate-900 font-semibold">
                    {t.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] font-bold text-black/60 uppercase tracking-wider truncate max-w-[140px]">
                {activeCategoryTab?.label || 'MURAL'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {onOpenAttachments && !isReadOnlyViewer && (
              <button
                type="button"
                onClick={handleOpenAttachmentsDirect}
                title="Anexos & Google Drive"
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-black/70 hover:text-black bg-black/5 hover:bg-black/10 rounded-md transition-colors cursor-pointer"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>{currentAttachmentsCount > 0 ? currentAttachmentsCount : 'Anexar'}</span>
              </button>
            )}
            {isSharedTab && note && (
              <button
                type="button"
                onClick={() => {
                  setShowCommentsPanel((prev) => !prev);
                  setTimeout(() => {
                    commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                  }, 80);
                }}
                title="Comentários nesta nota compartilhada"
                className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                  showCommentsPanel
                    ? 'bg-[#1D86C4] text-white'
                    : 'text-[#0D3B66] bg-[#1D86C4]/15 hover:bg-[#1D86C4]/25'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>{comments.length}</span>
              </button>
            )}
            {note && onDelete && !isReadOnlyViewer && (
              confirmDelete ? (
                <div className="inline-flex items-center gap-1 bg-rose-100 border border-rose-300 rounded-md px-1.5 py-0.5 animate-in fade-in duration-150">
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(note.id);
                      onClose();
                    }}
                    className="text-[10px] font-extrabold text-rose-700 hover:underline cursor-pointer"
                    title="Confirmar exclusão"
                  >
                    Excluir
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-[10px] font-semibold text-slate-600 hover:text-black cursor-pointer pl-1 border-l border-rose-300"
                    title="Cancelar exclusão"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  title="Excluir nota"
                  className="p-1 text-black/40 hover:text-rose-600 rounded hover:bg-black/5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )
            )}
            <button
              type="button"
              onClick={onClose}
              title="Fechar sem salvar"
              className="p-1 text-black/40 hover:text-black/80 rounded hover:bg-black/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Note Writing Form */}
        <form onSubmit={handleSubmit} className="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar flex flex-col justify-between">
          <div className="space-y-3">
            {/* Captured Photo Preview (Post+ Lens) */}
            {imageAttachment && imageAttachment.dataUrl && (
              <div className="relative rounded-lg overflow-hidden border border-black/10 bg-black/5 max-h-[120px] flex items-center justify-center">
                <img
                  src={imageAttachment.dataUrl}
                  alt="Foto anexada"
                  className="w-full max-h-[120px] object-cover"
                />
                <span className="absolute bottom-1 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-bold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                  Anexo Foto
                </span>
              </div>
            )}

            {/* Note Title Input (ballpoint handwriting) */}
            <div>
              <input
                ref={titleInputRef}
                type="text"
                readOnly={isReadOnlyViewer}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título da Nota..."
                style={{
                  color: selectedPenHex,
                  fontFamily: selectedFont.fontFamily,
                }}
                className="w-full px-2 py-1 text-left text-xl font-bold bg-transparent border-b border-black/15 focus:border-black/35 focus:outline-none placeholder:text-black/35 transition-colors"
              />
            </div>

            {/* Voice Recording + Read/Edit Toolbar */}
            {!isReadOnlyViewer && (
              <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
                {/* Voice AI Recorder Controls */}
                <div className="flex items-center gap-1.5">
                  {isRecordingVoice ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStopAndTranscribeVoice(false)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer shadow-xs animate-pulse"
                        title="Parar gravação e converter em título e texto pela IA"
                      >
                        <Square className="w-3 h-3 fill-white" />
                        <span>Parar ({formatTimer(recordingSeconds)}) · Gerar Nota</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStopAndTranscribeVoice(true)}
                        className="px-2 py-1 rounded-full bg-black/10 hover:bg-black/20 text-black/80 text-[10px] font-semibold cursor-pointer"
                        title="Descartar gravação"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : isTranscribingVoice ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 text-[#0D3B66] border border-black/10 text-[11px] font-bold">
                      <Loader2 className="w-3 h-3 animate-spin text-[#1D86C4]" />
                      <span>IA gerando título e texto...</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartVoiceRecording}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/65 hover:bg-white/95 text-slate-900 border border-black/15 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                      title="Gravar mensagem de voz e converter em título + texto com IA"
                    >
                      <Mic className="w-3.5 h-3.5 text-rose-600" />
                      <span>Gravar Voz (IA)</span>
                    </button>
                  )}
                </div>

                {/* Reading / Edit Mode Toggle */}
                {content.trim().length > 0 && (
                  <div>
                    {isEditingContent ? (
                      <button
                        type="button"
                        onClick={handleSwitchToReadMode}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-[#125882] bg-white/70 hover:bg-white px-2 py-0.5 rounded border border-black/10 cursor-pointer transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Modo leitura</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleEnterEditContent}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-black/65 hover:text-black bg-black/8 hover:bg-black/15 px-2 py-0.5 rounded cursor-pointer transition-colors"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        <span>Editar texto</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {voiceStatus && (
              <div className="px-2.5 py-1.5 rounded-lg bg-white/80 border border-emerald-300 text-[11px] text-emerald-900 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{voiceStatus}</span>
              </div>
            )}
            {voiceError && (
              <div className="px-2.5 py-1.5 rounded-lg bg-white/85 border border-rose-300 text-[11px] text-rose-800 font-semibold">
                {voiceError}
              </div>
            )}

            {/* Note Content: Integrated Reading Mode (clickable inline links) or Textarea */}
            <div className="space-y-1">

              {isEditingContent || content.trim().length === 0 ? (
                <textarea
                  ref={contentTextareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onPaste={handleContentPaste}
                  onBlur={handleContentBlur}
                  placeholder="Escreva sua anotação aqui à mão... (links colados viram hiperlinks com título)"
                  rows={5}
                  style={{
                    color: selectedPenHex,
                    fontFamily: selectedFont.fontFamily,
                  }}
                  className="w-full px-2 py-1 text-base leading-relaxed bg-transparent border-0 focus:outline-none placeholder:text-black/30 resize-none transition-colors"
                />
              ) : (
                <div
                  onClick={handleEnterEditContent}
                  title="Toque no texto para editar (ou toque no link para abrir)"
                  style={{
                    color: selectedPenHex,
                    fontFamily: selectedFont.fontFamily,
                  }}
                  className="w-full min-h-[120px] px-2 py-1 text-base leading-relaxed whitespace-pre-wrap break-words cursor-text rounded hover:bg-black/[0.02] transition-colors"
                >
                  <RichNoteText
                    text={convertRawUrlsToTitledLinks(content)}
                    style={{
                      color: selectedPenHex,
                      fontFamily: selectedFont.fontFamily,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Titled Hyperlinks Editor & Clickable Shortcuts */}
            {detectedLinks.length > 0 && (
              <div className="p-2.5 rounded-lg bg-white/55 border border-black/10 space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-black/65 uppercase tracking-wider flex items-center gap-1">
                    <Link2 className="w-3 h-3 text-[#1D86C4]" />
                    Hiperlinks no Post (edite o título ou clique para abrir)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {detectedLinks.map((lnk) => (
                    <div
                      key={lnk.id}
                      className="flex items-center gap-1.5 bg-white/80 rounded-md px-2 py-1 border border-black/10"
                    >
                      <input
                        type="text"
                        value={lnk.title}
                        onChange={(e) =>
                          setContent((prev) =>
                            updateLinkTitleInContent(prev, lnk.url, e.target.value)
                          )
                        }
                        placeholder="Título do link..."
                        className="flex-1 text-xs font-semibold text-[#0D3B66] bg-transparent focus:outline-none min-w-0"
                        title={`Editar título para ${lnk.url}`}
                      />
                      <a
                        href={lnk.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1D86C4] hover:bg-[#166FA3] text-white text-[10px] font-bold shrink-0 transition-colors"
                        title={`Ir para ${lnk.url}`}
                      >
                        <span>Abrir</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inline 12-Color Picker when user chose "Escolher na criação" */}
            {!note && userPreferences.colorSelectionMode === 'choose' && !showOptions && (
              <div className="p-2 rounded-lg bg-black/[0.04] border border-black/10 space-y-1.5">
                <span className="block text-[10px] font-bold text-black/65 uppercase tracking-wider">
                  Escolha a cor desta Nota ({currentPaperStyle.label}):
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activeColorList.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColor(c.id)}
                      title={c.label}
                      className={`w-6 h-6 rounded-full ${c.bgClass} border transition-transform cursor-pointer flex items-center justify-center ${
                        color === c.id
                          ? 'border-black ring-2 ring-black/40 scale-110'
                          : 'border-black/25 hover:scale-105'
                      }`}
                    >
                      {color === c.id && <Check className="w-3 h-3 text-black stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Expandable Tray for extra options */}
            {showOptions && (
              <div className="pt-2 border-t border-black/10 space-y-3 animate-in fade-in duration-150">
                {/* Category / Aba */}
                <div>
                  <label className="block text-[10px] font-bold text-black/60 uppercase tracking-wider mb-1">
                    Mural / Aba
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {tabs.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setCategory(t.id)}
                        className={`py-1 px-2.5 rounded text-[11px] font-bold transition-all cursor-pointer border ${
                          category === t.id
                            ? 'bg-[#1D86C4] text-white border-[#1D86C4] shadow-2xs'
                            : 'bg-black/5 text-black/70 border-black/10 hover:bg-black/10'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* All 12 Paper Colors */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-black/60 uppercase tracking-wider">
                      Cor desta Nota ({currentPaperStyle.label})
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {activeColorList.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setColor(c.id)}
                        title={c.label}
                        className={`w-6 h-6 rounded-full ${c.bgClass} border transition-transform cursor-pointer flex items-center justify-center ${
                          color === c.id
                            ? 'border-black ring-2 ring-black/40 scale-110'
                            : 'border-black/25 hover:scale-105'
                        }`}
                      >
                        {color === c.id && <Check className="w-3 h-3 text-black stroke-[3]" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pin Color */}
                <div>
                  <label className="block text-[10px] font-bold text-black/60 uppercase tracking-wider mb-1">
                    Alfinete
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PIN_OPTIONS.map((pc) => (
                      <button
                        key={pc}
                        type="button"
                        onClick={() => setPinColor(pc)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                          pinColor === pc ? 'scale-115 ring-1 ring-[#1D86C4]' : 'opacity-80'
                        }`}
                      >
                        <PushPin color={pc} size="sm" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pen Ink & Font Style */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-black/60 uppercase tracking-wider mb-1">
                      Tinta da Caneta
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {PEN_OPTIONS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPenColor(p.id)}
                          title={p.label}
                          className={`w-5 h-5 rounded-full flex items-center justify-center cursor-pointer ${
                            penColor === p.id ? 'ring-2 ring-black scale-110' : 'opacity-85'
                          }`}
                          style={{ backgroundColor: p.inkColor }}
                        >
                          {penColor === p.id && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-black/60 uppercase tracking-wider mb-1">
                      Tipografia
                    </label>
                    <div className="flex items-center gap-1 flex-wrap">
                      {FONT_OPTIONS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFontStyle(f.id)}
                          className={`px-1.5 py-0.5 text-[10px] rounded font-semibold border cursor-pointer ${
                            fontStyle === f.id
                              ? 'bg-black/15 text-black border-black/30'
                              : 'bg-black/5 text-black/60 border-black/10'
                          }`}
                        >
                          {f.tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Google Calendar Toggle & Date */}
                <div className="p-2 rounded bg-black/5 border border-black/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-black/80 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#1D86C4]" />
                      Google Agenda
                    </span>
                    <button
                      type="button"
                      onClick={() => setHasSchedule(!hasSchedule)}
                      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        hasSchedule ? 'bg-[#1D86C4]' : 'bg-black/20'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white transition ${
                          hasSchedule ? 'translate-x-3' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {hasSchedule && (
                    <div className="space-y-2 pt-1 border-t border-black/5">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="px-1.5 py-1 text-xs bg-white/80 rounded border border-black/15"
                        />
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="px-1.5 py-1 text-xs bg-white/80 rounded border border-black/15"
                        />
                      </div>
                      {scheduledDate && (
                        <a
                          href={buildGoogleCalendarUrl(title, content, scheduledDate, scheduledTime)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-[#1D86C4] hover:bg-[#166FA3] text-white text-[11px] font-bold transition-colors shadow-2xs"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Salvar Evento na Google Agenda</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Real-time Comments Section for Shared Tab Posts */}
            {isSharedTab && note && (showCommentsPanel || comments.length > 0) && (
              <div
                ref={commentsSectionRef}
                className="mt-2 p-2.5 rounded-xl bg-white/80 border border-black/15 space-y-2.5 text-left animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-[#0D3B66] uppercase tracking-wider flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-[#1D86C4]" />
                    Comentários ({comments.length})
                  </span>
                  {note.authorName && (
                    <span className="text-[10px] text-slate-500 font-medium truncate max-w-[140px]">
                      Por {note.authorName}
                    </span>
                  )}
                </div>

                {!sharedTabDocId && (
                  <p className="text-[10.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    {authUser
                      ? 'Esta aba ainda é local. Abra "Compartilhar Aba" para sincronizar comentários na nuvem.'
                      : 'Modo local. Faça login com Google para sincronizar comentários em tempo real.'}
                    {!authUser && onSignInGoogle && (
                      <button
                        type="button"
                        onClick={() => onSignInGoogle()}
                        className="ml-1 underline font-bold text-[#1D86C4] cursor-pointer"
                      >
                        Entrar
                      </button>
                    )}
                  </p>
                )}

                {commentError && (
                  <p className="text-[10.5px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1 font-medium">
                    {commentError}
                  </p>
                )}

                {/* Comments Thread */}
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
                  {comments.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic py-1 text-left">
                      Nenhum comentário ainda. Escreva abaixo para conversar sobre esta nota!
                    </p>
                  ) : (
                    comments.map((cmt) => {
                      const canDeleteComment =
                        !authUser ||
                        cmt.authorUid === authUser.uid ||
                        activeCategoryTab?.ownerUid === authUser.uid;
                      return (
                        <div
                          key={cmt.id}
                          className="p-2 rounded-lg bg-slate-50 border border-slate-200/90 text-left space-y-0.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10.5px] font-bold text-[#125882] truncate">
                              {cmt.authorName}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[9.5px] text-slate-400">
                                {cmt.createdAtLabel}
                              </span>
                              {canDeleteComment && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCommentItem(cmt)}
                                  className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                                  title="Excluir comentário"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-slate-800 break-words leading-snug text-left">
                            {cmt.text}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* New Comment Input */}
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    ref={commentInputRef}
                    type="text"
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleSendComment();
                      }
                    }}
                    placeholder="Escrever comentário..."
                    maxLength={1000}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1D86C4]"
                  />
                  <button
                    type="button"
                    disabled={isSendingComment || !commentDraft.trim()}
                    onClick={() => void handleSendComment()}
                    className="px-2.5 py-1.5 rounded-lg bg-[#1D86C4] hover:bg-[#166FA3] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                    title="Enviar comentário"
                  >
                    {isSendingComment ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-black/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {/* Toggle extra options button */}
              {!isReadOnlyViewer && (
                <button
                  type="button"
                  onClick={() => setShowOptions(!showOptions)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-black/55 hover:text-black/85 px-2 py-1 rounded hover:bg-black/5 transition-colors cursor-pointer"
                >
                  {showOptions ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Ocultar</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>Mais opções</span>
                    </>
                  )}
                </button>
              )}

              {isSharedTab && note && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCommentsPanel((prev) => !prev);
                    setTimeout(() => {
                      commentsSectionRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'end',
                      });
                    }, 80);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#125882] bg-white/75 hover:bg-white px-2 py-1 rounded border border-black/10 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#1D86C4]" />
                  <span>Comentar ({comments.length})</span>
                </button>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-black/60 hover:text-black/90 cursor-pointer"
              >
                {isReadOnlyViewer ? 'Fechar' : 'Cancelar'}
              </button>
              {!isReadOnlyViewer && (
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#1D86C4] hover:bg-[#166FA3] rounded-lg shadow-sm transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Fixar no Mural</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
