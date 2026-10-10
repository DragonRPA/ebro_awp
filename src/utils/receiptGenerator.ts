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
        <td style="border: 1px solid #000; padding: 10px;">${p.modelName || '장비'}</td>
        <td style="border: 1px solid #000; padding: 10px;">${p.count || 1}대</td>
        <td style="border: 1px solid #000; padding: 10px;">${site?.address || delivery?.destinationAddress || '-'}</td>
        <td style="border: 1px solid #000; padding: 10px;">&nbsp;</td>
      </tr>
    `).join('')
    : `
      <tr>
        <td style="border: 1px solid #000; padding: 10px;">${delivery?.cargoItems || '고소작업대 (장비 미지정)'}</td>
        <td style="border: 1px solid #000; padding: 10px;">1대</td>
        <td style="border: 1px solid #000; padding: 10px;">${site?.address || delivery?.destinationAddress || '-'}</td>
        <td style="border: 1px solid #000; padding: 10px;">&nbsp;</td>
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
