
const fs = require('fs');
let content = fs.readFileSync('src/pages/Customers.tsx', 'utf8');

if (!content.includes('import { createHangulMatcher')) {
  content = content.replace(
    'import { createClient } from \\'@supabase/supabase-js\\';',
    'import { createClient } from \\'@supabase/supabase-js\\';\\nimport { createHangulMatcher } from \\'@/utils/hangulSearch\\';'
  );
}

const lines = content.split('\\n');
const startIdx = lines.findIndex(l => l.includes('const optionReferenceSites = useMemo(() => {'));
let endIdx = -1;
if (startIdx !== -1) {
  for (let i = startIdx; i < startIdx + 30; i++) {
    if (lines[i].includes('}, [sites, customerMap, editingSite?.id, editingSiteOption?.id, siteOptionRefSearch]);')) {
      endIdx = i;
      break;
    }
  }
}

if (startIdx !== -1 && endIdx !== -1) {
  const newBlock = [
    '  const optionReferenceSites = useMemo(() => {',
    '    const matcher = createHangulMatcher(siteOptionRefSearch);',
    '    return (sites || []).filter(s => {',
    '      if (editingSite?.id && s.id === editingSite.id) return false;',
    '      if (editingSiteOption?.id && s.id === editingSiteOption.id) return false;',
    '',
    '      if (siteOptionRefSearch.trim()) {',
    '        const cName = customerMap.get(s.customerId)?.name || \\'\\';',
    '        const sName = s.name || \\'\\';',
    '        const sAddr = s.address || \\'\\';',
    '        const sOpts = (s.paidOptions || \\'\\') + \\' \\' + (s.protection || \\'\\');',
    '        return matcher.testAny([cName, sName, sAddr, sOpts]);',
    '      }',
    '      return true;',
    '    }).sort((a, b) => {',
    '      const aHasOpts = Boolean(a.paidOptions || a.protection || (a.checkedSpecs && Object.keys(a.checkedSpecs).length > 0));',
    '      const bHasOpts = Boolean(b.paidOptions || b.protection || (b.checkedSpecs && Object.keys(b.checkedSpecs).length > 0));',
    '      if (aHasOpts && !bHasOpts) return -1;',
    '      if (!aHasOpts && bHasOpts) return 1;',
    '      return (a.name || \\'\\').localeCompare(b.name || \\'\\');',
    '    });',
    '  }, [sites, customerMap, editingSite?.id, editingSiteOption?.id, siteOptionRefSearch]);'
  ];
  const newLines = [...lines.slice(0, startIdx), ...newBlock, ...lines.slice(endIdx + 1)];
  fs.writeFileSync('src/pages/Customers.tsx', newLines.join('\\n'), 'utf8');
} else {
  console.log('Block not found');
}

