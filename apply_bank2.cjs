const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/BankMatching.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /<th style=\{\{ padding: '8px 10px', whiteSpace: 'nowrap', width: '150px'[^<]+<\/th>\s*<th[^<]+<\/th>\s*<th[^<]+<\/th>\s*<th[^<]+<\/th>\s*<th[^<]+<\/th>\s*<th[^<]+<\/th>\s*<th[^<]+<\/th>\s*<th[^<]+<\/th>\s*<th[^<]+<\/th>\s*<th[^<]+<\/th>/;

if (content.match(regex)) {
  const replacement = `<th style={{ padding: '8px 10px', whiteSpace: 'nowrap', width: '150px', position: 'sticky', left: 0, zIndex: 2, backgroundColor: 'var(--bg-main)' }}>관리/액션</th>
                  <SortableTh label="분류" sortKey="transactionType" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />
                  <SortableTh label="거래일시" sortKey="transactionDate" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />
                  <SortableTh label="은행" sortKey="bankName" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />
                  <SortableTh label="적요내용 (계좌번호/거래처)" sortKey="description" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />
                  <SortableTh label="입금액 [＋]" sortKey="deposit" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} align="right" />
                  <SortableTh label="출금액 [－]" sortKey="withdrawal" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} align="right" />
                  <SortableTh label="거래 후 잔액" sortKey="balanceAfter" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} align="right" />
                  <SortableTh label="매칭/정산처" sortKey="linkedCustomerName" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />
                  <SortableTh label="매칭 상태 (청구/매입)" sortKey="matchStatus" currentSort={txSortConfig} onSort={requestTxSort} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} />`;
  content = content.replace(regex, replacement);
  console.log('BankMatching.tsx header replaced');
} else {
  console.log('Regex failed');
}
fs.writeFileSync(path, content, 'utf8');
