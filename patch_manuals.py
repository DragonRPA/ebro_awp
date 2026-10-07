import os, re

def patch_manuals(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to replace "동기화" with "조회" in labels/descriptions
    content = content.replace('"label": "대시보드 동기화"', '"label": "대시보드 조회"')
    content = content.replace('최신 매출/수금 데이터를 즉시 동기화합니다.', '최신 매출/수금 데이터를 즉시 조회합니다.')
    content = content.replace('"동기화"', '"조회"')
    content = content.replace('동기화 버튼', '조회 버튼')
    content = content.replace('데이터 동기화', '데이터 조회')
    content = content.replace('동기화하여', '조회하여')
    content = content.replace('동기화합니다', '조회합니다')
    content = content.replace('동기화 완료', '조회 완료')
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Patched', path)

patch_manuals('src/data/allMenuManuals.ts')
patch_manuals('src/data/modalManuals.ts')
