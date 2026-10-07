import re

filepath = 'src/data/allMenuManuals.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

matches = re.findall(r'menuId:\s*[\'"]([^\'"]+)[\'"]', content)
print("Menu IDs:", matches)
