import json
with open('src/data/allMenuManuals.ts', 'r', encoding='utf-8') as f:
    text = f.read()

start = text.find('"menuId": "customer"')
if start != -1:
    end = text.find('"menuId":', start + 10)
    customer_block = text[start:end]
    print([line for line in customer_block.split('\n') if '옵션' in line])
