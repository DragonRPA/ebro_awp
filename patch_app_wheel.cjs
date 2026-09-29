const fs = require('fs');
let a = fs.readFileSync('src/App.tsx', 'utf8');

if (!a.includes('useGridWheel')) {
  a = a.replace("import { db, supabase } from './services/db';", "import { db, supabase } from './services/db';\nimport { useGridWheel } from './hooks/useGridWheel';");
  
  // activeTab is already in useApp() inside App.tsx
  a = a.replace("const App: React.FC = () => {", "const App: React.FC = () => {\n  const { activeTab: currentTabForWheel } = useApp();\n  useGridWheel(currentTabForWheel);");
  
  fs.writeFileSync('src/App.tsx', a);
  console.log('App.tsx patched successfully.');
} else {
  console.log('Already patched.');
}
