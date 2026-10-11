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

// 1. Contracts.tsx
replaceInFile('src/pages/Contracts.tsx', [
  {
    from: ".hover-row:hover {\n          background-color: #f1f5f9 !important;\n        }",
    to: ".hover-row:hover {\n          background-color: var(--bg-secondary) !important;\n        }"
  },
  {
    from: ".hover-row:hover {\r\n          background-color: #f1f5f9 !important;\r\n        }",
    to: ".hover-row:hover {\r\n          background-color: var(--bg-secondary) !important;\r\n        }"
  }
]);

// 2. TenantManagementPage.tsx
replaceInFile('src/pages/TenantManagementPage.tsx', [
  {
    from: "backgroundColor: '#e2e8f0',\n                            color: '#334155'",
    to: "backgroundColor: 'var(--bg-secondary)',\n                            color: 'var(--text-muted)'"
  },
  {
    from: "backgroundColor: '#e2e8f0',\r\n                            color: '#334155'",
    to: "backgroundColor: 'var(--bg-secondary)',\r\n                            color: 'var(--text-muted)'"
  }
]);

// 3. ApprovalInbox.tsx
replaceInFile('src/pages/ApprovalInbox.tsx', [
  {
    from: "background: st.status === 'APPROVED' ? '#dcfce7' : st.status === 'REJECTED' ? '#fee2e2' : st.status === 'CANCELLED' ? '#f1f5f9' : isCurrentActive ? '#dbeafe' : '#f8fafc',",
    to: "background: st.status === 'APPROVED' ? 'var(--success-light, #dcfce7)' : st.status === 'REJECTED' ? 'var(--danger-light, #fee2e2)' : st.status === 'CANCELLED' ? 'var(--bg-secondary)' : isCurrentActive ? 'var(--primary-light, #dbeafe)' : 'var(--bg-secondary)',"
  },
  {
    from: "color: st.status === 'APPROVED' ? '#15803d' : st.status === 'REJECTED' ? '#b91c1c' : st.status === 'CANCELLED' ? '#94a3b8' : isCurrentActive ? '#1d4ed8' : '#64748b',",
    to: "color: st.status === 'APPROVED' ? 'var(--success)' : st.status === 'REJECTED' ? 'var(--danger)' : st.status === 'CANCELLED' ? 'var(--text-muted)' : isCurrentActive ? 'var(--primary)' : 'var(--text-muted)',"
  }
]);

// 4. TruckDispatch.tsx
replaceInFile('src/pages/TruckDispatch.tsx', [
  { from: "'var(--bg-app, #f9fafb)'", to: "'var(--bg-app)'" },
  { from: "'var(--border-color, #e5e7eb)'", to: "'var(--border-color)'" },
  { from: "'var(--border-color, #d1d5db)'", to: "'var(--border-color)'" }
]);

// 5. outbound_inspections.tsx
replaceInFile('src/pages/outbound_inspections.tsx', [
  { from: "'var(--bg-body, #f8fafc)'", to: "'var(--bg-body)'" }
]);

// 6. DeveloperDeviceGuardModal.tsx
replaceInFile('src/components/DeveloperDeviceGuardModal.tsx', [
  { from: "'var(--bg-surface, #f8fafc)'", to: "'var(--bg-surface)'" },
  { from: "'var(--bg-secondary, #f1f5f9)'", to: "'var(--bg-secondary)'" }
]);

// 7. BatchBusinessLicenseModal.tsx
replaceInFile('src/components/BatchBusinessLicenseModal.tsx', [
  { from: "'var(--bg-secondary, #f8fafc)'", to: "'var(--bg-secondary)'" }
]);

// 8. NtsStatusAuditModal.tsx
replaceInFile('src/components/NtsStatusAuditModal.tsx', [
  { from: "'var(--bg-secondary, #f8fafc)'", to: "'var(--bg-secondary)'" }
]);

console.log('Batch replacements round 3 finished.');
