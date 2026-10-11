const fs = require('fs');

const modifications = [
  {
    file: 'src/index.css',
    replacements: [
      { from: 'background-color: white;', to: 'background-color: #fbf9f5;' }
    ]
  },
  {
    file: 'src/mobile/mobile.css',
    replacements: [
      { from: '.bg-white { background-color: #ffffff; }', to: '.bg-white { background-color: #fbf9f5; }' },
      { from: '.bg-white\\/20 { background-color: rgba(255, 255, 255, 0.2) !important; }', to: '.bg-white\\/20 { background-color: rgba(251, 249, 245, 0.2) !important; }' }
    ]
  },
  {
    file: 'src/pages/smart_dispatch4.css',
    replacements: [
      { from: 'background-color: #ffffff !important;', to: 'background-color: #fbf9f5 !important;' }
    ]
  },
  {
    file: 'src/pages/FieldAsManagement.tsx',
    replacements: [
      { from: "backgroundColor: mainTab === 'STUDIO' ? '#ffffff' : 'transparent'", to: "backgroundColor: mainTab === 'STUDIO' ? '#fbf9f5' : 'transparent'" },
      { from: "backgroundColor: mainTab === 'CALENDAR' ? '#ffffff' : 'transparent'", to: "backgroundColor: mainTab === 'CALENDAR' ? '#fbf9f5' : 'transparent'" },
      { from: "backgroundColor: mainTab === 'ANALYTICS' ? '#ffffff' : 'transparent'", to: "backgroundColor: mainTab === 'ANALYTICS' ? '#fbf9f5' : 'transparent'" },
      { from: "backgroundColor: mainTab === 'LEDGER' ? '#ffffff' : 'transparent'", to: "backgroundColor: mainTab === 'LEDGER' ? '#fbf9f5' : 'transparent'" },
      { from: "backgroundColor: mainTab === 'VEHICLE_STOCK' ? '#ffffff' : 'transparent'", to: "backgroundColor: mainTab === 'VEHICLE_STOCK' ? '#fbf9f5' : 'transparent'" }
    ]
  },
  {
    file: 'src/pages/CorporateCardPage.tsx',
    replacements: [
      { from: "backgroundColor: activeSubTab === 'settlement' ? '#fff' : 'transparent'", to: "backgroundColor: activeSubTab === 'settlement' ? '#fbf9f5' : 'transparent'" },
      { from: "backgroundColor: activeSubTab === 'settings' ? '#fff' : 'transparent'", to: "backgroundColor: activeSubTab === 'settings' ? '#fbf9f5' : 'transparent'" }
    ]
  },
  {
    file: 'src/pages/GoogleConfig.tsx',
    replacements: [
      { from: "backgroundColor: smtpProvider !== 'CUSTOM' ? 'var(--bg-app)' : 'white'", to: "backgroundColor: smtpProvider !== 'CUSTOM' ? 'var(--bg-app)' : '#fbf9f5'" }
    ]
  },
  {
    file: 'src/pages/PrivacyAuditPage.tsx',
    replacements: [
      { from: "backgroundColor: '#ffffff',", to: "backgroundColor: '#fbf9f5'," }
    ]
  },
  {
    file: 'src/mobile/pages/MobileAsList.tsx',
    replacements: [
      { from: 'rounded-full bg-white text-red-600', to: 'rounded-full bg-[#fbf9f5] text-red-600' }
    ]
  },
  {
    file: 'src/mobile/pages/MobileInboundRegister.tsx',
    replacements: [
      { from: 'rounded-full bg-white text-rose-600', to: 'rounded-full bg-[#fbf9f5] text-rose-600' }
    ]
  },
  {
    file: 'src/components/BillingInvoiceTab.tsx',
    replacements: [
      { from: 'background-color: #ffffff !important;', to: 'background-color: #fbf9f5 !important;' }
    ]
  },
  {
    file: 'src/components/OtApprovalDocumentModal.tsx',
    replacements: [
      { from: 'background-color: #ffffff !important;', to: 'background-color: #fbf9f5 !important;' },
      { from: 'background: #ffffff !important;', to: 'background: #fbf9f5 !important;' }
    ]
  },
  {
    file: 'src/integrations/giyeonlift/templates/htmlTemplates.ts',
    replacements: [
      { from: 'background-color: #ffffff;', to: 'background-color: #fbf9f5;' }
    ]
  },
  {
    file: 'src/pages/distribution/CourierDispatchPage.tsx',
    replacements: [
      { from: 'background: #fff;', to: 'background: #fbf9f5;' }
    ]
  },
  {
    file: 'src/pages/distribution/TradeOutboundPage.tsx',
    replacements: [
      { from: 'background: #fff;', to: 'background: #fbf9f5;' }
    ]
  },
  {
    file: 'src/pages/OperationManualPage.tsx',
    replacements: [
      { from: 'background-color: #FFFFFF !important;', to: 'background-color: #fbf9f5 !important;' }
    ]
  },
  {
    file: 'src/pages/outbound_inspections.tsx',
    replacements: [
      { from: 'body { background: #fff !important; padding: 0 !important; }', to: 'body { background: #fbf9f5 !important; padding: 0 !important; }' }
    ]
  },
  {
    file: 'src/pages/smart_dispatch4.tsx',
    replacements: [
      { from: 'background-color: #ffffff !important;', to: 'background-color: #fbf9f5 !important;' },
      { from: 'background-color: #ffffff;', to: 'background-color: #fbf9f5;' }
    ]
  },
  {
    file: 'src/pages/smart_return.tsx',
    replacements: [
      { from: 'background-color: #ffffff !important;', to: 'background-color: #fbf9f5 !important;' },
      { from: 'background-color: #ffffff;', to: 'background-color: #fbf9f5;' }
    ]
  },
  {
    file: 'src/pages/TruckDispatch.tsx',
    replacements: [
      { from: 'background-color: #ffffff !important;', to: 'background-color: #fbf9f5 !important;' },
      { from: 'background-color: #ffffff;', to: 'background-color: #fbf9f5;' }
    ]
  },
  {
    file: 'src/pages/voice_dispatch.tsx',
    replacements: [
      { from: 'background-color: #ffffff !important;', to: 'background-color: #fbf9f5 !important;' },
      { from: 'background-color: #ffffff;', to: 'background-color: #fbf9f5;' }
    ]
  },
  {
    file: 'src/utils/receiptGenerator.ts',
    replacements: [
      { from: 'background: #ffffff;', to: 'background: #fbf9f5;' },
      { from: 'background: #ffffff !important;', to: 'background: #fbf9f5 !important;' },
      { from: 'background-color: #ffffff;', to: 'background-color: #fbf9f5;' }
    ]
  },
  {
    file: 'src/pages/LandingPage.tsx',
    replacements: [
      { from: 'bg-white text-slate-900', to: 'bg-[#fbf9f5] text-slate-900' },
      { from: 'bg-white/90', to: 'bg-[#fbf9f5]/90' },
      { from: 'bg-white hover:bg-slate-50', to: 'bg-[#fbf9f5] hover:bg-slate-50' },
      { from: 'bg-white shadow-xl', to: 'bg-[#fbf9f5] shadow-xl' },
      { from: 'bg-white py-12', to: 'bg-[#fbf9f5] py-12' },
      { from: 'bg-white rounded-2xl', to: 'bg-[#fbf9f5] rounded-2xl' },
      { from: '<section id="features" className="py-32 bg-white">', to: '<section id="features" className="py-32 bg-[#fbf9f5]">' }
    ]
  }
];

let totalChanges = 0;

modifications.forEach(mod => {
  if (!fs.existsSync(mod.file)) {
    console.warn(`File not found: ${mod.file}`);
    return;
  }
  let content = fs.readFileSync(mod.file, 'utf8');
  let fileChanges = 0;

  mod.replacements.forEach(rep => {
    let count = 0;
    while (content.includes(rep.from)) {
      content = content.replace(rep.from, rep.to);
      count++;
    }
    if (count > 0) {
      console.log(`  [${mod.file}] Replaced "${rep.from}" -> "${rep.to}" (${count} times)`);
      fileChanges += count;
    } else {
      console.warn(`  [${mod.file}] Pattern not found: "${rep.from}"`);
    }
  });

  if (fileChanges > 0) {
    fs.writeFileSync(mod.file, content, 'utf8');
    totalChanges += fileChanges;
  }
});

console.log(`\n🎉 Total pure white background replacements applied: ${totalChanges}`);
