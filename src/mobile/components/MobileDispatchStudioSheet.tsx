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
  COST_PRESET_QUICK_OPTIONS,
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
  billableToCust,
  setBillableToCust,
  billableCustId,
  setBillableCustId,
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
  customers,
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

  // 선택된 운송사에 속한 기사 우선 정렬
  const filteredDrivers = useMemo(() => {
    const selectedCompName = (currentVeh.transportCompany || '').trim();
    if (!selectedCompName || selectedCompName === CUSTOMER_DIRECT_TRANSPORT || selectedCompName === SELF_DIRECT_TRANSPORT) {
      return transportDrivers.slice(0, 16);
    }
    const compObj = transportCompanies.find((c) => c.name.trim() === selectedCompName);
    if (compObj) {
      const matched = transportDrivers.filter((d) => d.companyId === compObj.id);
      if (matched.length > 0) return matched;
    }
    return transportDrivers.slice(0, 16);
  }, [transportDrivers, transportCompanies, currentVeh.transportCompany]);

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
    onVehicleFieldChange(safeVehicleIdx, 'expectedCost', val);
    onVehicleFieldChange(safeVehicleIdx, 'finalCost', val);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border-t sm:border border-slate-700 w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* 1. 상단 헤더 */}
        <div className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar">
            <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-black whitespace-nowrap flex-shrink-0">
              {dispatchCategory}
            </span>
            {readiness.isOutboundLike && readiness.badgeLabel && (
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-black border whitespace-nowrap flex-shrink-0 ${
                  readiness.ready
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : readiness.stage === 'REJECTED'
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                    : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                }`}
              >
                {readiness.badgeLabel}
              </span>
            )}
            {delivery.loadingCompletedAt && (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-black whitespace-nowrap flex-shrink-0">
                상차완료
              </span>
            )}
            <span className="text-xs font-bold text-slate-200 truncate">
              {getCustomerNameForDelivery(delivery)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. 본문 스크롤 */}
        <div className="p-3 overflow-y-auto flex-1 flex flex-col gap-3">
          {/* 경유/합짐 바 */}
          <div className="bg-slate-950 border border-indigo-500/40 rounded-xl p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <span className="text-xs font-black text-indigo-300 whitespace-nowrap flex-shrink-0">
                  {isBundled ? `경유/합짐 (${bundleGroupDeliveries.length}곳)` : '경유/합짐 구성'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowBundlePicker((v) => !v)}
                  className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold whitespace-nowrap flex-shrink-0"
                >
                  + 합짐추가
                </button>
                {isBundled && delivery.bundleGroupId && (
                  <button
                    type="button"
                    onClick={() => onUnbundleEntireGroup(delivery.bundleGroupId!)}
                    className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                  >
                    <Unlink className="w-3 h-3" />
                    전체해제
                  </button>
                )}
              </div>
            </div>

            {isBundled && (
              <div className="flex flex-col gap-1">
                {bundleGroupDeliveries.map((stop, idx) => {
                  const isCurrent = stop.id === delivery.id;
                  const origCat = getOriginalDeliveryCategoryLabel(stop);
                  return (
                    <div
                      key={stop.id}
                      onClick={() => onSelectDelivery(stop)}
                      className={`p-2 rounded-lg border flex items-center justify-between gap-2 cursor-pointer ${
                        isCurrent
                          ? 'bg-indigo-950/60 border-indigo-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-black whitespace-nowrap flex-shrink-0">
                          {idx + 1}순위
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px] font-bold whitespace-nowrap flex-shrink-0">
                          {origCat}
                        </span>
                        <span className="text-xs font-bold truncate">
                          {stop.destinationAddress || getCustomerNameForDelivery(stop)}
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-1 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => onMoveBundleStopOrder(stop.id, 'UP')}
                          className="p-1 rounded bg-slate-800 text-slate-200 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === bundleGroupDeliveries.length - 1}
                          onClick={() => onMoveBundleStopOrder(stop.id, 'DOWN')}
                          className="p-1 rounded bg-slate-800 text-slate-200 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveSingleFromBundle(stop.id)}
                          className="px-1.5 py-0.5 rounded bg-rose-950 border border-rose-500/40 text-rose-300 text-[10px] font-bold whitespace-nowrap flex-shrink-0"
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
              <div className="flex flex-col gap-1 pt-1 border-t border-slate-800 max-h-32 overflow-y-auto">
                {bundleCandidateDeliveries.length === 0 ? (
                  <span className="text-[11px] text-slate-400">합짐 가능한 대기/배차 건 없음</span>
                ) : (
                  bundleCandidateDeliveries.map((cand) => (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => {
                        onAddDeliveryToCurrentBundle(cand.id);
                        setShowBundlePicker(false);
                      }}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-between text-left text-xs text-slate-200"
                    >
                      <span className="truncate font-bold">
                        [{getOriginalDeliveryCategoryLabel(cand)}] {getCustomerNameForDelivery(cand)} · {cand.destinationAddress || '현장'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-bold whitespace-nowrap flex-shrink-0 ml-2">
                        선택
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 구분 퀵버튼 */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
              구분
            </label>
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
              {CATEGORY_QUICK_OPTIONS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setDispatchCategory(cat)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-black border whitespace-nowrap flex-shrink-0 ${
                    dispatchCategory === cat
                      ? 'bg-blue-600 border-blue-400 text-white'
                      : 'bg-slate-950 border-slate-700 text-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 반납 시 임차장비 선택 퀵버튼 */}
          {dispatchCategory === '반납' && (
            <div className="flex flex-col gap-1.5 bg-slate-950 p-2.5 rounded-xl border border-rose-500/40">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-rose-300 whitespace-nowrap flex-shrink-0">
                  반납 임차장비
                </label>
                <span className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
                  {selectedReturnAssetIds.length}대 선택
                </span>
              </div>
              {availableReturnAssets.length === 0 ? (
                <div className="text-xs text-slate-400">반납 가능 임차장비 없음</div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {availableReturnAssets.map((a) => {
                    const selected = selectedReturnAssetIds.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onToggleReturnAsset(a)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
                          selected
                            ? 'bg-rose-600 border-rose-400 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-200'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3" />}
                        <span>{a.modelName}</span>
                        <span className="font-mono text-[10px]">({a.assetNo})</span>
                        {a.renter && <span className="text-[10px] text-amber-300">· {a.renter}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 상차·하차 일정 퀵버튼 */}
          <div className="grid grid-cols-1 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            {/* 상차일시 */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-sky-300 whitespace-nowrap flex-shrink-0">
                  상차일시
                </span>
                <div className="flex items-center gap-1">
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
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap flex-shrink-0 ${
                        loadingDate === d.val
                          ? 'bg-sky-600 border-sky-400 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                  <input
                    type="date"
                    value={loadingDate}
                    onChange={(e) => setLoadingDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-white font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                {TIME_SLOT_QUICK_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setLoadingTimeSlot(t)}
                    className={`px-2 py-1 rounded text-[11px] font-bold border whitespace-nowrap flex-shrink-0 ${
                      loadingTimeSlot === t
                        ? 'bg-blue-600 border-blue-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* 하차일시 */}
            <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-800">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-emerald-300 whitespace-nowrap flex-shrink-0">
                  하차일시
                </span>
                <div className="flex items-center gap-1">
                  {[
                    { label: '상차동일', val: loadingDate },
                    { label: '오늘', val: todayStr },
                    { label: '내일', val: tomorrowStr },
                  ].map((d) => (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => setUnloadingDate(d.val)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap flex-shrink-0 ${
                        unloadingDate === d.val
                          ? 'bg-emerald-600 border-emerald-400 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                  <input
                    type="date"
                    value={unloadingDate}
                    onChange={(e) => setUnloadingDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-white font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                {TIME_SLOT_QUICK_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setUnloadingTimeSlot(t)}
                    className={`px-2 py-1 rounded text-[11px] font-bold border whitespace-nowrap flex-shrink-0 ${
                      unloadingTimeSlot === t
                        ? 'bg-emerald-600 border-emerald-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 상차지 · 하차지 퀵버튼 + 입력 */}
          <div className="flex flex-col gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
                  상차지
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOriginAddress('당사 보관소')}
                    className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-sky-300 whitespace-nowrap flex-shrink-0"
                  >
                    당사 보관소
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenNav(originAddress || '당사 보관소')}
                    className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-200 whitespace-nowrap flex-shrink-0"
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
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
                  하차지
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDestinationAddress('당사 보관소')}
                    className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-sky-300 whitespace-nowrap flex-shrink-0"
                  >
                    당사 보관소
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenWeather(destinationAddress, getCustomerNameForDelivery(delivery))}
                    className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-amber-300 flex items-center gap-0.5 whitespace-nowrap flex-shrink-0"
                  >
                    <Sun className="w-3 h-3" />
                    날씨
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenNav(destinationAddress)}
                    className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-emerald-300 flex items-center gap-0.5 whitespace-nowrap flex-shrink-0"
                  >
                    <Navigation className="w-3 h-3" />
                    내비
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                placeholder="하차지"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          {/* 차량 배정 섹션 (호차 탭 + 음성/텍스트 파싱 + 운송사/기사/톤수 퀵버튼) */}
          <div className="flex flex-col gap-2.5 bg-slate-950 p-2.5 rounded-xl border border-blue-500/40">
            {/* 호차 퀵탭 + 음성/텍스트 파싱 버튼 */}
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {assignedVehicles.map((v, idx) => (
                  <button
                    key={v.id || idx}
                    type="button"
                    onClick={() => setActiveVehicleIdx(idx)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black border whitespace-nowrap flex-shrink-0 ${
                      safeVehicleIdx === idx
                        ? 'bg-blue-600 border-blue-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    {idx + 1}호차{v.driverName ? `(${v.driverName})` : ''}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    onAddVehicleRow();
                    setActiveVehicleIdx(assignedVehicles.length);
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-sky-300 text-xs font-bold flex items-center gap-0.5 whitespace-nowrap flex-shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  호차
                </button>
                {assignedVehicles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      onRemoveVehicleRow(safeVehicleIdx);
                      setActiveVehicleIdx(Math.max(0, safeVehicleIdx - 1));
                    }}
                    className="p-1 rounded-lg bg-rose-950 border border-rose-500/40 text-rose-300 flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onToggleVoiceRecognition}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-slate-800 border border-slate-700 text-slate-200'
                  }`}
                >
                  {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  {isListening ? '인식중' : '음성'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasteBox((v) => !v)}
                  className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                >
                  <FileText className="w-3 h-3" />
                  붙여넣기
                </button>
              </div>
            </div>

            {showPasteBox && (
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="기사명 연락처 차량번호 톤수 운송비 붙여넣기"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    onApplyDriverTranscript(pastedText, safeVehicleIdx);
                    setPastedText('');
                    setShowPasteBox(false);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold whitespace-nowrap flex-shrink-0"
                >
                  적용
                </button>
              </div>
            )}

            {/* 운송사 퀵버튼 */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
                운송사
              </label>
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                {[
                  CUSTOMER_DIRECT_TRANSPORT,
                  SELF_DIRECT_TRANSPORT,
                  ...transportCompanies.map((c) => c.name),
                ].map((compName) => {
                  const active = (currentVeh.transportCompany || '').trim() === compName;
                  return (
                    <button
                      key={compName}
                      type="button"
                      onClick={() => onVehicleFieldChange(safeVehicleIdx, 'transportCompany', compName)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap flex-shrink-0 ${
                        active
                          ? compName === CUSTOMER_DIRECT_TRANSPORT
                            ? 'bg-teal-600 border-teal-400 text-white'
                            : 'bg-blue-600 border-blue-400 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-200'
                      }`}
                    >
                      {compName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 등록 기사 퀵버튼 */}
            {filteredDrivers.length > 0 && currentVeh.transportCompany !== CUSTOMER_DIRECT_TRANSPORT && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
                  등록 기사
                </label>
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                  {filteredDrivers.map((drv) => {
                    const active =
                      (currentVeh.driverName || '').trim() === drv.driverName.trim() &&
                      (!drv.vehicleNo || currentVeh.vehicleNo === drv.vehicleNo);
                    return (
                      <button
                        key={drv.id}
                        type="button"
                        onClick={() => onSelectDriverQuick(safeVehicleIdx, drv)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
                          active
                            ? 'bg-sky-600 border-sky-400 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-200'
                        }`}
                      >
                        <span>{drv.driverName}</span>
                        {drv.vehicleType && (
                          <span className="text-[10px] text-amber-300">{drv.vehicleType}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 차종(톤수) 퀵버튼 */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
                차종
              </label>
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                {VEHICLE_TYPE_OPTIONS.map((vt) => (
                  <button
                    key={vt}
                    type="button"
                    onClick={() => onVehicleFieldChange(safeVehicleIdx, 'vehicleType', vt)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap flex-shrink-0 ${
                      currentVeh.vehicleType === vt
                        ? 'bg-blue-600 border-blue-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    {vt}
                  </button>
                ))}
              </div>
            </div>

            {/* 기사명 / 연락처 / 차량번호 직접 입력 */}
            <div className="grid grid-cols-3 gap-1.5">
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] font-bold text-slate-400 whitespace-nowrap flex-shrink-0">
                  기사명
                </label>
                <input
                  type="text"
                  value={currentVeh.driverName}
                  onChange={(e) => onVehicleFieldChange(safeVehicleIdx, 'driverName', e.target.value)}
                  placeholder="기사명"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] font-bold text-slate-400 whitespace-nowrap flex-shrink-0">
                  연락처
                </label>
                <input
                  type="tel"
                  value={currentVeh.driverContact}
                  onChange={(e) => onVehicleFieldChange(safeVehicleIdx, 'driverContact', e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] font-bold text-slate-400 whitespace-nowrap flex-shrink-0">
                  차량번호
                </label>
                <input
                  type="text"
                  value={currentVeh.vehicleNo}
                  onChange={(e) => onVehicleFieldChange(safeVehicleIdx, 'vehicleNo', e.target.value)}
                  placeholder="차량번호"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                />
              </div>
            </div>

            {/* 운송비 & 부담주체 퀵버튼 */}
            {canViewCost && currentVeh.transportCompany !== CUSTOMER_DIRECT_TRANSPORT && (
              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
                    운송비
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setBillableToCust(false)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap flex-shrink-0 ${
                        !billableToCust
                          ? 'bg-blue-600 border-blue-400 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                    >
                      당사부담
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillableToCust(true)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap flex-shrink-0 ${
                        billableToCust
                          ? 'bg-amber-600 border-amber-400 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                    >
                      고객부담
                    </button>
                  </div>
                </div>

                {billableToCust && customers.length > 0 && (
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                    {customers.slice(0, 10).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setBillableCustId(c.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap flex-shrink-0 ${
                          billableCustId === c.id
                            ? 'bg-amber-600 border-amber-400 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-300'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                  {COST_PRESET_QUICK_OPTIONS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleSetCostQuick(p.value)}
                      className={`px-2 py-1 rounded text-[11px] font-bold border whitespace-nowrap flex-shrink-0 ${
                        currentCost === p.value
                          ? 'bg-emerald-600 border-emerald-400 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleSetCostQuick(currentCost + 10000)}
                    className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-sky-300 text-[11px] font-bold whitespace-nowrap flex-shrink-0"
                  >
                    +1만
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetCostQuick(currentCost + 30000)}
                    className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-sky-300 text-[11px] font-bold whitespace-nowrap flex-shrink-0"
                  >
                    +3만
                  </button>
                </div>

                <input
                  type="number"
                  value={currentCost || ''}
                  onChange={(e) => handleSetCostQuick(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="운송비 직접 입력 (원)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
            )}
          </div>

          {/* 특이메모 */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
              배차 메모
            </label>
            <input
              type="text"
              value={closingMemo}
              onChange={(e) => setClosingMemo(e.target.value)}
              placeholder="기사 전달 메모"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
          </div>

          {/* 인쇄 · 문자 · 카톡 · 포털 퀵버튼 바 */}
          <div className="grid grid-cols-5 gap-1 pt-1">
            <button
              type="button"
              onClick={() => onRemotePrint(delivery, 'OUTBOUND')}
              className="py-2 px-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 text-[11px] font-bold flex items-center justify-center gap-1 whitespace-nowrap flex-shrink-0"
            >
              <Printer className="w-3 h-3" />
              출고인쇄
            </button>
            <button
              type="button"
              onClick={() => onRemotePrint(delivery, 'INBOUND')}
              className="py-2 px-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-[11px] font-bold flex items-center justify-center gap-1 whitespace-nowrap flex-shrink-0"
            >
              <Printer className="w-3 h-3" />
              입고인쇄
            </button>
            <button
              type="button"
              onClick={() => onSendSms(delivery)}
              className="py-2 px-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1 whitespace-nowrap flex-shrink-0"
            >
              <Send className="w-3 h-3" />
              문자
            </button>
            <button
              type="button"
              onClick={() => onCopyKakao(delivery)}
              className="py-2 px-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center justify-center gap-1 whitespace-nowrap flex-shrink-0"
            >
              <MessageSquare className="w-3 h-3" />
              카톡
            </button>
            <button
              type="button"
              onClick={() => onCopyDriverPortal(delivery)}
              className="py-2 px-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1 whitespace-nowrap flex-shrink-0"
            >
              <Copy className="w-3 h-3" />
              포털링크
            </button>
          </div>
        </div>

        {/* 3. 하단 액션 바 (배차저장 / 저장+문자 / 상차완료 / 취소·원복) */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onCancelOrRevertDelivery(delivery.id)}
              className="px-3 py-2.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-bold whitespace-nowrap flex-shrink-0"
            >
              {normStatus === 'DISPATCHED' ? '대기원복' : normStatus === 'CANCELLED' ? '대기원복' : '배차취소'}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onSaveDispatch(false)}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black whitespace-nowrap flex-shrink-0"
            >
              {isSaving ? '저장중...' : normStatus === 'PENDING' ? '배차 확정' : '배차 저장'}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onSaveDispatch(true)}
              className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black flex items-center justify-center gap-1 whitespace-nowrap flex-shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              확정+문자
            </button>
          </div>

          {normStatus === 'DISPATCHED' && (
            <div className="flex items-center gap-1.5">
              {delivery.loadingCompletedAt ? (
                <>
                  <button
                    type="button"
                    onClick={() => onRevertLoading(delivery.id)}
                    className="px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    상차취소
                  </button>
                  <button
                    type="button"
                    onClick={() => onCompleteLoading(delivery.id)}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1 whitespace-nowrap flex-shrink-0"
                  >
                    <Check className="w-4 h-4" />
                    운송 완료 확정
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onCompleteLoading(delivery.id)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-lg whitespace-nowrap flex-shrink-0"
                >
                  <Truck className="w-4 h-4" />
                  상차 완료 확정
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
