// src/modules/dispatchRequest/dispatchOrderPrintHtml.ts
// 출고요청서 A4 정식 인쇄 HTML 생성 모듈 (원격 무인 인쇄 큐 및 브라우저 인쇄 공용)

import { EquipmentItem, PaidBy } from './dispatchOrderTypes';

export interface DispatchOrderPrintPayload {
  customerName: string;
  siteName: string;
  siteAddress: string;
  siteContactName: string;
  siteContactPhone: string;
  loadingSchedule: string;
  unloadingSchedule: string;
  equipments: EquipmentItem[];
  safetyOptions: string[];
  note: string;
  staggeredMemo?: string;
  retrievalAssetIds?: string[];
  vehicleType?: string;
  paidBy?: PaidBy | null;
  contextLabel?: string;
  closingDay?: number;
  statementClosingDay?: number;
  paymentDueDay?: number;
  requesterName?: string;
}

export function buildDispatchOrderPrintHtml(payload: DispatchOrderPrintPayload): {
  html: string;
  customerName: string;
  siteName: string;
} {
  const {
    customerName = '',
    siteName = '',
    siteAddress = '',
    siteContactName = '',
    siteContactPhone = '',
    loadingSchedule = '',
    unloadingSchedule = '',
    equipments = [],
    safetyOptions = [],
    note = '',
    staggeredMemo = '',
    retrievalAssetIds = [],
    vehicleType = '5T',
    paidBy = null,
    contextLabel = '출고 요청',
    closingDay = 30,
    statementClosingDay = 25,
    paymentDueDay = 15,
    requesterName = '-'
  } = payload;

  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const printTimeStr = `${y}.${mo}.${d} ${hh}:${mi}:${ss}`;

  const totalCount = equipments.reduce((sum, e) => sum + (Number(e.qty) || 1), 0);
  const paidByLabel =
    paidBy === 'CUSTOMER'
      ? '고객사 부담'
      : paidBy === 'OURS'
        ? '당사 부담'
        : paidBy === 'SPLIT'
          ? '편도 지원'
          : '기본 운임';

  const unitList: { no: number; modelName: string }[] = [];
  let uNo = 1;
  for (const eq of equipments) {
    const q = Math.max(1, Number(eq.qty) || 1);
    for (let i = 0; i < q; i++) {
      unitList.push({ no: uNo++, modelName: eq.modelName || '-' });
    }
  }
  const halfCount = Math.max(1, Math.ceil(unitList.length / 2));
  let assetRowsHtml = '';
  for (let i = 0; i < halfCount; i++) {
    const left = unitList[i];
    const right = unitList[i + halfCount];
    assetRowsHtml += `
      <tr>
        <td style="text-align:center;">${left ? left.no : '&nbsp;'}</td>
        <td style="font-weight:700; padding-left:5px;">${left ? left.modelName : '&nbsp;'}</td>
        <td style="text-align:center;">&nbsp;</td>
        <td style="text-align:center; border-right:2px solid #000000; font-size:7.5pt;">${left ? '[ &nbsp; ]' : '&nbsp;'}</td>
        <td style="text-align:center;">${right ? right.no : '&nbsp;'}</td>
        <td style="font-weight:700; padding-left:5px;">${right ? right.modelName : '&nbsp;'}</td>
        <td style="text-align:center;">&nbsp;</td>
        <td style="text-align:center; font-size:7.5pt;">${right ? '[ &nbsp; ]' : '&nbsp;'}</td>
      </tr>`;
  }

  const noteLines = String(note || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  const noteRowsHtml =
    noteLines.length === 0
      ? `<tr><th class="nowrap">요청사항</th><td class="wrap-text" style="line-height: 1.35; padding: 3px 5px !important;">특이사항 없음</td></tr>`
      : noteLines
          .map(
            (line, idx) => `
        <tr>
          <th class="nowrap">${idx === 0 ? '요청사항' : `요청사항 (${idx + 1})`}</th>
          <td class="wrap-text" style="line-height: 1.35; padding: 3px 5px !important; white-space: pre-wrap; word-break: break-all;">${line}</td>
        </tr>
      `
          )
          .join('');

  const html = `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <title>출고요청서_${customerName || '고객사'}_${siteName || '현장'}</title>
    <style>
      @page { size: A4 portrait; margin: 7mm 10mm; }
      body {
        font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
        color: #000;
        background: #fff;
        margin: 0;
        padding: 0;
        font-size: 9pt;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        border-bottom: 2px solid #000;
        padding-bottom: 6px;
        margin-bottom: 8px;
      }
      .title { font-size: 16pt; font-weight: 900; letter-spacing: 1px; }
      .meta { font-size: 8pt; text-align: right; line-height: 1.4; }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 8px;
        table-layout: fixed;
      }
      th, td {
        border: 1px solid #000;
        padding: 4px 6px;
        font-size: 8.5pt;
        vertical-align: middle;
      }
      th {
        background: #e2e8f0;
        font-weight: 800;
        text-align: center;
      }
      .section-title {
        font-size: 9.5pt;
        font-weight: 900;
        margin: 6px 0 3px 0;
      }
      .nowrap { white-space: nowrap; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div style="font-size:8.5pt; font-weight:700;">(주)기연리프트 출고요청서</div>
        <div class="title">장비 출고 요청서 (${contextLabel})</div>
      </div>
      <div class="meta">
        <div>발행일시: ${printTimeStr}</div>
        <div>요청담당: ${requesterName}</div>
      </div>
    </div>

    <div class="section-title">1. 거래처 및 현장 정보</div>
    <table>
      <colgroup>
        <col style="width:15%">
        <col style="width:35%">
        <col style="width:15%">
        <col style="width:35%">
      </colgroup>
      <tr>
        <th>고객사명</th>
        <td style="font-weight:800;">${customerName || '-'}</td>
        <th>투입 현장명</th>
        <td style="font-weight:800;">${siteName || '-'}</td>
      </tr>
      <tr>
        <th>현장 상세주소</th>
        <td colspan="3">${siteAddress || '-'}</td>
      </tr>
      <tr>
        <th>현장 인수담당</th>
        <td>${siteContactName || '-'}</td>
        <th>담당자 연락처</th>
        <td style="font-weight:800;">${siteContactPhone || '-'}</td>
      </tr>
      <tr>
        <th>상차 요청일시</th>
        <td style="font-weight:800;">${loadingSchedule || '-'}</td>
        <th>하차 요청일시</th>
        <td style="font-weight:800;">${unloadingSchedule || loadingSchedule || '-'}</td>
      </tr>
      <tr>
        <th>희망 차종 / 운임</th>
        <td>${vehicleType || '5T'} / ${paidByLabel}</td>
        <th>정산 마감일정</th>
        <td>명세서 ${statementClosingDay}일 / 계산서 ${closingDay}일 / 결제 ${paymentDueDay}일</td>
      </tr>
    </table>

    <div class="section-title">2. 출고 요청 장비 및 현장 호기 배정표 (총 ${totalCount}대)</div>
    <table>
      <colgroup>
        <col style="width:7%">
        <col style="width:18%">
        <col style="width:15%">
        <col style="width:10%">
        <col style="width:7%">
        <col style="width:18%">
        <col style="width:15%">
        <col style="width:10%">
      </colgroup>
      <thead>
        <tr>
          <th>순번</th>
          <th>요청 모델</th>
          <th>배정 자산번호</th>
          <th style="border-right:2px solid #000;">상차확인</th>
          <th>순번</th>
          <th>요청 모델</th>
          <th>배정 자산번호</th>
          <th>상차확인</th>
        </tr>
      </thead>
      <tbody>
        ${assetRowsHtml}
      </tbody>
    </table>

    <div class="section-title">3. 안전옵션 및 특이사항</div>
    <table>
      <colgroup>
        <col style="width:16%">
        <col style="width:84%">
      </colgroup>
      <tr>
        <th>요청 안전옵션</th>
        <td style="font-weight:800;">${safetyOptions.length > 0 ? safetyOptions.join(', ') : '안전옵션 없음'}</td>
      </tr>
      ${staggeredMemo ? `<tr><th>시차출고 일정</th><td>${staggeredMemo}</td></tr>` : ''}
      ${
        retrievalAssetIds && retrievalAssetIds.length > 0
          ? `<tr><th>교환 회수대상</th><td>${
              retrievalAssetIds.includes('UNKNOWN') ? '모름 (현장 확인 후 회수)' : retrievalAssetIds.join(', ')
            }</td></tr>`
          : ''
      }
      ${noteRowsHtml}
    </table>
  </body>
</html>`;

  return { html, customerName, siteName };
}
