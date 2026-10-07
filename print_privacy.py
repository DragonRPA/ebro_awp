import sys
sys.stdout.reconfigure(encoding='utf-8')
filepath = 'src/utils/privacyMasking.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    print(f.read())
