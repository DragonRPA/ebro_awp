const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /<strong style=\{\{ color: 'var\(--primary\)' \}\}>\s*\{c\.lastBilledPeriodStart\} ~ \{c\.lastBilledPeriodEnd\}\s*<\/strong>/m;
const replaceStr = `<strong style={{ color: 'var(--primary)' }}>
                              {c.lastBilledPeriodStart} ~ {c.lastBilledPeriodEnd} {c.lastBilledYm && \`(\${c.lastBilledYm}월분)\`}
                            </strong>`;

if (content.match(regex)) {
  content = content.replace(regex, replaceStr);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Fixed left panel UI to show lastBilledYm');
} else {
  console.log('Could not find regex for left panel UI');
}
