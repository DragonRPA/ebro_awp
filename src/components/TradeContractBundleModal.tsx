// src/components/TradeContractBundleModal.tsx
// 유통 물품매매계약서 표준 양식 편집기 및 엑셀 생성/이메일 발송 모달 (에이전트 연동 & 안전 격리)
import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, FileSpreadsheet, Download, Send, CheckCircle2, 
  AlertTriangle, ShieldCheck, RefreshCw, Mail, Building, User, Calendar, MapPin
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTrade } from '../context/TradeContext';
import { 
  generateTradeContractExcel, 
  TradeContractExcelData, 
  TradeContractParty, 
  TradeContractItem 
} from '../services/excelTemplateEngine';
import { fetchWithAgentFallback } from '../services/agentService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
}

export const TradeContractBundleModal: React.FC<Props> = ({ isOpen, onClose, orderId }) => {
  const { customers, currentTenant, currentUser, showErrorModal } = useApp();
  const { salesOrders, salesOrderLines, products, updateSalesOrder, sendTradeContractEmail } = useTrade();

  // 대상 수주 및 품목 조회
  const order = useMemo(() => salesOrders.find(o => o.id === orderId), [salesOrders, orderId]);
  const lines = useMemo(() => salesOrderLines.filter(l => l.orderId === orderId), [salesOrderLines, orderId]);
  const customer = useMemo(() => customers.find(c => c.id === order?.customerId), [customers, order]);

  // 계약 조건 폼 상태
  const [contractDate, setContractDate] = useState<string>(
    order?.orderDate || new Date().toISOString().split('T')[0]
  );
  const [deliveryDate, setDeliveryDate] = useState<string>(
    order?.deliveryDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  );
  const [deliveryLocation, setDeliveryLocation] = useState<string>(
    order?.deliveryLocation || customer?.address || '매수인 지정 본점 및 현장 주기장'
  );
  const [paymentTerms, setPaymentTerms] = useState<string>(
    order?.paymentTerms || '물품 납품 및 검수 완료 후 세금계산서 발행, 발행일로부터 30일 이내 현금 결제'
  );
  const [specialTerms, setSpecialTerms] = useState<string>(
    order?.specialTerms || '1. 운송비 매도인 부담\n2. 물품 검수 기한 3영업일\n3. 외관 및 성능 결함 시 3영업일 이내 무상 교환 납품\n4. 본 계약은 표준 전자서명 및 이메일 교부로 효력을 발휘함'
  );

  // 이메일 발송 폼 상태
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [ccEmail, setCcEmail] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  
  // 💡 전사 표준 헌장 5.9조: 테스트 격리 발송 모드 (기본 true로 안전 유지)
  const [isTestMode, setIsTestMode] = useState<boolean>(true);
  
  // 처리 상태
  const [isSavingTerms, setIsSavingTerms] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessMsg, setSendSuccessMsg] = useState<string | null>(null);

  // 초기화
  useEffect(() => {
    if (!isOpen || !order) return;

    setContractDate(order.orderDate || new Date().toISOString().split('T')[0]);
    setDeliveryDate(order.deliveryDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
    setDeliveryLocation(order.deliveryLocation || customer?.address || '매수인 지정 본점 및 현장 주기장');
    setPaymentTerms(order.paymentTerms || '물품 납품 및 검수 완료 후 세금계산서 발행, 발행일로부터 30일 이내 현금 결제');
    setSpecialTerms(order.specialTerms || '1. 운송비 매도인 부담\n2. 물품 검수 기한 3영업일\n3. 외관 및 성능 결함 시 3영업일 이내 무상 교환 납품\n4. 본 계약은 표준 전자서명 및 이메일 교부로 효력을 발휘함');

    const defaultEmail = (customer as any)?.billingEmail || (customer as any)?.email || 'contact@client.com';
    setRecipientEmail(defaultEmail);
    setCcEmail('');

    const custName = customer?.name || '고객사';
    const tenantName = currentTenant?.corporateName || currentTenant?.tradeName || '(주)기연리프트';
    const repName = currentUser?.name || '';
    const repPhone = (currentUser as any)?.mobile || currentUser?.phone || currentTenant?.tel || '031-334-5295';
    const contactLine = repName ? `연락처: ${repName} ${repPhone}` : `전화: ${repPhone}`;
    setEmailSubject(`[물품매매계약서] ${custName} 귀하 - 주문번호 ${order.id}`);
    setEmailBody(
      `안녕하십니까, ${custName} 귀중.\n\n귀사와 체결한 유통 물품매매계약서를 송부하여 드립니다.\n첨부된 엑셀 계약서의 품목 명세와 인도 조건, 결제 조건을 확인해 주시기 바랍니다.\n\n• 주문번호: ${order.id}\n• 계약금액: ₩${order.totalSalesAmount.toLocaleString()}원 (부가세 포함)\n• 인도장소: ${order.deliveryLocation || customer?.address || '매수인 지정 장소'}\n\n감사합니다.\n${tenantName} 드림\n${contactLine}`
    );
    setSendSuccessMsg(null);
  }, [isOpen, order, customer, currentTenant]);

  if (!isOpen || !order) return null;

  // 공급자 (매도인)
  const sellerParty: TradeContractParty = {
    corpName: currentTenant?.corporateName || currentTenant?.tradeName || '(주)기연리프트',
    bizNo: currentTenant?.businessNumber || '138-81-83251',
    ceo: currentTenant?.representativeName || '이수용',
    address: currentTenant?.businessAddress || '경기도 용인시 처인구 남사읍 처인성로 123',
    tel: currentTenant?.tel || '031-334-5295',
    manager: currentUser?.name || '유통영업팀',
    email: currentUser?.email || 'sales@ebro.co.kr'
  };


  // 매수인 (공급받는자)
  const buyerParty: TradeContractParty = {
    corpName: customer?.name || '주식회사 거래처',
    bizNo: (customer as any)?.bizNo || (customer as any)?.businessNumber || '101-86-99999',
    ceo: customer?.representative || '대표이사',
    address: customer?.address || '서울특별시 강남구 테헤란로 152',
    tel: (customer as any)?.phone || (customer as any)?.repContact || '02-555-1234',
    manager: (customer as any)?.managerName || customer?.representative || '담당자',
    email: recipientEmail
  };

  // 계약 품목 빌드
  const contractItems: TradeContractItem[] = lines.map((l, idx) => {
    const prod = products.find(p => p.id === l.productId);
    const supply = Math.round(l.qty * l.unitPrice);
    const vat = Math.round(supply * 0.1);
    return {
      no: idx + 1,
      productName: prod?.name || `유통상품 (${l.productId})`,
      skuCode: prod?.skuCode || '-',
      spec: prod?.category || '-',
      qty: l.qty,
      unitPrice: l.unitPrice,
      supplyAmount: supply,
      vatAmount: vat,
      totalAmount: supply + vat,
      note: '정상품'
    };
  });

  const totalSupply = contractItems.reduce((sum, i) => sum + i.supplyAmount, 0);
  const totalVat = contractItems.reduce((sum, i) => sum + i.vatAmount, 0);
  const totalGrand = totalSupply + totalVat;

  const excelData: TradeContractExcelData = {
    contractNo: order.id,
    contractDate,
    seller: sellerParty,
    buyer: buyerParty,
    items: contractItems,
    totalSupply,
    totalVat,
    totalGrand,
    deliveryDate,
    deliveryLocation,
    paymentTerms,
    specialTerms
  };

  // 계약 조건 저장 핸들러
  const handleSaveTerms = async () => {
    setIsSavingTerms(true);
    try {
      await updateSalesOrder(order.id, {
        orderDate: contractDate,
        deliveryDate,
        deliveryLocation,
        paymentTerms,
        specialTerms,
        contractDocStatus: order.contractDocStatus || 'DRAFT'
      });
      alert('✅ 계약 조건이 성공적으로 저장되었습니다.');
    } catch (e: any) {
      showErrorModal?.(`계약 조건 저장 실패: ${e.message || e}`);
    } finally {
      setIsSavingTerms(false);
    }
  };

  // 엑셀 다운로드 핸들러
  const handleDownloadExcel = async () => {
    setIsGeneratingExcel(true);
    try {
      const buffer = await generateTradeContractExcel(excelData);
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `물품매매계약서_${order.id}_${buyerParty.corpName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 상태 업데이트: GENERATED
      if (order.contractDocStatus !== 'SENT') {
        await updateSalesOrder(order.id, { contractDocStatus: 'GENERATED' });
      }
    } catch (e: any) {
      showErrorModal?.(`엑셀 계약서 생성 실패: ${e.message || e}`);
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  // 에이전트로 엑셀 열기
  const handleOpenWithAgent = async () => {
    try {
      const buffer = await generateTradeContractExcel(excelData);
      const uint8 = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < uint8.byteLength; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64 = btoa(binary);

      const resp = await fetchWithAgentFallback('/api/open-excel-binary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: `물품매매계약서_${order.id}.xlsx`,
          fileContent: base64
        })
      });

      if (!resp.ok) {
        // 폴백으로 일반 다운로드
        await handleDownloadExcel();
      } else {
        alert('✅ 로컬 에이전트를 통해 엑셀 프로그램에서 계약서를 열었습니다.');
      }
    } catch (e) {
      await handleDownloadExcel();
    }
  };

  // 이메일 발송 핸들러
  const handleSendEmail = async () => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      alert('수신인 이메일 주소를 올바르게 입력해 주세요.');
      return;
    }

    setIsSending(true);
    setSendSuccessMsg(null);
    try {
      const buffer = await generateTradeContractExcel(excelData);
      const fileName = `물품매매계약서_${order.id}_${buyerParty.corpName}.xlsx`;

      await sendTradeContractEmail(order.id, {
        to: recipientEmail,
        cc: ccEmail || undefined,
        subject: emailSubject,
        body: emailBody,
        isTestMode,
        excelBuffer: buffer,
        fileName,
        terms: {
          deliveryLocation,
          deliveryDate,
          paymentTerms,
          specialTerms
        }
      });

      const targetDesc = isTestMode ? `개발자 격리 계정 (admin@ebro.co.kr)` : recipientEmail;
      setSendSuccessMsg(`계약서 메일 발송 완료! (수신: ${targetDesc})`);

      alert(`✅ 유통 물품매매계약서 이메일이 발송되었습니다!\n\n• 수신: ${targetDesc}\n• 파일: ${fileName}\n• 격리 모드: ${isTestMode ? '활성 (개발자 격리)' : '실제 거래처 발송'}`);
    } catch (e: any) {
      console.error('[handleSendEmail Error]', e);
      showErrorModal?.(`이메일 발송 실패: ${e.message || e}`);
    } finally {
      setIsSending(false);
    }
  };


  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: '20px'
      }}
    >
      <div
        className="card"
        style={{
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-main)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '1060px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden'
        }}
      >
        {/* 모달 헤더 */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-app)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={20} color="var(--primary)" />
            <h3 data-mid="trade_contract_modal-title" style={{ margin: 0, fontSize: '17px', fontWeight: 'bold' }}>
              유통 물품매매계약서 양식 편집 및 이메일 발송
            </h3>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: order.contractDocStatus === 'SENT' ? 'var(--success-light)' : 'var(--bg-app)',
                color: order.contractDocStatus === 'SENT' ? '#166534' : '#475569',
                fontWeight: 600
              }}
            >
              {order.contractDocStatus === 'SENT' ? '발송완료' : order.contractDocStatus === 'GENERATED' ? '양식생성됨' : '작성대기'}
            </span>
          </div>
          <button
            type="button"
            data-mid="trade_contract_modal-close-btn"
            onClick={onClose}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 모달 본문 (2단 레이아웃) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
          
          {/* 좌측: 계약 조항 및 인도조건 편집 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building size={16} /> 기본 계약 정보
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>주문번호</label>
                  <input type="text" readOnly value={order.id} style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>계약일자</label>
                  <input 
                    type="date" 
                    data-mid="trade_contract_modal-contract_date"
                    value={contractDate} 
                    onChange={e => setContractDate(e.target.value)} 
                    style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }} 
                  />
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={16} /> 인도 장소 및 결제 조항
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>납품 기한</label>
                  <input 
                    type="date"
                    data-mid="trade_contract_modal-delivery_date"
                    value={deliveryDate} 
                    onChange={e => setDeliveryDate(e.target.value)} 
                    style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }} 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>인도 장소</label>
                  <input 
                    type="text" 
                    data-mid="trade_contract_modal-delivery_location"
                    value={deliveryLocation} 
                    onChange={e => setDeliveryLocation(e.target.value)} 
                    style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }} 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>대금 결제 조건</label>
                  <input 
                    type="text" 
                    data-mid="trade_contract_modal-payment_terms"
                    value={paymentTerms} 
                    onChange={e => setPaymentTerms(e.target.value)} 
                    style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }} 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>특약 사항</label>
                  <textarea 
                    rows={4}
                    data-mid="trade_contract_modal-special_terms"
                    value={specialTerms} 
                    onChange={e => setSpecialTerms(e.target.value)} 
                    style={{ padding: '8px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', resize: 'vertical' }} 
                  />
                </div>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  data-mid="trade_contract_modal-save_terms_btn"
                  onClick={handleSaveTerms}
                  disabled={isSavingTerms}
                  className="btn-secondary"
                  style={{ fontSize: '12px', padding: '6px 14px' }}
                >
                  {isSavingTerms ? '저장 중...' : '계약 조건 저장'}
                </button>
              </div>
            </div>

            {/* 품목 명세 요약 */}
            <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>체결 품목 명세 ({lines.length}개)</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '6px', textAlign: 'left', whiteSpace: 'nowrap' }}>품목명</th>
                      <th style={{ padding: '6px', textAlign: 'right', whiteSpace: 'nowrap' }}>수량</th>
                      <th style={{ padding: '6px', textAlign: 'right', whiteSpace: 'nowrap' }}>단가</th>
                      <th style={{ padding: '6px', textAlign: 'right', whiteSpace: 'nowrap' }}>공급가액</th>
                      <th style={{ padding: '6px', textAlign: 'right', whiteSpace: 'nowrap' }}>세액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '6px', whiteSpace: 'nowrap' }}>{item.productName}</td>
                        <td style={{ padding: '6px', textAlign: 'right', whiteSpace: 'nowrap' }}>{item.qty.toLocaleString()}</td>
                        <td style={{ padding: '6px', textAlign: 'right', whiteSpace: 'nowrap' }}>₩{item.unitPrice.toLocaleString()}</td>
                        <td style={{ padding: '6px', textAlign: 'right', whiteSpace: 'nowrap' }}>₩{item.supplyAmount.toLocaleString()}</td>
                        <td style={{ padding: '6px', textAlign: 'right', whiteSpace: 'nowrap' }}>₩{item.vatAmount.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 'bold', backgroundColor: 'var(--bg-card)' }}>
                      <td colSpan={3} style={{ padding: '8px', textAlign: 'center' }}>합계 (총 계약금액)</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>₩{totalSupply.toLocaleString()}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>₩{totalVat.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 우측: 엑셀 파일 생성 & 거래처 이메일 발송 패널 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 엑셀 파일 생성 액션 */}
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileSpreadsheet size={16} color="#16a34a" /> 표준 물품매매계약서
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
                ExcelJS 기반 표준 서식으로 품목 명세, 공급자/매수인 정보, 특약 조항이 포함된 정식 엑셀 계약서를 생성합니다.
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  data-mid="trade_contract_modal-download_excel_btn"
                  onClick={handleDownloadExcel}
                  disabled={isGeneratingExcel}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 14px' }}
                >
                  <Download size={14} /> {isGeneratingExcel ? '생성 중...' : '엑셀 다운로드'}
                </button>
                <button
                  type="button"
                  data-mid="trade_contract_modal-open_excel_agent_btn"
                  onClick={handleOpenWithAgent}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 14px' }}
                >
                  <RefreshCw size={14} /> 에이전트로 열기
                </button>
              </div>
            </div>

            {/* 거래처 이메일 발송 폼 */}
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={16} color="var(--primary)" /> 거래처 이메일 발송
              </div>

              {/* ⚠️ 테스트 격리 모드 토글 (전사 표준 헌장 5.9조) */}
              <div 
                style={{ 
                  padding: '10px 12px', 
                  borderRadius: '6px', 
                  backgroundColor: isTestMode ? '#eff6ff' : '#fffbeb', 
                  border: isTestMode ? '1px solid #bfdbfe' : '1px solid #fde68a',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: isTestMode ? '#1e40af' : '#92400e' }}>
                  <input
                    type="checkbox"
                    data-mid="trade_contract_modal-test_mode_toggle"
                    checked={isTestMode}
                    onChange={e => setIsTestMode(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>테스트 모드 (개발자 계정으로 격리 발송)</span>
                </label>
                <div style={{ fontSize: '11px', color: isTestMode ? '#2563eb' : '#b45309', lineHeight: 1.4 }}>
                  {isTestMode ? (
                    <span>🛡️ <strong>헌장 5.9조 안전 격리 준수</strong>: 실제 거래처 대신 개발자(admin@ebro.co.kr)에게 안전하게 발송됩니다.</span>
                  ) : (
                    <span>⚠️ <strong>실제 거래처 발송 모드</strong>: 거래처 담당자 이메일({recipientEmail})로 실제 전송됩니다.</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>수신인 이메일</label>
                <input 
                  type="text" 
                  data-mid="trade_contract_modal-recipient_email"
                  value={recipientEmail} 
                  onChange={e => setRecipientEmail(e.target.value)} 
                  placeholder="수신인 이메일 (콤마 또는 슬래시로 복수 입력 가능)"
                  style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }} 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>참조 이메일</label>
                <input 
                  type="text" 
                  data-mid="trade_contract_modal-cc_email"
                  value={ccEmail} 
                  onChange={e => setCcEmail(e.target.value)} 
                  placeholder="선택사항 (쉼표로 구분)"
                  style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }} 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>메일 제목</label>
                <input 
                  type="text" 
                  data-mid="trade_contract_modal-email_subject"
                  value={emailSubject} 
                  onChange={e => setEmailSubject(e.target.value)} 
                  style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }} 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>메일 본문</label>
                <textarea 
                  rows={5}
                  data-mid="trade_contract_modal-email_body"
                  value={emailBody} 
                  onChange={e => setEmailBody(e.target.value)} 
                  style={{ padding: '8px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', resize: 'vertical' }} 
                />
              </div>

              <button
                type="button"
                data-mid="trade_contract_modal-send_email_btn"
                onClick={handleSendEmail}
                disabled={isSending}
                className="btn-save"
                style={{ 
                  marginTop: '8px',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  padding: '10px 16px', 
                  fontSize: '13px',
                  fontWeight: 600,
                  backgroundColor: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSending ? 'not-allowed' : 'pointer'
                }}
              >
                <Send size={16} /> {isSending ? '발송 중...' : '계약서 이메일 발송'}
              </button>

              {sendSuccessMsg && (
                <div style={{ marginTop: '6px', padding: '8px 12px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} /> {sendSuccessMsg}
                </div>
              )}

              {order.contractSentAt && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  마지막 발송 일시: {new Date(order.contractSentAt).toLocaleString()} ({order.contractSentTo || '-'})
                </div>
              )}
            </div>

          </div>

        </div>

        {/* 모달 푸터 */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: 'var(--bg-app)'
          }}
        >
          <button
            type="button"
            data-mid="trade_contract_modal-bottom_close_btn"
            onClick={onClose}
            className="btn-secondary"
            style={{ fontSize: '12px', padding: '6px 16px' }}
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};
export default TradeContractBundleModal;
