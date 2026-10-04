const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. R2 설정
const r2Config = {
  accountId: '35014a2514680107d74e1e68d96e6c32',
  bucketName: 'giyeon-storage',
  accessKeyId: '03cdb7560d37242de608a5db2a976030',
  secretAccessKey: 'b2407ab4532e02317860bc3d63226fb7bc232e88083b150c15023906ed141986',
  publicDomain: 'https://pub-55a68547bdf24600b80d27782912c83e.r2.dev'
};

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: r2Config.accessKeyId,
    secretAccessKey: r2Config.secretAccessKey
  }
});

// 2. Supabase 설정
const envPath = path.join(__dirname, '../.env');
let supabaseUrl = '';
let supabaseAnonKey = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) {
      if (k.trim() === 'VITE_SUPABASE_URL') supabaseUrl = v.trim();
      if (k.trim() === 'VITE_SUPABASE_ANON_KEY') supabaseAnonKey = v.trim();
    }
  });
}
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function normalizeModel(m) {
  return String(m || '').replace(/[\s\-_]/g, '').toUpperCase();
}

async function upsertPreparedSpecData() {
  console.log('====================================================');
  console.log('🚀 [제원표 정보 일괄 업서트] R2 실물 문서 & 백업 제원 데이터 통합');
  console.log('====================================================\n');

  // 1. R2 버킷의 Eq_doc 전체 파일 스캔
  console.log('1️⃣ Cloudflare R2 Eq_doc/ 전체 파일 스캔 중...');
  let isTruncated = true;
  let continuationToken = undefined;
  const r2ModelDocs = new Map(); // normModel -> { specUrl, certUrl, guideUrl, rawFolder }

  while (isTruncated) {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: r2Config.bucketName,
      Prefix: 'Eq_doc/',
      ContinuationToken: continuationToken
    }));

    if (res.Contents) {
      res.Contents.forEach(c => {
        const key = c.Key;
        if (!key.startsWith('Eq_doc/')) return;
        const subKey = key.slice('Eq_doc/'.length);
        const lastSlashIdx = subKey.lastIndexOf('/');
        if (lastSlashIdx <= 0) return;

        const modelFolder = subKey.slice(0, lastSlashIdx);
        const fileName = subKey.slice(lastSlashIdx + 1);
        if (!fileName) return;

        const norm = normalizeModel(modelFolder);
        if (!r2ModelDocs.has(norm)) {
          r2ModelDocs.set(norm, { rawFolder: modelFolder });
        }
        const docEntry = r2ModelDocs.get(norm);
        const fileUrl = `${r2Config.publicDomain}/Eq_doc/${encodeURI(modelFolder)}/${encodeURI(fileName)}`;

        // 제원표 (4.* or 제원표)
        if (fileName.includes('4.') || fileName.includes('제원표') || fileName.toLowerCase().includes('spec')) {
          docEntry.specUrl = fileUrl;
        }
        // 안전인증서 (5.* or 인증서)
        if (fileName.includes('5.') || fileName.includes('인증서') || fileName.toLowerCase().includes('cert')) {
          docEntry.certUrl = fileUrl;
        }
        // 비상조작/작동법 (6.*, 7.*, 작동법, 하강법)
        if (fileName.includes('6.') || fileName.includes('7.') || fileName.includes('작동') || fileName.includes('하강') || fileName.toLowerCase().includes('guide')) {
          if (!docEntry.guideUrl || fileName.includes('7.') || fileName.includes('비상')) {
            docEntry.guideUrl = fileUrl;
          }
        }
      });
    }

    isTruncated = res.IsTruncated;
    continuationToken = res.NextContinuationToken;
  }
  console.log(`✓ R2 문서고에서 ${r2ModelDocs.size}개 모델 문서 링크 추출 완료\n`);

  // 2. 백업 파일 내 기존 제원표 마스터 로드
  console.log('2️⃣ 백업 파일(db_49_tables_full_backup) 내 제원표 데이터 로드 중...');
  const backupPath = path.join(__dirname, '../backups/db_49_tables_full_backup_2026-08-31T09-17-28-862Z.json');
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const backupProducts = backup.products || [];
  const backupProductMap = new Map();
  backupProducts.forEach(p => {
    backupProductMap.set(normalizeModel(p.modelName), p);
  });
  console.log(`✓ 백업에서 ${backupProducts.length}개 제품 제원 데이터 로드 완료\n`);

  // 3. 현재 DB products 목록 조회
  console.log('3️⃣ 현재 Supabase DB products 목록 조회 중...');
  const { data: dbProducts, error: pErr } = await supabase.from('products').select('*');
  if (pErr) {
    console.error('DB 조회 실패:', pErr.message);
    return;
  }
  console.log(`✓ 현재 DB 등록 제품 수: ${dbProducts.length}개\n`);

  // 4. 데이터 병합 및 정밀 업서트 생성
  console.log('4️⃣ 제원표 데이터 통합 및 정밀 업서트 빌드 중...');
  const upsertList = [];
  const nowIso = new Date().toISOString();

  // A) 현재 DB에 있는 51개 제품 업데이트
  dbProducts.forEach(prod => {
    const norm = normalizeModel(prod.modelName);
    const backupData = backupProductMap.get(norm) || {};
    const r2Doc = r2ModelDocs.get(norm) || {};

    const cleanSpecUrl = r2Doc.specUrl || (backupData.specSheetUrl && !backupData.specSheetUrl.startsWith('샘플_') ? backupData.specSheetUrl : null) || prod.specSheetUrl;
    const cleanCertUrl = r2Doc.certUrl || (backupData.safetyCertUrl && !backupData.safetyCertUrl.startsWith('샘플_') ? backupData.safetyCertUrl : null) || prod.safetyCertUrl;
    const cleanGuideUrl = r2Doc.guideUrl || (backupData.emergencyGuideUrl && !backupData.emergencyGuideUrl.startsWith('샘플_') ? backupData.emergencyGuideUrl : null) || prod.emergencyGuideUrl;

    const merged = {
      id: prod.id,
      modelName: prod.modelName,
      feet: prod.feet || backupData.feet || 19,
      spec: backupData.spec || prod.spec || `${prod.feet || 19}ft 고소작업대`,
      manufacturer: backupData.manufacturer || prod.manufacturer || '기타제조사',
      powerSource: backupData.powerSource || prod.powerSource || '배터리',
      workingHeight: backupData.workingHeight || prod.workingHeight || null,
      platformHeight: backupData.platformHeight || prod.platformHeight || null,
      weight: backupData.weight || prod.weight || null,
      capacityPreExt: backupData.capacityPreExt || prod.capacityPreExt || '230 kg',
      capacityPostExtMain: backupData.capacityPostExtMain || prod.capacityPostExtMain || null,
      capacityPostExtDeck: backupData.capacityPostExtDeck || prod.capacityPostExtDeck || null,
      machineDimensions: backupData.machineDimensions || prod.machineDimensions || null,
      platformDimensions: backupData.platformDimensions || prod.platformDimensions || null,
      gradeability: backupData.gradeability || prod.gradeability || null,
      speed: backupData.speed || prod.speed || null,
      asContact: backupData.asContact || prod.asContact || '031-334-5296',
      maxWindSpeed: backupData.maxWindSpeed || prod.maxWindSpeed || '12.5 m/s 이내',
      maxHeightCapacity: backupData.maxHeightCapacity || prod.maxHeightCapacity || null,
      safetyCertDate: backupData.safetyCertDate || prod.safetyCertDate || null,
      specSheetUrl: cleanSpecUrl,
      safetyCertUrl: cleanCertUrl,
      emergencyGuideUrl: cleanGuideUrl,
      isActive: true,
      createdAt: prod.createdAt || nowIso,
      updatedAt: nowIso
    };

    upsertList.push(merged);
  });

  // B) 백업에 있었으나 현재 DB에 없는 추가 모델들도 선제 등록
  const existingNorms = new Set(dbProducts.map(p => normalizeModel(p.modelName)));
  backupProducts.forEach(bp => {
    const norm = normalizeModel(bp.modelName);
    if (!existingNorms.has(norm)) {
      const r2Doc = r2ModelDocs.get(norm) || {};
      const cleanSpecUrl = r2Doc.specUrl || (bp.specSheetUrl && !bp.specSheetUrl.startsWith('샘플_') ? bp.specSheetUrl : null);
      const cleanCertUrl = r2Doc.certUrl || (bp.safetyCertUrl && !bp.safetyCertUrl.startsWith('샘플_') ? bp.safetyCertUrl : null);
      const cleanGuideUrl = r2Doc.guideUrl || (bp.emergencyGuideUrl && !bp.emergencyGuideUrl.startsWith('샘플_') ? bp.emergencyGuideUrl : null);

      upsertList.push({
        id: bp.id,
        modelName: bp.modelName,
        feet: bp.feet || 19,
        spec: bp.spec || '고소작업대',
        manufacturer: bp.manufacturer || '기타제조사',
        powerSource: bp.powerSource || '배터리',
        workingHeight: bp.workingHeight || null,
        platformHeight: bp.platformHeight || null,
        weight: bp.weight || null,
        capacityPreExt: bp.capacityPreExt || '230 kg',
        capacityPostExtMain: bp.capacityPostExtMain || null,
        capacityPostExtDeck: bp.capacityPostExtDeck || null,
        machineDimensions: bp.machineDimensions || null,
        platformDimensions: bp.platformDimensions || null,
        gradeability: bp.gradeability || null,
        speed: bp.speed || null,
        asContact: bp.asContact || '031-334-5296',
        maxWindSpeed: bp.maxWindSpeed || '12.5 m/s 이내',
        maxHeightCapacity: bp.maxHeightCapacity || null,
        safetyCertDate: bp.safetyCertDate || null,
        specSheetUrl: cleanSpecUrl,
        safetyCertUrl: cleanCertUrl,
        emergencyGuideUrl: cleanGuideUrl,
        isActive: bp.isActive !== false,
        createdAt: bp.createdAt || nowIso,
        updatedAt: nowIso
      });
      existingNorms.add(norm);
    }
  });

  console.log(`✓ 총 ${upsertList.length}개 모델에 대한 제원표/문서 통합 레코드 구성 완료\n`);

  // 5. Supabase DB 일괄 업서트 집행
  console.log('5️⃣ Supabase DB products 테이블에 일괄 업서트 실행 중...');
  for (let i = 0; i < upsertList.length; i += 50) {
    const chunk = upsertList.slice(i, i + 50);
    const { error: uErr } = await supabase.from('products').upsert(chunk, { onConflict: 'id' });
    if (uErr) {
      console.error(`❌ 청크 ${i / 50 + 1} 업서트 실패:`, uErr.message);
      throw uErr;
    }
  }

  console.log('\n====================================================');
  console.log('✅ [제원표 정보 일괄 업서트 완결]');
  console.log(`- 업서트 완료 모델 수: 총 ${upsertList.length}개 모델`);
  console.log(`- 제원표 URL 연결 모델 수: ${upsertList.filter(p => p.specSheetUrl).length}개`);
  console.log(`- 안전인증서 URL 연결 모델 수: ${upsertList.filter(p => p.safetyCertUrl).length}개`);
  console.log(`- 비상하강법 URL 연결 모델 수: ${upsertList.filter(p => p.emergencyGuideUrl).length}개`);
  console.log(`- 상세 치수/중량 보유 모델 수: ${upsertList.filter(p => p.workingHeight || p.weight).length}개`);
  console.log('====================================================\n');
}

upsertPreparedSpecData().catch(console.error);
