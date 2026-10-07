const fs = require('fs');
let text = fs.readFileSync('src/pages/smart_dispatch4.tsx', 'utf8');

// Force activeTab to 'NEW'
text = text.replace(/const \[activeTab, setActiveTabState\] = useState<ActiveTab>\(\(\) => \{[\s\S]*?return 'NEW';\n  \}\);/m, `const activeTab: ActiveTab = 'NEW';`);

// Remove setActiveTab
text = text.replace(/const setActiveTab = \(tab: ActiveTab\) => \{[\s\S]*?\}\s*;/m, '');

// Remove dispatch4-header-tabs section entirely
text = text.replace(/<div className="dispatch4-header-tabs">[\s\S]*?<\/div>\s*<\/div>/, '</div>');

// Remove audioUploadOpen button
text = text.replace(/<button\s*data-mid="dispatch4-btn-audio-upload"[\s\S]*?<\/button>/, '');

// Remove audio modal component
text = text.replace(/<CallAudioUploadModal[\s\S]*?\/>/, '');

// Remove renderQueueTab function entirely (optional but cleans up)
text = text.replace(/\/\/\s*─+\n\s*\/\/\s*렌더:\s*처리\s*대기\s*큐\s*탭[\s\S]*?const renderQueueTab = \(\) => \{[\s\S]*?^\s*\}\)\;\n\s*\};/m, '');

fs.writeFileSync('src/pages/smart_dispatch4.tsx', text, 'utf8');
console.log('Patch complete.');
