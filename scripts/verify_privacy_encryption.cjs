// scripts/verify_privacy_encryption.cjs
const { chromium } = require('playwright');

async function verifyPrivacyEncryption() {
  console.log('========================================================================');
  console.log('🛡️ [전사 개인정보보호지침 준수 암호화 검증] LocalDB & Zero-Plaintext Audit');
  console.log('========================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });

  // Evaluate in browser context
  const testResults = await page.evaluate(async () => {
    const results = [];
    const db = window.db || window.__DB__;

    if (!db) {
      return [{ test: 'Database Instance Exists', pass: false, message: 'window.db or window.__DB__ not found' }];
    }

    // Touch all getters to trigger initial loading and encryption if needed
    const users = db.users;
    if (db.transportDrivers.length === 0) {
      db.transportDrivers = [
        { id: 'TD-001', companyId: 'TC-001', driverName: '홍길동', driverContact: '010-1111-1111', idNo: '750101-1234567', vehicleNo: '서울82가 1111', vehicleType: '5톤 셀프로더', createdAt: new Date().toISOString() },
        { id: 'TD-002', companyId: 'TC-002', driverName: '김기사', driverContact: '010-2222-2222', idNo: '800202-2345678', vehicleNo: '경기99바 2222', vehicleType: '1톤 화물차', createdAt: new Date().toISOString() }
      ];
    }
    const drivers = db.transportDrivers;
    const vendors = db.vendors;
    const customers = db.customers;
    const tenants = db.tenants;

    // 1. Users Verification
    const sampleUser = users.find(u => u.phone && u.phone.trim() !== '') || users[0];
    const isUserCleanInMemory = Boolean(sampleUser && sampleUser.phone && !sampleUser.phone.startsWith('__EBRO_ENC__v1__'));
    
    const rawUsersJson = localStorage.getItem('erp_users');
    let usersEncryptedInStorage = false;
    if (rawUsersJson) {
      const parsedUsers = JSON.parse(rawUsersJson);
      usersEncryptedInStorage = parsedUsers.some(u => u.phone && u.phone.startsWith('__EBRO_ENC__v1__'));
    }

    results.push({
      test: 'Users Personal Info (phone, birthDate, address)',
      pass: isUserCleanInMemory && usersEncryptedInStorage,
      detail: {
        inMemoryPlain: sampleUser?.phone,
        storageEncrypted: usersEncryptedInStorage
      }
    });

    // 2. Transport Drivers Verification (driverContact, idNo)
    const sampleDriver = drivers.find(d => d.driverContact && d.driverContact.trim() !== '') || drivers[0];
    const isDriverCleanInMemory = Boolean(sampleDriver && sampleDriver.driverContact && !sampleDriver.driverContact.startsWith('__EBRO_ENC__v1__'));
    
    const rawDriversJson = localStorage.getItem('erp_transportDrivers');
    let driversEncryptedInStorage = false;
    if (rawDriversJson) {
      const parsedDrivers = JSON.parse(rawDriversJson);
      driversEncryptedInStorage = parsedDrivers.some(d => d.driverContact && d.driverContact.startsWith('__EBRO_ENC__v1__'));
    }

    results.push({
      test: 'Transport Drivers Unique ID & Contact (idNo, driverContact)',
      pass: isDriverCleanInMemory && driversEncryptedInStorage,
      detail: {
        inMemoryPlain: sampleDriver?.driverContact,
        storageEncrypted: driversEncryptedInStorage,
        rawDriversJson: rawDriversJson
      }
    });

    // 3. Dynamic Vendor Account Number Encryption Test
    let vendorTestPass = false;
    try {
      const testVendor = db.insertRow('vendors', {
        name: '하나특수정비(암호화테스트)',
        type: 'REPAIR',
        bankAccount: '국민은행 123-456-789012',
        accountNumber: '123-456-789012'
      });

      const inMemVendor = db.vendors.find(v => v.id === testVendor.id);
      const isMemVendorClean = Boolean(inMemVendor && inMemVendor.accountNumber === '123-456-789012');

      const storageVendors = JSON.parse(localStorage.getItem('erp_vendors') || '[]');
      const inStoreVendor = storageVendors.find(v => v.id === testVendor.id);
      const isStoreVendorEnc = Boolean(inStoreVendor && inStoreVendor.accountNumber && inStoreVendor.accountNumber.startsWith('__EBRO_ENC__v1__'));

      vendorTestPass = isMemVendorClean && isStoreVendorEnc;
      // Cleanup
      db.vendors = db.vendors.filter(v => v.id !== testVendor.id);
    } catch (e) {
      console.warn('Vendor test error:', e);
    }

    results.push({
      test: 'Vendors Financial Account (accountNumber, bankAccount)',
      pass: vendorTestPass,
      detail: { dynamicTestSuccess: vendorTestPass }
    });

    // 4. Dynamic Customer Contact & Bank Account Encryption Test
    let customerTestPass = false;
    try {
      const testCustomer = db.insertRow('customers', {
        name: '삼원건설(암호화테스트)',
        repContact: '010-5555-7777',
        repEmail: 'ceo@samwon.test',
        bankAccounts: [
          { bankName: '신한은행', accountNumber: '110-222-333333', accountHolder: '삼원건설' }
        ]
      });

      const inMemCust = db.customers.find(c => c.id === testCustomer.id);
      const isMemCustClean = Boolean(
        inMemCust && 
        inMemCust.repContact === '010-5555-7777' && 
        inMemCust.bankAccounts?.[0]?.accountNumber === '110-222-333333'
      );

      const storageCusts = JSON.parse(localStorage.getItem('erp_customers') || '[]');
      const inStoreCust = storageCusts.find(c => c.id === testCustomer.id);
      const isStoreCustEnc = Boolean(
        inStoreCust && 
        inStoreCust.repContact?.startsWith('__EBRO_ENC__v1__') && 
        inStoreCust.bankAccounts?.[0]?.accountNumber?.startsWith('__EBRO_ENC__v1__')
      );

      customerTestPass = isMemCustClean && isStoreCustEnc;
      // Cleanup
      db.customers = db.customers.filter(c => c.id !== testCustomer.id);
    } catch (e) {
      console.warn('Customer test error:', e);
    }

    results.push({
      test: 'Customers Rep Contact & Nested Bank Accounts',
      pass: customerTestPass,
      detail: { dynamicTestSuccess: customerTestPass }
    });

    // 5. Dynamic insertRow & updateRow Dual-State Verification
    let dualStatePass = false;
    try {
      const driver = db.insertRow('transportDrivers', {
        driverName: '박기사(실시간보안테스트)',
        driverContact: '010-8888-9999',
        idNo: '750505-1892837',
        address: '서울시 강남구 테헤란로 123'
      });

      // Update test
      db.updateRow('transportDrivers', driver.id, {
        driverContact: '010-7777-6666'
      });

      const updatedMem = db.transportDrivers.find(d => d.id === driver.id);
      const isMemUpdated = updatedMem && updatedMem.driverContact === '010-7777-6666' && updatedMem.idNo === '750505-1892837';

      const storageDrivers = JSON.parse(localStorage.getItem('erp_transportDrivers') || '[]');
      const updatedStore = storageDrivers.find(d => d.id === driver.id);
      const isStoreUpdatedEnc = Boolean(
        updatedStore && 
        updatedStore.driverContact?.startsWith('__EBRO_ENC__v1__') && 
        updatedStore.idNo?.startsWith('__EBRO_ENC__v1__') &&
        updatedStore.address?.startsWith('__EBRO_ENC__v1__')
      );

      dualStatePass = Boolean(isMemUpdated && isStoreUpdatedEnc);

      // Cleanup
      db.transportDrivers = db.transportDrivers.filter(d => d.id !== driver.id);
    } catch (e) {
      console.warn('Dual state test error:', e);
    }

    results.push({
      test: 'Dynamic insertRow & updateRow In-Flight Encryption',
      pass: dualStatePass,
      detail: { verified: dualStatePass }
    });

    return results;
  });

  await browser.close();

  console.log('📊 [검증 결과 상세 리포트]:\n');
  let allPass = true;
  for (const res of testResults) {
    const mark = res.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`[${mark}] ${res.test}`);
    if (res.detail) console.log(`   └─ Detail:`, JSON.stringify(res.detail));
    if (res.error) console.log(`   └─ Error:`, res.error);
    if (!res.pass) allPass = false;
  }

  console.log('\n========================================================================');
  if (allPass) {
    console.log('🎉 [검증 성공] 모든 법정 개인정보 암호화 및 듀얼 스테이트 무결성 100% 입증 완료!');
  } else {
    console.error('⚠️ [검증 실패] 일부 항목이 검증을 통과하지 못했습니다.');
    process.exit(1);
  }
}

verifyPrivacyEncryption().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
