import { PDFDocument } from 'pdf-lib';
import { InboundClaimDefectItem, InboundDefectClaimMeta } from '../services/db';
import { emailService } from '../services/email';

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const CANVAS_W = 1240;
const CANVAS_H = 1754;
const FONT_FAMILY = '"Pretendard", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

function formatKRW(amount: number): string {
  return `₩${Math.round(amount || 0).toLocaleString('ko-KR')}`;
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(null), 5000);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill?: string,
  stroke?: string,
  lineWidth = 1
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const str = String(text || '');
  if (ctx.measureText(str).width <= maxWidth) return str;
  let result = str;
  while (result.length > 0 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

async function renderPageCanvasToPngBytes(
  drawFn: (ctx: CanvasRenderingContext2D) => Promise<void>
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스 컨텍스트를 생성할 수 없습니다.');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  await drawFn(ctx);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('이미지 변환에 실패했습니다.'))),
      'image/png',
      0.95
    );
  });
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

async function drawSymptomCard(
  ctx: CanvasRenderingContext2D,
  item: InboundClaimDefectItem,
  index: number,
  y: number,
  isAgreed: boolean
): Promise<number> {
  const cardX = 64;
  const cardW = CANVAS_W - 128;
  const hasPhotos = Array.isArray(item.photos) && item.photos.length > 0;
  const cardH = hasPhotos ? 390 : 140;

  drawRoundedRect(ctx, cardX, y, cardW, cardH, 12, '#F8FAFC', '#CBD5E1', 2);

  // 상단 헤더 바
  drawRoundedRect(ctx, cardX, y, cardW, 56, 12, '#EFF6FF', '#BFDBFE', 1);

  // 순번 배지
  drawRoundedRect(ctx, cardX + 18, y + 12, 74, 32, 8, '#1D4ED8');
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 18px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.fillText(`증상 ${index + 1}`, cardX + 55, y + 34);

  // 구분 배지
  const categoryText = item.category || '입고불량';
  drawRoundedRect(ctx, cardX + 104, y + 12, 130, 32, 8, '#DBEAFE', '#93C5FD', 1);
  ctx.fillStyle = '#1E40AF';
  ctx.font = `700 16px ${FONT_FAMILY}`;
  ctx.fillText(truncateText(ctx, categoryText, 114), cardX + 169, y + 34);

  // 불량 증상명
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 21px ${FONT_FAMILY}`;
  ctx.fillText(
    truncateText(ctx, item.symptomName || '불량 증상', 520),
    cardX + 250,
    y + 35
  );

  // 수리비용 표시 (우측)
  ctx.textAlign = 'right';
  const displayCost =
    isAgreed && item.agreedCost !== undefined ? item.agreedCost : item.estimatedCost;
  ctx.fillStyle = '#B91C1C';
  ctx.font = `700 22px ${FONT_FAMILY}`;
  ctx.fillText(
    `${isAgreed ? '합의 수리비' : '예상 수리비'}: ${formatKRW(displayCost)}`,
    cardX + cardW - 22,
    y + 36
  );

  // 상세 메모 줄
  ctx.textAlign = 'left';
  ctx.fillStyle = '#334155';
  ctx.font = `500 17px ${FONT_FAMILY}`;
  const memoStr = item.memo ? `상세 내역: ${item.memo}` : '상세 내역: 입고 점검 시 확인된 파손·불량 항목';
  ctx.fillText(truncateText(ctx, memoStr, cardW - 44), cardX + 22, y + 88);

  if (
    isAgreed &&
    item.agreedCost !== undefined &&
    item.agreedCost !== item.estimatedCost
  ) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748B';
    ctx.font = `500 15px ${FONT_FAMILY}`;
    ctx.fillText(
      `당초 예상 수리비: ${formatKRW(item.estimatedCost)}`,
      cardX + cardW - 22,
      y + 88
    );
  }

  // 사진 최대 2장 렌더링
  if (hasPhotos) {
    const photos = item.photos.slice(0, 2);
    const photoBoxW = (cardW - 64) / 2;
    const photoBoxH = 250;
    const photoY = y + 114;

    for (let pIdx = 0; pIdx < 2; pIdx++) {
      const photoX = cardX + 22 + pIdx * (photoBoxW + 20);
      drawRoundedRect(ctx, photoX, photoY, photoBoxW, photoBoxH, 10, '#FFFFFF', '#CBD5E1', 1.5);

      const src = photos[pIdx];
      if (src) {
        const img = await loadImageElement(src);
        if (img) {
          const pad = 8;
          const availW = photoBoxW - pad * 2;
          const availH = photoBoxH - 36;
          const scale = Math.min(availW / img.width, availH / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const drawX = photoX + (photoBoxW - drawW) / 2;
          const drawY = photoY + 8 + (availH - drawH) / 2;
          ctx.drawImage(img, drawX, drawY, drawW, drawH);

          ctx.fillStyle = '#475569';
          ctx.font = `600 14px ${FONT_FAMILY}`;
          ctx.textAlign = 'center';
          ctx.fillText(
            `증빙 사진 ${pIdx + 1}`,
            photoX + photoBoxW / 2,
            photoY + photoBoxH - 10
          );
        } else {
          ctx.fillStyle = '#94A3B8';
          ctx.font = `500 16px ${FONT_FAMILY}`;
          ctx.textAlign = 'center';
          ctx.fillText(
            '사진 이미지를 불러올 수 없습니다',
            photoX + photoBoxW / 2,
            photoY + photoBoxH / 2
          );
        }
      } else {
        ctx.fillStyle = '#CBD5E1';
        ctx.font = `500 16px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillText(
          `추가 사진 미첨부 (${pIdx + 1}/2)`,
          photoX + photoBoxW / 2,
          photoY + photoBoxH / 2
        );
      }
    }
  }

  ctx.textAlign = 'left';
  return y + cardH + 22;
}

