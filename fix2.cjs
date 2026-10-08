const fs = require('fs');
let content = fs.readFileSync('D:/01.AntiGravity/eBro/src/utils/hindsightTracker.ts', 'utf8');
content = content.replace("if (url && !url.includes('shared_memories') && !url.includes('/api/hindsight'))", "if (url && url.includes('/rest/v1/') && !url.includes('shared_memories'))");
fs.writeFileSync('D:/01.AntiGravity/eBro/src/utils/hindsightTracker.ts', content, 'utf8');
console.log('Fixed');
