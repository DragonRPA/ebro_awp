import React, { useState, useMemo } from 'react';
import {
  X,
  Truck,
  Check,
  Plus,
  Trash2,
  Mic,
  MicOff,
  FileText,
  Printer,
  Send,
  MessageSquare,
  Copy,
  Sun,
  Navigation,
  ArrowUp,
  ArrowDown,
  Link2,
  Unlink,
  RotateCcw,
} from 'lucide-react';
import {
  Delivery,
  Asset,
  Customer,
  TransportCompany,
  TransportDriver,
  VEHICLE_TYPE_OPTIONS,
} from '../../services/db';
import {
  AssignedVehicleRow,
  DispatchCategoryType,
  CATEGORY_QUICK_OPTIONS,
  TIME_SLOT_QUICK_OPTIONS,
  COST_DELTA_QUICK_OPTIONS,
  CUSTOMER_DIRECT_TRANSPORT,
  SELF_DIRECT_TRANSPORT,
  OutboundReadinessResult,
  getNormalizedDeliveryStatus,
  getOriginalDeliveryCategoryLabel,
  getDateOffsetStr,
} from './MobileDispatchHelpers';

interface MobileDispatchStudioSheetProps {
  isOpen: boolean;
  delivery: Delivery | null;
  onClose: () => void;
  // Form states controlled by parent
  dispatchCategory: DispatchCategoryType;
  setDispatchCategory: (cat: DispatchCategoryType) => void;
  loadingDate: string;
  setLoadingDate: (d: string) => void;
  loadingTimeSlot: string;
  setLoadingTimeSlot: (t: string) => void;
  unloadingDate: string;
  setUnloadingDate: (d: string) => void;
  unloadingTimeSlot: string;
  setUnloadingTimeSlot: (t: string) => void;
  originAddress: string;
  setOriginAddress: (addr: string) => void;
  destinationAddress: string;
  setDestinationAddress: (addr: string) => void;
  closingMemo: string;
  setClosingMemo: (m: string) => void;
  billableToCust: boolean;
  setBillableToCust: (b: boolean) => void;
  billableCustId: string;
  setBillableCustId: (id: string) => void;
  assignedVehicles: AssignedVehicleRow[];
  onVehicleFieldChange: (index: number, field: keyof AssignedVehicleRow, value: any) => void;
  onSelectDriverQuick: (index: number, driver: TransportDriver) => void;
  onAddVehicleRow: () => void;
  onRemoveVehicleRow: (index: number) => void;
  selectedReturnAssetIds: string[];
  onToggleReturnAsset: (asset: Asset) => void;
  availableReturnAssets: Asset[];
  // Master data
  transportCompanies: TransportCompany[];
  transportDrivers: TransportDriver[];
  customers: Customer[];
  canViewCost: boolean;
  readiness: OutboundReadinessResult;
  // Bundle controls
  bundleGroupDeliveries: Delivery[];
  bundleCandidateDeliveries: Delivery[];
  onSelectDelivery: (d: Delivery) => void;
  onMoveBundleStopOrder: (deliveryId: string, dir: 'UP' | 'DOWN') => Promise<void>;
  onRemoveSingleFromBundle: (deliveryId: string) => Promise<void>;
  onUnbundleEntireGroup: (bundleGroupId: string) => Promise<void>;
  onAddDeliveryToCurrentBundle: (addDeliveryId: string) => Promise<void>;
  // Voice & Transcript
  isListening: boolean;
  onToggleVoiceRecognition: () => void;
  onApplyDriverTranscript: (text: string, vehicleIdx: number) => void;
  // Actions
  isSaving: boolean;
  onSaveDispatch: (sendSmsAfter: boolean) => Promise<void>;
  onCompleteLoading: (deliveryId: string) => Promise<void>;
  onRevertLoading: (deliveryId: string) => Promise<void>;
  onCancelOrRevertDelivery: (deliveryId: string) => Promise<void>;
  onSendSms: (d: Delivery) => void;
  onCopyKakao: (d: Delivery) => void;
  onCopyDriverPortal: (d: Delivery) => void;
  onRemotePrint: (d: Delivery, docType: 'OUTBOUND' | 'INBOUND') => void;
  onOpenWeather: (address: string, title?: string) => void;
  onOpenNav: (address: string) => void;
  getCustomerNameForDelivery: (d: Delivery) => string;
}

