const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add imports
const importRegex = /(import React,\s*\{[^}]*\}\s*from\s*'react';)/;
if (content.match(importRegex)) {
  content = content.replace(importRegex, `$1\nimport { useSortableData } from '../hooks/useSortableData';\nimport { SortableTh } from '../components/SortableTh';`);
}

// Add hook
const hookRegex = /(const handleExportExcel = \(\) => \{)/;
if (content.match(hookRegex)) {
  content = content.replace(hookRegex, `const { items: sortedBillings, requestSort, sortConfig } = useSortableData(filteredBillings, { key: 'billingYm', direction: 'desc' });\n\n  $1`);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Hook added to Billings.tsx');
