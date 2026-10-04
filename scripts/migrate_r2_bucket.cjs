const { S3Client, CopyObjectCommand, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');

const config = {
  accountId: '35014a2514680107d74e1e68d96e6c32',
  sourceBucket: 'kiyeun-storage',
  targetBucket: 'giyeon-storage',
  accessKeyId: '03cdb7560d37242de608a5db2a976030',
  secretAccessKey: 'b2407ab4532e02317860bc3d63226fb7bc232e88083b150c15023906ed141986'
};

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey
  }
});

async function listAllObjects(bucketName) {
  let objects = [];
  let continuationToken = undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken
    }));
    if (res.Contents) {
      objects.push(...res.Contents);
    }
    continuationToken = res.NextContinuationToken;
  } while (continuationToken);
  return objects;
}

async function run() {
  console.log('====================================================');
  console.log(`[R2 버킷 마이그레이션] 시작`);
  console.log(`- 원본: ${config.sourceBucket}`);
  console.log(`- 대상: ${config.targetBucket}`);
  console.log('====================================================');

  console.log(`\n1. 원본 버킷(${config.sourceBucket}) 객체 조회 중...`);
  const srcObjects = await listAllObjects(config.sourceBucket);
  console.log(`-> 총 ${srcObjects.length}개 객체 발견.`);

  const totalSrcBytes = srcObjects.reduce((acc, obj) => acc + (obj.Size || 0), 0);
  console.log(`-> 총 용량: ${(totalSrcBytes / (1024 * 1024)).toFixed(2)} MB`);

  console.log(`\n2. 대상 버킷(${config.targetBucket}) 기존 객체 확인 중...`);
  const existingTargetObjects = await listAllObjects(config.targetBucket);
  console.log(`-> 현재 대상 버킷에 ${existingTargetObjects.length}개 객체 존재.`);

  const existingMap = new Set(existingTargetObjects.map(o => o.Key));

  console.log(`\n3. 대상 버킷(${config.targetBucket})으로 복사 진행...`);
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (let i = 0; i < srcObjects.length; i++) {
    const obj = srcObjects[i];
    const key = obj.Key;

    if (existingMap.has(key)) {
      skipCount++;
      continue;
    }

    try {
      // S3 CopySource 형식: BucketName/Key (Key는 URL 인코딩 필요)
      const encodedSource = `${config.sourceBucket}/${encodeURI(key)}`;
      await s3.send(new CopyObjectCommand({
        Bucket: config.targetBucket,
        CopySource: encodedSource,
        Key: key
      }));
      successCount++;
      if (successCount % 20 === 0 || successCount === srcObjects.length) {
        console.log(`  [${i + 1}/${srcObjects.length}] 복사 진행 중... (${successCount} 완료)`);
      }
    } catch (err) {
      console.error(`  ❌ 복사 실패 [${key}]: ${err.message}`);
      failCount++;
    }
  }

  console.log('\n====================================================');
  console.log(`[복사 작업 완료 요약]`);
  console.log(`- 성공: ${successCount}건`);
  console.log(`- 기 존재 (스킵): ${skipCount}건`);
  console.log(`- 실패: ${failCount}건`);
  console.log('====================================================');

  console.log(`\n4. 대상 버킷 검증 조회 중...`);
  const targetObjects = await listAllObjects(config.targetBucket);
  const totalTargetBytes = targetObjects.reduce((acc, obj) => acc + (obj.Size || 0), 0);
  console.log(`-> 대상 버킷(${config.targetBucket}) 최종 객체 수: ${targetObjects.length}개`);
  console.log(`-> 대상 버킷 총 용량: ${(totalTargetBytes / (1024 * 1024)).toFixed(2)} MB`);

  if (targetObjects.length === srcObjects.length) {
    console.log(`\n🎉 [성공] 원본과 대상 버킷의 파일 수가 100% 일치합니다! (${targetObjects.length}/${srcObjects.length})`);
  } else {
    console.warn(`\n⚠️ [주의] 원본(${srcObjects.length})과 대상(${targetObjects.length})의 객체 수가 다릅니다. 확인 필요.`);
  }
}

run().catch(err => {
  console.error('치명적 에러:', err);
  process.exit(1);
});
