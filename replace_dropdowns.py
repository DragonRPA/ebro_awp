import re

filepath = 'src/pages/SiteOptionManage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace PAID dropdown
# We want to replace the div containing the select.
paid_select_start = content.find("if (e.target.value) handleToggleOption(e.target.value);")
if paid_select_start != -1:
    paid_div_start = content.rfind("<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>", 0, paid_select_start)
    paid_div_end = content.find("</div>", paid_select_start) + 6
    
    paid_buttons = """<div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                        {workingOptionItems.filter(item => item.category === 'PAID' && !item.isEnabled).map(item => (
                          <button
                            key={item.optionId}
                            type="button"
                            onClick={() => handleToggleOption(item.optionId)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              fontWeight: 500,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          >
                            + {item.name}
                          </button>
                        ))}
                      </div>"""
    content = content[:paid_div_start] + paid_buttons + content[paid_div_end:]

# Replace PROTECTION dropdown
prot_select_start = content.find("onChange={(e) => handleSelectProtection(e.target.value)}")
if prot_select_start != -1:
    prot_div_start = content.rfind("<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>", 0, prot_select_start)
    prot_div_end = content.find("</div>", prot_select_start) + 6
    
    prot_buttons = """<div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                        {workingOptionItems.filter(item => item.category === 'PROTECTION').map(item => (
                          <button
                            key={item.optionId}
                            type="button"
                            onClick={() => handleSelectProtection(item.isEnabled ? '' : item.optionId)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              borderRadius: '6px',
                              border: item.isEnabled ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                              backgroundColor: item.isEnabled ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-surface)',
                              color: item.isEnabled ? 'var(--primary)' : 'var(--text-primary)',
                              cursor: 'pointer',
                              fontWeight: item.isEnabled ? 700 : 500,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>"""
    content = content[:prot_div_start] + prot_buttons + content[prot_div_end:]

# Replace SPEC dropdown
spec_select_start = content.find("if (e.target.value) handleToggleOption(e.target.value);", paid_select_start + 100 if paid_select_start != -1 else 0)
if spec_select_start != -1:
    spec_div_start = content.rfind("<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>", 0, spec_select_start)
    spec_div_end = content.find("</div>", spec_select_start) + 6
    
    spec_buttons = """<div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                        {workingOptionItems.filter(item => item.category === 'SPEC' && !item.isEnabled).map(item => (
                          <button
                            key={item.optionId}
                            type="button"
                            onClick={() => handleToggleOption(item.optionId)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              fontWeight: 500,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          >
                            + {item.name}
                          </button>
                        ))}
                      </div>"""
    content = content[:spec_div_start] + spec_buttons + content[spec_div_end:]

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated SiteOptionManage dropdowns to buttons")
