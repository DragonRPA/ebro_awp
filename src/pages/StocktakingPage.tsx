import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { StocktakingAudit, StocktakingAuditItem, db } from '../services/db';

export const StocktakingPage: React.FC = () => {
  const {
    stocktakingAudits,
    stocktakingAuditItems,
    createStocktakingAudit,
    confirmStocktakingAudit

  } = useApp();

  const [activeAudit, setActiveAudit] = useState<StocktakingAudit | null>(null);
  const [items, setItems] = useState<StocktakingAuditItem[]>([]);
  const [selectedArea, setSelectedArea] = useState('HQ'); // HQ or VEHICLE
  const [selectedMechanic, setSelectedMechanic] = useState('');
  
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Initialize or load active draft audit
  useEffect(() => {
    const draft = stocktakingAudits.find(a => a.status === 'DRAFT');
    if (draft) {
      setActiveAudit(draft);
      setSelectedArea(draft.targetType);
      if (draft.mechanicId) setSelectedMechanic(draft.mechanicId);
    } else {
      setActiveAudit(null);
      setItems([]);
    }
  }, [stocktakingAudits]);

  useEffect(() => {
    if (activeAudit) {
      setItems(stocktakingAuditItems.filter(i => i.auditId === activeAudit.id));
    }
  }, [activeAudit, stocktakingAuditItems]);

  const startAudit = async () => {
    if (selectedArea === 'VEHICLE' && !selectedMechanic) {
      alert('정비사를 선택해주세요.');
      return;
    }
    await createStocktakingAudit(selectedArea as 'HQ' | 'VEHICLE', selectedMechanic);
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim() || !activeAudit) return;

    const barcode = barcodeInput.trim().toUpperCase();
    
    // Find item by assetNo or consumable modelName/barcode (assuming consumableId is somewhat used as barcode for now)
    const item = items.find(i => 
      (i.itemType === 'ASSET' && i.assetNo?.toUpperCase() === barcode) ||
      (i.itemType === 'CONSUMABLE' && (i.consumableId?.toUpperCase() === barcode || i.modelName.toUpperCase().includes(barcode)))
    );

    if (item) {
      // Increase actualQty by 1
      handleUpdateItem(item.id, item.actualQty + 1);
      // Play beep sound here in a real app
    } else {
      alert(`스캔된 바코드(${barcode})와 일치하는 실사 대상 품목/장비가 없습니다.`);
    }

    setBarcodeInput('');
    barcodeRef.current?.focus();
  };

  const handleUpdateItem = async (itemId: string, newQty: number, diffReason?: StocktakingAuditItem['diffReason']) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const diffQty = newQty - item.systemQty;
    const diffAmount = diffQty * item.unitPrice;

    db.updateRow<StocktakingAuditItem>('stocktakingAuditItems', itemId, {
      actualQty: newQty,
      diffQty,
      diffAmount,
      diffReason: diffQty !== 0 ? (diffReason || 'LOST') : undefined
    });
    
    // update state locally for UI speed
    setItems(prev => prev.map(p => p.id === itemId ? { ...p, actualQty: newQty, diffQty, diffAmount, diffReason: diffQty !== 0 ? (diffReason || 'LOST') : undefined } : p));
  };

  const handleConfirm = async () => {
    if (!activeAudit) return;
    
    // Check if any item has variance but no reason
    const pendingReasons = items.some(i => i.diffQty !== 0 && !i.diffReason);
    if (pendingReasons) {
      alert('차이가 발생한 품목에 대해 사유를 모두 입력해야 결재상신이 가능합니다.');
      return;
    }

    if (confirm('실사 결과를 최종 확정하고 회계 원장 및 장비 상태에 반영(상신)하시겠습니까?')) {
      await confirmStocktakingAudit(activeAudit.id);
      alert('실사 확정 및 재무/상태 반영이 완료되었습니다.');
    }
  };

  const varianceCount = items.filter(i => i.diffQty !== 0).length;
  const totalItems = items.length;
  const scannedItems = items.filter(i => i.actualQty > 0).length;
  const progressPercent = totalItems > 0 ? Math.round((scannedItems / totalItems) * 100) : 0;

  if (!activeAudit) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>재고/자산 실사 (Stocktaking) 시작</h2>
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)} style={{ padding: '8px' }}>
            <option value="HQ">본사 주기장 (비가동 장비 및 소모품)</option>
            <option value="VEHICLE">정비사 차량 (소모품)</option>
          </select>
          {selectedArea === 'VEHICLE' && (
            <select value={selectedMechanic} onChange={e => setSelectedMechanic(e.target.value)} style={{ padding: '8px' }}>
              <option value="">정비사 선택</option>
              {db.users.filter((u: any) => u.role === 'MECHANIC').map((u: any) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}
          <button onClick={startAudit} style={{ padding: '8px 16px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer' }}>실사 전표 생성</button>
        </div>
      </div>
    );
  }

  return (
    <main className="inventory-reconciliation" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '2px solid #000', background: '#f5f5f5' }}>
        <form onSubmit={handleBarcodeSubmit} className="filter-scan-group z-pattern-start" style={{ display: 'flex', gap: '8px' }}>
          <div style={{ padding: '6px 12px', background: '#e0e0e0', fontWeight: 'bold' }}>
            {activeAudit.targetType === 'HQ' ? '본사 주기장' : `${activeAudit.mechanicName} 차량`}
          </div>
          <input 
            type="text" 
            className="barcode-input" 
            placeholder="바코드 대기..." 
            autoFocus 
            ref={barcodeRef}
            value={barcodeInput}
            onChange={e => setBarcodeInput(e.target.value)}
            style={{ padding: '6px 12px', width: '250px', border: '1px solid #ccc' }}
            onBlur={() => {
               // Focus back if possible, but for UX keep it simple
            }}
          />
          <button type="submit" style={{ display: 'none' }}>Scan</button>
        </form>
        <div className="status-group z-pattern-mid" style={{ fontWeight: 'bold', textAlign: 'right' }}>
          <span className="metric">진척 {progressPercent}%</span>
          <span className="metric variance-alert" style={{ color: varianceCount > 0 ? '#d32f2f' : '#333', marginLeft: '12px' }}>차이 {varianceCount}건</span>
        </div>
      </header>

      <section className="grid-container" style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
        <table className="high-density-table tablet-optimized" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#eee', zIndex: 1 }}>
            <tr>
              <th style={{ padding: '8px', borderBottom: '1px solid #ccc' }}>구분</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #ccc' }}>코드/관리번호</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #ccc' }}>품명/장비명</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #ccc', textAlign: 'right' }}>장부</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #ccc', textAlign: 'right' }}>실사</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #ccc', textAlign: 'right' }}>차이</th>
              <th style={{ padding: '8px', borderBottom: '1px solid #ccc' }}>사유</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const hasVariance = item.diffQty !== 0;
              return (
                <tr key={item.id} style={{ background: hasVariance ? '#ffebee' : '#fff', borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                    {item.itemType === 'ASSET' ? '🚜 장비' : '🔧 소모품'}
                  </td>
                  <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{item.itemType === 'ASSET' ? item.assetNo : item.consumableId}</td>
                  <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{item.modelName}</td>
                  <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{item.systemQty} {item.unit}</td>
                  <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <button onClick={() => handleUpdateItem(item.id, Math.max(0, item.actualQty - 1))} style={{ width: '24px', height: '24px', padding: 0 }}>-</button>
                      <input 
                        type="number" 
                        value={item.actualQty} 
                        onChange={e => handleUpdateItem(item.id, Number(e.target.value))}
                        style={{ width: '60px', textAlign: 'right' }}
                      />
                      <button onClick={() => handleUpdateItem(item.id, item.actualQty + 1)} style={{ width: '24px', height: '24px', padding: 0 }}>+</button>
                    </div>
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: hasVariance ? '#d32f2f' : '#333', whiteSpace: 'nowrap' }}>
                    {item.diffQty > 0 ? '+' : ''}{item.diffQty}
                  </td>
                  <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                    {hasVariance ? (
                      <select 
                        value={item.diffReason || 'LOST'} 
                        onChange={e => handleUpdateItem(item.id, item.actualQty, e.target.value as any)}
                        style={{ width: '120px' }}
                      >
                        <option value="LOST">망실/도난</option>
                        <option value="DAMAGED">파손/폐기</option>
                        {item.itemType === 'CONSUMABLE' && <option value="UNRECORDED_USAGE">미기록소모</option>}
                        <option value="SURPLUS">초과발견</option>
                        <option value="OTHER">기타</option>
                      </select>
                    ) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <footer style={{ padding: '12px', borderTop: '2px solid #000', display: 'flex', justifyContent: 'flex-end', background: '#f5f5f5' }}>
        <div className="action-group z-pattern-end" style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={() => { if(confirm('실사를 취소하시겠습니까?')) { /* call cancel */ } }} style={{ padding: '8px 16px' }}>실사 취소</button>
          <button 
            className="btn-primary" 
            onClick={handleConfirm}
            disabled={varianceCount > 0 && items.some(i => i.diffQty !== 0 && !i.diffReason)}
            style={{ 
              padding: '8px 24px', 
              background: (varianceCount > 0 && items.some(i => i.diffQty !== 0 && !i.diffReason)) ? '#ccc' : '#d32f2f', 
              color: '#fff', 
              fontWeight: 'bold', 
              border: 'none', 
              cursor: 'pointer' 
            }}
          >
            결재상신 및 확정
          </button>
        </div>
      </footer>
    </main>
  );
};

export default StocktakingPage;
