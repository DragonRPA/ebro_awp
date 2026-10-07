with open('src/pages/Customers.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('customerMap.get(s.customerId)', 'customerMap.get(s.customerId || \'\')')
text = text.replace('customers.find(c => c.id === cs.customerId)', 'customers.find(c => c.id === (cs.customerId || \'\'))')

with open('src/pages/Customers.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
