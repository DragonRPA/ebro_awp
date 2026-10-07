filepath = 'src/pages/Customers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if '개발자' in line or '인재' in line or 'developer' in line.lower() or 'admin' in line.lower():
            print(f"{i+1}: {line.strip()}")
