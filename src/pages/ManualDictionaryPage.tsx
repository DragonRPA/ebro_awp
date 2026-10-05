// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { ALL_MENU_MANUALS } from '../data/allMenuManuals';
import { Search, BookOpen, Layers, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ManualDictionaryPage: React.FC = () => {
  const { setActiveTab,  } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMenu, setSelectedMenu] = useState<string>('ALL');

  const allProcesses = useMemo(() => {
    const list: any[] = [];
    ALL_MENU_MANUALS.forEach(menu => {
      if (menu.processes && menu.processes.length > 0) {
        menu.processes.forEach((proc: any) => {
          list.push({
            menuId: menu.menuId,
            menuName: menu.menuName,
            processId: proc.processId,
            title: proc.title,
            description: proc.description,
            steps: proc.steps || []
          });
        });
      }
    });
    return list;
  }, []);

  const menuOptions = useMemo(() => {
    const menus = new Set<string>();
    allProcesses.forEach(p => menus.add(p.menuName));
    return Array.from(menus).sort();
  }, [allProcesses]);

  const filteredProcesses = useMemo(() => {
    return allProcesses.filter(p => {
      const matchMenu = selectedMenu === 'ALL' || p.menuName === selectedMenu;
      const q = searchQuery.toLowerCase();
      const matchQuery = !q || p.title.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
      return matchMenu && matchQuery;
    });
  }, [allProcesses, searchQuery, selectedMenu]);

  const handleStartProcess = (menuId: string) => {
    // Navigate to the target menu
    // The actual manual popup can be opened using Ctrl+M on that page,
    // or by expanding the context logic if we had access to openManual(pageId).
    // For now, we simply navigate to the menu tab where the user can initiate the task.
    setActiveTab(menuId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={20} color="var(--primary)" />
          전사 업무 매뉴얼 사전
        </h2>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          등록된 개별 업무 프로세스: <strong>{allProcesses.length}</strong>건
        </div>
      </div>

      <div className="card" style={{ padding: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
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

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
        {filteredProcesses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            검색 결과가 없습니다.
          </div>
        ) : (
          filteredProcesses.map((proc, idx) => (
            <div key={`${proc.menuId}-${proc.processId}-${idx}`} className="card" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-muted)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Layers size={12} /> {proc.menuName}
                  </div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>
                    {proc.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {proc.description}
                  </p>
                </div>
                <button 
                  className="btn-primary"
                  onClick={() => handleStartProcess(proc.menuId)}
                  style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  해당 메뉴로 이동
                </button>
              </div>
              <div style={{ padding: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>작업 절차 (총 {proc.steps.length}단계)</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {proc.steps.map((step: any, sIdx: number) => (
                    <div key={sIdx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ 
                        width: '24px', height: '24px', borderRadius: '12px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', flexShrink: 0
                      }}>
                        {sIdx + 1}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '2px' }}>
                          {step.label}
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
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
