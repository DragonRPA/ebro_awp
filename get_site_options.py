import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
with open('src/data/allMenuManuals.ts', 'r', encoding='utf-8') as f:
    text = f.read()
start = text.find('"menuId": "site_options"')
if start != -1:
    end = text.find('"menuId":', start + 10)
    customer_block = text[start:end]
    print(customer_block)
else:
    print("Not found")
