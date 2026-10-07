import re

filepath = 'src/pages/SiteOptionManage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the optionToSave object construction
bad_code = """        const optionToSave: StandardOption = {
          id: editingMasterOption.id || `opt_${Date.now()}`,
          category: editingMasterOption.category || 'PAID',
          name: editingMasterOption.name.trim(),
          defaultPrice: Number(editingMasterOption.defaultPrice || 0),
          unit: editingMasterOption.unit || '',
          description: editingMasterOption.description || '',
          isActive: editingMasterOption.isActive !== false,
          sortOrder: Number(editingMasterOption.sortOrder || (standardOptions.length + 1)),
          createdAt: editingMasterOption.createdAt || new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString()
        };"""

# Wait, there are encoding issues with `unit: ''`. Let's just replace the id line.
content = re.sub(r'id:\s*editingMasterOption\.id\s*\|\|[^\n,]+,', 
                 r'...(editingMasterOption.id ? { id: editingMasterOption.id } : {}),', 
                 content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed fake id generation from SiteOptionManage")
