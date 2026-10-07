const fs = require('fs');
let content = fs.readFileSync('src/pages/Customers.tsx', 'utf8');
if (!content.includes('import { createHangulMatcher')) {
  // Add import if missing
  content = content.replace(
    'import { createClient } from \'@supabase/supabase-js\';',
    'import { createClient } from \'@supabase/supabase-js\';\nimport { createHangulMatcher } from \'@/utils/hangulSearch\';'
  );
}

const targetBlock =   const optionReferenceSites = useMemo(() => {
    return (sites || []).filter(s => {
      if (editingSite?.id && s.id === editingSite.id) return false;
      if (editingSiteOption?.id && s.id === editingSiteOption.id) return false;

      if (siteOptionRefSearch.trim()) {
        const kw = siteOptionRefSearch.trim().toLowerCase();
        const cName = customerMap.get(s.customerId)?.name || '';
        const sName = s.name || '';
        const sAddr = s.address || '';
        const sOpts = (s.paidOptions || '') + ' ' + (s.protection || '');
        return (
          sName.toLowerCase().includes(kw) ||
          cName.toLowerCase().includes(kw) ||
          sAddr.toLowerCase().includes(kw) ||
          sOpts.toLowerCase().includes(kw)
        );
      }
      return true;
    }).sort((a, b) => {
      const aHasOpts = Boolean(a.paidOptions || a.protection || (a.checkedSpecs && Object.keys(a.checkedSpecs).length > 0));
      const bHasOpts = Boolean(b.paidOptions || b.protection || (b.checkedSpecs && Object.keys(b.checkedSpecs).length > 0));
      if (aHasOpts && !bHasOpts) return -1;
      if (!aHasOpts && bHasOpts) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [sites, customerMap, editingSite?.id, editingSiteOption?.id, siteOptionRefSearch]);;

const newBlock =   const optionReferenceSites = useMemo(() => {
    const matcher = createHangulMatcher(siteOptionRefSearch);
    return (sites || []).filter(s => {
      if (editingSite?.id && s.id === editingSite.id) return false;
      if (editingSiteOption?.id && s.id === editingSiteOption.id) return false;

      if (siteOptionRefSearch.trim()) {
        const cName = customerMap.get(s.customerId)?.name || '';
        const sName = s.name || '';
        const sAddr = s.address || '';
        const sOpts = (s.paidOptions || '') + ' ' + (s.protection || '');
        return matcher.testAny([cName, sName, sAddr, sOpts]);
      }
      return true;
    }).sort((a, b) => {
      const aHasOpts = Boolean(a.paidOptions || a.protection || (a.checkedSpecs && Object.keys(a.checkedSpecs).length > 0));
      const bHasOpts = Boolean(b.paidOptions || b.protection || (b.checkedSpecs && Object.keys(b.checkedSpecs).length > 0));
      if (aHasOpts && !bHasOpts) return -1;
      if (!aHasOpts && bHasOpts) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [sites, customerMap, editingSite?.id, editingSiteOption?.id, siteOptionRefSearch]);;

content = content.replace(targetBlock, newBlock);
fs.writeFileSync('src/pages/Customers.tsx', content, 'utf8');
