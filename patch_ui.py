import os

def replace_in_file(path, old, new):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if old in content:
        content = content.replace(old, new)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Replaced in {path}')

replace_in_file('src/pages/CashFlowPage.tsx', '<RefreshCw size={13} /> 동기화', '<RefreshCw size={13} /> 조회')
replace_in_file('src/pages/Products.tsx', "<RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> 동기화", "<RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> 조회")
