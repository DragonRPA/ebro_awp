import json
import re

filepath = 'src/data/allMenuManuals.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('"menuId": "customer"')
if start != -1:
    end = content.find('"menuId":', start + 10)
    if end == -1: end = len(content)
    snippet = content[start:end]
    
    # Let's remove the list items containing '현장 삭제' and '현장 옵션'
    new_snippet = re.sub(r'\n\s*["\'][^"\']*현장\s*삭제[^"\']*["\'],?', '', snippet)
    new_snippet = re.sub(r'\n\s*["\'][^"\']*현장\s*옵션[^"\']*["\'],?', '', new_snippet)
    
    content = content[:start] + new_snippet + content[end:]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Cleaned up Customer manual")
else:
    print("Could not find 'customer' menu")
