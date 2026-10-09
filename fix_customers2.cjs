const fs = require('fs');
let c = fs.readFileSync('src/pages/Customers.tsx', 'utf8');

c = c.replace(
  /const optSummary = \[s\.paidOptions, s\.protection\]\.filter\(Boolean\)\.join\(' \| '\);\s*return \(\s*<option key=\{s\.id\} value=\{s\.id\}>\s*\[\{custName\}\] \{s\.name\} \{optSummary \? `\(\$\{optSummary\}\)` : '\(옵션 미설정\)'\}\s*<\/option>\s*\);/g,
  `const paid = s.paidOptions ? s.paidOptions : '';
                        const prot = (s.protection && s.protection !== 'NONE') ? s.protection : '';
                        const optSummary = [paid, prot].filter(Boolean).join(' | ');
                        return (
                          <option key={s.id} value={s.id}>
                            {s.name} {optSummary ? \`(\${optSummary})\` : ''}
                          </option>
                        );`
);

fs.writeFileSync('src/pages/Customers.tsx', c);
console.log('Fixed Customers.tsx');
