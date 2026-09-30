const fs = require('fs');
let content = fs.readFileSync('D:/01.AntiGravity/Giyuen_Lift/src/pages/users_permissions.tsx', 'utf8');

// Top-level container
content = content.replace(
  /<div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: '16px' }}>/,
  `<div data-subview="permission" data-subview-title="권한 관리" style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: '16px' }}>`
);

// Tags
content = content.replace(
  /onClick={\(\) => setActiveTab\('ROLES'\)}/,
  `data-mid="permission-role-tab"\n            onClick={() => setActiveTab('ROLES')}`
);
content = content.replace(
  /onClick={\(\) => setActiveTab\('USERS'\)}/,
  `data-mid="permission-user-tab"\n            onClick={() => setActiveTab('USERS')}`
);
content = content.replace(
  /<form onSubmit={handleCreateRole} style={{/,
  `<form data-mid="permission-create-role" onSubmit={handleCreateRole} style={{`
);
content = content.replace(
  /<span>등록된 권한 명칭 \(\{customRoles\.length\}\)<\/span>/,
  `<span data-mid="permission-role-list">등록된 권한 명칭 ({customRoles.length})</span>`
);
content = content.replace(
  /onClick={handleSaveRolePermissions}/,
  `data-mid="permission-bulk-save"\n                    onClick={handleSaveRolePermissions}`
);
content = content.replace(
  /<div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>/,
  `<div data-mid="permission-filter-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>`
);
content = content.replace(
  /onClick={handleExportExcel}/,
  `data-mid="permission-export-excel"\n                onClick={handleExportExcel}`
);
content = content.replace(
  /<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>/,
  `<table data-mid="permission-user-grid" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>`
);

fs.writeFileSync('D:/01.AntiGravity/Giyuen_Lift/src/pages/users_permissions.tsx', content);
console.log('done');
