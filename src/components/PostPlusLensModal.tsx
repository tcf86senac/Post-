import React, { useState, useRef } from 'react';
import { Note, NoteAttachment } from '../types';
import {
  X,
  Camera,
  ImagePlus,
  Loader2,
  AlertCircle,
  Scan,
} from 'lucide-react';
import { getRandomNoteColor } from '../data/noteColors';

interface PostPlusLensModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (
    generatedData: Partial<Note>,
    photoAttachment: NoteAttachment
  ) => void;
}

export const PostPlusLensModal: React.FC<PostPlusLensModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Process image with Gemini immediately upon capture or file selection
  const processImage = async (
    dataUrl: string,
    mimeType: string,
    fileName: string,
    fileSize: string
  ) => {
    setIsProcessing(true);
    setErrorMsg(null);
    setSelectedImage(dataUrl);

    try {
      const response = await fetch('/api/lens/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.details || 'Erro ao processar imagem.');
      }

      const aiData = result.data;

      // Create photo attachment linked to this note
      const photoAttachment: NoteAttachment = {
        id: `att-lens-${Date.now()}`,
        name: `Foto_${fileName}`,
        type: 'image',
        size: fileSize,
        addedAt: 'Hoje, ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        dataUrl,
      };

      const partialNote: Partial<Note> = {
        title: aiData.title || 'Anotação Post+ Lens',
        previewText: aiData.previewText || aiData.fullContent?.slice(0, 80) || '',
        fullContent: aiData.fullContent || '',
        category: aiData.suggestedCategory || 'principal',
        // Pick random color across the 12 available colors for every new post
        color: getRandomNoteColor(),
        penColor: 'blue',
        fontStyle: 'handwriting',
        attachments: [photoAttachment],
        calendarEvent:
          aiData.hasSchedule && aiData.scheduledDate
            ? {
                scheduledDate: aiData.scheduledDate,
                scheduledTime: aiData.scheduledTime || '09:00',
                reminderMinutes: 15,
              }
            : undefined,
      };

      // Reset state and immediately hand off to note editor for direct user review & editing
      setSelectedImage(null);
      setIsProcessing(false);
      onClose();
      onSuccess(partialNote, photoAttachment);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Ocorreu um erro ao conectar à IA Gemini.');
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const mimeType = file.type || 'image/jpeg';
    const sizeInMb = Math.max(0.1, file.size / (1024 * 1024)).toFixed(1);
    const fileSize = `${sizeInMb} MB`;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Auto-trigger AI analysis immediately upon capture OR image file selection!
      processImage(dataUrl, mimeType, fileName, fileSize);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Hidden Camera & Phone Image File Inputs */}
        <input
          type="file"
          ref={cameraInputRef}
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-[#1D86C4] text-white">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#F9DD36]" />
            <span className="text-xs font-bold tracking-tight">Post+ Lens (IA)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white cursor-pointer"
            title="Fechar"
            disabled={isProcessing}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4">
          {isProcessing ? (
            /* Real-time Scanning HUD */
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
              <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-[#1D86C4] bg-slate-900 shadow-md flex items-center justify-center">
                {selectedImage ? (
                  <img
                    src={selectedImage}
                    alt="Processando foto"
                    className="w-full h-full object-cover opacity-60"
                  />
                ) : (
                  <Scan className="w-10 h-10 text-blue-400 animate-pulse" />
                )}
                {/* Animated Scanning Beam */}
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#F9DD36] to-transparent shadow-[0_0_12px_#F9DD36] animate-bounce" />
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center justify-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin text-[#1D86C4]" />
                  <span>Analisando imagem com IA...</span>
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Reconhecendo caligrafia, extraindo compromissos e gerando sua nota.
                </p>
              </div>
            </div>
          ) : (
            /* Direct 1-tap Actions: Camera OR Phone Image File */
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed text-center">
                Tire uma foto na hora ou anexe uma imagem do celular. A IA fará a leitura e abrirá a nota pronta para você revisar.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50/70 hover:bg-blue-100 hover:border-blue-400 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group text-center shadow-2xs"
                >
                  <div className="w-12 h-12 rounded-full bg-[#1D86C4] text-white flex items-center justify-center shadow group-hover:scale-105 transition-transform">
                    <Camera className="w-6 h-6 text-[#F9DD36]" />
                  </div>
                  <span className="text-xs font-bold text-blue-950">
                    Tirar Foto
                  </span>
                  <span className="text-[10px] text-blue-800/80">
                    Câmera + IA
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-4 rounded-xl border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group text-center shadow-2xs"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-700 text-white flex items-center justify-center shadow group-hover:scale-105 transition-transform">
                    <ImagePlus className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">
                    Imagem do Celular
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Galeria / Arquivos + IA
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
            disabled={isProcessing}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
