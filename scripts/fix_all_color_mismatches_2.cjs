const fs = require('fs');

function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let count = 0;
  replacements.forEach(({ from, to }) => {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      count++;
    }
  });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[OK] ${filePath}: applied ${count} replacement(s)`);
}

// 1. BankMatching.tsx
replaceInFile('src/pages/BankMatching.tsx', [
  { from: "border: '1px solid #111827'", to: "border: '1px solid var(--border-color)'" },
  { from: "borderBottom: '1px solid #e5e7eb'", to: "borderBottom: '1px solid var(--border-color)'" },
  { from: "borderRight: '1px solid #e5e7eb'", to: "borderRight: '1px solid var(--border-color)'" }
]);

// 2. Contracts.tsx
replaceInFile('src/pages/Contracts.tsx', [
  {
    from: "backgroundColor: '#e5e7eb', color: '#374151'",
    to: "backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)'"
  }
]);

// 3. ApprovalInbox.tsx
replaceInFile('src/pages/ApprovalInbox.tsx', [
  { from: "background: 'var(--bg-card-header, #f8fafc)'", to: "background: 'var(--bg-card-header)'" },
  { from: "borderBottom: '1px solid var(--border-color, #f1f5f9)'", to: "borderBottom: '1px solid var(--border-color)'" },
  { from: "background: 'var(--bg-sub, #f8fafc)'", to: "background: 'var(--bg-secondary)'" },
  { from: "border: '1px solid var(--border-color, #e2e8f0)'", to: "border: '1px solid var(--border-color)'" },
  { from: "background: 'var(--bg-card, #fff)'", to: "background: 'var(--bg-card)'" },
  { from: "background: 'var(--bg-card-header, #f1f5f9)'", to: "background: 'var(--bg-card-header)'" },
  { from: "color: 'var(--text-main, #334155)'", to: "color: 'var(--text-main)'" }
]);

// 4. PrivacyAuditPage.tsx
replaceInFile('src/pages/PrivacyAuditPage.tsx', [
  { from: "'var(--bg-surface, #f8fafc)'", to: "'var(--bg-surface)'" },
  { from: "'var(--bg-secondary, #f8fafc)'", to: "'var(--bg-secondary)'" },
  { from: "'var(--border-color, #e2e8f0)'", to: "'var(--border-color)'" },
  { from: "'var(--border-color, #f1f5f9)'", to: "'var(--border-color)'" }
]);

// 5. users_permissions.tsx
replaceInFile('src/pages/users_permissions.tsx', [
  { from: "'var(--bg-secondary, #f8fafc)'", to: "'var(--bg-secondary)'" },
  { from: "'var(--bg-secondary, #f1f5f9)'", to: "'var(--bg-secondary)'" },
  { from: "'var(--border-color, #e2e8f0)'", to: "'var(--border-color)'" },
  { from: "'var(--border-color, #f1f5f9)'", to: "'var(--border-color)'" },
  { from: "borderBottom: '1px solid #f8fafc'", to: "borderBottom: '1px solid var(--border-color)'" }
]);

console.log('Batch replacements round 2 finished.');
