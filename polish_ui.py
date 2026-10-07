import os
import re

filepath = 'public/대시보드.html'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix nested cards by removing borders, background colors, and border-radius from inner elements
# The outer cards have classes like 'bg-slate-900 border border-slate-800 rounded-xl'
# Inner elements often have 'bg-slate-950/60 border border-slate-800/80 rounded' or 'bg-slate-800'

# Find all nested card classes and replace them with simpler structural classes
content = content.replace('bg-slate-950/60 border border-slate-800/80 rounded', 'flex flex-col gap-1 items-center justify-center')
content = content.replace('bg-slate-950 border border-slate-800/80 rounded', 'flex flex-col gap-1 items-center justify-center')
content = content.replace('bg-slate-800/50 border border-slate-700/50 rounded', 'flex flex-col gap-1 items-center justify-center')
content = content.replace('border border-slate-700/50 rounded bg-slate-800/50', '')

# Remove some extra backgrounds inside cards
content = content.replace('bg-slate-800 px-1.5 py-0.2 rounded', '')
content = content.replace('bg-blue-900/60 text-blue-300 border border-blue-700/50 px-1.5 py-0.2 rounded', 'text-blue-400')
content = content.replace('bg-amber-900/60 text-amber-300 border border-amber-700/50 px-1.5 py-0.2 rounded', 'text-amber-400')
content = content.replace('bg-purple-900/60 text-purple-300 border border-purple-700/50 px-1.5 py-0.2 rounded', 'text-purple-400')
content = content.replace('bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 px-1.5 py-0.2 rounded', 'text-emerald-400')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed nested cards styling")
