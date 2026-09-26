const fs = require('fs');

let m = fs.readFileSync('src/pages/ManualsManage.tsx', 'utf8');
m = m.replace(/await supabase/g, 'await supabase!');
fs.writeFileSync('src/pages/ManualsManage.tsx', m);

let a = fs.readFileSync('src/App.tsx', 'utf8');
a = a.replace(/await supabase/g, 'await supabase!');
fs.writeFileSync('src/App.tsx', a);

console.log('Done');
