export function generateReceiptHtml(delivery: any, contract: any, customer: any, site: any, tenant: any): string {
  const dateStr = new Date().toLocaleDateString('ko-KR');
  const dTypeStr = delivery?.type === 'OUTBOUND' ? '출고' : delivery?.type === 'INBOUND' ? '회수' : '교환';
  
  const receiverName = site?.contactName || customer?.representative || '인수담당자';
  const receiverPhone = site?.contactPhone || customer?.phone || site?.safetyContactPhone || '-';
  const contractNoStr = contract?.contractNo || contract?.id || delivery?.contractId || '-';
  
  let parsedCargos: any[] = [];
  if (delivery?.cargoItems) {
    try {
      const parsed = JSON.parse(delivery.cargoItems);
      if (Array.isArray(parsed)) {
        parsedCargos = parsed;
      }
    } catch(e) {}
  }
  
  // 비고 컬럼은 요구사항에 따라 항상 공백으로 출력
  const cargoHtml = parsedCargos.length > 0 
    ? parsedCargos.map(p => `
      <tr>
        <td style="border: 1px solid #000; padding: 10px; text-align: center;">${p.modelName || '장비'}</td>
        <td style="border: 1px solid #000; padding: 10px; text-align: center;">${p.count || 1}대</td>
        <td style="border: 1px solid #000; padding: 10px; text-align: center;">${site?.address || delivery?.destinationAddress || '-'}</td>
        <td style="border: 1px solid #000; padding: 10px; text-align: center;">&nbsp;</td>
      </tr>
    `).join('')
    : `
      <tr>
        <td style="border: 1px solid #000; padding: 10px; text-align: center;">${delivery?.cargoItems || '고소작업대 (장비 미지정)'}</td>
        <td style="border: 1px solid #000; padding: 10px; text-align: center;">1대</td>
        <td style="border: 1px solid #000; padding: 10px; text-align: center;">${site?.address || delivery?.destinationAddress || '-'}</td>
        <td style="border: 1px solid #000; padding: 10px; text-align: center;">&nbsp;</td>
      </tr>
    `;

  return `
    <div style="font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; padding: 24px; max-width: 800px; margin: 0 auto; color: #000; background-color: #fff;">
      <h1 style="text-align: center; font-size: 28px; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; letter-spacing: 2px;">납품(인수)증</h1>
      
      <div style="display: flex; justify-content: space-between; margin-top: 16px;">
        <div style="width: 49%;">
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
            <tr>
              <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0; width: 32%; text-align: center;">계약번호</th>
              <td style="border: 1px solid #000; padding: 8px; font-weight: 700;">${contractNoStr}</td>
            </tr>
            <tr>
              <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0; width: 32%; text-align: center;">고객/현장</th>
              <td style="border: 1px solid #000; padding: 8px;">${customer?.name || '미확인'} / ${site?.name || '미확인'}</td>
            </tr>
            <tr>
              <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0; width: 32%; text-align: center;">하차지 주소</th>
              <td style="border: 1px solid #000; padding: 8px; font-size: 13px;">${site?.address || delivery?.destinationAddress || '-'}</td>
            </tr>
            <tr>
              <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0; width: 32%; text-align: center;">인수자</th>
              <td style="border: 1px solid #000; padding: 8px;">${receiverName}</td>
            </tr>
          </table>
        </div>
        <div style="width: 49%;">
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
            <tr>
              <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0; width: 32%; text-align: center;">공급자</th>
              <td style="border: 1px solid #000; padding: 8px; font-weight: 700;">${tenant?.displayName || '기연리프트'}</td>
            </tr>
            <tr>
              <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0; width: 32%; text-align: center;">납품일</th>
              <td style="border: 1px solid #000; padding: 8px;">${delivery?.loadingDate || delivery?.requestDate || dateStr}</td>
            </tr>
            <tr>
              <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0; width: 32%; text-align: center;">배차구분</th>
              <td style="border: 1px solid #000; padding: 8px;">${dTypeStr}</td>
            </tr>
            <tr>
              <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0; width: 32%; text-align: center;">연락처</th>
              <td style="border: 1px solid #000; padding: 8px;">${receiverPhone}</td>
            </tr>
          </table>
        </div>
      </div>

      <div style="margin-top: 24px;">
        <h3 style="margin-bottom: 10px; font-size: 16px; font-weight: 700;">납품장비 리스트</h3>
        <table style="width: 100%; border-collapse: collapse; border: 2px solid #000; text-align: center;">
          <thead>
            <tr>
              <th style="border: 1px solid #000; padding: 10px; background: #f0f0f0; width: 40%;">품목(장비종류)</th>
              <th style="border: 1px solid #000; padding: 10px; background: #f0f0f0; width: 12%;">수량</th>
              <th style="border: 1px solid #000; padding: 10px; background: #f0f0f0; width: 28%;">하차지</th>
              <th style="border: 1px solid #000; padding: 10px; background: #f0f0f0; width: 20%;">비고</th>
            </tr>
          </thead>
          <tbody>
            ${cargoHtml}
          </tbody>
        </table>
      </div>
      
      <div style="margin-top: 40px; text-align: right; font-size: 15px; line-height: 1.8;">
        위 장비를 이상 없이 정히 인수(반납) 하였음을 확인합니다.<br/><br/>
        <strong>인수자 (서명): </strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      </div>
    </div>
  `;
}

