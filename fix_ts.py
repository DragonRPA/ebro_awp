import os

filepath = 'src/pages/Customers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'onClick={() => handleDeleteCustomer(editingCust.id!, editingCust.name)}',
    "onClick={() => handleDeleteCustomer(editingCust.id!, editingCust.name || '')}"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed TS type issue")
