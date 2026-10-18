// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { ALL_MENU_MANUALS } from '../data/allMenuManuals';
import { Search, BookOpen, Layers, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useManualContext } from '../components/manual/ManualContext';

export const ManualDictionaryPage: React.FC = () => {
  const { setActiveTab, hasPermission, showErrorModal } = useApp();
  const { startGuidedTour } = useManualContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMenu, setSelectedMenu] = useState<string>('ALL');

  const allProcesses = useMemo(() => {
    const list: any[] = [];
    ALL_MENU_MANUALS.forEach(menu => {
      // 💡 [권한 격리] 현재 사용자가 'view' 권한을 보유한 메뉴의 프로세스만 노출 (권한 없는 메뉴 완전 배제)
      if (!hasPermission(menu.menuId, 'view')) {
        return;
      }

      if (menu.processes && menu.processes.length > 0) {
        menu.processes.forEach((proc: any, pIdx: number) => {
          list.push({
            menuId: menu.menuId,
            menuName: menu.menuName,
            processId: proc.processId || proc.id || `proc_${pIdx + 1}`,
            title: proc.title,
            description: proc.description || proc.title,
            steps: (proc.steps || []).map((s: any, sIdx: number) => ({
              ...s,
              seq: s.seq || sIdx + 1,
              label: s.label || `단계 ${sIdx + 1}`,
              description: s.description || s.text || '',
            }))
          });
        });
      }
    });
    return list;
  }, [hasPermission]);

  const menuOptions = useMemo(() => {
    const menus = new Set<string>();
    allProcesses.forEach(p => menus.add(p.menuName));
    return Array.from(menus).sort();
  }, [allProcesses]);

  // 권한 없는 메뉴가 선택되어 있다면 자동으로 전체로 리셋
  React.useEffect(() => {
    if (selectedMenu !== 'ALL' && !menuOptions.includes(selectedMenu)) {
      setSelectedMenu('ALL');
    }
  }, [menuOptions, selectedMenu]);

  const filteredProcesses = useMemo(() => {
    return allProcesses.filter(p => {
      const matchMenu = selectedMenu === 'ALL' || p.menuName === selectedMenu;
      const q = searchQuery.toLowerCase();
      const matchQuery = !q || p.title.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
      return matchMenu && matchQuery;
    });
  }, [allProcesses, searchQuery, selectedMenu]);

  const handleStartProcess = (menuId: string, processId?: string, menuName?: string) => {
    if (!hasPermission(menuId, 'view')) {
      if (typeof showErrorModal === 'function') {
        showErrorModal(`[${menuName || menuId}] 메뉴에 대한 접근 권한이 없습니다.`, '접근 권한 제한');
      } else {
        alert(`[${menuName || menuId}] 메뉴에 대한 접근 권한이 없습니다.`);
      }
      return;
    }

    if (typeof startGuidedTour === 'function') {
      startGuidedTour(menuId, processId, menuName);
    } else {
      setActiveTab(menuId);
    }
  };

  return (
    <div data-hs-observe="manualdictionarypage" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={20} color="var(--primary)" />
          전사 업무 매뉴얼 사전
        </h2>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          조회된 업무 프로세스: <strong>{filteredProcesses.length}</strong>건 (전체 {allProcesses.length}건)
        </div>
      </div>

      <div className="card" style={{ padding: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', flexShrink: 0, marginBottom: 0 }}>
        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>메뉴 필터</label>
          <select 
            className="form-control"
            value={selectedMenu}
            onChange={(e) => setSelectedMenu(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="ALL">전체 메뉴 보기</option>
            {menuOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ flex: '3 1 300px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>업무명 또는 설명 검색</label>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              className="form-control"
              placeholder="예: 신규 계약 등록, 배차, 출고..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '32px' }}
            />
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
          </div>
        </div>
      </div>

      <div data-mid="manual_dictionary-process-list" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
        {filteredProcesses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            검색 결과가 없습니다.
          </div>
        ) : (
          filteredProcesses.map((proc, idx) => (
            <div 
              key={`${proc.menuId}-${proc.processId}-${idx}`} 
              className="card"
              data-menu-id={proc.menuId}
              data-menu-name={proc.menuName} 
              style={{ 
                flexShrink: 0, 
                padding: 0, 
                marginBottom: 0, 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px', 
                overflow: 'hidden',
                backgroundColor: 'var(--bg-card)'
              }}
            >
              <div style={{ padding: '16px 20px', backgroundColor: 'var(--bg-muted, rgba(0,0,0,0.03))', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Layers size={12} /> {proc.menuName}
                  </div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>
                    {proc.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                    {proc.description}
                  </p>
                </div>
                <button 
                  type="button"
                  className="btn-primary"
                  onClick={() => handleStartProcess(proc.menuId, proc.processId, proc.menuName)}
                  style={{ 
                    whiteSpace: 'nowrap', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    height: '36px',
                    padding: '0 18px',
                    fontSize: '13px',
                    fontWeight: '700',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  가이드 시작
                </button>
              </div>
              <div style={{ padding: '18px 20px' }}>
                <h4 style={{ margin: '0 0 14px 0', fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>작업 절차 (총 {proc.steps.length}단계)</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {proc.steps.map((step: any, sIdx: number) => (
                    <div key={sIdx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ 
                        width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', flexShrink: 0
                      }}>
                        {sIdx + 1}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '2px' }}>
                          {step.label}
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                          {step.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
