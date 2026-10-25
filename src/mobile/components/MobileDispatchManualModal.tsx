import React, { useState, useMemo } from 'react';
import { X, Plus, Minus, Check, Search, Truck } from 'lucide-react';
import {
  Asset,
  Contract,
  Customer,
  CustomerSite,
  Vendor,
  Product,
  VEHICLE_TYPE_OPTIONS,
} from '../../services/db';
import {
  MANUAL_CATEGORY_QUICK_OPTIONS,
  TIME_SLOT_QUICK_OPTIONS,
  COST_PRESET_QUICK_OPTIONS,
  CargoItem,
  findSubleaseVendorForAsset,
  getDateOffsetStr,
} from './MobileDispatchHelpers';
import { createHangulMatcher } from '../../utils/hangulSearch';

export interface ManualDispatchSubmitPayload {
  category: '출고' | '입고' | '교환' | '반납' | '이동' | '정비';
  customerId: string;
  contractId: string;
  loadingDate: string;
  loadingTimeSlot: string;
  unloadingDate: string;
  unloadingTimeSlot: string;
  originAddress: string;
  destinationAddress: string;
  cargos: CargoItem[];
  returnAssetIds: string[];
  vehicleType: string;
  expectedCost: number;
  billableToCustomer: boolean;
  memo: string;
}

interface MobileDispatchManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: ManualDispatchSubmitPayload) => Promise<void>;
  customers: Customer[];
  contracts: Contract[];
  sites: CustomerSite[];
  vendors: Vendor[];
  models: Product[];
  availableReturnAssets: Asset[];
  canViewCost: boolean;
}

