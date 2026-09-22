const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/context/AppContext.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /totalAmount:\s*origBilling\.totalAmount\s*-\s*splitAmount,\s*updatedAt:\s*now\s*\}\);\s*await\s*db\.awaitPendingWrites\(\);\s*refreshAllData\(\);\s*\};/m;

if (content.match(regex)) {
  content = content.replace(regex, "totalAmount: origBilling.totalAmount - splitAmount,\n      updatedAt: now\n    });\n    \n    await db.awaitPendingWrites();\n    refreshAllData();\n    return childBillingId;\n  };");
  fs.writeFileSync(path, content, 'utf8');
  console.log('Fixed with regex');
} else {
  console.log('Not found');
}
