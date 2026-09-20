// src/mobile/components/CameraUploader.tsx
import React, { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';
import { compressImageFile } from '../../utils/imageCompressor';

interface CameraUploaderProps {
  label: string;
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  required?: boolean;
}

export const CameraUploader: React.FC<CameraUploaderProps> = ({
  label,
  images = [],
  onChange,
  maxImages = 4,
  required = false,
}) => {
  const [compressing, setCompressing] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setCompressing(true);
    try {
      const newImages: string[] = [...images];
      for (let i = 0; i < files.length; i++) {
        if (newImages.length >= maxImages) break;
        const file = files[i];
        const compressedBase64 = await compressImageFile(file);
        if (compressedBase64) {
          newImages.push(compressedBase64);
        }
      }
      onChange(newImages);
    } catch (err) {
      console.error('이미지 압축 실패:', err);
    } finally {
      setCompressing(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleRemove = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
          {label}
          {required && <span className="text-red-400 font-bold">*</span>}
        </label>
        <span className="text-[11px] font-mono font-bold text-slate-400">
          ({images.length} / {maxImages}장)
        </span>
      </div>

      {/* 액션 버튼: 앨범 사진 첨부 vs 현장 카메라 촬영 */}
      {images.length < maxImages && (
        <div className="grid grid-cols-2 gap-2">
          {/* 1. 앨범/파일 탐색 첨부 (영업/고객 전달 사진) */}
          <button
            type="button"
            disabled={compressing}
            onClick={() => galleryInputRef.current?.click()}
            className="py-3 px-2.5 rounded-xl border border-blue-500/50 hover:border-blue-400 bg-blue-950/30 hover:bg-blue-900/40 flex flex-col items-center justify-center gap-1 text-blue-300 hover:text-white active:scale-98 transition-all shadow-sm"
          >
            {compressing ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            ) : (
              <ImageIcon className="w-5 h-5 text-blue-400 shrink-0" />
            )}
            <span className="text-xs font-bold whitespace-nowrap">사진 첨부 (앨범/파일)</span>
            <span className="text-[10px] text-slate-400 whitespace-nowrap">스마트폰 저장 사진 선택</span>
          </button>

          {/* 2. 카메라 촬영 (현장 직접 촬영) */}
          <button
            type="button"
            disabled={compressing}
            onClick={() => cameraInputRef.current?.click()}
            className="py-3 px-2.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/60 hover:bg-slate-800 flex flex-col items-center justify-center gap-1 text-slate-300 hover:text-white active:scale-98 transition-all shadow-sm"
          >
            {compressing ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : (
              <Camera className="w-5 h-5 text-slate-400 shrink-0" />
            )}
            <span className="text-xs font-bold whitespace-nowrap">카메라 촬영</span>
            <span className="text-[10px] text-slate-500 whitespace-nowrap">현장 직접 촬영</span>
          </button>
        </div>
      )}

      {/* 등록된 사진 그리드 */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          {images.map((imgUrl, idx) => (
            <div
              key={idx}
              className="relative aspect-video rounded-xl overflow-hidden border border-slate-700 bg-slate-950 group shadow-md"
            >
              <img
                src={imgUrl}
                alt={`첨부 사진 ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="absolute top-1.5 right-1.5 p-1.5 bg-red-600/90 hover:bg-red-500 text-white rounded-lg shadow-lg active:scale-95 transition-transform"
                aria-label="사진 삭제"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-black/70 text-slate-200 text-[10px] rounded font-mono font-bold">
                사진 #{idx + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 숨겨진 갤러리 인풋 (capture 없음 -> 앨범/파일 탐색기 구동) */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 숨겨진 카메라 인풋 (capture="environment" -> 실시간 카메라 구동) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
