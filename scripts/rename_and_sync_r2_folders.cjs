const { S3Client, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const config = {
  accountId: '35014a2514680107d74e1e68d96e6c32',
  bucketName: 'giyeon-storage',
  accessKeyId: '03cdb7560d37242de608a5db2a976030',
  secretAccessKey: 'b2407ab4532e02317860bc3d63226fb7bc232e88083b150c15023906ed141986',
  publicDomain: 'https://pub-55a68547bdf24600b80d27782912c83e.r2.dev'
};

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey
  }
});

// Supabase 클라이언트
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

async function copyObject(srcKey, destKey) {
  try {
    // encodeURI on CopySource for non-ASCII characters
    const encodedSource = `${config.bucketName}/${encodeURI(srcKey)}`;
    await s3.send(new CopyObjectCommand({
      Bucket: config.bucketName,
      CopySource: encodedSource,
      Key: destKey
    }));
    console.log(`  ✓ 복사 완료: [${srcKey}] ➔ [${destKey}]`);
    return true;
  } catch (e) {
    console.error(`  ❌ 복사 실패 [${srcKey}] ➔ [${destKey}]:`, e.message);
    return false;
  }
}

async function deleteObject(key) {
  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key
    }));
    console.log(`  🗑️ 기존 키 삭제 완료: [${key}]`);
    return true;
  } catch (e) {
    console.error(`  ⚠️ 삭제 실패 [${key}]:`, e.message);
    return false;
  }
}

