filepath = 'src/pages/Customers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Let's check if there are left-right labels (horizontal flex for forms)
import re

horizontal_labels = re.findall(r'display:\s*[\'"]flex[\'"][^}]*alignItems:\s*[\'"]center[\'"][^}]*label', content)
print("Horizontal labels found:", len(horizontal_labels))

# Let's check if white-space: nowrap is missing in th or td
tds = re.findall(r'<td[^>]*>', content)
tds_without_nowrap = [t for t in tds if 'nowrap' not in t]
print("tds without nowrap:", len(tds_without_nowrap))

# Let's check for adjectives in buttons
print("Adjectives in buttons:")
print(re.findall(r'<button[^>]*>([^<]*(?:스마트|실시간|원클릭|강력한|진짜|최종)[^<]*)</button>', content))

