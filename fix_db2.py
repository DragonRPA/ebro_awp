with open('src/services/db.ts', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('export interface CustomerSite {\n  id: string;\n  name: string;', 'export interface CustomerSite {\n  id: string;\n  customerId?: string;\n  name: string;')

with open('src/services/db.ts', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed db.ts')
