const fs = require('fs');
let c = fs.readFileSync('src/pages/Customers.tsx', 'utf8');

c = c.replace(
`  const customerSites = useMemo(() => {
    return sites
      .filter(cs => cs.customerId === selectedCustomerId)
      .sort((a, b) => {
        const aActive = a.isActive !== false;
        const bActive = b.isActive !== false;
        if (aActive !== bActive) return aActive ? -1 : 1;
        return a.name.localeCompare(b.name, 'ko');
      });
  }, [sites, siteMasters, selectedCustomerId]);`,
`  const customerSites = useMemo(() => {
    return sites
      .filter(cs => cs.customerId === selectedCustomerId)
      .sort((a, b) => {
        const aMaster = siteMasters.find(sm => sm.id === a.siteMasterId);
        const bMaster = siteMasters.find(sm => sm.id === b.siteMasterId);
        const aActive = aMaster?.isActive !== false;
        const bActive = bMaster?.isActive !== false;
        if (aActive !== bActive) return aActive ? -1 : 1;
        return a.name.localeCompare(b.name, 'ko');
      });
  }, [sites, siteMasters, selectedCustomerId]);`
);

c = c.replace(
`    const activeSites = sites.filter(s => s.isActive !== false).length;`,
`    const activeSites = sites.filter(s => siteMasters.find(sm => sm.id === s.siteMasterId)?.isActive !== false).length;`
);

fs.writeFileSync('src/pages/Customers.tsx', c);
