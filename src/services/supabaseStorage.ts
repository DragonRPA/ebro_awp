/**
 * Supabase Storage 증빙 파일 업로드 서비스
 * - 버킷명: 'evidence'
 * - 경로: consumables/{fileName}
 * - 공개 URL 반환 (버킷 Public 설정 필요)
 * - 구글 로그인/OAuth 없이 ERP 계정만으로 즉시 업로드
 */
import { supabase } from './db';

const BUCKET = 'evidence';

export interface StorageUploadOptions {
  file: File;            // 업로드할 실물 파일
  fileName: string;      // 저장 파일명 (예: CPRC-0000001.pdf)
  folder: string;        // 하위 경로 (예: 'consumables', 'delivery')
}

export interface StorageUploadResult {
  success: boolean;
  fileUrl: string;
  storagePath: string;
  message: string;
}

/**
 * Supabase Storage 버킷에 파일 업로드
 * 동일 경로에 파일이 이미 있으면 덮어씀
 */
export async function uploadToSupabaseStorage(
  options: StorageUploadOptions
): Promise<StorageUploadResult> {
  const { file, fileName, folder } = options;

  if (!supabase) {
    throw new Error('Supabase 연결이 설정되지 않았습니다. 환경변수를 확인해 주세요.');
  }

  const storagePath = `${folder}/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: true  // 동일 파일명이면 덮어씀
    });

  if (error) {
    // 버킷이 없는 경우 안내
    if (error.message?.includes('Bucket not found') || error.message?.includes('bucket')) {
      throw new Error(
        `Supabase Storage 버킷 'evidence'가 존재하지 않습니다.\n\n` +
        `[Supabase 대시보드] → [Storage] → [New Bucket]\n` +
        `이름: evidence, Public: ON 으로 생성 후 다시 시도해 주세요.`
      );
    }
    throw new Error(`파일 업로드 실패: ${error.message}`);
  }

  // 공개 URL 조회
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  const fileUrl = urlData?.publicUrl || '';

  return {
    success: true,
    fileUrl,
    storagePath,
    message: `Supabase Storage [${BUCKET}/${storagePath}] 업로드 완료`
  };
}

/**
 * 여러 파일 URL을 ZIP으로 로컬 다운로드
 * (JSZip + file-saver 사용 — 동적 import로 번들 지연 로딩)
 */
export async function downloadEvidenceAsZip(
  items: { fileName: string; fileUrl: string }[],
  zipName: string = '증빙파일_백업.zip'
): Promise<void> {
  if (items.length === 0) {
    throw new Error('다운로드할 증빙 파일이 없습니다.');
  }

  // 동적 import (코드 스플리팅)
  const [{ default: JSZip }, { saveAs }] = await Promise.all([
    import('jszip'),
    import('file-saver')
  ]);

  const zip = new JSZip();
  const folder = zip.folder('증빙파일') as typeof zip;

  let successCount = 0;
  let failCount = 0;

  for (const item of items) {
    try {
      const res = await fetch(item.fileUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      folder.file(item.fileName, blob);
      successCount++;
    } catch {
      // 개별 파일 실패 시 건너뜀 (전체 중단 방지)
      failCount++;
    }
  }

  if (successCount === 0) {
    throw new Error('모든 파일 다운로드에 실패했습니다. 네트워크 연결을 확인해 주세요.');
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, zipName);

  if (failCount > 0) {
    console.warn(`ZIP 다운로드 완료: 성공 ${successCount}건, 실패 ${failCount}건`);
  }
}

/**
 * Supabase Storage에서 파일 일괄 삭제
 * - 공개 URL에서 버킷 내 경로를 추출하여 삭제
 * - 예: https://xxx.supabase.co/storage/v1/object/public/evidence/consumables/CPRC-001.pdf
 *       → 삭제 경로: consumables/CPRC-001.pdf
 */
export async function deleteStorageFiles(fileUrls: string[]): Promise<{ deleted: number; failed: number }> {
  if (!supabase) throw new Error('Supabase 연결이 설정되지 않았습니다.');

  // 공개 URL에서 버킷 내 경로 추출
  // URL 패턴: .../object/public/{bucket}/{path}
  const paths = fileUrls
    .map(url => {
      const match = url.match(/\/object\/public\/evidence\/(.+?)(\?.*)?$/);
      return match ? match[1] : null;
    })
    .filter(Boolean) as string[];

  if (paths.length === 0) {
    throw new Error('삭제할 수 있는 Supabase Storage 파일 경로를 추출할 수 없습니다.');
  }

  const { error } = await supabase.storage.from(BUCKET).remove(paths);

  if (error) {
    throw new Error(`Storage 파일 삭제 실패: ${error.message}`);
  }

  return { deleted: paths.length, failed: fileUrls.length - paths.length };
}
