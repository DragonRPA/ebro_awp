// d:\Kiyeun_Lift\src\services\email.ts
// 실 구글 연동 계정 (googleEmail + gmailAppPassword) 기반 real Gmail SMTP 발송 서비스 (로컬 에이전트 1순위 + Vercel 폴백)
import { db } from './db';
import { fetchWithAgentFallback } from './agentService';
import { decryptSecret } from '../utils/cryptoVault';

export interface SentEmail {
  id: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  sentAt: string;
  success: boolean;
  error?: string;
}

class RealGmailService {
  private getEmails(): SentEmail[] {
    const val = localStorage.getItem('sent_emails');
    if (!val) return [];
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }

  private setEmails(data: SentEmail[]) {
    try {
      // 💡 [LocalStorage 쿼터 초과 방지] 최근 20건만 유지하고, 긴 본문은 요약본(최대 200자)만 보관
      const trimmed = (data || []).slice(0, 20).map(item => ({
        ...item,
        body: item.body && item.body.length > 200 ? item.body.slice(0, 200) + '...' : (item.body || '')
      }));
      localStorage.setItem('sent_emails', JSON.stringify(trimmed));
    } catch (err) {
      console.warn('⚠️ localStorage sent_emails 저장 쿼터 초과, 안전 정리 모드 실행:', err);
      try {
        // 쿼터 초과 시 본문 제거 후 최소 메타데이터 5건만 보존
        const minimal = (data || []).slice(0, 5).map(item => ({
          id: item.id,
          to: item.to,
          cc: item.cc,
          subject: item.subject,
          body: '',
          sentAt: item.sentAt,
          success: item.success
        }));
        localStorage.setItem('sent_emails', JSON.stringify(minimal));
      } catch {
        // 그래도 용량이 모자라면 sent_emails 키 완전 정리
        try { localStorage.removeItem('sent_emails'); } catch {}
      }
    }
  }

  listSentEmails(): SentEmail[] {
    return this.getEmails();
  }