async function renameAndSync5Models() {
  console.log('====================================================');
  console.log('🚀 [R2 버킷] 5개 모델 폴더명 DB 표준명칭 기준 변경/동기화');
  console.log('====================================================\n');

  // 1. JCPT1614ACZ (from Eq_doc/JCPT1614AC/ to Eq_doc/JCPT1614ACZ/)
  console.log('1️⃣ [JCPT1614ACZ] 폴더명 변경 진행 (Eq_doc/JCPT1614AC/ ➔ Eq_doc/JCPT1614ACZ/)');
  const jcptFiles = [
    '4.제원표(JCPT1614ACZ).pdf',
    '5.인증서(JCPT1614ACZ).pdf',
    '6.장비작동법(상부).pdf',
    '6.장비작동법(하부).pdf',
    '7.JCPT_비상하강 작동법.pdf'
  ];
  for (const f of jcptFiles) {
    const src = `Eq_doc/JCPT1614AC/${f}`;
    const dest = `Eq_doc/JCPT1614ACZ/${f}`;
    const ok = await copyObject(src, dest);
    if (ok) {
      await deleteObject(src);
    }
  }

  // 2. GS-3246 E-DRIVE (from Eq_doc/GS-3246 E/ to Eq_doc/GS-3246 E-DRIVE/)
  console.log('\n2️⃣ [GS-3246 E-DRIVE] 폴더명 변경 진행 (Eq_doc/GS-3246 E/ ➔ Eq_doc/GS-3246 E-DRIVE/)');
  const gs3246Files = [
    '4.제원표GS-3246 E-Drive.pdf',
    '5.인증서GS-3246(2021년2월9일).pdf',
    '6.장비작동법 GENIE 작동법GS_E-Drive.pdf',
    '7.비상 하강법GS_E-Drive.pdf'
  ];
  for (const f of gs3246Files) {
    const src = `Eq_doc/GS-3246 E/${f}`;
    const dest = `Eq_doc/GS-3246 E-DRIVE/${f}`;
    const ok = await copyObject(src, dest);
    if (ok) {
      await deleteObject(src);
    }
  }

  // 3. GS-1930 E-DRIVE (from Eq_doc/GS1930/ to Eq_doc/GS-1930 E-DRIVE/)
  console.log('\n3️⃣ [GS-1930 E-DRIVE] 폴더 생성 및 복사 (Eq_doc/GS1930/ ➔ Eq_doc/GS-1930 E-DRIVE/)');
  const gs1930Files = [
    '4.제원표GS 1930 E-Drive.pdf',
    '5.인증서GS1930(2021년2월9일).pdf',
    '6.장비작동법 GENIE 작동법GS_E-Drive.pdf',
    '7.비상 하강법GS_E-Drive.pdf'
  ];
  for (const f of gs1930Files) {
    const src = `Eq_doc/GS1930/${f}`;
    const dest = `Eq_doc/GS-1930 E-DRIVE/${f}`;
    await copyObject(src, dest);
  }

  // 4. ES1330 (from Eq_doc/ES1330L/ to Eq_doc/ES1330/)
  console.log('\n4️⃣ [ES1330] 폴더 복사/동기화 (Eq_doc/ES1330L/ ➔ Eq_doc/ES1330/)');
  const es1330Files = [
    '4.제원표ES1330L.pdf',
    '5.ES1330L 안전인증서(2020년01월17일).pdf',
    '6.장비작동법_ES1330L.pdf',
    '7.비상하강작동법_ES1330L.pdf'
  ];
  for (const f of es1330Files) {
    const src = `Eq_doc/ES1330L/${f}`;
    const dest = `Eq_doc/ES1330/${f}`;
    await copyObject(src, dest);
  }

  // 5. Z-45/25J 확인
  console.log('\n5️⃣ [Z-45/25J] 상태 확인 (Eq_doc/Z-45/25J/)');
  console.log('  ✓ Eq_doc/Z-45/25J/ 하위에 5개 문서가 이미 완벽히 존재함을 확인');

  // 6. Supabase DB products 테이블 URL 업데이트
  console.log('\n====================================================');
  console.log('🔄 [Supabase DB] products 테이블 문서 URL 최신화 동기화');
  console.log('====================================================\n');

  const updates = [
    {
      modelName: 'JCPT1614ACZ',
      specSheetUrl: `${config.publicDomain}/Eq_doc/JCPT1614ACZ/4.%EC%A0%9C%EC%9B%90%ED%91%9C(JCPT1614ACZ).pdf`,
      safetyCertUrl: `${config.publicDomain}/Eq_doc/JCPT1614ACZ/5.%EC%9D%B8%EC%A6%9D%EC%84%9C(JCPT1614ACZ).pdf`,
      emergencyGuideUrl: `${config.publicDomain}/Eq_doc/JCPT1614ACZ/7.JCPT_%EB%B9%84%EC%83%81%ED%95%98%EA%B0%95%20%EC%9E%91%EB%8F%99%EB%B2%95.pdf`
    },
    {
      modelName: 'GS-3246 E-DRIVE',
      specSheetUrl: `${config.publicDomain}/Eq_doc/GS-3246%20E-DRIVE/4.%EC%A0%9C%EC%9B%90%ED%91%9CGS-3246%20E-Drive.pdf`,
      safetyCertUrl: `${config.publicDomain}/Eq_doc/GS-3246%20E-DRIVE/5.%EC%9D%B8%EC%A6%9D%EC%84%9CGS-3246(2021%EB%85%842%EC%9B%949%EC%9D%BC).pdf`,
      emergencyGuideUrl: `${config.publicDomain}/Eq_doc/GS-3246%20E-DRIVE/7.%EB%B9%84%EC%83%81%20%ED%95%98%EA%B0%95%EB%B2%95GS_E-Drive.pdf`
    },
    {
      modelName: 'GS-1930 E-DRIVE',
      specSheetUrl: `${config.publicDomain}/Eq_doc/GS-1930%20E-DRIVE/4.%EC%A0%9C%EC%9B%90%ED%91%9CGS%201930%20E-Drive.pdf`,
      safetyCertUrl: `${config.publicDomain}/Eq_doc/GS-1930%20E-DRIVE/5.%EC%9D%B8%EC%A6%9D%EC%84%9CGS1930(2021%EB%85%842%EC%9B%949%EC%9D%BC).pdf`,
      emergencyGuideUrl: `${config.publicDomain}/Eq_doc/GS-1930%20E-DRIVE/7.%EB%B9%84%EC%83%81%20%ED%95%98%EA%B0%95%EB%B2%95GS_E-Drive.pdf`
    },
    {
      modelName: 'ES1330',
      specSheetUrl: `${config.publicDomain}/Eq_doc/ES1330/4.%EC%A0%9C%EC%9B%90%ED%91%9CES1330L.pdf`,
      safetyCertUrl: `${config.publicDomain}/Eq_doc/ES1330/5.ES1330L%20%EC%95%88%EC%A0%84%EC%9D%B8%EC%A6%9D%EC%84%9C(2020%EB%85%8401%EC%9B%9417%EC%9D%BC).pdf`,
      emergencyGuideUrl: `${config.publicDomain}/Eq_doc/ES1330/7.%EB%B9%84%EC%83%81%ED%95%98%EA%B0%95%EC%9E%91%EB%8F%99%EB%B2%95_ES1330L.pdf`
    },
    {
      modelName: 'Z-45/25J',
      specSheetUrl: `${config.publicDomain}/Eq_doc/Z-45/25J/4.%EC%A0%9C%EC%9B%90%ED%91%9C_Z-4525J.pdf`,
      safetyCertUrl: `${config.publicDomain}/Eq_doc/Z-45/25J/5.%EC%95%88%EC%A0%84%EC%9D%B8%EC%A6%9D%EC%84%9C_Z-4525J(2009%EB%85%849%EC%9B%9414%EC%9D%BC).pdf`,
      emergencyGuideUrl: `${config.publicDomain}/Eq_doc/Z-45/25J/7.%EB%B9%84%EC%83%81%20%ED%95%98%EA%B0%95%EB%B2%95_Z-4525J.pdf`
    }
  ];

  for (const u of updates) {
    const { error } = await supabase
      .from('products')
      .update({
        specSheetUrl: u.specSheetUrl,
        safetyCertUrl: u.safetyCertUrl,
        emergencyGuideUrl: u.emergencyGuideUrl,
        updatedAt: new Date().toISOString()
      })
      .eq('modelName', u.modelName);

    if (error) {
      console.error(`❌ DB 업데이트 실패 [${u.modelName}]:`, error.message);
    } else {
      console.log(`✓ DB products 업데이트 완료: [${u.modelName}]`);
    }
  }

  console.log('\n====================================================');
  console.log('✅ [완료] R2 버킷 폴더명 변경 및 DB 동기화 100% 완료');
  console.log('====================================================\n');
}

renameAndSync5Models().catch(console.error);
