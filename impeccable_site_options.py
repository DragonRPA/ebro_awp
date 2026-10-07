import os
import re

filepath = 'src/pages/SiteOptionManage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Font Size Bumps
content = content.replace("fontSize: '10px'", "fontSize: '11px'")
content = content.replace("fontSize: '10.5px'", "fontSize: '11.5px'")
content = content.replace("fontSize: '9px'", "fontSize: '10px'")

# Check if there are modals
# Usually `showBizLicenseModal`, `showBatchLicenseModal` etc.
# SiteOptionManage might have its own modals, let's see.
if "useEffect" in content and "handleKeyDown" not in content:
    # let's just do the font size bump for now as a basic 'impeccable typeset' pass.
    pass

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Bumped font sizes in SiteOptionManage")
