export function generateReceiptHtml(delivery: any, contract: any, customer: any, site: any, tenant: any): string {
  const dateStr = new Date().toLocaleDateString('ko-KR');
  const dTypeStr = delivery.type === 'OUTBOUND' ? '출고' : delivery.type === 'INBOUND' ? '회수' : '교환';
  
  const receiverName = site?.contactName || customer?.representative || '인수담당자';
  
  return `
    <div style="font-family: 'Malgun Gothic', sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #000;">
      <h1 style="text-align: center; font-size: 28px; border-bottom: 2px solid #000; padding-bottom: 10px;">납품(인수)증</h1>
      
      <div style="display: flex; justify-content: space-between; margin-top: 20px;">
        <div style="width: 48%;">
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
            <tr>
              <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0; width: 30%;">고객사명</th>
              <td style="border: 1px solid #000; padding: 8px;">${customer?.name || ''}</td>
            </tr>
            <tr>
              <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0;">현장명</th>
              <td style="border: 1px solid #000; padding: 8px;">${site?.name || ''}</td>
            </tr>
            <tr>
              <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0;">인수자</th>
              <td style="border: 1px solid #000; padding: 8px;">${receiverName}</td>
            </tr>
          </table>
        </div>
        <div style="width: 48%;">
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
            <tr>
              <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0; width: 30%;">공급자</th>
              <td style="border: 1px solid #000; padding: 8px;">${tenant?.displayName || '기연리프트'}</td>
            </tr>
            <tr>
              <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0;">작업일자</th>
              <td style="border: 1px solid #000; padding: 8px;">${delivery.loadingDate || dateStr}</td>
            </tr>
            <tr>
              <th style="border: 1px solid #000; padding: 8px; background: #f0f0f0;">배차구분</th>
              <td style="border: 1px solid #000; padding: 8px;">${dTypeStr}</td>
            </tr>
          </table>
        </div>
      </div>

      <div style="margin-top: 20px;">
        <h3 style="margin-bottom: 10px;">납품 내역</h3>
        <table style="width: 100%; border-collapse: collapse; border: 2px solid #000; text-align: center;">
          <thead>
            <tr>
              <th style="border: 1px solid #000; padding: 10px; background: #f0f0f0;">품목(장비종류)</th>
              <th style="border: 1px solid #000; padding: 10px; background: #f0f0f0;">수량</th>
              <th style="border: 1px solid #000; padding: 10px; background: #f0f0f0;">상/하차지</th>
              <th style="border: 1px solid #000; padding: 10px; background: #f0f0f0;">비고</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #000; padding: 10px;">${delivery.cargoItems || '고소작업대'}</td>
              <td style="border: 1px solid #000; padding: 10px;">1</td>
              <td style="border: 1px solid #000; padding: 10px;">${delivery.destinationAddress || site?.address || ''}</td>
              <td style="border: 1px solid #000; padding: 10px;">${delivery.memo || ''}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div style="margin-top: 40px; text-align: right; font-size: 16px;">
        위 장비를 이상 없이 정히 인수(반납) 하였음을 확인합니다.<br/><br/>
        <strong>인수자 (서명): </strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      </div>
    </div>
  `;
}
