const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

const hookRegex = /(const \{ items: sortedBillings, requestSort, sortConfig \} = useSortableData\(filteredBillings, \{ key: 'billingYm', direction: 'desc' \}\);\s*\n)/;

if (content.match(hookRegex)) {
  const replacement = `  const enrichedBillings = useMemo(() => {
    return filteredBillings.map(b => {
      const supply = b.totalAmount || 0;
      const vat = Math.round(supply * 0.1);
      const grandTotal = supply + vat;
      const unpaidAmount = b.status === 'PAID' ? 0 : grandTotal - (b.paidAmount || 0);
      const customer = customers.find(c => c.id === b.customerId);
      return {
        ...b,
        customerName: customer ? customer.name : '알 수 없음',
        grandTotal,
        unpaidAmount
      };
    });
  }, [filteredBillings, customers]);

  const { items: sortedBillings, requestSort, sortConfig } = useSortableData(enrichedBillings, { key: 'billingYm', direction: 'desc' });
`;
  content = content.replace(hookRegex, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Added enrichedBillings to Billings.tsx');
} else {
  console.log('Hook regex not matched for enrichedBillings');
}
