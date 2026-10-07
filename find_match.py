import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('docs/e_Bro_Manual.md', 'r', encoding='utf-8') as f:
    text = f.read()

m03_pattern = re.compile(r'(### [^\n]*\[M-03\] 계약 대장.*?(?=### [^\n]*\[M-04\]))', re.DOTALL)
match = m03_pattern.search(text)
if match:
    print("MATCHED!")
else:
    print("NOT MATCHED!")
