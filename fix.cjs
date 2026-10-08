const fs = require('fs');
let content = fs.readFileSync('D:/01.AntiGravity/eBro/src/utils/hindsightTracker.ts', 'utf8');
content = content.split(\"if (url && !url.includes('shared_memories') && !url.includes('/api/hindsight'))\").join(\"if (url && url.includes('/rest/v1/') && !url.includes('shared_memories'))\");
fs.writeFileSync('D:/01.AntiGravity/eBro/src/utils/hindsightTracker.ts', content, 'utf8');
