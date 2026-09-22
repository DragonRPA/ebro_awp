const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Deliveries.tsx';
let content = fs.readFileSync(path, 'utf8');

// Imports
const importRegex = /(import React,\s*\{[^}]*\}\s*from\s*'react';)/;
if (content.match(importRegex)) {
  content = content.replace(importRegex, `$1\nimport { useSortableData } from '../hooks/useSortableData';\nimport { SortableTh } from '../components/SortableTh';`);
}

// Map the items first since it has complex data
const filteredDeliveriesRegex = /(const \[filteredDeliveries, setFilteredDeliveries\] = useState<Delivery\[\]>\(\[\]\);)/;
if (content.match(filteredDeliveriesRegex)) {
  // We don't have to map it, we can just use the custom getter
}

const hookRegex = /(const handleExportExcel = \(\) => \{)/;
if (content.match(hookRegex)) {
  const replacement = `const { items: sortedDeliveries, requestSort: requestDelSort, sortConfig: delSortConfig } = useSortableData(filteredDeliveries, null, (a, key) => {
    switch(key) {
      case 'seq': return a.seq || 0;
      case 'category': return a.dispatchCategory || '';
      case 'contractNo': return a.contractId || '';
      case 'customer': return getCustNameFromContract(a.contractId) || '';
      case 'vehicle': return a.vehicles ? a.vehicles.length : 0;
      case 'driver': return a.vehicles && a.vehicles.length > 0 ? a.vehicles[0].driverName : '';
      case 'costEst': return a.vehicles ? a.vehicles.reduce((sum, v) => sum + (v.deliveryCost || 0), 0) : 0;
      case 'costConf': return a.vehicles ? a.vehicles.reduce((sum, v) => sum + (v.deliveryCostConfirmed || v.deliveryCost || 0), 0) : 0;
      case 'status': return a.status || '';
      case 'settled': return a.isSettled ? 1 : 0;
      default: return (a as any)[key] || '';
    }
  });\n\n  $1`;
  content = content.replace(hookRegex, replacement);
}

// Replace the array mapping
content = content.replace(/\[\.\.\.filteredDeliveries\]\.reverse\(\)\.map/g, '[...sortedDeliveries].reverse().map');
content = content.replace(/filteredDeliveries\.map/g, 'sortedDeliveries.map');

// Replace table header block
const theadRegex = /<th style=\{\{ whiteSpace: 'nowrap' \}\}>관리<\/th>\s*<th[^>]*>번호<\/th>\s*<th[^>]*>구분<\/th>\s*<th[^>]*>계약번호 \/ 의뢰메모<\/th>\s*<th[^>]*>고객사명 \/ 회수지<\/th>\s*<th[^>]*>배송 차량<\/th>\s*<th[^>]*>담당기사\/연락처<\/th>\s*<th[^>]*>운송비\(임시\)<\/th>\s*<th[^>]*>운송비\(확정\)<\/th>\s*<th[^>]*>배송상태<\/th>\s*<th[^>]*>용역 정산<\/th>/;

const lines = content.split('\\n');
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
    `              <SortableTh label="운송비(임시)" sortKey="costEst" currentSort={delSortConfig} onSort={requestDelSort} style={{ whiteSpace: 'nowrap' }} />`,
    `              <SortableTh label="운송비(확정)" sortKey="costConf" currentSort={delSortConfig} onSort={requestDelSort} style={{ whiteSpace: 'nowrap' }} />`,
    `              <SortableTh label="배송상태" sortKey="status" currentSort={delSortConfig} onSort={requestDelSort} style={{ whiteSpace: 'nowrap' }} />`,
    `              <SortableTh label="용역 정산" sortKey="settled" currentSort={delSortConfig} onSort={requestDelSort} style={{ whiteSpace: 'nowrap' }} />`
  );
  content = lines.join('\\n');
  console.log('Deliveries thead replaced');
} else {
  console.log('Target not found for deliveries thead');
}

fs.writeFileSync(path, content, 'utf8');
