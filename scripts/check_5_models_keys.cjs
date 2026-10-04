const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const config = {
  accountId: '35014a2514680107d74e1e68d96e6c32',
  bucketName: 'giyeon-storage',
  accessKeyId: '03cdb7560d37242de608a5db2a976030',
  secretAccessKey: 'b2407ab4532e02317860bc3d63226fb7bc232e88083b150c15023906ed141986'
};

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey
  }
});

async function checkSpecificKeys() {
  const prefixes = [
    'Eq_doc/Z-45',
    'Eq_doc/JCPT1614',
    'Eq_doc/GS-1930',
    'Eq_doc/GS1930',
    'Eq_doc/GS-3246',
    'Eq_doc/GS3246',
    'Eq_doc/ES1330'
  ];

  for (const prefix of prefixes) {
    const cmd = new ListObjectsV2Command({
      Bucket: config.bucketName,
      Prefix: prefix
    });
    const res = await client.send(cmd);
    console.log(`\n📂 [Prefix: ${prefix}] (${res.Contents ? res.Contents.length : 0}개 파일)`);
    if (res.Contents) {
      res.Contents.forEach(c => console.log(`  - Key: ${c.Key} (${c.Size} bytes)`));
    }
  }
}

checkSpecificKeys().catch(console.error);
