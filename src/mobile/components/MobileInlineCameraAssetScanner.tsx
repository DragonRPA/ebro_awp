// src/mobile/components/MobileInlineCameraAssetScanner.tsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Flashlight, Upload, X } from 'lucide-react';
import { Asset } from '../../services/db';
import {
  analyzeAssetNumberFrame,
  matchRecognizedAssetFromPool,
  AssetNumberOcrResult
} from '../../services/visionOcrService';
import { isModelMatch } from '../../utils/modelUtils';

export interface UnfilledSlotInfo {
  caId: string;
  slotNumber: number;
  expectedModel: string;
}

interface MobileInlineCameraAssetScannerProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  allAvailableAssets: Asset[];
  unfilledSlots: UnfilledSlotInfo[];
  focusedSlotCaId?: string | null;
  mappedAssetIds: string[];
  onSequentialFill: (asset: Asset, targetCaId: string, recognizedText: string) => void;
}

function preprocessCanvasForLocalOcr(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let minLum = 255;
  let maxLum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }
  const range = Math.max(1, maxLum - minLum);

  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const norm = ((lum - minLum) / range) * 255;
    const contrasted = Math.max(0, Math.min(255, (norm - 128) * 1.45 + 128));
    data[i] = contrasted;
    data[i + 1] = contrasted;
    data[i + 2] = contrasted;
  }

  ctx.putImageData(imgData, 0, 0);
}

function extractAlphanumericTokens(rawText: string): string[] {
  if (!rawText) return [];
  const cleaned = rawText
    .toUpperCase()
    .replace(/[^0-9A-Z-\s]/g, ' ')
    .split(/\s+/)
    .map(t => t.replace(/^-+|-+$/g, '').trim())
    .filter(t => t.length >= 2 && /[0-9]/.test(t));
  return Array.from(new Set(cleaned));
}