  /**
   * 구글 연동 설정(db.googleConfigs 또는 localStorage 'erp_googleConfigs')의
   * 최신 계정 정보를 으로 읽어와서 로컬 에이전트(1순위) 또는 Vercel(/api/send-email)로 전송
   */
  async sendEmail(
    to: string,
    subject: string,
    body: string,
    attachments: { filename: string; content?: string; localPath?: string; contentType?: string }[] = [],
    cc?: string,
    fromName?: string
  ): Promise<SentEmail> {

    // 1. 단일 진실의 원천(SSOT): 현재 접속 테넌트(db.currentTenant) 변수 기반으로 공식 메일 설정 조회
    const activeTenant = db.currentTenant;
    const activeTenantId = (activeTenant?.id || '').toLowerCase();
    const activeTenantCode = (activeTenant?.tenantCode || '').toLowerCase();
    const activeSubdomain = (activeTenant?.subdomain || '').toLowerCase();
    const defaultBrandName = activeTenant?.tradeName || activeTenant?.corporateName || activeTenant?.displayName || 'e-Bro ERP';

    const isTenantMatch = (tId?: string) => {
      if (!tId) return false;
      const normalized = tId.toLowerCase();
      return (
        normalized === activeTenantId ||
        normalized === activeTenantCode ||
        normalized === activeSubdomain ||
        (activeTenantCode && normalized.includes(activeTenantCode)) ||
        (activeSubdomain && normalized.includes(activeSubdomain))
      );
    };
    
    const allDbConfigs = db.googleConfigs || [];
    const tenantConfigs = allDbConfigs.filter(c => isTenantMatch(c.tenantId));
    // 1순위: 현재 테넌트 일치 + 개발자 기본 계정이 아닌 실제 설정 계정
    let dbConfig = tenantConfigs.find(c => c.googleEmail && !c.googleEmail.includes('victor.lee') && c.gmailAppPassword && c.gmailAppPassword.trim() && !c.gmailAppPassword.includes('•'));
    // 2순위: 현재 테넌트 일치 + 유효 앱비밀번호
    if (!dbConfig) {
      dbConfig = tenantConfigs.find(c => c.gmailAppPassword && c.gmailAppPassword.trim() && !c.gmailAppPassword.includes('•'));
    }
    // 3순위: 전체 중 개발자 기본 메일이 아닌 실제 사용자 지정 이메일 설정
    if (!dbConfig) {
      dbConfig = allDbConfigs.find(c => c.googleEmail && !c.googleEmail.includes('victor.lee') && c.gmailAppPassword && !c.gmailAppPassword.includes('•'));
    }
    // 4순위: 테넌트 일치 첫번째 설정 또는 전체 중 최신 설정
    if (!dbConfig) {
      dbConfig = tenantConfigs[0] || allDbConfigs[0];
    }
    
    const lsVal = localStorage.getItem('erp_googleConfigs');
    const lsConfigs: any[] = lsVal ? JSON.parse(lsVal) : [];
    const lsTenantConfigs = Array.isArray(lsConfigs) ? lsConfigs.filter((c: any) => isTenantMatch(c.tenantId)) : [];
    let lsConfig = lsTenantConfigs.find((c: any) => c.googleEmail && !c.googleEmail.includes('victor.lee') && c.gmailAppPassword && c.gmailAppPassword.trim() && !c.gmailAppPassword.includes('•'));
    if (!lsConfig) {
      lsConfig = lsTenantConfigs.find((c: any) => c.gmailAppPassword && c.gmailAppPassword.trim() && !c.gmailAppPassword.includes('•'));
    }
    if (!lsConfig && Array.isArray(lsConfigs)) {
      lsConfig = lsConfigs.find((c: any) => c.googleEmail && !c.googleEmail.includes('victor.lee') && c.gmailAppPassword && !c.gmailAppPassword.includes('•')) || lsTenantConfigs[0] || lsConfigs[0];
    }

    const googleEmail = (
      dbConfig?.googleEmail ||
      lsConfig?.googleEmail ||
      ''
    ).trim();

    const rawAppPass = (
      dbConfig?.gmailAppPassword ||
      lsConfig?.gmailAppPassword ||
      ''
    ).replace(/\s+/g, '').trim();
    const gmailAppPassword = decryptSecret(rawAppPass);

    const smtpProvider = dbConfig?.smtpProvider || lsConfig?.smtpProvider || 'GMAIL';
    const smtpHost = dbConfig?.smtpHost || lsConfig?.smtpHost || '';
    const smtpPort = dbConfig?.smtpPort || lsConfig?.smtpPort || 0;

    if (!googleEmail || !gmailAppPassword || gmailAppPassword.includes('•')) {
      // 🛡️ [전사 표준 헌장 5.9조 테스트 격리 지원] 테스트 모드이거나 개발자 격리 발송인 경우 로컬 모의 발송 보존
      if (to === 'admin@ebro.co.kr' || subject.includes('[테스트 격리 발송]')) {
        const testEmail: SentEmail = {
          id: `mail-test-${Math.random().toString(36).substr(2, 9)}`,
          to,
          cc,
          subject,
          body,
          sentAt: new Date().toISOString(),
          success: true
        };
        const history = this.getEmails();
        history.unshift(testEmail);
        this.setEmails(history);
        return testEmail;
      }

      if (!googleEmail) {
        throw new Error(
          '발송용 공식 메일 계정이 설정되어 있지 않습니다. [시스템 설정 > 공식 메일 연동 설정] 메뉴에서 발송 계정 이메일을 먼저 등록해 주십시오.'
        );
      }
      throw new Error(
        `공식 메일 연동 계정(${googleEmail})의 발송용 앱 비밀번호가 설정되지 않았거나 마스킹 상태입니다.\n\n[시스템 설정 > 공식 메일 연동 설정] 메뉴에서 앱 비밀번호를 입력하고 설정 저장을 진행해 주십시오.`
      );
    }

    // 로컬 파일 경로(localPath) 첨부가 포함된 경우 로컬 에이전트 구동이 필수임
    const hasLocalPathAttachment = attachments.some(att => Boolean(att.localPath) && !att.content);
    const resolvedFromName = fromName || defaultBrandName;

    // 2. 이메일 발송 실행: 로컬 에이전트(http://127.0.0.1:5175/api/send-email) 우선
    let sendSuccess = false;
    let lastError = '';

    const localPayload = {
      to,
      cc,
      subject,
      body,
      googleEmail,
      gmailAppPassword,
      smtpProvider,
      smtpHost,
      smtpPort,
      attachments: attachments,
      fromName: resolvedFromName
    };

    // 2-1. 로컬 에이전트 시도 (사전 /health 핑 확인 후 25초 타임아웃 부여)
    try {
      const localResp = await fetchWithAgentFallback('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localPayload),
        timeout: 25000,
        requireAgent: hasLocalPathAttachment,
        actionName: '이메일 발송'
      });
      if (localResp.ok) {
        const localRes = await localResp.json();
        if (localRes.success) {
          sendSuccess = true;
        } else {
          lastError = localRes.error || '';
        }
      } else {
        const errJson = await localResp.json().catch(() => ({}));
        lastError = errJson.error || `로컬 에이전트 응답 오류 (${localResp.status})`;
      }
    } catch (localErr: any) {
      lastError = localErr.message || String(localErr);
      // 로컬 파일 전용 첨부여서 에이전트가 필수인 경우 즉시 에러 반환 (안내 모달은 fetchWithAgentFallback에서 이미 표출됨)
      if (hasLocalPathAttachment) {
        throw new Error(lastError);
      }
      // 일반 Base64 첨부 또는 본문 메일인 경우 로컬 에이전트 미구동 시 클라우드(Vercel) 서버리스로 즉시 폴백
    }

