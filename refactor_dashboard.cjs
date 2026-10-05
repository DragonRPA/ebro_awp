const fs = require('fs');

const content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// We will keep the imports, the component definition, the agent states, and the render for Todo, Agent Guide, Executive Directive.
// Actually, it's safer to just regex replace the big return block.
// Let's replace the content between `<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>` and its closing tag with ONLY the agent header, Todo feed, and visibleCount check.
// Wait, `visibleCount` logic should be simplified too.

let newCode = `import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Activity, ShieldAlert, Users, Layers, ShieldCheck, Wrench, Truck, CreditCard, CheckCircle, Bell, AlertTriangle, ArrowRight, Cloud, AlertCircle, Download, FileText, Bot, Shield, CheckSquare, Calendar, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { EXPECTED_AGENT_VERSION, AGENT_DOWNLOAD_URL, AGENT_CERT_URL, AGENT_INSTALL_BAT_URL, AGENT_KILL_BAT_URL, AGENT_EXE_URL } from '../services/agentService';
import { findActiveTasksForUser } from '../utils/taskHandoverPipeline';
import { ExecutiveDirectiveModal } from '../components/ExecutiveDirectiveModal';
import { ContractDocumentBundleModal } from '../components/ContractDocumentBundleModal';
import { Todo } from '../services/db';

export const Dashboard: React.FC = () => {
  const { 
    currentUser, 
    hasPermission, 
    todos, 
    completeTodo, 
    resolveExecutiveDirective,
    setActiveTab
  } = useApp();

  const [showDirectiveModal, setShowDirectiveModal] = useState(false);
  const [reportingDirectiveTodo, setReportingDirectiveTodo] = useState<Todo | null>(null);
  const [directiveReportNote, setDirectiveReportNote] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const [showBundleModal, setShowBundleModal] = useState(false);
  const [bundleTargetContractId, setBundleTargetContractId] = useState<string | undefined>(undefined);

  const [agentStatus, setAgentStatus] = useState<'ONLINE' | 'OFFLINE'>('OFFLINE');
  const [agentCallsign, setAgentCallsign] = useState<string>('');
  const [agentVersion, setAgentVersion] = useState<string>('');
  const [isDownloadingAgent, setIsDownloadingAgent] = useState(false);
  const [isRestartingAgent, setIsRestartingAgent] = useState(false);
  const [showAgentGuideModal, setShowAgentGuideModal] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkAgent = async () => {
      try {
        const userCallsign = currentUser?.loginId || currentUser?.name || 'admin';
        const res = await fetch(\`http://127.0.0.1:5175/health?callsign=\${encodeURIComponent(userCallsign)}\`, { method: 'GET', signal: AbortSignal.timeout(1500) });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setAgentStatus('ONLINE');
            setAgentCallsign(data.callsign || userCallsign);
            setAgentVersion(data.version || '');
          }
          return;
        }
      } catch (e) {}
      if (isMounted) {
        setAgentStatus('OFFLINE');
        setAgentCallsign('');
        setAgentVersion('');
      }
    };
    checkAgent();
    const interval = setInterval(checkAgent, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentUser]);

  const activeTasks = useMemo(() => findActiveTasksForUser(todos, currentUser, hasPermission), [todos, currentUser, hasPermission]);
`;

// Now extract the render part from the original file.
const returnStart = content.indexOf('return (');
const returnStr = content.substring(returnStart);

// Extract the header (agent status)
const headerRegex = /<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var\(--bg-card\)'[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
const headerMatch = returnStr.match(headerRegex);

// Extract the ToDo Feed details (matches[15])
const detailsMatches = [...returnStr.matchAll(/<details[\s\S]*?<\/details>/g)];
const todoHTML = detailsMatches[detailsMatches.length - 1][0];

// Extract the empty task placeholder
const emptyRegex = /visibleCount === 0[\s\S]*?<\/div>\s*\)\}/;
let emptyMatch = returnStr.match(emptyRegex);
if(emptyMatch) emptyMatch = emptyMatch[0].replace('visibleCount === 0', 'activeTasks.length === 0');

// Extract the modals
const modalsRegex = /\{showAgentGuideModal\}[\s\S]*?\)\}/;
let modalsMatch = returnStr.match(modalsRegex);

const execModalRegex = /<ExecutiveDirectiveModal[\s\S]*?\/>/;
const execMatch = returnStr.match(execModalRegex);

const reportModalRegex = /\{reportingDirectiveTodo && \([\s\S]*?\}\s*\)\}/;
const reportMatch = returnStr.match(reportModalRegex);

const bundleModalRegex = /<ContractDocumentBundleModal[\s\S]*?\/>/;
const bundleMatch = returnStr.match(bundleModalRegex);

newCode += `
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      ${headerMatch ? headerMatch[0] : ''}
      
      {activeTasks.length > 0 && (
        ${todoHTML}
      )}

      {${emptyMatch || ''}

      ${modalsMatch ? '{showAgentGuideModal && (\n        <div style={{' + modalsMatch[0].substring(24) : ''}

      ${execMatch ? execMatch[0] : ''}

      ${reportMatch ? reportMatch[0] : ''}

      ${bundleMatch ? bundleMatch[0] : ''}
    </div>
  );
};
`;

fs.writeFileSync('src/pages/Dashboard.tsx', newCode);
console.log('Dashboard refactored successfully.');
