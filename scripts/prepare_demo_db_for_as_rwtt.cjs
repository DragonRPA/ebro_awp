// scripts/prepare_demo_db_for_as_rwtt.cjs
// 데모 전용 Supabase (idfecoovqkjopgbezcpo) 스키마 동기화 및 AS/소모품/동선 RWTT 시드 데이터 준비
const { createClient } = require('@supabase/supabase-js');

const DEMO_SUPABASE_URL = 'https://idfecoovqkjopgbezcpo.supabase.co';
const DEMO_SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZmVjb292cWtqb3BnYmV6Y3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MzEzODUsImV4cCI6MjEwNTIwNzM4NX0.FnKGWqvA5IZJCqfnjyNU-3W_TljunBVqcse_0V-39No';

const demo = createClient(DEMO_SUPABASE_URL, DEMO_SUPABASE_ANON);

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "as_route_logs" (
    "id" TEXT PRIMARY KEY,
    "workDate" TEXT NOT NULL,
    "mechanicId" TEXT,
    "mechanicName" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventLabel" TEXT NOT NULL,
    "repairId" TEXT,
    "ticketNo" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "siteId" TEXT,
    "siteName" TEXT,
    "siteAddress" TEXT,
    "assetId" TEXT,
    "assetNo" TEXT,
    "modelName" TEXT,
    "nextRepairId" TEXT,
    "nextSiteName" TEXT,
    "sourcingType" TEXT,
    "sourcingTargetName" TEXT,
    "partName" TEXT,
    "revisitDate" TEXT,
    "durationMinutes" INTEGER,
    "memo" TEXT,
    "recordedAt" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'giyeun'
  );`,
  `ALTER TABLE "as_route_logs" DROP CONSTRAINT IF EXISTS "as_route_logs_eventType_check";`,
  `ALTER TABLE "as_route_logs" ADD COLUMN IF NOT EXISTS "sourcingType" TEXT;`,
  `ALTER TABLE "as_route_logs" ADD COLUMN IF NOT EXISTS "sourcingTargetName" TEXT;`,
  `ALTER TABLE "as_route_logs" ADD COLUMN IF NOT EXISTS "partName" TEXT;`,
  `ALTER TABLE "as_route_logs" ADD COLUMN IF NOT EXISTS "revisitDate" TEXT;`,
  `CREATE INDEX IF NOT EXISTS idx_as_route_logs_work_date ON "as_route_logs"("workDate");`,
  `CREATE INDEX IF NOT EXISTS idx_as_route_logs_mechanic ON "as_route_logs"("mechanicId", "workDate");`,
  `CREATE INDEX IF NOT EXISTS idx_as_route_logs_repair ON "as_route_logs"("repairId");`,
  `ALTER TABLE "as_route_logs" ENABLE ROW LEVEL SECURITY;`,
  `DROP POLICY IF EXISTS "allow_all_as_route_logs" ON "as_route_logs";`,
  `CREATE POLICY "allow_all_as_route_logs" ON "as_route_logs" FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);`,
  `GRANT ALL ON TABLE "as_route_logs" TO anon, authenticated, service_role;`,
  `ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_transactionStatus_check";`,
  `ALTER TABLE "mechanic_consumable_stocks" DROP CONSTRAINT IF EXISTS "mechanic_consumable_stocks_mechanicId_consumableId_key";`,
  `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "assetNature" TEXT;`,
  `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "yard" TEXT;`,
  `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "bundleGroupId" TEXT;`,
  `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "bundleOrder" INTEGER;`,
  `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "originalDispatchCategory" TEXT;`,
  `NOTIFY pgrst, 'reload schema';`
];

