// src/mobile/components/MobileInlineCameraAssetScanner.tsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Flashlight, Upload, X, RefreshCw } from 'lucide-react';
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

/**
 * 로컬 Tesseract OCR 전용 오프스크린 캔버스 대비 보정
 * 원본 캔버스를 훼손하지 않고 별도 캔버스에서만 수행하며, 중앙 녹색선 영역 기준으로 명암비를 보정한다.
 */
function createPreprocessedCanvasForLocalOcr(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const offCanvas = document.createElement('canvas');
  offCanvas.width = width;
  offCanvas.height = height;
  const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return sourceCanvas;

  ctx.drawImage(sourceCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 중앙 60% 영역의 휘도 분포를 기준으로 min/max 산출 (좌우 외곽 배경 노이즈 배제)
  const xStart = Math.floor(width * 0.2);
  const xEnd = Math.ceil(width * 0.8);
  const yStart = Math.floor(height * 0.15);
  const yEnd = Math.ceil(height * 0.85);

  let minLum = 255;
  let maxLum = 0;
  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }
  }
  const range = Math.max(20, maxLum - minLum);

  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const norm = Math.max(0, Math.min(255, ((lum - minLum) / range) * 255));
    const contrasted = Math.max(0, Math.min(255, (norm - 128) * 1.35 + 128));
    data[i] = contrasted;
    data[i + 1] = contrasted;
    data[i + 2] = contrasted;
  }

  ctx.putImageData(imgData, 0, 0);
  return offCanvas;
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
  const localInFlightRef = useRef<boolean>(false);
  const visionInFlightRef = useRef<boolean>(false);
  const lastVisionCallAtRef = useRef<number>(0);
  const cooldownUntilRef = useRef<number>(0);
  const tesseractWorkerRef = useRef<any>(null);
  const workerInitializingRef = useRef<boolean>(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [isVisionScanning, setIsVisionScanning] = useState(false);
  const [lastDetectedHint, setLastDetectedHint] = useState<string>('');

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
      let createWorkerFn: any = (window as any)?.Tesseract?.createWorker;
      if (!createWorkerFn) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector('script[data-tesseract-cdn="1"]') as HTMLScriptElement | null;
          if (existing) {
            if ((window as any)?.Tesseract?.createWorker) {
              resolve();
              return;
            }
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('CDN load error')), { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
          script.async = true;
          script.setAttribute('data-tesseract-cdn', '1');
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('CDN load error'));
          document.head.appendChild(script);
        });
        createWorkerFn = (window as any)?.Tesseract?.createWorker;
      }
      if (!createWorkerFn) return null;

      const worker = await createWorkerFn('eng');
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-',
        // PSM 7: 중앙 녹색 횡선에 맞춘 단일 라인 관리번호 인식 최적화
        tessedit_pageseg_mode: '7' as any
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
      }
      // 중앙 수평 조준선(0.5, 0.5)에 광학 초점 고정
      if (caps?.pointsOfInterest !== undefined) {
        advancedConstraint.pointsOfInterest = [{ x: 0.5, y: 0.5 }];
      }
      if (Object.keys(advancedConstraint).length > 0) {
        await targetTrack.applyConstraints({ advanced: [advancedConstraint as any] });
      }
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
      // iPadOS Safari/WebKit 호환성 보장: getUserMedia에는 표준 해상도/후면카메라 제약만 전달하고
      // 초점(focusMode)은 스트림 획득 후 applyConstraints로 적용
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
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
          try {
            const caps = track.getCapabilities() as any;
            if (caps && caps.torch) {
              setTorchSupported(true);
            }
          } catch {}
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
    (ocrResult: AssetNumberOcrResult): boolean => {
      if (unfilledSlots.length === 0 || !ocrResult.success) return false;

      const rawDisplay =
        ocrResult.matchedCandidate ||
        ocrResult.assetNo ||
        ocrResult.serialNo ||
        ocrResult.rawTokens?.[0] ||
        '';
      if (!rawDisplay) return false;

      setLastDetectedHint(rawDisplay);

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
          cooldownUntilRef.current = Date.now() + 1400;
          setLastDetectedHint(`${matchedAsset.assetNo} 할당 완료`);
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

  /**
   * 화면에 표시된 130pt 카메라 뷰포트의 중앙 녹색 횡선(top: 50%) 주변 영역을
   * 종횡비 왜곡 없이 1:1 역산하여 캔버스에 크롭
   */
  const cropCenterGreenLineToCanvas = useCallback((): {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    targetW: number;
    targetH: number;
  } | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    const rect = video.getBoundingClientRect();
    const cw = rect.width || video.clientWidth || 360;
    const ch = rect.height || video.clientHeight || 130;

    // object-fit: cover 스케일 역산 (비디오 중심과 화면 중심은 항상 (vw/2, vh/2) === (cw/2, ch/2)로 일치)
    const coverScale = Math.max(cw / vw, ch / vh);

    // 아이패드처럼 화면 가로폭(cw)이 넓은 기기에서도 좌우 불필요한 배경이 들어오지 않도록
    // 중앙 녹색 횡선 가이드 박스(최대 가로 440pt, 세로 중앙 72pt 대역)만 정확히 추출
    const guideCssW = Math.min(cw * 0.84, 440);
    const guideCssH = Math.min(ch * 0.62, 84);

    const cropW = Math.max(160, Math.min(vw, Math.round(guideCssW / coverScale)));
    const cropH = Math.max(60, Math.min(vh, Math.round(guideCssH / coverScale)));
    const cropX = Math.max(0, Math.round((vw - cropW) / 2));
    const cropY = Math.max(0, Math.round((vh - cropH) / 2));

    // 원본 픽셀 종횡비(cropH / cropW)를 100% 보존하여 글자 찌그러짐 원천 차단
    const targetW = Math.min(720, cropW);
    const targetH = Math.max(48, Math.round((cropH / cropW) * targetW));

    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

    return { canvas, ctx, targetW, targetH };
  }, []);

  /**
   * iPadOS Safari 등 브라우저 내장 TextDetector/BarcodeDetector 미지원 환경을 위한
   * 서버 Vision AI (/api/vision-ocr) 병행 판독 (Tesseract WASM 로딩 대기 없이 즉시 병렬 실행)
   */
  const triggerVisionAiFallback = useCallback(
    async (base64Jpeg: string, forceImmediate = false) => {
      if (!base64Jpeg || visionInFlightRef.current || unfilledSlots.length === 0) return;
      if (Date.now() < cooldownUntilRef.current) return;

      const now = Date.now();
      if (!forceImmediate && now - lastVisionCallAtRef.current < 1300) return;

      visionInFlightRef.current = true;
      lastVisionCallAtRef.current = now;
      setIsVisionScanning(true);

      try {
        const candidateAssetNos = targetModelAvailableAssets
          .map(a => a.assetNo)
          .filter(Boolean)
          .slice(0, 100);

        const ocrResult = await analyzeAssetNumberFrame(base64Jpeg, {
          expectedModels: targetExpectedModels,
          candidateAssetNos
        });

        if (Date.now() >= cooldownUntilRef.current) {
          processRecognizedResult(ocrResult);
        }
      } catch {
        // 네트워크 일시 오류 무시
      } finally {
        visionInFlightRef.current = false;
        setIsVisionScanning(false);
      }
    },
    [unfilledSlots.length, targetModelAvailableAssets, targetExpectedModels, processRecognizedResult]
  );

  const captureAndAnalyzeLocalFrame = useCallback(
    async (forceVisionAi = false) => {
      if (unfilledSlots.length === 0) return;
      if (Date.now() < cooldownUntilRef.current) return;

      const cropped = cropCenterGreenLineToCanvas();
      if (!cropped) return;
      const { canvas, targetH } = cropped;
      const centerY = targetH / 2;
      const cleanSnapshotBase64 = canvas.toDataURL('image/jpeg', 0.86);

      // iPadOS Safari 등 TextDetector 미지원 기기이거나 수동 터치 시 즉시 Vision AI 병렬 호출
      const hasNativeDetector = 'TextDetector' in window || 'BarcodeDetector' in window;
      if (forceVisionAi || !hasNativeDetector) {
        triggerVisionAiFallback(cleanSnapshotBase64, forceVisionAi);
      }

      if (localInFlightRef.current) return;
      localInFlightRef.current = true;

      try {
        // 1. BarcodeDetector (지원 브라우저: 갤럭시/Android Chrome 등)
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

        // 2. TextDetector (지원 브라우저: 갤럭시/Android Chrome 등)
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

        // 3. 로컬 Tesseract OCR (원본 캔버스를 보존한 채 오프스크린 캔버스에서 대비 보정 후 판독)
        const worker = await ensureLocalOcrWorker();
        if (worker) {
          const ocrCanvas = createPreprocessedCanvasForLocalOcr(canvas);
          const { data } = await worker.recognize(ocrCanvas);
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
            const matched = processRecognizedResult({
              success: true,
              assetNo: tokens[0],
              rawTokens: tokens
            });
            if (matched) return;
          }
        }

        // 4. 내장 디텍터 보유 기기에서도 로컬 판독 미매칭 시 서버 Vision AI 폴백 수행
        if (hasNativeDetector) {
          triggerVisionAiFallback(cleanSnapshotBase64, false);
        }
      } catch {
        // 프레임 무시
      } finally {
        localInFlightRef.current = false;
      }
    },
    [
      unfilledSlots.length,
      cropCenterGreenLineToCanvas,
      processRecognizedResult,
      ensureLocalOcrWorker,
      triggerVisionAiFallback
    ]
  );

  useEffect(() => {
    if (!isOpen || !cameraReady || unfilledSlots.length === 0) return;
    const timer = setInterval(() => {
      captureAndAnalyzeLocalFrame(false);
    }, 750);
    return () => clearInterval(timer);
  }, [isOpen, cameraReady, unfilledSlots.length, captureAndAnalyzeLocalFrame]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    localInFlightRef.current = true;
    setIsVisionScanning(true);
    try {
      const candidateAssetNos = targetModelAvailableAssets
        .map(a => a.assetNo)
        .filter(Boolean)
        .slice(0, 100);
      const ocrResult = await analyzeAssetNumberFrame(file, {
        expectedModels: targetExpectedModels,
        candidateAssetNos
      });
      if (processRecognizedResult(ocrResult)) return;

      const worker = await ensureLocalOcrWorker();
      if (worker) {
        const { data } = await worker.recognize(file);
        const tokens = extractAlphanumericTokens(data?.text || '');
        if (tokens.length > 0) {
          processRecognizedResult({
            success: true,
            assetNo: tokens[0],
            rawTokens: tokens
          });
        }
      }
    } finally {
      localInFlightRef.current = false;
      setIsVisionScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen || unfilledSlots.length === 0) {
    return null;
  }

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-emerald-500/80 bg-black"
      style={{ height: '130px', minHeight: '130px', maxHeight: '130px' }}
      onClick={() => {
        applyCenterFocusConstraint();
        captureAndAnalyzeLocalFrame(true);
      }}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          width: '100%',
          height: '130px',
          objectFit: 'cover',
          objectPosition: 'center center',
          display: 'block'
        }}
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

      {/* 상하단 비인식 외곽 음영 가이드 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(2,6,23,0.62) 0%, rgba(2,6,23,0.08) 22%, rgba(2,6,23,0.08) 78%, rgba(2,6,23,0.62) 100%)',
          pointerEvents: 'none'
        }}
      />

      {/* 중앙 판독 타겟 가이드 박스 + 녹색 수평 초점 조준선 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}
      >
        <div
          style={{
            width: '84%',
            maxWidth: '440px',
            height: '76px',
            border: isVisionScanning
              ? '1.5px solid rgba(34, 211, 238, 0.85)'
              : '1.5px solid rgba(16, 185, 129, 0.65)',
            borderRadius: '10px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              width: '96%',
              height: '2px',
              backgroundColor: isVisionScanning ? '#22d3ee' : '#10b981',
              boxShadow: isVisionScanning
                ? '0 0 8px rgba(34, 211, 238, 0.95)'
                : '0 0 8px rgba(16, 185, 129, 0.9)'
            }}
          />
        </div>
      </div>

      {/* 좌하단 판독 상태 표시 (아이패드/모바일 실시간 피드백) */}
      <div
        className="flex items-center gap-1.5"
        style={{
          position: 'absolute',
          bottom: '6px',
          left: '8px',
          zIndex: 10,
          pointerEvents: 'none'
        }}
      >
        <span className="px-2 py-0.5 rounded bg-slate-950/85 border border-slate-700 text-[11px] font-bold text-emerald-300 flex items-center gap-1 whitespace-nowrap">
          {isVisionScanning && <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />}
          <span>
            {lastDetectedHint
              ? `인식: ${lastDetectedHint}`
              : currentTargetSlot?.expectedModel
              ? `대상: ${currentTargetSlot.expectedModel} (녹색선에 번호 맞춤)`
              : '녹색선에 관리번호 맞춤'}
          </span>
        </span>
      </div>

      {/* 우상단 제어 버튼 */}
      <div
        className="flex items-center gap-1.5"
        style={{ position: 'absolute', top: '6px', right: '8px', zIndex: 10 }}
        onClick={e => e.stopPropagation()}
      >
        {torchSupported && (
          <button
            type="button"
            onClick={toggleTorch}
            className={`p-1.5 rounded-lg bg-slate-900/85 border ${
              torchOn
                ? 'text-amber-300 border-amber-400'
                : 'text-slate-200 border-slate-700'
            }`}
            aria-label="조명"
          >
            <Flashlight className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-1 rounded-lg bg-slate-900/85 text-cyan-300 border border-slate-700 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap"
          aria-label="사진 촬영"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>사진판독</span>
        </button>
        <button
          type="button"
          onClick={onToggleOpen}
          className="p-1.5 rounded-lg bg-slate-900/85 text-slate-200 border border-slate-700"
          aria-label="닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {cameraError && (
        <div
          className="bg-slate-950/95 flex items-center justify-center"
          style={{ position: 'absolute', inset: 0, zIndex: 20 }}
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-cyan-600 text-white font-bold text-xs flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            <span>사진 촬영으로 관리번호 인식</span>
          </button>
        </div>
      )}
    </div>
  );
};