export const MobileInlineCameraAssetScanner: React.FC<MobileInlineCameraAssetScannerProps> = ({
  isOpen,
  onToggleOpen,
  allAvailableAssets,
  unfilledSlots,
  focusedSlotCaId,
  mappedAssetIds,
  onSequentialFill
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const cooldownUntilRef = useRef<number>(0);
  const tesseractWorkerRef = useRef<any>(null);
  const workerInitializingRef = useRef<boolean>(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const currentTargetSlot = useMemo(() => {
    if (unfilledSlots.length === 0) return null;
    if (focusedSlotCaId) {
      const found = unfilledSlots.find(s => s.caId === focusedSlotCaId);
      if (found) return found;
    }
    return unfilledSlots[0];
  }, [unfilledSlots, focusedSlotCaId]);

  const targetExpectedModels = useMemo(() => {
    return Array.from(
      new Set(unfilledSlots.map(s => s.expectedModel).filter(m => m && m !== '*'))
    );
  }, [unfilledSlots]);

  const targetModelAvailableAssets = useMemo(() => {
    if (unfilledSlots.length === 0) return [];
    return allAvailableAssets.filter(
      a =>
        !mappedAssetIds.includes(a.id) &&
        (targetExpectedModels.length === 0 ||
          targetExpectedModels.some(m => isModelMatch(a.modelName, m)))
    );
  }, [allAvailableAssets, unfilledSlots.length, mappedAssetIds, targetExpectedModels]);

  const resolveTargetSlotForAsset = useCallback(
    (asset: Asset): UnfilledSlotInfo | null => {
      if (
        currentTargetSlot &&
        (!currentTargetSlot.expectedModel ||
          currentTargetSlot.expectedModel === '*' ||
          isModelMatch(asset.modelName, currentTargetSlot.expectedModel))
      ) {
        return currentTargetSlot;
      }
      return (
        unfilledSlots.find(
          s =>
            !s.expectedModel ||
            s.expectedModel === '*' ||
            isModelMatch(asset.modelName, s.expectedModel)
        ) || null
      );
    },
    [currentTargetSlot, unfilledSlots]
  );

  const ensureLocalOcrWorker = useCallback(async () => {
    if (tesseractWorkerRef.current) return tesseractWorkerRef.current;
    if (workerInitializingRef.current) return null;
    workerInitializingRef.current = true;
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-',
        tessedit_pageseg_mode: '6' as any
      });
      tesseractWorkerRef.current = worker;
      return worker;
    } catch {
      return null;
    } finally {
      workerInitializingRef.current = false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        try {
          t.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    setCameraReady(false);
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const applyCenterFocusConstraint = useCallback(async (track?: MediaStreamTrack | null) => {
    const targetTrack = track || streamRef.current?.getVideoTracks()?.[0];
    if (!targetTrack || typeof targetTrack.applyConstraints !== 'function') return;
    try {
      const caps = typeof targetTrack.getCapabilities === 'function' ? (targetTrack.getCapabilities() as any) : {};
      const advancedConstraint: Record<string, any> = {};
      if (Array.isArray(caps?.focusMode)) {
        if (caps.focusMode.includes('continuous')) {
          advancedConstraint.focusMode = 'continuous';
        } else if (caps.focusMode.includes('single-shot')) {
          advancedConstraint.focusMode = 'single-shot';
        }
      } else {
        advancedConstraint.focusMode = 'continuous';
      }
      // 중앙 수평 조준선(0.5, 0.5)에 광학 초점 고정
      advancedConstraint.pointsOfInterest = [{ x: 0.5, y: 0.5 }];
      await targetTrack.applyConstraints({ advanced: [advancedConstraint as any] });
    } catch {
      try {
        await targetTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
      } catch {}
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(false);
    setCameraReady(false);
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          // @ts-ignore - 브라우저 지원 시 연속 중앙 초점 우선 적용
          focusMode: { ideal: 'continuous' }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);

      const track = stream.getVideoTracks()[0];
      if (track) {
        if (typeof track.getCapabilities === 'function') {
          const caps = track.getCapabilities() as any;
          if (caps && caps.torch) {
            setTorchSupported(true);
          }
        }
        await applyCenterFocusConstraint(track);
      }
    } catch {
      setCameraError(true);
    }
  }, [stopCamera, applyCenterFocusConstraint]);

  useEffect(() => {
    if (isOpen && unfilledSlots.length > 0) {
      startCamera();
      ensureLocalOcrWorker();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, unfilledSlots.length > 0, startCamera, stopCamera, ensureLocalOcrWorker]);

  useEffect(() => {
    return () => {
      if (tesseractWorkerRef.current) {
        try {
          tesseractWorkerRef.current.terminate();
        } catch {}
        tesseractWorkerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen && unfilledSlots.length === 0) {
      stopCamera();
      onToggleOpen();
    }
  }, [isOpen, unfilledSlots.length, stopCamera, onToggleOpen]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
    } catch {}
  };

  const processRecognizedResult = useCallback(
    (ocrResult: AssetNumberOcrResult) => {
      if (unfilledSlots.length === 0 || !ocrResult.success) return false;

      const rawDisplay =
        ocrResult.matchedCandidate ||
        ocrResult.assetNo ||
        ocrResult.serialNo ||
        ocrResult.rawTokens?.[0] ||
        '';
      if (!rawDisplay) return false;

      const targetMatches = matchRecognizedAssetFromPool(
        ocrResult,
        targetModelAvailableAssets,
        mappedAssetIds
      );

      if (targetMatches.exactMatch) {
        const matchedAsset = targetMatches.exactMatch;
        const slot = resolveTargetSlotForAsset(matchedAsset);
        if (slot) {
          try {
            if (navigator.vibrate) navigator.vibrate(70);
          } catch {}
          cooldownUntilRef.current = Date.now() + 1300;
          onSequentialFill(matchedAsset, slot.caId, rawDisplay);
          return true;
        }
      }

      return false;
    },
    [
      unfilledSlots.length,
      targetModelAvailableAssets,
      mappedAssetIds,
      resolveTargetSlotForAsset,
      onSequentialFill
    ]
  );

  const captureAndAnalyzeLocalFrame = useCallback(async () => {
    if (inFlightRef.current || unfilledSlots.length === 0) return;
    if (Date.now() < cooldownUntilRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    inFlightRef.current = true;

    try {
      // 1. 화면에 실제 렌더링된 70px 컨테이너(object-fit: cover) 영역과 1:1 일치하는 비디오 픽셀 영역 역산
      const cw = video.clientWidth || 360;
      const ch = video.clientHeight || 70;
      const coverScale = Math.max(cw / vw, ch / vh);
      const visibleVideoW = Math.min(vw, cw / coverScale);
      const visibleVideoH = Math.min(vh, ch / coverScale);

      // 중앙 녹색 가로선(top: 50%) 주변 슬릿 영역만 정밀 크롭 (화면 밖 영역 원천 배제)
      const cropW = Math.max(120, Math.floor(visibleVideoW * 0.88));
      const cropH = Math.max(40, Math.floor(visibleVideoH * 0.72));
      const cropX = Math.max(0, Math.floor((vw - cropW) / 2));
      const cropY = Math.max(0, Math.floor((vh - cropH) / 2));

      const targetW = Math.min(640, cropW);
      const targetH = Math.max(72, Math.floor((cropH / cropW) * targetW));
      canvas.width = targetW;
      canvas.height = targetH;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

      const centerY = targetH / 2;

      // 2. BarcodeDetector도 원본 video가 아닌 크롭된 중앙 슬릿 canvas만 판독 + 중앙선 근접순 정렬
      if ('BarcodeDetector' in window) {
        try {
          const BarcodeDetectorCls = (window as any).BarcodeDetector;
          const detector = new BarcodeDetectorCls({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13']
          });
          const barcodes = await detector.detect(canvas);
          if (Array.isArray(barcodes) && barcodes.length > 0) {
            const sortedBarcodes = [...barcodes].sort((a: any, b: any) => {
              const ay = a?.boundingBox ? a.boundingBox.y + a.boundingBox.height / 2 : centerY;
              const by = b?.boundingBox ? b.boundingBox.y + b.boundingBox.height / 2 : centerY;
              return Math.abs(ay - centerY) - Math.abs(by - centerY);
            });
            const rawVals = sortedBarcodes
              .map((b: any) => String(b?.rawValue || '').trim())
              .filter(Boolean);
            if (rawVals.length > 0) {
              const matched = processRecognizedResult({
                success: true,
                assetNo: rawVals[0],
                rawTokens: rawVals
              });
              if (matched) return;
            }
          }
        } catch {}
      }

      // 3. TextDetector: 중앙 가로선(centerY)에 가장 가까운 텍스트 블록부터 최우선 정렬 후 판독
      if ('TextDetector' in window) {
        try {
          const TextDetectorCls = (window as any).TextDetector;
          const textDetector = new TextDetectorCls();
          const detectedBlocks = await textDetector.detect(canvas);
          if (Array.isArray(detectedBlocks) && detectedBlocks.length > 0) {
            const sortedBlocks = [...detectedBlocks].sort((a: any, b: any) => {
              const ay = a?.boundingBox ? a.boundingBox.y + a.boundingBox.height / 2 : centerY;
              const by = b?.boundingBox ? b.boundingBox.y + b.boundingBox.height / 2 : centerY;
              return Math.abs(ay - centerY) - Math.abs(by - centerY);
            });
            const joined = sortedBlocks.map((b: any) => String(b.rawValue || '')).join(' ');
            const tokens = extractAlphanumericTokens(joined);
            if (tokens.length > 0) {
              const matched = processRecognizedResult({
                success: true,
                assetNo: tokens[0],
                rawTokens: tokens
              });
              if (matched) return;
            }
          }
        } catch {}
      }

      // 4. 로컬 Tesseract OCR: 라인별 Y좌표를 기준으로 중앙 가로선(centerY)에 걸친 텍스트 최우선 추출
      preprocessCanvasForLocalOcr(ctx, targetW, targetH);
      const worker = await ensureLocalOcrWorker();
      if (worker) {
        const { data } = await worker.recognize(canvas);
        let orderedText = data?.text || '';
        if (Array.isArray(data?.lines) && data.lines.length > 1) {
          const sortedLines = [...data.lines].sort((a: any, b: any) => {
            const ay = a?.bbox ? (a.bbox.y0 + a.bbox.y1) / 2 : centerY;
            const by = b?.bbox ? (b.bbox.y0 + b.bbox.y1) / 2 : centerY;
            return Math.abs(ay - centerY) - Math.abs(by - centerY);
          });
          orderedText = sortedLines.map((l: any) => String(l?.text || '')).join(' ');
        }
        const tokens = extractAlphanumericTokens(orderedText);
        if (tokens.length > 0) {
          processRecognizedResult({
            success: true,
            assetNo: tokens[0],
            rawTokens: tokens
          });
        }
      }
    } catch {
      // 프레임 무시
    } finally {
      inFlightRef.current = false;
    }
  }, [unfilledSlots.length, processRecognizedResult, ensureLocalOcrWorker]);

  useEffect(() => {
    if (!isOpen || !cameraReady || unfilledSlots.length === 0) return;
    const timer = setInterval(() => {
      captureAndAnalyzeLocalFrame();
    }, 800);
    return () => clearInterval(timer);
  }, [isOpen, cameraReady, unfilledSlots.length, captureAndAnalyzeLocalFrame]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    inFlightRef.current = true;
    try {
      const worker = await ensureLocalOcrWorker();
      if (worker) {
        const { data } = await worker.recognize(file);
        const tokens = extractAlphanumericTokens(data?.text || '');
        if (tokens.length > 0) {
          const hit = processRecognizedResult({
            success: true,
            assetNo: tokens[0],
            rawTokens: tokens
          });
          if (hit) return;
        }
      }
      const candidateAssetNos = targetModelAvailableAssets
        .map(a => a.assetNo)
        .filter(Boolean)
        .slice(0, 80);
      const ocrResult = await analyzeAssetNumberFrame(file, {
        expectedModels: targetExpectedModels,
        candidateAssetNos
      });
      processRecognizedResult(ocrResult);
    } finally {
      inFlightRef.current = false;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen || unfilledSlots.length === 0) {
    return null;
  }

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden border border-emerald-500/80 bg-black"
      style={{ height: '70px', minHeight: '70px', maxHeight: '70px' }}
      onClick={() => {
        applyCenterFocusConstraint();
        captureAndAnalyzeLocalFrame();
      }}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{ width: '100%', height: '70px', objectFit: 'cover', display: 'block' }}
      />
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* 상하단 비인식 외곽 음영 가이드 & 중앙 녹색 수평 초점 조준선 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(2,6,23,0.45) 0%, rgba(2,6,23,0) 18%, rgba(2,6,23,0) 82%, rgba(2,6,23,0.45) 100%)',
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '6%',
          right: '6%',
          top: '50%',
          transform: 'translateY(-50%)',
          height: '1.5px',
          backgroundColor: '#10b981',
          boxShadow: '0 0 6px rgba(16, 185, 129, 0.85)',
          pointerEvents: 'none'
        }}
      />

      {/* 우상단 최소 제어 버튼 */}
      <div
        className="flex items-center gap-1"
        style={{ position: 'absolute', top: '4px', right: '6px', zIndex: 10 }}
      >
        {torchSupported && (
          <button
            type="button"
            onClick={toggleTorch}
            className={`p-1 rounded bg-slate-900/80 border ${
              torchOn
                ? 'text-amber-300 border-amber-400'
                : 'text-slate-200 border-slate-700'
            }`}
            aria-label="조명"
          >
            <Flashlight className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleOpen}
          className="p-1 rounded bg-slate-900/80 text-slate-200 border border-slate-700"
          aria-label="닫기"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {cameraError && (
        <div
          className="bg-slate-950/95 flex items-center justify-center"
          style={{ position: 'absolute', inset: 0 }}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1 rounded-lg bg-cyan-600 text-white font-bold text-xs flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>사진 촬영으로 관리번호 인식</span>
          </button>
        </div>
      )}
    </div>
  );
};
