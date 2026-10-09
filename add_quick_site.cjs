const fs = require('fs');
let c = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');

// 1. Add state
const stateInjection = `
  const [showQuickSiteModal, setShowQuickSiteModal] = useState(false);
  const [quickSiteForm, setQuickSiteForm] = useState({ customerId: '', name: '', address: '' });

  const handleSaveQuickSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSiteForm.customerId || !quickSiteForm.name) {
      showErrorModal('고객사와 현장명을 모두 입력해주세요.');
      return;
    }
    
    const rawName = quickSiteForm.name;
    const normalizedName = rawName.replace(/\\s+/g, '');
    const duplicate = (sites || []).find(s => 
      (s.name || '').replace(/\\s+/g, '') === normalizedName
    );
    if (duplicate) {
      const cust = (customers || []).find(c => c.id === duplicate.customerId);
      showErrorModal(\`동일한 이름의 현장이 이미 등록되어 있습니다.\\n\\n입력: [\${rawName}]\\n기존: [\${duplicate.name}]\\n소속 고객사: [\${cust?.name || '알 수 없음'}]\\n\\n띄어쓰기 등 휴먼 에러로 인한 중복 생성을 방지하기 위해 등록이 금지됩니다. 기존에 등록된 현장을 검색하여 활용해 주세요.\`);
      return;
    }

    try {
      const newSite: any = {
        customerId: quickSiteForm.customerId,
        name: quickSiteForm.name.trim(),
        address: quickSiteForm.address.trim(),
        contactName: '',
        contact: '',
        email: '',
        isActive: true
      };
      await saveSite(newSite);
      // alert user via showToast
      setShowQuickSiteModal(false);
      setQuickSiteForm({ customerId: '', name: '', address: '' });
      await fullRefreshFromServer();
    } catch (err: any) {
      showErrorModal(\`현장 등록 오류: \${err?.message || err}\`);
    }
  };
`;

c = c.replace(
  "const [siteStatusFilter, setSiteStatusFilter] = useState<'ACTIVE' | 'COMPLETED' | 'ALL'>('ACTIVE');",
  "const [siteStatusFilter, setSiteStatusFilter] = useState<'ACTIVE' | 'COMPLETED' | 'ALL'>('ACTIVE');\n" + stateInjection
);

// 2. Add Button
const btnInjection = `
            {/* 퀵 현장 등록 버튼 */}
            <button
              type="button"
              onClick={() => setShowQuickSiteModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '34px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid var(--primary)',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Plus size={14} />
              신규 현장 등록
            </button>
`;

c = c.replace(
  "{/* 엑셀 내보내기 버튼 */}",
  btnInjection + "\n            {/* 엑셀 내보내기 버튼 */}"
);

// 3. Add Modal
const modalInjection = `
      {/* 신규 현장 빠른 등록 모달 */}
      {showQuickSiteModal && (
        <div className="modal-overlay" onClick={() => setShowQuickSiteModal(false)} style={{ zIndex: 10000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', padding: 0, overflow: 'hidden' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={16} color="var(--primary)" />
                신규 현장 빠른 등록
              </h3>
              <button type="button" onClick={() => setShowQuickSiteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveQuickSite} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>소속 고객사 *</label>
                <select
                  required
                  value={quickSiteForm.customerId}
                  onChange={e => setQuickSiteForm({ ...quickSiteForm, customerId: e.target.value })}
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                >
                  <option value="">-- 고객사 선택 --</option>
                  {(customers || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>현장명 *</label>
                <input
                  required
                  type="text"
                  placeholder="예: 여의도 현대백화점 신축공사"
                  value={quickSiteForm.name}
                  onChange={e => setQuickSiteForm({ ...quickSiteForm, name: e.target.value })}
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>현장 주소 (선택)</label>
                <input
                  type="text"
                  placeholder="예: 서울시 영등포구 여의도동 22"
                  value={quickSiteForm.address}
                  onChange={e => setQuickSiteForm({ ...quickSiteForm, address: e.target.value })}
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowQuickSiteModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--primary)', border: '1px solid var(--primary)', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>등록 및 저장</button>
              </div>
            </form>
          </div>
        </div>
      )}
`;

c = c.replace(
  "{/* 토스트 알림 */}",
  modalInjection + "\n      {/* 토스트 알림 */}"
);

fs.writeFileSync('src/pages/SiteOptionManage.tsx', c);
console.log('Added quick site creation to SiteOptionManage');
