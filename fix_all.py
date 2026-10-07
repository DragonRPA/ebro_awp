
import os
with open('src/data/allMenuManuals.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace literal backtick-n with newline
text = text.replace(chr(96) + 'n', '\n')

with open('src/data/allMenuManuals.ts', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed')

