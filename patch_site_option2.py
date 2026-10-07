import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/pages/SiteOptionManage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# I will just write a simpler script to find the start and end indices of the MASTER_OPTIONS block
idx_start = text.find("{/* 탭 [탭 2: 옵션 품목 관리 (StandardOption) 탭] */}")
if idx_start != -1:
    idx_end = text.find("{/* 3. 옵션 품목 등록/수정 모달 */}", idx_start)
    if idx_end != -1:
        text = text[:idx_start] + text[idx_end:]

# Now remove the modal
idx_start_modal = text.find("{/* 3. 옵션 품목 등록/수정 모달 */}")
if idx_start_modal != -1:
    idx_end_modal = text.find("</div>\n    </div>\n  );\n}", idx_start_modal)
    if idx_end_modal != -1:
        text = text[:idx_start_modal] + text[idx_end_modal:]

# Remove setActiveTab definitions
text = re.sub(r'const \[activeTab, setActiveTab\] = useState<[^>]+>\(.*?\);\n', '', text)
text = re.sub(r'if \(navigationPayload\.tab === \'MASTER_OPTIONS\'\) \{\s*setActiveTab\(\'MASTER_OPTIONS\'\);\s*\}\n', '', text)
text = re.sub(r'\{/\* 2\. 탭 헤더 \*/\}.*?\{/\* 탭 \[탭 1: 현장별 옵션 매핑 \(Site Options\) 탭\] \*/\}', '', text, flags=re.DOTALL)
text = text.replace("{activeTab === 'SITE_OPTIONS' && (", "")
# Fix the matching closing brace for activeTab === 'SITE_OPTIONS'
text = text.replace("            </div>\n          </div>\n        )}\n", "            </div>\n          </div>\n")

# Remove all "옵션 품목 등록" buttons
text = re.sub(r'<button type="button" onClick=\{\(\) => setActiveTab\(\'MASTER_OPTIONS\'\)\}.*?</button>', '', text, flags=re.DOTALL)

with open('src/pages/SiteOptionManage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
