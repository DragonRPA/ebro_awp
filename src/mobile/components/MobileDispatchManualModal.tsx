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
  COST_DELTA_QUICK_OPTIONS,
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
        billableToCustomer: false,
        memo,
      });
    } finally {
      setIsSubmitting(false);
    }
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
      {/* 상단 고정 헤더 */}
      <div
        style={{
          padding: 'max(10px, env(safe-area-inset-top, 10px)) 14px 10px',
          borderBottom: '1px solid #334155',
          backgroundColor: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Truck size={18} color="#38bdf8" />
          <span
            style={{
              fontSize: '15px',
              fontWeight: 900,
              color: '#ffffff',
              whiteSpace: 'nowrap',
            }}
          >
            배차 등록
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
          }}
        >
          <X size={16} />
          <span>닫기</span>
        </button>
      </div>

      {/* 상하 스크롤 본문 (좌우 스크롤 없음) */}
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
        {/* 1. 구분 선택 (아래로 줄바꿈 배치) */}
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
            구분
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {MANUAL_CATEGORY_QUICK_OPTIONS.map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryPick(cat)}
                  style={{
                    flex: '1 1 30%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 800,
                    backgroundColor: active ? '#2563eb' : '#0b0f19',
                    border: active ? '1px solid #60a5fa' : '1px solid #334155',
                    color: active ? '#ffffff' : '#cbd5e1',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. 반납 시 임차장비 / 일반 시 거래처·현장 선택 (아래로 줄바꿈 배치) */}
        {category === '반납' ? (
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
                반납 임차장비 선택
              </label>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1' }}>
                {returnAssetIds.length}대 선택
              </span>
            </div>
            {availableReturnAssets.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>반납 대상 임차장비 없음</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {availableReturnAssets.map((a) => {
                  const selected = returnAssetIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleToggleReturnAsset(a)}
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
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
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
              거래처 선택
            </label>
            <div style={{ position: 'relative' }}>
              <Search
                size={15}
                color="#94a3b8"
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="거래처 검색"
                style={{
                  width: '100%',
                  backgroundColor: '#0b0f19',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '8px 10px 8px 32px',
                  fontSize: '13px',
                  color: '#ffffff',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {filteredCustomers.map((c) => {
                const active = customerId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCustomer(c)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor: active ? '#2563eb' : '#0b0f19',
                      border: active ? '1px solid #60a5fa' : '1px solid #334155',
                      color: active ? '#ffffff' : '#e2e8f0',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>

            {customerContracts.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '4px' }}>
                {customerContracts.map((ct) => {
                  const site = sites.find((s) => s.id === ct.siteId);
                  const active = contractId === ct.id;
                  return (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => handleSelectContract(ct)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        backgroundColor: active ? '#0284c7' : '#0b0f19',
                        border: active ? '1px solid #38bdf8' : '1px solid #334155',
                        color: active ? '#ffffff' : '#cbd5e1',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {site?.name || ct.contractNo}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. 상차 · 하차 일시 및 주소 */}
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1', margin: 0 }}>
                  상차지
                </label>
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
              </div>
              <input
                type="text"
                value={originAddress}
                onChange={(e) => setOriginAddress(e.target.value)}
                placeholder="상차지 주소"
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1', margin: 0 }}>
                  하차지
                </label>
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
              </div>
              <input
                type="text"
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                placeholder="하차지 주소"
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

        {/* 4. 장비 선택 (반납 외, 아래로 줄바꿈 배치) */}
        {category !== '반납' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              backgroundColor: '#111827',
              padding: '12px',
              borderRadius: '14px',
              border: '1px solid #1e293b',
            }}
          >
            <label style={{ fontSize: '12px', fontWeight: 800, color: '#cbd5e1', margin: 0 }}>
              장비 선택
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {quickModels.map((mName) => (
                <button
                  key={mName}
                  type="button"
                  onClick={() => handleAddCargoModel(mName)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#0b0f19',
                    border: '1px solid #334155',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#e2e8f0',
                    whiteSpace: 'nowrap',
                  }}
                >
                  + {mName}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="text"
                value={customModelInput}
                onChange={(e) => setCustomModelInput(e.target.value)}
                placeholder="모델 직접 입력"
                style={{
                  flex: 1,
                  backgroundColor: '#0b0f19',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  fontSize: '13px',
                  color: '#ffffff',
                }}
              />
              <button
                type="button"
                onClick={() => {
                  handleAddCargoModel(customModelInput);
                  setCustomModelInput('');
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  fontSize: '13px',
                  fontWeight: 800,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                }}
              >
                추가
              </button>
            </div>
            {cargos.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '4px' }}>
                {cargos.map((c) => (
                  <div
                    key={c.modelName}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(30, 58, 138, 0.5)',
                      border: '1px solid #3b82f6',
                      fontSize: '12px',
                      fontWeight: 800,
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>{c.modelName}</span>
                    <button
                      type="button"
                      onClick={() => handleAdjustCargoCount(c.modelName, -1)}
                      style={{
                        padding: '3px',
                        borderRadius: '4px',
                        backgroundColor: '#1e293b',
                        color: '#ffffff',
                      }}
                    >
                      <Minus size={12} />
                    </button>
                    <span style={{ fontFamily: 'monospace', color: '#7dd3fc' }}>{c.count}대</span>
                    <button
                      type="button"
                      onClick={() => handleAdjustCargoCount(c.modelName, 1)}
                      style={{
                        padding: '3px',
                        borderRadius: '4px',
                        backgroundColor: '#1e293b',
                        color: '#ffffff',
                      }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. 차종 선택 (아래로 줄바꿈 배치) */}
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
          <label style={{ fontSize: '12px', fontWeight: 800, color: '#cbd5e1', margin: 0 }}>
            차종 선택
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {VEHICLE_TYPE_OPTIONS.map((vt) => {
              const active = vehicleType === vt;
              return (
                <button
                  key={vt}
                  type="button"
                  onClick={() => setVehicleType(vt)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 800,
                    backgroundColor: active ? '#2563eb' : '#0b0f19',
                    border: active ? '1px solid #60a5fa' : '1px solid #334155',
                    color: active ? '#ffffff' : '#cbd5e1',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {vt}
                </button>
              );
            })}
          </div>
        </div>

        {/* 6. 운송료 입력 ("0", "+1만", "+5만", "+10만" 4개 퀵버튼만 지원, 당사/고객부담 선택 제거) */}
        {canViewCost && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              backgroundColor: '#111827',
              padding: '12px',
              borderRadius: '14px',
              border: '1px solid #1e293b',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: '#cbd5e1', margin: 0 }}>
                운송료 입력
              </label>
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 900,
                  color: '#34d399',
                  fontFamily: 'monospace',
                }}
              >
                ₩{expectedCost.toLocaleString()}원
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
                    setExpectedCost(btn.isReset ? 0 : Math.max(0, expectedCost + btn.delta))
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
              value={expectedCost || ''}
              onChange={(e) => setExpectedCost(Math.max(0, Number(e.target.value) || 0))}
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

        {/* 7. 메모 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1', margin: 0 }}>
            메모
          </label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="현장 전달사항"
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
      </div>

      {/* 하단 고정 버튼 */}
      <div
        style={{
          padding: '10px 12px max(12px, env(safe-area-inset-bottom, 12px))',
          borderTop: '1px solid #334155',
          backgroundColor: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: '#1e293b',
            border: '1px solid #475569',
            color: '#cbd5e1',
            fontSize: '13px',
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
        >
          닫기
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleSave}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 900,
            whiteSpace: 'nowrap',
          }}
        >
          {isSubmitting ? '등록 중...' : '배차 등록'}
        </button>
      </div>
    </div>
  );
};
