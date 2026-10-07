
const fs = require('fs');
const content = fs.readFileSync('src/data/allMenuManuals.ts', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes('site-option-ref-search-box'));
for(let i=idx-2; i<=idx+3; i++) console.log((i+1) + ': ' + lines[i]);

