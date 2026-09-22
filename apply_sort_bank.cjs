const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/BankMatching.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add imports
const importRegex = /(import React,\s*\{[^}]*\}\s*from\s*'react';)/;
if (content.match(importRegex)) {
  content = content.replace(importRegex, `$1\nimport { useSortableData } from '../hooks/useSortableData';\nimport { SortableTh } from '../components/SortableTh';`);
}

// Add hook
const hookRegex = /(const handleExport = \(\) => \{)/;
if (content.match(hookRegex)) {
  content = content.replace(hookRegex, `const { items: sortedTransactions, requestSort: requestTxSort, sortConfig: txSortConfig } = useSortableData(filteredTransactions, { key: 'transactionDate', direction: 'desc' });\n\n  $1`);
}

// Replace table map
content = content.replace(/\) : \(\s*filteredTransactions\.map\(\(tx\) => \{/, ') : (\n                  sortedTransactions.map((tx) => {');

// Replace table headers
const theadRegex = /(<th style=\{\{ padding: '8px 10px', whiteSpace: 'nowrap', width: '150px', position: 'sticky', left: 0, zIndex: 2, backgroundColor: 'var\(--bg-main\)' \}\}>관리\/액션<\/th>\s*\n\s*)<th style=\{\{ padding: '8px 10px', whiteSpace: 'nowrap' \}\}>분류<\/th>\s*\n\s*<th style=\{\{ padding: '8px 10px', whiteSpace: 'nowrap' \}\}>거래일시<\/th>\s*\n\s*<th style=\{\{ padding: '8px 10px', whiteSpace: 'nowrap' \}\}>은행<\/th>\s*\n\s*<th style=\{\{ padding: '8px 10px', whiteSpace: 'nowrap' \}\}>적요내용 \(계좌번호\/거래처\)<\/th>\s*\n\s*<th style=\{\{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'right' \}\}>입금액 \[＋\]<\/th>\s*\n\s*<th style=\{\{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'right' \}\}>출금액 \[－\]<\/th>\s*\n\s*<th style=\{\{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'right' \}\}>거래 후 잔액<\/th>\s*\n\s*<th style=\{\{ padding: '8px 10px', whiteSpace: 'nowrap' \}\}>매칭\/정산처<\/th>\s*\n\s*<th style=\{\{ padding: '8px 10px', whiteSpace: 'nowrap' \}\}>매칭 상태 \(청구\/매입\)<\/th>/;

if (content.match(theadRegex)) {
  const replacement = `$1<SortableTh label="분류" sortKey="transactionType" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />
                  <SortableTh label="거래일시" sortKey="transactionDate" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />
                  <SortableTh label="은행" sortKey="bankName" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />
                  <SortableTh label="적요내용 (계좌번호/거래처)" sortKey="description" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />
                  <SortableTh label="입금액 [＋]" sortKey="deposit" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} align="right" />
                  <SortableTh label="출금액 [－]" sortKey="withdrawal" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} align="right" />
                  <SortableTh label="거래 후 잔액" sortKey="balanceAfter" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} align="right" />
                  <SortableTh label="매칭/정산처" sortKey="linkedCustomerName" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />
                  <SortableTh label="매칭 상태 (청구/매입)" sortKey="matchStatus" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />`;
  content = content.replace(theadRegex, replacement);
  console.log('BankMatching.tsx sorting updated');
} else {
  console.log('thead regex not matched in BankMatching');
}

fs.writeFileSync(path, content, 'utf8');
