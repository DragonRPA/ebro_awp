const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Contracts.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add imports
const importRegex = /(import React,\s*\{[^}]*\}\s*from\s*'react';)/;
if (content.match(importRegex)) {
  content = content.replace(importRegex, `$1\nimport { useSortableData } from '../hooks/useSortableData';\nimport { SortableTh } from '../components/SortableTh';`);
}

// Replace sortConfig, handleSort, sortedContracts
const sortBlockRegex = /(const \[sortConfig, setSortConfig\] = useState<\{ key: string, direction: 'asc' \| 'desc' \} \| null>\(null\);[\s\S]*?return sortable;\n  \}, \[filteredContracts, sortConfig, contractAssets, users\]\);)/;

if (content.match(sortBlockRegex)) {
  const replacement = `const { items: sortedContracts, requestSort: handleSort, sortConfig } = useSortableData(filteredContracts, null, (a, key) => {
    switch (key) {
      case 'contractNo': return a.contractNo || '';
      case 'customer': return getCustName(a.customerId) || '';
      case 'site': return getSiteName(a.siteId) || '';
      case 'rentalFee':
        return contractAssets.filter(ca => ca.contractId === a.id).reduce((sum, ca) => sum + (ca.monthlyRentalFee || 0), 0);
      case 'period': return a.startDate || '';
      case 'billingPeriod': return a.lastBilledPeriodEnd || '';
      case 'billingCount': return a.billingCount || 0;
      case 'dday': return a.endDate || '';
      case 'billingDay': return a.billingDay || 0;
      case 'salesperson': return users.find(u => u.id === a.salespersonId)?.name || '';
      case 'status': return a.status || '';
      case 'assets': return contractAssets.filter(ca => ca.contractId === a.id).length;
      default: return (a as any)[key] || '';
    }
  });`;
  
  content = content.replace(sortBlockRegex, replacement);
}

// Replace table headers
const theadRegex = /(<th style=\{\{ textAlign: 'center', whiteSpace: 'nowrap', width: '80px' \}\}>관리<\/th>\s*\n\s*)<th style=\{\{ whiteSpace: 'nowrap', cursor: 'pointer' \}\} onClick=\{\(\) => handleSort\('contractNo'\)\}>계약번호[^<]*<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap', cursor: 'pointer' \}\} onClick=\{\(\) => handleSort\('customer'\)\}>고객사[^<]*<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap', cursor: 'pointer' \}\} onClick=\{\(\) => handleSort\('site'\)\}>현장명[^<]*<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap', textAlign: 'center' \}\}>가동 현황<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap', cursor: 'pointer' \}\} onClick=\{\(\) => handleSort\('rentalFee'\)\}>월 임대료[^<]*<\/th>\s*\n\s*\{showPeriodCol && <th style=\{\{ whiteSpace: 'nowrap', cursor: 'pointer' \}\} onClick=\{\(\) => handleSort\('period'\)\}>계약 기간[^<]*<\/th>\}\s*\n\s*\{showLastBilledCol && <th style=\{\{ whiteSpace: 'nowrap', cursor: 'pointer' \}\} onClick=\{\(\) => handleSort\('billingPeriod'\)\}>최근 청구 기간[^<]*<\/th>\}\s*\n\s*\{showBillingCountCol && <th style=\{\{ whiteSpace: 'nowrap', cursor: 'pointer' \}\} onClick=\{\(\) => handleSort\('billingCount'\)\}>청구 횟수[^<]*<\/th>\}\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap', cursor: 'pointer' \}\} onClick=\{\(\) => handleSort\('dday'\)\}>만료 D-Day[^<]*<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap', cursor: 'pointer' \}\} onClick=\{\(\) => handleSort\('billingDay'\)\}>청구 마감일[^<]*<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap', cursor: 'pointer' \}\} onClick=\{\(\) => handleSort\('salesperson'\)\}>영업담당[^<]*<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap', cursor: 'pointer' \}\} onClick=\{\(\) => handleSort\('status'\)\}>상태[^<]*<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap', cursor: 'pointer' \}\} onClick=\{\(\) => handleSort\('assets'\)\}>체결 자산[^<]*<\/th>/;

if (content.match(theadRegex)) {
  const replacement = `$1<SortableTh label="계약번호" sortKey="contractNo" currentSort={sortConfig} onSort={handleSort} style={{ whiteSpace: 'nowrap' }} />
                    <SortableTh label="고객사" sortKey="customer" currentSort={sortConfig} onSort={handleSort} style={{ whiteSpace: 'nowrap' }} />
                    <SortableTh label="현장명" sortKey="site" currentSort={sortConfig} onSort={handleSort} style={{ whiteSpace: 'nowrap' }} />
                    <th style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>가동 현황</th>
                    <SortableTh label="월 임대료" sortKey="rentalFee" currentSort={sortConfig} onSort={handleSort} style={{ whiteSpace: 'nowrap' }} align="right" />
                    {showPeriodCol && <SortableTh label="계약 기간" sortKey="period" currentSort={sortConfig} onSort={handleSort} style={{ whiteSpace: 'nowrap' }} />}
                    {showLastBilledCol && <SortableTh label="최근 청구 기간" sortKey="billingPeriod" currentSort={sortConfig} onSort={handleSort} style={{ whiteSpace: 'nowrap' }} />}
                    {showBillingCountCol && <SortableTh label="청구 횟수" sortKey="billingCount" currentSort={sortConfig} onSort={handleSort} style={{ whiteSpace: 'nowrap' }} />}
                    <SortableTh label="만료 D-Day" sortKey="dday" currentSort={sortConfig} onSort={handleSort} style={{ whiteSpace: 'nowrap' }} />
                    <SortableTh label="청구 마감일" sortKey="billingDay" currentSort={sortConfig} onSort={handleSort} style={{ whiteSpace: 'nowrap' }} />
                    <SortableTh label="영업담당" sortKey="salesperson" currentSort={sortConfig} onSort={handleSort} style={{ whiteSpace: 'nowrap' }} />
                    <SortableTh label="상태" sortKey="status" currentSort={sortConfig} onSort={handleSort} style={{ whiteSpace: 'nowrap' }} />
                    <SortableTh label="체결 자산" sortKey="assets" currentSort={sortConfig} onSort={handleSort} style={{ whiteSpace: 'nowrap' }} />`;
  content = content.replace(theadRegex, replacement);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Contracts.tsx sorting updated');
