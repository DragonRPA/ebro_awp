import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('docs/e_Bro_Manual.md', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'\[M-03\]', text)
if m:
    print("Found [M-03]:", text[m.start()-20:m.end()+30])
