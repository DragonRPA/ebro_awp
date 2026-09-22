const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

const theadRegex = /(<th style=\{\{ whiteSpace: 'nowrap', width: '190px' \}\}>관리<\/th>\s*\n\s*)<th style=\{\{ whiteSpace: 'nowrap' \}\}>청구월<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap' \}\}>고객사<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap', textAlign: 'right', paddingRight: '12px' \}\}>공급가액<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap', textAlign: 'right', paddingRight: '12px' \}\}>청구합계\(VAT포함\)<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap', textAlign: 'right', paddingRight: '12px' \}\}>미납액<\/th>\s*\n\s*<th style=\{\{ whiteSpace: 'nowrap' \}\}>상태<\/th>/;

if (content.match(theadRegex)) {
  const replacement = `$1<SortableTh label="청구월" sortKey="billingYm" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap' }} />
                    <SortableTh label="고객사" sortKey="customerName" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap' }} />
                    <SortableTh label="공급가액" sortKey="totalAmount" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap', paddingRight: '12px' }} align="right" />
                    <SortableTh label="청구합계(VAT포함)" sortKey="grandTotal" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap', paddingRight: '12px' }} align="right" />
                    <SortableTh label="미납액" sortKey="unpaidAmount" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap', paddingRight: '12px' }} align="right" />
                    <SortableTh label="상태" sortKey="status" currentSort={sortConfig} onSort={requestSort} style={{ whiteSpace: 'nowrap' }} />`;
  
  content = content.replace(theadRegex, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Replaced thead with SortableTh in Billings.tsx');
} else {
  console.log('thead regex not matched');
}