export const MobileDispatchStudioSheet: React.FC<MobileDispatchStudioSheetProps> = ({
  isOpen,
  delivery,
  onClose,
  dispatchCategory,
  setDispatchCategory,
  loadingDate,
  setLoadingDate,
  loadingTimeSlot,
  setLoadingTimeSlot,
  unloadingDate,
  setUnloadingDate,
  unloadingTimeSlot,
  setUnloadingTimeSlot,
  originAddress,
  setOriginAddress,
  destinationAddress,
  setDestinationAddress,
  closingMemo,
  setClosingMemo,
  assignedVehicles,
  onVehicleFieldChange,
  onSelectDriverQuick,
  onAddVehicleRow,
  onRemoveVehicleRow,
  selectedReturnAssetIds,
  onToggleReturnAsset,
  availableReturnAssets,
  transportCompanies,
  transportDrivers,
  canViewCost,
  readiness,
  bundleGroupDeliveries,
  bundleCandidateDeliveries,
  onSelectDelivery,
  onMoveBundleStopOrder,
  onRemoveSingleFromBundle,
  onUnbundleEntireGroup,
  onAddDeliveryToCurrentBundle,
  isListening,
  onToggleVoiceRecognition,
  onApplyDriverTranscript,
  isSaving,
  onSaveDispatch,
  onCompleteLoading,
  onRevertLoading,
  onCancelOrRevertDelivery,
  onSendSms,
  onCopyKakao,
  onCopyDriverPortal,
  onRemotePrint,
  onOpenWeather,
  onOpenNav,
  getCustomerNameForDelivery,
}) => {
  const [activeVehicleIdx, setActiveVehicleIdx] = useState<number>(0);
  const [showPasteBox, setShowPasteBox] = useState<boolean>(false);
  const [pastedText, setPastedText] = useState<string>('');
  const [showBundlePicker, setShowBundlePicker] = useState<boolean>(false);

  const safeVehicleIdx = Math.min(activeVehicleIdx, Math.max(0, assignedVehicles.length - 1));
  const currentVeh = assignedVehicles[safeVehicleIdx] || {
    id: 'v-0',
    transportCompany: '',
    vehicleType: '3.5T',
    vehicleNo: '',
    driverName: '',
    driverContact: '',
    expectedCost: 0,
    finalCost: 0,
    deliveryCost: 0,
  };

  const selectedCompanyName = (currentVeh.transportCompany || '').trim();

  // 선택된 운송사에 등록된 운송기사 목록 필터링
  const registeredDriversForCompany = useMemo(() => {
    if (!selectedCompanyName || selectedCompanyName === CUSTOMER_DIRECT_TRANSPORT) {
      return [];
    }
    const compObj = transportCompanies.find(
      (c) => (c.name || '').trim() === selectedCompanyName
    );
    if (compObj) {
      return transportDrivers.filter((d) => d.companyId === compObj.id);
    }
    if (selectedCompanyName === SELF_DIRECT_TRANSPORT) {
      const selfComp = transportCompanies.find(
        (c) => (c.name || '').includes('자차') || (c.name || '').includes('직영')
      );
      if (selfComp) {
        return transportDrivers.filter((d) => d.companyId === selfComp.id);
      }
    }
    return [];
  }, [transportDrivers, transportCompanies, selectedCompanyName]);

  if (!isOpen || !delivery) return null;

  const normStatus = getNormalizedDeliveryStatus(delivery);
  const isBundled = bundleGroupDeliveries.length >= 2;
  const todayStr = getDateOffsetStr(0);
  const tomorrowStr = getDateOffsetStr(1);
  const dayAfterStr = getDateOffsetStr(2);
  const currentCost =
    Number(currentVeh.finalCost) > 0
      ? Number(currentVeh.finalCost)
      : Number(currentVeh.expectedCost) || 0;

  const handleSetCostQuick = (val: number) => {
    const safeVal = Math.max(0, val);
    onVehicleFieldChange(safeVehicleIdx, 'expectedCost', safeVal);
    onVehicleFieldChange(safeVehicleIdx, 'finalCost', safeVal);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9500,
        width: '100vw',
        height: '100dvh',
        backgroundColor: '#0b0f19',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 1. 상단 고정 헤더 */}
      <div
        style={{
          padding: 'max(10px, env(safe-area-inset-top, 10px)) 14px 10px',
          borderBottom: '1px solid #334155',
          backgroundColor: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '6px',
            minWidth: 0,
            flex: 1,
          }}
        >
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 900,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {dispatchCategory}
          </span>
          {readiness.isOutboundLike && readiness.badgeLabel && (
            <span
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                backgroundColor: readiness.ready
                  ? 'rgba(16, 185, 129, 0.2)'
                  : readiness.stage === 'REJECTED'
                  ? 'rgba(244, 63, 94, 0.2)'
                  : 'rgba(245, 158, 11, 0.2)',
                border: readiness.ready
                  ? '1px solid rgba(52, 211, 153, 0.5)'
                  : readiness.stage === 'REJECTED'
                  ? '1px solid rgba(251, 113, 133, 0.5)'
                  : '1px solid rgba(251, 191, 36, 0.5)',
                color: readiness.ready
                  ? '#6ee7b7'
                  : readiness.stage === 'REJECTED'
                  ? '#fda4af'
                  : '#fcd34d',
              }}
            >
              {readiness.badgeLabel}
            </span>
          )}
          {delivery.loadingCompletedAt && (
            <span
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid rgba(251, 191, 36, 0.5)',
                color: '#fcd34d',
                fontSize: '11px',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              상차완료
            </span>
          )}
          <span
            style={{
              fontSize: '14px',
              fontWeight: 800,
              color: '#f8fafc',
              wordBreak: 'keep-all',
            }}
          >
            {getCustomerNameForDelivery(delivery)}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: '#1e293b',
            border: '1px solid #475569',
            color: '#f1f5f9',
            fontSize: '12px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <X size={16} />
          <span>닫기</span>
        </button>
      </div>

      {/* 2. 상하 스크롤 본문 영역 (좌우 스크롤 없음, 하단 줄바꿈 배치) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          padding: '12px 12px 28px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* 2-1. 차량 · 운송기사 · 차종 · 운송료 배정 섹션 (최우선 배치) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: '#111827',
            padding: '14px',
            borderRadius: '14px',
            border: '1px solid #2563eb',
          }}
        >
          {/* 호차 선택 탭 & 음성/붙여넣기 (좌우 스크롤 없이 아래로 줄바꿈) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '6px',
              paddingBottom: '8px',
              borderBottom: '1px solid #1e293b',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              {assignedVehicles.map((v, idx) => {
                const active = safeVehicleIdx === idx;
                return (
                  <button
                    key={v.id || idx}
                    type="button"
                    onClick={() => setActiveVehicleIdx(idx)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 800,
                      backgroundColor: active ? '#2563eb' : '#1e293b',
                      border: active ? '1px solid #60a5fa' : '1px solid #334155',
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}호차{v.driverName ? ` · ${v.driverName}` : ''}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  onAddVehicleRow();
                  setActiveVehicleIdx(assignedVehicles.length);
                }}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 800,
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <Plus size={14} />
                <span>호차추가</span>
              </button>
              {assignedVehicles.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    onRemoveVehicleRow(safeVehicleIdx);
                    setActiveVehicleIdx(Math.max(0, safeVehicleIdx - 1));
                  }}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(127, 29, 29, 0.5)',
                    border: '1px solid rgba(248, 113, 113, 0.4)',
                    color: '#fca5a5',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={14} />
                  <span>삭제</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              <button
                type="button"
                onClick={onToggleVoiceRecognition}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: isListening ? '#dc2626' : '#1e293b',
                  border: '1px solid #475569',
                  color: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                <span>{isListening ? '음성인식중' : '음성입력'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPasteBox((v) => !v)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  color: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <FileText size={14} />
                <span>문구붙여넣기</span>
              </button>
            </div>
          </div>

          {showPasteBox && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="text"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="기사명 연락처 차량번호 차종 운송료 문구 붙여넣기"
                style={{
                  flex: 1,
                  backgroundColor: '#0b0f19',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  fontSize: '13px',
                  color: '#ffffff',
                }}
              />
              <button
                type="button"
                onClick={() => {
                  onApplyDriverTranscript(pastedText, safeVehicleIdx);
                  setPastedText('');
                  setShowPasteBox(false);
                }}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                적용
              </button>
            </div>
          )}

          {/* [입력 순서 1] 운송사 선택 (좌우 스크롤 없이 아래로 줄바꿈 배치) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              style={{
                fontSize: '13px',
                fontWeight: 800,
                color: '#93c5fd',
                margin: 0,
                whiteSpace: 'nowrap',
              }}
            >
              1. 운송사 선택
            </label>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
              }}
            >
              {[
                CUSTOMER_DIRECT_TRANSPORT,
                SELF_DIRECT_TRANSPORT,
                ...transportCompanies.map((c) => c.name),
              ].map((compName) => {
                const active = selectedCompanyName === compName;
                const isCustDirect = compName === CUSTOMER_DIRECT_TRANSPORT;
                return (
                  <button
                    key={compName}
                    type="button"
                    onClick={() => onVehicleFieldChange(safeVehicleIdx, 'transportCompany', compName)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 800,
                      backgroundColor: active
                        ? isCustDirect
                          ? '#0d9488'
                          : '#2563eb'
                        : '#0b0f19',
                      border: active
                        ? isCustDirect
                          ? '1px solid #2dd4bf'
                          : '1px solid #60a5fa'
                        : '1px solid #334155',
                      color: active ? '#ffffff' : '#e2e8f0',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {compName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* [입력 순서 2] 운송사가 선택되면 등록된 운송사의 운송기사 선택 또는 자유입력 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              paddingTop: '8px',
              borderTop: '1px solid #1e293b',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '6px',
              }}
            >
              <label
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: '#93c5fd',
                  margin: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                2. 운송기사 선택 또는 자유입력
              </label>
              {selectedCompanyName && (
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#38bdf8',
                    whiteSpace: 'nowrap',
                  }}
                >
                  선택 운송사: {selectedCompanyName}
                </span>
              )}
            </div>

            {/* 선택된 운송사에 등록된 운송기사 버튼 목록 (좌우 스크롤 없이 아래로 줄바꿈 배치) */}
            {selectedCompanyName === CUSTOMER_DIRECT_TRANSPORT ? (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(13, 148, 136, 0.15)',
                  border: '1px solid rgba(45, 212, 191, 0.4)',
                  color: '#5eead4',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                고객직접운송이 선택되었습니다. 필요 시 아래에 차량번호·연락처를 자유입력할 수 있습니다.
              </div>
            ) : !selectedCompanyName ? (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#0b0f19',
                  border: '1px solid #1e293b',
                  color: '#94a3b8',
                  fontSize: '12px',
                }}
              >
                위에서 운송사를 선택하면 등록된 운송기사 목록이 표시되며, 아래에 직접 입력도 가능합니다.
              </div>
            ) : registeredDriversForCompany.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                {registeredDriversForCompany.map((drv) => {
                  const active =
                    (currentVeh.driverName || '').trim() === drv.driverName.trim() &&
                    (!drv.vehicleNo || currentVeh.vehicleNo === drv.vehicleNo);
                  return (
                    <button
                      key={drv.id}
                      type="button"
                      onClick={() => onSelectDriverQuick(safeVehicleIdx, drv)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 800,
                        backgroundColor: active ? '#0284c7' : '#0b0f19',
                        border: active ? '1px solid #38bdf8' : '1px solid #334155',
                        color: active ? '#ffffff' : '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      <span>{drv.driverName}</span>
                      {drv.vehicleType && (
                        <span style={{ fontSize: '11px', color: active ? '#fde68a' : '#fbbf24' }}>
                          {drv.vehicleType}
                        </span>
                      )}
                      {drv.vehicleNo && (
                        <span style={{ fontSize: '11px', color: active ? '#e0f2fe' : '#94a3b8' }}>
                          {drv.vehicleNo}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#0b0f19',
                  border: '1px solid #1e293b',
                  color: '#94a3b8',
                  fontSize: '12px',
                }}
              >
                해당 운송사에 등록된 기사가 없습니다. 아래 입력란에 자유입력해 주세요.
              </div>
            )}

            {/* 운송기사 자유입력 (기사명 / 차량번호 / 연락처 - 상하 스택 레이아웃) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#cbd5e1',
                    margin: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  기사명 (자유입력)
                </label>
                <input
                  type="text"
                  value={currentVeh.driverName}
                  onChange={(e) =>
                    onVehicleFieldChange(safeVehicleIdx, 'driverName', e.target.value)
                  }
                  placeholder="기사 성명 입력"
                  style={{
                    width: '100%',
                    backgroundColor: '#0b0f19',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '9px 10px',
                    fontSize: '13px',
                    color: '#ffffff',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#cbd5e1',
                    margin: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  차량번호 (자유입력)
                </label>
                <input
                  type="text"
                  value={currentVeh.vehicleNo}
                  onChange={(e) =>
                    onVehicleFieldChange(safeVehicleIdx, 'vehicleNo', e.target.value)
                  }
                  placeholder="예: 경기88바1234"
                  style={{
                    width: '100%',
                    backgroundColor: '#0b0f19',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '9px 10px',
                    fontSize: '13px',
                    color: '#ffffff',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#cbd5e1',
                  margin: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                기사 연락처 (자유입력)
              </label>
              <input
                type="tel"
                value={currentVeh.driverContact}
                onChange={(e) =>
                  onVehicleFieldChange(safeVehicleIdx, 'driverContact', e.target.value)
                }
                placeholder="010-0000-0000"
                style={{
                  width: '100%',
                  backgroundColor: '#0b0f19',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '9px 10px',
                  fontSize: '13px',
                  color: '#ffffff',
                  fontFamily: 'monospace',
                }}
              />
            </div>
          </div>

          {/* [입력 순서 3] 차종 선택 (좌우 스크롤 없이 아래로 줄바꿈 배치) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              paddingTop: '8px',
              borderTop: '1px solid #1e293b',
            }}
          >
            <label
              style={{
                fontSize: '13px',
                fontWeight: 800,
                color: '#93c5fd',
                margin: 0,
                whiteSpace: 'nowrap',
              }}
            >
              3. 차종 선택
            </label>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
              }}
            >
              {VEHICLE_TYPE_OPTIONS.map((vt) => {
                const active = currentVeh.vehicleType === vt;
                return (
                  <button
                    key={vt}
                    type="button"
                    onClick={() => onVehicleFieldChange(safeVehicleIdx, 'vehicleType', vt)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 800,
                      backgroundColor: active ? '#2563eb' : '#0b0f19',
                      border: active ? '1px solid #60a5fa' : '1px solid #334155',
                      color: active ? '#ffffff' : '#e2e8f0',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {vt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* [입력 순서 4] 운송료 입력 ("0", "+1만", "+5만", "+10만" 4개 퀵버튼만 지원, 당사/고객부담 선택 제거) */}
          {canViewCost && selectedCompanyName !== CUSTOMER_DIRECT_TRANSPORT && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingTop: '8px',
                borderTop: '1px solid #1e293b',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <label
                  style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#93c5fd',
                    margin: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  4. 운송료 입력
                </label>
                <span
                  style={{
                    fontSize: '15px',
                    fontWeight: 900,
                    color: '#34d399',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ₩{currentCost.toLocaleString()}원
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: '6px',
                }}
              >
                {COST_DELTA_QUICK_OPTIONS.map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() =>
                      handleSetCostQuick(btn.isReset ? 0 : currentCost + btn.delta)
                    }
                    style={{
                      padding: '10px 6px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 900,
                      backgroundColor: btn.isReset ? '#1e293b' : '#065f46',
                      border: btn.isReset ? '1px solid #475569' : '1px solid #10b981',
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                      textAlign: 'center',
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              <input
                type="number"
                value={currentCost || ''}
                onChange={(e) => handleSetCostQuick(Math.max(0, Number(e.target.value) || 0))}
                placeholder="운송료 직접 입력 (원)"
                style={{
                  width: '100%',
                  backgroundColor: '#0b0f19',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  fontSize: '13px',
                  color: '#ffffff',
                  fontFamily: 'monospace',
                }}
              />
            </div>
          )}
        </div>

        {/* 2-2. 구분 선택 (아래로 줄바꿈 배치) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            backgroundColor: '#111827',
            padding: '12px',
            borderRadius: '14px',
            border: '1px solid #1e293b',
          }}
        >
          <label
            style={{
              fontSize: '12px',
              fontWeight: 800,
              color: '#cbd5e1',
              margin: 0,
              whiteSpace: 'nowrap',
            }}
          >
            배차 구분
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {CATEGORY_QUICK_OPTIONS.map((cat) => {
              const active = dispatchCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setDispatchCategory(cat)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 800,
                    backgroundColor: active ? '#2563eb' : '#0b0f19',
                    border: active ? '1px solid #60a5fa' : '1px solid #334155',
                    color: active ? '#ffffff' : '#cbd5e1',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* 반납 시 임차장비 선택 */}
        {dispatchCategory === '반납' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              backgroundColor: '#111827',
              padding: '12px',
              borderRadius: '14px',
              border: '1px solid rgba(244, 63, 94, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#fda4af',
                  margin: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                반납 임차장비
              </label>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1' }}>
                {selectedReturnAssetIds.length}대 선택
              </span>
            </div>
            {availableReturnAssets.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>반납 가능 임차장비 없음</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {availableReturnAssets.map((a) => {
                  const selected = selectedReturnAssetIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onToggleReturnAsset(a)}
                      style={{
                        padding: '7px 10px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        backgroundColor: selected ? '#e11d48' : '#0b0f19',
                        border: selected ? '1px solid #fb7185' : '1px solid #334155',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {selected && <Check size={12} />}
                      <span>{a.modelName}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                        ({a.assetNo})
                      </span>
                      {a.renter && (
                        <span style={{ fontSize: '11px', color: '#fde68a' }}>· {a.renter}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2-3. 상차 · 하차 일시 및 주소 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            backgroundColor: '#111827',
            padding: '12px',
            borderRadius: '14px',
            border: '1px solid #1e293b',
          }}
        >
          {/* 상차일시 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '6px',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#7dd3fc',
                  whiteSpace: 'nowrap',
                }}
              >
                상차일시
              </span>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  { label: '오늘', val: todayStr },
                  { label: '내일', val: tomorrowStr },
                  { label: '모레', val: dayAfterStr },
                ].map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => {
                      setLoadingDate(d.val);
                      if (unloadingDate < d.val) setUnloadingDate(d.val);
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor: loadingDate === d.val ? '#0284c7' : '#0b0f19',
                      border:
                        loadingDate === d.val ? '1px solid #38bdf8' : '1px solid #334155',
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
                <input
                  type="date"
                  value={loadingDate}
                  onChange={(e) => setLoadingDate(e.target.value)}
                  style={{
                    width: 'auto',
                    backgroundColor: '#0b0f19',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    fontSize: '12px',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {TIME_SLOT_QUICK_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLoadingTimeSlot(t)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: loadingTimeSlot === t ? '#2563eb' : '#0b0f19',
                    border: loadingTimeSlot === t ? '1px solid #60a5fa' : '1px solid #334155',
                    color: loadingTimeSlot === t ? '#ffffff' : '#cbd5e1',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 하차일시 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              paddingTop: '8px',
              borderTop: '1px solid #1e293b',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '6px',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#6ee7b7',
                  whiteSpace: 'nowrap',
                }}
              >
                하차일시
              </span>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  { label: '상차동일', val: loadingDate },
                  { label: '오늘', val: todayStr },
                  { label: '내일', val: tomorrowStr },
                ].map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => setUnloadingDate(d.val)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor: unloadingDate === d.val ? '#059669' : '#0b0f19',
                      border:
                        unloadingDate === d.val ? '1px solid #34d399' : '1px solid #334155',
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
                <input
                  type="date"
                  value={unloadingDate}
                  onChange={(e) => setUnloadingDate(e.target.value)}
                  style={{
                    width: 'auto',
                    backgroundColor: '#0b0f19',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    fontSize: '12px',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {TIME_SLOT_QUICK_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setUnloadingTimeSlot(t)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: unloadingTimeSlot === t ? '#059669' : '#0b0f19',
                    border:
                      unloadingTimeSlot === t ? '1px solid #34d399' : '1px solid #334155',
                    color: unloadingTimeSlot === t ? '#ffffff' : '#cbd5e1',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 상차지 / 하차지 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              paddingTop: '8px',
              borderTop: '1px solid #1e293b',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#cbd5e1',
                    margin: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  상차지
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setOriginAddress('당사 보관소')}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#7dd3fc',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    당사 보관소
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenNav(originAddress || '당사 보관소')}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#f1f5f9',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    내비
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={originAddress}
                onChange={(e) => setOriginAddress(e.target.value)}
                placeholder="상차지"
                style={{
                  width: '100%',
                  backgroundColor: '#0b0f19',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '9px 10px',
                  fontSize: '13px',
                  color: '#ffffff',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#cbd5e1',
                    margin: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  하차지
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setDestinationAddress('당사 보관소')}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#7dd3fc',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    당사 보관소
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenWeather(destinationAddress, getCustomerNameForDelivery(delivery))
                    }
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#fcd34d',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Sun size={12} />
                    <span>날씨</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenNav(destinationAddress)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#6ee7b7',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Navigation size={12} />
                    <span>내비</span>
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                placeholder="하차지"
                style={{
                  width: '100%',
                  backgroundColor: '#0b0f19',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '9px 10px',
                  fontSize: '13px',
                  color: '#ffffff',
                }}
              />
            </div>
          </div>
        </div>

        {/* 2-4. 경유/합짐 구성 바 */}
        <div
          style={{
            backgroundColor: '#111827',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '14px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Link2 size={15} color="#818cf8" />
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#a5b4fc',
                  whiteSpace: 'nowrap',
                }}
              >
                {isBundled ? `경유/합짐 (${bundleGroupDeliveries.length}곳)` : '경유/합짐 구성'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setShowBundlePicker((v) => !v)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}
              >
                + 합짐추가
              </button>
              {isBundled && delivery.bundleGroupId && (
                <button
                  type="button"
                  onClick={() => onUnbundleEntireGroup(delivery.bundleGroupId!)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    color: '#cbd5e1',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Unlink size={12} />
                  <span>전체해제</span>
                </button>
              )}
            </div>
          </div>

          {isBundled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {bundleGroupDeliveries.map((stop, idx) => {
                const isCurrent = stop.id === delivery.id;
                const origCat = getOriginalDeliveryCategoryLabel(stop);
                return (
                  <div
                    key={stop.id}
                    onClick={() => onSelectDelivery(stop)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: isCurrent ? 'rgba(49, 46, 129, 0.5)' : '#0b0f19',
                      border: isCurrent ? '1px solid #818cf8' : '1px solid #1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#4f46e5',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {idx + 1}순위
                      </span>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#1e293b',
                          color: '#e2e8f0',
                          fontSize: '11px',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {origCat}
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#f8fafc',
                          wordBreak: 'keep-all',
                        }}
                      >
                        {stop.destinationAddress || getCustomerNameForDelivery(stop)}
                      </span>
                    </div>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => onMoveBundleStopOrder(stop.id, 'UP')}
                        style={{
                          padding: '4px 6px',
                          borderRadius: '6px',
                          backgroundColor: '#1e293b',
                          color: '#e2e8f0',
                        }}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === bundleGroupDeliveries.length - 1}
                        onClick={() => onMoveBundleStopOrder(stop.id, 'DOWN')}
                        style={{
                          padding: '4px 6px',
                          borderRadius: '6px',
                          backgroundColor: '#1e293b',
                          color: '#e2e8f0',
                        }}
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveSingleFromBundle(stop.id)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(127, 29, 29, 0.6)',
                          border: '1px solid rgba(248, 113, 113, 0.4)',
                          color: '#fda4af',
                          fontSize: '11px',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        분리
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showBundlePicker && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '6px' }}>
              {bundleCandidateDeliveries.length === 0 ? (
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  합짐 가능한 대기/배차 건 없음
                </span>
              ) : (
                bundleCandidateDeliveries.map((cand) => (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => {
                      onAddDeliveryToCurrentBundle(cand.id);
                      setShowBundlePicker(false);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#0b0f19',
                      border: '1px solid #334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      textAlign: 'left',
                      fontSize: '12px',
                      color: '#e2e8f0',
                    }}
                  >
                    <span style={{ fontWeight: 700, wordBreak: 'keep-all' }}>
                      [{getOriginalDeliveryCategoryLabel(cand)}] {getCustomerNameForDelivery(cand)} ·{' '}
                      {cand.destinationAddress || '현장'}
                    </span>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#4f46e5',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      선택
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* 2-5. 배차 메모 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: '#cbd5e1',
              margin: 0,
              whiteSpace: 'nowrap',
            }}
          >
            배차 메모
          </label>
          <input
            type="text"
            value={closingMemo}
            onChange={(e) => setClosingMemo(e.target.value)}
            placeholder="기사 전달 메모"
            style={{
              width: '100%',
              backgroundColor: '#111827',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '9px 12px',
              fontSize: '13px',
              color: '#ffffff',
            }}
          />
        </div>

        {/* 2-6. 인쇄 · 문자 · 카톡 · 포털 퀵버튼 (좌우 스크롤 없이 아래로 줄바꿈 배치) */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
          }}
        >
          <button
            type="button"
            onClick={() => onRemotePrint(delivery, 'OUTBOUND')}
            style={{
              flex: '1 1 30%',
              padding: '9px 8px',
              borderRadius: '8px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              color: '#7dd3fc',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            <Printer size={14} />
            <span>출고인쇄</span>
          </button>
          <button
            type="button"
            onClick={() => onRemotePrint(delivery, 'INBOUND')}
            style={{
              flex: '1 1 30%',
              padding: '9px 8px',
              borderRadius: '8px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              color: '#fcd34d',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            <Printer size={14} />
            <span>입고인쇄</span>
          </button>
          <button
            type="button"
            onClick={() => onSendSms(delivery)}
            style={{
              flex: '1 1 30%',
              padding: '9px 8px',
              borderRadius: '8px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              color: '#6ee7b7',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            <Send size={14} />
            <span>문자전송</span>
          </button>
          <button
            type="button"
            onClick={() => onCopyKakao(delivery)}
            style={{
              flex: '1 1 45%',
              padding: '9px 8px',
              borderRadius: '8px',
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid rgba(251, 191, 36, 0.5)',
              color: '#fcd34d',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            <MessageSquare size={14} />
            <span>카톡복사</span>
          </button>
          <button
            type="button"
            onClick={() => onCopyDriverPortal(delivery)}
            style={{
              flex: '1 1 45%',
              padding: '9px 8px',
              borderRadius: '8px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              color: '#e2e8f0',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            <Copy size={14} />
            <span>포털링크</span>
          </button>
        </div>
      </div>

      {/* 3. 하단 고정 액션 바 */}
      <div
        style={{
          padding: '10px 12px max(12px, env(safe-area-inset-bottom, 12px))',
          borderTop: '1px solid #334155',
          backgroundColor: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onCancelOrRevertDelivery(delivery.id)}
            style={{
              padding: '11px 12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(127, 29, 29, 0.7)',
              border: '1px solid rgba(248, 113, 113, 0.4)',
              color: '#fda4af',
              fontSize: '13px',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {normStatus === 'DISPATCHED'
              ? '대기원복'
              : normStatus === 'CANCELLED'
              ? '대기원복'
              : '배차취소'}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onSaveDispatch(false)}
            style={{
              flex: 1,
              padding: '11px 12px',
              borderRadius: '10px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 900,
              whiteSpace: 'nowrap',
            }}
          >
            {isSaving ? '저장중...' : normStatus === 'PENDING' ? '배차 확정' : '배차 저장'}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onSaveDispatch(true)}
            style={{
              flex: 1,
              padding: '11px 12px',
              borderRadius: '10px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            <Send size={14} />
            <span>확정+문자</span>
          </button>
        </div>

        {normStatus === 'DISPATCHED' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {delivery.loadingCompletedAt ? (
              <>
                <button
                  type="button"
                  onClick={() => onRevertLoading(delivery.id)}
                  style={{
                    padding: '11px 12px',
                    borderRadius: '10px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    color: '#fcd34d',
                    fontSize: '13px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <RotateCcw size={14} />
                  <span>상차취소</span>
                </button>
                <button
                  type="button"
                  onClick={() => onCompleteLoading(delivery.id)}
                  style={{
                    flex: 1,
                    padding: '11px 12px',
                    borderRadius: '10px',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Check size={16} />
                  <span>운송 완료 확정</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onCompleteLoading(delivery.id)}
                style={{
                  width: '100%',
                  padding: '11px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                <Truck size={16} />
                <span>상차 완료 확정</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
