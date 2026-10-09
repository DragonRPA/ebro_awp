const fs = require('fs');
let c = fs.readFileSync('src/pages/outbound_inspections.tsx', 'utf8');

// Add siteMasters to context destructuring
c = c.replace(
  /customers,\s*sites,\s*deliveries,/g,
  "customers,\n    sites,\n    siteMasters,\n    deliveries,"
);

// Update getGroupCheckpoints signature
c = c.replace(
  /site: Site \| null \| undefined/g,
  "site: Site | null | undefined,\n  siteMaster: any"
);

// Update inside getGroupCheckpoints
c = c.replace(
  /site\?\.protection/g,
  "siteMaster?.protection"
);
c = c.replace(
  /site\?\.checkedSpecs/g,
  "siteMaster?.checkedSpecs"
);
c = c.replace(
  /site\?\.paidOptions/g,
  "siteMaster?.paidOptions"
);

// Update the call to getGroupCheckpoints
c = c.replace(
  /getGroupCheckpoints\(items, groupAssets, contract, customer, site\)/g,
  "getGroupCheckpoints(items, groupAssets, contract, customer, site, contract ? siteMasters.find(sm => sm.id === site?.siteMasterId) : null)"
);

// Add siteMasters to dependencies
c = c.replace(
  /\[outboundInspections, contracts, customers, sites, assets, deliveries\]/g,
  "[outboundInspections, contracts, customers, sites, siteMasters, assets, deliveries]"
);

fs.writeFileSync('src/pages/outbound_inspections.tsx', c);
console.log('Outbound fixed');
