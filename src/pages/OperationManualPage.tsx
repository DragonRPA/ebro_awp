// src/pages/OperationManualPage.tsx
// 전사 업무매뉴얼 — 존재하는 모든 메뉴 기능(51개)의 본질적 업무 목적 및 표준 업무 편람
import React, { useState, useRef, useMemo } from 'react';
import {
  Printer, BookOpen, Building2, Truck, Wrench, Briefcase, Search,
  CheckCircle2, AlertCircle, ChevronRight, ChevronDown, ZoomIn, ZoomOut,
  RotateCcw, Shield, Layers, TrendingUp, Settings, Terminal, CheckSquare,
  Sparkles, ExternalLink, Filter, HelpCircle, ArrowRight, CornerDownRight
} from 'lucide-react';
import { ALL_MENU_MANUALS, MenuManualDetail } from '../data/allMenuManuals';
import { useManual } from '../hooks/useManual';

type DeptFilter = 'all' | 'sales' | 'inout' | 'maintenance' | 'logistics' | 'management' | 'special' | 'dev';

export const OperationManualPage: React.FC = () => {
  const [selectedMenuId, setSelectedMenuId] = useState<string>('dashboard');
  const [deptFilter, setDeptFilter] = useState<DeptFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    grp_top: true,
    grp_approval: true,
    grp_sales: true,
    grp_product_asset: true,
    grp_logistics: true,
    grp_inout: true,
    grp_maintenance: true,
    grp_management: true,
    grp_management_special: true,
    grp_tools: true,
    grp_system_dev: true,
  });

  const { seedAllManuals, saving } = useManual();
  const [seedingSuccess, setSeedingSuccess] = useState<string | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleZoom = (delta: number) => {
    setZoomLevel(prev => Math.min(Math.max(prev + delta, 80), 130));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleBatchSeed = async () => {
    if (!window.confirm('전사 51개 모든 메뉴의 표준 매뉴얼을 DB에 일괄 주입(동기화)하시겠습니까?')) return;
    const res = await seedAllManuals();
    setSeedingSuccess(`전사 매뉴얼 주입 완료! (성공: ${res.success}건, 실패: ${res.failed}건)`);
    setTimeout(() => setSeedingSuccess(null), 5000);
  };

  // 부서 매핑 필터
  const filteredManuals = useMemo(() => {
    return ALL_MENU_MANUALS.filter(m => {
      // 1. 부서 필터
      if (deptFilter === 'sales' && !m.groupId.includes('sales')) return false;
      if (deptFilter === 'inout' && !m.groupId.includes('inout') && !m.groupId.includes('product_asset')) return false;
      if (deptFilter === 'maintenance' && !m.groupId.includes('maintenance')) return false;
      if (deptFilter === 'logistics' && !m.groupId.includes('logistics')) return false;
      if (deptFilter === 'management' && !m.groupId.includes('management') && !m.groupId.includes('approval')) return false;
      if (deptFilter === 'special' && !m.groupId.includes('special')) return false;
      if (deptFilter === 'dev' && !m.groupId.includes('dev')) return false;

      // 2. 검색어 필터
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchTitle = m.menuName.toLowerCase().includes(q);
        const matchObjective = m.objective.toLowerCase().includes(q);
        const matchDept = m.department.toLowerCase().includes(q);
        const matchSeq = m.cognitiveSequence.some(s => s.toLowerCase().includes(q));
        const matchRules = m.rulesCompliance.some(r => r.toLowerCase().includes(q));
        return matchTitle || matchObjective || matchDept || matchSeq || matchRules;
      }

      return true;
    });
  }, [deptFilter, searchQuery]);

  // 그룹별 묶음 계산
  const groupedMenus = useMemo(() => {
    const groups: { groupId: string; groupName: string; items: MenuManualDetail[] }[] = [];
    filteredManuals.forEach(item => {
      let grp = groups.find(g => g.groupId === item.groupId);
      if (!grp) {
        grp = { groupId: item.groupId, groupName: item.groupName, items: [] };
        groups.push(grp);
      }
      grp.items.push(item);
    });
    return groups;
  }, [filteredManuals]);

  // 현재 선택된 메뉴 상세
  const activeManual = useMemo(() => {
    return ALL_MENU_MANUALS.find(m => m.menuId === selectedMenuId) || ALL_MENU_MANUALS[0];
  }, [selectedMenuId]);

  return (
    <div data-subview="operations_manual" data-subview-title="Generated" className="manual-page-root" style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', overflow: 'hidden' }}>
      
      {/* ── 인쇄 전용 글로벌 스타일 ── */}
      <style>{`
        @media print {
          header, nav, aside, .mobile-burger-btn, .sidebar, .no-print, .manual-toolbar, .manual-nav-sidebar {
            display: none !important;
          }
          body, html, #root, .manual-page-root, .manual-content-scroll {
            height: auto !important;
            overflow: visible !important;
            background-color: #FFFFFF !important;
            color: #000000 !important;
          }
          .manual-page-root {
            padding: 0 !important;
          }
          .manual-paper {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          .manual-section {
            page-break-inside: avoid;
            break-inside: avoid;
            margin-bottom: 24px !important;
            border-bottom: 1px solid #E2E8F0 !important;
            padding-bottom: 16px !important;
          }
          .print-break-before {
            page-break-before: always;
            break-before: always;
          }
          @page {
            size: A4 portrait;
            margin: 15mm 12mm 15mm 12mm;
          }
        }
      `}</style>

      {/* ── 상단 툴바 (화면 표시용, 인쇄 시 숨김) ── */}
      <div className="manual-toolbar no-print" style={{
        padding: '10px 20px',
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        flexShrink: 0,
        zIndex: 20
      }}>
        {/* 타이틀 및 부서 필터 */}
        <div data-mid="[data-mid=" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={18} />
            </div>
            <div>
              <span style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>전사 업무매뉴얼</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', whiteSpace: 'nowrap' }}>E-Bro ERP 실무 표준 가이드 (총 {ALL_MENU_MANUALS.length}개 메뉴)</span>
            </div>
          </div>

          {/* 검색바 */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="메뉴/목표/헌장 검색..."
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                fontSize: '12.5px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px' }}
              >
                ✕
              </button>
            )}
          </div>

          {/* 부서 필터 버튼군 */}
          <div style={{ display: 'flex', gap: '3px', backgroundColor: 'var(--bg-app)', padding: '2px', borderRadius: '8px', overflowX: 'auto' }}>
            {[
              { id: 'all', label: '전체' },
              { id: 'sales', label: '영업부' },
              { id: 'inout', label: '출고/자산' },
              { id: 'maintenance', label: '정비/AS' },
              { id: 'logistics', label: '배차' },
              { id: 'management', label: '경영/재무' },
              { id: 'special', label: '인사/특수' },
              { id: 'dev', label: '시스템/개발' },
            ].map(b => (
              <button
                key={b.id}
                onClick={() => setDeptFilter(b.id as DeptFilter)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: deptFilter === b.id ? '#2563EB' : 'transparent',
                  color: deptFilter === b.id ? '#FFFFFF' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* 우측 조작 액션 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* 보기 모드 (선택 메뉴 1건 vs 전체 연속) */}
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-app)', borderRadius: '6px', padding: '2px' }}>
            <button
              onClick={() => setViewMode('single')}
              style={{
                padding: '4px 8px', fontSize: '11.5px', fontWeight: 700, border: 'none', borderRadius: '4px', cursor: 'pointer',
                backgroundColor: viewMode === 'single' ? '#2563EB' : 'transparent',
                color: viewMode === 'single' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              선택 메뉴
            </button>
            <button
              onClick={() => setViewMode('all')}
              style={{
                padding: '4px 8px', fontSize: '11.5px', fontWeight: 700, border: 'none', borderRadius: '4px', cursor: 'pointer',
                backgroundColor: viewMode === 'all' ? '#2563EB' : 'transparent',
                color: viewMode === 'all' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              전체 연속 보기
            </button>
          </div>

          {/* 줌 컨트롤 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: 'var(--bg-app)', padding: '2px 4px', borderRadius: '6px' }}>
            <button
              onClick={() => handleZoom(-10)}
              style={{ padding: '3px 5px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              title="축소"
            >
              <ZoomOut size={13} />
            </button>
            <span style={{ fontSize: '11.5px', fontWeight: '700', padding: '0 4px', minWidth: '35px', textAlign: 'center' }}>
              {zoomLevel}%
            </span>
            <button
              onClick={() => handleZoom(10)}
              style={{ padding: '3px 5px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              title="확대"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          {/* DB 일괄 주입 버튼 */}
          <button
            onClick={handleBatchSeed}
            disabled={saving}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '700',
              border: 'none',
              backgroundColor: '#D97706',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap'
            }}
            title="51개 모든 메뉴의 표준 매뉴얼을 DB에 영구 일괄 주입"
          >
            <Sparkles size={13} />
            <span>{saving ? 'DB 주입중…' : 'DB 일괄 주입'}</span>
          </button>

          {/* 인쇄 버튼 */}
          <button
            onClick={handlePrint}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '700',
              border: 'none',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap'
            }}
          >
            <Printer size={13} />
            <span>A4 인쇄</span>
          </button>
        </div>
      </div>

      {seedingSuccess && (
        <div style={{ padding: '8px 20px', backgroundColor: '#D1FAE5', color: '#065F46', fontSize: '12.5px', fontWeight: 700, borderBottom: '1px solid #A7F3D0' }}>
          ✓ {seedingSuccess}
        </div>
      )}

      {/* ── 본문 레이아웃 (좌측 메뉴 네비게이션 + 우측 매뉴얼 상세 뷰어) ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* 좌측 메뉴 사이드바 (화면 표시용) */}
        <div className="manual-nav-sidebar no-print" style={{
          width: '260px',
          borderRight: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          overflowY: 'auto',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 8px',
          gap: '4px'
        }}>
          <div style={{ padding: '0 8px 6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
            메뉴 목록 ({filteredManuals.length}건)
          </div>

          {groupedMenus.map(grp => {
            const isExp = expandedGroups[grp.groupId] !== false;
            return (
              <div key={grp.groupId} style={{ marginBottom: '4px' }}>
                <button
                  onClick={() => toggleGroup(grp.groupId)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {grp.groupName} ({grp.items.length})
                  </span>
                  {isExp ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>

                {isExp && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginLeft: '8px', borderLeft: '1.5px solid var(--border-color)', paddingLeft: '6px', marginTop: '2px' }}>
                    {grp.items.map(item => {
                      const isActive = item.menuId === selectedMenuId;
                      return (
                        <button
                          key={item.menuId}
                          onClick={() => {
                            setSelectedMenuId(item.menuId);
                            if (viewMode === 'all') {
                              const el = document.getElementById(`manual-${item.menuId}`);
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 8px',
                            borderRadius: '5px',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: isActive ? 700 : 500,
                            cursor: 'pointer',
                            textAlign: 'left',
                            backgroundColor: isActive ? 'rgba(37,99,235,0.1)' : 'transparent',
                            color: isActive ? '#2563EB' : 'var(--text-main)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          <span style={{ fontSize: '11px', opacity: 0.7 }}>•</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.menuName}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 우측 매뉴얼 상세 컨텐츠 영역 */}
        <div className="manual-content-scroll" style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: 'var(--bg-app)'
        }}>
          <div
            className="manual-paper"
            style={{
              width: '100%',
              maxWidth: '920px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '36px 40px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease'
            }}
          >
            {viewMode === 'single' ? (
              <ManualDetailCard item={activeManual} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
                {filteredManuals.map((item, idx) => (
                  <div key={item.menuId} id={`manual-${item.menuId}`} className="manual-section print-break-before">
                    <ManualDetailCard item={item} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

/**
 * 개별 메뉴 매뉴얼 상세 렌더링 카드 컴포넌트
 */
const ManualDetailCard: React.FC<{ item: MenuManualDetail }> = ({ item }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* ── 헤더: 메뉴명, 부서, 아키타입 ── */}
      <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: '#EFF6FF', color: '#1D4ED8', fontSize: '11.5px', fontWeight: 700 }}>
            {item.groupName}
          </span>
          <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: '#F1F5F9', color: '#475569', fontSize: '11.5px', fontWeight: 700 }}>
            담당: {item.department}
          </span>
          <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#92400E', fontSize: '11.5px', fontWeight: 700 }}>
            {item.archetype}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            menuId: {item.menuId}
          </span>
        </div>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
          {item.menuName} 표준 업무 매뉴얼
        </h2>
      </div>

      {/* ── 1. 최종 업무 목표 (Terminal Objective - Gutenberg 질문 1) ── */}
      <div style={{ backgroundColor: '#F8FAFC', padding: '14px 18px', borderRadius: '8px', borderLeft: '4px solid #2563EB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '13px', fontWeight: 900, color: '#1E40AF' }}>🎯 최종 업무 목표 (Terminal Objective)</span>
        </div>
        <div style={{ fontSize: '13.5px', lineHeight: '1.6', color: '#1E293B', fontWeight: 600 }}>
          {item.objective}
        </div>
      </div>

      {/* ── 2. 시작 정보 및 전제 조건 (Scope - Gutenberg 질문 2) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#059669' }}></span>
          <span>1단계: 조회 스코프 및 필수 사전 데이터 (Scope)</span>
        </div>
        <div style={{ padding: '10px 14px', borderRadius: '6px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          {item.scopeInfo}
        </div>
      </div>

      {/* ── 3. 인지 및 조작 순서 1-Way 동선 (Cognitive Sequence - Gutenberg Z-패턴) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563EB' }}></span>
          <span>2단계: Gutenberg Z-패턴 4단계 조작 동선 (Cognitive Sequence)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {item.cognitiveSequence.map((step, sIdx) => (
            <div key={sIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderRadius: '6px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
              <span style={{ minWidth: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#2563EB', color: '#fff', fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {sIdx + 1}
              </span>
              <span style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text-main)', fontWeight: 500 }}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 메뉴 내부 하위 탭 구성 및 역할 ── */}
      {item.subTabs && item.subTabs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={14} color="#0284C7" />
            <span>메뉴 내부 하위 탭 구성 및 역할 ({item.subTabs.length}개 탭)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
            {item.subTabs.map((st, idx) => (
              <div
                key={st.tabId || idx}
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                    {st.tabName}
                  </span>
                  <span style={{ fontSize: '10.5px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(2,132,199,0.1)', color: '#0284C7', fontWeight: 700 }}>
                    {st.tabId}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  {st.purpose}
                </div>
                {st.keyActions && st.keyActions.length > 0 && (
                  <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>주요 액션:</span>
                    {st.keyActions.map((act, aIdx) => (
                      <div key={aIdx} style={{ fontSize: '11.5px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: '#0284C7', fontSize: '10px' }}>▶</span>
                        <span>{act}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 팝업(모달) 업무 흐름 가이드 ── */}
      {item.modalWorkflows && item.modalWorkflows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="#7C3AED" />
            <span>팝업(모달) 업무 흐름 가이드 ({item.modalWorkflows.length}개 스튜디오)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {item.modalWorkflows.map((mw, mIdx) => (
              <div
                key={mIdx}
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  backgroundColor: '#FAF5FF',
                  border: '1px solid #E9D5FF',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F3E8FF', paddingBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#7C3AED', color: '#fff', fontSize: '11px', fontWeight: 800 }}>
                      모달 #{mIdx + 1}
                    </span>
                    <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#581C87' }}>
                      {mw.modalName}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#6B21A8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>트리거:</span>
                    <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#EDE9FE', border: '1px solid #DDD6FE', color: '#5B21B6', fontFamily: 'monospace' }}>
                      {mw.triggerButton}
                    </span>
                  </div>
                </div>

                {/* 3단계 스튜디오 파이프라인 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                  {/* ① 검토 및 입력 항목 */}
                  <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E9D5FF', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#7C3AED' }}>① 모달 내부 핵심 검토/입력 항목</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {mw.keyFields.map((kf, kIdx) => (
                        <div key={kIdx} style={{ fontSize: '11.5px', color: '#334155', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                          <span style={{ color: '#7C3AED', fontSize: '10px' }}>•</span>
                          <span>{kf}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ② 완결 액션 */}
                  <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E9D5FF', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#2563EB' }}>② 터미널 완결 액션 버튼</span>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E40AF', padding: '6px 8px', borderRadius: '4px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                      {mw.terminalAction}
                    </div>
                  </div>

                  {/* ③ 사후 상태 전이 */}
                  <div style={{ backgroundColor: '#fff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #E9D5FF', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>③ 사후 자산/DB 상태 전이 (Transition)</span>
                    <div style={{ fontSize: '11.5px', color: '#065F46', lineHeight: '1.45', fontWeight: 600 }}>
                      {mw.afterStateTransition}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. 최종 확정 및 대차대조 결과 (Audit Result - Gutenberg 질문 4) ── */}
      <div style={{ backgroundColor: '#F0FDF4', padding: '12px 16px', borderRadius: '8px', borderLeft: '4px solid #059669' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '13px', fontWeight: 900, color: '#065F46' }}>⚖️ 최종 감사 및 확정 결과 (Audit Result)</span>
        </div>
        <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#064E3B', fontWeight: 600 }}>
          {item.auditResult}
        </div>
      </div>

      {/* ── 5. 전사 시스템 개발 표준 헌장 준수 수칙 (카테고리 I~VII) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Shield size={14} color="#7C3AED" />
          <span>전사 시스템 개발 표준 헌장 준수 가이드</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 12px', borderRadius: '6px', backgroundColor: '#FAF5FF', border: '1px solid #E9D5FF' }}>
          {item.rulesCompliance.map((rule, rIdx) => (
            <div key={rIdx} style={{ fontSize: '12.5px', color: '#581C87', lineHeight: '1.5', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <span style={{ color: '#7C3AED', fontWeight: 700 }}>•</span>
              <span>{rule}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 6. 현장 물리적 마찰 방지 주의사항 (WTT 스트레스 대비) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AlertCircle size={14} color="#D97706" />
          <span>현장 실무 마찰 방지 주의사항 (WTT 대비)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 12px', borderRadius: '6px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
          {item.precautions.map((prec, pIdx) => (
            <div key={pIdx} style={{ fontSize: '12.5px', color: '#78350F', lineHeight: '1.5', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <span style={{ color: '#D97706', fontWeight: 700 }}>⚠️</span>
              <span>{prec}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 7. 인앱 오버레이 안내 스텝 (Annotation Anchors) ── */}
      {item.annotations && item.annotations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="#1D4ED8" />
            <span>화면 인앱 오버레이 안내 항목 (상단 [📖 매뉴얼 보기] 연동)</span>
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '6px 10px', width: '50px' }}>순번</th>
                  <th style={{ padding: '6px 10px', width: '80px' }}>유형</th>
                  <th style={{ padding: '6px 10px', width: '140px' }}>레이블</th>
                  <th style={{ padding: '6px 10px' }}>안내 내용</th>
                </tr>
              </thead>
              <tbody>
                {item.annotations.map(ann => (
                  <tr key={ann.seq} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 10px', fontWeight: 700 }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: ann.badgeColor, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
                        {ann.seq}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{ann.type}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--text-main)' }}>{ann.label}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>{ann.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
