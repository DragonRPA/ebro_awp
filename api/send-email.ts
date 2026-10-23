// d:\Kiyeun_Lift\api\send-email.ts
// Vercel Serverless Function — Gmail SMTP (App Password) 메일 발송 API
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

// Vercel Serverless Function Config — 페이로드 용량 10MB로 확장
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 처리 (허용된 Origin 검증)
  const origin = req.headers.origin || '';
  const isAllowedOrigin =
    !origin ||
    origin.endsWith('.ebro.run') ||
    origin === 'https://ebro.run' ||
    origin.endsWith('.vercel.app') ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin === 'capacitor://localhost' ||
    origin === 'http://localhost';

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin && origin ? origin : 'https://ebro.run');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!isAllowedOrigin) {
    return res.status(403).json({ error: '허용되지 않은 출처의 요청입니다.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, cc, subject, body, html, googleEmail, gmailAppPassword, smtpProvider, smtpHost, smtpPort, attachments, tenantCorp, tenantBrand, fromName } = req.body || {};

  if (!to || !subject || !body) {
    return res.status(400).json({ error: '수신자(to), 제목(subject), 본문(body)은 필수 항목입니다.' });
  }

  const effectiveEmail = (googleEmail && !googleEmail.includes('•') ? googleEmail : (process.env.GMAIL_ACCOUNT_EMAIL || process.env.GOOGLE_EMAIL || '')).trim();
  const effectivePassword = (gmailAppPassword && !gmailAppPassword.includes('•') ? gmailAppPassword : (process.env.GMAIL_APP_PASSWORD || process.env.GOOGLE_APP_PASSWORD || '')).replace(/\s+/g, '').trim();

  if (!effectiveEmail || !effectivePassword) {
    return res.status(400).json({
      error: '공식 메일 연동 설정에 발송용 앱 비밀번호가 올바르게 설정되지 않았습니다. 시스템 설정을 확인해 주세요.'
    });
  }

  try {
    const cleanEmail = effectiveEmail;
    const cleanPass  = effectivePassword;
    const emailLower = cleanEmail.toLowerCase();

    let resolvedHost = smtpHost;
    const providerUpper = String(smtpProvider || '').toUpperCase();
    if (!resolvedHost || (emailLower.endsWith('@naver.com') && resolvedHost.includes('gmail.com')) || ((emailLower.endsWith('@daum.net') || emailLower.endsWith('@hanmail.net')) && resolvedHost.includes('gmail.com'))) {
      if (providerUpper === 'NAVER' || emailLower.endsWith('@naver.com')) {
        resolvedHost = 'smtp.naver.com';
      } else if (providerUpper === 'DAUM' || emailLower.endsWith('@daum.net') || emailLower.endsWith('@hanmail.net')) {
        resolvedHost = 'smtp.daum.net';
      } else {
        resolvedHost = 'smtp.gmail.com';
      }
    }
    const resolvedPort = Number(smtpPort) || 465;

    // SMTP 클라이언트 트랜스포터 생성
    const transporter = nodemailer.createTransport({
      host: resolvedHost,
      port: resolvedPort,
      secure: resolvedPort === 465, // SSL (port 465)
      auth: {
        user: cleanEmail,
        pass: cleanPass
      }
    });

    const isSafeAttachmentUrl = (rawUrl: string): boolean => {
      try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== 'https:') return false;
        const host = parsed.hostname.toLowerCase();
        // 내부망/루프백/메타데이터 IP 대역 원천 차단 (SSRF 방어)
        if (
          host === 'localhost' ||
          host === '127.0.0.1' ||
          host === '0.0.0.0' ||
          host === '169.254.169.254' ||
          host.startsWith('10.') ||
          host.startsWith('192.168.') ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
          host.endsWith('.internal') ||
          host.endsWith('.local')
        ) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    };

    const parsedAttachments = [];
    if (Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.url) {
          if (!isSafeAttachmentUrl(String(att.url))) {
            console.warn(`Blocked unsafe attachment URL: ${att.url}`);
            continue;
          }
          try {
            const resp = await fetch(att.url);
            if (resp.ok) {
              const arrayBuffer = await resp.arrayBuffer();
              parsedAttachments.push({
                filename: att.filename || '첨부파일.pdf',
                content: Buffer.from(arrayBuffer),
                contentType: att.contentType || 'application/pdf'
              });
            } else {
              console.error(`Failed to download attachment from ${att.url}: ${resp.status}`);
            }
          } catch (e) {
            console.error(`Error downloading attachment from ${att.url}`, e);
          }
        } else if (att.content) {
          const base64Data = String(att.content).replace(/^data:.*?;base64,/, '');
          parsedAttachments.push({
            filename: att.filename || '첨부파일.pdf',
            content: Buffer.from(base64Data, 'base64'),
            contentType: att.contentType || 'application/pdf'
          });
        }
      }
    }

    const senderBrand = fromName || tenantCorp || tenantBrand || process.env.VITE_TENANT_NAME || 'e-Bro ERP';

    const extractEmails = (raw?: any): string[] => {
      if (!raw) return [];
      const text = Array.isArray(raw) ? raw.join(', ') : String(raw);
      const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      const seen = new Set<string>();
      const out: string[] = [];
      for (const m of matches) {
        const clean = m.trim();
        const lower = clean.toLowerCase();
        if (clean && !seen.has(lower)) {
          seen.add(lower);
          out.push(clean);
        }
      }
      return out;
    };

    const toEmails = extractEmails(to);
    const toLowerSet = new Set(toEmails.map(e => e.toLowerCase()));
    const ccEmails = extractEmails(cc).filter(e => !toLowerSet.has(e.toLowerCase()));
    const normalizedTo = toEmails.length > 0 ? toEmails.join(', ') : String(to).trim();
    const normalizedCc = ccEmails.length > 0 ? ccEmails.join(', ') : undefined;

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${senderBrand}" <${cleanEmail}>`,
      to: normalizedTo,
      cc: normalizedCc,
      subject: String(subject).trim(),
      text: String(body),
      html: html ? String(html) : undefined,
      attachments: parsedAttachments
    };

    const info = await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      accepted: info.accepted
    });

  } catch (err: any) {
    console.error('SMTP Transport Error:', err);
    return res.status(500).json({
      error: `SMTP 발송 실패 (${effectiveEmail}): ${err?.message || '이메일 계정 및 앱 비밀번호 설정을 확인해 주세요.'}`
    });
  }
}
