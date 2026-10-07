const fs = require('fs');
const path = 'src/components/ContractDocumentBundleModal.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /const \[generatedResult, setGeneratedResult\] = useState<\{([^}]+)\}>/s,
  'const [generatedResult, setGeneratedResult] = useState<{ filePath: string; fileName: string; pageCount: number; url: string; }>'
);

content = content.replace(
  /Promise<\{ url: string; fileName: string; pageCount: number; blob\?: Blob; base64Content\?: string \}>/g,
  'Promise<{ filePath: string; fileName: string; pageCount: number; url: string; }>'
);

content = content.replace(
  /const agentRes = await agentResp\.json\(\);\s*if \(\!agentRes\.success \|\| \!agentRes\.base64Content\) \{[\s\S]*?base64Content: agentRes\.base64Content\s*\};/g,
  const agentRes = await agentResp.json();
      if (!agentRes.success || !agentRes.filePath) {
        throw new Error(agentRes.error || '에이전트에서 PDF 생성 및 저장에 실패했습니다.');
      }

      setProgressPercent(90);

      const tenantBrand = currentTenant?.displayName || currentTenant?.tradeName || 'e-Bro Lift';
      const finalRes = {
        url: '', // 더 이상 Blob URL을 사용하지 않음
        filePath: agentRes.filePath,
        fileName: agentRes.fileName || \\\[\\\]_계약서패키지_\\\_\\\(\\\p).pdf\\\,
        pageCount: agentRes.pageCount || 37
      };
);

content = content.replace(
  /const handleDownloadPdf = async \(\) => \{[\s\S]*?catch \(err: any\) \{[\s\S]*?\}\s*\};/g,
  const handleDownloadPdf = async () => {
    try {
      const pdf = await buildBundlePdf();
      await fetchWithAgentFallback('/api/open-local-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: pdf.filePath })
      });
    } catch (err: any) {
      showErrorModal?.(\\\파일 열기 실패:\\\n\\\\\\);
    }
  };\n
);

content = content.replace(
  /const handlePreviewPdf = async \(\) => \{[\s\S]*?catch \(err: any\) \{[\s\S]*?\}\s*\};/g,
  const handlePreviewPdf = async () => {
    try {
      const pdf = await buildBundlePdf();
      await fetchWithAgentFallback('/api/open-local-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: pdf.filePath })
      });
    } catch (err: any) {
      showErrorModal?.(\\\파일 열기 실패:\\\n\\\\\\);
    }
  };\n
);

content = content.replace(
  /if \(\!pdf \|\| \!pdf\.base64Content\) \{[\s\S]*?const attachments = \[\{ filename: pdf\.fileName, content: pdf\.base64Content \}\];/g,
  if (!pdf || !pdf.filePath) {
          throw new Error('[발송 차단] 계약서패키지 조립 및 저장이 완료되지 않아 발송을 중단합니다.');
        }
  
        const attachments = [{ filename: pdf.fileName, localPath: pdf.filePath }];
);

fs.writeFileSync(path, content, 'utf8');
