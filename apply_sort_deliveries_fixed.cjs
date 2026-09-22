const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Deliveries.tsx';
let content = fs.readFileSync(path, 'utf8');

// Imports
const importRegex = /(import React,\s*\{[^}]*\}\s*from\s*'react';)/;
if (content.match(importRegex)) {
  content = content.replace(importRegex, `$1\nimport { useSortableData } from '../hooks/useSortableData';\nimport { SortableTh } from '../components/SortableTh';`);
}

const hookRegex = /(const handleExportExcel = \(\) => \{)/;
if (content.match(hookRegex)) {
  const replacement = `const { items: sortedDeliveries, requestSort: requestDelSort, sortConfig: delSortConfig } = useSortableData(filteredDeliveries, null, (a, key) => {
    switch(key) {
      case 'seq': return (a as any).seq || 0;
      case 'category': return a.dispatchCategory || '';
      case 'contractNo': return a.contractId || '';
      case 'customer': return getCustNameFromContract(a.contractId) || '';
      case 'vehicle': return (a as any).vehicles ? (a as any).vehicles.length : 0;
      case 'driver': return (a as any).vehicles && (a as any).vehicles.length > 0 ? (a as any).vehicles[0].driverName : '';
      case 'costEst': return (a as any).vehicles ? (a as any).vehicles.reduce((sum: number, v: any) => sum + (v.deliveryCost || 0), 0) : 0;
      case 'costConf': return (a as any).vehicles ? (a as any).vehicles.reduce((sum: number, v: any) => sum + (v.deliveryCostConfirmed || v.deliveryCost || 0), 0) : 0;
      case 'status': return a.status || '';
      case 'settled': return (a as any).isSettled ? 1 : 0;
      default: return (a as any)[key] || '';
    }
  });\n\n  $1`;
  content = content.replace(hookRegex, replacement);
}

// Replace the array mapping
content = content.replace(/\[\.\.\.filteredDeliveries\]\.reverse\(\)\.map/g, '[...sortedDeliveries].reverse().map');

const lines = content.split(/\r?\n/);
const startIdx = lines.findIndex(l => l.includes(">관리</th>") && l.includes("whiteSpace: 'nowrap'"));
if (startIdx !== -1) {
  lines.splice(startIdx, 11, 
    `              <th style={{ whiteSpace: 'nowrap' }}>관리</th>`,
    `              <SortableTh label="번호" sortKey="seq" currentSort={delSortConfig} onSort={requestDelSort} style={{ whiteSpace: 'nowrap' }} />`,
    `              <SortableTh label="구분" sortKey="category" currentSort={delSortConfig} onSort={requestDelSort} style={{ whiteSpace: 'nowrap' }} />`,
    `              <SortableTh label="계약번호 / 의뢰메모" sortKey="contractNo" currentSort={delSortConfig} onSort={requestDelSort} style={{ whiteSpace: 'nowrap' }} />`,
    `              <SortableTh label="고객사명 / 회수지" sortKey="customer" currentSort={delSortConfig} onSort={requestDelSort} style={{ whiteSpace: 'nowrap' }} />`,
    `              <SortableTh label="배송 차량" sortKey="vehicle" currentSort={delSortConfig} onSort={requestDelSort} style={{ whiteSpace: 'nowrap' }} />`,
    `              <SortableTh label="담당기사/연락처" sortKey="driver" currentSort={delSortConfig} onSort={requestDelSort} style={{ whiteSpace: 'nowrap' }} />`,
    `              <SortableTh label="운송비(임시)" sortKey="costEst" currentSort={delSortConfig} onSort={requestDelSort} style={{ whiteSpace: 'nowrap' }} align="right" />`,
    `              <SortableTh label="운송비(확정)" sortKey="costConf" currentSort={delSortConfig} onSort={requestDelSort} style={{ whiteSpace: 'nowrap' }} align="right" />`,
    `              <SortableTh label="배송상태" sortKey="status" currentSort={delSortConfig} onSort={requestDelSort} style={{ whiteSpace: 'nowrap' }} />`,
    `              <SortableTh label="용역 정산" sortKey="settled" currentSort={delSortConfig} onSort={requestDelSort} style={{ whiteSpace: 'nowrap' }} />`
  );
  content = lines.join('\n');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Deliveries fixed.');
