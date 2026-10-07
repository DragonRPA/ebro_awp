// d:\Kiyeun_Lift\src\services\email.ts
// 실 구글 연동 계정 (googleEmail + gmailAppPassword) 기반 real Gmail SMTP 발송 서비스 (로컬 에이전트 1순위 + Vercel 폴백)
import { db } from './db';
import { fetchWithAgentFallback } from './agentService';

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
    attachments: { filename: string; content?: string; localPath?: string }[] = [],
    cc?: string,
    fromName?: string
  ): Promise<SentEmail> {

    // 1. 단일 진실의 원천(SSOT): db.googleConfigs 중 유효한 앱 비밀번호가 있는 설정 우선 조회
    const currentTenantId = import.meta.env.VITE_TENANT_ID || 'giyuen';
    const tenantConfigs = db.googleConfigs.filter(c => c.tenantId === currentTenantId || !c.tenantId);
    const dbConfig = tenantConfigs.find(c => c.gmailAppPassword && c.gmailAppPassword.trim() && !c.gmailAppPassword.includes('•')) || tenantConfigs[0] || db.googleConfigs[0];
    
    const lsVal = localStorage.getItem('erp_googleConfigs');
    const lsConfigs = lsVal ? JSON.parse(lsVal) : [];
    const lsTenantConfigs = Array.isArray(lsConfigs) ? lsConfigs.filter((c: any) => c.tenantId === currentTenantId || !c.tenantId) : [];
    const lsConfig = lsTenantConfigs.find((c: any) => c.gmailAppPassword && c.gmailAppPassword.trim() && !c.gmailAppPassword.includes('•')) || lsTenantConfigs[0] || (Array.isArray(lsConfigs) ? lsConfigs[0] : null);

    const googleEmail = (
      dbConfig?.googleEmail ||
      lsConfig?.googleEmail ||
      ''
    ).trim();

    const gmailAppPassword = (
      dbConfig?.gmailAppPassword ||
      lsConfig?.gmailAppPassword ||
      ''
    ).replace(/\s+/g, '').trim();

    const smtpProvider = dbConfig?.smtpProvider || lsConfig?.smtpProvider || 'GMAIL';
    const smtpHost = dbConfig?.smtpHost || lsConfig?.smtpHost || '';
    const smtpPort = dbConfig?.smtpPort || lsConfig?.smtpPort || 0;

    if (!googleEmail) {
      throw new Error(
        '⚠️ 발송용 구글 계정이 설정되어 있지 않습니다. [시스템 설정 > 공식 메일 연동 설정] 메뉴에서 구글 계정 이메일을 먼저 등록해 주세요.'
      );
    }

    if (!gmailAppPassword || gmailAppPassword.includes('•')) {
      throw new Error(
        `⚠️ 구글 연동 계정(${googleEmail})의 16자리 Gmail 발송용 앱 비밀번호가 설정되지 않았거나 마스킹 상태입니다.\n\n[시스템 설정 > 공식 메일 연동 설정] 메뉴에서 구글 계정 2단계 인증 후 발급받으신 16자리 앱 비밀번호(App Password)를 직접 입력하고 [구글 연동 설정 저장]을 눌러 주세요.`
      );
    }

    // 2. 이메일 발송 실행: 로컬 에이전트(http://127.0.0.1:5175/api/send-email) 우선 (원본 Base64 그대로 전달)
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
      attachments: attachments, // Supabase 업로드 없이 원본 그대로 에이전트에 전달
      fromName: fromName || '(주)기연리프트'
    };

    // 2-1. 로컬 에이전트 시도
    try {
      const localResp = await fetchWithAgentFallback('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localPayload)
      });
      if (localResp.ok) {
        const localRes = await localResp.json();
        if (localRes.success) {
          sendSuccess = true;
        } else {
          lastError = localRes.error || '';
        }
      }
    } catch (localErr: any) {
      // 로컬 에이전트 미구동 시 조용히 Vercel로 폴백
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
              return { filename: att.filename, url: uploadRes.fileUrl }; // URL로 대체하여 페이로드 극소화
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
        fromName: fromName || '(주)기연리프트'
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
          throw new Error(`서버 응답 오류 (${resp.status}): ${rawText.slice(0, 150)}`);
        }

        if (resp.ok && result.success) {
          sendSuccess = true;
        } else {
          lastError = result.error || lastError || 'Gmail 서버 메일 전송에 실패했습니다.';
        }
      } catch (vercelErr: any) {
        lastError = vercelErr.message || lastError;
      }
    }

    if (!sendSuccess) {
      throw new Error(lastError || '이메일 발송에 실패했습니다. 구글 앱 비밀번호 및 네트워크 상태를 확인해 주세요.');
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
