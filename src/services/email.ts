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
    
    const allDbConfigs = [...(db.googleConfigs || [])].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const tenantConfigs = allDbConfigs.filter(c => isTenantMatch(c.tenantId));
    // 현재 접속 테넌트에 저장된 유효 설정 (개발자 계정 초기 세팅 및 고객사 확정 계정 모두 동일하게 존중)
    let dbConfig = tenantConfigs.find(c => c.googleEmail && c.gmailAppPassword && c.gmailAppPassword.trim() && !c.gmailAppPassword.includes('•'))
      || tenantConfigs[0]
      || (!activeTenantId ? allDbConfigs[0] : undefined);
    
    const lsVal = localStorage.getItem('erp_googleConfigs');
    const rawLsConfigs: any[] = lsVal ? JSON.parse(lsVal) : [];
    const lsConfigs: any[] = Array.isArray(rawLsConfigs)
      ? [...rawLsConfigs].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      : [];
    const lsTenantConfigs = lsConfigs.filter((c: any) => isTenantMatch(c.tenantId));
    let lsConfig = lsTenantConfigs.find((c: any) => c.googleEmail && c.gmailAppPassword && c.gmailAppPassword.trim() && !c.gmailAppPassword.includes('•'))
      || lsTenantConfigs[0]
      || (!activeTenantId ? lsConfigs[0] : undefined);

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

    const emailLower = googleEmail.toLowerCase();
    let smtpProvider = dbConfig?.smtpProvider || lsConfig?.smtpProvider || '';
    if (!smtpProvider) {
      if (emailLower.endsWith('@naver.com')) smtpProvider = 'NAVER';
      else if (emailLower.endsWith('@daum.net') || emailLower.endsWith('@hanmail.net')) smtpProvider = 'DAUM';
      else smtpProvider = 'GMAIL';
    }

    let smtpHost = dbConfig?.smtpHost || lsConfig?.smtpHost || '';
    if (!smtpHost || (emailLower.endsWith('@naver.com') && smtpHost.includes('gmail.com')) || ((emailLower.endsWith('@daum.net') || emailLower.endsWith('@hanmail.net')) && smtpHost.includes('gmail.com'))) {
      if (smtpProvider === 'NAVER' || emailLower.endsWith('@naver.com')) {
        smtpHost = 'smtp.naver.com';
      } else if (smtpProvider === 'DAUM' || emailLower.endsWith('@daum.net') || emailLower.endsWith('@hanmail.net')) {
        smtpHost = 'smtp.daum.net';
      } else {
        smtpHost = 'smtp.gmail.com';
      }
    }
    const smtpPort = dbConfig?.smtpPort || lsConfig?.smtpPort || 465;

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

    const resolvedFromName = fromName || defaultBrandName;

    // 2. 이메일 발송 실행: 모든 이메일 발송은 반드시 로컬 에이전트(eBroAgent)를 통해서만 수행 (클라우드 폴백 제거)
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

    try {
      const localResp = await fetchWithAgentFallback('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...localPayload, asyncQueue: true }),
        requireAgent: true,
        actionName: '이메일 발송'
      });
      if (localResp.ok) {
        let localRes = await localResp.json();
        if (localRes.queued && localRes.jobId) {
          const jobId = localRes.jobId;
          let nullJobCount = 0;
          while (true) {
            await new Promise(r => setTimeout(r, 800));
            try {
              const pollResp = await fetchWithAgentFallback(`/api/job-queue?jobId=${encodeURIComponent(jobId)}`, {
                method: 'GET',
                skipPrecheck: true
              });
              if (pollResp.ok) {
                const pollData = await pollResp.json();
                const job = pollData.job;
                if (job) {
                  nullJobCount = 0;
                  if (job.status === 'COMPLETED') {
                    localRes = job.result || { success: true };
                    break;
                  } else if (job.status === 'FAILED') {
                    localRes = { success: false, error: job.error || '이메일 발송 작업 실패' };
                    break;
                  }
                } else {
                  nullJobCount++;
                  if (nullJobCount >= 10) {
                    localRes = { success: false, error: `에이전트 작업 큐에서 메일 발송 작업(${jobId})을 찾을 수 없습니다.` };
                    break;
                  }
                }
              }
            } catch {
              // 일시적 루프백 지연 시 다음 폴링 주기로 안전 재시도
            }
          }
        }
        if (localRes.success) {
          sendSuccess = true;
        } else {
          lastError = localRes.error || '';
        }
      } else {
        const errJson = await localResp.json().catch(() => ({}));
        lastError = errJson.error || `로컬 에이전트 응답 오류 (${localResp.status})`;
      }
      if (!sendSuccess && (lastError.includes('535') || lastError.includes('Invalid login') || lastError.includes('Username and Password not accepted'))) {
        if (smtpHost.includes('naver.com')) {
          lastError = `[네이버 메일(smtp.naver.com) 로그인 거부]\n${lastError}\n\n• 네이버 메일 웹 환경설정 > [POP3/SMTP 설정]에서 'POP3/SMTP 사용함'이 켜져 있는지 확인해 주세요.\n• 네이버 2단계 인증을 사용 중인 경우, 일반 로그인 비밀번호가 아닌 네이버 '애플리케이션 비밀번호'를 발급받아 [공식 메일 연동 설정]에 입력해야 합니다.`;
        } else if (smtpHost.includes('daum.net')) {
          lastError = `[다음/카카오 메일(smtp.daum.net) 로그인 거부]\n${lastError}\n\n• 다음 메일 환경설정 > [IMAP/POP3 설정]에서 '사용함' 설정 및 카카오 '앱 비밀번호' 입력 여부를 확인해 주세요.`;
        }
      }
    } catch (localErr: any) {
      lastError = localErr.message || String(localErr);
      throw new Error(lastError);
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
