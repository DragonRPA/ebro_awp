import re

filepath = 'src/data/allMenuManuals.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

matches = re.findall(r'menuId:\s*[\'"]([^\'"]+)[\'"]', content)
print("Menu IDs with regex:", matches)

# If it fails, let's just find "Customers"
if "Customers" in content:
    print("Customers is in the file")
