// src/mobile/components/MobileInlineCameraAssetScanner.tsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Pause,
  Play,
  Flashlight,
  Upload,
  Power
} from 'lucide-react';
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
 * 카메라 ROI 캔버스 이미지를 고대비 흑백(Grayscale + Contrast Stretching)으로 전처리하여
 * 브라우저 내장 온디바이스 OCR(Tesseract WASM)의 관리번호 인식률을 극대화한다.
 */
function preprocessCanvasForLocalOcr(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 명암 대비 강화를 위한 최소/최대 휘도 계산
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
    // 정규화 및 S-커브 대비 강화
    const norm = ((lum - minLum) / range) * 255;
    const contrasted = Math.max(0, Math.min(255, (norm - 128) * 1.45 + 128));
    data[i] = contrasted;
    data[i + 1] = contrasted;
    data[i + 2] = contrasted;
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * 로컬 OCR 텍스트에서 관리번호/자산번호 후보 토큰 추출
 */
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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [autoScanActive, setAutoScanActive] = useState(true);
  const [isScanningFrame, setIsScanningFrame] = useState(false);
  const [localOcrReady, setLocalOcrReady] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [bannerState, setBannerState] = useState<{
    type: 'info' | 'success' | 'warn' | 'error';
    text: string;
  }>({
    type: 'info',
    text: '브라우저 내장 OCR(VLM 미호출 · 비용 0원)로 관리번호를 실시간 판독하여 위 슬롯에 순차 입력합니다.'
  });
  const [ambiguousCandidates, setAmbiguousCandidates] = useState<Asset[]>([]);

  // 현재 우선 채울 타겟 슬롯 및 요구 모델 목록
  const currentTargetSlot = useMemo(() => {
    if (unfilledSlots.length === 0) return null;
    if (focusedSlotCaId) {
      const found = unfilledSlots.find(s => s.caId === focusedSlotCaId);
      if (found) return found;
    }
    return unfilledSlots[0];
  }, [unfilledSlots, focusedSlotCaId]);

  const targetExpectedModels = useMemo(() => {
    return Array.from(new Set(unfilledSlots.map(s => s.expectedModel).filter(Boolean)));
  }, [unfilledSlots]);

  // 현재 미할당 슬롯들의 요구 모델과 일치하고 아직 매핑되지 않은 가용 장비 풀
  const targetModelAvailableAssets = useMemo(() => {
    if (unfilledSlots.length === 0) return [];
    return allAvailableAssets.filter(
      a =>
        !mappedAssetIds.includes(a.id) &&
        targetExpectedModels.some(m => isModelMatch(a.modelName, m))
    );
  }, [allAvailableAssets, unfilledSlots.length, mappedAssetIds, targetExpectedModels]);

  // 스캔된 장비에 대해 채워넣을 슬롯 결정 (포커스된 슬롯 우선 -> 모델 일치 첫 번째 빈 슬롯)
  const resolveTargetSlotForAsset = useCallback(
    (asset: Asset): UnfilledSlotInfo | null => {
      if (currentTargetSlot && isModelMatch(asset.modelName, currentTargetSlot.expectedModel)) {
        return currentTargetSlot;
      }
      return unfilledSlots.find(s => isModelMatch(asset.modelName, s.expectedModel)) || null;
    },
    [currentTargetSlot, unfilledSlots]
  );

  // 브라우저 내장 WebAssembly OCR 워커 초기화 (카메라가 켜질 때만 지연 로드)
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
      setLocalOcrReady(true);
      return worker;
    } catch (err) {
      console.warn('[MobileInlineCameraAssetScanner] 로컬 WASM OCR 초기화 실패:', err);
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

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraReady(false);
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('카메라 스트림을 지원하지 않는 브라우저입니다. 우측 [사진] 버튼을 사용해 주세요.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
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
      if (track && typeof track.getCapabilities === 'function') {
        const caps = track.getCapabilities() as any;
        if (caps && caps.torch) {
          setTorchSupported(true);
        }
      }
    } catch (err: any) {
      console.warn('[MobileInlineCameraAssetScanner] 카메라 시작 실패:', err);
      setCameraError('카메라 권한이 거부되었거나 사용할 수 없습니다. 우측 [사진] 버튼으로 촬영해 주세요.');
    }
  }, [stopCamera]);

  // 사용자가 카메라 열기(isOpen=true)를 눌렀고 빈 슬롯이 있을 때만 카메라 및 로컬 OCR 가동
  useEffect(() => {
    if (isOpen && unfilledSlots.length > 0) {
      setAutoScanActive(true);
      startCamera();
      ensureLocalOcrWorker();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, unfilledSlots.length > 0, startCamera, stopCamera, ensureLocalOcrWorker]);

  // 컴포넌트 언마운트 시 로컬 WASM 워커 메모리 해제
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

  // 모든 슬롯이 채워지면 카메라를 즉시 자동 종료하여 불필요한 켜짐 방지
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

  // 인식 결과 처리 및 순차 슬롯 자동 채움
  const processRecognizedResult = useCallback(
    (ocrResult: AssetNumberOcrResult, isSilenceOnMiss = false) => {
      if (unfilledSlots.length === 0 || !ocrResult.success) return false;

      const rawDisplay =
        ocrResult.matchedCandidate ||
        ocrResult.assetNo ||
        ocrResult.serialNo ||
        ocrResult.rawTokens?.[0] ||
        '';
      if (!rawDisplay) return false;

      // 1. 이미 현재 슬롯들에 매핑 완료된 장비인지 확인
      const alreadyMappedPool = allAvailableAssets.filter(a => mappedAssetIds.includes(a.id));
      const alreadyMatched = matchRecognizedAssetFromPool(ocrResult, alreadyMappedPool, []);
      if (alreadyMatched.exactMatch) {
        const dupAsset = alreadyMatched.exactMatch;
        setBannerState({
          type: 'info',
          text: `이미 슬롯에 채워진 관리번호입니다: ${dupAsset.assetNo} (${dupAsset.modelName}) — 다음 장비를 비춰주세요.`
        });
        return true;
      }

      // 2. 할당해야 할 대상 모델 풀(targetModelAvailableAssets)에서 매칭 검사
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
            if (navigator.vibrate) navigator.vibrate(90);
          } catch {}
          setAmbiguousCandidates([]);
          setBannerState({
            type: 'success',
            text: `[슬롯 #${slot.slotNumber} 자동 채움] 관리번호 ${matchedAsset.assetNo} (${matchedAsset.modelName}) 매핑 완료!`
          });
          cooldownUntilRef.current = Date.now() + 1400;
          onSequentialFill(matchedAsset, slot.caId, rawDisplay);
          return true;
        }
      }

      if (targetMatches.candidates.length > 0) {
        setAmbiguousCandidates(targetMatches.candidates.slice(0, 4));
        setBannerState({
          type: 'warn',
          text: `'${rawDisplay}' 인식됨 — 아래 후보 중 터치하여 슬롯에 채우세요.`
        });
        return true;
      }

      // 3. 다른 모델 장비인지 확인
      const otherModelMatches = matchRecognizedAssetFromPool(
        ocrResult,
        allAvailableAssets,
        mappedAssetIds
      );
      if (otherModelMatches.exactMatch) {
        const wrongAsset = otherModelMatches.exactMatch;
        setAmbiguousCandidates([]);
        setBannerState({
          type: 'error',
          text: `모델 불일치: 스캔된 ${wrongAsset.assetNo}(${wrongAsset.modelName})는 대상 모델(${targetExpectedModels.join(', ')})이 아닙니다.`
        });
        return true;
      }

      if (!isSilenceOnMiss) {
        setBannerState({
          type: 'warn',
          text: `인식된 '${rawDisplay}'와 일치하는 임대가능(${targetExpectedModels.join(', ')}) 장비가 없습니다.`
        });
      }
      return false;
    },
    [
      unfilledSlots.length,
      allAvailableAssets,
      mappedAssetIds,
      targetModelAvailableAssets,
      resolveTargetSlotForAsset,
      onSequentialFill,
      targetExpectedModels
    ]
  );

  /**
   * 100% 브라우저 내장 온디바이스 프레임 스캔 (VLM 호출 0건, 비용 0원)
   * 순서: 1) BarcodeDetector (QR/바코드) -> 2) Native TextDetector (Shape Detection API) -> 3) Tesseract WASM
   */
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
    setIsScanningFrame(true);

    try {
      // 1단계: 브라우저 내장 BarcodeDetector (0ms, 비용 0원)
      if ('BarcodeDetector' in window) {
        try {
          const BarcodeDetectorCls = (window as any).BarcodeDetector;
          const detector = new BarcodeDetectorCls({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13']
          });
          const barcodes = await detector.detect(video);
          if (Array.isArray(barcodes) && barcodes.length > 0) {
            const rawVal = String(barcodes[0].rawValue || '').trim();
            if (rawVal) {
              processRecognizedResult(
                {
                  success: true,
                  assetNo: rawVal,
                  rawTokens: [rawVal]
                },
                true
              );
              return;
            }
          }
        } catch {}
      }

      // 중앙 스캔 가이드 영역(ROI: 가로 82%, 세로 46%) 크롭
      const cropW = Math.floor(vw * 0.82);
      const cropH = Math.floor(vh * 0.46);
      const cropX = Math.floor((vw - cropW) / 2);
      const cropY = Math.floor((vh - cropH) / 2);

      const targetW = Math.min(600, cropW);
      const targetH = Math.max(160, Math.floor((cropH / cropW) * targetW));
      canvas.width = targetW;
      canvas.height = targetH;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

      // 2단계: 브라우저 내장 OS TextDetector (Shape Detection API 지원 시 즉시 판독)
      if ('TextDetector' in window) {
        try {
          const TextDetectorCls = (window as any).TextDetector;
          const textDetector = new TextDetectorCls();
          const detectedBlocks = await textDetector.detect(canvas);
          if (Array.isArray(detectedBlocks) && detectedBlocks.length > 0) {
            const joined = detectedBlocks.map((b: any) => String(b.rawValue || '')).join(' ');
            const tokens = extractAlphanumericTokens(joined);
            if (tokens.length > 0) {
              const matched = processRecognizedResult(
                {
                  success: true,
                  assetNo: tokens[0],
                  rawTokens: tokens
                },
                true
              );
              if (matched) return;
            }
          }
        } catch {}
      }

      // 3단계: 브라우저 내장 WebAssembly OCR (Tesseract.js - 외부 서버 통신 없음)
      preprocessCanvasForLocalOcr(ctx, targetW, targetH);
      const worker = await ensureLocalOcrWorker();
      if (worker) {
        const { data } = await worker.recognize(canvas);
        const tokens = extractAlphanumericTokens(data?.text || '');
        if (tokens.length > 0) {
          processRecognizedResult(
            {
              success: true,
              assetNo: tokens[0],
              rawTokens: tokens
            },
            true
          );
        }
      }
    } catch {
      // 로컬 프레임 스캔 중 일시 오류는 무시하고 다음 프레임 계속 진행
    } finally {
      inFlightRef.current = false;
      setIsScanningFrame(false);
    }
  }, [unfilledSlots.length, processRecognizedResult, ensureLocalOcrWorker]);

  // 0.75초 주기 브라우저 내장 온디바이스 연속 스캔 루프 (VLM 호출 0건)
  useEffect(() => {
    if (!isOpen || !cameraReady || !autoScanActive || unfilledSlots.length === 0) return;
    const timer = setInterval(() => {
      captureAndAnalyzeLocalFrame();
    }, 750);
    return () => clearInterval(timer);
  }, [isOpen, cameraReady, autoScanActive, unfilledSlots.length, captureAndAnalyzeLocalFrame]);

  // (보조) 훼손 명판용 수동 1회 AI 정밀판독 버튼 (사용자가 직접 누를 때만 1회 호출)
  const handleManualAiFallback = async () => {
    if (inFlightRef.current || unfilledSlots.length === 0) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    inFlightRef.current = true;
    setIsScanningFrame(true);
    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cropW = Math.floor(vw * 0.82);
      const cropH = Math.floor(vh * 0.48);
      const cropX = Math.floor((vw - cropW) / 2);
      const cropY = Math.floor((vh - cropH) / 2);
      canvas.width = Math.min(640, cropW);
      canvas.height = Math.max(180, Math.floor((cropH / cropW) * canvas.width));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
      const candidateAssetNos = targetModelAvailableAssets
        .map(a => a.assetNo)
        .filter(Boolean)
        .slice(0, 80);
      const ocrResult = await analyzeAssetNumberFrame(dataUrl, {
        expectedModels: targetExpectedModels,
        candidateAssetNos
      });
      processRecognizedResult(ocrResult, false);
    } finally {
      inFlightRef.current = false;
      setIsScanningFrame(false);
    }
  };

  // 사진 촬영/선택 시에도 브라우저 내장 OCR 우선 판독
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanningFrame(true);
    inFlightRef.current = true;
    try {
      const worker = await ensureLocalOcrWorker();
      if (worker) {
        const { data } = await worker.recognize(file);
        const tokens = extractAlphanumericTokens(data?.text || '');
        if (tokens.length > 0) {
          const hit = processRecognizedResult(
            {
              success: true,
              assetNo: tokens[0],
              rawTokens: tokens
            },
            false
          );
          if (hit) return;
        }
      }
      // 로컬 OCR로 매칭되지 않은 경우에만 1회 보조 판독
      const candidateAssetNos = targetModelAvailableAssets
        .map(a => a.assetNo)
        .filter(Boolean)
        .slice(0, 80);
      const ocrResult = await analyzeAssetNumberFrame(file, {
        expectedModels: targetExpectedModels,
        candidateAssetNos
      });
      processRecognizedResult(ocrResult, false);
    } catch (err: any) {
      setBannerState({
        type: 'error',
        text: `사진 판독 실패: ${err?.message || '알 수 없는 오류'}`
      });
    } finally {
      inFlightRef.current = false;
      setIsScanningFrame(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 카메라가 꺼져 있을 때: 깔끔한 1줄 실행 바만 노출 (무의미하게 상시 켜져 있지 않음)
  if (!isOpen) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-slate-800 text-cyan-400 flex items-center justify-center shrink-0 border border-slate-700">
            <Camera className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-200 whitespace-nowrap">
              카메라 관리번호 스캔 (현재 꺼짐 · 브라우저 내장 OCR)
            </span>
            <span className="text-[11px] text-slate-400 truncate">
              필요할 때만 카메라를 켜서 위 슬롯({targetExpectedModels.join(', ')})을 순차 채웁니다
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleOpen}
          className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 border border-cyan-400/60 shadow-sm whitespace-nowrap shrink-0"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>카메라 켜기</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border-2 border-cyan-600/80 rounded-xl overflow-hidden shadow-lg flex flex-col">
      {/* ── 상단 컨트롤 바 (한 줄 컴팩트 헤더) ── */}
      <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-cyan-600 text-white flex items-center justify-center shrink-0">
            <Camera className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-black text-slate-100 whitespace-nowrap shrink-0">
              내장 OCR 스캔
            </span>
            {currentTargetSlot && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold whitespace-nowrap shrink-0">
                슬롯 #{currentTargetSlot.slotNumber} ({currentTargetSlot.expectedModel})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {unfilledSlots.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setAutoScanActive(prev => !prev)}
                className={`px-2 py-1 rounded text-[11px] font-bold border flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  autoScanActive
                    ? 'bg-slate-800 text-amber-300 border-slate-700'
                    : 'bg-emerald-700 text-white border-emerald-500'
                }`}
              >
                {autoScanActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>{autoScanActive ? '일시정지' : '재개'}</span>
              </button>
              <button
                type="button"
                onClick={handleManualAiFallback}
                disabled={!cameraReady || isScanningFrame}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-300 border border-slate-700 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
                title="글자가 훼손되어 내장 OCR로 안 읽힐 때만 1회 정밀 판독"
              >
                <Zap className="w-3 h-3" />
                <span>정밀판독</span>
              </button>
              {torchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-1 rounded border ${
                    torchOn
                      ? 'bg-amber-500 text-slate-950 border-amber-300'
                      : 'bg-slate-800 text-slate-200 border-slate-700'
                  }`}
                  title="조명 켜기/끄기"
                >
                  <Flashlight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Upload className="w-3 h-3" />
                <span>사진</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onToggleOpen}
            className="px-2 py-1 rounded bg-rose-900/80 hover:bg-rose-800 text-rose-100 border border-rose-700 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <Power className="w-3 h-3" />
            <span>카메라 끄기</span>
          </button>
        </div>
      </div>

      {/* ── 하단 컴팩트 카메라 뷰파인더 영역 (165px 고정 높이) ── */}
      <div className="flex flex-col">
        {unfilledSlots.length > 0 ? (
          <div className="relative w-full h-44 bg-black overflow-hidden flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
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

            {/* 중앙 스캔 타겟 가이드 박스 */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[82%] h-[54%] border-2 border-cyan-400 rounded-xl shadow-[0_0_0_9999px_rgba(2,6,23,0.48)] relative flex flex-col justify-between p-1.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 text-[10px] font-black whitespace-nowrap">
                    관리번호 스캔 영역{' '}
                    {currentTargetSlot
                      ? `➔ 슬롯 #${currentTargetSlot.slotNumber} (${currentTargetSlot.expectedModel})`
                      : ''}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap flex items-center gap-1 ${
                      isScanningFrame
                        ? 'bg-cyan-500 text-slate-950'
                        : autoScanActive
                        ? 'bg-emerald-600/90 text-white'
                        : 'bg-slate-800/90 text-slate-300'
                    }`}
                  >
                    {isScanningFrame ? (
                      <>
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        <span>내장OCR 판독중</span>
                      </>
                    ) : autoScanActive ? (
                      <span>{localOcrReady ? '내장OCR 가동중' : 'OCR 엔진 준비중'}</span>
                    ) : (
                      <span>일시정지됨</span>
                    )}
                  </span>
                </div>

                {autoScanActive && cameraReady && (
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />
                )}

                <div className="text-center text-[10px] text-cyan-200 font-semibold drop-shadow">
                  대상 모델({targetExpectedModels.join(', ')}) 관리번호 일치 시 위 슬롯에 순차 자동 입력
                </div>
              </div>
            </div>

            {cameraError && (
              <div className="absolute inset-0 bg-slate-950/90 p-3 flex flex-col items-center justify-center text-center gap-2">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
                <p className="text-xs font-bold text-slate-200">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>카메라 사진 촬영으로 판독</span>
                </button>
              </div>
            )}
          </div>
        ) : null}

        {/* 실시간 판독 상태 피드백 바 */}
        <div
          className={`px-3 py-2 text-xs font-bold flex items-center gap-2 border-t ${
            bannerState.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-700'
              : bannerState.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-700'
              : bannerState.type === 'warn'
              ? 'bg-amber-950/90 text-amber-200 border-amber-700'
              : 'bg-slate-950 text-slate-300 border-slate-800'
          }`}
        >
          {bannerState.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : bannerState.type === 'error' || bannerState.type === 'warn' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <Camera className="w-4 h-4 text-cyan-400 shrink-0" />
          )}
          <span className="flex-1 leading-snug">{bannerState.text}</span>
        </div>

        {/* 유사 번호 복수 후보 발생 시 1줄 원터치 선택 바 */}
        {ambiguousCandidates.length > 0 && (
          <div className="px-3 py-2 bg-slate-950 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-amber-300 whitespace-nowrap shrink-0">
              후보 선택:
            </span>
            {ambiguousCandidates.map(candAsset => (
              <button
                key={candAsset.id}
                type="button"
                onClick={() => {
                  const slot = resolveTargetSlotForAsset(candAsset);
                  if (slot) {
                    setAmbiguousCandidates([]);
                    setBannerState({
                      type: 'success',
                      text: `[슬롯 #${slot.slotNumber} 채움] 관리번호 ${candAsset.assetNo} (${candAsset.modelName}) 매핑 완료!`
                    });
                    onSequentialFill(candAsset, slot.caId, candAsset.assetNo);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-cyan-900/80 hover:bg-cyan-700 text-cyan-100 border border-cyan-500 text-xs font-black font-mono whitespace-nowrap shrink-0"
              >
                {candAsset.assetNo} ({candAsset.modelName})
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
