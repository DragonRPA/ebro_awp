// d:\Kiyeun_Lift\src\services\email.ts
// 실 구글 연동 계정 (googleEmail + gmailAppPassword) 기반 real Gmail SMTP 발송 서비스 (로컬 에이전트 1순위 + Vercel 폴백)
import { db } from './db';

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
    localStorage.setItem('sent_emails', JSON.stringify(data));
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
    attachments: { filename: string; content: string }[] = [],
    cc?: string
  ): Promise<SentEmail> {

    // 1. 단일 진실의 원천(SSOT): db.googleConfigs 중 유효한 앱 비밀번호가 있는 설정 우선 조회
    const dbConfig = db.googleConfigs.find(c => c.gmailAppPassword && c.gmailAppPassword.trim() && !c.gmailAppPassword.includes('•')) || db.googleConfigs[0];
    const lsVal = localStorage.getItem('erp_googleConfigs');
    const lsConfigs = lsVal ? JSON.parse(lsVal) : [];
    const lsConfig = Array.isArray(lsConfigs) ? (lsConfigs.find((c: any) => c.gmailAppPassword && c.gmailAppPassword.trim() && !c.gmailAppPassword.includes('•')) || lsConfigs[0]) : null;

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

    if (!googleEmail) {
      throw new Error(
        '⚠️ 발송용 구글 계정이 설정되어 있지 않습니다. [시스템 설정 > 구글 및 클라우드 연계 설정] 메뉴에서 구글 계정 이메일을 먼저 등록해 주세요.'
      );
    }

    if (!gmailAppPassword || gmailAppPassword.includes('•')) {
      throw new Error(
        `⚠️ 구글 연동 계정(${googleEmail})의 16자리 Gmail 발송용 앱 비밀번호가 설정되지 않았거나 마스킹 상태입니다.\n\n[시스템 설정 > 구글 및 클라우드 연계 설정] 메뉴에서 구글 계정 2단계 인증 후 발급받으신 16자리 앱 비밀번호(App Password)를 직접 입력하고 [구글 연동 설정 저장]을 눌러 주세요.`
      );
    }

    // 2. 이메일 발송 실행: 로컬 에이전트(http://127.0.0.1:5175/api/send-email) 우선 ➔ 실패 시 Vercel (/api/send-email) 폴백
    const emailPayload = {
      to,
      cc,
      subject,
      body,
      googleEmail,
      gmailAppPassword,
      attachments
    };

    let sendSuccess = false;
    let lastError = '';

    // 2-1. 로컬 에이전트 시도
    try {
      const localResp = await fetch('http://127.0.0.1:5175/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload)
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

    // 2-2. 로컬 에이전트 미성공 시 Vercel 서버리스 API 호출
    if (!sendSuccess) {
      try {
        const resp = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailPayload)
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

    const history = this.getEmails();
    history.unshift(newEmail);
    this.setEmails(history);

    return newEmail;
  }
}

export const emailService = new RealGmailService();
