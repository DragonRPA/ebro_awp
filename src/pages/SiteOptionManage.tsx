// src/pages/SiteOptionManage.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Shield, Check, Plus, Trash2, Edit3, Search, RefreshCw, 
  ArrowRight, Copy, CheckSquare, Layers, Download, Building2, 
  MapPin, AlertCircle, FileText, CheckCircle2, ChevronRight, Sliders, X
} from 'lucide-react';
import { StandardOption, CustomerSite, Customer } from '../services/db';
import { SiteOptionItem, inheritOptionsFromMaster } from '../types/siteOption';
import { exportToExcel } from '../services/excel';

export const SiteOptionManage: React.FC = () => {
  const { 
    customers, sites, standardOptions, saveStandardOption, deleteStandardOption, 
    saveSite, showErrorModal, fullRefreshFromServer,
    navigationPayload, setNavigationPayload
  } = useApp();

  // 1. 활성 탭: 'SITE_OPTIONS' (현장별 옵션 관리) vs 'MASTER_OPTIONS' (옵션 품목 마스터)
  const [activeTab, setActiveTab] = useState<'SITE_OPTIONS' | 'MASTER_OPTIONS'>('SITE_OPTIONS');

  // 2. 검색 및 필터 상태
  const [searchSiteKeyword, setSearchSiteKeyword] = useState<string>('');

  // --- Master Option Sort ---
  type SortKey = keyof StandardOption;
  const [masterSortConfig, setMasterSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' | null }>({ key: 'sortOrder', direction: null });

  const sortedStandardOptions = useMemo(() => {
    let sorted = [...(standardOptions || [])];
    if (masterSortConfig.direction !== null) {
      sorted.sort((a, b) => {
        let valA: any = a[masterSortConfig.key];
        let valB: any = b[masterSortConfig.key];
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return masterSortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return masterSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [standardOptions, masterSortConfig]);

  const handleMasterSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (masterSortConfig.key === key && masterSortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (masterSortConfig.key === key && masterSortConfig.direction === 'desc') {
      direction = null;
    }
    setMasterSortConfig({ key, direction });
  };
  // --------------------------

  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  // ── 🧭 외부 네비게이션 페이로드 수신 처리 ──
  useEffect(() => {
    if (navigationPayload) {
      if (navigationPayload.siteId) {
        setSelectedSiteId(navigationPayload.siteId);
        const targetSite = (sites || []).find(s => s.id === navigationPayload.siteId);
        if (targetSite) {
        }
      } else if (navigationPayload.customerId) {
      }
      if (navigationPayload.tab === 'MASTER_OPTIONS') {
        setActiveTab('MASTER_OPTIONS');
      }
      setNavigationPayload(null);
    }
  }, [navigationPayload, sites, setNavigationPayload]);

  // 3. 토스트 알림
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 4. 선택된 현장의 옵션 작업대 편집 상태 (SiteOptionItem[])
  const [workingOptionItems, setWorkingOptionItems] = useState<SiteOptionItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 5. 옵션 품목 마스터 신규/수정 모달 상태
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [editingMasterOption, setEditingMasterOption] = useState<Partial<StandardOption> | null>(null);

  // ── 🏢 고객사 ID ➔ 고객사명 매핑 맵 ──

  // ── 🎯 필터링된 고객 현장 목록 ──
  const filteredSites = useMemo(() => {
    

  return (sites || []).filter(s => {
      if (searchSiteKeyword.trim()) {
        const kw = searchSiteKeyword.trim().toLowerCase();
        const matchName = (s.name || "").toLowerCase().includes(kw);
        const matchAddr = (s.address || "").toLowerCase().includes(kw);
        if (!matchName && !matchAddr) return false;
      }
      return true;
    });
  }, [sites, searchSiteKeyword]);

  // 첫 번째 현장 자동 선택
  useEffect(() => {
    if (!selectedSiteId && filteredSites.length > 0) {
      setSelectedSiteId(filteredSites[0].id);
    }
  }, [filteredSites, selectedSiteId]);

  // 선택된 현장 객체
  const activeSite = useMemo(() => {
    return (sites || []).find(s => s.id === selectedSiteId) || null;
  }, [sites, selectedSiteId]);

  // ── 🔄 현장 선택 시 옵션품목마스터에서 옵션값 상속 동기화 ──
  useEffect(() => {
    if (!activeSite) {
      setWorkingOptionItems([]);
      return;
    }

    // 마스터(StandardOption) 풀에서 항목들을 상속받고, 현장 저장값 매핑
    const inherited = inheritOptionsFromMaster(
      activeSite.id,
      standardOptions || [],
      activeSite.paidOptions,
      activeSite.protection,
      activeSite.checkedSpecs
    );

    setWorkingOptionItems(inherited);
  }, [activeSite, standardOptions]);

  // ── 💡 옵션 적용 여부 토글 핸들러 ──
  const handleToggleOption = (optionId: string) => {
    setWorkingOptionItems(prev => prev.map(item => {
      if (item.optionId === optionId) {
        return { ...item, isEnabled: !item.isEnabled };
      }
      return item;
    }));
  };

  // ── 💡 보양작업 단일 선택 핸들러 ──
  const handleSelectProtection = (optionId: string) => {
    setWorkingOptionItems(prev => prev.map(item => {
      if (item.category === 'PROTECTION') {
        return { ...item, isEnabled: item.optionId === optionId };
      }
      return item;
    }));
  };

  // ── 💰 현장 특약 단가 변경 핸들러 ──
  const handlePriceChange = (optionId: string, newPrice: number) => {
    setWorkingOptionItems(prev => prev.map(item => {
      if (item.optionId === optionId) {
        return { ...item, appliedPrice: Math.max(0, newPrice) };
      }
      return item;
    }));
  };

  // ── ⭐ 필수 장착 여부 토글 핸들러 ──
  const handleToggleRequired = (optionId: string) => {
    setWorkingOptionItems(prev => prev.map(item => {
      if (item.optionId === optionId) {
        return { ...item, isRequired: !item.isRequired };
      }
      return item;
    }));
  };

  // ── 📝 현장 메모 변경 핸들러 ──
  const handleNoteChange = (optionId: string, note: string) => {
    setWorkingOptionItems(prev => prev.map(item => {
      if (item.optionId === optionId) {
        return { ...item, note };
      }
      return item;
    }));
  };

  // ── 📊 월 유상옵션 총액 합계 계산 ──
  const monthlyPaidFeeTotal = useMemo(() => {
    return workingOptionItems
      .filter(item => item.category === 'PAID' && item.isEnabled)
      .reduce((sum, item) => sum + (item.appliedPrice || 0), 0);
  }, [workingOptionItems]);

  // ── 💾 현장 옵션 설정 저장 ──
  const handleSaveSiteOptions = async () => {
    if (!activeSite) return;
    setIsSaving(true);
    try {
      // 1. 유상옵션 문자열 요약
      const paidNames = workingOptionItems
        .filter(item => item.category === 'PAID' && item.isEnabled)
        .map(item => item.name)
        .join(', ');

      // 2. 보양작업 문자열 요약
      const protItem = workingOptionItems.find(item => item.category === 'PROTECTION' && item.isEnabled);
      const protName = protItem ? protItem.name : '';

      // 3. 요구사양 맵 요약
      const specsMap: Record<string, boolean> = {};
      workingOptionItems
        .filter(item => item.category === 'SPEC' && item.isEnabled)
        .forEach(item => {
          specsMap[item.optionId] = true;
        });

      // CustomerSite 객체에 옵션값 100% 동기화 저장
      await saveSite({
        ...activeSite,
        paidOptions: paidNames,
        protection: protName,
        checkedSpecs: specsMap,
        updatedAt: new Date().toISOString()
      });

      showToast(`현장 [${activeSite.name}] 옵션 설정이 저장되었습니다.`);
      await fullRefreshFromServer();
    } catch (err: any) {
      showErrorModal(`현장 옵션 저장 실패: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── 📥 엑셀 내보내기 ──
  const handleExportExcel = () => {
      const rows = filteredSites.map(s => {
        return {
          "현장명": s.name,
        '현장주소': s.address || '-',
        '유상옵션': s.paidOptions || '미지정',
        '보양작업': s.protection || 'NONE',
        '현장담당자': s.contactName || '-',
        '연락처': s.contact || '-'
      };
    });
    exportToExcel(rows, `현장별옵션대장_${new Date().toISOString().split('T')[0]}`);
  };

  // ── 🏷️ 옵션 품목 마스터 저장 (신규/수정) ──
  const handleSaveMasterOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMasterOption?.name?.trim()) {
      showErrorModal('옵션 품목명을 입력해주세요.');
      return;
    }
    try {
      const optionToSave: any = {
        ...(editingMasterOption.id ? { id: editingMasterOption.id } : {}),
        category: editingMasterOption.category || 'PAID',
        name: editingMasterOption.name.trim(),
        defaultPrice: Number(editingMasterOption.defaultPrice || 0),
        unit: editingMasterOption.unit || '월',
        description: editingMasterOption.description || '',
        isActive: editingMasterOption.isActive !== false,
        sortOrder: Number(editingMasterOption.sortOrder || (standardOptions.length + 1)),
        createdAt: editingMasterOption.createdAt || new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
      };

      await saveStandardOption(optionToSave);
      setShowMasterModal(false);
      setEditingMasterOption(null);
      showToast('옵션 품목 마스터가 저장되었습니다.');
      await fullRefreshFromServer();
    } catch (err: any) {
      showErrorModal(`옵션 마스터 저장 오류: ${err?.message || err}`);
    }
  };

  // --- Keyboard Shortcuts (Harden) ---
  useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
  if (showMasterModal) setShowMasterModal(false);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
  e.preventDefault();
  if (showMasterModal) {
  const mockEvent = { preventDefault: () => {} } as React.FormEvent;
  handleSaveMasterOption(mockEvent);
  } else {
  handleSaveSiteOptions();
  }
  }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMasterModal, handleSaveMasterOption, handleSaveSiteOptions]);
  // -----------------------------------

  return (
    <div data-hs-observe="siteoptionmanage" 
      data-subview="site_options" 
      data-subview-title="현장별 옵션 관리"
      style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '30px' }}
    >
      {/* 토스트 알림 */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: 'var(--primary)',
          color: '#fff',
          padding: '10px 18px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 700,
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* 헌장 3.5 Gutenberg Z-패턴: ①좌상단 스코프 & ②우상단 파이프라인 */}
      {/* ──────────────────────────────────────────────────────── */}
      <div 
        data-mid="filter-panel"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}
      >
        {/* ① 좌상단 (Start / Scope): 고객사 필터 & 현장 검색 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
          {/* 고객사 선택 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              고객사 필터
            </span>
            <select
              style={{
                height: '34px',
                padding: '0 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 600,
                outline: 'none',
                minWidth: '150px'
              }}
            >
            </select>
          </div>

          {/* 현장 검색창 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              현장 검색
            </span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="현장명, 주소, 거래처"
                value={searchSiteKeyword}
                onChange={e => setSearchSiteKeyword(e.target.value)}
                style={{
                  height: '34px',
                  paddingLeft: '30px',
                  paddingRight: '10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  outline: 'none',
                  width: '180px'
                }}
              />
            </div>
          </div>
        </div>

        {/* ② 우상단 (Input / Pipeline): 2대 탭 전환 & 액션 버튼군 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
          {/* 탭 전환 스위치 */}
          <div 
            data-mid="tab-toggle"
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: '3px',
              border: '1px solid var(--border-color)'
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('SITE_OPTIONS')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12.5px',
                fontWeight: 700,
                backgroundColor: activeTab === 'SITE_OPTIONS' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'SITE_OPTIONS' ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Building2 size={13} />
              현장별 옵션 관리
            </button>
          </div>

          {/* 옵션 품목 마스터 버튼 (고객관리에서 이동배치) */}
          <button
            type="button"
            data-mid="btn-option-master-manage"
            onClick={() => setActiveTab('MASTER_OPTIONS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '34px',
              padding: '0 12px',
              borderRadius: '6px',
              border: '1px solid #0369a1',
              backgroundColor: activeTab === 'MASTER_OPTIONS' ? 'var(--primary)' : '#0284c7',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)'
            }}
            title="전사 유상옵션 및 보양작업 표준 품목/단가 관리"
          >
            <Sliders size={13} color="#ffffff" />
            옵션 품목 마스터
          </button>

          {/* 엑셀 내보내기 버튼 */}
          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '34px',
              padding: '0 12px',
              borderRadius: '6px',
              border: '1px solid #10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#059669',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Download size={13} />
            엑셀 내보내기
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 헌장 3.5 Gutenberg Z-패턴: ③중앙 본문 Body / Inspection */}
      {/* ──────────────────────────────────────────────────────── */}

      {/* ── [탭 1: 현장별 옵션 관리 마스터-디테일 스튜디오] ── */}
      {activeTab === 'SITE_OPTIONS' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '14px', height: 'calc(100vh - 180px)', minHeight: '500px' }}>
          
          {/* 좌측: 고객 현장 목록 패널 (320px) */}
          <div 
            data-mid="panel-site-scope"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                등록 현장 ({filteredSites.length}개소)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                클릭 시 옵션 설정
              </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredSites.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  조회 조건에 부합하는 현장이 없습니다.
                </div>
              ) : (
                filteredSites.map(site => {
                  const isSelected = site.id === selectedSiteId;
                  const paidCount = (site.paidOptions || '').split(',').filter(Boolean).length;
                  const hasProt = Boolean(site.protection && site.protection !== 'NONE');

                  return (
                    <div
                      key={site.id}
                      onClick={() => setSelectedSiteId(site.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-card)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: 800,
                          color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden'
                        }}>
                          {(() => { const cust = (customers || []).find((c: Customer) => c.id === site.customerId); return cust ? `[${cust.name}] ${site.name}` : site.name; })()}
                        </span>
                        <ChevronRight size={14} color={isSelected ? 'var(--primary)' : 'var(--text-muted)'} />
                      </div>

                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', marginTop: '2px', alignItems: 'center' }}>
                        <span style={{
                          fontSize: '11.5px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: paidCount > 0 ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-secondary)',
                          color: paidCount > 0 ? '#1d4ed8' : 'var(--text-muted)'
                        }}>
                          유상옵션 {paidCount}개
                        </span>
                        {hasProt && (
                          <span style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(5, 150, 105, 0.12)',
                            color: '#059669'
                          }}>
                            {site.protection}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 우측: 선택된 현장의 옵션 상속 작업대 (70%) */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden'
          }}>
            {!activeSite ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                좌측에서 옵션을 관리할 현장을 선택해주세요.
              </div>
            ) : (
              <>
                {/* 상단 현장 정보 바 */}
                <div style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building2 size={17} color="var(--primary)" />
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {activeSite.name}
                      </h3>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={12} /> {activeSite.address || '주소 미등록'} | 담당: {activeSite.contactName || '-'} ({activeSite.contact || '-'})
                    </div>
                  </div>
                </div>

                {/* 중앙 옵션 카테고리별 리스트 */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* 1. 유상 옵션 (PAID) 섹션 */}
                  <div data-mid="table-paid-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={15} color="#2563eb" /> 1. 유상 옵션 (PAID) - 옵션품목마스터 상속
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        * 추가된 현장 특약 단가 오버라이드 가능
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                        {workingOptionItems.filter(item => item.category === 'PAID' && !item.isEnabled).map(item => (
                          <button
                            key={item.optionId}
                            type="button"
                            onClick={() => handleToggleOption(item.optionId)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              fontWeight: 500,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          >
                            + {item.name}
                          </button>
                        ))}
                      </div>

                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '8px 10px', width: '60px', textAlign: 'center' }}>적용 해제</th>
                            <th style={{ padding: '8px 10px', width: '200px' }}>옵션 품목명</th>
                            <th style={{ padding: '8px 10px', width: '90px' }}>기준단가</th>
                            <th style={{ padding: '8px 10px', width: '130px' }}>현장 특약단가 (₩)</th>
                            <th style={{ padding: '8px 10px', width: '70px', textAlign: 'center' }}>필수</th>
                            <th style={{ padding: '8px 10px' }}>현장 규격 메모</th>
                          </tr>
                        </thead>
                        <tbody>
{workingOptionItems.filter(item => item.category === 'PAID' && item.isEnabled).length === 0 ? (
  <tr>
    <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div>
          현장에 추가된 유상 옵션이 없습니다. 상단의 드롭다운에서 등록된 마스터 품목을 선택하여 추가해주세요.
        </div>
      </div>
    </td>
  </tr>
) : (
  workingOptionItems.filter(item => item.category === 'PAID' && item.isEnabled).map(item => {
    return (
      <tr 
        key={item.id}
        style={{
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'rgba(37, 99, 235, 0.03)'
        }}
      >
        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => handleToggleOption(item.optionId)}
            style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
          >
            제외
          </button>
        </td>
        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1d4ed8' }}>
          {item.name}
        </td>
        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
          ₩{(item.defaultPrice || 0).toLocaleString()}
        </td>
        <td style={{ padding: '8px 10px' }}>
          <input
            type="number"
            value={item.appliedPrice}
            onChange={e => handlePriceChange(item.optionId, Number(e.target.value))}
            style={{
              width: '100px',
              height: '28px',
              padding: '0 8px',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '11.5px'
            }}
          />
        </td>
        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
          <input
            type="checkbox"
            checked={item.isRequired}
            onChange={() => handleToggleRequired(item.optionId)}
            style={{ cursor: 'pointer', width: '15px', height: '15px' }}
          />
        </td>
        <td style={{ padding: '8px 10px' }}>
          <input
            type="text"
            placeholder="현장 특이사항"
            value={item.note || ''}
            onChange={e => handleNoteChange(item.optionId, e.target.value)}
            style={{
              width: '100%',
              height: '28px',
              padding: '0 8px',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '11.5px'
            }}
          />
        </td>
      </tr>
    );
  })
)}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 2. 보양 작업 (PROTECTION) 섹션 */}
                  <div data-mid="card-protection-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={15} color="#059669" /> 2. 보양 작업 (PROTECTION) - 1종 선택
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        * 현장 환경에 따른 보호 완충/함석 보양 규격 지정
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                        {workingOptionItems.filter(item => item.category === 'PROTECTION').map(item => (
                          <button
                            key={item.optionId}
                            type="button"
                            onClick={() => handleSelectProtection(item.isEnabled ? '' : item.optionId)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              borderRadius: '6px',
                              border: item.isEnabled ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                              backgroundColor: item.isEnabled ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-surface)',
                              color: item.isEnabled ? 'var(--primary)' : 'var(--text-primary)',
                              cursor: 'pointer',
                              fontWeight: item.isEnabled ? 700 : 500,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>
                  </div>

                  {/* 3. 현장 요구 사양 (SPEC) 섹션 */}
                  <div data-mid="card-spec-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckSquare size={15} color="#d97706" /> 3. 현장 요구 사양 (SPEC)
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        * 안전인증, 경광등, 센서 연동 등 필수 사양 점검
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                        {workingOptionItems.filter(item => item.category === 'SPEC' && !item.isEnabled).map(item => (
                          <button
                            key={item.optionId}
                            type="button"
                            onClick={() => handleToggleOption(item.optionId)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              fontWeight: 500,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          >
                            + {item.name}
                          </button>
                        ))}
                      </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
{workingOptionItems.filter(item => item.category === 'SPEC' && item.isEnabled).length === 0 ? (
  <div style={{ padding: '16px', textAlign: 'center', width: '100%', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <span>현장에 적용된 요구 사양이 없습니다. 상단의 드롭다운에서 등록된 마스터 품목을 선택하여 추가해주세요.</span>
    </div>
  </div>
) : (
  workingOptionItems.filter(item => item.category === 'SPEC' && item.isEnabled).map(item => {
    return (
      <div
        key={item.id}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 10px 6px 6px', borderRadius: '8px',
          border: '1.5px solid #d97706',
          backgroundColor: 'rgba(217, 119, 6, 0.08)',
        }}
      >
        <button
          type="button"
          onClick={() => handleToggleOption(item.optionId)}
          style={{ cursor: 'pointer', border: 'none', background: 'transparent', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}
          title="사양 제외"
        >
          <X size={14} strokeWidth={3} />
        </button>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#b45309' }}>
          {item.name}
        </span>
      </div>
    );
  })
)}
                    </div>
                  </div>

                </div>

                {/* ──────────────────────────────────────────────────────── */}
                {/* 헌장 3.5 Gutenberg Z-패턴: ④우하단 대차대조 합계 검증 바 */}
                {/* ──────────────────────────────────────────────────────── */}
                <div 
                  data-mid="summary-monthly-fee"
                  style={{
                    padding: '14px 20px',
                    borderTop: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      적용 유상옵션: <strong>{workingOptionItems.filter(i => i.category === 'PAID' && i.isEnabled).length}건</strong>
                    </span>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      보양작업: <strong>{workingOptionItems.find(i => i.category === 'PROTECTION' && i.isEnabled)?.name || 'NONE'}</strong>
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#1d4ed8' }}>
                      💰 월 유상옵션 총액: ₩{monthlyPaidFeeTotal.toLocaleString()}
                    </span>
                  </div>

                  <button data-hs-trigger="Save"
                    type="button"
                    data-mid="btn-save-site-options"
                    disabled={isSaving}
                    onClick={handleSaveSiteOptions}
                    style={{
                      padding: '8px 24px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: 'var(--primary)',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
                    }}
                  >
                    <CheckCircle2 size={15} />
                    {isSaving ? '저장 중...' : '현장 옵션 설정 저장'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── [탭 2: 옵션 품목 마스터 (StandardOption) 관리] ── */}
      {activeTab === 'MASTER_OPTIONS' && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                옵션 품목 마스터 (전사 기준 풀)
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                여기서 등록 및 관리되는 품목과 기준 단가는 모든 현장에 100% 자동으로 상속됩니다.
              </p>
            </div>

            <button data-hs-trigger="Register"
              type="button"
              onClick={() => {
                setEditingMasterOption({
                  category: 'PAID',
                  name: '',
                  defaultPrice: 50000,
                  unit: '월',
                  description: '',
                  isActive: true,
                  sortOrder: (standardOptions?.length || 0) + 1
                });
                setShowMasterModal(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Plus size={14} />
              신규 옵션 품목 등록
            </button>
          </div>

          {/* 마스터 그리드 */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <table style={{ width: '100%', minWidth: '750px', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th onClick={() => handleMasterSort('category')} style={{ padding: '9px 12px', width: '80px', cursor: 'pointer' }}>분류{masterSortConfig.key === 'category' ? (masterSortConfig.direction === 'asc' ? ' ▲' : masterSortConfig.direction === 'desc' ? ' ▼' : '') : ''}</th>
                  <th onClick={() => handleMasterSort('name')} style={{ padding: '9px 12px', width: '220px', cursor: 'pointer' }}>옵션 품목명{masterSortConfig.key === 'name' ? (masterSortConfig.direction === 'asc' ? ' ▲' : masterSortConfig.direction === 'desc' ? ' ▼' : '') : ''}</th>
                  <th onClick={() => handleMasterSort('defaultPrice')} style={{ padding: '9px 12px', width: '110px', cursor: 'pointer' }}>기준단가{masterSortConfig.key === 'defaultPrice' ? (masterSortConfig.direction === 'asc' ? ' ▲' : masterSortConfig.direction === 'desc' ? ' ▼' : '') : ''}</th>
                  <th onClick={() => handleMasterSort('unit')} style={{ padding: '9px 12px', width: '70px', cursor: 'pointer' }}>단위{masterSortConfig.key === 'unit' ? (masterSortConfig.direction === 'asc' ? ' ▲' : masterSortConfig.direction === 'desc' ? ' ▼' : '') : ''}</th>
                  <th onClick={() => handleMasterSort('description')} style={{ padding: '9px 12px', cursor: 'pointer' }}>설명{masterSortConfig.key === 'description' ? (masterSortConfig.direction === 'asc' ? ' ▲' : masterSortConfig.direction === 'desc' ? ' ▼' : '') : ''}</th>
                  <th onClick={() => handleMasterSort('isActive')} style={{ padding: '9px 12px', width: '80px', textAlign: 'center', cursor: 'pointer' }}>상태{masterSortConfig.key === 'isActive' ? (masterSortConfig.direction === 'asc' ? ' ▲' : masterSortConfig.direction === 'desc' ? ' ▼' : '') : ''}</th>
                  <th style={{ padding: '9px 12px', width: '80px', textAlign: 'center' }}>수정</th>
                </tr>
              </thead>
              <tbody>
                {sortedStandardOptions.map(opt => {
                  const isPaid = opt.category === 'PAID';

  return (
                    <tr key={opt.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: isPaid ? 'rgba(37, 99, 235, 0.12)' : 'rgba(5, 150, 105, 0.12)',
                          color: isPaid ? '#1d4ed8' : '#059669'
                        }}>
                          {isPaid ? '유상옵션' : opt.category === 'PROTECTION' ? '보양작업' : '요구사양'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {opt.name}
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 700 }}>
                        ₩{(opt.defaultPrice || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-secondary)' }}>
                        {opt.unit || '월'}
                      </td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-secondary)' }}>
                        {opt.description || '-'}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: opt.isActive ? '#10b981' : 'var(--text-muted)'
                        }}>
                          {opt.isActive ? '사용중' : '중단'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMasterOption({ ...opt });
                            setShowMasterModal(true);
                          }}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          수정
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 🏷️ 옵션 품목 마스터 등록/수정 모달 ── */}
      {showMasterModal && editingMasterOption && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '16px'
        }}>
          <form 
            onSubmit={handleSaveMasterOption}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: '480px',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {editingMasterOption.id ? '옵션 품목 마스터 수정' : '신규 옵션 품목 등록'}
            </h3>

            {/* 분류 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)' }}>
                옵션 분류 *
              </label>
              <select
                value={editingMasterOption.category || 'PAID'}
                onChange={e => setEditingMasterOption({ ...editingMasterOption, category: e.target.value as any })}
                style={{
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px'
                }}
              >
                <option value="PAID">유상 옵션 (PAID)</option>
                <option value="PROTECTION">보양 작업 (PROTECTION)</option>
                <option value="SPEC">요구 사양 (SPEC)</option>
              </select>
            </div>

            {/* 품목명 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)' }}>
                옵션 품목명 *
              </label>
              <input
                type="text"
                required
                placeholder="예: 협착방지봉 / 상부센서 (4EA)"
                value={editingMasterOption.name || ''}
                onChange={e => setEditingMasterOption({ ...editingMasterOption, name: e.target.value })}
                style={{
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px'
                }}
              />
            </div>

            {/* 기준 단가 및 단위 */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  기준 단가 (₩)
                </label>
                <input
                  type="number"
                  value={editingMasterOption.defaultPrice || 0}
                  onChange={e => setEditingMasterOption({ ...editingMasterOption, defaultPrice: Number(e.target.value) })}
                  style={{
                    height: '34px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    textAlign: 'right'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  단위
                </label>
                <select
                  value={editingMasterOption.unit || '월'}
                  onChange={e => setEditingMasterOption({ ...editingMasterOption, unit: e.target.value })}
                  style={{
                    height: '34px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px'
                  }}
                >
                  <option value="월">월</option>
                  <option value="건">건</option>
                  <option value="대">대</option>
                </select>
              </div>
            </div>

            {/* 설명 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)' }}>
                품목 설명
              </label>
              <input
                type="text"
                placeholder="규격 및 안전 점검 내용"
                value={editingMasterOption.description || ''}
                onChange={e => setEditingMasterOption({ ...editingMasterOption, description: e.target.value })}
                style={{
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px'
                }}
              />
            </div>

            {/* 사용 여부 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="optActive"
                checked={editingMasterOption.isActive !== false}
                onChange={e => setEditingMasterOption({ ...editingMasterOption, isActive: e.target.checked })}
                style={{ width: '16px', height: '16px' }}
              />
              <label htmlFor="optActive" style={{ fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>
                전사 현장 상속 풀에 사용 활성화
              </label>
            </div>

            {/* 버튼군 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <div>
                  {editingMasterOption.id && (
                    <button
                      type="button"
                      data-hs-trigger="Delete"
                      onClick={async () => {
                        if (confirm('이 옵션 품목 마스터를 삭제하시겠습니까?')) {
                          try {
                            await deleteStandardOption(editingMasterOption.id!);
                            setShowMasterModal(false);
                            setEditingMasterOption(null);
                            await fullRefreshFromServer();
                          } catch (err: any) {
                            showErrorModal(`삭제 실패: ${err.message}`);
                          }
                        }
                      }}
                      style={{
                        padding: '7px 14px', borderRadius: '6px', border: '1px solid #ef4444', 
                        color: '#ef4444', backgroundColor: 'transparent', fontSize: '12.5px', cursor: 'pointer'
                      }}
                    >
                      삭제
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowMasterModal(false);
                    setEditingMasterOption(null);
                  }}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                  fontSize: '12.5px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button data-hs-trigger="Save"
                type="submit"
                style={{
                  padding: '7px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                저장
              </button></div></div></form>
        </div>
      )}
    </div>
  );
};
