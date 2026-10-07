import re

filepath = 'src/pages/SiteOptionManage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find("                  // --- Keyboard Shortcuts (Harden) ---")
if start_idx == -1:
    start_idx = content.find("  // --- Keyboard Shortcuts (Harden) ---")
if start_idx == -1:
    start_idx = content.find("// --- Keyboard Shortcuts (Harden) ---")
    
if start_idx != -1:
    # find the previous newline
    line_start = content.rfind('\n', 0, start_idx) + 1
    end_idx = content.find("// -----------------------------------", start_idx)
    if end_idx != -1:
        end_idx += len("// -----------------------------------\n")
        
        block = content[line_start:end_idx]
        content = content[:line_start] + content[end_idx:]
        
        # Unindent block if it has a lot of spaces
        lines = block.split('\n')
        unindented_lines = []
        for line in lines:
            # strip leading spaces but keep relative indentation
            # actually let's just make it have 2 spaces base
            stripped = line.lstrip()
            if stripped:
                unindented_lines.append("  " + stripped)
            else:
                unindented_lines.append(line)
        block = '\n'.join(unindented_lines)
        
        target_str = '<div data-hs-observe="siteoptionmanage"'
        target_idx = content.find(target_str)
        if target_idx != -1:
            return_idx = content.rfind("  return (", 0, target_idx)
            if return_idx != -1:
                content = content[:return_idx] + block + "\n" + content[return_idx:]
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                print("Moved block to main return.")
            else:
                print("Could not find main return (")
        else:
            print("Could not find data-hs-observe")
    else:
        print("Could not find end of block")
else:
    print("Could not find start of block")

