import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('docs/e_Bro_Manual.md', 'r', encoding='utf-8') as f:
    text = f.read()
    start = text.find('옵션')
    if start != -1:
        print("Found 옵션 at", start)
    start = text.find('현장별')
    if start != -1:
        print("Found 현장별 at", start)
    start = text.find('SiteOptionManage')
    if start != -1:
        print("Found SiteOptionManage at", start)
