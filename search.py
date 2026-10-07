import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('docs/e_Bro_Manual.md', 'r', encoding='utf-8') as f:
    text = f.read()
    import re
    matches = re.finditer(r'.{0,30}옵션.{0,30}', text)
    count = 0
    for m in matches:
        print(m.group(0))
        count += 1
        if count > 10: break
