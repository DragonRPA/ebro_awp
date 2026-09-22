const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /(const \[tempInvoiceFilter, setTempInvoiceFilter\] = useState<'ALL' \| 'STANDALONE' \| 'INTEGRATED'>\('ALL'\);)/;
const match = content.match(regex);
if (match) {
  content = content.replace(regex, `$1\n  const [splitModalOpen, setSplitModalOpen] = useState(false);\n  const [splitTargetId, setSplitTargetId] = useState<string | null>(null);\n  const [splitAmountInput, setSplitAmountInput] = useState<string>('');`);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Added states to Billings.tsx');
} else {
  console.log('Target not found for states');
}
