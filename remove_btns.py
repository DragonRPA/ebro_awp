import os
import re

filepath = 'src/pages/Customers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# We want to remove the '옵션' button and '삭제' button in the table row.
# The '수정' button must remain.

target_option_btn = r"""                                      <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick=\{\(\) => handleOpenSiteOptionModal\(cs\)\}
                                        style=\{\{ padding: '1px 5px', fontSize: '10\.5px', display: 'flex', alignItems: 'center', gap: '3px' \}\}
                                      >
                                        <SlidersHorizontal size=\{10\} />
                                        옵션
                                      </button>\s*"""

content = re.sub(target_option_btn, "", content)

target_delete_btn = r"""\s*<button
                                        type="button"
                                        className="btn-secondary"
                                        onClick=\{\(\) => handleDeleteSite\(cs\.id, cs\.name\)\}
                                        style=\{\{ padding: '1px 5px', fontSize: '10\.5px', color: 'var\(--danger-color, #ef4444\)' \}\}
                                        title="현장 삭제"
                                      >
                                        삭제
                                      </button>"""

content = re.sub(target_delete_btn, "", content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed option and delete buttons from table row")
