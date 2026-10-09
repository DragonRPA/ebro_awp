const fs = require('fs');
let c = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');

// 1. Remove the empty customer filter select box block
const customerFilterBlock = `          {/* 고객사 선택 */}
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
          </div>`;

c = c.replace(customerFilterBlock, '');

// 2. Add ascending sort by site name to filteredSites
const filteredSitesBlock = `      return true;
    });
  }, [sites, searchSiteKeyword]);`;

const sortedFilteredSitesBlock = `      return true;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [sites, searchSiteKeyword]);`;

c = c.replace(filteredSitesBlock, sortedFilteredSitesBlock);

fs.writeFileSync('src/pages/SiteOptionManage.tsx', c);
console.log('Fixed customer filter and site sort in SiteOptionManage.tsx');
