with open('src/pages/Customers.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('customerMap.get(selectedRefSite.customerId)', 'customerMap.get(selectedRefSite.customerId || \'\')')

with open('src/pages/Customers.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
