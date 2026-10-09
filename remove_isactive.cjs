const fs = require('fs');
let c = fs.readFileSync('src/pages/Customers.tsx', 'utf8');

const targetStr = `              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', backgroundColor: 'var(--bg-app)', borderRadius: '4px' }}>
                <input
                  type="checkbox"
                  id="siteActiveCheck"
                  checked={editingSite.isActive !== false}
                  onChange={e => setEditingSite({ ...editingSite, isActive: e.target.checked })}
                />
                <label htmlFor="siteActiveCheck" style={{ fontSize: '12px', cursor: 'pointer', margin: 0 }}>
                  가동 현장 (공사 완공 시 체크 해제)
                </label>
              </div>`;

if (c.includes(targetStr)) {
  c = c.replace(targetStr, '');
  console.log('Checkbox removed.');
} else {
  // Let's try splitting by lines
  console.log('Not found exactly.');
}

// Remove opacity styling and badge
c = c.replace(/<tr key=\{cs\.id\} style=\{\{ borderBottom: '1px solid var\(--border-color\)', opacity: cs\.isActive !== false \? 1 : 0\.6 \}\}>/g, 
  "<tr key={cs.id} style={{ borderBottom: '1px solid var(--border-color)' }}>");

c = c.replace(/<span className=\{`badge \$\{cs\.isActive !== false \? 'badge-success' : 'badge-secondary'\}`\} style=\{\{ fontSize: '9\.5px' \}\}>\s*\{cs\.isActive !== false \? '가동' : '종료'\}\s*<\/span>/g, "");

fs.writeFileSync('src/pages/Customers.tsx', c);
