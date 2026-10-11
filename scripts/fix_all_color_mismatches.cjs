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
    } else {
      console.warn(`[WARN] In ${filePath}, pattern not found:`, from.substring(0, 50));
    }
  });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[OK] ${filePath}: applied ${count} replacement(s)`);
}

// 1. InitialDbUploader.tsx
replaceInFile('src/pages/InitialDbUploader.tsx', [
  {
    from: "backgroundColor: bandStatusFilter === st ? '#1e293b' : '#e2e8f0',\n                          color: bandStatusFilter === st ? '#ffffff' : '#475569'",
    to: "backgroundColor: bandStatusFilter === st ? 'var(--primary)' : 'var(--bg-secondary)',\n                          color: bandStatusFilter === st ? '#ffffff' : 'var(--text-muted)'"
  },
  {
    from: "backgroundColor: bandStatusFilter === st ? '#1e293b' : '#e2e8f0',\r\n                          color: bandStatusFilter === st ? '#ffffff' : '#475569'",
    to: "backgroundColor: bandStatusFilter === st ? 'var(--primary)' : 'var(--bg-secondary)',\r\n                          color: bandStatusFilter === st ? '#ffffff' : 'var(--text-muted)'"
  },
  {
    from: "color: bandContractFilter === cf ? '#ffffff' : '#475569'",
    to: "color: bandContractFilter === cf ? '#ffffff' : 'var(--text-muted)'"
  },
  {
    from: "backgroundColor: u.role === 'ADMIN' ? '#fee2e2' : u.role === 'MANAGER' ? '#fef3c7' : '#f1f5f9', color: u.role === 'ADMIN' ? '#b91c1c' : u.role === 'MANAGER' ? '#b45309' : '#475569'",
    to: "backgroundColor: u.role === 'ADMIN' ? '#fee2e2' : u.role === 'MANAGER' ? '#fef3c7' : 'var(--bg-secondary)', color: u.role === 'ADMIN' ? '#b91c1c' : u.role === 'MANAGER' ? '#b45309' : 'var(--text-muted)'"
  },
  {
    from: "width: '100%', height: '8px', backgroundColor: '#e2e8f0'",
    to: "width: '100%', height: '8px', backgroundColor: 'var(--bg-secondary)'"
  }
]);

// 2. AssetInboundStaging.tsx
replaceInFile('src/components/AssetInboundStaging.tsx', [
  {
    from: "backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px dashed var(--border-color)'",
    to: "backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px dashed var(--border-color)'"
  },
  {
    from: "border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontSize: '12px', textAlign: 'left', fontWeight: 600",
    to: "border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '12px', textAlign: 'left', fontWeight: 600"
  }
]);

// 3. PersistentJobAlertToast.tsx
replaceInFile('src/components/PersistentJobAlertToast.tsx', [
  {
    from: "backgroundColor: '#f8fafc',\n    borderTop: '1px solid #e2e8f0'",
    to: "backgroundColor: 'var(--bg-card)',\n    borderTop: '1px solid var(--border-color)'"
  },
  {
    from: "backgroundColor: '#f8fafc',\r\n    borderTop: '1px solid #e2e8f0'",
    to: "backgroundColor: 'var(--bg-card)',\r\n    borderTop: '1px solid var(--border-color)'"
  }
]);

// 4. ApprovalInbox.tsx
replaceInFile('src/pages/ApprovalInbox.tsx', [
  {
    from: "style={{ padding: '7px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}",
    to: "style={{ padding: '7px 16px', background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}"
  }
]);

// 5. ConsumableInOutPage.tsx
replaceInFile('src/pages/ConsumableInOutPage.tsx', [
  {
    from: "border: '1px solid #ccc', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#f9fafb'",
    to: "border: '1px solid var(--border-color)', borderRadius: '3px', cursor: 'pointer', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)'"
  }
]);

// 6. FieldAsManagement.tsx
replaceInFile('src/pages/FieldAsManagement.tsx', [
  {
    from: "backgroundColor: isEffectiveMobile ? '#fef3c7' : '#f1f5f9',\n              border: isEffectiveMobile ? '1px solid #f59e0b' : '1px solid #cbd5e1',\n              borderRadius: '6px',\n              fontSize: '12px',\n              fontWeight: 700,\n              color: isEffectiveMobile ? '#b45309' : '#475569'",
    to: "backgroundColor: isEffectiveMobile ? 'var(--warning-light, #fef3c7)' : 'var(--bg-secondary)',\n              border: isEffectiveMobile ? '1px solid var(--warning)' : '1px solid var(--border-color)',\n              borderRadius: '6px',\n              fontSize: '12px',\n              fontWeight: 700,\n              color: isEffectiveMobile ? 'var(--warning)' : 'var(--text-muted)'"
  },
  {
    from: "backgroundColor: isEffectiveMobile ? '#fef3c7' : '#f1f5f9',\r\n              border: isEffectiveMobile ? '1px solid #f59e0b' : '1px solid #cbd5e1',\r\n              borderRadius: '6px',\r\n              fontSize: '12px',\r\n              fontWeight: 700,\r\n              color: isEffectiveMobile ? '#b45309' : '#475569'",
    to: "backgroundColor: isEffectiveMobile ? 'var(--warning-light, #fef3c7)' : 'var(--bg-secondary)',\r\n              border: isEffectiveMobile ? '1px solid var(--warning)' : '1px solid var(--border-color)',\r\n              borderRadius: '6px',\r\n              fontSize: '12px',\r\n              fontWeight: 700,\r\n              color: isEffectiveMobile ? 'var(--warning)' : 'var(--text-muted)'"
  },
  {
    from: "backgroundColor: actionBillableType === 'FREE' ? '#f1f5f9' : 'var(--bg-card)'",
    to: "backgroundColor: actionBillableType === 'FREE' ? 'var(--bg-secondary)' : 'var(--bg-card)'"
  }
]);

// 7. TenantManagementPage.tsx
replaceInFile('src/pages/TenantManagementPage.tsx', [
  {
    from: "backgroundColor: hasCustom ? '#eff6ff' : '#f1f5f9',\n                              color: hasCustom ? '#1d4ed8' : '#64748b'",
    to: "backgroundColor: hasCustom ? 'var(--primary-light, #eff6ff)' : 'var(--bg-secondary)',\n                              color: hasCustom ? 'var(--primary)' : 'var(--text-muted)'"
  },
  {
    from: "backgroundColor: hasCustom ? '#eff6ff' : '#f1f5f9',\r\n                              color: hasCustom ? '#1d4ed8' : '#64748b'",
    to: "backgroundColor: hasCustom ? 'var(--primary-light, #eff6ff)' : 'var(--bg-secondary)',\r\n                              color: hasCustom ? 'var(--primary)' : 'var(--text-muted)'"
  },
  {
    from: "backgroundColor: '#e2e8f0',\n                                          color: '#475569'",
    to: "backgroundColor: 'var(--bg-secondary)',\n                                          color: 'var(--text-muted)'"
  },
  {
    from: "backgroundColor: '#e2e8f0',\r\n                                          color: '#475569'",
    to: "backgroundColor: 'var(--bg-secondary)',\r\n                                          color: 'var(--text-muted)'"
  },
  {
    from: "backgroundColor: '#f8fafc',\n                    borderRadius: '8px',\n                    border: '1px dashed #cbd5e1',\n                    fontSize: '12px',\n                    color: '#334155'",
    to: "backgroundColor: 'var(--bg-secondary)',\n                    borderRadius: '8px',\n                    border: '1px dashed var(--border-color)',\n                    fontSize: '12px',\n                    color: 'var(--text-secondary)'"
  },
  {
    from: "backgroundColor: '#f8fafc',\r\n                    borderRadius: '8px',\r\n                    border: '1px dashed #cbd5e1',\r\n                    fontSize: '12px',\r\n                    color: '#334155'",
    to: "backgroundColor: 'var(--bg-secondary)',\r\n                    borderRadius: '8px',\r\n                    border: '1px dashed var(--border-color)',\r\n                    fontSize: '12px',\r\n                    color: 'var(--text-secondary)'"
  }
]);

// 8. users_permissions.tsx
replaceInFile('src/pages/users_permissions.tsx', [
  {
    from: "backgroundColor: count > 0 ? '#dbeafe' : '#f1f5f9',\n                            color: count > 0 ? '#1d4ed8' : '#64748b'",
    to: "backgroundColor: count > 0 ? 'var(--primary-light, #dbeafe)' : 'var(--bg-secondary)',\n                            color: count > 0 ? 'var(--primary)' : 'var(--text-muted)'"
  },
  {
    from: "backgroundColor: count > 0 ? '#dbeafe' : '#f1f5f9',\r\n                            color: count > 0 ? '#1d4ed8' : '#64748b'",
    to: "backgroundColor: count > 0 ? 'var(--primary-light, #dbeafe)' : 'var(--bg-secondary)',\r\n                            color: count > 0 ? 'var(--primary)' : 'var(--text-muted)'"
  }
]);

console.log('All replacements completed successfully.');
