const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'pages', 'users_permissions.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

const oldDeptTdPattern = /<td style=\{\{\s*padding: '8px 12px',\s*color: 'var\(--text-secondary, #475569\)'\s*\}\}>\s*\{deptName\}\s*<\/td>/;

const newDeptTd = `<td style={{ padding: '8px 12px', color: 'var(--text-secondary, #475569)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{deptName}</span>
                            {(() => {
                              const deptObj = user.departmentId ? departmentObjMap.get(user.departmentId) : undefined;
                              const tags = deptObj ? getDepartmentFunctionalTags(deptObj) : [];
                              if (tags.length === 0) return null;
                              return (
                                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                                  {tags.slice(0, 2).map(tagId => {
                                    const attr = UNIVERSAL_FUNCTIONAL_ATTRIBUTES.find(a => a.id === tagId || a.code === tagId);
                                    if (!attr) return null;
                                    return (
                                      <span
                                        key={attr.id}
                                        style={{
                                          fontSize: '10px',
                                          padding: '1px 5px',
                                          borderRadius: '4px',
                                          backgroundColor: attr.badgeBg,
                                          color: attr.badgeText,
                                          border: \`1px solid \${attr.color}33\`,
                                          whiteSpace: 'nowrap',
                                          fontWeight: 600
                                        }}
                                        title={attr.description}
                                      >
                                        {attr.label}
                                      </span>
                                    );
                                  })}
                                  {tags.length > 2 && (
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                      +{tags.length - 2}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </td>`;

if (oldDeptTdPattern.test(content)) {
  content = content.replace(oldDeptTdPattern, newDeptTd);
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log('Successfully updated users_permissions.tsx with functional tags badges.');
} else {
  console.error('Failed to match oldDeptTdPattern');
}
