import re

filepath = 'src/pages/SiteOptionManage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

inject_point = content.find("return (")
if inject_point != -1 and "handleKeyDown" not in content:
    hook_code = """
  // --- Keyboard Shortcuts (Harden) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showMasterModal) setShowMasterModal(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (showMasterModal) {
          const mockEvent = { preventDefault: () => {} } as React.FormEvent;
          handleSaveMasterOption(mockEvent);
        } else {
          handleSaveSiteOptions();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMasterModal, handleSaveMasterOption, handleSaveSiteOptions]);
  // -----------------------------------
"""
    content = content[:inject_point] + hook_code + "\n  " + content[inject_point:]
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Injected keyboard shortcuts to SiteOptionManage")
