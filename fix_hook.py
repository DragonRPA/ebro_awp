import re

filepath = 'src/pages/Customers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract the hook
hook_start = content.find('  // --- Keyboard Shortcuts (Harden) ---')
hook_end = content.find('  // -----------------------------------') + len('  // -----------------------------------') + 1

if hook_start != -1 and hook_end != -1:
    hook_code = content[hook_start:hook_end]
    content = content[:hook_start] + content[hook_end:]
    
    # Find `return (` for the main component return
    # This is usually near the end of the component.
    # Let's find `return (` that is followed by `<div`
    return_matches = [m.start() for m in re.finditer(r'return\s*\(\s*<div', content)]
    if return_matches:
        # The first or last? The main render is usually the last one in the file if there are no subcomponents.
        # Actually, let's just find `return (` after `handleSaveAccountSubmit`
        save_idx = content.find('const handleSaveAccountSubmit')
        insert_idx = content.find('return (', save_idx)
        
        if insert_idx != -1:
            content = content[:insert_idx] + hook_code + "\n  " + content[insert_idx:]
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print("Moved hook successfully")
        else:
            print("Could not find return after handleSaveAccountSubmit")
else:
    print("Could not find hook to move")
