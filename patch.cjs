const fs = require('fs');
let m = fs.readFileSync('src/pages/ManualsManage.tsx', 'utf8');
m = m.replace(/import \{ db \} from '\.\.\/services\/db';/g, "import { db, supabase } from '../services/db';");
m = m.replace(/db\.supabase/g, 'supabase');
fs.writeFileSync('src/pages/ManualsManage.tsx', m);

let a = fs.readFileSync('src/App.tsx', 'utf8');
a = a.replace(/import \{ db \} from '\.\/services\/db';/g, "import { db, supabase } from './services/db';");
a = a.replace(/db\.supabase/g, 'supabase');
a = a.replace(/h\.style\.fontSize/g, '(h as HTMLElement).style.fontSize');
fs.writeFileSync('src/App.tsx', a);
console.log('Done');
