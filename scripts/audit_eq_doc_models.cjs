const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Supabase에서 현재 등록된 제품(products) 목록 조회
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

const R2_CONFIGS = [
  {
    name: 'giyeon-storage (기연 기본 버킷)',
    accountId: '35014a2514680107d74e1e68d96e6c32',
    bucketName: 'giyeon-storage',
    accessKeyId: '03cdb7560d37242de608a5db2a976030',
    secretAccessKey: 'b2407ab4532e02317860bc3d63226fb7bc232e88083b150c15023906ed141986',
    publicDomain: 'https://pub-55a68547bdf24600b80d27782912c83e.r2.dev'
  },
  {
    name: 'dragonrpa (전사 클라우드 버킷)',
    accountId: '35014a2514680107d74e1e68d96e6c32',
    bucketName: 'dragonrpa',
    accessKeyId: '03cdb7560d37242de608a5db2a976030',
    secretAccessKey: 'b2407ab4532e02317860bc3d63226fb7bc232e88083b150c15023906ed141986',
    publicDomain: 'https://pub-4bd1b65a7bcc4eef8993da27e7362727.r2.dev'
  }
];

async function listR2EqDocFolders(config) {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });

  let isTruncated = true;
  let continuationToken = undefined;
  const allKeys = [];

  try {
    while (isTruncated) {
      const cmd = new ListObjectsV2Command({
        Bucket: config.bucketName,
        Prefix: 'Eq_doc/',
        ContinuationToken: continuationToken
      });
      const res = await client.send(cmd);
      if (res.Contents) {
        res.Contents.forEach(c => allKeys.push(c.Key));
      }
      isTruncated = res.IsTruncated;
      continuationToken = res.NextContinuationToken;
    }
    return { success: true, keys: allKeys, error: null };
  } catch (e) {
    return { success: false, keys: [], error: e.message };
  }
}

async function runAudit() {
  console.log('====================================================');
  console.log('🔍 [CF R2 Eq_doc vs DB 등록 모델명 대사 분석]');
  console.log('====================================================\n');

  // 1. DB products 조회
  const { data: dbProducts, error: pErr } = await supabase.from('products').select('*');
  if (pErr) {
    console.error('DB products 조회 실패:', pErr.message);
    return;
  }

  const dbModelList = dbProducts.map(p => ({
    id: p.id,
    modelName: p.modelName,
    manufacturer: p.manufacturer,
    feet: p.feet,
    spec: p.spec,
    specSheetUrl: p.specSheetUrl,
    safetyCertUrl: p.safetyCertUrl,
    emergencyGuideUrl: p.emergencyGuideUrl
  }));

  console.log(`📋 DB 등록 모델 수: ${dbModelList.length}개 모델`);

  // 2. 각 R2 버킷 스캔
  for (const cfg of R2_CONFIGS) {
    console.log(`\n☁️  [버킷 스캔] ${cfg.name} (${cfg.bucketName})`);
    const { success, keys, error } = await listR2EqDocFolders(cfg);
    if (!success) {
      console.log(`  ❌ 스캔 실패: ${error}`);
      continue;
    }

    console.log(`  ✓ Eq_doc/ 하위 총 파일/객체 수: ${keys.length}개`);

    // Eq_doc/{모델명}/... 구조에서 모델명 추출
    const r2ModelMap = new Map(); // modelName -> file list
    keys.forEach(k => {
      // k: Eq_doc/{modelName}/{fileName} or Eq_doc/Z-45/25J/{fileName}
      if (!k.startsWith('Eq_doc/')) return;
      const subKey = k.slice('Eq_doc/'.length);
      const lastSlashIdx = subKey.lastIndexOf('/');
      if (lastSlashIdx > 0) {
        const modelFolder = subKey.slice(0, lastSlashIdx);
        const fileName = subKey.slice(lastSlashIdx + 1);
        if (!r2ModelMap.has(modelFolder)) {
          r2ModelMap.set(modelFolder, []);
        }
        r2ModelMap.get(modelFolder).push(fileName);
      }
    });

    const r2Models = Array.from(r2ModelMap.keys());
    console.log(`  ✓ R2에 존재하는 Eq_doc 모델 폴더 수: ${r2Models.length}개`);

    // 대사 분석 (정규화 대조: 공백 제거, 대소문자 무시, 특수문자 정규화)
    function normalizeModel(m) {
      return String(m || '').replace(/[\s\-_]/g, '').toUpperCase();
    }

    const r2NormMap = new Map();
    r2Models.forEach(m => {
      r2NormMap.set(normalizeModel(m), { rawName: m, files: r2ModelMap.get(m) });
    });

    // 1) DB에는 있으나 R2 Eq_doc 에 없는 모델 (문서 누락 모델)
    const missingInR2 = [];
    const matchedModels = [];

    dbModelList.forEach(dbProd => {
      const norm = normalizeModel(dbProd.modelName);
      if (r2NormMap.has(norm)) {
        const r2Info = r2NormMap.get(norm);
        matchedModels.push({
          dbModel: dbProd.modelName,
          r2Folder: r2Info.rawName,
          files: r2Info.files,
          manufacturer: dbProd.manufacturer,
          feet: dbProd.feet,
          id: dbProd.id
        });
      } else {
        missingInR2.push({
          dbModel: dbProd.modelName,
          manufacturer: dbProd.manufacturer,
          feet: dbProd.feet,
          spec: dbProd.spec,
          id: dbProd.id
        });
      }
    });

    // 2) R2에는 있으나 DB products 에는 미등록된 모델
    const dbNormSet = new Set(dbModelList.map(p => normalizeModel(p.modelName)));
    const extraInR2 = [];
    r2Models.forEach(m => {
      const norm = normalizeModel(m);
      if (!dbNormSet.has(norm)) {
        extraInR2.push({
          r2Folder: m,
          files: r2ModelMap.get(m)
        });
      }
    });

    // 결과 파일 저장
    const auditResult = {
      bucketConfig: {
        bucketName: cfg.bucketName,
        publicDomain: cfg.publicDomain
      },
      summary: {
        dbProductCount: dbModelList.length,
        r2EqDocFolderCount: r2Models.length,
        matchedCount: matchedModels.length,
        missingInR2Count: missingInR2.length,
        extraInR2Count: extraInR2.length
      },
      missingInR2: missingInR2,
      matchedModels: matchedModels,
      extraInR2: extraInR2
    };

    const outPath = path.join(__dirname, `../scratch_eq_doc_audit_${cfg.bucketName}.json`);
    fs.writeFileSync(outPath, JSON.stringify(auditResult, null, 2), 'utf8');

    console.log(`\n====================================================`);
    console.log(`📊 [${cfg.name}] 대사 집계 결과`);
    console.log(`- DB 등록 모델 수: ${dbModelList.length}개`);
    console.log(`- R2 Eq_doc 폴더 수: ${r2Models.length}개`);
    console.log(`- 1:1 매칭 완료 (문서 보유): ${matchedModels.length}개 모델`);
    console.log(`- ⚠️ R2 문서고에 없는 모델 (누락): ${missingInR2.length}개 모델`);
    console.log(`- 💡 R2에는 있으나 DB에 미등록된 모델: ${extraInR2.length}개 모델`);
    console.log(`====================================================\n`);
  }
}

runAudit().catch(err => {
  console.error('대사 오류:', err);
});
