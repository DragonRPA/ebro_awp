/**
 * Google Drive 증빙 파일 일괄 백업 서비스 (월 1회 수동 실행용)
 * - 일상 업로드와 완전 분리: 이 서비스는 백업 버튼 클릭 시에만 사용
 * - Supabase Storage → Google Drive 폴더로 일괄 전송
 * - OAuth 팝업은 백업 실행 시 1회만 발생
 */

declare global {
  interface Window { google?: any; }
}

import { fetchWithAgentFallback } from './agentService';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_API   = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API  = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';

// ─────────────────────────────────────────────────────────────────────────────
// 1. GIS 스크립트 로드
// ─────────────────────────────────────────────────────────────────────────────
function loadGIS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Google Identity Services 로드 실패'));
    document.head.appendChild(s);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. 백업용 Access Token 발급 (팝업 1회 - 백업 실행 시)
// ─────────────────────────────────────────────────────────────────────────────
function getBackupToken(clientId: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    await loadGIS().catch(reject);
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (res: any) => {
        if (res.error) { reject(new Error(`구글 인증 오류: ${res.error}`)); return; }
        resolve(res.access_token);
      }
    });
    client.requestAccessToken({ prompt: '' });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2b. 읽기 전용 Access Token 발급 (구글 드라이브 파일 다운로드용)
// drive.readonly scope: 구글 드라이브 내 모든 파일 읽기 가능
// ─────────────────────────────────────────────────────────────────────────────
export function getDriveReadToken(clientId: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    await loadGIS().catch(reject);
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (res: any) => {
        if (res.error) { reject(new Error(`구글 인증 오류: ${res.error}`)); return; }
        resolve(res.access_token);
      }
    });
    client.requestAccessToken({ prompt: '' });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2c. 구글 드라이브 파일 바이너리 다운로드 (file ID + access token)
// ─────────────────────────────────────────────────────────────────────────────
export async function downloadDriveFileAsArrayBuffer(fileId: string, token: string): Promise<ArrayBuffer> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`구글 드라이브 파일 다운로드 실패 (${fileId}): ${res.status} ${errText}`);
  }
  return res.arrayBuffer();
}

