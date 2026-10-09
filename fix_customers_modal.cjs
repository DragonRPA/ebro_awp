const fs = require('fs');
let c = fs.readFileSync('src/pages/Customers.tsx', 'utf8');

c = c.replace(
  'standardOptions, saveStandardOption, deleteStandardOption, setActiveTab',
  'standardOptions, saveStandardOption, deleteStandardOption, setActiveTab, showErrorModal'
);

fs.writeFileSync('src/pages/Customers.tsx', c);
console.log('Fixed Customers.tsx error modal');
