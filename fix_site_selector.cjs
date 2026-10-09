const fs = require('fs');
let c = fs.readFileSync('src/pages/Customers.tsx', 'utf8');

const target = `const custName = customerMap.get(s.customerId || '')?.name || '고객사 미지정';
                      const optSummary = [s.paidOptions, s.protection].filter(Boolean).join(' | ');
                      return (
                        <option key={s.id} value={s.id}>
                          [{custName}] {s.name} {optSummary ? \`(\${optSummary})\` : '(옵션 미설정)'}
                        </option>
                      );`;

const replacement = `return (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.address || '주소 미기재'})
                        </option>
                      );`;

c = c.split(target).join(replacement);

// Now change the apply options logic to also copy name and address
const applyEditingTarget = `    setEditingSite(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        paidOptions: selectedRefSite.paidOptions || '',
        protection: selectedRefSite.protection || '',
        checkedSpecs: selectedRefSite.checkedSpecs ? { ...selectedRefSite.checkedSpecs } : {}
      };
    });`;

const applyEditingReplacement = `    setEditingSite(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        name: prev.name || selectedRefSite.name || '',
        address: prev.address || selectedRefSite.address || '',
        paidOptions: selectedRefSite.paidOptions || '',
        protection: selectedRefSite.protection || '',
        checkedSpecs: selectedRefSite.checkedSpecs ? { ...selectedRefSite.checkedSpecs } : {}
      };
    });`;

c = c.replace(applyEditingTarget, applyEditingReplacement);

fs.writeFileSync('src/pages/Customers.tsx', c);
console.log('Success!');
