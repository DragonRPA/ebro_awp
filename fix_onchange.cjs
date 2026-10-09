const fs = require('fs');
let c = fs.readFileSync('src/pages/Contracts.tsx', 'utf8');

const selectOnChangeTarget = `onChange={e => {
                    setSuccCustId(e.target.value);
                  }}`;
const selectOnChangeReplace = `onChange={e => {
                    setSuccCustId(e.target.value);
                    setSuccSiteId('');
                    setSuccContactId('');
                  }}`;

// Just search for setSuccCustId(e.target.value) and inject the two clears if not there
if (!c.includes("setSuccSiteId('');") && c.includes("setSuccCustId(e.target.value)")) {
  c = c.replace(/setSuccCustId\(e\.target\.value\);/g, "setSuccCustId(e.target.value); setSuccSiteId(''); setSuccContactId('');");
}

fs.writeFileSync('src/pages/Contracts.tsx', c);
console.log('Fixed onchange!');
