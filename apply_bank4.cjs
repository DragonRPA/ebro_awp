const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/BankMatching.tsx';
let content = fs.readFileSync(path, 'utf8');

const lines = content.split(/\r?\n/);
const startIdx = lines.findIndex(l => l.includes("관리/액션</th>") || l.includes("/ </th>"));
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
  console.log('BankMatching.tsx header replaced by lines');
} else {
  console.log('Target not found');
}
fs.writeFileSync(path, content, 'utf8');