export const MobileDispatchManualModal: React.FC<MobileDispatchManualModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  customers,
  contracts,
  sites,
  vendors,
  models,
  availableReturnAssets,
  canViewCost,
}) => {
  const todayStr = getDateOffsetStr(0);
  const tomorrowStr = getDateOffsetStr(1);
  const dayAfterStr = getDateOffsetStr(2);

  const [category, setCategory] = useState<'출고' | '입고' | '교환' | '반납' | '이동' | '정비'>('출고');
  const [customerId, setCustomerId] = useState<string>('');
  const [contractId, setContractId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState<string>('');

  const [loadingDate, setLoadingDate] = useState<string>(todayStr);
  const [loadingTimeSlot, setLoadingTimeSlot] = useState<string>('오전');
  const [unloadingDate, setUnloadingDate] = useState<string>(todayStr);
  const [unloadingTimeSlot, setUnloadingTimeSlot] = useState<string>('오전');

  const [originAddress, setOriginAddress] = useState<string>('당사 보관소');
  const [destinationAddress, setDestinationAddress] = useState<string>('');

  const [cargos, setCargos] = useState<CargoItem[]>([]);
  const [customModelInput, setCustomModelInput] = useState<string>('');
  const [returnAssetIds, setReturnAssetIds] = useState<string[]>([]);

  const [vehicleType, setVehicleType] = useState<string>('3.5T');
  const [expectedCost, setExpectedCost] = useState<number>(0);
  const [billableToCustomer, setBillableToCustomer] = useState<boolean>(false);
  const [memo, setMemo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim();
    if (!q) return customers.slice(0, 10);
    const matcher = createHangulMatcher(q);
    return customers.filter((c) => c.name && matcher(c.name)).slice(0, 12);
  }, [customers, customerSearch]);

  const customerContracts = useMemo(() => {
    if (!customerId) return [];
    return contracts
      .filter((c) => c.customerId === customerId && (c.status as string) !== 'CANCELLED')
      .slice(0, 8);
  }, [contracts, customerId]);

  const quickModels = useMemo(() => {
    const names = Array.from(
      new Set((models || []).map((m) => (m.modelName || (m as any).name || '').trim()).filter(Boolean))
    );
    return names.slice(0, 14);
  }, [models]);

  if (!isOpen) return null;

  const handleCategoryPick = (cat: '출고' | '입고' | '교환' | '반납' | '이동' | '정비') => {
    setCategory(cat);
    if (cat === '출고' || cat === '반납') {
      setOriginAddress('당사 보관소');
    } else if (cat === '입고') {
      setDestinationAddress('당사 보관소');
    }
  };

  const handleSelectCustomer = (cust: Customer) => {
    setCustomerId(cust.id);
    const cList = contracts.filter((c) => c.customerId === cust.id && (c.status as string) !== 'CANCELLED');
    if (cList.length > 0) {
      const firstC = cList[0];
      setContractId(firstC.id);
      const site = sites.find((s) => s.id === firstC.siteId);
      const addr = site?.address || site?.name || `${cust.name} 현장`;
      if (category === '입고') {
        setOriginAddress(addr);
        setDestinationAddress('당사 보관소');
      } else {
        setOriginAddress('당사 보관소');
        setDestinationAddress(addr);
      }
    } else {
      setContractId('');
      if (category !== '입고') {
        setDestinationAddress(`${cust.name} 현장`);
      }
    }
  };

  const handleSelectContract = (ct: Contract) => {
    setContractId(ct.id);
    const site = sites.find((s) => s.id === ct.siteId);
    const cust = customers.find((c) => c.id === ct.customerId);
    const addr = site?.address || site?.name || (cust ? `${cust.name} 현장` : '');
    if (category === '입고') {
      setOriginAddress(addr);
      setDestinationAddress('당사 보관소');
    } else {
      setOriginAddress('당사 보관소');
      setDestinationAddress(addr);
    }
  };

  const handleToggleReturnAsset = (asset: Asset) => {
    setReturnAssetIds((prev) => {
      const exists = prev.includes(asset.id);
      const next = exists ? prev.filter((id) => id !== asset.id) : [...prev, asset.id];
      if (!exists) {
        const vendor = findSubleaseVendorForAsset(asset, vendors, destinationAddress);
        const autoDest = vendor?.address || vendor?.name || asset.renter || '';
        if (autoDest) setDestinationAddress(autoDest);
      }
      return next;
    });
  };

  const handleAddCargoModel = (modelName: string) => {
    const clean = modelName.trim();
    if (!clean) return;
    setCargos((prev) => {
      const idx = prev.findIndex((c) => c.modelName === clean);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], count: copy[idx].count + 1 };
        return copy;
      }
      return [...prev, { modelName: clean, count: 1 }];
    });
  };

  const handleAdjustCargoCount = (modelName: string, delta: number) => {
    setCargos((prev) =>
      prev
        .map((c) => (c.modelName === modelName ? { ...c, count: c.count + delta } : c))
        .filter((c) => c.count > 0)
    );
  };

  const handleSave = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        category,
        customerId,
        contractId,
        loadingDate,
        loadingTimeSlot,
        unloadingDate,
        unloadingTimeSlot,
        originAddress,
        destinationAddress,
        cargos,
        returnAssetIds,
        vehicleType,
        expectedCost,
        billableToCustomer,
        memo,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border-t sm:border border-slate-700 w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* 상단 헤더 */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-sky-400 flex-shrink-0" />
            <span className="text-sm font-black text-white whitespace-nowrap flex-shrink-0">
              배차 등록
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 본문 스크롤 */}
        <div className="p-3.5 overflow-y-auto flex-1 flex flex-col gap-3.5">
          {/* 1. 구분 퀵버튼 */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
              구분
            </label>
            <div className="grid grid-cols-6 gap-1">
              {MANUAL_CATEGORY_QUICK_OPTIONS.map((cat) => {
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryPick(cat)}
                    className={`py-2 px-1 rounded-lg text-xs font-black border whitespace-nowrap flex-shrink-0 transition-colors ${
                      active
                        ? 'bg-blue-600 border-blue-400 text-white'
                        : 'bg-slate-950 border-slate-700 text-slate-300'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 반납 시 임차장비 퀵버튼 / 일반 시 거래처·계약 퀵버튼 */}
          {category === '반납' ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-rose-300 whitespace-nowrap flex-shrink-0">
                  반납 임차장비 선택
                </label>
                <span className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
                  {returnAssetIds.length}대 선택
                </span>
              </div>
              {availableReturnAssets.length === 0 ? (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400">
                  반납 대상 임차장비 없음
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 rounded-xl bg-slate-950 border border-slate-800">
                  {availableReturnAssets.map((a) => {
                    const selected = returnAssetIds.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handleToggleReturnAsset(a)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
                          selected
                            ? 'bg-rose-600 border-rose-400 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-200'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3" />}
                        <span>{a.modelName}</span>
                        <span className="font-mono text-[10px] opacity-90">({a.assetNo})</span>
                        {a.renter && <span className="text-[10px] text-amber-300">· {a.renter}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
                거래처 선택
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="거래처 검색"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 pl-8 pr-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {filteredCustomers.map((c) => {
                  const active = customerId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCustomer(c)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border whitespace-nowrap flex-shrink-0 ${
                        active
                          ? 'bg-blue-600 border-blue-400 text-white'
                          : 'bg-slate-950 border-slate-700 text-slate-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>

              {customerContracts.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {customerContracts.map((ct) => {
                    const site = sites.find((s) => s.id === ct.siteId);
                    const active = contractId === ct.id;
                    return (
                      <button
                        key={ct.id}
                        type="button"
                        onClick={() => handleSelectContract(ct)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap flex-shrink-0 ${
                          active
                            ? 'bg-sky-600 border-sky-400 text-white'
                            : 'bg-slate-950 border-slate-700 text-slate-300'
                        }`}
                      >
                        {site?.name || ct.contractNo}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. 상차일·시간 퀵버튼 */}
          <div className="flex flex-col gap-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-bold text-sky-300 whitespace-nowrap flex-shrink-0">
                상차일시
              </label>
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
                    className={`px-2 py-1 rounded text-[11px] font-bold border whitespace-nowrap flex-shrink-0 ${
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

          {/* 4. 하차일·시간 퀵버튼 */}
          <div className="flex flex-col gap-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-bold text-emerald-300 whitespace-nowrap flex-shrink-0">
                하차일시
              </label>
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
                    className={`px-2 py-1 rounded text-[11px] font-bold border whitespace-nowrap flex-shrink-0 ${
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

          {/* 5. 상차지 / 하차지 */}
          <div className="grid grid-cols-1 gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
                  상차지
                </label>
                <button
                  type="button"
                  onClick={() => setOriginAddress('당사 보관소')}
                  className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-sky-300 whitespace-nowrap flex-shrink-0"
                >
                  당사 보관소
                </button>
              </div>
              <input
                type="text"
                value={originAddress}
                onChange={(e) => setOriginAddress(e.target.value)}
                placeholder="상차지 주소"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
                  하차지
                </label>
                <button
                  type="button"
                  onClick={() => setDestinationAddress('당사 보관소')}
                  className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-sky-300 whitespace-nowrap flex-shrink-0"
                >
                  당사 보관소
                </button>
              </div>
              <input
                type="text"
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                placeholder="하차지 주소"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* 6. 장비 모델 퀵버튼 (반납 외) */}
          {category !== '반납' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
                장비 선택
              </label>
              <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                {quickModels.map((mName) => (
                  <button
                    key={mName}
                    type="button"
                    onClick={() => handleAddCargoModel(mName)}
                    className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 hover:border-blue-500 text-[11px] font-bold text-slate-200 whitespace-nowrap flex-shrink-0"
                  >
                    + {mName}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  placeholder="모델 직접 입력"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    handleAddCargoModel(customModelInput);
                    setCustomModelInput('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-white whitespace-nowrap flex-shrink-0"
                >
                  추가
                </button>
              </div>
              {cargos.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {cargos.map((c) => (
                    <div
                      key={c.modelName}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/60 border border-blue-500/40 text-xs font-bold text-white whitespace-nowrap flex-shrink-0"
                    >
                      <span>{c.modelName}</span>
                      <button
                        type="button"
                        onClick={() => handleAdjustCargoCount(c.modelName, -1)}
                        className="p-0.5 rounded bg-slate-800 text-slate-200"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono text-sky-300">{c.count}대</span>
                      <button
                        type="button"
                        onClick={() => handleAdjustCargoCount(c.modelName, 1)}
                        className="p-0.5 rounded bg-slate-800 text-slate-200"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 7. 차종(톤수) 퀵버튼 */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
              차종
            </label>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
              {VEHICLE_TYPE_OPTIONS.map((vt) => (
                <button
                  key={vt}
                  type="button"
                  onClick={() => setVehicleType(vt)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap flex-shrink-0 ${
                    vehicleType === vt
                      ? 'bg-blue-600 border-blue-400 text-white'
                      : 'bg-slate-950 border-slate-700 text-slate-300'
                  }`}
                >
                  {vt}
                </button>
              ))}
            </div>
          </div>

          {/* 8. 운송비 부담 & 금액 퀵버튼 */}
          {canViewCost && (
            <div className="flex flex-col gap-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
                  운송비
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setBillableToCustomer(false)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold border whitespace-nowrap flex-shrink-0 ${
                      !billableToCustomer
                        ? 'bg-blue-600 border-blue-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    당사부담
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillableToCustomer(true)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold border whitespace-nowrap flex-shrink-0 ${
                      billableToCustomer
                        ? 'bg-amber-600 border-amber-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    고객부담
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                {COST_PRESET_QUICK_OPTIONS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setExpectedCost(p.value)}
                    className={`px-2 py-1 rounded text-[11px] font-bold border whitespace-nowrap flex-shrink-0 ${
                      expectedCost === p.value
                        ? 'bg-emerald-600 border-emerald-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={expectedCost || ''}
                onChange={(e) => setExpectedCost(Math.max(0, Number(e.target.value) || 0))}
                placeholder="운송비 직접 입력"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>
          )}

          {/* 9. 메모 */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
              메모
            </label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="현장 전달사항"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
            />
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold whitespace-nowrap flex-shrink-0"
          >
            닫기
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black whitespace-nowrap flex-shrink-0"
          >
            {isSubmitting ? '등록 중...' : '배차 등록'}
          </button>
        </div>
      </div>
    </div>
  );
};
