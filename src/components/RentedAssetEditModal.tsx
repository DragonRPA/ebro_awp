import React, { useState, useRef, useEffect } from 'react';
import { Asset, Vendor, Product } from '../services/db';
import { Check, CheckCircle2, X } from 'lucide-react';
import { matchHangul } from '../utils/hangulSearch';

interface RentedAssetEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Partial<Asset>;
  vendors: Vendor[];
  products: Product[];
  rentedAssets: Asset[];
  allAssets: Asset[];
  onSave: (assetData: Partial<Asset>, renterSearch: string) => Promise<boolean | void>;
  calcRentEnd: (startStr: string) => string;
  generateNextRentedAssetNo: (allAssets: Asset[]) => string;
}

export const RentedAssetEditModal: React.FC<RentedAssetEditModalProps> = ({
  isOpen,
  onClose,
  asset,
  vendors,
  products,
  rentedAssets,
  allAssets,
  onSave,
  calcRentEnd,
  generateNextRentedAssetNo
}) => {
  const [formData, setFormData] = useState<Partial<Asset>>({ ...asset });
  const [modelSearch, setModelSearch] = useState<string>(asset.modelName || '');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [modelError, setModelError] = useState<string>('');
  const [renterSearch, setRenterSearch] = useState<string>(
    asset.renter || (asset.vendorId ? vendors.find(v => v.id === asset.vendorId)?.name : '') || ''
  );
  const [isRenterDropdownOpen, setIsRenterDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredHistory, setRegisteredHistory] = useState<{ assetNo: string; modelName: string; serialNo?: string; manufactureYear?: string }[]>([]);
  const modelComboboxRef = useRef<HTMLDivElement>(null);
  const renterComboboxRef = useRef<HTMLDivElement>(null);
  const assetNoInputRef = useRef<HTMLInputElement>(null);

  const findProductManufacturer = (modelName?: string): string => {
    if (!modelName) return '';
    const norm = modelName.replace(/[\s\-_]/g, '').toUpperCase();
    const matched = products.find(p => {
      if (!p) return false;
      const pm = (p.modelName || '').replace(/[\s\-_]/g, '').toUpperCase();
      const ps = (p.shortName || '').replace(/[\s\-_]/g, '').toUpperCase();
      return pm === norm || (ps !== '' && ps === norm);
    });
    return matched?.manufacturer ? String(matched.manufacturer).trim() : '';
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelComboboxRef.current && !modelComboboxRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
      if (renterComboboxRef.current && !renterComboboxRef.current.contains(e.target as Node)) {
        setIsRenterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setFormData({ ...asset });
    setModelSearch(asset.modelName || '');
    setModelError('');
    setRegisteredHistory([]);
    setRenterSearch(
      asset.renter || (asset.vendorId ? vendors.find(v => v.id === asset.vendorId)?.name : '') || ''
    );
  }, [asset, isOpen]);

  useEffect(() => {
    if (formData.modelName && formData.modelName !== modelSearch) {
      setModelSearch(formData.modelName);
    }
    if (formData.modelName) {
      const autoMfg = findProductManufacturer(formData.modelName);
      if (autoMfg && formData.manufacturer !== autoMfg) {
        setFormData(prev => ({ ...prev, manufacturer: autoMfg }));
      }
    }
  }, [formData.modelName, products]);

  if (!isOpen) return null;

  // 정렬된 모델 목록 및 검색 필터링
  const sortedProducts = [...products].sort((a, b) => (a.modelName || '').localeCompare(b.modelName || ''));
  const currentMatchedProduct = sortedProducts.find(p => {
    const raw = (formData.modelName || modelSearch || '').trim();
    if (!raw) return false;
    const pm = (p.modelName || '').trim().toLowerCase();
    const ps = (p.shortName || '').trim().toLowerCase();
    const q = raw.toLowerCase();
    return pm === q || (ps !== '' && ps === q);
  });
  const filteredProducts = modelSearch.trim()
    ? sortedProducts.filter(p => {
        const q = modelSearch.trim();
        return (
          matchHangul(p.modelName || '', q) ||
          matchHangul(p.shortName || '', q) ||
          matchHangul(p.manufacturer || '', q) ||
          matchHangul(p.feet ? `${p.feet}ft` : '', q)
        );
      })
    : sortedProducts;

  // 등록된 임차처 목록
  const rentalVendorNames = (vendors || [])
    .filter(v => v.type === 'RENTAL' || (v.types && v.types.includes('RENTAL')) || (v.name && (v.name.includes('렌탈') || v.name.includes('리프트'))))
    .map(v => v.name)
    .filter(Boolean);
  const existingRenters = rentedAssets.map(a => a.renter || '').filter(name => Boolean(name) && name !== '미지정');
  const allVendorNames = (vendors || []).map(v => v.name).filter(Boolean);
  const combinedRenters = Array.from(new Set([...rentalVendorNames, ...existingRenters, ...allVendorNames])).sort((a, b) => a.localeCompare(b));

  const filteredRenterVendors = renterSearch.trim()
    ? combinedRenters.filter(r => matchHangul(r, renterSearch.trim()))
    : combinedRenters;

  const currentRenterVal = formData.renter || (formData.vendorId ? vendors.find(v => v.id === formData.vendorId)?.name : '') || '';
  const isRenterDisabled = Boolean(formData.id && currentRenterVal && formData.status !== 'RENTED_RETURNED' && !(formData as any).isReactivating);

  const normalizeManufactureYear = (raw?: string | number | null): string => {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return '';
    const exactFourDigits = trimmed.match(/^(\d{4})\s*\.?$/);
    if (exactFourDigits) return `${exactFourDigits[1]}년`;
    if (/^\d{4}(?!\d)/.test(trimmed) && !trimmed.includes('년')) {
      return trimmed.replace(/^(\d{4})\s*[.\-/]?\s*/, '$1년 ').trim();
    }
    return trimmed;
  };

  const handleAssetNoChange = (val: string) => {
    const trimmed = val.trim();
    const pastReturned = rentedAssets.find(
      a => a.status === 'RENTED_RETURNED' && a.assetNo && a.assetNo.toLowerCase() === trimmed.toLowerCase()
    );

    if (pastReturned) {
      const today = new Date().toISOString().split('T')[0];
      const resolvedRenter = pastReturned.renter || (pastReturned.vendorId ? vendors.find(v => v.id === pastReturned.vendorId)?.name : '') || '';
      setRenterSearch(resolvedRenter);
      setFormData(prev => ({
        ...prev,
        ...pastReturned,
        manufacturer: pastReturned.manufacturer || findProductManufacturer(pastReturned.modelName),
        manufactureYear: normalizeManufactureYear(pastReturned.manufactureYear),
        assetNo: val,
        rentStart: today,
        rentEnd: calcRentEnd(today),
        actualRentReturnDate: '',
        status: 'AVAILABLE',
        renter: resolvedRenter,
        vendorId: pastReturned.vendorId || vendors.find(v => v.name === resolvedRenter)?.id,
        isReactivating: true
      } as any));
    } else {
      setFormData(prev => ({
        ...prev,
        assetNo: val,
        isReactivating: false
      } as any));
    }
  };

  const handleAutoGenerateAssetNo = () => {
    const nextNo = generateNextRentedAssetNo(allAssets);
    setFormData(prev => ({
      ...prev,
      assetNo: nextNo,
      isReactivating: false
    } as any));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawModel = (formData.modelName || modelSearch || '').trim();
    if (!rawModel) {
      setModelError('임차할 장비의 제품(모델명)을 검색하여 선택해 주세요.');
      setIsModelDropdownOpen(true);
      return;
    }
    const matchedProd = sortedProducts.find(p => {
      const pm = (p.modelName || '').trim().toLowerCase();
      const ps = (p.shortName || '').trim().toLowerCase();
      const q = rawModel.toLowerCase();
      return pm === q || (ps !== '' && ps === q);
    });
    if (!matchedProd) {
      setModelError(`입력하신 모델명 [${rawModel}]은(는) 등록된 제품 목록에 없습니다. 목록에서 선택해 주세요.`);
      setIsModelDropdownOpen(true);
      return;
    }
    setModelError('');
    setIsSubmitting(true);
    try {
      const autoManufacturer = findProductManufacturer(matchedProd.modelName);
      const savedAssetNo = (formData.assetNo || '').trim();
      const savedYear = normalizeManufactureYear(formData.manufactureYear);
      const savedSerial = (formData.serialNo || '').trim();
      const normalizedData: Partial<Asset> = {
        ...formData,
        modelName: matchedProd.modelName,
        manufacturer: formData.manufacturer || autoManufacturer || '',
        manufactureYear: savedYear
      };
      setModelSearch(matchedProd.modelName);
      const savedOk = await onSave(normalizedData, renterSearch);
      if (savedOk !== false) {
        if (savedAssetNo) {
          setRegisteredHistory(prev => [
            ...prev,
            {
              assetNo: savedAssetNo,
              modelName: matchedProd.modelName,
              serialNo: savedSerial,
              manufactureYear: savedYear
            }
          ]);
        }
        // 저장 후 3개 필드(제조번호, 관리번호, 연식)만 공백 초기화하고 나머지 필드 값 유지
        setFormData(prev => ({
          ...prev,
          id: undefined,
          assetNo: '',
          vendorAssetNo: '',
          serialNo: '',
          manufactureYear: '',
          modelName: matchedProd.modelName,
          manufacturer: prev.manufacturer || autoManufacturer || '',
          isReactivating: false
        } as any));
        setTimeout(() => {
          assetNoInputRef.current?.focus();
        }, 50);
      } else {
        setFormData(normalizedData);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', padding: '24px', borderRadius: '12px', width: '500px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', color: 'var(--text-main)' }}>
          {formData.id ? '임차 자산 수정' : '임차 자산 신규/재임차 등록'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>자사 관리번호 (필수)</label>
                {!formData.id && (
                  <button
                    type="button"
                    onClick={handleAutoGenerateAssetNo}
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--primary)',
                      cursor: 'pointer'
                    }}
                  >
                    신규 채번
                  </button>
                )}
              </div>
              <input
                ref={assetNoInputRef}
                type="text"
                list="past-returned-asset-nos"
                required
                placeholder="예: R-001"
                value={formData.assetNo || ''}
                onChange={e => handleAssetNoChange(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
              />
              <datalist id="past-returned-asset-nos">
                {rentedAssets.filter(a => a.status === 'RENTED_RETURNED').map(a => (
                  <option key={a.id} value={a.assetNo}>
                    {`${a.modelName} | ${a.renter || '미지정'} (반납 자산)`}
                  </option>
                ))}
              </datalist>
              {(formData as any).isReactivating && (
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <CheckCircle2 size={12} /> 과거 반납 이력 자산 (재임차 승계)
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>임차처 원래번호 (선택)</label>
              <input
                type="text"
                placeholder="예: 대한-101, AJ-502"
                value={formData.vendorAssetNo || ''}
                onChange={e => setFormData({ ...formData, vendorAssetNo: e.target.value })}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>제조번호</label>
            <input
              type="text"
              placeholder="제조번호 입력"
              value={formData.serialNo || ''}
              onChange={e => setFormData({ ...formData, serialNo: e.target.value })}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }} ref={modelComboboxRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>모델명 (필수)</label>
              {currentMatchedProduct ? (
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--success)', whiteSpace: 'nowrap' }}>
                  제품 확인됨
                </span>
              ) : modelSearch.trim() ? (
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--danger)', whiteSpace: 'nowrap' }}>
                  목록에서 선택 필요
                </span>
              ) : (
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--warning)', whiteSpace: 'nowrap' }}>
                  제품 미선택
                </span>
              )}
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="제품 검색 후 선택 (예: 1230ES, JLG, 20ft)"
                value={modelSearch}
                onChange={e => {
                  const val = e.target.value;
                  setModelSearch(val);
                  setModelError('');
                  setIsModelDropdownOpen(true);
                  const exactProd = sortedProducts.find(p => {
                    const pm = (p.modelName || '').trim().toLowerCase();
                    const ps = (p.shortName || '').trim().toLowerCase();
                    const q = val.trim().toLowerCase();
                    return q !== '' && (pm === q || (ps !== '' && ps === q));
                  });
                  if (exactProd) {
                    const autoManufacturer = findProductManufacturer(exactProd.modelName);
                    setFormData({
                      ...formData,
                      modelName: exactProd.modelName,
                      manufacturer: autoManufacturer || formData.manufacturer || ''
                    });
                  } else {
                    setFormData({
                      ...formData,
                      modelName: val,
                      manufacturer: val.trim() ? formData.manufacturer : ''
                    });
                  }
                }}
                onFocus={() => setIsModelDropdownOpen(true)}
                style={{
                  width: '100%',
                  padding: '6px 30px 6px 10px',
                  borderRadius: '6px',
                  border: modelError ? '1.5px solid var(--danger)' : currentMatchedProduct ? '1.5px solid var(--success)' : '1px solid var(--border-color)',
                  backgroundColor: modelError ? 'rgba(239, 68, 68, 0.06)' : 'var(--bg-app)',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  boxSizing: 'border-box'
                }}
              />
              {modelSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setModelSearch('');
                    setModelError('');
                    setFormData({ ...formData, modelName: '', manufacturer: '' });
                    setIsModelDropdownOpen(true);
                  }}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {modelError && (
              <div style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 600 }}>
                ⚠️ {modelError}
              </div>
            )}

            {isModelDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 1060
                }}
              >
                {filteredProducts.length === 0 ? (
                  <div style={{ padding: '8px 12px', fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    일치하는 등록 제품 없음
                  </div>
                ) : (
                  filteredProducts.map(p => {
                    const isSelected = (formData.modelName || modelSearch) === p.modelName;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          const autoManufacturer = findProductManufacturer(p.modelName);
                          setModelSearch(p.modelName);
                          setModelError('');
                          setFormData({
                            ...formData,
                            modelName: p.modelName,
                            manufacturer: autoManufacturer || formData.manufacturer || ''
                          });
                          setIsModelDropdownOpen(false);
                        }}
                        style={{
                          padding: '7px 12px',
                          fontSize: '12px',
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                          backgroundColor: isSelected ? 'rgba(59,130,246,0.08)' : 'transparent',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-app)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = isSelected ? 'rgba(59,130,246,0.08)' : 'transparent')}
                      >
                        <span>
                          {p.modelName}{' '}
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
                            ({p.manufacturer || '제조사미상'} / {p.feet ? `${p.feet}ft` : '제원'})
                          </span>
                        </span>
                        {isSelected && <Check size={13} color="var(--primary)" />}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>제조사 (제품정보 자동채움)</label>
              <input
                type="text"
                placeholder="제품정보 기준 자동채움"
                value={formData.manufacturer || ''}
                onChange={e => setFormData({ ...formData, manufacturer: e.target.value })}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>연식</label>
              <input
                type="text"
                placeholder="예: 2023년"
                value={formData.manufactureYear || ''}
                onChange={e => {
                  const val = e.target.value;
                  const prev = formData.manufactureYear || '';
                  const isDeletingYearSuffix = prev === `${val}년`;
                  const nextVal = !isDeletingYearSuffix && /^\d{4}$/.test(val.trim())
                    ? `${val.trim()}년`
                    : val;
                  setFormData({ ...formData, manufactureYear: nextVal });
                }}
                onBlur={e => setFormData(prev => ({ ...prev, manufactureYear: normalizeManufactureYear(e.target.value) }))}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }} ref={renterComboboxRef}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>
                임차처 (필수, 초성검색 지원)
              </label>
              {isRenterDisabled && (
                <span style={{ fontSize: '10px', color: 'var(--warning)', fontWeight: 700, backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                  임차 중 변경 불가
                </span>
              )}
            </div>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                required
                disabled={isRenterDisabled}
                placeholder="임차처 입력 또는 초성 검색 (예: ㄹㅇㅈ, 한국)"
                value={renterSearch}
                onChange={e => {
                  const val = e.target.value;
                  setRenterSearch(val);
                  setIsRenterDropdownOpen(true);
                  const matched = vendors.find(v => v.name === val.trim());
                  setFormData({
                    ...formData,
                    renter: val,
                    vendorId: matched?.id || formData.vendorId
                  });
                }}
                onFocus={() => {
                  if (!isRenterDisabled) setIsRenterDropdownOpen(true);
                }}
                style={{
                  width: '100%',
                  padding: '6px 30px 6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: isRenterDisabled ? 'var(--bg-app)' : 'var(--bg-card)',
                  color: isRenterDisabled ? 'var(--text-muted)' : 'var(--text-main)',
                  cursor: isRenterDisabled ? 'not-allowed' : 'text',
                  fontSize: '12px',
                  boxSizing: 'border-box'
                }}
              />
              {renterSearch && !isRenterDisabled && (
                <button
                  type="button"
                  onClick={() => {
                    setRenterSearch('');
                    setFormData({ ...formData, renter: '', vendorId: undefined });
                    setIsRenterDropdownOpen(true);
                  }}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* 초성 검색 결과 드롭다운 */}
            {isRenterDropdownOpen && !isRenterDisabled && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  zIndex: 1050
                }}
              >
                {filteredRenterVendors.length === 0 ? (
                  <div style={{ padding: '8px 12px', fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    일치하는 임차처 없음 (입력한 상호명으로 등록)
                  </div>
                ) : (
                  filteredRenterVendors.map(name => {
                    const isSelected = (formData.renter || renterSearch) === name;
                    return (
                      <div
                        key={name}
                        onClick={() => {
                          setRenterSearch(name);
                          const matched = vendors.find(v => v.name === name);
                          setFormData({
                            ...formData,
                            renter: name,
                            vendorId: matched?.id || formData.vendorId
                          });
                          setIsRenterDropdownOpen(false);
                        }}
                        style={{
                          padding: '7px 12px',
                          fontSize: '12px',
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                          backgroundColor: isSelected ? 'rgba(59,130,246,0.08)' : 'transparent',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-app)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = isSelected ? 'rgba(59,130,246,0.08)' : 'transparent')}
                      >
                        <span>{name}</span>
                        {isSelected && <Check size={13} color="var(--primary)" />}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* 협착방지봉 옵션 소유권 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>
                협착방지봉 옵션 소유권 (입고 시 오탈거 방지)
              </label>
              {formData.antiEntrapmentOwnership === 'VENDOR' ? (
                <span style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: 700, backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                  주기장 입고 시 탈거 절대 금지
                </span>
              ) : formData.antiEntrapmentOwnership === 'OURS' ? (
                <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 700, backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                  원사 반납 시 탈거 회수
                </span>
              ) : null}
            </div>
            <select
              value={formData.antiEntrapmentOwnership || 'NONE'}
              onChange={e => setFormData({ ...formData, antiEntrapmentOwnership: e.target.value as any })}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
            >
              <option value="VENDOR">임차처 소유 (탈거 절대 금지 / 원형 보존)</option>
              <option value="OURS">당사 소유 (원사 반납 전 탈거 회수)</option>
              <option value="NONE">미장착 (협착방지봉 없음)</option>
            </select>
            <div style={{ fontSize: '10.5px', color: formData.antiEntrapmentOwnership === 'VENDOR' ? 'var(--danger)' : 'var(--text-muted)', lineHeight: '1.4' }}>
              {formData.antiEntrapmentOwnership === 'VENDOR' && '⚠️ 주기장 입고 시 출고/정비팀이 임의 탈거하지 않도록 입고 검수 경고가 자동 연동됩니다.'}
              {formData.antiEntrapmentOwnership === 'OURS' && '🔧 당사 소유 부품이므로 임차처 최종 반납 시 탈거하여 부품실로 회수 안내가 표출됩니다.'}
              {(!formData.antiEntrapmentOwnership || formData.antiEntrapmentOwnership === 'NONE') && '장비에 협착방지봉이 장착되어 있지 않습니다.'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>임차 시작일</label>
              <input
                type="date"
                value={formData.rentStart || ''}
                onChange={e => {
                  const newStart = e.target.value;
                  setFormData({
                    ...formData,
                    rentStart: newStart,
                    rentEnd: calcRentEnd(newStart)
                  });
                }}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>임차 만료예정일</label>
              <input
                type="date"
                value={formData.rentEnd || ''}
                onChange={e => setFormData({ ...formData, rentEnd: e.target.value })}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>월 임차료 (원)</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="300,000"
                value={formData.monthlyRentFee ? Number(formData.monthlyRentFee).toLocaleString('ko-KR') : ''}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setFormData({ ...formData, monthlyRentFee: raw ? Number(raw) : 0 });
                }}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>실제 반납일 (반납 완료 시 입력)</label>
              <input
                type="date"
                value={formData.actualRentReturnDate || ''}
                onChange={e => {
                  const returnVal = e.target.value;
                  setFormData({
                    ...formData,
                    actualRentReturnDate: returnVal || undefined,
                    status: returnVal ? 'RENTED_RETURNED' : (formData.status === 'RENTED_RETURNED' ? 'AVAILABLE' : formData.status)
                  });
                }}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
              />
            </div>
          </div>

          {registeredHistory.length > 0 && (
            <div style={{
              marginTop: '4px',
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)' }}>
                  등록된 임차자산 관리번호 ({registeredHistory.length}건)
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '110px', overflowY: 'auto' }}>
                {registeredHistory.map((item, idx) => (
                  <span
                    key={`${item.assetNo}-${idx}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: 'var(--text-main)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <CheckCircle2 size={12} color="var(--success)" />
                    <span>{item.assetNo}</span>
                    {item.serialNo && (
                      <span style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--text-muted)' }}>
                        ({item.serialNo})
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              닫기
            </button>
            <button
              data-hs-trigger="Save"
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}
            >
              {isSubmitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
