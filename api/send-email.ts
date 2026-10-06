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
  // CORS 처리
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, cc, subject, body, html, googleEmail, gmailAppPassword, smtpHost, smtpPort, attachments, tenantCorp, tenantBrand, fromName } = req.body || {};

  if (!to || !subject || !body) {
    return res.status(400).json({ error: '수신자(to), 제목(subject), 본문(body)은 필수 항목입니다.' });
  }

  if (!googleEmail || !gmailAppPassword || gmailAppPassword.includes('•')) {
    return res.status(400).json({
      error: '구글 연동 설정에 16자리 Gmail 앱 비밀번호가 올바르게 저장되지 않았습니다. [시스템 설정 > 구글 및 클라우드 연계 설정] 메뉴에서 구글 앱 비밀번호를 다시 입력하고 저장해 주세요.'
    });
  }

  try {
    const cleanEmail = String(googleEmail).trim();
    const cleanPass  = String(gmailAppPassword).replace(/\s+/g, '').trim();

    // SMTP 클라이언트 트랜스포터 생성
    const transporter = nodemailer.createTransport({
      host: smtpHost || 'smtp.gmail.com',
      port: smtpPort || 465,
      secure: true, // SSL (port 465)
      auth: {
        user: cleanEmail,
        pass: cleanPass
      }
    });

    const parsedAttachments = [];
    if (Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.url) {
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

    const senderBrand = fromName || tenantCorp || tenantBrand || '(주)기연리프트';

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${senderBrand}" <${cleanEmail}>`,
      to: String(to).trim(),
      cc: cc ? String(cc).trim() : undefined,
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
    console.error('Gmail SMTP Transport Error:', err);
    return res.status(500).json({
      error: `Gmail 발송 실패: ${err?.message || '구글 앱 비밀번호가 올바른지 확인해 주세요.'}`
    });
  }
}
