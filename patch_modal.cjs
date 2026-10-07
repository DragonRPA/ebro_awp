const fs = require('fs');
const content = fs.readFileSync('src/components/ContractDocumentBundleModal.tsx', 'utf8');

const target =   const [selectedContractId, setSelectedContractId] = useState<string>(
    initialContractId || contracts[0]?.id || ''
  );;

const newCode =   const [selectedContractId, setSelectedContractId] = useState<string>(
    initialContractId || contracts[0]?.id || ''
  );

  useEffect(() => {
    if (isOpen && initialContractId) {
      setSelectedContractId(initialContractId);
    }
  }, [isOpen, initialContractId]);;

const newContent = content.replace(target, newCode);
fs.writeFileSync('src/components/ContractDocumentBundleModal.tsx', newContent, 'utf8');
