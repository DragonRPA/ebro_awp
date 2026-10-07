import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/pages/SiteOptionManage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove the activeTab state
text = text.replace(
    "const [activeTab, setActiveTab] = useState<'SITE_OPTIONS' | 'MASTER_OPTIONS'>('SITE_OPTIONS');",
    ""
)

# Remove the routing payload for MASTER_OPTIONS
text = text.replace(
    "if (navigationPayload.tab === 'MASTER_OPTIONS') {\n        setActiveTab('MASTER_OPTIONS');\n      }",
    ""
)

# Remove the Tab headers
import re
text = re.sub(r'<div[^>]*>\s*<button[^>]*onClick=\{\(\) => setActiveTab\(\'SITE_OPTIONS\'\)\}[^>]*>.*?</button>\s*<button[^>]*onClick=\{\(\) => setActiveTab\(\'MASTER_OPTIONS\'\)\}[^>]*>.*?</button>\s*</div>', '', text, flags=re.DOTALL)

# Remove {activeTab === 'SITE_OPTIONS' && ( ... )} wrapper (just the if condition)
text = text.replace("{activeTab === 'SITE_OPTIONS' && (", "")

# Remove the {activeTab === 'MASTER_OPTIONS' && ( ... )} block completely
text = re.sub(r'\{\/\* \[탭 2: 옵션 품목 관리 \(StandardOption\) 탭\] \*\/\}\s*\{activeTab === \'MASTER_OPTIONS\' && \(.*?\}\s*\)\}', '', text, flags=re.DOTALL)

# Remove Master Options modal
text = re.sub(r'\{\/\* 3\. 옵션 품목 등록\/수정 모달 \*\/\}\s*\{showMasterModal && \(.*?\}\s*\)\}', '', text, flags=re.DOTALL)

with open('src/pages/SiteOptionManage_new.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
