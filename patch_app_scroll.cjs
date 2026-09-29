const fs = require('fs');

let a = fs.readFileSync('src/App.tsx', 'utf8');

if (!a.includes('useGlobalGridScroll')) {
  a = a.replace("import { db, supabase } from './services/db';", "import { db, supabase } from './services/db';\nimport { useGlobalGridScroll } from './hooks/useGlobalGridScroll';");
  
  // Inject the hook call inside App component
  a = a.replace("const App: React.FC = () => {", "const App: React.FC = () => {\n  useGlobalGridScroll();");
  
  fs.writeFileSync('src/App.tsx', a);
  console.log('App.tsx patched successfully.');
} else {
  console.log('useGlobalGridScroll already in App.tsx');
}
