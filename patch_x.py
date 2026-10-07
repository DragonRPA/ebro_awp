with open('src/pages/SiteOptionManage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('AlertCircle, FileText, CheckCircle2, ChevronRight, Sliders', 'AlertCircle, FileText, CheckCircle2, ChevronRight, Sliders, X')

with open('src/pages/SiteOptionManage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
