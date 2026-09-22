const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /(    <\/div>\s*\n  \);\s*\n\};\s*$)/;
const match = content.match(regex);
if (match) {
  const replacement = `      {/* 청구 분할 모달 */}
      {splitModalOpen && splitTargetId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '12px',
            width: '400px', maxWidth: '90%', border: '1px solid var(--border-color)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold' }}>청구 분할 (금액 기준)</h3>
            <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              원본 청구서의 금액 중 일부를 덜어내어 <strong>새로운 청구서로 독립</strong>시킵니다.<br />
              <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>총액 보존:</span> 분할된 두 청구서의 합은 원본과 동일하게 유지됩니다.
            </div>
            
            {(() => {
              const origBilling = billings.find(b => b.id === splitTargetId);
              if (!origBilling) return null;
              
              const splitAmount = parseInt(splitAmountInput.replace(/[^0-9]/g, ''), 10) || 0;
              const remainingAmount = origBilling.totalAmount - splitAmount;
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: 'var(--bg-main)', borderRadius: '6px' }}>
                    <span>원본 청구 총액:</span>
                    <strong>{origBilling.totalAmount.toLocaleString()}원</strong>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>분할되어 독립할 금액 (새 청구서 B)</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="예: 3,000,000"
                      value={splitAmountInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setSplitAmountInput(val ? Number(val).toLocaleString() : '');
                      }}
                      style={{ width: '100%', fontSize: '16px', fontWeight: 'bold', textAlign: 'right' }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: remainingAmount < 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)', borderRadius: '6px', border: remainingAmount < 0 ? '1px solid var(--danger)' : '1px solid var(--primary)' }}>
                    <span>분할 후 원본에 남을 금액 (청구서 A):</span>
                    <strong style={{ color: remainingAmount < 0 ? 'var(--danger)' : 'var(--primary)' }}>
                      {remainingAmount.toLocaleString()}원
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                    <button 
                      className="btn-secondary" 
                      onClick={() => { setSplitModalOpen(false); setSplitTargetId(null); setSplitAmountInput(''); }}
                    >취소</button>
                    <button 
                      className="btn-primary" 
                      onClick={handleSplitSubmit}
                      disabled={splitAmount <= 0 || splitAmount >= origBilling.totalAmount}
                    >분할 확정</button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
$1`;
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Added Split Modal UI');
} else {
  console.log('Target not found for Split Modal UI');
}
