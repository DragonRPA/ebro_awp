const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wywgkikkjgbnlljkkmnz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5d2draWtramdibmxsamtrbW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcxMzgsImV4cCI6MjA5OTk0MzEzOH0.gSftxhQjFmWUQzikx-Q5UsdgNKSZISZqJvUGeLBOCqU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTest() {
  console.log('Generating contract bundle via agent...');
  const bundleOptions = {
    customerName: 'Test Customer',
    tenantName: '기연리프트',
    corporateName: '기연리프트',
    businessNumber: '123-45-67890',
    representativeName: '대표자',
    stampImageUrl: '',
    bankAccount: '국민은행 123-456',
    bankAccounts: [],
    bankName: '국민은행',
    accountNumber: '123-456',
    accountHolder: '대표자',
    bizRegNo: '123-45-67890',
    ceoName: '대표자',
    contractDate: '2026-10-01',
    contractStartDate: '2026-10-01',
    contractEndDate: '2026-10-31',
    deliveryDate: '2026-10-01',
    inspectionDate: '2026-10-01',
    siteName: '현장',
    siteAddress: '주소',
    contractNo: 'CONT-1234',
    managerName: '담당자',
    managerPhone: '010-0000-0000',
    siteManagerName: '현장소장',
    siteManagerPhone: '010-0000-0000',
    salesRepName: '영업담당',
    salesRepPhone: '010-0000-0000',
    optionsText: '',
    assets: [],
    r2Config: {
      accountId: 'dummy',
      bucketName: 'dummy',
      accessKeyId: 'dummy',
      secretAccessKey: 'dummy',
      publicDomain: 'dummy'
    }
  };

  const agentResp = await fetch('http://127.0.0.1:5175/api/generate-contract-bundle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bundleOptions })
  });

  const agentRes = await agentResp.json();
  if (!agentRes.success) {
    console.error('Agent failed to generate bundle:', agentRes);
    return;
  }
  
  console.log('Bundle generated! Saved at:', agentRes.filePath);
  
  console.log('Sending email via agent...');
  const emailPayload = {
    to: '77.victor.lee@gmail.com',
    subject: '[Test] e-Bro Agent Contract Bundle Test',
    googleEmail: '77.victor.lee@gmail.com',
    gmailAppPassword: 'hqqgtwtsjimvqmeb', 
    body: '<h2>이메일 발송 테스트</h2><p>에이전트가 생성한 계약서 패키지 첨부 테스트입니다.</p>',
    attachments: [
      { filename: agentRes.fileName || 'Contract.pdf', localPath: agentRes.filePath }
    ],
    fromName: '기연리프트'
  };

  const emailResp = await fetch('http://127.0.0.1:5175/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emailPayload)
  });

  const emailRes = await emailResp.text();
  console.log('Email send response:', emailRes);
}

runTest();
