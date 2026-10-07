import re

filepath = 'src/data/allMenuManuals.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('"menuId": "customer"')
if start != -1:
    end = content.find('"menuId":', start + 10)
    if end == -1: end = len(content)
    snippet = content[start:end]
    
    # Check if "기본상속" or "유상옵션" or "보양작업" is mentioned
    has_mention = False
    new_snippet = snippet
    if "기본" in new_snippet or "상속" in new_snippet or "보양" in new_snippet or "유상옵션" in new_snippet:
        has_mention = True
        # Let's remove lines mentioning these in the customer manual
        # Usually they are inside lists like `"`...`",`
        new_snippet = re.sub(r'\n\s*["\'][^"\']*(?:기본상속|보양작업|유상옵션)[^"\']*["\'],?', '', new_snippet)
    
    if new_snippet != snippet:
        content = content[:start] + new_snippet + content[end:]
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Removed options references from Customer manual")
    else:
        print("No references found in Customer manual")
else:
    print("Could not find 'customer' menu")
