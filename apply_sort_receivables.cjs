const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Receivables.tsx';
let content = fs.readFileSync(path, 'utf8');

// Imports
const importRegex = /(import React,\s*\{[^}]*\}\s*from\s*'react';)/;
if (content.match(importRegex)) {
  content = content.replace(importRegex, `$1\nimport { useSortableData } from '../hooks/useSortableData';\nimport { SortableTh } from '../components/SortableTh';`);
}

const hookRegex = /(const handleShowDetails = \(r: Receivables\) => \{)/;
if (content.match(hookRegex)) {
  const replacement = `const { items: sorted, requestSort, sortConfig } = useSortableData(filtered, null, (a, key) => {
    switch(key) {
      case 'date': return a.occurrenceDate || '';
      case 'customer': return getCustName(a.customerId) || '';
      case 'contract': return a.contractId || a.description || '';
      case 'type': return a.type || '';
      case 'billing': return a.billingYm || '';
      case 'description': return a.description || '';
      case 'amount': return a.amount || 0;
      case 'settled': return a.settledAmount || 0;
      case 'balance': return a.balance || 0;
      case 'status': return a.status || '';
      default: return (a as any)[key] || '';
    }
  });\n\n  $1`;
  content = content.replace(hookRegex, replacement);
}

// Replace the array mapping
content = content.replace(/filtered\.map\(/g, 'sorted.map(');

const lines = content.split(/\r?\n/);
const startIdx = lines.findIndex(l => l.includes("textAlign: 'center', width: '80px'") && l.includes("whiteSpace: 'nowrap'"));
if (startIdx !== -1) {
  lines.splice(startIdx, 11, 
    `                <th style={{ whiteSpace: 'nowrap', textAlign: 'center', width: '80px' }}>조치</th>`,
    `                <SortableTh label="발생일" sortKey="date" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap', textAlign: 'center', width: '90px' }} />`,
    `                <SortableTh label="고객사" sortKey="customer" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap' }} />`,
    `                <SortableTh label="계약번호 / 내용" sortKey="contract" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap' }} />`,
    `                <SortableTh label="구분" sortKey="type" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap', textAlign: 'center' }} />`,
    `                <SortableTh label="청구 월 (대상 월)" sortKey="billing" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap' }} />`,
    `                <SortableTh label="적요 표시" sortKey="description" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap' }} />`,
    `                <SortableTh label="발생(채권) 총액" sortKey="amount" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap' }} align="right" />`,
    `                <SortableTh label="정산액" sortKey="settled" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap' }} align="right" />`,
    `                <SortableTh label="미정산 잔액" sortKey="balance" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap' }} align="right" />`,
    `                <SortableTh label="상태" sortKey="status" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap', textAlign: 'center' }} />`
  );
  content = lines.join('\n');
  console.log('Receivables thead replaced');
} else {
  console.log('Target not found for Receivables thead');
}

fs.writeFileSync(path, content, 'utf8');
