import re

filepath = 'src/pages/SiteOptionManage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find("    // --- Keyboard Shortcuts (Harden) ---")
if start_idx != -1:
    end_idx = content.find("    // -----------------------------------", start_idx)
    if end_idx != -1:
        end_idx += len("    // -----------------------------------\n")
        
        # Extract the block
        block = content[start_idx:end_idx]
        
        # Remove it
        content = content[:start_idx] + content[end_idx:]
        
        # Unindent block by 2 spaces
        lines = block.split('\n')
        unindented_lines = []
        for line in lines:
            if line.startswith('  '):
                unindented_lines.append(line[2:])
            else:
                unindented_lines.append(line)
        block = '\n'.join(unindented_lines)
        
        # Find main return
        # Usually it's `  return (\n    <div`
        main_return_idx = content.find("  return (\n    <div data-hs-observe=")
        if main_return_idx == -1:
            main_return_idx = content.find("  return (\n      <div data-hs-observe=")
        if main_return_idx == -1:
            # just look for `  return (` near the end
            main_return_idx = content.rfind("  return (")
            
        if main_return_idx != -1:
            content = content[:main_return_idx] + block + "\n" + content[main_return_idx:]
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print("Moved Keyboard Shortcuts out of useMemo")
        else:
            print("Could not find main return")
    else:
        print("Could not find end of block")
else:
    print("Could not find start of block")

