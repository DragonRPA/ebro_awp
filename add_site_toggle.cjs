const fs = require('fs');
let c = fs.readFileSync('src/pages/Customers.tsx', 'utf8');

const statusToggleBlock = `
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', backgroundColor: (editingSite.isActive === false) ? 'var(--bg-card)' : 'rgba(37, 99, 235, 0.05)', border: (editingSite.isActive === false) ? '1px solid var(--border-color)' : '1px solid rgba(37, 99, 235, 0.2)', borderRadius: '6px' }}>
                <input
                  type="checkbox"
                  id="site-active-toggle"
                  checked={editingSite.isActive !== false}
                  onChange={e => setEditingSite({ ...editingSite, isActive: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="site-active-toggle" style={{ fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: (editingSite.isActive === false) ? 'var(--text-muted)' : 'var(--primary)' }}>
                  현재 가동(진행) 중인 현장입니다 (체크 해제 시 '완공' 처리)
                </label>
              </div>
`;

// Insert after 현장 주소 input block
c = c.replace(
  /placeholder="예: 서울시 영등포구 여의도동 22"\s*\/>\s*<\/div>/,
  `placeholder="예: 서울시 영등포구 여의도동 22"\n                />\n              </div>\n${statusToggleBlock}`
);

fs.writeFileSync('src/pages/Customers.tsx', c);
console.log('Added active toggle to Customers.tsx form');
