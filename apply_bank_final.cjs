const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/BankMatching.tsx';
let content = fs.readFileSync(path, 'utf8');

// Imports
const importRegex = /(import React,\s*\{[^}]*\}\s*from\s*'react';)/;
if (content.match(importRegex)) {
  content = content.replace(importRegex, `$1\nimport { useSortableData } from '../hooks/useSortableData';\nimport { SortableTh } from '../components/SortableTh';`);
}

const hookRegex = /(const txStartDate = filters\?.txStartDate;)/;
if (content.match(hookRegex)) {
  content = content.replace(hookRegex, `const { items: sortedTransactions, requestSort: requestTxSort, sortConfig: txSortConfig } = useSortableData(filteredTransactions, { key: 'transactionDate', direction: 'desc' });\n\n  $1`);
}

// Replace table map
content = content.replace(/\) : \(\s*filteredTransactions\.map\(\(tx\) => \{/, ') : (\n                  sortedTransactions.map((tx) => {');

const lines = content.split(/\r?\n/);
const startIdx = lines.findIndex(l => l.includes("zIndex: 2, backgroundColor: 'var(--bg-main)' }}>"));
if (startIdx !== -1) {
  lines.splice(startIdx + 1, 9, 
    `                  <SortableTh label="분류" sortKey="transactionType" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />`,
    `                  <SortableTh label="거래일시" sortKey="transactionDate" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />`,
    `                  <SortableTh label="은행" sortKey="bankName" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />`,
    `                  <SortableTh label="적요내용 (계좌번호/거래처)" sortKey="description" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />`,
    `                  <SortableTh label="입금액 [＋]" sortKey="deposit" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} align="right" />`,
    `                  <SortableTh label="출금액 [－]" sortKey="withdrawal" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} align="right" />`,
    `                  <SortableTh label="거래 후 잔액" sortKey="balanceAfter" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} align="right" />`,
    `                  <SortableTh label="매칭/정산처" sortKey="linkedCustomerName" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />`,
    `                  <SortableTh label="매칭 상태 (청구/매입)" sortKey="matchStatus" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />`
  );
  content = lines.join('\n');
}

fs.writeFileSync(path, content, 'utf8');
console.log('BankMatching fixed');