/**
 * 입고 불량 상태 및 사진(증상당 최대 2장), 수리비용 정보를 1개의 PDF 문서(Uint8Array)로 조립한다.
 */
export async function generateRepairClaimPdfBytes(
  meta: InboundDefectClaimMeta
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const items =
    meta.defectItems && meta.defectItems.length > 0
      ? meta.defectItems
      : [
          {
            id: 'DEF-1',
            category: '입고불량',
            symptomName: '입고 자산 파손·불량 수리비',
            estimatedCost: meta.initialEstimatedAmount || meta.agreedAmount || 0,
            agreedCost: meta.agreedAmount || meta.initialEstimatedAmount || 0,
            photos: [],
          },
        ];

  const isAgreed = meta.negotiationStatus === 'AGREED';
  const isAdjusted =
    meta.agreedAmount !== undefined &&
    meta.agreedAmount !== meta.initialEstimatedAmount;

  // 페이지 분할: 1페이지는 최대 2개 증상, 이후 페이지는 최대 3개 증상 배치
  const pagesItems: { items: InboundClaimDefectItem[]; startIndex: number }[] = [];
  pagesItems.push({ items: items.slice(0, 2), startIndex: 0 });
  let cursor = 2;
  while (cursor < items.length) {
    pagesItems.push({ items: items.slice(cursor, cursor + 3), startIndex: cursor });
    cursor += 3;
  }

  const totalPages = pagesItems.length;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const chunk = pagesItems[pageIdx];
    const pngBytes = await renderPageCanvasToPngBytes(async (ctx) => {
      // 상단 헤더 배너
      drawRoundedRect(ctx, 64, 52, CANVAS_W - 128, 112, 14, '#0F172A');
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.font = `700 34px ${FONT_FAMILY}`;
      ctx.fillText('입고 자산 파손·불량 수리비 내역서', 96, 106);

      ctx.fillStyle = '#93C5FD';
      ctx.font = `500 18px ${FONT_FAMILY}`;
      ctx.fillText(
        `(주)기연리프트 | 문서번호: ${meta.receivableId || '-'} | 발행일: ${new Date().toISOString().slice(0, 10)}`,
        96,
        142
      );

      // 우측 상태 배지
      const statusLabel =
        meta.negotiationStatus === 'AGREED'
          ? '최종 합의 완료'
          : meta.negotiationStatus === 'SENT_TO_CUSTOMER'
            ? '고객 협의 진행중'
            : '수리비 청구 안내';
      drawRoundedRect(ctx, CANVAS_W - 290, 80, 198, 52, 10, '#1E3A8A', '#60A5FA', 1.5);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 20px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(statusLabel, CANVAS_W - 191, 113);

      let currentY = 188;

      if (pageIdx === 0) {
        // 1. 고객 및 입고 자산 기본 정보 박스
        drawRoundedRect(ctx, 64, currentY, CANVAS_W - 128, 176, 12, '#F8FAFC', '#CBD5E1', 2);

        const col1LabelX = 92;
        const col1ValX = 230;
        const col2LabelX = 650;
        const col2ValX = 790;

        const rows = [
          {
            l1: '고객명',
            v1: meta.customerName || '-',
            l2: '현장명',
            v2: meta.siteName || '-',
          },
          {
            l1: '자산번호',
            v1: `${meta.assetNo || '-'}${meta.modelName ? ` (${meta.modelName})` : ''}`,
            l2: '입고일자',
            v2: meta.inboundDate || '-',
          },
          {
            l1: '불량 증상 수',
            v1: `총 ${items.length}건 (사진 ${items.reduce((s, it) => s + (it.photos?.length || 0), 0)}장)`,
            l2: '담당자',
            v2: meta.salespersonName || meta.registeredByName || '출고·영업팀',
          },
        ];

        rows.forEach((r, idx) => {
          const rowY = currentY + 46 + idx * 48;
          ctx.textAlign = 'left';
          ctx.fillStyle = '#475569';
          ctx.font = `700 18px ${FONT_FAMILY}`;
          ctx.fillText(r.l1, col1LabelX, rowY);
          ctx.fillText(r.l2, col2LabelX, rowY);

          ctx.fillStyle = '#0F172A';
          ctx.font = `700 20px ${FONT_FAMILY}`;
          ctx.fillText(truncateText(ctx, r.v1, 390), col1ValX, rowY);
          ctx.fillText(truncateText(ctx, r.v2, 360), col2ValX, rowY);
        });

        currentY += 196;

        // 2. 수리비 총액 요약 배너
        drawRoundedRect(ctx, 64, currentY, CANVAS_W - 128, 96, 12, '#FEF2F2', '#FCA5A5', 2);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#7F1D1D';
        ctx.font = `700 20px ${FONT_FAMILY}`;
        ctx.fillText('수리비 청구 요약 (부가세 별도)', 92, currentY + 40);

        ctx.fillStyle = '#475569';
        ctx.font = `600 17px ${FONT_FAMILY}`;
        const subText = isAdjusted
          ? `최초 예상 수리비 합계: ${formatKRW(meta.initialEstimatedAmount)}  ➔  조정·합의 수리비 합계: ${formatKRW(meta.agreedAmount)}`
          : `예상 수리비 합계: ${formatKRW(meta.initialEstimatedAmount)}`;
        ctx.fillText(subText, 92, currentY + 72);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#B91C1C';
        ctx.font = `700 30px ${FONT_FAMILY}`;
        const finalDisplayAmt =
          meta.agreedAmount !== undefined ? meta.agreedAmount : meta.initialEstimatedAmount;
        ctx.fillText(
          `${isAgreed ? '최종 합의 금액' : '청구 예정 금액'}: ${formatKRW(finalDisplayAmt)}`,
          CANVAS_W - 92,
          currentY + 58
        );

        currentY += 120;
      }

      // 섹션 타이틀
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0F172A';
      ctx.font = `700 22px ${FONT_FAMILY}`;
      ctx.fillText(
        `불량 증상별 상세 내역 및 증빙 사진 (${chunk.startIndex + 1}~${chunk.startIndex + chunk.items.length} / 전체 ${items.length}건)`,
        64,
        currentY + 24
      );
      currentY += 42;

      for (let i = 0; i < chunk.items.length; i++) {
        currentY = await drawSymptomCard(
          ctx,
          chunk.items[i],
          chunk.startIndex + i,
          currentY,
          isAgreed || isAdjusted
        );
      }

      // 마지막 페이지이고 협상 비고가 있으면 표시
      if (pageIdx === totalPages - 1 && meta.negotiationMemo) {
        drawRoundedRect(ctx, 64, currentY, CANVAS_W - 128, 74, 10, '#FFFBEB', '#FDE68A', 1.5);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#92400E';
        ctx.font = `700 17px ${FONT_FAMILY}`;
        ctx.fillText('협의 및 조정 비고:', 88, currentY + 30);
        ctx.fillStyle = '#451A03';
        ctx.font = `500 17px ${FONT_FAMILY}`;
        ctx.fillText(
          truncateText(ctx, meta.negotiationMemo, CANVAS_W - 180),
          88,
          currentY + 56
        );
      }

      // 하단 푸터
      ctx.fillStyle = '#64748B';
      ctx.font = `500 15px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(
        '본 내역서는 입고 자산 점검 결과 및 증빙 사진을 기반으로 작성되었으며, 최종 합의된 금액은 당월 청구서에 반영됩니다.',
        64,
        CANVAS_H - 48
      );
      ctx.textAlign = 'right';
      ctx.fillText(`페이지 ${pageIdx + 1} / ${totalPages}`, CANVAS_W - 64, CANVAS_H - 48);
    });

    const pngImage = await pdfDoc.embedPng(pngBytes);
    const page = pdfDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: A4_WIDTH_PT,
      height: A4_HEIGHT_PT,
    });
  }

  return await pdfDoc.save();
}

export function buildRepairClaimPdfFileName(meta: InboundDefectClaimMeta): string {
  const safeCustomer = (meta.customerName || '고객사').replace(/[\\/:*?"<>|\s]+/g, '_');
  const safeAsset = (meta.assetNo || '자산').replace(/[\\/:*?"<>|\s]+/g, '_');
  const dateStr = (meta.inboundDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  return `수리비내역서_${safeCustomer}_${safeAsset}_${dateStr}.pdf`;
}

export async function downloadRepairClaimPdf(meta: InboundDefectClaimMeta): Promise<string> {
  const pdfBytes = await generateRepairClaimPdfBytes(meta);
  const fileName = buildRepairClaimPdfFileName(meta);
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return fileName;
}

/**
 * 모바일(카카오톡 등)로 1개의 PDF 파일을 즉시 공유하거나, 미지원 환경에서는 자동 다운로드한다.
 */
export async function shareRepairClaimPdfMobile(
  meta: InboundDefectClaimMeta
): Promise<{ shared: boolean; method: 'WEB_SHARE' | 'DOWNLOAD'; fileName: string }> {
  const pdfBytes = await generateRepairClaimPdfBytes(meta);
  const fileName = buildRepairClaimPdfFileName(meta);
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const file = new File([blob], fileName, { type: 'application/pdf' });

  const finalAmt =
    meta.agreedAmount !== undefined ? meta.agreedAmount : meta.initialEstimatedAmount;
  const shareTitle = `[기연리프트] ${meta.customerName} (${meta.assetNo}) 입고 수리비 내역서`;
  const shareText = `${meta.customerName} (${meta.siteName}) 입고 자산[${meta.assetNo}] 파손·불량 수리비 내역서입니다. (입고일: ${meta.inboundDate}, 청구예정액: ${formatKRW(finalAmt)})`;

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  if (typeof nav.share === 'function') {
    try {
      if (!nav.canShare || nav.canShare({ files: [file] })) {
        await nav.share({
          title: shareTitle,
          text: shareText,
          files: [file],
        });
        return { shared: true, method: 'WEB_SHARE', fileName };
      }
    } catch (err: any) {
      if (err && err.name === 'AbortError') {
        return { shared: false, method: 'WEB_SHARE', fileName };
      }
      // 파일 공유 실패 시 다운로드로 폴백
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { shared: true, method: 'DOWNLOAD', fileName };
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(sub));
  }
  return btoa(binary);
}

/**
 * 조립된 1개의 PDF 내역서를 첨부하여 고객 이메일로 발송한다.
 */
export async function sendRepairClaimPdfEmail(
  meta: InboundDefectClaimMeta,
  params: {
    toEmail: string;
    ccEmail?: string;
    customMessage?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const to = (params.toEmail || '').trim();
  if (!to) {
    return { success: false, error: '수신자 이메일 주소를 입력해 주십시오.' };
  }

  const pdfBytes = await generateRepairClaimPdfBytes(meta);
  const base64Pdf = uint8ArrayToBase64(pdfBytes);
  const fileName = buildRepairClaimPdfFileName(meta);
  const finalAmt =
    meta.agreedAmount !== undefined ? meta.agreedAmount : meta.initialEstimatedAmount;

  const symptomRowsHtml = (meta.defectItems || [])
    .map(
      (item, idx) => `
      <tr>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;">${idx + 1}</td>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;">${item.category || '입고불량'}</td>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;font-weight:bold;">${item.symptomName}</td>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;">${(item.photos || []).length}장</td>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:right;font-weight:bold;color:#b91c1c;">
          ${formatKRW(item.agreedCost !== undefined ? item.agreedCost : item.estimatedCost)}
        </td>
      </tr>`
    )
    .join('');

  const html = `
    <div style="font-family:'Malgun Gothic',sans-serif;color:#0f172a;line-height:1.6;max-width:680px;">
      <h2 style="color:#1e3a8a;margin-bottom:8px;">[기연리프트] 입고 자산 파손·불량 수리비 내역서 안내</h2>
      <p style="margin-top:0;color:#475569;">
        안녕하십니까, (주)기연리프트입니다.<br/>
        귀 현장에서 반납·입고된 장비의 점검 결과 확인된 파손·불량 내역 및 증빙 사진 PDF 문서를 첨부하여 송부드립니다.
      </p>
      ${
        params.customMessage
          ? `<div style="background:#f8fafc;border-left:4px solid #2563eb;padding:12px 16px;margin:14px 0;white-space:pre-line;">${params.customMessage}</div>`
          : ''
      }
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
        <tr>
          <th style="background:#f1f5f9;padding:8px 12px;border:1px solid #cbd5e1;text-align:left;width:22%;">고객명</th>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;width:28%;">${meta.customerName}</td>
          <th style="background:#f1f5f9;padding:8px 12px;border:1px solid #cbd5e1;text-align:left;width:22%;">현장명</th>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;width:28%;">${meta.siteName}</td>
        </tr>
        <tr>
          <th style="background:#f1f5f9;padding:8px 12px;border:1px solid #cbd5e1;text-align:left;">자산번호</th>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;font-weight:bold;">${meta.assetNo}${meta.modelName ? ` (${meta.modelName})` : ''}</td>
          <th style="background:#f1f5f9;padding:8px 12px;border:1px solid #cbd5e1;text-align:left;">입고일자</th>
          <td style="padding:8px 12px;border:1px solid #cbd5e1;">${meta.inboundDate}</td>
        </tr>
        <tr>
          <th style="background:#fef2f2;padding:8px 12px;border:1px solid #cbd5e1;text-align:left;color:#991b1b;">수리비 합계</th>
          <td colspan="3" style="padding:8px 12px;border:1px solid #cbd5e1;font-weight:bold;color:#b91c1c;font-size:16px;">
            ${formatKRW(finalAmt)} (부가세 별도)
          </td>
        </tr>
      </table>
      <h4 style="margin:18px 0 8px 0;color:#1e293b;">불량 증상별 요약</h4>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#e2e8f0;">
            <th style="padding:8px 10px;border:1px solid #cbd5e1;width:10%;">순번</th>
            <th style="padding:8px 10px;border:1px solid #cbd5e1;width:20%;">구분</th>
            <th style="padding:8px 10px;border:1px solid #cbd5e1;">불량 증상명</th>
            <th style="padding:8px 10px;border:1px solid #cbd5e1;width:14%;">증빙사진</th>
            <th style="padding:8px 10px;border:1px solid #cbd5e1;width:22%;">수리비용</th>
          </tr>
        </thead>
        <tbody>
          ${symptomRowsHtml}
        </tbody>
      </table>
      <p style="font-size:13px;color:#64748b;margin-top:16px;">
        * 증상별 촬영 사진 및 상세 내역은 첨부된 PDF 문서(<b>${fileName}</b>)에서 확인하실 수 있습니다.
      </p>
    </div>
  `;

  return await (emailService.sendEmail as any)({
    to,
    cc: params.ccEmail ? params.ccEmail.trim() : undefined,
    subject: `[기연리프트] ${meta.customerName} (${meta.assetNo}) 입고 파손·불량 수리비 내역서`,
    html,
    attachments: [
      {
        filename: fileName,
        content: base64Pdf,
      },
    ],
  });
}
