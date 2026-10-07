
const fs = require('fs');
const content = fs.readFileSync('src/pages/Customers.tsx', 'utf8');
const lines = content.split('\n');
const start = lines.findIndex(l => l.includes('const optionReferenceSites = useMemo(() => {'));
for(let i=start; i<=start+25; i++) console.log((i+1) + ': ' + lines[i]);

