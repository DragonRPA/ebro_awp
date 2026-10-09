const fs = require('fs');
let c = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');

// 1. Add state
c = c.replace(
  "const [searchSiteKeyword, setSearchSiteKeyword] = useState<string>('');",
  "const [searchSiteKeyword, setSearchSiteKeyword] = useState<string>('');\n  const [siteStatusFilter, setSiteStatusFilter] = useState<'ACTIVE' | 'COMPLETED' | 'ALL'>('ACTIVE');"
);

// 2. Update filteredSites
c = c.replace(
  'return (sites || []).filter(s => {',
  `return (sites || []).filter(s => {
      const sActive = s.isActive !== false;
      if (siteStatusFilter === 'ACTIVE' && !sActive) return false;
      if (siteStatusFilter === 'COMPLETED' && sActive) return false;`
);

// 3. Add UI filter
const filterUI = `
          {/* 현장 상태 필터 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              상태 필터
            </span>
            <select
              value={siteStatusFilter}
              onChange={e => setSiteStatusFilter(e.target.value as any)}
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
                minWidth: '100px'
              }}
            >
              <option value="ACTIVE">진행중 현장</option>
              <option value="COMPLETED">완공/종료 현장</option>
              <option value="ALL">전체 현장</option>
            </select>
          </div>
`;

c = c.replace(
  "{/* 현장 검색창 */}",
  filterUI + "\n          {/* 현장 검색창 */}"
);

fs.writeFileSync('src/pages/SiteOptionManage.tsx', c);
console.log('Added site status filter to SiteOptionManage');
