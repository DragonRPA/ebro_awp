import os
import re

filepath = 'src/pages/Customers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Check if useEffect is already there
if 'useKeyboardShortcuts' not in content:
    # We will inject the hook right before `return (` of the main component
    # Actually, finding the right spot is easier by just searching for `const handleSaveAccountSubmit = `
    # and putting our hook after all the save functions.
    
    inject_point = content.find('const handleDeleteAccount')
    if inject_point != -1:
        hook_code = """
  // --- Keyboard Shortcuts (Harden) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close modals
      if (e.key === 'Escape') {
        if (editingCust) setEditingCust(null);
        if (editingContact) setEditingContact(null);
        if (editingSite) { setEditingSite(null); setShowSiteModal(false); }
        if (editingAccount) setEditingAccount(null);
        if (showSiteOptionModal) setShowSiteOptionModal(false);
      }
      // Ctrl+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        const mockEvent = { preventDefault: () => {} } as React.FormEvent;
        if (editingCust) { e.preventDefault(); handleSaveCustSubmit(mockEvent); }
        else if (editingContact) { e.preventDefault(); handleSaveContactSubmit(mockEvent); }
        else if (editingSite) { e.preventDefault(); handleSaveSiteSubmit(mockEvent); }
        else if (editingAccount) { e.preventDefault(); handleSaveAccountSubmit(mockEvent); }
        else if (showSiteOptionModal) { e.preventDefault(); handleSaveSiteOptions(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingCust, editingContact, editingSite, editingAccount, showSiteOptionModal, handleSaveCustSubmit, handleSaveContactSubmit, handleSaveSiteSubmit, handleSaveAccountSubmit, handleSaveSiteOptions]);
  // -----------------------------------
"""
        content = content[:inject_point] + hook_code + "\n" + content[inject_point:]
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Injected keyboard shortcuts")
    else:
        print("Could not find inject point")
else:
    print("Already injected")

# 2. Font Size Bumps (Typeset)
content = content.replace("fontSize: '10px'", "fontSize: '11px'")
content = content.replace("fontSize: '10.5px'", "fontSize: '11.5px'")
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Bumped font sizes")
