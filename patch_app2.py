with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

import re
text = re.sub(r"import\s*\{(.*?)\}\s*from\s*'lucide-react';", lambda m: "import {" + m.group(1) + (", Mic" if "Mic" not in m.group(1) else "") + "} from 'lucide-react';", text, count=1)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
