filepath = 'src/pages/SiteOptionManage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

import re
matches = re.findall(r'<th[^>]*>.*?</th>', content)
for m in matches:
    print(m)

