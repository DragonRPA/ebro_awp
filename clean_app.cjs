const fs = require('fs');
let a = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Remove the useGridWheel import line (handles both LF and CRLF)
a = a.replace(/import { useGridWheel } from '\.\/hooks\/useGridWheel';\r?\n/g, '');

// 2. Remove the duplicate useApp call + useGridWheel call at the top of App component
a = a.replace(/  const { activeTab: currentTabForWheel } = useApp\(\);\r?\n  useGridWheel\(currentTabForWheel\);\r?\n/g, '');

fs.writeFileSync('src/App.tsx', a);

// Verify
const content = fs.readFileSync('src/App.tsx', 'utf8');
const hasGridWheel = content.includes('useGridWheel');
const hasDuplicateUseApp = (content.match(/const { activeTab: currentTabForWheel }/g) || []).length;
console.log('useGridWheel remaining:', hasGridWheel);
console.log('duplicate useApp remaining:', hasDuplicateUseApp);
console.log('Lines 200-210:');
content.split('\n').slice(199, 210).forEach((l, i) => console.log(i + 200, l));
