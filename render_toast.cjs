const fs = require('fs');
let c = fs.readFileSync('src/pages/Contracts.tsx', 'utf8');
const toastHTML = `      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: toastMessage.type === 'success' ? '#10b981' : '#ef4444',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: 600
        }}>
          {toastMessage.type === 'success' ? '✅' : '⚠️'} {toastMessage.text}
        </div>
      )}
    </div>
  );
};`;
c = c.replace(/    <\/div>\r?\n  \);\r?\n};\r?\n?$/, toastHTML);
fs.writeFileSync('src/pages/Contracts.tsx', c);
console.log('Done rendering toast');
