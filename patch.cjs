const fs = require('fs');
let code = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');

// 1. Remove states
code = code.replace(/const \[activeTab, setActiveTab\] = useState.*?\n/, '');
code = code.replace(/const \[showMasterModal, setShowMasterModal\] = useState.*?\n/, '');
code = code.replace(/const \[editingMasterOption, setEditingMasterOption\] = useState.*?\n/, '');

// 2. Remove activeTab logic in useEffect
code = code.replace(/if \(navigationPayload\.tab === 'MASTER_OPTIONS'\) \{\s*setActiveTab\('MASTER_OPTIONS'\);\s*\}/, '');

// 3. Remove save/delete functions for master options
const startFunc = code.indexOf('const handleSaveMasterOption =');
if (startFunc !== -1) {
    const endFunc = code.indexOf('return (', startFunc);
    code = code.substring(0, startFunc) + code.substring(endFunc);
}

// 4. Replace 탭 헤더
code = code.replace(/\{\/\* 2\. 탭 헤더 \*\/\}.*?\{\/\* 탭 \[탭 1: 현장별 옵션 매핑 \(Site Options\) 탭\] \*\/\}/s, '{/* 탭 [탭 1: 현장별 옵션 매핑 (Site Options) 탭] */}');

// 5. Remove {activeTab === 'SITE_OPTIONS' && (  and its closing
code = code.replace(/\{activeTab === 'SITE_OPTIONS' && \(\s*/, '');
// finding the matching closing
code = code.replace(/<\/div>\n\s*<\/>\n\s*\)\}\n\n\s*\{\/\* 탭 \[탭 2: 옵션 품목 관리 \(StandardOption\) 탭\] \*\/\}/s, '</div>\n          </>\n\n        {/* 탭 [탭 2: 옵션 품목 관리 (StandardOption) 탭] */}');

// 6. Remove Tab 2 completely
code = code.replace(/\{\/\* 탭 \[탭 2: 옵션 품목 관리 \(StandardOption\) 탭\] \*\/\}.*?\{\/\* 3\. 옵션 품목 등록\/수정 모달 \*\/\}/s, '{/* 3. 옵션 품목 등록/수정 모달 */}');

// 7. Remove Modal completely
code = code.replace(/\{\/\* 3\. 옵션 품목 등록\/수정 모달 \*\/\}.*?<\/div>\n\s*<\/div>\n\s*\);\n\}/s, '      </div>\n    </div>\n  );\n}');

// 8. Remove the Master Option Register buttons
code = code.replace(/<button type="button" onClick=\{\(\) => setActiveTab\('MASTER_OPTIONS'\)\}.*?<\/button>/gs, '');

fs.writeFileSync('src/pages/SiteOptionManage.tsx', code, 'utf8');
