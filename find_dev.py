import json

filepath = 'src/services/db.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    for line in f:
        if '개발자' in line or '인재' in line:
            print(line.strip())
