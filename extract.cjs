const fs = require('fs');
const code = fs.readFileSync('D:/01.AntiGravity/eBro/src/pages/Contracts.tsx', 'utf8');
const lines = code.split('\n');
for(let i=3220; i<3300; i++) {
    console.log(i + ': ' + lines[i].trim());
}