export interface SignedReceiptCargoItem {
  modelName?: string;
  count?: number | string;
  note?: string;
}

export interface SignedReceiptOptions {
  delivery: any;
  contractNo?: string;
  customerName?: string;
  siteName?: string;
  siteAddress?: string;
  receiverName?: string;
  receiverPhone?: string;
  supplierName?: string;
  supplierInfo?: any;
  cargoList?: SignedReceiptCargoItem[];
  specialNotes?: string;
  signatureCanvas?: HTMLCanvasElement | null;
  signatureDataUrl?: string | null;
  signDate?: string;
}

export async function generateSignedReceiptCanvas(options: SignedReceiptOptions): Promise<HTMLCanvasElement> {
  const {
    delivery,
    contractNo = '-',
    customerName = '미확인',
    siteName = '미확인',
    siteAddress = '-',
    receiverName = '인수담당자',
    receiverPhone = '-',
    supplierName = '(주)기연리프트',
    supplierInfo = null,
    cargoList = [],
    specialNotes = '',
    signatureCanvas = null,
    signatureDataUrl = null,
    signDate = new Date().toISOString().split('T')[0]
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1700;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2d context');

  // 1. Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1200, 1700);

  // 2. Double border (Formal legal frame)
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(45, 45, 1110, 1610);

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.strokeRect(51, 51, 1098, 1598);

  // 3. Document Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 36px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('납 품 (인 수) 확 인 서', 600, 108);

  ctx.beginPath();
  ctx.moveTo(410, 124);
  ctx.lineTo(790, 124);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#0f172a';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(410, 128);
  ctx.lineTo(790, 128);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#64748b';
  ctx.stroke();

  // 4. Metadata bar
  ctx.font = '15px "Malgun Gothic", Pretendard, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'left';
  ctx.fillText(`배차번호 : ${delivery?.id || '-'}`, 65, 158);
  ctx.textAlign = 'center';
  ctx.fillText(`계약번호 : ${contractNo || '-'}`, 600, 158);
  ctx.textAlign = 'right';
  ctx.fillText(`발행일자 : ${signDate}`, 1135, 158);

  // Helper: draw formal table grid
  function drawTableGrid(x: number, y: number, w: number, h: number, headerTitle: string, rows: Array<{ label: string; value: string }>) {
    if (!ctx) return;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    // Header
    const headerH = 36;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(x, y, w, headerH);
    ctx.strokeRect(x, y, w, headerH);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px "Malgun Gothic", Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(headerTitle, x + w / 2, y + 24);

    // Rows
    const rowCount = rows.length;
    const rowH = (h - headerH) / rowCount;
    const labelW = 125;

    rows.forEach((row, idx) => {
      const curY = y + headerH + (idx * rowH);
      if (idx > 0) {
        ctx.beginPath();
        ctx.moveTo(x, curY);
        ctx.lineTo(x + w, curY);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();
      }
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x, curY, labelW, rowH);
      ctx.beginPath();
      ctx.moveTo(x + labelW, curY);
      ctx.lineTo(x + labelW, curY + rowH);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 14px "Malgun Gothic", Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(row.label, x + (labelW / 2), curY + (rowH / 2) + 5);

      ctx.fillStyle = '#0f172a';
      ctx.font = '14px "Malgun Gothic", Pretendard, sans-serif';
      ctx.textAlign = 'left';
      
      const val = row.value || '-';
      if (ctx.measureText(val).width > (w - labelW - 20)) {
        ctx.font = '12px "Malgun Gothic", Pretendard, sans-serif';
      }
      ctx.fillText(val, x + labelW + 12, curY + (rowH / 2) + 5);
    });
  }

  // 5. Left Box (공급자) & Right Box (공급받는자)
  const boxY = 175;
  const boxH = 215;
  const boxW = 525;

  const sCorpName = supplierInfo?.corporateName || supplierInfo?.tradeName || supplierName;
  const sRep = supplierInfo?.representativeName || '이수용';
  const sBizNo = supplierInfo?.businessNumber || '138-81-83251';
  const sAddr = supplierInfo?.headOfficeAddress || supplierInfo?.businessAddress || '경기도 용인시 처인구 백암면 고안로 51번길 33';
  const sTel = supplierInfo?.tel || '031-334-5295';
  const sFax = supplierInfo?.fax || '031-335-5297';

  drawTableGrid(65, boxY, boxW, boxH, '공    급    자', [
    { label: '상호(법인명)', value: sCorpName },
    { label: '대표자 성명', value: sRep },
    { label: '사업자등록번호', value: sBizNo },
    { label: '사업장 소재지', value: sAddr },
    { label: '대표전화/FAX', value: `${sTel} / ${sFax}` }
  ]);

  drawTableGrid(610, boxY, boxW, boxH, '공 급 받 는 자  (인 수 처)', [
    { label: '고객사 (상호)', value: customerName },
    { label: '현   장   명', value: siteName },
    { label: '하차지 주소', value: siteAddress },
    { label: '인수 담당자', value: receiverName },
    { label: '인수자 연락처', value: receiverPhone }
  ]);

  // 6. Delivery details bar
  const delBarY = 405;
  const delBarH = 50;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(65, delBarY, 1070, delBarH);

  const colW = 1070 / 4;
  const dType = delivery?.type === 'OUTBOUND' ? '출고 (OUTBOUND)' : delivery?.type === 'INBOUND' ? '회수 (INBOUND)' : delivery?.type === 'EXCHANGE' ? '교환 (EXCHANGE)' : '출고';
  const dDate = delivery?.unloadingDate || delivery?.requestDate || signDate;
  const dVehicle = delivery?.vehicleNumber || '화물 운송차량';
  const dDriver = delivery?.driverName ? `${delivery.driverName} (${delivery.driverContact || '-'})` : '지정 기사';

  const subCols = [
    { label: '배차구분', val: dType },
    { label: '납품일자', val: dDate },
    { label: '운송차량', val: dVehicle },
    { label: '운송기사', val: dDriver }
  ];

  subCols.forEach((col, idx) => {
    const cx = 65 + (idx * colW);
    if (idx > 0) {
      ctx.beginPath();
      ctx.moveTo(cx, delBarY);
      ctx.lineTo(cx, delBarY + delBarH);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const lW = 85;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cx, delBarY, lW, delBarH);
    ctx.beginPath();
    ctx.moveTo(cx + lW, delBarY);
    ctx.lineTo(cx + lW, delBarY + delBarH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 13px "Malgun Gothic", Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(col.label, cx + (lW / 2), delBarY + 30);

    ctx.fillStyle = '#0f172a';
    ctx.font = '13.5px "Malgun Gothic", Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(col.val, cx + lW + 10, delBarY + 30);
  });

  // 7. Equipment List Table (Centering all columns per user rule)
  const eqTitleY = 480;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 17px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('■ 납품 장비 목록', 65, eqTitleY);

  const tblY = 492;
  const tblW = 1070;
  const tblHdrH = 38;
  const tblRowH = 40;
  const columns = [
    { key: 'no', title: 'No.', w: 70 },
    { key: 'model', title: '품목 (장비 모델명)', w: 310 },
    { key: 'count', title: '수량', w: 120 },
    { key: 'unit', title: '단위', w: 90 },
    { key: 'site', title: '하차지 (현장명)', w: 300 },
    { key: 'note', title: '비고', w: 180 }
  ];

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(65, tblY, tblW, tblHdrH);
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(65, tblY, tblW, tblHdrH);

  let curColX = 65;
  columns.forEach((col, idx) => {
    if (idx > 0) {
      ctx.beginPath();
      ctx.moveTo(curColX, tblY);
      ctx.lineTo(curColX, tblY + tblHdrH);
      ctx.strokeStyle = '#94a3b8';
      ctx.stroke();
    }
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 14px "Malgun Gothic", Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(col.title, curColX + (col.w / 2), tblY + 24);
    curColX += col.w;
  });

  const minRows = 5;
  const displayRows: Array<SignedReceiptCargoItem | null> = [...cargoList];
  if (displayRows.length === 0 && delivery?.cargoItems) {
    try {
      const parsed = JSON.parse(delivery.cargoItems);
      if (Array.isArray(parsed)) {
        displayRows.push(...parsed);
      } else {
        displayRows.push({ modelName: delivery.cargoItems, count: 1, note: '정상 납품' });
      }
    } catch (e) {
      displayRows.push({ modelName: delivery.cargoItems, count: 1, note: '정상 납품' });
    }
  }
  while (displayRows.length < minRows) {
    displayRows.push(null);
  }

  displayRows.forEach((item, rIdx) => {
    const ry = tblY + tblHdrH + (rIdx * tblRowH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(65, ry, tblW, tblRowH);

    let rx = 65;
    columns.forEach((col, cIdx) => {
      if (cIdx > 0) {
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx, ry + tblRowH);
        ctx.stroke();
      }

      ctx.font = '14px "Malgun Gothic", Pretendard, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center'; // User rule: All equipment list columns centered

      if (item) {
        if (col.key === 'no') ctx.fillText(String(rIdx + 1), rx + col.w / 2, ry + 25);
        else if (col.key === 'model') {
          ctx.font = 'bold 14px "Malgun Gothic", Pretendard, sans-serif';
          ctx.fillText(item.modelName || '고소작업대', rx + col.w / 2, ry + 25);
        } else if (col.key === 'count') {
          ctx.font = 'bold 14px "Malgun Gothic", Pretendard, sans-serif';
          ctx.fillStyle = '#2563eb';
          ctx.fillText(`${item.count || 1} 대`, rx + col.w / 2, ry + 25);
        } else if (col.key === 'unit') {
          ctx.fillText('대', rx + col.w / 2, ry + 25);
        } else if (col.key === 'site') {
          ctx.fillText(siteName || '-', rx + col.w / 2, ry + 25);
        } else if (col.key === 'note') {
          ctx.fillStyle = '#64748b';
          ctx.fillText(item.note || '-', rx + col.w / 2, ry + 25);
        }
      }
      rx += col.w;
    });
  });

  // Summary Row
  const totalCount = cargoList.length > 0 
    ? cargoList.reduce((acc, c) => acc + (Number(c.count) || 1), 0)
    : 1;
  const sumY = tblY + tblHdrH + (displayRows.length * tblRowH);
  const sumH = 38;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(65, sumY, tblW, sumH);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(65, sumY, tblW, sumH);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14.5px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`합 계 :  총 ${Math.max(cargoList.length, 1)}개 품목  /  ${totalCount}대`, 65 + (tblW / 2), sumY + 24);

  // Optional: Notes box
  let currentY = sumY + sumH;
  if (specialNotes) {
    const noteY = currentY + 10;
    const noteH = 38;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(65, noteY, tblW, noteH);
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(65, noteY, tblW, noteH);

    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 13px "Malgun Gothic", Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`※ 장비 옵션 및 요청사항 : ${specialNotes}`, 80, noteY + 24);
    currentY = noteY + noteH;
  }

  // 8. Confirmation statement
  const stmtY = currentY + 45;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('상기 장비를 이상 없이 정히 납품 (인수) 하였음을 상호 확인합니다.', 600, stmtY);

  const dateY = stmtY + 34;
  ctx.font = 'bold 17px "Malgun Gothic", Pretendard, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText(signDate.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1년  $2월  $3일'), 600, dateY);

  // 9. Signatures Area
  const signCardY = dateY + 35;
  const signCardH = 430;
  const signCardW = 525;

  // --- Left: Supplier Stamp Card ---
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(65, signCardY, signCardW, signCardH);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(65, signCardY, signCardW, 36);
  ctx.strokeRect(65, signCardY, signCardW, 36);

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 15px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('공  급  자  확  인  (출  고)', 65 + (signCardW / 2), signCardY + 24);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = '14px "Malgun Gothic", Pretendard, sans-serif';
  ctx.fillText(`상      호 :  ${sCorpName}`, 90, signCardY + 70);
  ctx.fillText(`대  표  자 :  ${sRep}`, 90, signCardY + 102);
  ctx.fillText(`사업자번호 :  ${sBizNo}`, 90, signCardY + 134);
  ctx.fillText(`소  재  지 :  ${sAddr}`, 90, signCardY + 166);

  // Corporate Seal (Stamp)
  const sealX = 65 + (signCardW / 2);
  const sealY = signCardY + 280;
  const sealR = 52;

  ctx.save();
  ctx.beginPath();
  ctx.arc(sealX, sealY, sealR, 0, Math.PI * 2);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(sealX, sealY, sealR - 6, 0, Math.PI * 2);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 17px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('주식회사', sealX, sealY - 14);
  ctx.font = 'bold 20px "Malgun Gothic", Pretendard, sans-serif';
  ctx.fillText('기연리프트', sealX, sealY + 10);
  ctx.font = 'bold 14px "Malgun Gothic", Pretendard, sans-serif';
  ctx.fillText('대표이사직인', sealX, sealY + 30);
  ctx.restore();

  ctx.fillStyle = '#64748b';
  ctx.font = '13px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${sCorpName} 대표이사 직인날인`, sealX, signCardY + 380);

  // --- Right: Receiver Signature Card ---
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.strokeRect(610, signCardY, signCardW, signCardH);

  ctx.fillStyle = '#eff6ff';
  ctx.fillRect(610, signCardY, signCardW, 36);
  ctx.strokeRect(610, signCardY, signCardW, 36);

  ctx.fillStyle = '#1e40af';
  ctx.font = 'bold 15px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('인 수 자  확 인  및  자 필 서 명', 610 + (signCardW / 2), signCardY + 24);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 15px "Malgun Gothic", Pretendard, sans-serif';
  ctx.fillText(`인수자(담당자) :  ${receiverName}`, 635, signCardY + 68);
  ctx.font = '14.5px "Malgun Gothic", Pretendard, sans-serif';
  ctx.fillStyle = '#2563eb';
  ctx.fillText(`인수자 연락처 :  ${receiverPhone}`, 635, signCardY + 98);

  // Signature Box
  const sigBoxX = 635;
  const sigBoxY = signCardY + 115;
  const sigBoxW = signCardW - 50;
  const sigBoxH = 245;

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sigBoxX, sigBoxY, sigBoxW, sigBoxH);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(sigBoxX, sigBoxY, sigBoxW, sigBoxH);

  // Draw signature if provided
  if (signatureCanvas) {
    const pad = 12;
    const targetW = sigBoxW - pad * 2;
    const targetH = sigBoxH - pad * 2;
    const scale = Math.min(targetW / signatureCanvas.width, targetH / signatureCanvas.height);
    const drawW = signatureCanvas.width * scale;
    const drawH = signatureCanvas.height * scale;
    const drawX = sigBoxX + (sigBoxW - drawW) / 2;
    const drawY = sigBoxY + (sigBoxH - drawH) / 2;

    ctx.drawImage(signatureCanvas, drawX, drawY, drawW, drawH);
  } else if (signatureDataUrl) {
    const sigImg = new Image();
    sigImg.crossOrigin = 'anonymous';
    sigImg.src = signatureDataUrl;
    await new Promise((resolve) => {
      sigImg.onload = resolve;
      sigImg.onerror = resolve;
    });
    if (sigImg.width > 0) {
      const pad = 12;
      const targetW = sigBoxW - pad * 2;
      const targetH = sigBoxH - pad * 2;
      const scale = Math.min(targetW / sigImg.width, targetH / sigImg.height);
      const drawW = sigImg.width * scale;
      const drawH = sigImg.height * scale;
      const drawX = sigBoxX + (sigBoxW - drawW) / 2;
      const drawY = sigBoxY + (sigBoxH - drawH) / 2;

      ctx.drawImage(sigImg, drawX, drawY, drawW, drawH);
    }
  }

  // Badge below signature
  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 13px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✓ 모바일 전자 자필 서명 확인 완료', 610 + (signCardW / 2), signCardY + 380);

  // 10. Footer
  const footLineY = signCardY + signCardH + 30;
  ctx.beginPath();
  ctx.moveTo(65, footLineY);
  ctx.lineTo(1135, footLineY);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '13px "Malgun Gothic", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('※ 본 확인서는 모바일 전자서명 시스템을 통하여 인수자 본인이 직접 확인 및 자필 서명한 정식 납품확인서입니다.', 600, footLineY + 26);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px "Malgun Gothic", Pretendard, sans-serif';
  ctx.fillText(`eBro Management System  |  ${sCorpName}  |  고객센터: ${sTel}  |  www.giyeonlift.co.kr`, 600, footLineY + 48);

  return canvas;
}

export async function generateSignedReceiptBlob(options: SignedReceiptOptions): Promise<Blob> {
  const canvas = await generateSignedReceiptCanvas(options);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create blob from signed receipt canvas'));
    }, 'image/png');
  });
}
