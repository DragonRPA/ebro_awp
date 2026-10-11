// api/r2.ts
// Vercel Serverless Function — Cloudflare R2 클라우드 스토리지 S3 호환 API
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  S3Client, 
  ListObjectsV2Command, 
  PutObjectCommand, 
  DeleteObjectCommand, 
  HeadBucketCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';


export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb'
    }
  }
};

function getS3Client(accountId: string, accessKeyId: string, secretAccessKey: string): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId.trim()}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId.trim(),
      secretAccessKey: secretAccessKey.trim()
    }
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 처리
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Access-Control-Allow-Origin, Content-Length, Content-Type'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query.action as string) || (req.body && req.body.action) || 'list';

  try {
    const accountId = (req.query.accountId as string) || (req.body && req.body.accountId) || process.env.R2_ACCOUNT_ID || '35014a2514680107d74e1e68d96e6c32';
    const bucketName = (req.query.bucketName as string) || (req.body && req.body.bucketName) || process.env.R2_BUCKET_NAME || 'giyeon-storage';
    const accessKeyId = (req.query.accessKeyId as string) || (req.body && req.body.accessKeyId) || process.env.R2_ACCESS_KEY_ID || '03cdb7560d37242de608a5db2a976030';
    const secretAccessKey = (req.query.secretAccessKey as string) || (req.body && req.body.secretAccessKey) || process.env.R2_SECRET_ACCESS_KEY || 'b2407ab4532e02317860bc3d63226fb7bc232e88083b150c15023906ed141986';

    if (!accountId || !bucketName || !accessKeyId || !secretAccessKey) {
      return res.status(400).json({
        success: false,
        error: 'Cloudflare R2 필수 자격증명(accountId, bucketName, accessKeyId, secretAccessKey)이 누락되었습니다.'
      });
    }

    const s3 = getS3Client(accountId, accessKeyId, secretAccessKey);

    // 1. 연결 테스트
    if (action === 'test') {
      try {
        const cmd = new HeadBucketCommand({ Bucket: bucketName.trim() });
        await s3.send(cmd);
        return res.status(200).json({
          success: true,
          message: `Cloudflare R2 버킷 [${bucketName}] 연결에 성공했습니다.`
        });
      } catch (headErr: any) {
        // HeadBucket 실패 시 ListObjectsV2 1개 시도로 폴백 검증
        const listCmd = new ListObjectsV2Command({ Bucket: bucketName.trim(), MaxKeys: 1 });
        await s3.send(listCmd);
        return res.status(200).json({
          success: true,
          message: `Cloudflare R2 버킷 [${bucketName}] 연결 및 권한 검증 완료.`
        });
      }
    }

    // 2. 버킷 내 전체 파일 및 하위 디렉토리 목록 재귀 조회 (ListObjectsV2)
    if (action === 'list') {
      const prefix = (req.query.prefix as string) || (req.body && req.body.prefix) || '';
      let isTruncated = true;
      let continuationToken: string | undefined = undefined;
      const allFiles: Array<{ key: string; size: number; lastModified: string; etag: string }> = [];

      while (isTruncated) {
        const cmd = new ListObjectsV2Command({
          Bucket: bucketName.trim(),
          Prefix: prefix,
          ContinuationToken: continuationToken
        });
        const response = await s3.send(cmd);
        
        if (response.Contents) {
          for (const item of response.Contents) {
            if (item.Key) {
              const isDir = item.Key.endsWith('/');
              allFiles.push({
                key: item.Key,
                size: item.Size || 0,
                isDirectory: isDir,
                lastModified: item.LastModified ? item.LastModified.toISOString() : new Date().toISOString(),
                etag: (item.ETag || '').replace(/"/g, '')
              });
            }
          }
        }

        isTruncated = response.IsTruncated || false;
        continuationToken = response.NextContinuationToken;
      }

      return res.status(200).json({
        success: true,
        bucketName: bucketName.trim(),
        totalCount: allFiles.length,
        files: allFiles
      });
    }

    // 3. 파일 업로드 (PutObject)
    if (action === 'upload') {
      const { key, base64Content, contentType } = req.body;
      if (!key || !base64Content) {
        return res.status(400).json({ success: false, error: 'key and base64Content are required' });
      }

      let rawBase64 = base64Content;
      if (rawBase64.includes(',')) {
        rawBase64 = rawBase64.split(',')[1];
      }

      const buffer = Buffer.from(rawBase64, 'base64');
      const cmd = new PutObjectCommand({
        Bucket: bucketName.trim(),
        Key: key.trim(),
        Body: buffer,
        ContentType: contentType || 'application/octet-stream'
      });

      await s3.send(cmd);
      return res.status(200).json({
        success: true,
        key: key.trim(),
        size: buffer.length,
        message: `파일 [${key}] 업로드 완료.`
      });
    }

    // 4. 파일 삭제 (DeleteObject)
    if (action === 'delete') {
      const key = (req.query.key as string) || (req.body && req.body.key);
      if (!key) {
        return res.status(400).json({ success: false, error: 'key is required' });
      }

      const cmd = new DeleteObjectCommand({
        Bucket: bucketName.trim(),
        Key: key.trim()
      });

      await s3.send(cmd);
      return res.status(200).json({
        success: true,
        key: key.trim(),
        message: `파일 [${key}] 삭제 완료.`
      });
    }

    // 5. 파일 다운로드 — binary 응답 (GetObject)
    if (action === 'download') {
      const key = (req.query.key as string) || (req.body && req.body.key);
      if (!key) {
        return res.status(400).json({ success: false, error: 'key is required' });
      }

      const cmd = new GetObjectCommand({
        Bucket: bucketName.trim(),
        Key: key.trim(),
      });
      const response = await s3.send(cmd);
      if (!response.Body) {
        return res.status(404).json({ success: false, error: `파일 [${key}] 없음` });
      }

      // stream → Buffer 변환
      const chunks: Uint8Array[] = [];
      const stream = response.Body as any;
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      const buffer = Buffer.concat(chunks);

      res.setHeader('Content-Type', response.ContentType || 'application/octet-stream');
      res.setHeader('Content-Length', buffer.length);
      return res.status(200).send(buffer);
    }

    return res.status(400).json({ success: false, error: `지원하지 않는 action: ${action}` });

  } catch (err: any) {
    console.error('R2 API Error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Cloudflare R2 서버리스 API 처리 중 오류가 발생했습니다.'
    });
  }
}
