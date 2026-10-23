const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://idfecoovqkjopgbezcpo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZmVjb292cWtqb3BnYmV6Y3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MzEzODUsImV4cCI6MjEwNTIwNzM4NX0.FnKGWqvA5IZJCqfnjyNU-3W_TljunBVqcse_0V-39No';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('🚀 [awp-demo] 테스트 데이터(자산, 운송사, 배차/묶음배차, 정산대사) 대량 주입 시작...');

  // 1. 누락 제품(SJ4626-DEMO-5452) 등록
  const newProduct = {
    id: 'PROD-DEMO-5452',
    modelName: 'SJ4626-DEMO-5452',
    feet: 26,
    manufacturer: 'SKYJACK',
    spec: '배터리, 9.9 M, 적재 454 kg',
    weight: '2,130 Kg',
    speed: '3.5 Km/h',
    powerSource: '배터리',
    workingHeight: '9.9 M',
    platformHeight: '7.9 M',
    machineDimensions: '2.31 x 1.17 x 2.15 M',
    platformDimensions: '2.13 x 1.07 M',
    gradeability: '25 %',
    capacityPreExt: '454 kg',
    capacityPostExtMain: '318 kg',
    capacityPostExtDeck: '136 kg',
    maxWindSpeed: '12.5 m/s 이내',
    asContact: '031-355-8899',
    isActive: true,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-23T00:00:00Z',
    tenant_id: 'giyeun',
    shortName: 'SJ4626'
  };
  {
    const { error } = await supabase.from('products').upsert([newProduct], { onConflict: 'id' });
    if (error) console.error('Product upsert error:', error.message);
    else console.log('✅ 제품 추가/갱신 완료: SJ4626-DEMO-5452');
  }

  // 2. 원사(전대 공급처) 및 운송 거래처 vendors 등록
  const demoVendors = [
    {
      id: 'VEND-SUB-01',
      name: '한국렌탈협동',
      type: 'PURCHASE',
      types: '외부임차 원사',
      bizRegNo: '128-81-55112',
      representative: '김원사',
      contactName: '김원사 대표',
      contact: '031-352-9001',
      address: '경기도 화성시 팔탄면 시청로 880',
      bankName: '기업은행',
      accountNumber: '110-445-889900',
      accountHolder: '한국렌탈협동',
      isActive: true,
      businessStatus: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'VEND-SUB-02',
      name: '중부고소장비',
      type: 'PURCHASE',
      types: '외부임차 원사',
      bizRegNo: '312-86-77441',
      representative: '박중부',
      contactName: '박중부 소장',
      contact: '031-654-3321',
      address: '경기도 평택시 안중읍 서해로 1120',
      bankName: '국민은행',
      accountNumber: '442101-04-119988',
      accountHolder: '중부고소장비',
      isActive: true,
      businessStatus: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'VEND-TR-GYEONGGI',
      name: '경기화물운송',
      type: 'TRANSPORT',
      types: '운송사',
      bizRegNo: '124-86-11223',
      representative: '김경기',
      contactName: '김경기 배차실장',
      contact: '031-355-7700',
      address: '경기도 화성시 남양읍 남양로 210',
      bankName: '기업은행',
      accountNumber: '042-112233-01-015',
      accountHolder: '경기화물운송(주)',
      isActive: true,
      businessStatus: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'VEND-TR-LJ',
      name: '엘제이운송',
      type: 'TRANSPORT',
      types: '운송사',
      bizRegNo: '135-81-88990',
      representative: '이엘제이',
      contactName: '이팀장',
      contact: '031-681-4455',
      address: '경기도 평택시 포승읍 포승공단로 55',
      bankName: '신한은행',
      accountNumber: '110-339-778899',
      accountHolder: '엘제이운송',
      isActive: true,
      businessStatus: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'VEND-TR-JAIN',
      name: '자인운송',
      type: 'TRANSPORT',
      types: '운송사',
      bizRegNo: '214-87-66554',
      representative: '최자인',
      contactName: '최소장',
      contact: '031-339-9988',
      address: '경기도 용인시 처인구 백암면 고안로 12',
      bankName: '농협',
      accountNumber: '301-0229-4455-11',
      accountHolder: '자인운송(엠제이)',
      isActive: true,
      businessStatus: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      tenant_id: 'giyeun'
    }
  ];
  {
    const { error } = await supabase.from('vendors').upsert(demoVendors, { onConflict: 'id' });
    if (error) console.error('Vendors upsert error:', error.message);
    else console.log('✅ 원사 및 운송 거래처(vendors) 5곳 등록 완료');
  }

  // 3. 운송사(transport_companies) 및 소속 기사(transport_drivers) 등록
  const demoTransportCompanies = [
    {
      id: 'TCOM-GYEONGGI',
      name: '경기화물운송',
      businessNo: '124-86-11223',
      contact: '031-355-7700',
      bankName: '기업은행',
      bankAccount: '042-112233-01-015',
      bankHolder: '경기화물운송(주)',
      memo: '주력 운송사 (월말 운송료 대사 1순위)',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'TCOM-LJ',
      name: '엘제이운송',
      businessNo: '135-81-88990',
      contact: '031-681-4455',
      bankName: '신한은행',
      bankAccount: '110-339-778899',
      bankHolder: '엘제이운송',
      memo: '평택/송도/남부권 전담 운송사',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'TCOM-JAIN',
      name: '자인운송',
      businessNo: '214-87-66554',
      contact: '031-339-9988',
      bankName: '농협',
      bankAccount: '301-0229-4455-11',
      bankHolder: '자인운송(엠제이)',
      memo: '용인/이천/동부권 및 중대형 셀프/추레라 전담',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      tenant_id: 'giyeun'
    }
  ];
  {
    const { error } = await supabase.from('transport_companies').upsert(demoTransportCompanies, { onConflict: 'id' });
    if (error) console.error('TransportCompanies upsert error:', error.message);
    else console.log('✅ 운송사(transport_companies) 3곳 등록 완료 (경기화물운송, 엘제이운송, 자인운송)');
  }

  const demoDrivers = [
    {
      id: 'TDRV-GG-01',
      companyId: 'TCOM-GYEONGGI',
      driverName: '김철수',
      driverContact: '010-9101-1122',
      vehicleNo: '경기88바 1234',
      vehicleType: '5T',
      vehicleColor: '흰색',
      birthDate: '1978-05-12',
      address: '경기도 화성시 남양읍',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'TDRV-GG-02',
      companyId: 'TCOM-GYEONGGI',
      driverName: '박영수',
      driverContact: '010-9102-3344',
      vehicleNo: '경기89사 5678',
      vehicleType: '5T 축차',
      vehicleColor: '청색',
      birthDate: '1975-09-20',
      address: '경기도 안산시 단원구',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'TDRV-GG-03',
      companyId: 'TCOM-GYEONGGI',
      driverName: '이민호',
      driverContact: '010-9103-5566',
      vehicleNo: '경기82아 9012',
      vehicleType: '3.5T',
      vehicleColor: '흰색',
      birthDate: '1982-02-14',
      address: '경기도 수원시 권선구',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'TDRV-GG-04',
      companyId: 'TCOM-GYEONGGI',
      driverName: '정우성',
      driverContact: '010-9104-7788',
      vehicleNo: '경기91자 3456',
      vehicleType: '2.5T 셀프',
      vehicleColor: '노란색',
      birthDate: '1980-11-03',
      address: '경기도 화성시 향남읍',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'TDRV-LJ-01',
      companyId: 'TCOM-LJ',
      driverName: '최동훈',
      driverContact: '010-8201-2233',
      vehicleNo: '인천83바 7788',
      vehicleType: '5T',
      vehicleColor: '흰색',
      birthDate: '1979-07-19',
      address: '인천광역시 연수구 송도동',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'TDRV-LJ-02',
      companyId: 'TCOM-LJ',
      driverName: '강백호',
      driverContact: '010-8202-4455',
      vehicleNo: '경기85자 4321',
      vehicleType: '5T 축차',
      vehicleColor: '은색',
      birthDate: '1984-04-05',
      address: '경기도 평택시 고덕동',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'TDRV-JAIN-01',
      companyId: 'TCOM-JAIN',
      driverName: '윤태영',
      driverContact: '010-7301-6677',
      vehicleNo: '경기95바 8899',
      vehicleType: '11T 윙바디',
      vehicleColor: '청색',
      birthDate: '1973-12-01',
      address: '경기도 용인시 처인구',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'TDRV-JAIN-02',
      companyId: 'TCOM-JAIN',
      driverName: '조진웅',
      driverContact: '010-7302-8899',
      vehicleNo: '경기86사 1199',
      vehicleType: '5T',
      vehicleColor: '흰색',
      birthDate: '1976-03-22',
      address: '경기도 이천시 부발읍',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      tenant_id: 'giyeun'
    }
  ];
  {
    const { error } = await supabase.from('transport_drivers').upsert(demoDrivers, { onConflict: 'id' });
    if (error) console.error('TransportDrivers upsert error:', error.message);
    else console.log('✅ 운송 기사(transport_drivers) 8명 등록 완료');
  }

  // 4. 풍부한 실물 자산(자사 OWNED + 임차 RENTED) 105대 생성
  // 기존에 입력된 모든 출고 요청 모델:
  // GS-1930 (다수), SJ4626-DEMO-5452, SJ3219 (다수), JCPT0807AC, 1230ES (다수), SJ3215, SJ3226, OPTIMUM 8
  // + 신규 의뢰용 주요 모델(GS-2646, GS-3246, GS-1432, GS-1930 E-DRIVE, 1930ES, ES2646, 4069LE, JCPT1008AC, JCPT1212AC, S0807AC+, S1012AC+, S1212E, GTJZ0808E, GTJZ1012E, SR1623E 등)
  const assetSpecs = [
    { modelName: 'GS-1930', manufacturer: 'GENIE', ownedCount: 10, rentedCount: 3, monthlyFee: 400000, dailyFee: 15000, rentMonthly: 250000, rentDaily: 10000, price: 21000000, prefix: 'GS19' },
    { modelName: 'GS-1930 E-DRIVE', manufacturer: 'GENIE', ownedCount: 5, rentedCount: 1, monthlyFee: 420000, dailyFee: 16000, rentMonthly: 260000, rentDaily: 10000, price: 22500000, prefix: 'GS19E' },
    { modelName: 'GS-1432', manufacturer: 'GENIE', ownedCount: 4, rentedCount: 1, monthlyFee: 380000, dailyFee: 14000, rentMonthly: 230000, rentDaily: 9000, price: 19000000, prefix: 'GS14' },
    { modelName: 'GS-2646', manufacturer: 'GENIE', ownedCount: 6, rentedCount: 2, monthlyFee: 500000, dailyFee: 20000, rentMonthly: 320000, rentDaily: 12000, price: 28000000, prefix: 'GS26' },
    { modelName: 'GS-3246', manufacturer: 'GENIE', ownedCount: 6, rentedCount: 2, monthlyFee: 600000, dailyFee: 25000, rentMonthly: 380000, rentDaily: 15000, price: 32000000, prefix: 'GS32' },
    { modelName: 'GS-4047', manufacturer: 'GENIE', ownedCount: 3, rentedCount: 1, monthlyFee: 750000, dailyFee: 30000, rentMonthly: 480000, rentDaily: 18000, price: 42000000, prefix: 'GS40' },
    { modelName: 'SJ3215', manufacturer: 'SKYJACK', ownedCount: 5, rentedCount: 1, monthlyFee: 380000, dailyFee: 14000, rentMonthly: 230000, rentDaily: 9000, price: 19500000, prefix: 'SJ15' },
    { modelName: 'SJ3219', manufacturer: 'SKYJACK', ownedCount: 8, rentedCount: 2, monthlyFee: 400000, dailyFee: 15000, rentMonthly: 250000, rentDaily: 10000, price: 21500000, prefix: 'SJ19' },
    { modelName: 'SJ3226', manufacturer: 'SKYJACK', ownedCount: 5, rentedCount: 2, monthlyFee: 500000, dailyFee: 20000, rentMonthly: 320000, rentDaily: 12000, price: 27500000, prefix: 'SJ26' },
    { modelName: 'SJ4626-DEMO-5452', manufacturer: 'SKYJACK', ownedCount: 4, rentedCount: 1, monthlyFee: 500000, dailyFee: 20000, rentMonthly: 320000, rentDaily: 12000, price: 28000000, prefix: 'SJ46' },
    { modelName: '1230ES', manufacturer: 'JLG', ownedCount: 6, rentedCount: 2, monthlyFee: 380000, dailyFee: 14000, rentMonthly: 230000, rentDaily: 9000, price: 18500000, prefix: 'JL12' },
    { modelName: '1930ES', manufacturer: 'JLG', ownedCount: 5, rentedCount: 1, monthlyFee: 400000, dailyFee: 15000, rentMonthly: 250000, rentDaily: 10000, price: 21000000, prefix: 'JL19' },
    { modelName: 'ES2646', manufacturer: 'JLG', ownedCount: 4, rentedCount: 1, monthlyFee: 500000, dailyFee: 20000, rentMonthly: 320000, rentDaily: 12000, price: 28500000, prefix: 'JL26' },
    { modelName: '4069LE', manufacturer: 'JLG', ownedCount: 2, rentedCount: 1, monthlyFee: 850000, dailyFee: 35000, rentMonthly: 550000, rentDaily: 22000, price: 48000000, prefix: 'JL40' },
    { modelName: 'JCPT0807AC', manufacturer: 'DINGLI', ownedCount: 6, rentedCount: 2, monthlyFee: 400000, dailyFee: 15000, rentMonthly: 240000, rentDaily: 9500, price: 19500000, prefix: 'DL08' },
    { modelName: 'JCPT1008AC', manufacturer: 'DINGLI', ownedCount: 4, rentedCount: 1, monthlyFee: 500000, dailyFee: 20000, rentMonthly: 300000, rentDaily: 11500, price: 25000000, prefix: 'DL10' },
    { modelName: 'JCPT1212AC', manufacturer: 'DINGLI', ownedCount: 3, rentedCount: 1, monthlyFee: 600000, dailyFee: 24000, rentMonthly: 360000, rentDaily: 14000, price: 31000000, prefix: 'DL12' },
    { modelName: 'S0807AC+', manufacturer: 'DINGLI', ownedCount: 4, rentedCount: 1, monthlyFee: 400000, dailyFee: 15000, rentMonthly: 240000, rentDaily: 9500, price: 20000000, prefix: 'S08' },
    { modelName: 'S1012AC+', manufacturer: 'DINGLI', ownedCount: 4, rentedCount: 1, monthlyFee: 580000, dailyFee: 23000, rentMonthly: 350000, rentDaily: 13500, price: 29500000, prefix: 'S10' },
    { modelName: 'OPTIMUM 8', manufacturer: 'HAULOTTE', ownedCount: 4, rentedCount: 1, monthlyFee: 400000, dailyFee: 15000, rentMonthly: 240000, rentDaily: 9500, price: 20500000, prefix: 'OP08' },
    { modelName: 'GTJZ0808E', manufacturer: 'SINOBOOM', ownedCount: 4, rentedCount: 1, monthlyFee: 480000, dailyFee: 19000, rentMonthly: 290000, rentDaily: 11000, price: 24000000, prefix: 'SB08' },
    { modelName: 'S1212E', manufacturer: 'LGMG', ownedCount: 3, rentedCount: 1, monthlyFee: 620000, dailyFee: 25000, rentMonthly: 380000, rentDaily: 14500, price: 32000000, prefix: 'LG12' }
  ];

  const generatedAssets = [];
  let seq = 101;
  for (const spec of assetSpecs) {
    // 자사 보유 자산 (OWNED, AVAILABLE)
    for (let i = 1; i <= spec.ownedCount; i++) {
      const idNum = String(seq++).padStart(4, '0');
      generatedAssets.push({
        id: `ASSET-DEMO-${idNum}`,
        assetNo: `KL-${spec.prefix}-${String(i).padStart(2, '0')}`,
        vendorAssetNo: null,
        serialNo: `SN-${spec.prefix}-2025${String(i).padStart(3, '0')}`,
        modelName: spec.modelName,
        manufacturer: spec.manufacturer,
        manufactureYear: i % 2 === 0 ? '2025' : '2024',
        ownerType: 'OWNED',
        vendorId: null,
        supplier: spec.manufacturer,
        rentStart: null,
        rentEnd: null,
        actualRentReturnDate: null,
        monthlyRentFee: 0,
        dailyRentFee: 0,
        maintenanceScore: 0,
        billingDay: null,
        monthlyRentalFee: spec.monthlyFee,
        dailyRentalFee: spec.dailyFee,
        renter: null,
        disposalDate: null,
        disposalPrice: null,
        buyer: null,
        memo1: '정상 가동 가능 (정기점검 완료)',
        memo2: '',
        safetyInspectionUrl: '',
        preDeliveryChecklistUrl: null,
        fullDefectSummary: null,
        currentCustomerId: null,
        currentSiteId: null,
        contractStart: null,
        contractEnd: null,
        acquisitionDate: '2025-03-15',
        acquisitionPrice: spec.price,
        depreciationMonths: 96,
        residualValueRate: 10,
        accumDepreciation: 0,
        bookValue: spec.price,
        cumRentalFee: 1200000,
        cumRepairCost: 0,
        status: 'AVAILABLE',
        memo: '출고 대기 (주기장 보관)',
        note: null,
        createdAt: '2026-01-10T00:00:00Z',
        updatedAt: '2026-10-20T00:00:00Z',
        tenant_id: 'giyeun',
        antiEntrapmentOwnership: 'OWNED'
      });
    }

    // 외부 임차 자산 (RENTED, AVAILABLE)
    for (let j = 1; j <= spec.rentedCount; j++) {
      const idNum = String(seq++).padStart(4, '0');
      const isVendor1 = j % 2 === 1;
      generatedAssets.push({
        id: `ASSET-DEMO-${idNum}`,
        assetNo: `SUB-${spec.prefix}-${String(j).padStart(2, '0')}`,
        vendorAssetNo: `VR-${spec.prefix}-${100 + j}`,
        serialNo: `SN-SUB-${spec.prefix}-${String(j).padStart(3, '0')}`,
        modelName: spec.modelName,
        manufacturer: spec.manufacturer,
        manufactureYear: '2024',
        ownerType: 'RENTED',
        vendorId: isVendor1 ? 'VEND-SUB-01' : 'VEND-SUB-02',
        supplier: isVendor1 ? '한국렌탈협동' : '중부고소장비',
        rentStart: '2026-09-01',
        rentEnd: '2026-12-31',
        actualRentReturnDate: null,
        monthlyRentFee: spec.rentMonthly,
        dailyRentFee: spec.rentDaily,
        maintenanceScore: 0,
        billingDay: 25,
        monthlyRentalFee: spec.monthlyFee,
        dailyRentalFee: spec.dailyFee,
        renter: isVendor1 ? '한국렌탈협동' : '중부고소장비',
        disposalDate: null,
        disposalPrice: null,
        buyer: null,
        memo1: `외부임차 원사: ${isVendor1 ? '한국렌탈협동' : '중부고소장비'}`,
        memo2: '',
        safetyInspectionUrl: '',
        preDeliveryChecklistUrl: null,
        fullDefectSummary: null,
        currentCustomerId: null,
        currentSiteId: null,
        contractStart: null,
        contractEnd: null,
        acquisitionDate: null,
        acquisitionPrice: 0,
        depreciationMonths: 0,
        residualValueRate: 0,
        accumDepreciation: 0,
        bookValue: 0,
        cumRentalFee: 400000,
        cumRepairCost: 0,
        status: 'AVAILABLE',
        memo: '전대 임차장비 (즉시 출고 가능)',
        note: null,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-10-20T00:00:00Z',
        tenant_id: 'giyeun',
        antiEntrapmentOwnership: 'VENDOR'
      });
    }
  }

  // 기존 묶음배차 테스트건 및 운송료 대사용 전용 자산들 추가 생성
  const specialAssets = [
    // DLV-0000003 (CONTR-0000002, CAST-0000002, GS-1930)에 할당할 자산
    {
      id: 'ASSET-BND-001',
      assetNo: 'KL-GS19-81',
      serialNo: 'SN-GS19-8801',
      modelName: 'GS-1930',
      manufacturer: 'GENIE',
      manufactureYear: '2025',
      ownerType: 'OWNED',
      supplier: 'GENIE',
      monthlyRentFee: 0,
      dailyRentFee: 0,
      maintenanceScore: 0,
      monthlyRentalFee: 400000,
      dailyRentalFee: 15000,
      currentCustomerId: 'CUST-0000008',
      currentSiteId: 'SITE-0000003',
      contractStart: '2026-10-18',
      acquisitionDate: '2025-02-01',
      acquisitionPrice: 21000000,
      depreciationMonths: 96,
      residualValueRate: 10,
      accumDepreciation: 0,
      bookValue: 21000000,
      cumRentalFee: 400000,
      cumRepairCost: 0,
      status: 'RENTED',
      memo: '묶음배차 BND-261023-386 1순위 출고검수 완료',
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-10-23T00:00:00Z',
      tenant_id: 'giyeun'
    },
    // DLV-0000010 (CONTR-0000009, CAST-0000012, 1230ES)에 할당할 자산
    {
      id: 'ASSET-BND-002',
      assetNo: 'KL-JL12-82',
      serialNo: 'SN-JL12-8802',
      modelName: '1230ES',
      manufacturer: 'JLG',
      manufactureYear: '2025',
      ownerType: 'OWNED',
      supplier: 'JLG',
      monthlyRentFee: 0,
      dailyRentFee: 0,
      maintenanceScore: 0,
      monthlyRentalFee: 400000,
      dailyRentalFee: 15000,
      currentCustomerId: 'CUST-0000019',
      currentSiteId: 'SITE-0000014',
      contractStart: '2026-10-20',
      acquisitionDate: '2025-02-01',
      acquisitionPrice: 18500000,
      depreciationMonths: 96,
      residualValueRate: 10,
      accumDepreciation: 0,
      bookValue: 18500000,
      cumRentalFee: 400000,
      cumRepairCost: 0,
      status: 'RENTED',
      memo: '묶음배차 BND-261023-417 1순위 출고검수 완료',
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-10-23T00:00:00Z',
      tenant_id: 'giyeun'
    }
  ];

  // 대량 자산 Upsert
  const allAssetsToUpsert = [...generatedAssets, ...specialAssets];
  for (let i = 0; i < allAssetsToUpsert.length; i += 50) {
    const chunk = allAssetsToUpsert.slice(i, i + 50);
    const { error } = await supabase.from('assets').upsert(chunk, { onConflict: 'id' });
    if (error) console.error('Assets upsert error:', error.message);
  }
  console.log(`✅ 자산(assets) ${allAssetsToUpsert.length}대 추가 등록 완료 (자사 OWNED + 외부임차 RENTED 포함)`);

  // 5. 기존 묶음배차 테스트 건(BND-261023-386: DLV-0000003 + DLV-0000011, BND-261023-417: DLV-0000010 + DLV-0000008)이
  // 즉시 [상차완료] ➔ [운송완료] 가능하도록 체결자산 및 출고검수(COMPLETED) 상태 보강!
  // 또한 DLV-0000001이 계약 연결이 없던 부분도 CONTR-0000003이나 자체 계약으로 연결해 장비 할당이 가능하도록 보완
  await supabase.from('assets').update({ status: 'RENTED' }).eq('id', 'ASSET-0000005');
  await supabase.from('contract_assets').update({ assetId: 'ASSET-BND-001', status: 'RENTED' }).eq('id', 'CAST-0000002');
  await supabase.from('contract_assets').update({ assetId: 'ASSET-BND-002', status: 'RENTED' }).eq('id', 'CAST-0000012');
  await supabase.from('contract_assets').update({ status: 'RENTED' }).eq('id', 'CAST-0000013');

  // OIN-0000006 (DLV-0000011)을 COMPLETED로 전환 + DLV-0000003, DLV-0000010용 PDI COMPLETED 레코드 추가
  const pdiUpserts = [
    {
      id: 'OIN-0000006',
      contractId: 'CONTR-0000006',
      contractAssetId: 'CAST-0000013',
      assetId: 'ASSET-0000005',
      status: 'COMPLETED',
      specsJson: JSON.stringify({
        checkpoints: [
          { id: 'model_OIN-0000006', label: '모델 확인: 계약 요구 SJ3215 ↔ 실출고 SJ3215', type: 'MODEL', checked: true },
          { id: 'paid_0', label: '[유상옵션] 상부감지센서 장착 확인', type: 'OPTION', checked: true }
        ],
        inspectionNote: '정상 출고 승인',
        inspectorName: '이정용',
        approvedAt: '2026-10-22T09:30:00.000Z'
      }),
      deliveryId: 'DLV-0000011',
      inspectedAt: '2026-10-22T09:30:00.000Z',
      approvedAt: '2026-10-22T09:30:00.000Z',
      note: '[검수완료 2/2항목 합격]',
      createdAt: '2026-10-21T23:47:08.197Z',
      updatedAt: '2026-10-22T09:30:00.000Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'OIN-BND-0003',
      contractId: 'CONTR-0000002',
      contractAssetId: 'CAST-0000002',
      assetId: 'ASSET-BND-001',
      status: 'COMPLETED',
      specsJson: JSON.stringify({
        checkpoints: [
          { id: 'model_OIN-BND-0003', label: '모델 확인: 계약 요구 GS-1930 ↔ 실출고 GS-1930', type: 'MODEL', checked: true }
        ],
        inspectionNote: '묶음배차 1순위 검수 완료',
        inspectorName: '이정용',
        approvedAt: '2026-10-23T05:00:00.000Z'
      }),
      deliveryId: 'DLV-0000003',
      inspectedAt: '2026-10-23T05:00:00.000Z',
      approvedAt: '2026-10-23T05:00:00.000Z',
      note: '[검수완료 1/1항목 합격]',
      createdAt: '2026-10-23T05:00:00.000Z',
      updatedAt: '2026-10-23T05:00:00.000Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'OIN-BND-0010',
      contractId: 'CONTR-0000009',
      contractAssetId: 'CAST-0000012',
      assetId: 'ASSET-BND-002',
      status: 'COMPLETED',
      specsJson: JSON.stringify({
        checkpoints: [
          { id: 'model_OIN-BND-0010', label: '모델 확인: 계약 요구 1230ES ↔ 실출고 1230ES', type: 'MODEL', checked: true }
        ],
        inspectionNote: '묶음배차 1순위 검수 완료',
        inspectorName: '이정용',
        approvedAt: '2026-10-23T05:05:00.000Z'
      }),
      deliveryId: 'DLV-0000010',
      inspectedAt: '2026-10-23T05:05:00.000Z',
      approvedAt: '2026-10-23T05:05:00.000Z',
      note: '[검수완료 1/1항목 합격]',
      createdAt: '2026-10-23T05:05:00.000Z',
      updatedAt: '2026-10-23T05:05:00.000Z',
      tenant_id: 'giyeun'
    }
  ];
  await supabase.from('outbound_inspections').upsert(pdiUpserts, { onConflict: 'id' });

  // DLV-0000003 및 DLV-0000011, DLV-0000010에 assetIds 반영 및 시간대 순수 한국어 교정
  await supabase.from('deliveries').update({
    assetIds: ['ASSET-BND-001'],
    loadingTimeSlot: '최우선',
    transportCompany: '경기화물운송',
    driverName: '김철수',
    driverContact: '010-9101-1122',
    vehicleNo: '경기88바 1234',
    vehicleType: '5T'
  }).eq('id', 'DLV-0000003');

  await supabase.from('deliveries').update({
    assetIds: ['ASSET-0000005'],
    transportCompany: '경기화물운송',
    driverName: '김철수',
    driverContact: '010-9101-1122',
    vehicleNo: '경기88바 1234',
    vehicleType: '5T'
  }).eq('id', 'DLV-0000011');

  await supabase.from('deliveries').update({
    assetIds: ['ASSET-BND-002'],
    loadingTimeSlot: '최우선',
    transportCompany: '경기화물운송',
    driverName: '정우성',
    driverContact: '010-9104-7788',
    vehicleNo: '경기91자 3456',
    vehicleType: '2.5T 셀프'
  }).eq('id', 'DLV-0000010');

  await supabase.from('deliveries').update({
    assetIds: ['ASSET-0000006', 'ASSET-0000007'],
    transportCompany: '경기화물운송',
    driverName: '정우성',
    driverContact: '010-9104-7788',
    vehicleNo: '경기91자 3456',
    vehicleType: '2.5T 셀프'
  }).eq('id', 'DLV-0000008');

  // DLV-0000002, DLV-0000004, DLV-0000005의 loadingTimeSlot 'ASAP' -> '최우선' 정화 및 DLV-0000001에 계약 연결(CONTR-0000003)
  await supabase.from('deliveries').update({ loadingTimeSlot: '최우선', unloadingTimeSlot: '오전' }).in('id', ['DLV-0000002', 'DLV-0000004', 'DLV-0000005']);

  // DLV-0000001을 위한 체결자산 CAST-DEMO-5452 생성 후 CONTR-0000003에 연결
  await supabase.from('contract_assets').upsert([{
    id: 'CAST-DEMO-5452',
    contractId: 'CONTR-0000003',
    assetId: null,
    expectedModel: 'SJ4626-DEMO-5452',
    monthlyRentalFee: 500000,
    dailyRentalFee: 20000,
    salePrice: 0,
    startDate: '2026-10-18',
    endDate: '',
    status: 'ASSIGNED',
    createdAt: '2026-10-18T00:00:00Z',
    updatedAt: '2026-10-18T00:00:00Z',
    tenant_id: 'giyeun'
  }], { onConflict: 'id' });
  await supabase.from('deliveries').update({
    contractId: 'CONTR-0000003',
    cargoItems: JSON.stringify([{ modelName: 'SJ4626-DEMO-5452', count: 1, contractAssetIds: ['CAST-DEMO-5452'] }])
  }).eq('id', 'DLV-0000001');

  // 6. 실감나는 고객사/현장 추가 등록 (운송료 대사 시 현장명/고객사명이 직관적으로 보이도록)
  const reconCustomers = [
    { id: 'CUST-RECON-01', name: '삼성물산 건설부문', bizRegNo: '104-81-11001', representative: '오세철', repContact: '02-2145-5114', address: '서울특별시 강동구 상일로 6길 26', transactionStatus: 'ALLOWED', businessStatus: 'ACTIVE', isClosed: false, prepaidBalance: 0, defaultBillingDay: 30, defaultStatementClosingDay: 25, paymentDueDay: 15, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', tenant_id: 'giyeun' },
    { id: 'CUST-RECON-02', name: '현대엔지니어링', bizRegNo: '101-81-22002', representative: '홍현성', repContact: '02-2134-1114', address: '서울특별시 종로구 율곡로 75', transactionStatus: 'ALLOWED', businessStatus: 'ACTIVE', isClosed: false, prepaidBalance: 0, defaultBillingDay: 30, defaultStatementClosingDay: 25, paymentDueDay: 25, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', tenant_id: 'giyeun' },
    { id: 'CUST-RECON-03', name: '지에스건설', bizRegNo: '104-81-33003', representative: '허윤홍', repContact: '02-2154-1114', address: '서울특별시 종로구 종로 33', transactionStatus: 'ALLOWED', businessStatus: 'ACTIVE', isClosed: false, prepaidBalance: 0, defaultBillingDay: 30, defaultStatementClosingDay: 25, paymentDueDay: 15, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', tenant_id: 'giyeun' },
    { id: 'CUST-RECON-04', name: '포스코이앤씨', bizRegNo: '506-81-44004', representative: '전중선', repContact: '032-748-2114', address: '인천광역시 연수구 인천타워대로 241', transactionStatus: 'ALLOWED', businessStatus: 'ACTIVE', isClosed: false, prepaidBalance: 0, defaultBillingDay: 30, defaultStatementClosingDay: 25, paymentDueDay: 25, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', tenant_id: 'giyeun' },
    { id: 'CUST-RECON-05', name: '대우건설', bizRegNo: '104-81-55005', representative: '백정완', repContact: '02-2288-3114', address: '서울특별시 중구 을지로 170', transactionStatus: 'ALLOWED', businessStatus: 'ACTIVE', isClosed: false, prepaidBalance: 0, defaultBillingDay: 30, defaultStatementClosingDay: 25, paymentDueDay: 15, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', tenant_id: 'giyeun' },
    { id: 'CUST-RECON-06', name: '에스케이에코플랜트', bizRegNo: '101-81-66006', representative: '김형근', repContact: '02-3700-7114', address: '서울특별시 종로구 인사동 5길 25', transactionStatus: 'ALLOWED', businessStatus: 'ACTIVE', isClosed: false, prepaidBalance: 0, defaultBillingDay: 30, defaultStatementClosingDay: 25, paymentDueDay: 25, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', tenant_id: 'giyeun' }
  ];
  {
    const { error } = await supabase.from('customers').upsert(reconCustomers, { onConflict: 'id' });
    if (error) console.error('Customers upsert error:', error.message);
    else console.log('✅ 고객사(customers) 6곳 등록 완료');
  }

  const reconSites = [
    { id: 'SITE-RECON-01', customerId: 'CUST-RECON-01', name: '평택 고덕 반도체 P4 신축현장', address: '경기도 평택시 고덕면 고덕국제대로 77', contactName: '김평택 소장', contact: '010-3311-0001', isActive: true, paidOptions: '상부감지센서, 경광등', protection: '바퀴커버', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', tenant_id: 'giyeun' },
    { id: 'SITE-RECON-02', customerId: 'CUST-RECON-02', name: '화성 동탄 물류센터 신축현장', address: '경기도 화성시 동탄면 동탄산단로 120', contactName: '이동탄 소장', contact: '010-3311-0002', isActive: true, paidOptions: '과상승방지봉', protection: '하부누유방지포', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', tenant_id: 'giyeun' },
    { id: 'SITE-RECON-03', customerId: 'CUST-RECON-03', name: '인천 송도 바이오클러스터 2공구', address: '인천광역시 연수구 송도동 첨단대로 305', contactName: '박송도 소장', contact: '010-3311-0003', isActive: true, paidOptions: '협착방지대', protection: '바퀴커버', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', tenant_id: 'giyeun' },
    { id: 'SITE-RECON-04', customerId: 'CUST-RECON-04', name: '용인 원삼 반도체클러스터 1공구', address: '경기도 용인시 처인구 원삼면 죽능리 500', contactName: '최용인 소장', contact: '010-3311-0004', isActive: true, paidOptions: '상부감지센서', protection: '없음', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', tenant_id: 'giyeun' },
    { id: 'SITE-RECON-05', customerId: 'CUST-RECON-05', name: '수원 광교 데이터센터 현장', address: '경기도 수원시 영통구 광교중앙로 240', contactName: '정수원 소장', contact: '010-3311-0005', isActive: true, paidOptions: '없음', protection: '바퀴커버', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', tenant_id: 'giyeun' },
    { id: 'SITE-RECON-06', customerId: 'CUST-RECON-06', name: '이천 하이닉스 M16 증설현장', address: '경기도 이천시 부발읍 경충대로 2091', contactName: '강이천 소장', contact: '010-3311-0006', isActive: true, paidOptions: '상부감지센서, 소화기', protection: '하부누유방지포', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', tenant_id: 'giyeun' }
  ];
  {
    const { error } = await supabase.from('customer_sites').upsert(reconSites, { onConflict: 'id' });
    if (error) console.error('Sites upsert error:', error.message);
    else console.log('✅ 고객현장(customer_sites) 6곳 등록 완료');
  }

  const reconContracts = [
    { id: 'CONTR-RECON-01', contractNo: 'C2610-R001', contractType: 'RENTAL', customerId: 'CUST-RECON-01', salespersonId: 'u-sales', siteId: 'SITE-RECON-01', startDate: '2026-10-02', endDate: '', billingDay: 30, statementClosingDay: 25, paymentDueDay: 15, status: 'ACTIVE', freightBillingStandard: '3/5', createdAt: '2026-10-02T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z', tenant_id: 'giyeun' },
    { id: 'CONTR-RECON-02', contractNo: 'C2610-R002', contractType: 'RENTAL', customerId: 'CUST-RECON-02', salespersonId: 'u-sales', siteId: 'SITE-RECON-02', startDate: '2026-10-05', endDate: '', billingDay: 30, statementClosingDay: 25, paymentDueDay: 25, status: 'ACTIVE', freightBillingStandard: '3/5', createdAt: '2026-10-05T00:00:00Z', updatedAt: '2026-10-05T00:00:00Z', tenant_id: 'giyeun' },
    { id: 'CONTR-RECON-03', contractNo: 'C2610-R003', contractType: 'RENTAL', customerId: 'CUST-RECON-03', salespersonId: 'u-sales', siteId: 'SITE-RECON-03', startDate: '2026-10-08', endDate: '', billingDay: 30, statementClosingDay: 25, paymentDueDay: 15, status: 'ACTIVE', freightBillingStandard: '3/5', createdAt: '2026-10-08T00:00:00Z', updatedAt: '2026-10-08T00:00:00Z', tenant_id: 'giyeun' },
    { id: 'CONTR-RECON-04', contractNo: 'C2610-R004', contractType: 'RENTAL', customerId: 'CUST-RECON-04', salespersonId: 'u-sales', siteId: 'SITE-RECON-04', startDate: '2026-10-12', endDate: '', billingDay: 30, statementClosingDay: 25, paymentDueDay: 25, status: 'ACTIVE', freightBillingStandard: '3/5', createdAt: '2026-10-12T00:00:00Z', updatedAt: '2026-10-12T00:00:00Z', tenant_id: 'giyeun' },
    { id: 'CONTR-RECON-05', contractNo: 'C2610-R005', contractType: 'RENTAL', customerId: 'CUST-RECON-05', salespersonId: 'u-sales', siteId: 'SITE-RECON-05', startDate: '2026-10-15', endDate: '', billingDay: 30, statementClosingDay: 25, paymentDueDay: 15, status: 'ACTIVE', freightBillingStandard: '3/5', createdAt: '2026-10-15T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z', tenant_id: 'giyeun' },
    { id: 'CONTR-RECON-06', contractNo: 'C2610-R006', contractType: 'RENTAL', customerId: 'CUST-RECON-06', salespersonId: 'u-sales', siteId: 'SITE-RECON-06', startDate: '2026-10-17', endDate: '', billingDay: 30, statementClosingDay: 25, paymentDueDay: 25, status: 'ACTIVE', freightBillingStandard: '3/5', createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z', tenant_id: 'giyeun' }
  ];
  {
    const { error } = await supabase.from('contracts').upsert(reconContracts, { onConflict: 'id' });
    if (error) console.error('Contracts upsert error:', error.message);
    else console.log('✅ 계약(contracts) 6건 등록 완료');
  }

  // 7. 2026년 10월 운송료 대사(RECONCILIATION) 및 묶음배차 테스트용 배차 데이터(deliveries) 생성
  // (A) 경기화물운송 - 운송완료(DELIVERED, 미정산) 건들 (단독 배차 + 경유/합짐 묶음 완결 건 포함)
  // (B) 엘제이운송 - 운송완료(DELIVERED, 미정산) 건들 (단독 배차 + 경유/합짐 묶음 완결 건 포함)
  // (C) 자인운송 - 운송완료(DELIVERED, 미정산) 건들
  const HQ_ORIGIN = '경기도 화성시 남양읍 시청로 160번길 20 (eBro 데모 주기장)';

  const reconDeliveries = [
    // [경기화물운송 1] 10/02 단독 출고 - 삼성물산 평택 고덕 반도체 P4 (시스템 180,000원 -> 엑셀 180,000원 완전일치)
    {
      id: 'DLV-RECON-101',
      contractId: 'CONTR-RECON-01',
      assetIds: ['ASSET-DEMO-0101', 'ASSET-DEMO-0102'],
      type: 'OUTBOUND',
      dispatchCategory: '출고',
      transportCompany: '경기화물운송',
      driverName: '김철수',
      driverContact: '010-9101-1122',
      vehicleNo: '경기88바 1234',
      vehicleType: '5T',
      pickupType: 'HQ_YARD',
      originAddress: HQ_ORIGIN,
      loadingDate: '2026-10-02',
      loadingTimeSlot: '오전',
      dropoffType: 'SINGLE',
      destinationAddress: '삼성물산 건설부문 (평택 고덕 반도체 P4 신축현장 - 경기도 평택시 고덕면 고덕국제대로 77)',
      unloadingDate: '2026-10-02',
      unloadingTimeSlot: '오전',
      expectedCost: 180000,
      deliveryCost: 180000,
      finalCost: 180000,
      reconciliationStatus: 'PENDING',
      isCostSettled: false,
      status: 'DELIVERED',
      requestDate: '2026-10-02',
      scheduledDate: '2026-10-02',
      cargoItems: JSON.stringify([{ modelName: 'GS-1930', count: 2 }]),
      vehicles: JSON.stringify([{ id: 'v-r101', transportCompany: '경기화물운송', vehicleType: '5T', vehicleNo: '경기88바 1234', driverName: '김철수', driverContact: '010-9101-1122', expectedCost: 180000, finalCost: 180000, deliveryCost: 180000 }]),
      memo: '업체: 삼성물산 건설부문 | 현장: 평택 고덕 반도체 P4 신축현장 | GS-1930 2대 출고',
      loadingCompletedAt: '2026-10-02T08:30:00Z',
      unloadingCompletedAt: '2026-10-02T10:40:00Z',
      createdAt: '2026-10-02T07:00:00Z',
      updatedAt: '2026-10-02T10:40:00Z',
      tenant_id: 'giyeun'
    },
    // [경기화물운송 2 - 묶음배차 완결 그룹 BND-261005-100 (1순위 + 2순위 모두 DELIVERED)]
    // 10/05 1순위: 현대엔지니어링 화성 동탄 물류센터 (운송비 250,000원 대표 보유 -> 엑셀 290,000원 경유지 할증 +40,000원 차액 발생 시나리오!)
    {
      id: 'DLV-RECON-102',
      contractId: 'CONTR-RECON-02',
      assetIds: ['ASSET-DEMO-0115'],
      type: 'OUTBOUND',
      dispatchCategory: '출고',
      transportCompany: '경기화물운송',
      driverName: '박영수',
      driverContact: '010-9102-3344',
      vehicleNo: '경기89사 5678',
      vehicleType: '5T 축차',
      pickupType: 'HQ_YARD',
      originAddress: HQ_ORIGIN,
      loadingDate: '2026-10-05',
      loadingTimeSlot: '오전',
      dropoffType: 'MULTI_STOP',
      viaDropoffName: '수원 광교 데이터센터 현장',
      viaDropoffAddress: '경기도 수원시 영통구 광교중앙로 240',
      destinationAddress: '현대엔지니어링 (화성 동탄 물류센터 신축현장 - 경기도 화성시 동탄면 동탄산단로 120)',
      unloadingDate: '2026-10-05',
      unloadingTimeSlot: '오전',
      expectedCost: 250000,
      deliveryCost: 250000,
      finalCost: 250000,
      reconciliationStatus: 'PENDING',
      isCostSettled: false,
      status: 'DELIVERED',
      requestDate: '2026-10-05',
      scheduledDate: '2026-10-05',
      cargoItems: JSON.stringify([{ modelName: 'GS-2646', count: 1 }]),
      vehicles: JSON.stringify([{ id: 'v-r102', transportCompany: '경기화물운송', vehicleType: '5T 축차', vehicleNo: '경기89사 5678', driverName: '박영수', driverContact: '010-9102-3344', expectedCost: 250000, finalCost: 250000, deliveryCost: 250000 }]),
      memo: '업체: 현대엔지니어링 | 현장: 화성 동탄 물류센터 신축현장 | 동탄 1차 하차 후 수원 광교 2차 하차 합짐 [BUNDLE:BND-261005-100|1|출고]',
      loadingCompletedAt: '2026-10-05T08:00:00Z',
      unloadingCompletedAt: '2026-10-05T10:15:00Z',
      createdAt: '2026-10-05T07:00:00Z',
      updatedAt: '2026-10-05T10:15:00Z',
      tenant_id: 'giyeun'
    },
    // 10/05 2순위: 대우건설 수원 광교 데이터센터 (같은 묶음 BND-261005-100의 2순위, 운송비 0원 통합, DELIVERED 완료)
    {
      id: 'DLV-RECON-103',
      contractId: 'CONTR-RECON-05',
      assetIds: ['ASSET-DEMO-0123'],
      type: 'OUTBOUND',
      dispatchCategory: '출고',
      transportCompany: '경기화물운송',
      driverName: '박영수',
      driverContact: '010-9102-3344',
      vehicleNo: '경기89사 5678',
      vehicleType: '5T 축차',
      pickupType: 'HQ_YARD',
      originAddress: HQ_ORIGIN,
      loadingDate: '2026-10-05',
      loadingTimeSlot: '오전',
      dropoffType: 'MULTI_STOP',
      destinationAddress: '대우건설 (수원 광교 데이터센터 현장 - 경기도 수원시 영통구 광교중앙로 240)',
      unloadingDate: '2026-10-05',
      unloadingTimeSlot: '오후',
      expectedCost: 0,
      deliveryCost: 0,
      finalCost: 0,
      reconciliationStatus: 'PENDING',
      isCostSettled: false,
      status: 'DELIVERED',
      requestDate: '2026-10-05',
      scheduledDate: '2026-10-05',
      cargoItems: JSON.stringify([{ modelName: 'GS-3246', count: 1 }]),
      vehicles: JSON.stringify([{ id: 'v-r102', transportCompany: '경기화물운송', vehicleType: '5T 축차', vehicleNo: '경기89사 5678', driverName: '박영수', driverContact: '010-9102-3344', expectedCost: 0, finalCost: 0, deliveryCost: 0 }]),
      memo: '업체: 대우건설 | 현장: 수원 광교 데이터센터 현장 | 동탄 경유 합짐 2순위 하차 완료 [BUNDLE:BND-261005-100|2|출고]',
      loadingCompletedAt: '2026-10-05T08:15:00Z',
      unloadingCompletedAt: '2026-10-05T13:20:00Z',
      createdAt: '2026-10-05T07:05:00Z',
      updatedAt: '2026-10-05T13:20:00Z',
      tenant_id: 'giyeun'
    },
    // [경기화물운송 3] 10/08 단독 출고 - 지에스건설 인천 송도 바이오클러스터 2공구 (시스템 200,000원 -> 엑셀 200,000원 완전일치)
    {
      id: 'DLV-RECON-104',
      contractId: 'CONTR-RECON-03',
      assetIds: ['ASSET-DEMO-0137', 'ASSET-DEMO-0138'],
      type: 'OUTBOUND',
      dispatchCategory: '출고',
      transportCompany: '경기화물운송',
      driverName: '이민호',
      driverContact: '010-9103-5566',
      vehicleNo: '경기82아 9012',
      vehicleType: '3.5T',
      pickupType: 'HQ_YARD',
      originAddress: HQ_ORIGIN,
      loadingDate: '2026-10-08',
      loadingTimeSlot: '오전',
      dropoffType: 'SINGLE',
      destinationAddress: '지에스건설 (인천 송도 바이오클러스터 2공구 - 인천광역시 연수구 송도동 첨단대로 305)',
      unloadingDate: '2026-10-08',
      unloadingTimeSlot: '오전',
      expectedCost: 200000,
      deliveryCost: 200000,
      finalCost: 200000,
      reconciliationStatus: 'PENDING',
      isCostSettled: false,
      status: 'DELIVERED',
      requestDate: '2026-10-08',
      scheduledDate: '2026-10-08',
      cargoItems: JSON.stringify([{ modelName: 'SJ3219', count: 2 }]),
      vehicles: JSON.stringify([{ id: 'v-r104', transportCompany: '경기화물운송', vehicleType: '3.5T', vehicleNo: '경기82아 9012', driverName: '이민호', driverContact: '010-9103-5566', expectedCost: 200000, finalCost: 200000, deliveryCost: 200000 }]),
      memo: '업체: 지에스건설 | 현장: 인천 송도 바이오클러스터 2공구 | SJ3219 2대 출고',
      loadingCompletedAt: '2026-10-08T07:50:00Z',
      unloadingCompletedAt: '2026-10-08T10:10:00Z',
      createdAt: '2026-10-08T06:30:00Z',
      updatedAt: '2026-10-08T10:10:00Z',
      tenant_id: 'giyeun'
    },
    // [경기화물운송 4] 10/12 단독 출고 - 포스코이앤씨 용인 원삼 반도체클러스터 (시스템 220,000원 -> 엑셀 250,000원 현장 대기료 +30,000원 차액 시나리오!)
    {
      id: 'DLV-RECON-105',
      contractId: 'CONTR-RECON-04',
      assetIds: ['ASSET-DEMO-0147'],
      type: 'OUTBOUND',
      dispatchCategory: '출고',
      transportCompany: '경기화물운송',
      driverName: '김철수',
      driverContact: '010-9101-1122',
      vehicleNo: '경기88바 1234',
      vehicleType: '5T',
      pickupType: 'HQ_YARD',
      originAddress: HQ_ORIGIN,
      loadingDate: '2026-10-12',
      loadingTimeSlot: '오전',
      dropoffType: 'SINGLE',
      destinationAddress: '포스코이앤씨 (용인 원삼 반도체클러스터 1공구 - 경기도 용인시 처인구 원삼면 죽능리 500)',
      unloadingDate: '2026-10-12',
      unloadingTimeSlot: '오전',
      expectedCost: 220000,
      deliveryCost: 220000,
      finalCost: 220000,
      reconciliationStatus: 'PENDING',
      isCostSettled: false,
      status: 'DELIVERED',
      requestDate: '2026-10-12',
      scheduledDate: '2026-10-12',
      cargoItems: JSON.stringify([{ modelName: 'SJ3226', count: 1 }]),
      vehicles: JSON.stringify([{ id: 'v-r105', transportCompany: '경기화물운송', vehicleType: '5T', vehicleNo: '경기88바 1234', driverName: '김철수', driverContact: '010-9101-1122', expectedCost: 220000, finalCost: 220000, deliveryCost: 220000 }]),
      memo: '업체: 포스코이앤씨 | 현장: 용인 원삼 반도체클러스터 1공구 | 보안게이트 출입증 발급 대기 발생',
      loadingCompletedAt: '2026-10-12T08:00:00Z',
      unloadingCompletedAt: '2026-10-12T12:30:00Z',
      createdAt: '2026-10-12T07:00:00Z',
      updatedAt: '2026-10-12T12:30:00Z',
      tenant_id: 'giyeun'
    },
    // [경기화물운송 5 - 묶음배차 완결 그룹 BND-261015-200 (1순위 + 2순위 모두 DELIVERED)]
    // 10/15 1순위: 에스케이에코플랜트 이천 하이닉스 + 삼성물산 평택 고덕 합짐 (운송비 320,000원 -> 엑셀 320,000원 완전일치!)
    {
      id: 'DLV-RECON-106',
      contractId: 'CONTR-RECON-06',
      assetIds: ['ASSET-DEMO-0169'],
      type: 'OUTBOUND',
      dispatchCategory: '출고',
      transportCompany: '경기화물운송',
      driverName: '박영수',
      driverContact: '010-9102-3344',
      vehicleNo: '경기89사 5678',
      vehicleType: '5T 축차',
      pickupType: 'HQ_YARD',
      originAddress: HQ_ORIGIN,
      loadingDate: '2026-10-15',
      loadingTimeSlot: '오전',
      dropoffType: 'MULTI_STOP',
      viaDropoffName: '평택 고덕 반도체 P4 신축현장',
      viaDropoffAddress: '경기도 평택시 고덕면 고덕국제대로 77',
      destinationAddress: '에스케이에코플랜트 (이천 하이닉스 M16 증설현장 - 경기도 이천시 부발읍 경충대로 2091)',
      unloadingDate: '2026-10-15',
      unloadingTimeSlot: '오후',
      expectedCost: 320000,
      deliveryCost: 320000,
      finalCost: 320000,
      reconciliationStatus: 'PENDING',
      isCostSettled: false,
      status: 'DELIVERED',
      requestDate: '2026-10-15',
      scheduledDate: '2026-10-15',
      cargoItems: JSON.stringify([{ modelName: 'JCPT0807AC', count: 1 }]),
      vehicles: JSON.stringify([{ id: 'v-r106', transportCompany: '경기화물운송', vehicleType: '5T 축차', vehicleNo: '경기89사 5678', driverName: '박영수', driverContact: '010-9102-3344', expectedCost: 320000, finalCost: 320000, deliveryCost: 320000 }]),
      memo: '업체: 에스케이에코플랜트 | 현장: 이천 하이닉스 M16 증설현장 | 평택 고덕 경유 이천 하차 합짐 [BUNDLE:BND-261015-200|1|출고]',
      loadingCompletedAt: '2026-10-15T07:30:00Z',
      unloadingCompletedAt: '2026-10-15T11:20:00Z',
      createdAt: '2026-10-15T06:30:00Z',
      updatedAt: '2026-10-15T11:20:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'DLV-RECON-107',
      contractId: 'CONTR-RECON-01',
      assetIds: ['ASSET-DEMO-0170'],
      type: 'OUTBOUND',
      dispatchCategory: '출고',
      transportCompany: '경기화물운송',
      driverName: '박영수',
      driverContact: '010-9102-3344',
      vehicleNo: '경기89사 5678',
      vehicleType: '5T 축차',
      pickupType: 'HQ_YARD',
      originAddress: HQ_ORIGIN,
      loadingDate: '2026-10-15',
      loadingTimeSlot: '오전',
      dropoffType: 'MULTI_STOP',
      destinationAddress: '삼성물산 건설부문 (평택 고덕 반도체 P4 신축현장 - 경기도 평택시 고덕면 고덕국제대로 77)',
      unloadingDate: '2026-10-15',
      unloadingTimeSlot: '오후',
      expectedCost: 0,
      deliveryCost: 0,
      finalCost: 0,
      reconciliationStatus: 'PENDING',
      isCostSettled: false,
      status: 'DELIVERED',
      requestDate: '2026-10-15',
      scheduledDate: '2026-10-15',
      cargoItems: JSON.stringify([{ modelName: 'JCPT0807AC', count: 1 }]),
      vehicles: JSON.stringify([{ id: 'v-r106', transportCompany: '경기화물운송', vehicleType: '5T 축차', vehicleNo: '경기89사 5678', driverName: '박영수', driverContact: '010-9102-3344', expectedCost: 0, finalCost: 0, deliveryCost: 0 }]),
      memo: '업체: 삼성물산 건설부문 | 현장: 평택 고덕 반도체 P4 신축현장 | 이천-평택 합짐 2순위 하차 완료 [BUNDLE:BND-261015-200|2|출고]',
      loadingCompletedAt: '2026-10-15T07:45:00Z',
      unloadingCompletedAt: '2026-10-15T14:50:00Z',
      createdAt: '2026-10-15T06:35:00Z',
      updatedAt: '2026-10-15T14:50:00Z',
      tenant_id: 'giyeun'
    },
    // [경기화물운송 6] 10/18 교환(EXCHANGE) 왕복 배차 - 현대엔지니어링 화성 동탄 물류센터 (시스템 280,000원 -> 엑셀 280,000원 완전일치)
    {
      id: 'DLV-RECON-108',
      contractId: 'CONTR-RECON-02',
      assetIds: ['ASSET-DEMO-0116'],
      type: 'EXCHANGE',
      dispatchCategory: '교환',
      transportCompany: '경기화물운송',
      driverName: '정우성',
      driverContact: '010-9104-7788',
      vehicleNo: '경기91자 3456',
      vehicleType: '2.5T 셀프',
      pickupType: 'HQ_YARD',
      originAddress: HQ_ORIGIN,
      loadingDate: '2026-10-18',
      loadingTimeSlot: '오전',
      dropoffType: 'SINGLE',
      destinationAddress: '현대엔지니어링 (화성 동탄 물류센터 신축현장 - 경기도 화성시 동탄면 동탄산단로 120)',
      unloadingDate: '2026-10-18',
      unloadingTimeSlot: '오후',
      expectedCost: 280000,
      deliveryCost: 280000,
      finalCost: 280000,
      reconciliationStatus: 'PENDING',
      isCostSettled: false,
      status: 'DELIVERED',
      requestDate: '2026-10-18',
      scheduledDate: '2026-10-18',
      cargoItems: JSON.stringify([{ modelName: 'GS-2646', count: 1 }]),
      vehicles: JSON.stringify([{ id: 'v-r108', transportCompany: '경기화물운송', vehicleType: '2.5T 셀프', vehicleNo: '경기91자 3456', driverName: '정우성', driverContact: '010-9104-7788', expectedCost: 280000, finalCost: 280000, deliveryCost: 280000 }]),
      memo: '업체: 현대엔지니어링 | 현장: 화성 동탄 물류센터 신축현장 | 장비 교환 왕복 운송 (출고+회수 동시 진행)',
      loadingCompletedAt: '2026-10-18T09:00:00Z',
      unloadingCompletedAt: '2026-10-18T13:10:00Z',
      createdAt: '2026-10-18T08:00:00Z',
      updatedAt: '2026-10-18T13:10:00Z',
      tenant_id: 'giyeun'
    },
    // [경기화물운송 7] 10/21 회수(INBOUND) 배차 - 대우건설 수원 광교 데이터센터 (시스템 160,000원 -> 엑셀 미청구 SYSTEM_ONLY 시나리오!)
    {
      id: 'DLV-RECON-109',
      contractId: 'CONTR-RECON-05',
      assetIds: ['ASSET-DEMO-0124'],
      type: 'INBOUND',
      dispatchCategory: '입고',
      transportCompany: '경기화물운송',
      driverName: '이민호',
      driverContact: '010-9103-5566',
      vehicleNo: '경기82아 9012',
      vehicleType: '3.5T',
      pickupType: 'HQ_YARD',
      originAddress: '경기도 수원시 영통구 광교중앙로 240 (수원 광교 데이터센터 현장)',
      loadingDate: '2026-10-21',
      loadingTimeSlot: '오후',
      dropoffType: 'SINGLE',
      destinationAddress: '대우건설 (수원 광교 데이터센터 현장 ➔ 본사 주기장 입고)',
      unloadingDate: '2026-10-21',
      unloadingTimeSlot: '오후',
      expectedCost: 160000,
      deliveryCost: 160000,
      finalCost: 160000,
      reconciliationStatus: 'PENDING',
      isCostSettled: false,
      status: 'DELIVERED',
      requestDate: '2026-10-21',
      scheduledDate: '2026-10-21',
      cargoItems: JSON.stringify([{ modelName: 'GS-3246', count: 1 }]),
      vehicles: JSON.stringify([{ id: 'v-r109', transportCompany: '경기화물운송', vehicleType: '3.5T', vehicleNo: '경기82아 9012', driverName: '이민호', driverContact: '010-9103-5566', expectedCost: 160000, finalCost: 160000, deliveryCost: 160000 }]),
      memo: '업체: 대우건설 | 현장: 수원 광교 데이터센터 현장 | 단기 대여 종료 회수 입고',
      loadingCompletedAt: '2026-10-21T14:00:00Z',
      unloadingCompletedAt: '2026-10-21T16:20:00Z',
      createdAt: '2026-10-21T11:00:00Z',
      updatedAt: '2026-10-21T16:20:00Z',
      tenant_id: 'giyeun'
    },

    // (B) [엘제이운송] 운송완료(DELIVERED) 3건 (단독 2건 + 묶음배차 1그룹 2건)
    {
      id: 'DLV-RECON-201',
      contractId: 'CONTR-RECON-03',
      assetIds: ['ASSET-DEMO-0155'],
      type: 'OUTBOUND',
      dispatchCategory: '출고',
      transportCompany: '엘제이운송',
      driverName: '최동훈',
      driverContact: '010-8201-2233',
      vehicleNo: '인천83바 7788',
      vehicleType: '5T',
      pickupType: 'HQ_YARD',
      originAddress: HQ_ORIGIN,
      loadingDate: '2026-10-06',
      loadingTimeSlot: '오전',
      dropoffType: 'SINGLE',
      destinationAddress: '지에스건설 (인천 송도 바이오클러스터 2공구 - 인천광역시 연수구 송도동 첨단대로 305)',
      unloadingDate: '2026-10-06',
      unloadingTimeSlot: '오전',
      expectedCost: 190000,
      deliveryCost: 190000,
      finalCost: 190000,
      reconciliationStatus: 'PENDING',
      isCostSettled: false,
      status: 'DELIVERED',
      requestDate: '2026-10-06',
      scheduledDate: '2026-10-06',
      cargoItems: JSON.stringify([{ modelName: '1230ES', count: 2 }]),
      vehicles: JSON.stringify([{ id: 'v-r201', transportCompany: '엘제이운송', vehicleType: '5T', vehicleNo: '인천83바 7788', driverName: '최동훈', driverContact: '010-8201-2233', expectedCost: 190000, finalCost: 190000, deliveryCost: 190000 }]),
      memo: '업체: 지에스건설 | 현장: 인천 송도 바이오클러스터 2공구 | 1230ES 2대 출고',
      loadingCompletedAt: '2026-10-06T08:10:00Z',
      unloadingCompletedAt: '2026-10-06T10:30:00Z',
      createdAt: '2026-10-06T07:00:00Z',
      updatedAt: '2026-10-06T10:30:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'DLV-RECON-202',
      contractId: 'CONTR-RECON-01',
      assetIds: ['ASSET-DEMO-0161'],
      type: 'OUTBOUND',
      dispatchCategory: '출고',
      transportCompany: '엘제이운송',
      driverName: '강백호',
      driverContact: '010-8202-4455',
      vehicleNo: '경기85자 4321',
      vehicleType: '5T 축차',
      pickupType: 'HQ_YARD',
      originAddress: HQ_ORIGIN,
      loadingDate: '2026-10-14',
      loadingTimeSlot: '오전',
      dropoffType: 'MULTI_STOP',
      viaDropoffName: '화성 동탄 물류센터 신축현장',
      viaDropoffAddress: '경기도 화성시 동탄면 동탄산단로 120',
      destinationAddress: '삼성물산 건설부문 (평택 고덕 반도체 P4 신축현장 - 경기도 평택시 고덕면 고덕국제대로 77)',
      unloadingDate: '2026-10-14',
      unloadingTimeSlot: '오전',
      expectedCost: 260000,
      deliveryCost: 260000,
      finalCost: 260000,
      reconciliationStatus: 'PENDING',
      isCostSettled: false,
      status: 'DELIVERED',
      requestDate: '2026-10-14',
      scheduledDate: '2026-10-14',
      cargoItems: JSON.stringify([{ modelName: '1930ES', count: 2 }]),
      vehicles: JSON.stringify([{ id: 'v-r202', transportCompany: '엘제이운송', vehicleType: '5T 축차', vehicleNo: '경기85자 4321', driverName: '강백호', driverContact: '010-8202-4455', expectedCost: 260000, finalCost: 260000, deliveryCost: 260000 }]),
      memo: '업체: 삼성물산 건설부문 | 현장: 평택 고덕 반도체 P4 신축현장 | 평택-동탄 합짐 1순위 [BUNDLE:BND-261014-300|1|출고]',
      loadingCompletedAt: '2026-10-14T08:00:00Z',
      unloadingCompletedAt: '2026-10-14T10:30:00Z',
      createdAt: '2026-10-14T07:00:00Z',
      updatedAt: '2026-10-14T10:30:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'DLV-RECON-203',
      contractId: 'CONTR-RECON-02',
      assetIds: ['ASSET-DEMO-0162'],
      type: 'OUTBOUND',
      dispatchCategory: '출고',
      transportCompany: '엘제이운송',
      driverName: '강백호',
      driverContact: '010-8202-4455',
      vehicleNo: '경기85자 4321',
      vehicleType: '5T 축차',
      pickupType: 'HQ_YARD',
      originAddress: HQ_ORIGIN,
      loadingDate: '2026-10-14',
      loadingTimeSlot: '오전',
      dropoffType: 'MULTI_STOP',
      destinationAddress: '현대엔지니어링 (화성 동탄 물류센터 신축현장 - 경기도 화성시 동탄면 동탄산단로 120)',
      unloadingDate: '2026-10-14',
      unloadingTimeSlot: '오후',
      expectedCost: 0,
      deliveryCost: 0,
      finalCost: 0,
      reconciliationStatus: 'PENDING',
      isCostSettled: false,
      status: 'DELIVERED',
      requestDate: '2026-10-14',
      scheduledDate: '2026-10-14',
      cargoItems: JSON.stringify([{ modelName: '1930ES', count: 1 }]),
      vehicles: JSON.stringify([{ id: 'v-r202', transportCompany: '엘제이운송', vehicleType: '5T 축차', vehicleNo: '경기85자 4321', driverName: '강백호', driverContact: '010-8202-4455', expectedCost: 0, finalCost: 0, deliveryCost: 0 }]),
      memo: '업체: 현대엔지니어링 | 현장: 화성 동탄 물류센터 신축현장 | 평택-동탄 합짐 2순위 [BUNDLE:BND-261014-300|2|출고]',
      loadingCompletedAt: '2026-10-14T08:15:00Z',
      unloadingCompletedAt: '2026-10-14T13:15:00Z',
      createdAt: '2026-10-14T07:05:00Z',
      updatedAt: '2026-10-14T13:15:00Z',
      tenant_id: 'giyeun'
    },

    // (C) [자인운송] 운송완료(DELIVERED) 2건
    {
      id: 'DLV-RECON-301',
      contractId: 'CONTR-RECON-06',
      assetIds: ['ASSET-DEMO-0167'],
      type: 'OUTBOUND',
      dispatchCategory: '출고',
      transportCompany: '자인운송',
      driverName: '윤태영',
      driverContact: '010-7301-6677',
      vehicleNo: '경기95바 8899',
      vehicleType: '11T 윙바디',
      pickupType: 'HQ_YARD',
      originAddress: HQ_ORIGIN,
      loadingDate: '2026-10-10',
      loadingTimeSlot: '오전',
      dropoffType: 'SINGLE',
      destinationAddress: '에스케이에코플랜트 (이천 하이닉스 M16 증설현장 - 경기도 이천시 부발읍 경충대로 2091)',
      unloadingDate: '2026-10-10',
      unloadingTimeSlot: '오전',
      expectedCost: 300000,
      deliveryCost: 300000,
      finalCost: 300000,
      reconciliationStatus: 'PENDING',
      isCostSettled: false,
      status: 'DELIVERED',
      requestDate: '2026-10-10',
      scheduledDate: '2026-10-10',
      cargoItems: JSON.stringify([{ modelName: '4069LE', count: 1 }]),
      vehicles: JSON.stringify([{ id: 'v-r301', transportCompany: '자인운송', vehicleType: '11T 윙바디', vehicleNo: '경기95바 8899', driverName: '윤태영', driverContact: '010-7301-6677', expectedCost: 300000, finalCost: 300000, deliveryCost: 300000 }]),
      memo: '업체: 에스케이에코플랜트 | 현장: 이천 하이닉스 M16 증설현장 | 대형 4069LE 출고',
      loadingCompletedAt: '2026-10-10T07:30:00Z',
      unloadingCompletedAt: '2026-10-10T10:20:00Z',
      createdAt: '2026-10-10T06:30:00Z',
      updatedAt: '2026-10-10T10:20:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'DLV-RECON-302',
      contractId: 'CONTR-RECON-04',
      assetIds: ['ASSET-DEMO-0177'],
      type: 'OUTBOUND',
      dispatchCategory: '출고',
      transportCompany: '자인운송',
      driverName: '조진웅',
      driverContact: '010-7302-8899',
      vehicleNo: '경기86사 1199',
      vehicleType: '5T',
      pickupType: 'HQ_YARD',
      originAddress: HQ_ORIGIN,
      loadingDate: '2026-10-19',
      loadingTimeSlot: '오전',
      dropoffType: 'SINGLE',
      destinationAddress: '포스코이앤씨 (용인 원삼 반도체클러스터 1공구 - 경기도 용인시 처인구 원삼면 죽능리 500)',
      unloadingDate: '2026-10-19',
      unloadingTimeSlot: '오전',
      expectedCost: 210000,
      deliveryCost: 210000,
      finalCost: 210000,
      reconciliationStatus: 'PENDING',
      isCostSettled: false,
      status: 'DELIVERED',
      requestDate: '2026-10-19',
      scheduledDate: '2026-10-19',
      cargoItems: JSON.stringify([{ modelName: 'JCPT1008AC', count: 1 }]),
      vehicles: JSON.stringify([{ id: 'v-r302', transportCompany: '자인운송', vehicleType: '5T', vehicleNo: '경기86사 1199', driverName: '조진웅', driverContact: '010-7302-8899', expectedCost: 210000, finalCost: 210000, deliveryCost: 210000 }]),
      memo: '업체: 포스코이앤씨 | 현장: 용인 원삼 반도체클러스터 1공구 | JCPT1008AC 1대 출고',
      loadingCompletedAt: '2026-10-19T08:00:00Z',
      unloadingCompletedAt: '2026-10-19T10:00:00Z',
      createdAt: '2026-10-19T07:00:00Z',
      updatedAt: '2026-10-19T10:00:00Z',
      tenant_id: 'giyeun'
    }
  ];

  {
    const { error } = await supabase.from('deliveries').upsert(reconDeliveries, { onConflict: 'id' });
    if (error) console.error('Recon Deliveries upsert error:', error.message);
    else console.log(`✅ 운송료 대사 테스트용 배차(deliveries) ${reconDeliveries.length}건 추가 등록 완료`);
  }

  // 8. 전체 테이블 조회 후 src/services/demo_golden_dataset.json 최신화 (데모 초기화 시에도 보존되도록)
  const tablesToDump = [
    'tenants', 'departments', 'users',
    'products', 'standard_options', 'vendors', 'consumables', 'transport_companies',
    'transport_drivers',
    'customers', 'site_masters', 'customer_sites', 'customer_contacts',
    'assets',
    'contracts', 'contract_assets', 'contract_history',
    'deliveries', 'outbound_inspections',
    'repairs', 'repair_consumables',
    'billing_invoices', 'billings', 'billing_details', 'receivables', 'payments',
    'bank_initial_balances', 'bank_transactions',
    'todos'
  ];

  const fullDataset = {};
  for (const tbl of tablesToDump) {
    const { data, error } = await supabase.from(tbl).select('*');
    if (error) {
      console.warn(`Table dump warning (${tbl}):`, error.message);
      fullDataset[tbl] = [];
    } else {
      fullDataset[tbl] = data || [];
    }
  }

  const goldenPath = path.join(__dirname, '..', 'src', 'services', 'demo_golden_dataset.json');
  fs.writeFileSync(goldenPath, JSON.stringify(fullDataset, null, 2), 'utf8');
  console.log(`✅ demo_golden_dataset.json 동기화 완료 (assets: ${fullDataset.assets.length}대, deliveries: ${fullDataset.deliveries.length}건, transport_companies: ${fullDataset.transport_companies.length}곳)`);
}

run().catch(console.error);
