import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('agent/studioEngine.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.findall(r'.*?display\s*=\s*[\'"]none[\'"].*', text)
for m in matches:
    print(m)
