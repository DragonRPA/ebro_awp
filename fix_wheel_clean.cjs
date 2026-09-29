const fs = require('fs');

// 1. Fix App.tsx - remove all previous bad injections
let a = fs.readFileSync('src/App.tsx', 'utf8');

// Remove duplicate useApp call for wheel
a = a.replace("  const { activeTab: currentTabForWheel } = useApp();\n  useGridWheel(currentTabForWheel);\n", "");

// Remove the useGridWheel import
a = a.replace("import { useGridWheel } from './hooks/useGridWheel';\n", "");

// Remove ReactDOM that was mistakenly injected inside App function scope
// It appears before const App and after db import
a = a.replace("import ReactDOM from 'react-dom';\nimport { db, supabase } from './services/db';", "import ReactDOM from 'react-dom';\nimport { db, supabase } from './services/db';");

fs.writeFileSync('src/App.tsx', a);
console.log('App.tsx cleaned.');

// 2. Verify what imports exist now
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n').slice(0, 20);
console.log('Top of App.tsx:');
lines.forEach((l, i) => console.log(i+1, l));
