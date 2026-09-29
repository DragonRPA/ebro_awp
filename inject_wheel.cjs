const fs = require('fs');
let a = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add import for useGridWheel - after the db/supabase import
if (!a.includes('useGridWheel')) {
  a = a.replace(
    "import { db, supabase } from './services/db';",
    "import { db, supabase } from './services/db';\nimport { useGridWheel } from './hooks/useGridWheel';"
  );
}

// 2. Inject hook call AFTER activeTab is already destructured from context
// Current pattern inside App: "const { currentUser, users, ...activeTab..." 
// We insert useGridWheel on the next line after the destructure
if (!a.includes('useGridWheel(activeTab)')) {
  a = a.replace(
    "  const { currentUser, users, switchUser, login, logout, theme, toggleTheme, hasPermission, activeTab, setActiveTab, loadTablesForMenu, currentTenant } = context;",
    "  const { currentUser, users, switchUser, login, logout, theme, toggleTheme, hasPermission, activeTab, setActiveTab, loadTablesForMenu, currentTenant } = context;\n  useGridWheel(activeTab); // Shift+Wheel 횡스크롤: 그리드 컨테이너에만 적용"
  );
}

fs.writeFileSync('src/App.tsx', a);

// Verify
const content = fs.readFileSync('src/App.tsx', 'utf8');
console.log('import check:', content.includes("import { useGridWheel }"));
console.log('hook call check:', content.includes("useGridWheel(activeTab)"));

// Show the relevant lines
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('useGridWheel')) console.log(`Line ${i+1}: ${l}`);
});
