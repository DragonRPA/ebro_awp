
const fs = require('fs');
const content = fs.readFileSync('src/data/modalManuals.ts', 'utf8');
const lines = content.split('\n');
for(let i=50; i<=70; i++) console.log((i+1) + ': ' + lines[i]);

