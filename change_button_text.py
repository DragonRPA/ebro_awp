import re

# 1. Update UI
filepath = 'src/pages/Customers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("/> 동기화\n", "/> 조회\n")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated Customers.tsx")

# 2. Update Manual
filepath_manual = 'src/data/allMenuManuals.ts'
with open(filepath_manual, 'r', encoding='utf-8') as f:
    manual = f.read()

start = manual.find('"menuId": "customer"')
if start != -1:
    end = manual.find('"menuId":', start + 10)
    if end == -1: end = len(manual)
    snippet = manual[start:end]
    
    new_snippet = snippet.replace("동기화", "조회")
    
    manual = manual[:start] + new_snippet + manual[end:]
    
    with open(filepath_manual, 'w', encoding='utf-8') as f:
        f.write(manual)
    print("Updated Customer manual")
else:
    print("Could not find customer manual")
