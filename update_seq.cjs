const fs = require('fs');
let content = fs.readFileSync('src/data/allMenuManuals.ts', 'utf8');

// replace seq: 6 to 5
content = content.replace(/"seq": 6,\s*"selector": "\[data-mid=\\"btn-nts-audit\\"\]/g, '"seq": 5,\n        "selector": "[data-mid=\\"btn-nts-audit\\"]');

// replace seq: 7 to 6
content = content.replace(/"seq": 7,\s*"selector": "\[data-mid=\\"btn-new-customer\\"\]/g, '"seq": 6,\n        "selector": "[data-mid=\\"btn-new-customer\\"]');

fs.writeFileSync('src/data/allMenuManuals.ts', content, 'utf8');
