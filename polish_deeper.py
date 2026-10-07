import os

filepath = 'public/대시보드.html'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix heading issue (h3 -> h2)
content = content.replace('<h3 class="text-sm font-bold text-white', '<h2 class="text-sm font-bold text-white')
content = content.replace('</h3>', '</h2>')

# Fix table thead cards
content = content.replace('thead class="bg-slate-900 border-y border-slate-800"', 'thead class="border-b border-slate-800 text-slate-400"')
content = content.replace('bg-slate-900 border border-slate-800 rounded-xl p-5', 'bg-transparent border-t border-slate-800 py-5')

# Ensure we remove all nested cards inside dashboard
content = content.replace('bg-slate-900 border border-slate-800 rounded-xl', 'bg-transparent')
content = content.replace('border border-slate-800/80 rounded', '')
content = content.replace('p-2 rounded bg-slate-950/60', 'py-1')
content = content.replace('p-3 rounded-lg bg-slate-950/50', 'py-2')
content = content.replace('border border-slate-800/80', '')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Applied deeper polish to the HTML")