async function run() {
  console.log('1. [Demo DB] Applying DDL statements...');
  const { data: ddlRes, error: ddlErr } = await demo.rpc('dev_exec_ddl', { statements: DDL_STATEMENTS });
  if (ddlErr) {
    console.error('DDL Error:', ddlErr.message);
    process.exit(1);
  }
  const failed = (ddlRes || []).filter(r => !r.ok);
  console.log(`   -> Executed ${(ddlRes || []).length} DDL statements, failed: ${failed.length}`);
  if (failed.length > 0) console.log('   -> Failures:', failed);

  // 2. AS팀 부서 및 AS팀원 4명 + 기존 데모 사용자 부서명 보강
  console.log('2. [Demo DB] Seeding AS팀 department and AS팀 technicians...');
  const asDept = {
    id: 'DEPT-0000005',
    name: 'AS팀',
    parentDepartmentId: null,
    managerId: 'USR-0000011',
    functionalTags: ['AS', 'MAINTENANCE'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-26T00:00:00Z',
    tenant_id: 'giyeun'
  };
  await demo.from('departments').upsert([asDept], { onConflict: 'id' });

  const asUsers = [
    {
      id: 'USR-0000011',
      loginId: '한상찬',
      passwordHash: '1234',
      name: '한상찬',
      department: 'AS팀',
      departmentId: 'DEPT-0000005',
      position: '팀장',
      role: 'MANAGER',
      status: 'ACTIVE',
      phone: '010-5511-0011',
      email: 'hsc@ebro.run',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-26T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'USR-0000012',
      loginId: '최영석',
      passwordHash: '1234',
      name: '최영석',
      department: 'AS팀',
      departmentId: 'DEPT-0000005',
      position: '과장',
      role: 'USER',
      status: 'ACTIVE',
      phone: '010-5511-0012',
      email: 'cys@ebro.run',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-26T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'USR-0000013',
      loginId: '장세현',
      passwordHash: '1234',
      name: '장세현',
      department: 'AS팀',
      departmentId: 'DEPT-0000005',
      position: '과장',
      role: 'USER',
      status: 'ACTIVE',
      phone: '010-5511-0013',
      email: 'jsh@ebro.run',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-26T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'USR-0000014',
      loginId: '이규탁',
      passwordHash: '1234',
      name: '이규탁',
      department: 'AS팀',
      departmentId: 'DEPT-0000005',
      position: '주임',
      role: 'USER',
      status: 'ACTIVE',
      phone: '010-5511-0014',
      email: 'lkt@ebro.run',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-26T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'u-mechanic',
      loginId: 'mechanic',
      passwordHash: '1234',
      name: '박정비',
      department: 'AS팀',
      departmentId: 'DEPT-0000005',
      position: '정비기장',
      role: 'USER',
      status: 'ACTIVE',
      phone: '010-4455-6677',
      email: 'mechanic@ebro.run',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-26T00:00:00Z',
      tenant_id: 'giyeun'
    }
  ];
  const { error: uErr } = await demo.from('users').upsert(asUsers, { onConflict: 'id' });
  if (uErr) console.error('Users upsert error:', uErr.message);
  else console.log('   -> Upserted 5 AS팀 members (한상찬, 최영석, 장세현, 이규탁, 박정비)');

  // 3. 임차 자산 및 당사 자산 시드 보강 (임차처 배지 및 부품수급 동선 검증용)
  console.log('3. [Demo DB] Seeding Rented & Owned assets for AS & Route RWTT...');
  const demoAssets = [
    {
      id: 'AST-RENT-901',
      assetNo: 'R-901',
      vendorAssetNo: 'KR-901',
      serialNo: 'SN-RENT-901',
      modelName: 'SJ3219',
      manufacturer: 'SKYJACK',
      manufactureYear: 2024,
      ownerType: 'RENTED',
      vendorId: 'VEND-SUB-01',
      supplier: '한국렌탈협동',
      renter: '한국렌탈협동',
      monthlyRentFee: 320000,
      dailyRentFee: 15000,
      monthlyRentalFee: 450000,
      dailyRentalFee: 25000,
      status: 'RENTED',
      cumRepairCost: 0,
      maintenanceScore: 0,
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-10-26T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'AST-RENT-902',
      assetNo: 'R-902',
      vendorAssetNo: 'JB-902',
      serialNo: 'SN-RENT-902',
      modelName: 'SJ3226',
      manufacturer: 'SKYJACK',
      manufactureYear: 2024,
      ownerType: 'RENTED',
      vendorId: 'VEND-SUB-02',
      supplier: '중부고소장비',
      renter: '중부고소장비',
      monthlyRentFee: 420000,
      dailyRentFee: 20000,
      monthlyRentalFee: 580000,
      dailyRentalFee: 30000,
      status: 'RENTED',
      cumRepairCost: 0,
      maintenanceScore: 0,
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-10-26T00:00:00Z',
      tenant_id: 'giyeun'
    }
  ];
  const { error: aErr } = await demo.from('assets').upsert(demoAssets, { onConflict: 'id' });
  if (aErr) console.error('Assets upsert error:', aErr.message);
  else console.log('   -> Upserted rented assets R-901 (한국렌탈협동), R-902 (중부고소장비)');

  // 3-2. 체결 자산(contract_assets) 연결 (임차자산 계약 역추적 및 다수 장비 현장 매핑 검증용)
  const demoContractAssets = [
    {
      id: 'CAST-RENT-901',
      contractId: 'CONTR-0000001',
      assetId: 'AST-RENT-901',
      expectedModel: 'SJ3219',
      monthlyRentalFee: 450000,
      dailyRentalFee: 25000,
      startDate: '2026-10-01',
      endDate: '2026-11-30',
      status: 'RENTED',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-26T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'CAST-OWNED-004',
      contractId: 'CONTR-0000001',
      assetId: 'ASSET-0000004',
      expectedModel: 'JCPT0807AC',
      monthlyRentalFee: 380000,
      dailyRentalFee: 20000,
      startDate: '2026-10-01',
      endDate: '2026-11-30',
      status: 'RENTED',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-26T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'CAST-RENT-902',
      contractId: 'CONTR-0000003',
      assetId: 'AST-RENT-902',
      expectedModel: 'SJ3226',
      monthlyRentalFee: 580000,
      dailyRentalFee: 30000,
      startDate: '2026-10-01',
      endDate: '2026-11-30',
      status: 'RENTED',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-26T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'CAST-RENT-111',
      contractId: 'CONTR-0000004',
      assetId: 'ASSET-DEMO-0111',
      expectedModel: 'GS-1930',
      monthlyRentalFee: 420000,
      dailyRentalFee: 22000,
      startDate: '2026-10-01',
      endDate: '2026-11-30',
      status: 'RENTED',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-26T00:00:00Z',
      tenant_id: 'giyeun'
    },
    {
      id: 'CAST-RENT-112',
      contractId: 'CONTR-0000005',
      assetId: 'ASSET-DEMO-0112',
      expectedModel: 'GS-1930',
      monthlyRentalFee: 420000,
      dailyRentalFee: 22000,
      startDate: '2026-10-01',
      endDate: '2026-11-30',
      status: 'RENTED',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-26T00:00:00Z',
      tenant_id: 'giyeun'
    }
  ];
  const { error: caErr } = await demo.from('contract_assets').upsert(demoContractAssets, { onConflict: 'id' });
  if (caErr) console.error('ContractAssets upsert error:', caErr.message);
  else console.log('   -> Upserted 5 contract_assets rows for rented & owned assets');

  // 4. 다중 로트(consumable_lots) 및 기사 차량 적재 재고(mechanic_consumable_stocks) 시드 준비
  console.log('4. [Demo DB] Seeding multi-lot consumable_lots & mechanic_consumable_stocks...');
  const nowIso = new Date().toISOString();
  const demoLots = [
    {
      id: 'LOT-JOY-SJ-01',
      consumableId: 'c-joy-sj',
      lotNo: 'LOT-202609-01',
      inboundDate: '2026-09-01',
      receivedDate: '2026-09-01',
      unitPrice: 260000,
      unitCost: 260000,
      initialQty: 20,
      currentQty: 10,
      remainingQty: 10,
      createdAt: nowIso,
      updatedAt: nowIso,
      tenant_id: 'giyeun'
    },
    {
      id: 'LOT-JOY-SJ-02',
      consumableId: 'c-joy-sj',
      lotNo: 'LOT-202610-02',
      inboundDate: '2026-10-01',
      receivedDate: '2026-10-01',
      unitPrice: 280000,
      unitCost: 280000,
      initialQty: 20,
      currentQty: 15,
      remainingQty: 15,
      createdAt: nowIso,
      updatedAt: nowIso,
      tenant_id: 'giyeun'
    },
    {
      id: 'LOT-LIM-SW-01',
      consumableId: 'c-lim-sw',
      lotNo: 'LOT-202609-SW1',
      inboundDate: '2026-09-05',
      receivedDate: '2026-09-05',
      unitPrice: 32000,
      unitCost: 32000,
      initialQty: 50,
      currentQty: 25,
      remainingQty: 25,
      createdAt: nowIso,
      updatedAt: nowIso,
      tenant_id: 'giyeun'
    },
    {
      id: 'LOT-LIM-SW-02',
      consumableId: 'c-lim-sw',
      lotNo: 'LOT-202610-SW2',
      inboundDate: '2026-10-05',
      receivedDate: '2026-10-05',
      unitPrice: 35000,
      unitCost: 35000,
      initialQty: 50,
      currentQty: 30,
      remainingQty: 30,
      createdAt: nowIso,
      updatedAt: nowIso,
      tenant_id: 'giyeun'
    },
    {
      id: 'LOT-FOOT-SW-01',
      consumableId: 'c-foot-sw',
      lotNo: 'LOT-202610-FS1',
      inboundDate: '2026-10-01',
      receivedDate: '2026-10-01',
      unitPrice: 48000,
      unitCost: 48000,
      initialQty: 40,
      currentQty: 30,
      remainingQty: 30,
      createdAt: nowIso,
      updatedAt: nowIso,
      tenant_id: 'giyeun'
    },
    {
      id: 'LOT-RELAY-24-01',
      consumableId: 'c-relay-24',
      lotNo: 'LOT-202610-RL1',
      inboundDate: '2026-10-01',
      receivedDate: '2026-10-01',
      unitPrice: 55000,
      unitCost: 55000,
      initialQty: 40,
      currentQty: 30,
      remainingQty: 30,
      createdAt: nowIso,
      updatedAt: nowIso,
      tenant_id: 'giyeun'
    }
  ];
  const { error: lotErr } = await demo.from('consumable_lots').upsert(demoLots, { onConflict: 'id' });
  if (lotErr) console.error('Lots upsert error:', lotErr.message);

  // 각 AS팀 기사별 차량 소모품 다중 로트 적재 재고
  const mechanicIds = ['USR-0000011', 'USR-0000012', 'USR-0000013', 'USR-0000014', 'u-mechanic'];
  const vehicleStocks = [];
  for (const mId of mechanicIds) {
    vehicleStocks.push(
      {
        id: `MCS-${mId}-JOY1`,
        mechanicId: mId,
        consumableId: 'c-joy-sj',
        lotId: 'LOT-JOY-SJ-01',
        stockQty: 2, // 1차 구형 로트 2개 (단가 260,000)
        createdAt: '2026-09-10T00:00:00Z',
        updatedAt: nowIso,
        tenant_id: 'giyeun'
      },
      {
        id: `MCS-${mId}-JOY2`,
        mechanicId: mId,
        consumableId: 'c-joy-sj',
        lotId: 'LOT-JOY-SJ-02',
        stockQty: 15, // 2차 신형 로트 15개 (단가 280,000)
        createdAt: '2026-10-10T00:00:00Z',
        updatedAt: nowIso,
        tenant_id: 'giyeun'
      },
      {
        id: `MCS-${mId}-LIM1`,
        mechanicId: mId,
        consumableId: 'c-lim-sw',
        lotId: 'LOT-LIM-SW-01',
        stockQty: 1, // 1차 로트 1개 (단가 32,000) -> 2개 이상 소진 시 다중 로트 FIFO 차감 검증!
        createdAt: '2026-09-10T00:00:00Z',
        updatedAt: nowIso,
        tenant_id: 'giyeun'
      },
      {
        id: `MCS-${mId}-LIM2`,
        mechanicId: mId,
        consumableId: 'c-lim-sw',
        lotId: 'LOT-LIM-SW-02',
        stockQty: 25, // 2차 로트 25개 (단가 35,000)
        createdAt: '2026-10-10T00:00:00Z',
        updatedAt: nowIso,
        tenant_id: 'giyeun'
      },
      {
        id: `MCS-${mId}-FOOT1`,
        mechanicId: mId,
        consumableId: 'c-foot-sw',
        lotId: 'LOT-FOOT-SW-01',
        stockQty: 20,
        createdAt: '2026-10-10T00:00:00Z',
        updatedAt: nowIso,
        tenant_id: 'giyeun'
      },
      {
        id: `MCS-${mId}-RLY1`,
        mechanicId: mId,
        consumableId: 'c-relay-24',
        lotId: 'LOT-RELAY-24-01',
        stockQty: 20,
        createdAt: '2026-10-10T00:00:00Z',
        updatedAt: nowIso,
        tenant_id: 'giyeun'
      }
    );
  }
  const { error: mcsErr } = await demo.from('mechanic_consumable_stocks').upsert(vehicleStocks, { onConflict: 'id' });
  if (mcsErr) console.error('MCS upsert error:', mcsErr.message);
  else console.log(`   -> Upserted ${vehicleStocks.length} multi-lot vehicle stock rows across 5 mechanics`);

  console.log('✅ Demo DB schema & AS/Consumable seed preparation complete!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
