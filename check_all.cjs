
const fs = require('fs');
const content = fs.readFileSync('src/data/allMenuManuals.ts', 'utf8');
const lines = content.split('\n');
for(let i=700; i<=725; i++) console.log((i+1) + ': ' + lines[i]);

