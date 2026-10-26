// src/mobile/components/MobileCameraAssetOcrModal.tsx
// 웹앱 장비 할당용 실시간 카메라 OCR (자산번호/관리번호 및 제조번호 자동 판독 모달)
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Upload,
  Check
} from 'lucide-react';
import {
  analyzeAssetNumberFrame,
  matchRecognizedAssetFromPool,
  AssetNumberOcrResult
} from '../../services/visionOcrService';

export interface ScannableAssetItem {
  id: string;
  assetNo?: string;
  serialNo?: string;
  modelName?: string;
  ownerType?: string;
  maintenanceScore?: number;
}

interface MobileCameraAssetOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableAssets: ScannableAssetItem[];
  selectedAssetIds: string[];
  requiredSlotCount: number;
  expectedModels: string[];
  onSelectAsset: (asset: ScannableAssetItem) => void;
}

export const MobileCameraAssetOcrModal: React.FC<MobileCameraAssetOcrModalProps> = ({
  isOpen,
  onClose,
  availableAssets,
  selectedAssetIds,
  requiredSlotCount,
  expectedModels,
  onSelectAsset
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isAnalyzingRef = useRef<boolean>(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [autoConfirmOnExact, setAutoConfirmOnExact] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<1 | 2>(1);
  const [cssZoomScale, setCssZoomScale] = useState<number>(1);
  const hardwareZoomAppliedRef = useRef<number>(1);

  const [lastRecognizedText, setLastRecognizedText] = useState<string>('');
  const [matchedCandidates, setMatchedCandidates] = useState<ScannableAssetItem[]>([]);
  const [recentAutoSelectedAsset, setRecentAutoSelectedAsset] = useState<ScannableAssetItem | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('카메라 중앙 프레임에 장비 관리번호(자산번호)를 맞추세요.');

  const remainingNeeded = Math.max(0, requiredSlotCount - selectedAssetIds.length);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    hardwareZoomAppliedRef.current = 1;
    setCameraReady(false);
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const applyCenterFocusConstraint = useCallback(
    async (targetZoom: 1 | 2 = zoomLevel, track?: MediaStreamTrack | null) => {
      const targetTrack = track || streamRef.current?.getVideoTracks()?.[0];
      if (!targetTrack || typeof (targetTrack as any).applyConstraints !== 'function') {
        hardwareZoomAppliedRef.current = 1;
        setCssZoomScale(targetZoom);
        return;
      }

      let hwZoom = 1;
      try {
        const caps =
          typeof (targetTrack as any).getCapabilities === 'function'
            ? (targetTrack as any).getCapabilities()
            : {};
        const advancedConstraint: Record<string, any> = {};
        if (Array.isArray(caps?.focusMode)) {
          if (caps.focusMode.includes('continuous')) {
            advancedConstraint.focusMode = 'continuous';
          } else if (caps.focusMode.includes('single-shot')) {
            advancedConstraint.focusMode = 'single-shot';
          }
        }
        if (caps?.pointsOfInterest !== undefined) {
          advancedConstraint.pointsOfInterest = [{ x: 0.5, y: 0.5 }];
        }
        if (caps?.zoom && typeof caps.zoom === 'object') {
          const minZ = typeof caps.zoom.min === 'number' ? caps.zoom.min : 1;
          const maxZ = typeof caps.zoom.max === 'number' ? caps.zoom.max : 1;
          if (maxZ > 1) {
            hwZoom = Math.min(maxZ, Math.max(minZ, targetZoom));
            advancedConstraint.zoom = hwZoom;
          }
        }
        if (Object.keys(advancedConstraint).length > 0) {
          await (targetTrack as any).applyConstraints({ advanced: [advancedConstraint] });
        }
      } catch {
        hwZoom = 1;
        try {
          await (targetTrack as any).applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
        } catch {}
      }

      hardwareZoomAppliedRef.current = hwZoom;
      const remainingCssScale = Math.max(1, Number((targetZoom / hwZoom).toFixed(2)));
      setCssZoomScale(remainingCssScale);
    },
    [zoomLevel]
  );

  const startCameraStream = useCallback(async () => {
    stopCameraStream();
    setCameraError(null);
    setStatusMessage('카메라를 초기화하는 중입니다...');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('현재 브라우저에서 실시간 카메라 스트리밍을 지원하지 않습니다. 아래 [사진 촬영 판독] 버튼을 이용해 주세요.');
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
      }

      streamRef.current = stream;
      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.setAttribute('playsinline', 'true');
        videoEl.setAttribute('webkit-playsinline', 'true');
        videoEl.srcObject = stream;
        if (videoEl.readyState < 1) {
          await new Promise<void>(resolve => {
            const timeoutId = setTimeout(resolve, 700);
            videoEl.onloadedmetadata = () => {
              clearTimeout(timeoutId);
              resolve();
            };
          });
        }
        await videoEl.play().catch(() => {});
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        if (typeof (videoTrack as any).getCapabilities === 'function') {
          try {
            const caps = (videoTrack as any).getCapabilities();
            if (caps && caps.torch) {
              setTorchSupported(true);
            }
          } catch {}
        }
        await applyCenterFocusConstraint(zoomLevel, videoTrack);
      }

      setCameraReady(true);
      setStatusMessage('실시간 자동 스캔 중 — 관리번호 스티커나 도색 번호를 중앙 녹색 선에 맞추세요.');
    } catch (err: any) {
      console.warn('[MobileCameraAssetOcrModal] getUserMedia error:', err);
      setCameraError('카메라 접근 권한이 거부되었거나 사용할 수 없습니다. 브라우저 카메라 권한을 허용하거나 아래 [사진 촬영 판독]을 눌러주세요.');
    }
  }, [stopCameraStream, applyCenterFocusConstraint, zoomLevel]);

  useEffect(() => {
    if (isOpen) {
      setLastRecognizedText('');
      setMatchedCandidates([]);
      setRecentAutoSelectedAsset(null);
      startCameraStream();
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, startCameraStream, stopCameraStream]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await (track as any).applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      setStatusMessage('이 기기에서는 손전등 제어를 지원하지 않습니다.');
    }
  };

  const toggleZoomLevel = async () => {
    const nextZoom: 1 | 2 = zoomLevel === 1 ? 2 : 1;
    setZoomLevel(nextZoom);
    await applyCenterFocusConstraint(nextZoom);
  };

  const handleProcessOcrResult = useCallback(
    (ocrRes: AssetNumberOcrResult) => {
      if (!ocrRes.success) {
        return;
      }

      const { exactMatch, candidates, recognizedLabel } = matchRecognizedAssetFromPool(
        ocrRes,
        availableAssets,
        selectedAssetIds
      );

      if (recognizedLabel) {
        setLastRecognizedText(recognizedLabel);
      }
      setMatchedCandidates(candidates);

      if (exactMatch) {
        if (selectedAssetIds.includes(exactMatch.id)) {
          setStatusMessage(`이미 선택된 장비입니다: ${exactMatch.assetNo} (${exactMatch.modelName})`);
          return;
        }

        if (autoConfirmOnExact && selectedAssetIds.length < requiredSlotCount) {
          try {
            if (navigator.vibrate) navigator.vibrate(90);
          } catch {}
          onSelectAsset(exactMatch);
          setRecentAutoSelectedAsset(exactMatch);
          setStatusMessage(`인식 및 선택 완료: ${exactMatch.assetNo} (${exactMatch.modelName})`);
        } else {
          setStatusMessage(`일치 장비 발견: ${exactMatch.assetNo} — 아래 [선택 반영]을 눌러 확정하세요.`);
        }
      } else if (candidates.length > 0) {
        setStatusMessage(`유사 후보 ${candidates.length}건 감지 (${recognizedLabel}) — 아래 목록에서 터치해 선택하세요.`);
      } else if (recognizedLabel) {
        setStatusMessage(`판독 번호 [${recognizedLabel}] — 현재 슬롯의 가용 장비 목록에 일치하는 번호가 없습니다.`);
      }
    },
    [availableAssets, selectedAssetIds, autoConfirmOnExact, requiredSlotCount, onSelectAsset]
  );

  // 비디오 프레임에서 중앙 ROI 크롭 및 판독 수행
  const captureAndAnalyzeCurrentFrame = useCallback(
    async (isManualTrigger = false) => {
      if (!videoRef.current || !canvasRef.current || isAnalyzingRef.current) return;
      const video = videoRef.current;
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

      isAnalyzingRef.current = true;
      setIsAnalyzing(true);
      if (isManualTrigger) {
        setStatusMessage('화면을 정밀 판독하는 중입니다...');
      }

      try {
        // 1. 화면에 표시된 중앙 가이드 박스(가로 84%/최대 420px, 세로 130px)의 object-fit: cover + 배율(cssZoomScale) 1:1 대응 영역 역산
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const cw = video.clientWidth || 360;
        const ch = video.clientHeight || 260;
        const effectiveScale = Math.max(cw / vw, ch / vh) * cssZoomScale;

        const guideBoxCssW = Math.min(cw * 0.84, 420);
        const guideBoxCssH = 130;
        const cropW = Math.max(160, Math.min(vw, Math.round(guideBoxCssW / effectiveScale)));
        const cropH = Math.max(64, Math.min(vh, Math.round((guideBoxCssH * 0.78) / effectiveScale)));
        const cropX = Math.max(0, Math.round((vw - cropW) / 2));
        const cropY = Math.max(0, Math.round((vh - cropH) / 2));

        const canvas = canvasRef.current;
        const targetW = Math.min(800, cropW);
        const targetH = Math.max(48, Math.round((cropH * targetW) / cropW));
        canvas.width = targetW;
        canvas.height = targetH;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          isAnalyzingRef.current = false;
          setIsAnalyzing(false);
          return;
        }

        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
        const centerY = targetH / 2;

        // 2. 브라우저 내장 BarcodeDetector: 원본 video가 아닌 크롭된 중앙 가이드 canvas만 판독 + 중앙선 근접순 정렬
        const BarcodeDetectorClass = (window as any).BarcodeDetector;
        if (BarcodeDetectorClass) {
          try {
            const detector = new BarcodeDetectorClass({
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
                handleProcessOcrResult({
                  success: true,
                  assetNo: rawVals[0],
                  rawTokens: rawVals,
                  rawText: rawVals[0],
                  confidence: 0.99
                });
                isAnalyzingRef.current = false;
                setIsAnalyzing(false);
                return;
              }
            }
          } catch {}
        }

        const base64Jpeg = canvas.toDataURL('image/jpeg', 0.84);

        const candidateAssetNos = availableAssets
          .filter(a => !selectedAssetIds.includes(a.id))
          .map(a => a.assetNo || '')
          .filter(Boolean);

        const ocrRes = await analyzeAssetNumberFrame(base64Jpeg, {
          expectedModels,
          candidateAssetNos
        });

        handleProcessOcrResult(ocrRes);
      } catch (err: any) {
        if (isManualTrigger) {
          setStatusMessage(err?.message || '판독 중 일시적 오류가 발생했습니다.');
        }
      } finally {
        isAnalyzingRef.current = false;
        setIsAnalyzing(false);
      }
    },
    [availableAssets, selectedAssetIds, expectedModels, handleProcessOcrResult, cssZoomScale]
  );

  // 실시간 자동 연속 스캔 타이머 (1.8초 주기)
  useEffect(() => {
    if (!isOpen || !cameraReady || !autoScanEnabled) return;
    if (remainingNeeded <= 0 && requiredSlotCount > 0) return;

    const timer = setInterval(() => {
      if (!isAnalyzingRef.current) {
        captureAndAnalyzeCurrentFrame(false);
      }
    }, 1800);

    return () => clearInterval(timer);
  }, [isOpen, cameraReady, autoScanEnabled, remainingNeeded, requiredSlotCount, captureAndAnalyzeCurrentFrame]);

  // 사진 촬영 / 파일 업로드 폴백 처리
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    setStatusMessage('촬영한 사진에서 관리번호를 판독하는 중입니다...');

    try {
      const candidateAssetNos = availableAssets
        .filter(a => !selectedAssetIds.includes(a.id))
        .map(a => a.assetNo || '')
        .filter(Boolean);

      const ocrRes = await analyzeAssetNumberFrame(file, {
        expectedModels,
        candidateAssetNos
      });

      if (!ocrRes.success) {
        setStatusMessage(ocrRes.error || '사진에서 관리번호를 찾지 못했습니다. 번호가 잘 보이게 다시 촬영해 주세요.');
      } else {
        handleProcessOcrResult(ocrRes);
      }
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9600,
        backgroundColor: 'rgba(2, 6, 23, 0.94)',
        display: 'flex',
        flexDirection: 'column'
      }}
      className="text-slate-100 font-sans"
    >
      {/* 상단 헤더 (아이폰 노치/다이내믹 아일랜드 Safe Area 반영) */}
      <div
        className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Camera className="w-5 h-5 text-cyan-400 shrink-0" />
          <span className="text-sm font-black text-white whitespace-nowrap truncate">
            카메라 관리번호 실시간 스캔
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-950 text-blue-300 border border-blue-800 whitespace-nowrap shrink-0">
            선택 {selectedAssetIds.length} / {requiredSlotCount}대
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          <X className="w-4 h-4" />
          <span>닫기</span>
        </button>
      </div>

      {/* 상단 요구 모델 및 자동스캔 제어 바 */}
      <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-bold whitespace-nowrap">대상 모델:</span>
          <span className="font-mono font-black text-cyan-300 whitespace-nowrap">
            {expectedModels.length > 0 ? expectedModels.join(', ') : '전체 가용 모델'}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300 font-bold whitespace-nowrap">
            가용 후보 {availableAssets.length}대
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={toggleZoomLevel}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black border whitespace-nowrap transition-colors ${
              zoomLevel === 2
                ? 'bg-emerald-700 text-white border-emerald-500'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {zoomLevel}배 확대
          </button>

          <button
            type="button"
            onClick={() => setAutoScanEnabled(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap transition-colors ${
              autoScanEnabled
                ? 'bg-emerald-700 text-white border-emerald-500'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {autoScanEnabled ? '실시간 자동스캔 켜짐' : '자동스캔 일시정지'}
          </button>

          <button
            type="button"
            onClick={() => setAutoConfirmOnExact(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap transition-colors ${
              autoConfirmOnExact
                ? 'bg-blue-700 text-white border-blue-500'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {autoConfirmOnExact ? '일치 시 즉시선택' : '수동 확인 후 선택'}
          </button>

          {torchSupported && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap ${
                torchOn
                  ? 'bg-amber-600 text-white border-amber-400'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {torchOn ? '손전등 켜짐' : '손전등 끄기'}
            </button>
          )}
        </div>
      </div>

      {/* 중앙 라이브 카메라 뷰파인더 영역 */}
      <div
        className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[240px]"
        onClick={() => {
          applyCenterFocusConstraint(zoomLevel);
          captureAndAnalyzeCurrentFrame(true);
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
          style={{
            transform: cssZoomScale > 1 ? `scale(${cssZoomScale})` : undefined,
            transformOrigin: 'center center',
            transition: 'transform 150ms ease-out'
          }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* 중앙 스캔 가이드 박스 오버레이 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              width: '84%',
              maxWidth: '420px',
              height: '130px',
              border: isAnalyzing ? '3px solid #22d3ee' : '2.5px solid #10b981',
              borderRadius: '16px',
              boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.58)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* 중앙 수평 조준선 */}
            <div
              style={{
                width: '92%',
                height: '1.5px',
                backgroundColor: isAnalyzing ? 'rgba(34, 211, 238, 0.75)' : 'rgba(16, 185, 129, 0.45)'
              }}
            />
            <span
              style={{
                position: 'absolute',
                top: '-26px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(15, 23, 42, 0.92)',
                border: '1px solid #334155',
                padding: '2px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 800,
                color: '#f8fafc',
                whiteSpace: 'nowrap'
              }}
            >
              {isAnalyzing ? '관리번호 판독 중...' : '관리번호(자산번호) 스캔 프레임'}
            </span>
          </div>
        </div>

        {/* 카메라 권한 오류 안내 */}
        {cameraError && (
          <div className="absolute inset-4 bg-slate-900/95 border border-rose-700 rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-3">
            <AlertTriangle className="w-10 h-10 text-rose-400" />
            <div className="text-sm font-bold text-white">실시간 카메라 연결 안내</div>
            <div className="text-xs text-slate-300 leading-relaxed">{cameraError}</div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={startCameraStream}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-white border border-slate-600 text-xs font-bold whitespace-nowrap"
              >
                카메라 다시 연결
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold whitespace-nowrap"
              >
                사진 촬영 판독
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 하단 판독 결과 및 매칭 후보 제어 영역 (아이폰 홈 인디케이터 Safe Area 반영) */}
      <div
        className="bg-slate-900 border-t border-slate-800 p-4 flex flex-col gap-3 max-h-[48vh] overflow-y-auto"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        {/* 상태 및 최근 판독 텍스트 */}
        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isAnalyzing ? (
              <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
            ) : recentAutoSelectedAsset ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="text-xs font-semibold text-slate-200 truncate">
              {statusMessage}
            </span>
          </div>

          {lastRecognizedText && (
            <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono text-xs font-black whitespace-nowrap shrink-0">
              인식: {lastRecognizedText}
            </span>
          )}
        </div>

        {/* 방금 자동 선택된 장비 알림 배너 */}
        {recentAutoSelectedAsset && (
          <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-600 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-black text-white font-mono">
                  {recentAutoSelectedAsset.assetNo} ({recentAutoSelectedAsset.modelName}) 선택 완료
                </span>
                <span className="text-[11px] text-emerald-300">
                  {remainingNeeded > 0
                    ? `추가로 ${remainingNeeded}대 더 스캔할 수 있습니다.`
                    : '선택한 슬롯 수량만큼 장비 선택이 모두 완료되었습니다.'}
                </span>
              </div>
            </div>

            {remainingNeeded === 0 && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black whitespace-nowrap shrink-0"
              >
                선택 완료 닫기
              </button>
            )}
          </div>
        )}

        {/* 인식된 매칭 후보 장비 목록 (1클릭 선택) */}
        {matchedCandidates.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-300">
              인식된 관리번호 매칭 후보 ({matchedCandidates.length}건)
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {matchedCandidates.map(cand => {
                const isAlreadySelected = selectedAssetIds.includes(cand.id);
                return (
                  <div
                    key={cand.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                      isAlreadySelected
                        ? 'bg-emerald-950/40 border-emerald-600 text-emerald-200'
                        : 'bg-slate-950 border-slate-700 text-slate-100'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-white whitespace-nowrap">
                          {cand.assetNo}
                        </span>
                        <span className="text-xs font-bold text-cyan-300 truncate">
                          {cand.modelName}
                        </span>
                      </div>
                      {cand.serialNo && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          제조번호: {cand.serialNo}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isAlreadySelected}
                      onClick={() => {
                        onSelectAsset(cand);
                        setRecentAutoSelectedAsset(cand);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap shrink-0 flex items-center gap-1 ${
                        isAlreadySelected
                          ? 'bg-emerald-800/60 text-emerald-200 border border-emerald-600 cursor-default'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isAlreadySelected ? '선택됨' : '선택 반영'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 수동 즉시 판독 & 사진 촬영 판독 버튼 바 */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            disabled={!cameraReady || isAnalyzing}
            onClick={() => captureAndAnalyzeCurrentFrame(true)}
            className="py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg whitespace-nowrap"
          >
            <Camera className="w-4 h-4" />
            <span>{isAnalyzing ? '판독 중...' : '현재 화면 즉시 판독'}</span>
          </button>

          <button
            type="button"
            disabled={isAnalyzing}
            onClick={() => fileInputRef.current?.click()}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Upload className="w-4 h-4 text-blue-400" />
            <span>고화질 사진 촬영 판독</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};
