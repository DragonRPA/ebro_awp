const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Imports
const importRegex = /(import React,\s*\{[^}]*\}\s*from\s*'react';)/;
if (content.match(importRegex)) {
  content = content.replace(importRegex, `$1\nimport { useSortableData } from '../hooks/useSortableData';\nimport { SortableTh } from '../components/SortableTh';`);
}

// 2. enrichedBillings and hook
const hookRegex = /(const handleExportExcel = \(\) => \{)/;
if (content.match(hookRegex)) {
  const hookReplacement = `const enrichedBillings = useMemo(() => {
    return filteredBillings.map(b => {
      const supply = b.totalAmount || 0;
      const vat = Math.round(supply * 0.1);
      const grandTotal = supply + vat;
      const unpaidAmount = b.status === 'PAID' ? 0 : grandTotal - (b.paidAmount || 0);
      const customer = customers.find(c => c.id === b.customerId);
      return {
        ...b,
        customerName: customer ? customer.name : '알 수 없음',
        grandTotal,
        unpaidAmount
      };
    });
  }, [filteredBillings, customers]);

  const { items: sortedBillings, requestSort, sortConfig } = useSortableData(enrichedBillings, { key: 'billingYm', direction: 'desc' });\n\n  $1`;
  content = content.replace(hookRegex, hookReplacement);
}

// 3. Map sortedBillings
content = content.replace(/\) : filteredBillings\.map\(b => \{/, ') : sortedBillings.map(b => {');

// 4. Thead replacement
const theadRegex = /(<th style=\{\{ whiteSpace: 'nowrap', width: '190px' \}\}>관리<\/th>\s*\n\s*)<th style=\{\{ whiteSpace: 'nowrap' \}\}>청구월<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap' \}\}>고객사<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap', textAlign: 'right', paddingRight: '12px' \}\}>공급가액<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap', textAlign: 'right', paddingRight: '12px' \}\}>청구합계\(VAT포함\)<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap', textAlign: 'right', paddingRight: '12px' \}\}>미납액<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap' \}\}>상태<\/th>/;

if (content.match(theadRegex)) {
  const theadReplacement = `$1<SortableTh label="청구월" sortKey="billingYm" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap' }} />
                    <SortableTh label="고객사" sortKey="customerName" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap' }} />
                    <SortableTh label="공급가액" sortKey="totalAmount" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap', paddingRight: '12px' }} align="right" />
                    <SortableTh label="청구합계(VAT포함)" sortKey="grandTotal" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap', paddingRight: '12px' }} align="right" />
                    <SortableTh label="미납액" sortKey="unpaidAmount" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap', paddingRight: '12px' }} align="right" />
                    <SortableTh label="상태" sortKey="status" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap' }} />`;
  content = content.replace(theadRegex, theadReplacement);
} else {
  console.log("Thead regex failed");
}

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated Billings.tsx with Node.js');