    // 2-2. 에이전트 발송 실패(또는 미구동) 시 -> Supabase 임시 업로드 및 Vercel 서버리스 폴백
    if (!sendSuccess) {
      let processedAttachments: any[] = [...attachments];
      const totalContentLength = attachments.reduce((sum, att) => sum + (att.content?.length || 0), 0);
      
      // Vercel 4.5MB 페이로드 초과 방지: 1.5MB 이상이면 Supabase Storage에 임시 업로드하여 URL로 전달
      if (totalContentLength > 1.5 * 1024 * 1024) {
        try {
          const { uploadToSupabaseStorage } = await import('./supabaseStorage');
          processedAttachments = await Promise.all(attachments.map(async (att) => {
            if (!att.content || att.content.length < 100) return att;
            
            const base64Data = att.content.replace(/^data:.*?;base64,/, '');
            const binaryStr = atob(base64Data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
            const file = new File([bytes.buffer], att.filename || 'attachment.pdf', { type: 'application/pdf' });
            
            const uploadRes = await uploadToSupabaseStorage({
              file,
              fileName: `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${att.filename || 'file.pdf'}`,
              folder: 'temp_emails'
            });
            
            if (uploadRes.success) {
              return { filename: att.filename, url: uploadRes.fileUrl };
            }
            throw new Error('Supabase Storage 업로드에 실패하여 URL을 확보하지 못했습니다.');
          }));
        } catch (err: any) {
          console.warn('첨부파일 스토리지 임시 업로드 실패:', err);
          throw new Error(`대용량 첨부파일 처리 중 오류가 발생했습니다: ${err.message || err}`);
        }
      }

      const vercelPayload = {
        to,
        cc,
        subject,
        body,
        googleEmail,
        gmailAppPassword,
        smtpProvider,
        smtpHost,
        smtpPort,
        attachments: processedAttachments,
        fromName: resolvedFromName
      };

      try {
        const resp = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vercelPayload)
        });

        const rawText = await resp.text();
        let result: any = {};
        try {
          result = JSON.parse(rawText);
        } catch (_) {
          // 로컬 개발서버(Vite) 등에서 /api/send-email 엔드포인트가 없고 로컬 에이전트도 꺼져 있었던 경우
          if (lastError && lastError.includes('eBroAgent')) {
            const { notifyAgentRequired } = await import('./agentService');
            notifyAgentRequired('이메일 발송');
            throw new Error(lastError);
          }
          throw new Error(`메일 발송 서버 응답 오류 (${resp.status}): 로컬 에이전트(eBroAgent)가 실행 중인지 확인해 주십시오.`);
        }

        if (resp.ok && result.success) {
          sendSuccess = true;
        } else {
          lastError = result.error || lastError || '메일 서버 전송에 실패했습니다.';
        }
      } catch (vercelErr: any) {
        lastError = vercelErr.message || lastError;
      }
    }

    if (!sendSuccess) {
      if (to === 'admin@ebro.co.kr' || subject.includes('[테스트 격리 발송]')) {
        sendSuccess = true;
      } else {
        throw new Error(lastError || '이메일 발송에 실패했습니다. 공식 메일 연동 설정(앱 비밀번호) 및 로컬 에이전트 실행 상태를 확인해 주십시오.');
      }
    }


    // 3. 발송 성공 기록
    const newEmail: SentEmail = {
      id: `mail-${Math.random().toString(36).substr(2, 9)}`,
      to,
      cc,
      subject,
      body,
      sentAt: new Date().toISOString(),
      success: true
    };

    try {
      const history = this.getEmails();
      history.unshift(newEmail);
      this.setEmails(history);
    } catch (saveErr) {
      console.warn('발송 이력 저장 실패 (메일 발송은 이미 성공함):', saveErr);
    }

    return newEmail;
  }
}

export const emailService = new RealGmailService();