// ─────────────────────────────────────────────────────────────────────────────
// 2c-2. 토큰/로그인 0회 공개 공유 파일 바이너리 다운로드 (Public Direct Download)
// ─────────────────────────────────────────────────────────────────────────────
export async function downloadPublicDriveFile(fileId: string): Promise<ArrayBuffer> {
  const endpoints = [
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`,
    `https://lh3.googleusercontent.com/d/${fileId}`,
    `https://drive.google.com/uc?export=download&id=${fileId}`
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 100) return buf; // 정상 바이너리 확인
      }
    } catch (e) {}
  }
  throw new Error(`공개 드라이브 파일 다운로드 실패 (${fileId})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2d. 구글 드라이브 URL에서 파일 ID 추출
// https://drive.google.com/file/d/FILE_ID/view → FILE_ID
// ─────────────────────────────────────────────────────────────────────────────
export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/file\/d\/([^/?#]+)/);
  return match ? match[1] : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2d-2. 구글 드라이브 URL에서 폴더 ID 추출
// https://drive.google.com/drive/folders/FOLDER_ID → FOLDER_ID
// ─────────────────────────────────────────────────────────────────────────────
export function extractDriveFolderId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/drive\/folders\/([^/?#]+)/) || url.match(/\/folders\/([^/?#]+)/);
  return match ? match[1] : (url.includes('/') ? null : url.trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// 2d-3. 구글 드라이브 폴더 내 파일 목록 조회 (Google Drive API v3)
// ─────────────────────────────────────────────────────────────────────────────
export interface DriveFolderFileInfo {
  id: string;
  name: string;
  mimeType: string;
  relativePath?: string;
}

export async function listFilesInDriveFolder(folderId: string, token: string): Promise<DriveFolderFileInfo[]> {
  const q = `'${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&orderBy=name`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => null);
    throw new Error(`폴더 파일 목록 조회 실패 (${folderId}): HTTP ${res.status} ${errJson?.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.files || [];
}

/**
 * 🌲 구글 드라이브 하위 폴더 전체 재귀 탐색 (상대경로 relativePath 보존)
 */
export async function listDriveFolderRecursively(
  folderId: string,
  token: string,
  currentPath: string = ''
): Promise<DriveFolderFileInfo[]> {
  const items = await listFilesInDriveFolder(folderId, token);
  const results: DriveFolderFileInfo[] = [];

  for (const item of items) {
    const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      // 하위 폴더인 경우 재귀 탐색
      const subItems = await listDriveFolderRecursively(item.id, token, itemPath);
      results.push(...subItems);
    } else {
      // 일반 파일
      results.push({
        id: item.id,
        name: item.name,
        mimeType: item.mimeType,
        relativePath: itemPath
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2e. Google Apps Script(GAS) 웹앱 프록시를 통한 무팝업 드라이브 파일 바이너리 다운로드 (방식 C)
// - 클라이언트 OAuth 팝업 0회
// - Apps Script가 파일 바이너리를 Base64로 반환하면 브라우저에서 ArrayBuffer로 변환
// ─────────────────────────────────────────────────────────────────────────────
export async function downloadDriveFileViaAppsScript(appsScriptUrl: string, fileId: string): Promise<ArrayBuffer> {
  if (!appsScriptUrl?.trim()) {
    throw new Error('Google Apps Script URL이 설정되지 않았습니다.');
  }

  const endpoint = `${appsScriptUrl.trim()}?action=downloadFile&fileId=${encodeURIComponent(fileId)}`;
  const res = await fetch(endpoint);

  if (!res.ok) {
    throw new Error(`Apps Script 호출 실패 (${fileId}): HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.success || !data.base64) {
    throw new Error(`구글 드라이브 파일 추출 실패: ${data.error || 'Base64 데이터 없음'}`);
  }

  // Base64 문자열 -> ArrayBuffer 변환
  const binaryString = atob(data.base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. 구글 드라이브 루트에서 폴더 검색 (없으면 오류)
// ─────────────────────────────────────────────────────────────────────────────
async function findDriveFolder(token: string, folderName: string): Promise<string> {
  const q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false and 'root' in parents`;
  const res = await fetch(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.files?.length > 0) return data.files[0].id;
  throw new Error(
    `구글 드라이브에 "${folderName}" 폴더가 없습니다.\n` +
    `drive.google.com에서 해당 폴더를 먼저 만들고 다시 시도해 주세요.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 단일 파일 업로드 → Drive webViewLink 반환
// ─────────────────────────────────────────────────────────────────────────────
async function uploadOneFile(token: string, fileName: string, blob: Blob, folderId: string): Promise<string> {
  const meta = { name: fileName, parents: [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob);
  const res = await fetch(UPLOAD_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || res.statusText);
  }
  const data = await res.json();
  // webViewLink 가 없으면 폴더 URL로 대체
  return data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. 메인: Supabase Storage URL 목록 → 구글 드라이브 일괄 백업
// ─────────────────────────────────────────────────────────────────────────────
export interface BackupItem {
  fileName: string;
  fileUrl: string;
}

export interface BackupResult {
  total: number;
  success: number;
  fail: number;
  failedFiles: string[];
  /** 원본 Supabase URL → Drive webViewLink 맵핑 (성공한 파일만) */
  successUrlMap: Map<string, string>;
}

export async function backupToGoogleDrive(
  items: BackupItem[],
  clientId: string,
  folderName: string,
  onProgress?: (done: number, total: number) => void
): Promise<BackupResult> {
  if (!clientId?.trim()) {
    throw new Error(
      '구글 드라이브 백업을 위한 OAuth Client ID가 설정되지 않았습니다.\n' +
      '[구글 드라이브 설정] → [구글 드라이브 백업 설정]에서 Client ID를 먼저 등록해 주세요.'
    );
  }
  if (items.length === 0) {
    throw new Error('백업할 증빙 파일이 없습니다.');
  }

  // 팝업 1회 (백업 트리거 시)
  const token = await getBackupToken(clientId);
  const folderId = await findDriveFolder(token, folderName);

  const result: BackupResult = { total: items.length, success: 0, fail: 0, failedFiles: [], successUrlMap: new Map() };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const fetchRes = await fetch(item.fileUrl);
      if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
      const blob = await fetchRes.blob();
      const driveUrl = await uploadOneFile(token, item.fileName, blob, folderId);
      result.successUrlMap.set(item.fileUrl, driveUrl);
      result.success++;
    } catch {
      result.fail++;
      result.failedFiles.push(item.fileName);
    }
    onProgress?.(i + 1, items.length);
  }

  return result;
}
// ─────────────────────────────────────────────────────────────────────────────
// 2f. 파일 캐시 확인 및 구글 드라이브 다운로드 (브라우저/에이전트 캐시 우선 헬퍼) ───
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchDriveFileCacheFirst(fileId: string, fileName: string): Promise<ArrayBuffer> {
  // 1. 로컬 에이전트 캐시 우선 요청 (확장 프로그램/루프백 폴백 지원)
  try {
    const res = await fetchWithAgentFallback(`/api/get-file?fileId=${encodeURIComponent(fileId)}&fileName=${encodeURIComponent(fileName)}`, {
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 100) return buf;
    }
  } catch (e) {
    // 에이전트 오프라인 또는 연결 실패 시 폴백
  }

  // 2. 무토큰 공개 다이렉트 다운로드 폴백 (팝업 0회)
  return await downloadPublicDriveFile(fileId);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2g. 파일 유틸리티 re-export (SSOT 준수: src/utils/fileUtil.ts)
// ─────────────────────────────────────────────────────────────────────────────
export { ensureDirSync, writeBase64ToFile } from '../utils/fileUtil';

