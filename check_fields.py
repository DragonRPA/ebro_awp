import sys
import io
import json

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/data/allMenuManuals.ts', 'r', encoding='utf-8') as f:
    text = f.read()
    count = text.count('"basicGuide":')
    print("Number of basicGuide fields:", count)
    count2 = text.count('"annotations":')
    print("Number of annotations fields:", count2)
