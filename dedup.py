import re
import sys

def dedup(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split by "  menuId: "
    parts = re.split(r"(?=\s*menuId:\s*['\"][^'\"]+['\"]\,)", content)
    
    new_content = parts[0]
    
    for i in range(1, len(parts)):
        block = parts[i]
        
        # In this block, there might be multiple basicGuide: [...] and processes: [...]
        # Find all basicGuides
        basic_guides = list(re.finditer(r"^\s*basicGuide:\s*\[[\s\S]*?^\s*\],$", block, re.MULTILINE))
        processes = list(re.finditer(r"^\s*processes:\s*\[[\s\S]*?^\s*\],?$", block, re.MULTILINE))
        
        if len(basic_guides) > 1:
            # We want to remove all but the last basicGuide
            for match in reversed(basic_guides[:-1]):
                block = block[:match.start()] + block[match.end():]
                
        # Re-search processes because the string indices have changed
        processes = list(re.finditer(r"^\s*processes:\s*\[[\s\S]*?^\s*\],?$", block, re.MULTILINE))
        if len(processes) > 1:
            for match in reversed(processes[:-1]):
                block = block[:match.start()] + block[match.end():]
                
        new_content += block
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("Deduplicated", filepath)

if __name__ == "__main__":
    dedup("src/data/allMenuManuals.ts")
