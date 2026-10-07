import re

filepath = 'src/data/allMenuManuals.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Let's see the Customers menu definition.
# It should be around menuId: 'Customers'
start = content.find("menuId: 'Customers'")
if start != -1:
    end = content.find("menuId: '", start + 20)
    if end == -1: end = len(content)
    snippet = content[start:end]
    
    # We will remove references to '현장 옵션' and '현장 삭제' in the snippet
    new_snippet = re.sub(r'["\'][^"\']*현장\s*삭제[^"\']*["\'],?\s*', '', snippet)
    new_snippet = re.sub(r'["\'][^"\']*현장\s*옵션[^"\']*["\'],?\s*', '', new_snippet)
    
    content = content[:start] + new_snippet + content[end:]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Cleaned up Customers manual")
else:
    print("Could not find Customers menu in manuals")
