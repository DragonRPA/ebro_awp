import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { 
  Truck, Check, AlertCircle, Plus, Trash2, Clock, Layers, 
  FileText, Copy, Lock, CreditCard, CheckCircle, RefreshCw, X,
  Calendar, RotateCcw, ShieldCheck, CheckSquare, XCircle, Search,
  MessageSquare, User, Edit2, Upload, Download, FileSpreadsheet,
  CheckCircle2, AlertTriangle, Filter, DollarSign, Send, Sun, MapPin, Printer,
  UserCheck, FileAudio, Volume2, Sparkles, UploadCloud, Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { exportToExcel } from '../services/excel';
import { Delivery, TransportCompany, TransportDriver, TransportNegotiation, db, DeliveryStatus, Asset, PurchaseSettlement, PurchaseSettlementItem } from '../services/db';
import { DestinationWeatherModal } from '../components/DestinationWeatherModal';
import { ExcelUploadModal, ExcelColumnDef } from '../components/ExcelUploadModal';
import { matchHangul } from '../utils/hangulSearch';
import { buildDispatchSmsText, launchDispatchSms } from '../utils/nativeLauncher';
import { broadcastWorkNotification } from '../utils/workNotificationService';
import { issueHandoverTask, clearHandoverTasks } from '../utils/taskHandoverPipeline';
import {
  TransportCallQueueItem,
  getTransportCallQueue,
  saveTransportCallQueue,
  processNewTransportCall,
  markTransportCallConfirmed,
  deleteTransportCall
} from '../services/transportCallService';

const VEHICLE_TYPE_OPTIONS = ['1.4T', '2.5T', '3.5T', '5T', '5T?μ텞', '8.5T', '11T', '?몃같??];

interface VehicleReq {
  vehicleType: string;
  count: number;
}

interface CargoItem {
  modelName: string;
  count: number;
}

interface AssignedVehicleRow {
  id: string;
  transportCompany: string;
  vehicleType: string;
  vehicleNo: string;
  driverName: string;
  driverContact: string;
  expectedCost: number; // ?뮥 ?덉긽 ?댁넚鍮?(?? - ?꾩닔
  finalCost?: number;   // ?뮫 ?ㅼ젣 ?댁넚鍮?(?? - ?좏깮
  deliveryCost: number; // 湲곗〈 ?명솚??
}

export interface ReconPairRow {
  pairId: string;
  systemDelivery?: Delivery;
  excelRow?: any;
  matchStatus: 'MATCHED' | 'MISMATCH' | 'SYSTEM_ONLY' | 'EXCEL_ONLY' | 'PENDING' | 'PAYMENT_REQUESTED' | 'EXCLUDED';
  systemCost: number;
  excelCost: number;
  diffCost: number;
  memo?: string;
  surchargeReason?: string;
  isReconciled: boolean;
  isExcluded?: boolean;
}

// ?뮕 [?ъ옣??吏?? 諛곗감 ?대컲鍮?0???⑥쟾 蹂댁〈 ?ы띁 (?섎뱶肄붾뵫 70,000??湲곕낯媛??꾩쟾 ?쒓굅 諛?finalCost=0 誘명솗????deliveryCost ?곗꽑 ?됯?)
export const getEffectiveDeliveryCost = (d?: Delivery | null): number => {
  if (!d) return 0;
  // 1. ?대? ?뺤궛/????꾨즺?섏뼱 ?뺤젙??finalCost媛 0蹂대떎 ??寃쎌슦 ?곗꽑 諛섑솚
  if (d.finalCost !== undefined && d.finalCost !== null && d.finalCost > 0) return d.finalCost;
  // 2. ????뺤궛 ?꾨즺 ?곹깭(isCostSettled)?대㈃??紐낆떆?곸쑝濡?finalCost媛 0??寃쎌슦 0???뺤젙
  if (d.isCostSettled && d.finalCost === 0) return 0;
  // 3. 諛곗감 ?먯옣???깅줉/?낅줈???댁넚鍮?deliveryCost)媛 議댁옱?섎㈃ 諛섑솚 (0???ы븿)
  if (d.deliveryCost !== undefined && d.deliveryCost !== null) return d.deliveryCost;
  // 4. ?덉긽 ?댁넚鍮?expectedCost)媛 議댁옱?섎㈃ 諛섑솚
  if (d.expectedCost !== undefined && d.expectedCost !== null) return d.expectedCost;
  // 5. 諛곗젙 李⑤웾蹂??댁넚鍮??⑹궛
  const vehicleCost = d.assignedVehicles?.reduce((acc: number, v: any) => acc + (v.deliveryCost || 0), 0);
  if (vehicleCost !== undefined && vehicleCost > 0) return vehicleCost;
  // 6. finalCost媛 0??寃쎌슦 理쒖쥌 fallback
  if (d.finalCost !== undefined && d.finalCost !== null) return d.finalCost;
  return 0;
};

// 1. 諛곗감 4?④퀎 吏꾪뻾 ?곹깭 ?먯젙 ?ы띁 (而댄룷?뚰듃 ?몃? 諛곗튂濡?TDZ ?몄씠?ㅽ똿 ?ㅻ쪟 ?먯쿇 諛⑹뼱)
export const getNormalizedDeliveryStatus = (d?: Delivery | null): 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED' => {
  if (!d) return 'PENDING';
  if (d.status === 'DISPATCHED') return 'DISPATCHED';
  if (d.status === 'DELIVERED' || d.status === 'COMPLETED') return 'DELIVERED';
  if (d.status === 'CANCELLED') return 'CANCELLED';
  return 'PENDING';
};

// ?붾Ъ ?덈ぉ ?뚯떛 ?ы띁 (而댄룷?뚰듃 ?몃? 諛곗튂濡?TDZ ?몄씠?ㅽ똿 ?ㅻ쪟 ?먯쿇 諛⑹뼱)
export const parseCargoItems = (d?: Delivery | null): CargoItem[] => {
  if (!d) return [{ modelName: '怨좎냼?묒뾽? (?λ퉬 誘몄???', count: 1 }];
  if (d.cargoItems) {
    try {
      const parsed = JSON.parse(d.cargoItems);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }
  return [{ modelName: '怨좎냼?묒뾽? (?λ퉬 誘몄???', count: 1 }];
};

const TruckDispatchContent: React.FC = () => {
  const { 
    currentUser,
    deliveries, contracts, customers, products, sites, users,
    contractAssets, assets,
    transportCompanies, transportDrivers, transportNegotiations, outboundInspections, hasPermission, 
    refreshAllData, showErrorModal, convertReconciledDeliveriesToSettlement,
    currentTenant,
    printStations, printQueue, enqueuePrintJob,
    completeDelivery, completeInboundDelivery
  } = useApp();

  const canSave = hasPermission('delivery', 'save');

  // 異쒓퀬 寃???곹깭 ?뚯떛 ?ы띁
  const getOutboundInspectionStatus = (contractId?: string) => {
    if (!contractId) return 'NONE';
    const insps = outboundInspections.filter(i => i.contractId === contractId);
    if (insps.length === 0) return 'NONE';
    if (insps.some(i => i.status === 'REJECTED')) return 'REJECTED';
    if (insps.every(i => i.status === 'COMPLETED')) return 'COMPLETED';
    if (insps.some(i => i.status === 'IN_PROGRESS')) return 'IN_PROGRESS';
    return 'PENDING';
  };

  const deliveryCounts = useMemo(() => {
    const counts = { today: 0, tomorrow: 0, pending: 0, dispatched: 0, delivered: 0, cancelled: 0, exchange: 0 };
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    for (const d of deliveries) {
      const dt = d.loadingDate || d.scheduledDate;
      if (dt === todayStr) counts.today++;
      if (dt === tomorrowStr) counts.tomorrow++;
      const st = getNormalizedDeliveryStatus(d);
      if (st === 'PENDING') counts.pending++;
      else if (st === 'DISPATCHED') counts.dispatched++;
      else if (st === 'DELIVERED') counts.delivered++;
      else if (st === 'CANCELLED') counts.cancelled++;
      if (d.dispatchCategory === '援먰솚' || d.type === 'EXCHANGE') counts.exchange++;
    }
    return counts;
  }, [deliveries]);

  const getOutboundInspectionBadge = (contractId?: string) => {
    const status = getOutboundInspectionStatus(contractId);
    switch (status) {
      case 'REJECTED':
        return (
          <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, backgroundColor: 'rgba(239,68,68,0.15)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <AlertCircle size={12} /> ?뵶 異쒓퀬?섎ː 諛섎젮??
          </span>
        );
      case 'COMPLETED':
        return (
          <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <CheckCircle size={12} /> ?윟 異쒓퀬?뱀씤 ?꾨즺
          </span>
        );
      case 'IN_PROGRESS':
      case 'PENDING':
        return (
          <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, backgroundColor: 'rgba(59,130,246,0.15)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <Clock size={12} /> ?뵷 異쒓퀬寃??吏꾪뻾以?
          </span>
        );
      default:
        return null;
    }
  };

  // ?뼥截?遺꾩궛 ?몄뇙 ???곹깭 諛곗? ?ы띁 (?꾨┛??/?꾨┛?? 臾댁씤 異쒕젰 ?곹깭 ?쒖텧)
  const getPrintQueueBadge = (delivery: Delivery) => {
    const c = contracts.find(ct => ct.id === delivery.contractId);
    const cNo = c?.contractNo;
    const matchedJob = printQueue
      .filter(q => {
        if (cNo && q.docNo && q.docNo.includes(cNo)) return true;
        if (delivery.id && q.docNo && q.docNo.includes(delivery.id)) return true;
        return false;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!matchedJob) return null;

    const st = printStations.find(s => s.id === matchedJob.stationId);
    const stationLabel = st?.stationName || (matchedJob.docType === 'DISPATCH_ORDER' ? '?꾨┛??' : '?꾨┛??');

    switch (matchedJob.status) {
      case 'COMPLETED':
        return (
          <span
            style={{
              padding: '2px 7px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 800,
              backgroundColor: 'rgba(34,197,94,0.15)',
              color: '#15803d',
              border: '1px solid rgba(34,197,94,0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}
            title={`?몄뇙?꾨즺: ${matchedJob.completedAt ? new Date(matchedJob.completedAt).toLocaleTimeString('ko-KR') : ''}`}
          >
            ?뼥截?{stationLabel}: ?윟 異쒕젰?꾨즺
          </span>
        );
      case 'PRINTING':
        return (
          <span
            style={{
              padding: '2px 7px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 800,
              backgroundColor: 'rgba(59,130,246,0.15)',
              color: '#1d4ed8',
              border: '1px solid rgba(59,130,246,0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}
          >
            ?뼥截?{stationLabel}: ?뵷 異쒕젰以?
          </span>
        );
      case 'FAILED':
        return (
          <span
            style={{
              padding: '2px 7px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 800,
              backgroundColor: 'rgba(239,68,68,0.15)',
              color: '#b91c1c',
              border: '1px solid rgba(239,68,68,0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}
            title={matchedJob.lastError || '異쒕젰 ?ㅽ뙣'}
          >
            ?뼥截?{stationLabel}: ?뵶 ?ㅻ쪟
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span
            style={{
              padding: '2px 7px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 800,
              backgroundColor: 'rgba(245,158,11,0.15)',
              color: '#b45309',
              border: '1px solid rgba(245,158,11,0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}
          >
            ?뼥截?{stationLabel}: ?윞 ?湲곗쨷
          </span>
        );
    }
  };

  const getContract = (contractId?: string) => contracts.find(c => c.id === contractId);
  const getCustomer = (customerId?: string) => customers.find(c => c.id === customerId);

  // ?뚯닔 諛곗감 ????먯궛 議고쉶 (delivery.assetIds ?곗꽑 留ㅽ븨, ?놁쑝硫?contractId 湲곗?)
  const getReturnAssets = (delivery: Delivery) => {
    if (!delivery) return [];
    if (delivery.assetIds) {
      const rawIds = Array.isArray(delivery.assetIds)
        ? (delivery.assetIds as any[])
        : (typeof delivery.assetIds === 'string' ? delivery.assetIds.split(',') : []);
      const ids = rawIds.map((id: any) => String(id).trim()).filter(Boolean);
      const found = ids.map(id => assets.find(a => a.id === id)).filter(Boolean) as Asset[];
      if (found.length > 0) {
        return found.map(a => ({ modelName: a.modelName || '-', assetNo: a.assetNo || '-', id: a.id }));
      }
    }
    if (delivery.contractId) {
      return contractAssets
        .filter(ca => ca.contractId === delivery.contractId)
        .map(ca => {
          const asset = assets.find(a => a.id === ca.assetId);
          return asset ? { modelName: asset.modelName || ca.expectedModel || '-', assetNo: asset.assetNo || '-', id: asset.id } : null;
        })
        .filter(Boolean) as { modelName: string; assetNo: string; id: string }[];
    }
    return [];
  };

  // ?뼥截?異쒓퀬/?낃퀬?붿껌???쒖떇 ?앹꽦湲?(100% ?묐갚 / 4而щ읆 50:50 ?移?洹몃━??- SN 而щ읆 諛곗젣)
  const buildDispatchDocHtml = (delivery: Delivery, docType: 'OUTBOUND' | 'INBOUND') => {
    const contract = getContract(delivery.contractId);
    const customer = contract ? getCustomer(contract.customerId) : null;
    const site = sites?.find(s => s.id === contract?.siteId);
    const cargoItems = parseCargoItems(delivery);
    const returnAssets = getReturnAssets(delivery);
    const isOutbound = docType === 'OUTBOUND';
    const title = isOutbound ? '異쒓퀬?붿껌?? : '?낃퀬?붿껌??(?뚯닔?뺤씤??';
    const today = new Date().toISOString().split('T')[0];

    const unitList: { no: number; modelName: string; assetNo: string }[] = [];
    let uNo = 1;
    if (isOutbound) {
      for (const c of cargoItems) {
        const count = Math.max(1, Number(c.count) || 1);
        for (let i = 0; i < count; i++) {
          unitList.push({ no: uNo++, modelName: c.modelName || '-', assetNo: '' });
        }
      }
    } else {
      for (const a of returnAssets) {
        unitList.push({ no: uNo++, modelName: a.modelName || '-', assetNo: a.assetNo || '' });
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
        <td style="text-align:center; font-weight:600;">${left && !isOutbound ? left.assetNo : '&nbsp;'}</td>
        <td style="text-align:center; border-right:2px solid #000000; font-size:7.5pt;">${left ? '[ &nbsp; ]' : '&nbsp;'}</td>
        <td style="text-align:center;">${right ? right.no : '&nbsp;'}</td>
        <td style="font-weight:700; padding-left:5px;">${right ? right.modelName : '&nbsp;'}</td>
        <td style="text-align:center; font-weight:600;">${right && !isOutbound ? right.assetNo : '&nbsp;'}</td>
        <td style="text-align:center; font-size:7.5pt;">${right ? '[ &nbsp; ]' : '&nbsp;'}</td>
      </tr>`;
    }

    const fromLabel = isOutbound ? '?곸감吏 (異쒕컻)' : '?곸감吏 (?뚯닔吏)';
    const toLabel   = isOutbound ? '?섏감吏 (?꾩옣)' : '?섏감吏 (諛섎궔吏)';
    const fromAddr  = delivery.pickupVendorName 
      ? `[???吏곸텧怨? ${delivery.pickupVendorName} (${delivery.originAddress || '-'})` 
      : (isOutbound ? (delivery.originAddress || '?뱀궗 蹂닿???) : (delivery.destinationAddress || site?.address || '-'));
    const toAddr    = delivery.viaDropoffName 
      ? `[?쇱쟻 寃쎌쑀] 1李? ${delivery.viaDropoffName} (${delivery.viaDropoffAddress || '蹂몄궗'}) ??2李? ${delivery.destinationAddress || '?꾩감泥?蹂닿???}` 
      : (isOutbound ? (delivery.destinationAddress || site?.address || '-') : (delivery.originAddress || '?뱀궗 蹂닿???));

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${title}_${customer?.name || '怨좉컼??}_${site?.name || '?꾩옣'}</title>
  <style>
    @page { size: A4 portrait; margin: 7mm 10mm 7mm 10mm; }
    @media print {
      @page { size: A4 portrait; margin: 7mm 10mm; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { color: #000000 !important; background-color: #ffffff !important; }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Malgun Gothic', '留묒? 怨좊뵓', Dotum, sans-serif; padding: 0; margin: 0 auto; color: #000000; background-color: #ffffff; width: 100%; max-width: 210mm; font-size: 8.5pt; line-height: 1.15; }
    p, div, span, table, tr, td, th { margin: 0; padding: 0; line-height: 1.15; color: #000000; }
    table { width: 100%; border-collapse: collapse; margin-top: 2px; margin-bottom: 3px; table-layout: fixed; }
    th, td { border: 1px solid #000000; padding: 2.5px 5px !important; font-size: 8pt; vertical-align: middle; white-space: nowrap; overflow: hidden; color: #000000; }
    th { background-color: #f0f0f0 !important; font-weight: 700; color: #000000; text-align: left; }
    .header-table { width: 100%; border: none; border-bottom: 2px solid #000000; margin-bottom: 3px; padding-bottom: 2px; }
    .header-table td { border: none; padding: 0 !important; vertical-align: middle; color: #000000; }
    .sec-title { font-size: 8.5pt; font-weight: 800; color: #000000; border-left: 3.5px solid #000000; padding-left: 4px; margin-top: 3px; margin-bottom: 1px; }
  </style>
</head>
<body>
  <div style="padding: 2px 0;">
    <table class="header-table">
      <tr>
        <td style="width: 25%; text-align: left; font-size: 7.5pt; color: #333333;">
          臾몄꽌: ${delivery.id}<br>
          諛쒗뻾: ${today}
        </td>
        <td style="width: 55%; text-align: center; font-size: 15pt; font-weight: 800; letter-spacing: 2px; color: #000000;">
          ${(currentTenant?.displayName || currentTenant?.tradeName || '湲곗뿰由ы봽??).toUpperCase()} ${title}
        </td>
        <td style="width: 20%; text-align: right;">
          <table style="width: 60px; border: 1px solid #000000; float: right; margin: 0; border-collapse: collapse;">
            <tr><td style="background-color: #f0f0f0; border-bottom: 1px solid #000000; text-align: center; font-size: 7.5pt; font-weight: 700; padding: 1px 0;">${isOutbound ? '異쒓퀬 ?뺤씤' : '?낃퀬 ?뺤씤'}</td></tr>
            <tr><td style="height: 25px; text-align: center; font-size: 7.5pt; color: #777777;">(??</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <div class="sec-title">1. 怨좉컼??諛??꾩옣 ?뺣낫</div>
    <table>
      <colgroup><col style="width: 12%;"><col style="width: 38%;"><col style="width: 12%;"><col style="width: 38%;"></colgroup>
      <tr><th>怨좉컼?щ챸</th><td><strong>${customer?.name || '-'}</strong></td><th>?꾩옣紐?/th><td><strong>${site?.name || '-'}</strong></td></tr>
      <tr><th>怨꾩빟踰덊샇</th><td><strong>${contract?.contractNo || '-'}</strong></td><th>諛곗감援щ텇</th><td>${delivery.dispatchCategory || (isOutbound ? '異쒓퀬' : '?낃퀬')}</td></tr>
      <tr><th>${fromLabel}</th><td colspan="3">${fromAddr}</td></tr>
      <tr><th>${toLabel}</th><td colspan="3">${toAddr}</td></tr>
    </table>

    <div class="sec-title">2. 諛곗감 諛??댁넚 ?뺣낫</div>
    <table>
      <colgroup><col style="width: 12%;"><col style="width: 38%;"><col style="width: 12%;"><col style="width: 38%;"></colgroup>
      <tr><th>?붿껌??/th><td>${delivery.requestDate || '-'}</td><th>諛곗감??/th><td>${delivery.loadingDate || '-'}</td></tr>
      <tr><th>?댁넚湲곗궗</th><td>${delivery.driverName || '(誘몃같??'}</td><th>李⑤웾踰덊샇</th><td>${delivery.vehicleNo || '-'}</td></tr>
    </table>

    <div class="sec-title">3. ${isOutbound ? '異쒓퀬' : '?뚯닔'} ????λ퉬 紐⑸줉 (珥?${unitList.length}?)</div>
    <table>
      <thead>
        <tr>
          <th style="width: 6%; text-align: center;">?쒕쾲</th>
          <th style="width: 21%; text-align: center;">紐⑤뜽紐?/th>
          <th style="width: 17%; text-align: center;">愿由щ쾲??/th>
          <th style="width: 6%; text-align: center; border-right: 2px solid #000000;">?뺤씤</th>
          <th style="width: 6%; text-align: center;">?쒕쾲</th>
          <th style="width: 21%; text-align: center;">紐⑤뜽紐?/th>
          <th style="width: 17%; text-align: center;">愿由щ쾲??/th>
          <th style="width: 6%; text-align: center;">?뺤씤</th>
        </tr>
      </thead>
      <tbody>
        ${assetRowsHtml || '<tr><td colspan="8" style="text-align:center; padding: 10px 0;">?λ퉬 ?뺣낫 ?놁쓬</td></tr>'}
      </tbody>
    </table>

    <div class="sec-title">4. ?뱀씠?ы빆 諛??묒뾽 吏??/div>
    <table>
      <colgroup><col style="width: 12%;"><col style="width: 88%;"></colgroup>
      <tr><th>吏?쒖궗??/th><td>${delivery.memo || '?뱀씠?ы빆 ?놁쓬'}</td></tr>
    </table>
  </div>
</body>
</html>`;
  };

  // ?뼥截??몄뇙 誘몃━蹂닿린 諛?釉뚮씪?곗? ?몄뇙
  const handlePrintDispatchRequest = (delivery: Delivery, docType: 'OUTBOUND' | 'INBOUND') => {
    const html = buildDispatchDocHtml(delivery, docType);
    const w = window.open('', '_blank', 'width=800,height=900');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 250);
    }
  };

  // ?뼥截??먭꺽 遺꾩궛 ?몄뇙 ???꾩넚 (異쒓퀬: ?꾨┛??, ?낃퀬: ?꾨┛?? ?먮룞 ?쇱슦??臾댁씤 異쒕젰)
  const handleRemoteQueuePrintDispatchRequest = async (delivery: Delivery, docType: 'OUTBOUND' | 'INBOUND') => {
    const contract = getContract(delivery.contractId);
    const customer = contract ? getCustomer(contract.customerId) : null;
    const site = sites?.find(s => s.id === contract?.siteId);
    const isOutbound = docType === 'OUTBOUND';
    const title = isOutbound ? '異쒓퀬?붿껌?? : '?낃퀬?붿껌??;
    const html = buildDispatchDocHtml(delivery, docType);

    // ?寃??ㅽ뀒?댁뀡 寃곗젙 (?좏샇 ?ㅽ뀒?댁뀡 ?곗꽑 -> 異쒓퀬: DISPATCH_ORDER/?꾨┛??, ?낃퀬: RETURN_ORDER/?꾨┛??)
    const targetDocType = isOutbound ? 'DISPATCH_ORDER' : 'RETURN_ORDER';
    const savedStationId = localStorage.getItem(isOutbound ? 'preferred_print_station_dispatch' : 'preferred_print_station_return');
    const targetStation = (savedStationId && savedStationId !== 'BROWSER_DIRECT' && printStations.find(s => s.id === savedStationId)) ||
      printStations.find(s => s.docTypeDefault === targetDocType) ||
      (isOutbound
        ? printStations.find(s => s.stationName.includes('?꾨┛??') || s.stationName.includes('異쒓퀬'))
        : printStations.find(s => s.stationName.includes('?꾨┛??') || s.stationName.includes('?낃퀬'))) ||
      printStations[0];

    try {
      await enqueuePrintJob({
        stationId: targetStation?.id,
        docType: targetDocType,
        docNo: contract?.contractNo || delivery.id,
        title: `${title}_${customer?.name || '怨좉컼??}_${delivery.id}`,
        documentHtml: html,
        requestedById: currentUser?.id,
        requestedByName: currentUser?.name
      });
      alert(`[${targetStation?.stationName || (isOutbound ? '?꾨┛??' : '?꾨┛??')}] ?몄뇙 ???꾩넚 ?꾨즺`);
    } catch (err: any) {
      alert(`?먭꺽 ?몄뇙 ???꾩넚 ?ㅽ뙣: ${err.message || err}`);
    }
  };


  // ?묒? ?좎쭨(?쒕━???レ옄 46174 ???먮뒗 ?щ㎎???띿뒪??瑜?YYYY-MM-DD濡?蹂?섑븯???뺢퇋???ы띁
  const formatExcelDateStr = (rawVal: any): string => {
    if (!rawVal) return '-';
    const str = String(rawVal).trim();
    if (!str) return '-';

    // 1. ?묒? ?쒕━???レ옄 (?? 46174)
    if (!isNaN(Number(str)) && Number(str) > 30000 && Number(str) < 60000) {
      const serial = Number(str);
      const utcDays = Math.floor(serial - 25569);
      const utcValue = utcDays * 86400;
      const dateObj = new Date(utcValue * 1000);
      const year = dateObj.getUTCFullYear();
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // 2. 06??01???щ㎎
    const currentYear = new Date().getFullYear();
    if (str.includes('??) && str.includes('??)) {
      const mMatch = str.match(/(\d+)??s*(\d+)??);
      if (mMatch) {
        return `${currentYear}-${String(mMatch[1]).padStart(2, '0')}-${String(mMatch[2]).padStart(2, '0')}`;
      }
    }

    // 3. 6/1 ?щ㎎
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 2) {
        return `${currentYear}-${String(parts[0]).padStart(2, '0')}-${String(parts[1]).padStart(2, '0')}`;
      } else if (parts.length === 3) {
        return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
      }
    }

    return str;
  };

  const [activeTab, setActiveTab] = useState<'DISPATCH' | 'NEGOTIATION' | 'RECONCILIATION'>('DISPATCH');

  // ?묒? ?쇨큵 諛곗감 ?깅줉 紐⑤떖 ?곹깭
  const [dispatchExcelModalOpen, setDispatchExcelModalOpen] = useState(false);

  // 諛곗감 ?묒? ?쇨큵 ?낅줈??而щ읆 ?뺤쓽
  const dispatchExcelColumns: ExcelColumnDef[] = [
    { key: 'type', label: '諛곗감?좏삎', required: true, sample: '異쒓퀬' },
    { key: 'customerName', label: '怨좉컼?щ챸', required: true, sample: '(二?湲곗뿰嫄댁꽕' },
    { key: 'siteName', label: '?꾩옣紐?, sample: '?먭탳 ?뚰겕?몃갭由?B?? },
    { key: 'startAddress', label: '?곸감吏二쇱냼', required: true, sample: '異⑸턿 泥?＜???λ뜒援?吏곸??濡?436' },
    { key: 'endAddress', label: '?섏감吏二쇱냼', required: true, sample: '寃쎄린 ?깅궓??遺꾨떦援??먭탳??줈 166' },
    { key: 'requestDate', label: '?щ쭩?쇱떆', required: true, type: 'date', sample: '2026-09-15' },
    { key: 'modelName', label: '?λ퉬紐⑤뜽紐?, sample: 'S-0808 (8m)' },
    { key: 'deliveryCost', label: '?댁넚鍮?, type: 'number', sample: 120000 },
    { key: 'billableToCustomer', label: '怨좉컼泥?뎄?щ?(Y/N)', sample: 'Y' },
    { key: 'memo', label: '鍮꾧퀬諛륂듅?댁궗??, sample: '?꾩옣 吏꾩엯濡??묒냼' },
  ];

  // 諛곗감 ?묒? ?쇨큵 ?깅줉 泥섎━ ?몃뱾??(?뚯옣 2.3 ?⑥씪 EXCHANGE 諛??뺣났?좎씤 ?먮룞?곗젙)
  const handleBatchUploadDeliveries = async (rows: Record<string, any>[]) => {
    let successCount = 0;
    const today = new Date().toISOString().split('T')[0];
    const tenantId = currentTenant?.id || 'giyeun';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const typeRaw = String(row.type || '異쒓퀬').trim();
      const isExchange = typeRaw.includes('援먰솚') || typeRaw.toUpperCase().includes('EXCHANGE');
      const isInbound = typeRaw.includes('?뚯닔') || typeRaw.includes('?낃퀬') || typeRaw.toUpperCase().includes('INBOUND');
      const deliveryType = isExchange ? 'EXCHANGE' : isInbound ? 'INBOUND' : 'OUTBOUND';
      const dispatchCategory = isExchange ? '援먰솚' : isInbound ? '?뚯닔' : '異쒓퀬';

      const customerName = String(row.customerName || '').trim();
      if (!customerName) continue;

      let deliveryCost = Number(row.deliveryCost) || 0;
      // ?뮕 [?꾩궗 ?쒖? ?뚯옣 2.3] ?⑥씪 EXCHANGE 1嫄?諛쒗뻾 諛??뺣났 ?댁넚鍮??좎씤 ?곸슜
      if (isExchange && deliveryCost > 60000) {
        deliveryCost = Math.max(0, deliveryCost);
      }

      const billableStr = String(row.billableToCustomer || 'Y').toUpperCase();
      const billableToCustomer = !(billableStr === 'N' || billableStr === 'FALSE' || billableStr === '臾댁긽' || billableStr === '?뱀궗');

      const deliveryOrderNo = `DEL-${today.replace(/-/g, '')}-${String(Date.now()).slice(-4)}${i}`;

      const matchedCust = customers.find(c => c.name?.toLowerCase().includes(customerName.toLowerCase()));

      await db.insertRow<Delivery>('deliveries', {
        id: `del_xl_${Date.now()}_${i}`,
        deliveryOrderNo,
        type: deliveryType as any,
        dispatchCategory: dispatchCategory as any,
        status: 'PENDING',
        customerId: matchedCust?.id || 'cust-manual',
        customerName,
        siteName: row.siteName || '',
        originAddress: row.startAddress || '蹂몄궗 二쇨린??,
        destinationAddress: row.endAddress || row.startAddress || '?꾩옣',
        requestDate: row.requestDate || today,
        scheduledDate: row.requestDate || today,
        cargoItems: JSON.stringify([{ modelName: row.modelName || '怨좎냼?묒뾽?', count: 1 }]),
        deliveryCost,
        expectedCost: deliveryCost,
        billableToCustomer,
        memo: row.memo || '',
        tenant_id: tenantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any);

      successCount++;
    }

    await db.awaitPendingWrites();
    refreshAllData();
    showToast(`${successCount}嫄댁쓽 諛곗감 ?섎ː媛 ?쇨큵 ?깅줉?섏뿀?듬땲??`);
    return { successCount, message: '諛곗감 ?쇨큵 ?깅줉 ?꾨즺' };
  };

  // ?좎뒪???뚮┝ ?곹깭 (?뚯옣 5.2: 釉뚮씪?곗? alert/confirm ?꾨㈃ ?댁텧)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 4?④퀎 諛곗감 吏꾪뻾 ?곹깭 ??state ('ALL' | 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED')
  const [activeDispatchStatusTab, setActiveDispatchStatusTab] = useState<string>('ALL');

  // ?뱟 諛곗감 ?붿껌/?댁넚??湲곌컙 議고쉶 ?쇱빱 state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleSetDateRange = (type: 'TODAY' | 'WEEK' | 'MONTH' | 'ALL') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (type === 'TODAY') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (type === 'WEEK') {
      const future = new Date();
      future.setDate(today.getDate() + 7);
      setStartDate(todayStr);
      setEndDate(future.toISOString().split('T')[0]);
    } else if (type === 'MONTH') {
      const future = new Date();
      future.setMonth(today.getMonth() + 1);
      setStartDate(todayStr);
      setEndDate(future.toISOString().split('T')[0]);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // ?? ?댁넚??諛곗감 ?묒쓽 (NEGOTIATION) ?꾩슜 ?곹깭 ??
  const [selectedNegoDeliveryId, setSelectedNegoDeliveryId] = useState<string | null>(null);
  const [negoCompanyId, setNegoCompanyId] = useState<string>('');
  const [negoVehicleType, setNegoVehicleType] = useState<string>('5T');
  const [negoProposedCost, setNegoProposedCost] = useState<number>(0);
  const [negoTargetCost, setNegoTargetCost] = useState<number>(0);
  const [negoCallSummary, setNegoCallSummary] = useState<string>('');
  const [negoSpecialTerms, setNegoSpecialTerms] = useState<string>('');
  const [negoFilterStatus, setNegoFilterStatus] = useState<'ALL' | 'PENDING' | 'IN_NEGOTIATION' | 'CONFIRMED'>('ALL');
  const [negoSearchQuery, setNegoSearchQuery] = useState<string>('');

  // ?? ?듯솕 ?묒쓽 ??(Call Ingestion Queue) ?곹깭 ??
  const [callQueue, setCallQueue] = useState<TransportCallQueueItem[]>(() => getTransportCallQueue());
  const [selectedCallQueueId, setSelectedCallQueueId] = useState<string | null>(() => {
    const q = getTransportCallQueue();
    return q.length > 0 ? q[0].id : null;
  });
  const [isUploadingCall, setIsUploadingCall] = useState<boolean>(false);
  const [callUploadError, setCallUploadError] = useState<string | null>(null);
  const callFileInputRef = useRef<HTMLInputElement>(null);

  const selectedCall = useMemo(() => {
    return callQueue.find(q => q.id === selectedCallQueueId) || null;
  }, [callQueue, selectedCallQueueId]);

  // ?듯솕 ???꾩씠???좏깮 ????諛?諛곗감 嫄??먮룞 ?꾨━??
  const handleSelectCallQueueItem = (call: TransportCallQueueItem) => {
    setSelectedCallQueueId(call.id);
    if (call.extracted.matchedDeliveryId) {
      setSelectedNegoDeliveryId(call.extracted.matchedDeliveryId);
    }
    if (call.extracted.matchedCompanyId) {
      setNegoCompanyId(call.extracted.matchedCompanyId);
    }
    if (call.extracted.vehicleType) {
      setNegoVehicleType(call.extracted.vehicleType);
    }
    if (call.extracted.proposedCost) {
      setNegoProposedCost(call.extracted.proposedCost);
    }
    if (call.extracted.targetCost) {
      setNegoTargetCost(call.extracted.targetCost);
    }
    if (call.extracted.specialTerms) {
      setNegoSpecialTerms(call.extracted.specialTerms);
    }
    if (call.extracted.callSummary) {
      setNegoCallSummary(call.extracted.callSummary);
    }
  };

  // ?듯솕 ?뱀쓬 ?뚯씪 ?낅줈??諛?遺꾩꽍 ?몃뱾??
  const handleUploadCallFile = async (file: File) => {
    setIsUploadingCall(true);
    setCallUploadError(null);
    try {
      const newItem = await processNewTransportCall(file, transportCompanies, deliveries);
      const updatedQueue = getTransportCallQueue();
      setCallQueue(updatedQueue);
      handleSelectCallQueueItem(newItem);
      showToast(`'${file.name}' ?듯솕 ?뱀쓬??AI 遺꾩꽍?섏뼱 ?먯뿉 ?깅줉?섏뿀?듬땲??`);
    } catch (err: any) {
      console.error('Call upload error:', err);
      setCallUploadError(err?.message || '?듯솕 ?뱀쓬 ?뚯씪 遺꾩꽍???ㅽ뙣?덉뒿?덈떎.');
    } finally {
      setIsUploadingCall(false);
    }
  };

  // ?듯솕 ???꾩씠????젣
  const handleDeleteCallQueueItem = (callId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTransportCall(callId);
    const updated = getTransportCallQueue();
    setCallQueue(updated);
    if (selectedCallQueueId === callId) {
      setSelectedCallQueueId(updated.length > 0 ? updated[0].id : null);
    }
    showToast('?듯솕 ????ぉ????젣?섏뿀?듬땲??');
  };

  // 湲곗〈 諛곗감 愿由??곸꽭 ?좏깮 ?곹깭
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

  // ?댁넚??諛곗감 ?묒쓽 ?꾩슜 ?좏깮 諛곗감 嫄?
  const selectedNegoDelivery = useMemo(() => {
    return deliveries.find(d => d.id === selectedNegoDeliveryId) || null;
  }, [deliveries, selectedNegoDeliveryId]);

  // ?댁넚???묒쓽 ?대젰 ????몃뱾??
  const handleSaveNegotiation = async () => {
    if (!selectedNegoDeliveryId) {
      showToast('諛곗감 嫄댁쓣 癒쇱? ?좏깮?섏떗?쒖삤.', 'error');
      return;
    }
    if (!negoCompanyId) {
      showToast('?묒쓽 ?댁넚?щ? ?좏깮?섏떗?쒖삤.', 'error');
      return;
    }
    const company = transportCompanies.find(c => c.id === negoCompanyId);
    const newNego: TransportNegotiation = {
      id: `TN-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      deliveryId: selectedNegoDeliveryId,
      transportCompanyId: negoCompanyId,
      transportCompanyName: company?.name || '湲고? ?댁넚??,
      vehicleType: negoVehicleType,
      proposedCost: Number(negoProposedCost) || 0,
      targetCost: Number(negoTargetCost) || 0,
      status: 'IN_NEGOTIATION',
      negotiatorName: currentUser?.name || '諛곗감?대떦??,
      callSummary: negoCallSummary,
      specialTerms: negoSpecialTerms,
      negotiatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    db.insertRow<TransportNegotiation>('transportNegotiations', newNego);
    await db.awaitPendingWrites();
    refreshAllData();
    showToast(`${company?.name || '?댁넚??} ?묒쓽 寃ъ쟻???깅줉?섏뿀?듬땲??`);
    setNegoCallSummary('');
    setNegoSpecialTerms('');
  };

  // ?묒쓽 議곌굔?쇰줈 諛곗감 嫄??뺤젙 ?밴퀎 ?몃뱾??
  const handleConfirmNegotiation = async (nego: TransportNegotiation) => {
    if (!nego.deliveryId) return;
    const targetDel = deliveries.find(d => d.id === nego.deliveryId);
    if (!targetDel) return;

    // 1. 諛곗감 嫄댁뿉 ?댁넚??諛?鍮꾩슜 諛섏쁺
    const costToApply = nego.confirmedCost || nego.proposedCost || 0;
    const memoAddition = `[?묒쓽?뺤젙] ${nego.transportCompanyName} ${nego.vehicleType} ??{costToApply.toLocaleString()}`;
    db.updateRow<Delivery>('deliveries', nego.deliveryId, {
      transportCompany: nego.transportCompanyName,
      vehicleType: nego.vehicleType,
      deliveryCost: costToApply,
      expectedCost: costToApply,
      deliveryCostConfirmed: costToApply,
      memo: targetDel.memo ? `${targetDel.memo} | ${memoAddition}` : memoAddition,
      updatedAt: new Date().toISOString()
    });

    // 2. ?묒쓽 ?곹깭 CONFIRMED濡?蹂寃?
    db.updateRow<TransportNegotiation>('transportNegotiations', nego.id, {
      status: 'CONFIRMED',
      confirmedCost: costToApply,
      updatedAt: new Date().toISOString()
    });

    // 湲곗〈 IN_NEGOTIATION????ぉ??REJECTED 泥섎━
    (db.transportNegotiations || []).forEach(n => {
      if (n.id !== nego.id && n.deliveryId === nego.deliveryId && n.status === 'IN_NEGOTIATION') {
        db.updateRow<TransportNegotiation>('transportNegotiations', n.id, {
          status: 'REJECTED',
          updatedAt: new Date().toISOString()
        });
      }
    });

    await db.awaitPendingWrites();
    refreshAllData();

    if (selectedCallQueueId) {
      markTransportCallConfirmed(selectedCallQueueId);
      setCallQueue(getTransportCallQueue());
    }

    showToast(`諛곗감 議곌굔??[${nego.transportCompanyName} / ??{costToApply.toLocaleString()}]?쇰줈 ?뺤젙?섏뿀?듬땲??`);
  };

  // ???낅젰 議곌굔(?먮뒗 ?듯솕 遺꾩꽍 異붿텧 議곌굔)?쇰줈 1?대┃ 利됱떆 諛곗감 ?뺤젙
  const handleConfirmCurrentForm = async () => {
    if (!selectedNegoDeliveryId) {
      showToast('醫뚯륫?먯꽌 諛곗감 ??곸쓣 癒쇱? ?좏깮?섏떗?쒖삤.', 'error');
      return;
    }
    if (!negoCompanyId) {
      showToast('?묒쓽 ?댁넚?щ? ?좏깮?섏떗?쒖삤.', 'error');
      return;
    }
    const company = transportCompanies.find(c => c.id === negoCompanyId);
    const companyName = company?.name || '湲고? ?댁넚??;
    const costToApply = Number(negoProposedCost) || Number(negoTargetCost) || 0;

    // 1. 諛곗감 嫄댁뿉 ?댁넚?? 李⑥쥌, 鍮꾩슜 利됱떆 ?뺤젙 諛섏쁺
    const targetDel = deliveries.find(d => d.id === selectedNegoDeliveryId);
    if (targetDel) {
      const memoAddition = `[?묒쓽?뺤젙] ${companyName} ${negoVehicleType} ??{costToApply.toLocaleString()}`;
      db.updateRow<Delivery>('deliveries', selectedNegoDeliveryId, {
        transportCompany: companyName,
        vehicleType: negoVehicleType,
        deliveryCost: costToApply,
        expectedCost: costToApply,
        deliveryCostConfirmed: costToApply,
        status: targetDel.status === 'PENDING' ? 'DISPATCHED' : targetDel.status,
        memo: targetDel.memo ? `${targetDel.memo} | ${memoAddition}` : memoAddition,
        updatedAt: new Date().toISOString()
      });
    }

    // 2. ?묒쓽 ?대젰??CONFIRMED ?덉퐫???앹꽦/???
    const newNego: TransportNegotiation = {
      id: `TN-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      deliveryId: selectedNegoDeliveryId,
      transportCompanyId: negoCompanyId,
      transportCompanyName: companyName,
      vehicleType: negoVehicleType,
      proposedCost: costToApply,
      targetCost: Number(negoTargetCost) || costToApply,
      confirmedCost: costToApply,
      status: 'CONFIRMED',
      negotiatorName: currentUser?.name || '諛곗감?대떦??,
      callSummary: negoCallSummary,
      specialTerms: negoSpecialTerms,
      negotiatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    db.insertRow<TransportNegotiation>('transportNegotiations', newNego);

    // 3. ????ぉ ?곹깭 蹂寃?
    if (selectedCallQueueId) {
      markTransportCallConfirmed(selectedCallQueueId);
      setCallQueue(getTransportCallQueue());
    }

    await db.awaitPendingWrites();
    refreshAllData();
    showToast(`諛곗감 議곌굔??[${companyName} / ??{costToApply.toLocaleString()}]?쇰줈 利됱떆 ?뺤젙?섏뿀?듬땲??`);
  };
  
  // 諛곗감 ?몃? ?좏삎 ('異쒓퀬' | '?낃퀬' | '諛섎궔' | '?뺣퉬' | '?대룞')
  const [dispatchCategory, setDispatchCategory] = useState<'異쒓퀬' | '?낃퀬' | '諛섎궔' | '?뺣퉬' | '?대룞' | '援먰솚'>('異쒓퀬');
  
  // ?곸감 ?쇱떆 & ?쒓컙 吏??
  const [loadingDate, setLoadingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loadingTimeSlot, setLoadingTimeSlot] = useState('?ㅼ쟾');
  const [loadingCustomTime, setLoadingCustomTime] = useState('');

  // ?섏감 ?쇱떆 & ?쒓컙 吏??
  const [unloadingDate, setUnloadingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [unloadingTimeSlot, setUnloadingTimeSlot] = useState('?ㅼ쟾');
  const [unloadingCustomTime, setUnloadingCustomTime] = useState('');

  // --- ?섏감吏 ?쇨린?덈낫 紐⑤떖 state ---
  const [showDestWeatherModal, setShowDestWeatherModal] = useState(false);
  const [destWeatherParams, setDestWeatherParams] = useState({
    customerName: '',
    siteName: '',
    rawAddress: ''
  });

  const handleOpenDestWeatherForDelivery = (del?: Delivery | null, customAddress?: string) => {
    let customerName = '-';
    let siteName = '-';
    let rawAddress = customAddress || destinationAddress || '';

    if (del) {
      const contract = contracts.find(c => c.id === del.contractId);
      const customer = customers.find(cust => cust.id === contract?.customerId);
      const site = sites?.find(s => s.id === contract?.siteId);

      customerName = customer?.name || (del as any).customerName || '-';
      siteName = site?.name || (typeof site === 'string' ? site : '?꾩옣誘몄???);
      
      if (!rawAddress) {
        rawAddress = site?.address || customer?.address || '';
        if (!rawAddress && del.memo) {
          const match = del.memo.match(/二쇱냼:\s*(.*?)(?=\||$)/);
          if (match) rawAddress = match[1].trim();
        }
      }
    }

    setDestWeatherParams({
      customerName: customerName || '諛곗감 ?섏감吏',
      siteName: siteName || '?꾩옣',
      rawAddress: rawAddress || '寃쎄린???⑹씤??
    });
    setShowDestWeatherModal(true);
  };

  // ?ㅻТ??留덇컧 鍮꾧퀬
  const [closingMemo, setClosingMemo] = useState('');

  const [scheduledDate, setScheduledDate] = useState('');
  const [originAddress, setOriginAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [billableToCust, setBillableToCust] = useState(false);
  const [billableCustId, setBillableCustId] = useState('');
  const [assignedVehicles, setAssignedVehicles] = useState<AssignedVehicleRow[]>([]);

  // ?섎룞 諛곗감 紐⑤떖 state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualCategory, setManualCategory] = useState<'異쒓퀬' | '?낃퀬' | '諛섎궔' | '?뺣퉬' | '?대룞' | '援먰솚'>('異쒓퀬');
  const [manualCustomerId, setManualCustomerId] = useState('');
  const [manualContractId, setManualContractId] = useState('');
  const [manualOrigin, setManualOrigin] = useState('?뱀궗 蹂닿???);
  const [manualDestination, setManualDestination] = useState('');
  const [manualLoadingDate, setManualLoadingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualLoadingTimeSlot, setManualLoadingTimeSlot] = useState('?ㅼ쟾');
  const [manualLoadingCustomTime, setManualLoadingCustomTime] = useState('');
  const [manualUnloadingDate, setManualUnloadingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualUnloadingTimeSlot, setManualUnloadingTimeSlot] = useState('?ㅼ쟾');
  const [manualUnloadingCustomTime, setManualUnloadingCustomTime] = useState('');
  const [manualExpectedCost, setManualExpectedCost] = useState(0);
  const [manualBillable, setManualBillable] = useState(false);
  const [manualMemo, setManualMemo] = useState('');
  const [manualClosingMemo, setManualClosingMemo] = useState('');

  const [manualVehicles, setManualVehicles] = useState<VehicleReq[]>([{ vehicleType: '3.5T', count: 1 }]);
  const [manualCargos, setManualCargos] = useState<CargoItem[]>([{ modelName: products[0]?.modelName || 'Skyjack SJ3219', count: 1 }]);

  // ?뱞 [?붾쭚 ?댁넚猷??????state & 1:1 Split Pair ?뚯씠?꾨씪??
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // ?뮕 [?ъ옣??吏?? 湲곕낯 議고쉶: 2026??7??/ ?뱀썡 1??湲곗?
  const [reconStartDate, setReconStartDate] = useState<string>('2026-07-01');
  const [reconEndDate, setReconEndDate] = useState<string>('2026-07-31');
  const [selectedReconCompany, setSelectedReconCompany] = useState<string>('ALL');
  
  // ?뮕 [?ъ옣??吏?? 吏湲??곹깭 ?꾪꽣: 湲곕낯媛믪? 'UNPAID' (吏湲?誘몄셿猷?/ 誘몄젙??嫄대쭔 吏묒쨷 ???
  const [reconPaymentFilter, setReconPaymentFilter] = useState<'UNPAID' | 'PAID' | 'ALL'>('UNPAID');
  const [reconStatusFilter, setReconStatusFilter] = useState<'ALL' | 'PENDING' | 'MATCHED' | 'MISMATCH' | 'EXCEL_ONLY' | 'SYSTEM_ONLY' | 'EXCLUDED' | 'PAYMENT_REQUESTED'>('ALL');
  const [reconSearchQuery, setReconSearchQuery] = useState<string>('');

  // 1:1 Pair ??諛곗뿴 state 諛??낅┰ ????⑤꼸 ?좏깮 state
  const [reconPairs, setReconPairs] = useState<ReconPairRow[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [selectedPairIds, setSelectedPairIds] = useState<Set<string>>(new Set());
  const [reconNotificationMsg, setReconNotificationMsg] = useState<string>('');
  const [selectedSystemDeliveryId, setSelectedSystemDeliveryId] = useState<string | null>(null);
  const [selectedExcelRowIndex, setSelectedExcelRowIndex] = useState<number | null>(null);

  // 留ㅼ엯 吏湲??붿껌 ?꾨즺 ?깃났 紐⑤떖 state
  const [paymentSuccessInfo, setPaymentSuccessInfo] = useState<{
    bundleCode: string;
    totalCount: number;
    totalAmount: number;
    companyName: string;
    reconMonth: string;
  } | null>(null);
  const [isBundleCopied, setIsBundleCopied] = useState(false);

  const handleCopyBundleCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setIsBundleCopied(true);
    setTimeout(() => setIsBundleCopied(false), 2000);
  };

  // ?뮕 [?ъ옣??吏?? ??????붾툝?대┃ ??諛곗감 ?곸꽭 諛????鍮꾧탳 紐⑤떖 state
  const [selectedReconDetailPair, setSelectedReconDetailPair] = useState<ReconPairRow | null>(null);

  // ?뮕 [?ъ옣??吏?? 湲덉븸 ?섏젙 紐⑤떖 state & DB 諛섏쁺 ?몃뱾??
  const [showCostEditModal, setShowCostEditModal] = useState<boolean>(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [editingCostInput, setEditingCostInput] = useState<number>(0);

  const handleOpenCostEdit = (d: Delivery, currentCost: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDelivery(d);
    setEditingCostInput(currentCost);
    setShowCostEditModal(true);
  };

  const handleSaveDeliveryCost = async () => {
    if (!editingDelivery) return;
    const newCost = Number(editingCostInput);
    if (isNaN(newCost) || newCost < 0) {
      showErrorModal('?좏슚??湲덉븸???낅젰??二쇱꽭??');
      return;
    }

    try {
      // 1. DB (deliveries ?뚯씠釉? ?숆린 ?낅뜲?댄듃 ?섑뻾 (deliveryCost 諛?assignedVehicles 李⑤웾 ?댁넚鍮??숈떆 ?숆린??
      const updatedVehicles = editingDelivery.assignedVehicles && editingDelivery.assignedVehicles.length > 0
        ? editingDelivery.assignedVehicles.map((v, i) => i === 0 ? { ...v, deliveryCost: newCost } : { ...v, deliveryCost: 0 })
        : [];

      const updateData: any = {
        finalCost: newCost,
        deliveryCost: newCost
      };

      if (updatedVehicles.length > 0) {
        updateData.assignedVehicles = updatedVehicles;
      }

      db.updateRow('deliveries', editingDelivery.id, updateData);

      // ?뮕 [?ъ옣??吏?? ?먭꺽 Supabase DB ?곌린媛 100% ?꾨즺???뚭퉴吏 ?숆린 ?湲?(Zero Silent Failures)
      await db.awaitPendingWrites();

      // ?뮕 [?ъ옣??吏?? ?⑥닚 ?湲곕쭔 ?섏? ?딄퀬, ?ㅼ젣 DB瑜??ㅼ떆 SELECT ?쎄린議고쉶?섏뿬 紐⑺몴 湲덉븸?쇰줈 100% ?뺤긽 ?섏젙?섏뿀?붿? 寃利?(Read-Back Verification)
      const verifiedDelivery = db.deliveries.find(d => d.id === editingDelivery.id);
      const verifiedCost = verifiedDelivery ? (verifiedDelivery.deliveryCost || (verifiedDelivery.assignedVehicles && verifiedDelivery.assignedVehicles[0]?.deliveryCost) || 0) : 0;

      if (!verifiedDelivery || verifiedCost !== newCost) {
        throw new Error(`DB 諛섏쁺 寃利??ㅽ뙣 (紐⑺몴 湲덉븸: ??{newCost.toLocaleString()}??vs ?ㅼ젣 DB ??μ븸: ??{verifiedCost.toLocaleString()}??. DB 媛깆떊???뺤긽?곸쑝濡?泥섎━?섏? ?딆븯?듬땲??`);
      }

      // 2. ?꾩껜 ?곗씠??諛?state 媛깆떊
      await refreshAllData();

      // 3. 1:1 ???reconPairs 李⑥븸 諛??먮룞 吏앹쭞湲??ш퀎??
      setReconPairs(prev => prev.map(p => {
        if (p.systemDelivery?.id === editingDelivery.id) {
          const excelCost = p.excelCost || 0;
          const newDiff = excelCost > 0 ? (excelCost - newCost) : 0;
          const isMatchedNow = p.excelRow ? (newDiff === 0 && excelCost > 0) : false;

          return {
            ...p,
            systemCost: newCost,
            diffCost: newDiff,
            matchStatus: isMatchedNow ? 'MATCHED' : (newDiff !== 0 && excelCost > 0 ? 'MISMATCH' : p.matchStatus),
            isReconciled: isMatchedNow,
            memo: isMatchedNow ? '湲덉븸 ?섏젙 ??100% ?쇱튂 ????꾨즺' : `湲덉븸 ?섏젙 諛섏쁺??(?쒖뒪????{newCost.toLocaleString()}??`
          };
        }
        return p;
      }));

      setShowCostEditModal(false);
      setEditingDelivery(null);
      setReconNotificationMsg(`?뮥 ${editingDelivery.id} 諛곗감 ?댁넚猷뚭? ??{newCost.toLocaleString()}?먯쑝濡??섏젙?섏뼱 DB??諛섏쁺?섏뿀?듬땲??`);
    } catch (err: any) {
      showErrorModal('湲덉븸 ?섏젙 以??ㅻ쪟媛 諛쒖깮?섏??듬땲?? ' + err.message);
    }
  };

  // ?뮕 [?ъ옣??吏?? 醫뚯륫 1媛???+ ?곗륫 1媛????섎룞 ?좏깮 1:1 ??ъ셿猷?留ㅼ묶
  const handleManualPairMatch = () => {
    if (!selectedSystemDeliveryId || selectedExcelRowIndex === null) {
      showErrorModal('醫뚯륫 ?쒖뒪??諛곗감 1嫄닿낵 ?곗륫 ?묒? ??ぉ 1嫄댁쓣 媛곴컖 ?좏깮??二쇱꽭??');
      return;
    }

    const sysD = deliveries.find(d => d.id === selectedSystemDeliveryId);
    const excelRows = reconPairs.filter(p => p.excelRow);
    const excelPair = excelRows[selectedExcelRowIndex];

    if (!sysD || !excelPair) {
      showErrorModal('?좏깮??諛곗감 ?먮뒗 ?묒? ??ぉ??李얠쓣 ???놁뒿?덈떎.');
      return;
    }

    const sysCost = getEffectiveDeliveryCost(sysD);
    const costKey = Object.keys(excelPair.excelRow).find(k => k.includes('?⑷퀎') || k.includes('?댁넚鍮?) || k.includes('泥?뎄湲덉븸') || k.includes('湲덉븸'));
    const excelCost = costKey ? Number(String(excelPair.excelRow[costKey]).replace(/[^0-9.-]+/g, '')) : 0;
    const diff = excelCost - sysCost;

    // ?뮕 [?ъ옣??吏?? 醫뚯륫/?곗륫 湲덉븸 ?곸씠 ?????泥섎━ 嫄곗젅
    if (diff !== 0) {
      showErrorModal(`?좑툘 [???泥섎━ 嫄곗젅]\n\n??醫뚯륫 ?쒖뒪??湲덉븸: ??{sysCost.toLocaleString()}??n???곗륫 ?묒? 泥?뎄湲덉븸: ??{excelCost.toLocaleString()}??n??李⑥븸: ??{Math.abs(diff).toLocaleString()}??n\n醫뚯륫怨??곗륫 ?⑤꼸??湲덉븸???곸씠????ぉ? ???泥섎━媛 遺덇??ν빀?덈떎.`);
      return;
    }

    setReconPairs(prev => {
      const filtered = prev.filter(p => p.systemDelivery?.id !== sysD.id && p.pairId !== excelPair.pairId);
      return [
        ...filtered,
        {
          pairId: `MANUAL-PAIR-${sysD.id}-${Date.now()}`,
          systemDelivery: sysD,
          excelRow: excelPair.excelRow,
          matchStatus: 'MATCHED',
          systemCost: sysCost,
          excelCost,
          diffCost: diff,
          memo: '?대떦??1:1 ?섎룞 ?좏깮 ????꾨즺',
          isReconciled: true
        }
      ];
    });

    setSelectedSystemDeliveryId(null);
    setSelectedExcelRowIndex(null);
    setReconNotificationMsg(`??${sysD.id} 諛곗감嫄닿낵 ?묒? ?됱씠 1:1 ?섎룞 ????꾨즺 泥섎━?섏뿀?듬땲??`);
  };

  // ?뱟 湲곌컙 ?좏깮 ?쇱빱 ?ы띁 (?붾퀎 ?뺤궛 吏??
  const handleSetReconMonth = (year: number, month: number) => {
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    setReconStartDate(startStr);
    setReconEndDate(endStr);
  };

  const handleSetReconDatePreset = (preset: '2026-07' | '2026-08' | 'THIS_MONTH' | 'LAST_MONTH' | '1M' | '3M' | 'ALL') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === '2026-07') {
      handleSetReconMonth(2026, 7);
    } else if (preset === '2026-08') {
      handleSetReconMonth(2026, 8);
    } else if (preset === 'THIS_MONTH') {
      handleSetReconMonth(today.getFullYear(), today.getMonth() + 1);
    } else if (preset === 'LAST_MONTH') {
      const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      handleSetReconMonth(lm.getFullYear(), lm.getMonth() + 1);
    } else if (preset === '1M') {
      const past = new Date();
      past.setMonth(today.getMonth() - 1);
      setReconStartDate(past.toISOString().split('T')[0]);
      setReconEndDate(todayStr);
    } else if (preset === '3M') {
      const past = new Date();
      past.setMonth(today.getMonth() - 3);
      setReconStartDate(past.toISOString().split('T')[0]);
      setReconEndDate(todayStr);
    } else {
      setReconStartDate('');
      setReconEndDate('');
    }
  };

  // ?룫 ?댁넚?щ퀎 誘몄?湲??????? 嫄댁닔 諛?湲덉븸 吏묎퀎 (?좏깮??湲곌컙 湲곗?)
  const unpaidStatsByCompany = useMemo(() => {
    const inPeriodDeliveries = deliveries.filter(d => {
      if (getNormalizedDeliveryStatus(d) !== 'DELIVERED') return false;
      const dDate = d.loadingDate || d.requestDate || d.scheduledDate || d.createdAt?.substring(0, 10);
      if (reconStartDate && dDate && dDate < reconStartDate) return false;
      if (reconEndDate && dDate && dDate > reconEndDate) return false;
      return true;
    });

    const stats: Record<string, { total: number; unpaid: number; unpaidCost: number }> = {
      ALL: { total: 0, unpaid: 0, unpaidCost: 0 }
    };

    inPeriodDeliveries.forEach(d => {
      const isPaid = (d as any).reconciliationStatus === 'PAYMENT_REQUESTED' || (d as any).reconciliationStatus === 'SETTLED' || d.isCostSettled === true;
      const cost = getEffectiveDeliveryCost(d);

      // ?댁넚?щ챸 ?뚯떛
      const rawComp = d.assignedVehicles?.[0]?.transportCompany || d.transportCompany || '';
      let matchedComp = '湲고?';
      if (rawComp.includes('寃쎄린')) matchedComp = '寃쎄린';
      else if (rawComp.includes('?섏젣??) || rawComp.toLowerCase().includes('lj')) matchedComp = '?섏젣??;
      else if (rawComp.includes('?먯씤') || rawComp.includes('?좎젣??) || rawComp.toLowerCase().includes('mj')) matchedComp = '?먯씤';
      else if (rawComp) matchedComp = rawComp;

      stats.ALL.total++;
      if (!isPaid) {
        stats.ALL.unpaid++;
        stats.ALL.unpaidCost += cost;
      }

      if (!stats[matchedComp]) {
        stats[matchedComp] = { total: 0, unpaid: 0, unpaidCost: 0 };
      }
      stats[matchedComp].total++;
      if (!isPaid) {
        stats[matchedComp].unpaid++;
        stats[matchedComp].unpaidCost += cost;
      }
    });

    return stats;
  }, [deliveries, reconStartDate, reconEndDate]);

  // ?슊 ?댁넚 ?꾨즺(DELIVERED) 嫄대뱾 ???????꾪꽣留?(吏湲??곹깭 諛??댁넚?щ퀎 ?곕룞)
  const completedDeliveriesForRecon = useMemo(() => {
    return deliveries.filter(d => {
      // 1. ?댁넚 ?꾨즺嫄대쭔 ???
      if (getNormalizedDeliveryStatus(d) !== 'DELIVERED') return false;

      // 2. ?뮕 [?ъ옣??吏?? 吏湲??뺤궛 ?곹깭 ?꾪꽣 (湲곕낯: 吏湲?誘몄셿猷?嫄대쭔 ??????
      const isPaid = (d as any).reconciliationStatus === 'PAYMENT_REQUESTED' || (d as any).reconciliationStatus === 'SETTLED' || d.isCostSettled === true;
      if (reconPaymentFilter === 'UNPAID' && isPaid) return false;
      if (reconPaymentFilter === 'PAID' && !isPaid) return false;

      // 3. ?좎쭨 ?꾪꽣
      const dDate = d.loadingDate || d.requestDate || d.scheduledDate || d.createdAt?.substring(0, 10);
      if (reconStartDate && dDate && dDate < reconStartDate) return false;
      if (reconEndDate && dDate && dDate > reconEndDate) return false;

      // 4. ?댁넚 嫄곕옒泥??꾪꽣
      if (selectedReconCompany !== 'ALL') {
        const rawComp = d.assignedVehicles?.[0]?.transportCompany || d.transportCompany || '';
        const match = rawComp.toLowerCase().includes(selectedReconCompany.toLowerCase());
        if (!match) return false;
      }

      // 5. 寃?됱뼱 (諛곗감ID, 湲곗궗紐? 嫄곕옒泥? 怨좉컼?щ챸)
      if (reconSearchQuery) {
        const q = reconSearchQuery.trim();
        const contract = contracts.find(c => c.id === d.contractId);
        const customer = contract ? customers.find(c => c.id === contract.customerId) : null;
        const match = (d.id && d.id.toLowerCase().includes(q.toLowerCase())) ||
          (d.driverName && matchHangul(d.driverName, q)) ||
          (d.destinationAddress && matchHangul(d.destinationAddress, q)) ||
          (contract && contract.contractNo.toLowerCase().includes(q.toLowerCase())) ||
          (customer && matchHangul(customer.name, q));
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      const dateA = a.loadingDate || a.requestDate || a.scheduledDate || a.createdAt?.substring(0, 10) || '9999-99-99';
      const dateB = b.loadingDate || b.requestDate || b.scheduledDate || b.createdAt?.substring(0, 10) || '9999-99-99';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (a.id || '').localeCompare(b.id || '');
    });
  }, [deliveries, reconPaymentFilter, reconStartDate, reconEndDate, selectedReconCompany, reconSearchQuery, contracts, customers]);

  // ?뮕 [?ъ옣??吏?? 議고쉶 踰꾪듉 ?대┃ ??濡쒕뵫??????뺣낫(?묒? 1:1 ???pair, ?낅줈???뚯씪, ?좏깮 ?곹깭 ??瑜??꾩쟾 珥덇린?뷀븯??源⑤걮???먯옣 議고쉶 ?곹깭濡?蹂듦?
  const handleReconSearch = () => {
    setReconPairs([]);
    setUploadedFileName('');
    setSelectedPairIds(new Set());
    setSelectedSystemDeliveryId(null);
    setSelectedExcelRowIndex(null);
    setReconStatusFilter('ALL');
    setReconSearchQuery('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setReconNotificationMsg(`?뵇 [${selectedReconCompany === 'ALL' ? '?꾩껜 嫄곕옒泥? : selectedReconCompany}] (${reconStartDate} ~ ${reconEndDate} / ${reconPaymentFilter === 'UNPAID' ? '誘몄?湲됯굔' : reconPaymentFilter === 'PAID' ? '吏湲됱셿猷뚭굔' : '?꾩껜'}) 議고쉶媛 媛깆떊?섏뿀?듬땲?? (????뺣낫 珥덇린?붾맖)`);
  };

  // 嫄곕옒紐낆꽭???묒? ?뚯떛 諛?1:1 ?섏뼱留??뚯씠?꾨씪??(?ㅻ????쒖떇/?좎쭨 ?뺢퇋??& 2?④퀎 吏?ν삎 留ㅼ묶 ?붿쭊)
  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        
        // 1. ?좏슚 ?곗씠?곌? 媛??留롮? ?쒗듃 ?먮룞 ?좏깮 (鍮??쒗듃 ?꾪꽣留?
        let targetSheetName = workbook.SheetNames[0];
        let maxRowCount = 0;
        for (const sName of workbook.SheetNames) {
          const ws = workbook.Sheets[sName];
          const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (raw && raw.length > maxRowCount) {
            maxRowCount = raw.length;
            targetSheetName = sName;
          }
        }

        const sheet = workbook.Sheets[targetSheetName];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (!rawRows || rawRows.length === 0) {
          showErrorModal('?낅줈?쒗븳 ?묒? ?뚯씪???곗씠?곌? ?놁뒿?덈떎.');
          return;
        }

        // 2. ?숈쟻 ?ㅻ뜑 ??媛먯? (?뺣? ? ?⑥쐞 留ㅼ묶: 理쒕떎 ?ㅼ썙???쇱튂 ???좎젙)
        const headerKeywords = ['?쇱옄', '?좎쭨', '?곸감吏', '?섏감吏', '?ㅼ닔', '李⑥쥌', '?댁넚鍮?, '?꾩옣紐?, '?낆껜紐?, '湲곗궗紐?, '鍮꾧퀬', 'no', '?④?', '湲덉븸', '?⑷퀎', '?λ퉬紐?, '?ъ슜湲곌컙', '?덈챸'];
        let headerRowIndex = -1;
        let maxMatchCount = 0;

        for (let r = 0; r < Math.min(30, rawRows.length); r++) {
          const cells = rawRows[r].map((c: any) => String(c).replace(/\s+/g, '').toLowerCase());
          const fullRowTextClean = cells.join(' ');
          // 紐낆꽭???곷떒 怨듦툒媛???⑷퀎湲덉븸 ?붿빟???됱? 紐낆꽭??蹂몃Ц ?뚯씠釉??ㅻ뜑媛 ?꾨땲誘濡??쒖쇅
          if (fullRowTextClean.includes('怨듦툒媛??) || fullRowTextClean.includes('?ъ뾽?μ＜??) || fullRowTextClean.includes('?깅줉踰덊샇')) {
            continue;
          }
          const matchCount = headerKeywords.filter(kw =>
            cells.some((cell: string) => cell === kw || (cell.length <= 10 && cell.includes(kw)))
          ).length;
          if (matchCount > maxMatchCount && matchCount >= 3) {
            maxMatchCount = matchCount;
            headerRowIndex = r;
          }
        }

        if (headerRowIndex === -1) {
          headerRowIndex = 0;
        }

        // 3. ?ㅻ뜑 而щ읆紐?異붿텧
        const rawHeaderRow = rawRows[headerRowIndex] || [];
        const headerNames: string[] = rawHeaderRow.map((col: any, cIdx: number) => {
          const title = String(col).trim();
          if (title) return title;
          return `鍮꾧퀬_${cIdx + 1}`;
        });

        const isMemoKey = (k: string) => {
          const kl = k.replace(/\s+/g, '').toLowerCase();
          // ?좎쭨, 湲덉븸, ?곸감吏, 踰덊샇 ???뺢퇋 而щ읆? 鍮꾧퀬???ｌ? ?딆쓬
          if (kl.includes('?쇱옄') || kl.includes('?좎쭨') || kl.includes('?댁넚??) || kl.includes('?ъ슜湲곌컙') ||
              kl.includes('湲덉븸') || kl.includes('?④?') || kl.includes('?댁넚鍮?) || kl.includes('泥?뎄') ||
              kl.includes('no') || kl.includes('踰덊샇')) {
            return false;
          }
          return kl.includes('?꾩옣') || kl.includes('?낆껜') || kl.includes('鍮꾧퀬') ||
                 kl.includes('硫붾え') || kl.includes('?뱀씠') || kl.includes('李멸퀬') || kl.includes('?λ퉬') || kl.includes('?덈챸');
        };

        // 4. ?곗씠????援ъ꽦 (?뷀넗 ?곸냽 & ?좎쭨/湲덉븸 ?뺢퇋??& ?섎떒 ?쒕챸/珥앹븸 諛⑹뼱)
        const parsedRows: any[] = [];
        let lastDate = '';
        let lastOrigin = '';
        let lastDest = '';

        let activeYear = reconStartDate ? reconStartDate.split('-')[0] : String(new Date().getFullYear());
        let activeMonth = reconStartDate ? reconStartDate.split('-')[1] : String(new Date().getMonth() + 1).padStart(2, '0');

        // ?곷떒 10???댁뿉???쒕ぉ?대굹 ?좎쭨 ?ㅻ뜑("< 08?붾떖 >", "2026??8??) 媛먯??섏뿬 湲곕낯 ?곗썡 蹂댁젙
        for (let r = 0; r < Math.min(10, rawRows.length); r++) {
          const rowStr = (rawRows[r] || []).map((c: any) => String(c || '').trim()).join(' ');
          const ymMatch = rowStr.match(/(\d{4})??s*(\d{1,2})??);
          if (ymMatch) {
            activeYear = ymMatch[1];
            activeMonth = ymMatch[2].padStart(2, '0');
            break;
          }
          const mOnlyMatch = rowStr.match(/<\s*(\d{1,2})??);
          if (mOnlyMatch) {
            activeMonth = mOnlyMatch[1].padStart(2, '0');
            break;
          }
        }

        // ?뮕 [?ъ옣??吏?? "." ?먮뒗 ?곗샂???뱀닔湲고샇濡??낅젰???? 諛붾줈 ?쀭뻾???곗씠?곗? ?숈씪(Ditto)??寃껋쑝濡?泥섎━
        const isDitto = (val: string) => {
          if (!val) return true;
          const v = String(val).trim();
          return (
            v === '"' || v === '""' || v === "''" || v === "'" ||
            v === '?? || v === '?? || v === '?? || v === '?? ||
            v === '.' || v === '..' || v === '...' ||
            v === '쨌' || v === '?? || v === '-' ||
            v === '?곷룞' || v === '?숈긽' || v === '?숈씪' || v === '?? || v === '??
          );
        };

        for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
          const rowArr = rawRows[r];
          if (!rowArr || rowArr.every((cell: any) => String(cell || '').trim() === '')) continue;

          const firstCellClean = String(rowArr[0] || '').replace(/\s+/g, '');
          const fullRowTextClean = rowArr.map((cell: any) => String(cell || '').trim()).join(' ');
          const cleanRowTextNoSpace = fullRowTextClean.replace(/\s+/g, '');

          // ?뮕 [?ъ옣??吏?? 嫄곕옒紐낆꽭???섎떒遺 臾몄꽌 ?쒕챸, ?좎씤, 寃곗젣怨꾩쥖, 珥앷퀎 ??鍮꾩껌援??곗씠??泥좎? 諛⑹뼱
          const footerKeywords = [
            '?⑷퀎', '?뚭퀎', '珥앷퀎', '珥앹븸', '?꾧퀎', '怨듦툒媛??, '?⑷퀎湲덉븸', '遺媛??, '?몄븸',
            '?ъ뾽?μ＜??, '?깅줉踰덊샇', '?곹샇:', '??쒖옄', '???', '?깅챸:', '?낃툑怨꾩쥖', '怨꾩쥖踰덊샇',
            '?덇툑二?, '泥?뎄?⑸땲??, '泥?뎄湲덉븸', '泥?뎄?⑷퀎', '?꾩?媛숈씠', '?꾨옒?媛숈씠', '?쒕챸',
            '(??', '(?쒕챸)', '?뺤씤??, '?곸닔??, '?섎졊??, '?대떦?먮궇??, '洹??, '?붾떖', '?붾텇'
          ];
          if (footerKeywords.some(kw => cleanRowTextNoSpace.includes(kw))) continue;

          // ? 以??섎굹?쇰룄 ?⑷퀎/?뚭퀎/珥앹븸/????깆쑝濡??쒖옉?섎뒗 寃쎌슦 ?쒖쇅
          if (rowArr.some((c: any) => {
            const s = String(c || '').replace(/\s+/g, '');
            return s.startsWith('?⑷퀎') || s.startsWith('?뚭퀎') || s.startsWith('珥앷퀎') || s.startsWith('珥앹븸');
          })) continue;

          // ?꾩쟻 湲덉븸怨??쇱튂?섎뒗 ??諛⑹뼱 (臾몄꽌 ?섎떒 Grand Total ?붿빟 ??諛곗젣)
          const runningSum = parsedRows.reduce((sum, pr) => sum + (Number(pr['?뺢퇋湲덉븸']) || 0), 0);
          if (parsedRows.length >= 2 && runningSum > 0) {
            const hasTotalMatch = rowArr.some((c: any) => {
              const num = Number(String(c || '').replace(/[^0-9.-]+/g, ''));
              return num > 0 && Math.abs(num - runningSum) <= 50;
            });
            if (hasTotalMatch) continue;
          }

          const rowObj: any = {};
          headerNames.forEach((hName, cIdx) => {
            rowObj[hName] = String(rowArr[cIdx] !== undefined ? rowArr[cIdx] : '').trim();
          });

          // 湲덉븸 異붿텧 (怨듬갚 ?쒓굅 ?뺢퇋??留ㅼ묶):
          let rawCost = 0;
          const priorityCostKey = Object.keys(rowObj).find(k => {
            const ck = k.replace(/\s+/g, '');
            return (ck.includes('?댁넚鍮?) || ck.includes('泥?뎄') || ck.includes('?④?')) && !ck.includes('?쇱옄') && !ck.includes('?좎쭨') && !ck.toLowerCase().includes('no');
          });
          const generalCostKey = Object.keys(rowObj).find(k => {
            const ck = k.replace(/\s+/g, '');
            return (ck.includes('湲덉븸') || ck.includes('?⑷퀎')) && !ck.includes('?쇱옄') && !ck.includes('?좎쭨') && !ck.toLowerCase().includes('no');
          });
          const costKey = priorityCostKey || generalCostKey;

          if (costKey && rowObj[costKey]) {
            rawCost = Number(String(rowObj[costKey]).replace(/[^0-9.-]+/g, '')) || 0;
          }
          if (rawCost === 0) {
            for (let c = rowArr.length - 1; c >= 0; c--) {
              const num = Number(String(rowArr[c]).replace(/[^0-9.-]+/g, ''));
              if (num >= 10000 && num <= 5000000 && !(num >= 40000 && num <= 50000 && c <= 2)) {
                rawCost = num;
                break;
              }
            }
          }

          const dateKey = Object.keys(rowObj).find(k => {
            const ck = k.replace(/\s+/g, '');
            return ck.includes('?쇱옄') || ck.includes('?좎쭨') || ck.includes('?댁넚??) || ck.includes('?ъ슜湲곌컙');
          });
          const originKey = Object.keys(rowObj).find(k => {
            const ck = k.replace(/\s+/g, '');
            return ck.includes('?곸감吏') || ck.includes('異쒕컻吏') || ck.includes('?곸감');
          });
          const destKey = Object.keys(rowObj).find(k => {
            const ck = k.replace(/\s+/g, '');
            return ck.includes('?섏감吏') || ck.includes('?꾩갑吏') || ck.includes('?꾩옣') || ck.includes('?섏감');
          });

          let rawDateCell = dateKey ? String(rowObj[dateKey]).trim() : '';
          let rawOrigin = originKey ? String(rowObj[originKey]).trim() : '';
          let rawDest = destKey ? String(rowObj[destKey]).trim() : '';

          // ?뮕 ?쒕챸/?섎떒 ?붿빟? 諛⑹뼱: ?곸감吏/?섏감吏/?꾩옣紐?諛?李⑤웾?뺣낫媛 ?꾨Т?섍퀬 湲덉븸留?嫄곗븸????諛곗젣
          const hasLocation = rawOrigin || rawDest || String(rowObj['?꾩옣紐?] || '').trim() || String(rowObj['?곸감吏'] || '').trim() || String(rowObj['?섏감吏'] || '').trim();
          const hasCargoType = String(rowObj['李⑥쥌'] || '').trim() || String(rowObj['?ㅼ닔'] || '').trim() || String(rowObj['?덈챸'] || '').trim() || String(rowObj['?λ퉬紐?] || '').trim();
          if (!hasLocation && !hasCargoType && rawCost > 1500000) {
            continue;
          }

          if (rawCost <= 0 && !rawDateCell && !rawOrigin && !rawDest) continue;

          // ?뮕 "." ?먮뒗 ?뷀넗 ?곸냽: 諛붾줈 ?쀭뻾 ?곗씠???숈씪 ?곸냽
          if (isDitto(rawDateCell) && lastDate) rawDateCell = lastDate;
          else if (rawDateCell && !isDitto(rawDateCell)) lastDate = rawDateCell;

          if (isDitto(rawOrigin) && lastOrigin) rawOrigin = lastOrigin;
          else if (rawOrigin && !isDitto(rawOrigin)) lastOrigin = rawOrigin;

          if (isDitto(rawDest) && lastDest) rawDest = lastDest;
          else if (rawDest && !isDitto(rawDest)) lastDest = rawDest;

          // ?뱟 ?좎쭨 ?뺢퇋?? "08??01??, "3?? (???앸왂), "3", "8/1", "2026.08.01", ?묒? ?쒕━???섎쾭 ???ㅻ????뺢퇋??
          let normDate = rawDateCell;
          if (rawDateCell) {
            const cleanD = rawDateCell.trim();
            const numVal = Number(cleanD);
            if (!isNaN(numVal) && numVal > 30000 && numVal < 60000) {
              const utcDays = Math.floor(numVal - 25569);
              const d = new Date(utcDays * 86400 * 1000);
              const y = String(d.getUTCFullYear());
              const m = String(d.getUTCMonth() + 1).padStart(2, '0');
              const day = String(d.getUTCDate()).padStart(2, '0');
              normDate = `${y}-${m}-${day}`;
              activeYear = y;
              activeMonth = m;
            } else if (cleanD.match(/(\d{2,4})??s*(\d{1,2})??s*(\d{1,2})??/)) {
              const m = cleanD.match(/(\d{2,4})??s*(\d{1,2})??s*(\d{1,2})??/);
              if (m) {
                let y = m[1];
                if (y.length === 2) y = '20' + y;
                const mo = m[2].padStart(2, '0');
                const d = m[3].padStart(2, '0');
                normDate = `${y}-${mo}-${d}`;
                activeYear = y;
                activeMonth = mo;
              }
            } else if (cleanD.match(/(\d{1,2})??s*(\d{1,2})??/)) {
              const m = cleanD.match(/(\d{1,2})??s*(\d{1,2})??/);
              if (m) {
                const mo = m[1].padStart(2, '0');
                const d = m[2].padStart(2, '0');
                normDate = `${activeYear}-${mo}-${d}`;
                activeMonth = mo;
              }
            } else if (cleanD.match(/^(\d{1,2})??/)) {
              // ?뮕 [?ъ옣??吏?? "3?? (???앸왂)?대씪???곸쐞 ?쒖꽦 ??8??3??濡??뺤긽 泥섎━
              const d = cleanD.replace('??, '').trim().padStart(2, '0');
              normDate = `${activeYear}-${activeMonth}-${d}`;
            } else if (cleanD.match(/^\d{1,2}$/) && Number(cleanD) >= 1 && Number(cleanD) <= 31) {
              // ?쇱옄 ?レ옄留??⑤룆 ?낅젰??寃쎌슦
              const d = cleanD.padStart(2, '0');
              normDate = `${activeYear}-${activeMonth}-${d}`;
            } else if (cleanD.includes('.') && cleanD.includes('/')) {
              const parts = cleanD.split(/[\.\/]/).map(p => p.trim());
              if (parts.length >= 3) {
                let y = parts[0];
                if (y.length === 2) y = '20' + y;
                const mo = parts[1].padStart(2, '0');
                const d = parts[2].padStart(2, '0');
                normDate = `${y}-${mo}-${d}`;
                activeYear = y;
                activeMonth = mo;
              }
            } else if (cleanD.includes('/')) {
              const parts = cleanD.split('/').map(p => p.trim());
              if (parts.length === 2) {
                const mo = parts[0].padStart(2, '0');
                const d = parts[1].padStart(2, '0');
                normDate = `${activeYear}-${mo}-${d}`;
                activeMonth = mo;
              } else if (parts.length === 3) {
                let y = parts[0];
                if (y.length === 2) y = '20' + y;
                const mo = parts[1].padStart(2, '0');
                const d = parts[2].padStart(2, '0');
                normDate = `${y}-${mo}-${d}`;
                activeYear = y;
                activeMonth = mo;
              }
            } else if (cleanD.includes('.')) {
              const parts = cleanD.split('.').map(p => p.trim()).filter(Boolean);
              if (parts.length === 2 && Number(parts[0]) <= 12 && Number(parts[1]) <= 31) {
                const mo = parts[0].padStart(2, '0');
                const d = parts[1].padStart(2, '0');
                normDate = `${activeYear}-${mo}-${d}`;
                activeMonth = mo;
              } else if (parts.length === 3) {
                let y = parts[0];
                if (y.length === 2) y = '20' + y;
                const mo = parts[1].padStart(2, '0');
                const d = parts[2].padStart(2, '0');
                normDate = `${y}-${mo}-${d}`;
                activeYear = y;
                activeMonth = mo;
              }
            } else if (cleanD.includes('-')) {
              const parts = cleanD.split(' ')[0].split('-').map(p => p.trim());
              if (parts.length === 3) {
                let y = parts[0];
                if (y.length === 2) y = '20' + y;
                const mo = parts[1].padStart(2, '0');
                const d = parts[2].padStart(2, '0');
                normDate = `${y}-${mo}-${d}`;
                activeYear = y;
                activeMonth = mo;
              } else if (parts.length === 2 && Number(parts[0]) <= 12) {
                const mo = parts[0].padStart(2, '0');
                const d = parts[1].padStart(2, '0');
                normDate = `${activeYear}-${mo}-${d}`;
                activeMonth = mo;
              }
            }
          }

          // ?ㅼ쓬 ??ditto ?곸냽???꾪빐 lastDate ?낅뜲?댄듃
          if (normDate && normDate.includes('-')) {
            lastDate = normDate;
          }

          if (dateKey) rowObj[dateKey] = normDate;
          rowObj['?뺢퇋?쇱옄'] = normDate;
          rowObj['?뺢퇋湲덉븸'] = rawCost;
          rowObj['?뺢퇋?곸감吏'] = rawOrigin;
          rowObj['?뺢퇋?섏감吏'] = rawDest;

          // 鍮꾧퀬 蹂묓빀
          const memoParts: string[] = [];
          Object.keys(rowObj).forEach(k => {
            if (!isMemoKey(k) || k.startsWith('?뺢퇋')) return;
            const val = String(rowObj[k] || '').trim();
            if (val && !isDitto(val) && val !== '-') {
              memoParts.push(val);
            }
          });
          rowObj['鍮꾧퀬'] = memoParts.join(' | ');

          parsedRows.push(rowObj);
        }

        if (parsedRows.length === 0) {
          showErrorModal('?묒? ?뚯떛 寃곌낵 ?곗씠???됱쓣 李얠쓣 ???놁뒿?덈떎.');
          return;
        }

        // 5. 吏?ν삎 1:1 ???留ㅼ묶 ?붿쭊 (?좎쭨/湲덉븸 ?곗꽑 留ㅼ묶 & ?낆껜紐??ㅼ냼 遺덉씪移??덉슜)
        const remainingSystemDeliveries = [...completedDeliveriesForRecon];
        const pairs: ReconPairRow[] = [];
        let autoMatchedCount = 0;
        let mismatchCount = 0;

        // ?띿뒪???좎궗???ы띁 (?곸감吏, ?섏감吏, 怨좉컼?щ챸, ?꾩옣紐? 二쇱냼 ???ш큵)
        const isTextSimilar = (a: string, b: string) => {
          if (!a || !b) return false;
          const ca = a.replace(/\s+/g, '').toLowerCase();
          const cb = b.replace(/\s+/g, '').toLowerCase();
          if (ca.includes(cb) || cb.includes(ca)) return true;
          const wordsA = a.split(/[\s\(\)\/\-\_\[\],]+/).filter(w => w.length >= 2);
          if (wordsA.some(w => cb.includes(w.toLowerCase()))) return true;
          const wordsB = b.split(/[\s\(\)\/\-\_\[\],]+/).filter(w => w.length >= 2);
          if (wordsB.some(w => ca.includes(w.toLowerCase()))) return true;
          return false;
        };

        const isExactDate = (d1: string, d2: string) => Boolean(d1 && d2 && d1 === d2);
        const isDateNear = (d1: string, d2: string) => {
          if (!d1 || !d2) return false;
          if (d1 === d2) return true;
          try {
            const t1 = new Date(d1).getTime();
            const t2 = new Date(d2).getTime();
            return Math.abs(t1 - t2) <= 86400000 * 1.5;
          } catch {
            return false;
          }
        };

        parsedRows.forEach((row, rIdx) => {
          const excelCost = row['?뺢퇋湲덉븸'] || 0;
          const excelDate = row['?뺢퇋?쇱옄'] || '';
          const excelOrigin = row['?뺢퇋?곸감吏'] || row['?곸감吏'] || '';
          const excelDest = row['?뺢퇋?섏감吏'] || row['?섏감吏'] || row['?꾩옣紐?] || '';
          const excelMemo = row['鍮꾧퀬'] || '';

          const excelFullText = [
            excelOrigin, excelDest, excelMemo,
            row['?꾩옣紐?], row['?낆껜紐?], row['?곸감吏'], row['?섏감吏'], row['鍮꾧퀬'], row['李⑥쥌'], row['?덈챸']
          ].filter(Boolean).join(' ');

          // 吏?ν삎 理쒖쟻 ?꾨낫 ?ㅼ퐫?대쭅
          let bestIdx = -1;
          let bestScore = -1;

          for (let i = 0; i < remainingSystemDeliveries.length; i++) {
            const d = remainingSystemDeliveries[i];
            const sysDate = d.loadingDate || d.requestDate || '';
            const sysCost = getEffectiveDeliveryCost(d);
            const contract = contracts.find(c => c.id === d.contractId);
            const customer = contract ? customers.find(c => c.id === contract.customerId) : null;
            const site = contract?.siteId ? sites.find(s => s.id === contract.siteId) : null;
            const custName = customer?.name || '';
            const siteName = site?.name || '';
            const sysDest = d.destinationAddress || '';
            const sysPickup = d.originAddress || '';
            const sysFullText = [custName, siteName, sysDest, sysPickup, d.driverName, d.transportCompany, d.memo, d.rawText].filter(Boolean).join(' ');

            const dateExact = isExactDate(sysDate, excelDate);
            const dateNear = isDateNear(sysDate, excelDate);
            if (!dateNear) continue; // ?좎쭨媛 짹1???댁긽 李⑥씠?섎㈃ ?꾨낫 ?쒖쇅

            const costExact = excelCost > 0 && (sysCost === excelCost || d.finalCost === excelCost);
            const textOverlap = isTextSimilar(sysFullText, excelFullText);

            let score = 0;
            if (costExact) {
              // ?뮕 [?ъ옣??吏?? ?좎쭨? 湲덉븸??留욎쑝硫??낆껜紐??쒓린媛 ?ㅼ냼 遺덉씪移??섎뜑?쇰룄 ?덉슜
              score += 100;
              if (dateExact) score += 50; // ?뱀씪 ?쇱튂 ?곗꽑
              else score += 20; // 짹1???쇱튂
              if (textOverlap) score += 30; // ?띿뒪?멸퉴吏 ?쇱튂 ??理쒖슦??媛?곗젏
            } else {
              // 湲덉븸 遺덉씪移?(?좎쬆/李⑥븸 ?꾨낫): ?좎쭨 ?쇱튂 + ?띿뒪??寃뱀묠???덈뒗 寃쎌슦留??꾨낫
              if (textOverlap) {
                score += 40;
                if (dateExact) score += 20;
              }
            }

            if (score > bestScore) {
              bestScore = score;
              bestIdx = i;
            }
          }

          if (bestIdx !== -1) {
            const matchedDelivery = remainingSystemDeliveries.splice(bestIdx, 1)[0];
            const sysCost = getEffectiveDeliveryCost(matchedDelivery);
            const diff = excelCost - sysCost;

            // ?좎쬆 ?ъ쑀 ?먮룞 媛먯? (?湲? 寃쎌쑀, ?뚯감 ??
            let detectedReason = '';
            if (excelMemo.includes('?湲?)) detectedReason = '?꾩옣 ?湲곕즺';
            else if (excelMemo.includes('?곸감') || excelMemo.includes('?섏감') || excelMemo.includes('2怨?) || excelMemo.includes('寃쎌쑀')) detectedReason = '寃쎌쑀吏 ?좎쬆';
            else if (excelMemo.includes('?뚯감')) detectedReason = '?뚯감鍮?;
            else if (diff > 0) detectedReason = `?④? 李⑥븸 (+??{diff.toLocaleString()})`;

            const isMatched = (bestScore >= 120) || (diff === 0 && excelCost > 0);

            if (!isMatched && diff !== 0) {
              mismatchCount++;
              pairs.push({
                pairId: `PAIR-${matchedDelivery.id}-${rIdx}`,
                systemDelivery: matchedDelivery,
                excelRow: row,
                matchStatus: 'MISMATCH',
                systemCost: sysCost,
                excelCost,
                diffCost: diff,
                surchargeReason: detectedReason,
                memo: excelMemo || `?쒖뒪????{sysCost.toLocaleString()}??vs ?묒? ??{excelCost.toLocaleString()}??(${detectedReason})`,
                isReconciled: false
              });
            } else {
              autoMatchedCount++;
              const contract = contracts.find(c => c.id === matchedDelivery.contractId);
              const customer = contract ? customers.find(c => c.id === contract.customerId) : null;
              const custName = customer?.name || '';
              const textOverlap = isTextSimilar([custName, matchedDelivery.destinationAddress, matchedDelivery.originAddress].filter(Boolean).join(' '), excelFullText);

              pairs.push({
                pairId: `PAIR-${matchedDelivery.id}-${rIdx}`,
                systemDelivery: matchedDelivery,
                excelRow: row,
                matchStatus: 'MATCHED',
                systemCost: sysCost,
                excelCost,
                diffCost: 0,
                surchargeReason: detectedReason,
                memo: excelMemo || (textOverlap ? '?좎쭨/?꾩옣/湲덉븸 ?쇱튂 (?먮룞 留ㅼ묶)' : '?좎쭨/湲덉븸 ?쇱튂 (?낆껜紐??쒓린 ?덉슜 ?먮룞 留ㅼ묶)'),
                isReconciled: true
              });
            }
          } else {
            // ?묒? ?⑤룆 ??ぉ
            pairs.push({
              pairId: `EXCEL-ONLY-${rIdx}`,
              excelRow: row,
              matchStatus: 'EXCEL_ONLY',
              systemCost: 0,
              excelCost,
              diffCost: excelCost,
              memo: row['鍮꾧퀬'] || '?쒖뒪??諛곗감 誘몄〈??(?꾨? ?뚯닔 ?먮뒗 ?ㅼ껌援?',
              isReconciled: false,
              isExcluded: false
            });
          }
        });

        // ?⑥? ?쒖뒪??諛곗감 (?쒖뒪???⑤룆 ??ぉ)
        remainingSystemDeliveries.forEach((sysD, sIdx) => {
          const sysCost = getEffectiveDeliveryCost(sysD);
          pairs.push({
            pairId: `SYS-ONLY-${sysD.id}-${sIdx}`,
            systemDelivery: sysD,
            matchStatus: 'SYSTEM_ONLY',
            systemCost: sysCost,
            excelCost: 0,
            diffCost: -sysCost,
            memo: '紐낆꽭???묒? 誘멸린??(誘몄껌援??먮뒗 ? ?댁넚??嫄?',
            isReconciled: false
          });
        });

        setReconPairs(pairs);
        const excelOnlyCnt = pairs.filter(p => p.matchStatus === 'EXCEL_ONLY').length;
        const msg = `?럦 2?④퀎 吏?ν삎 ????꾨즺! [?윟 ?쇱튂 ${autoMatchedCount}嫄? | [?윞 湲덉븸遺덉씪移??좎쬆 ${mismatchCount}嫄? | [?뵶 ?묒??⑤룆 ${excelOnlyCnt}嫄? | [???쒖뒪?쒕떒??${remainingSystemDeliveries.length}嫄?`;
        setReconNotificationMsg(msg);
      } catch (err: any) {
        showErrorModal('?묒? ?뚯떛 以??ㅻ쪟媛 諛쒖깮?섏??듬땲?? ' + err.message);
      }
    };

    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ??李⑥븸 ?뱀씤 (MISMATCH -> MATCHED ?뺤젙)
  const handleApproveMismatch = async (pairId: string) => {
    const pair = reconPairs.find(p => p.pairId === pairId);
    if (!pair || !pair.systemDelivery) return;

    try {
      await db.updateRow('deliveries', pair.systemDelivery.id, {
        finalCost: pair.excelCost,
        deliveryCost: pair.excelCost,
        reconciliationStatus: 'RECONCILED',
        memo: [pair.systemDelivery.memo, `[李⑥븸?뱀씤: ??{pair.excelCost.toLocaleString()} (${pair.surchargeReason || '?좎쬆?몄젙'})]`].filter(Boolean).join(' | ')
      } as any);
      await db.awaitPendingWrites();
      refreshAllData();

      setReconPairs(prev => prev.map(p => {
        if (p.pairId === pairId) {
          return {
            ...p,
            matchStatus: 'MATCHED',
            systemCost: p.excelCost,
            diffCost: 0,
            isReconciled: true
          };
        }
        return p;
      }));
    } catch (e: any) {
      showErrorModal(`李⑥븸 ?뱀씤 ?ㅽ뙣: ${e.message}`);
    }
  };

  // ??紐⑤뱺 李⑥븸/?좎쬆 嫄?1?대┃ ?쇨큵 ?뱀씤
  const handleApproveAllMismatches = async () => {
    const mismatches = reconPairs.filter(p => p.matchStatus === 'MISMATCH' && p.systemDelivery);
    if (mismatches.length === 0) return;

    showToast(`湲덉븸 遺덉씪移?嫄?珥?${mismatches.length}嫄댁쓣 泥?뎄 湲덉븸?쇰줈 ?쇨큵 ?뱀씤 泥섎━?⑸땲??`);

    try {
      for (const pair of mismatches) {
        if (pair.systemDelivery) {
          await db.updateRow('deliveries', pair.systemDelivery.id, {
            finalCost: pair.excelCost,
            deliveryCost: pair.excelCost,
            reconciliationStatus: 'RECONCILED',
            memo: [pair.systemDelivery.memo, `[?좎쬆?쇨큵?뱀씤: ??{pair.excelCost.toLocaleString()} (${pair.surchargeReason || '?좎쬆'})]`].filter(Boolean).join(' | ')
          } as any);
        }
      }
      await db.awaitPendingWrites();
      refreshAllData();

      setReconPairs(prev => prev.map(p => {
        if (p.matchStatus === 'MISMATCH' && p.systemDelivery) {
          return {
            ...p,
            matchStatus: 'MATCHED',
            systemCost: p.excelCost,
            diffCost: 0,
            isReconciled: true
          };
        }
        return p;
      }));
      setReconNotificationMsg(`???좎쬆 諛?湲덉븸 遺덉씪移?${mismatches.length}嫄댁씠 ?쇨큵 ?뱀씤?섏뿀?듬땲??`);
    } catch (e: any) {
      showErrorModal(`?쇨큵 ?뱀씤 ?ㅻ쪟: ${e.message}`);
    }
  };

  // ?슟 ?묒? ?⑤룆 嫄??ㅼ껌援??쒖쇅 (諛섎젮 泥섎━?섏뿬 ?곕뱶???댁젣)
  const handleExcludeExcelOnly = (pairId: string) => {
    setReconPairs(prev => prev.map(p => {
      if (p.pairId === pairId) {
        const nextExcluded = !p.isExcluded;
        return {
          ...p,
          isExcluded: nextExcluded,
          isReconciled: nextExcluded ? true : false,
          matchStatus: nextExcluded ? 'EXCLUDED' : 'EXCEL_ONLY'
        };
      }
      return p;
    }));
  };

  // ???묒? ?⑤룆 嫄댁쓣 ?쒖뒪??諛곗감濡?利됱떆 ?앹꽦
  const handleCreateDeliveryFromExcel = async (pairId: string) => {
    const pair = reconPairs.find(p => p.pairId === pairId);
    if (!pair || !pair.excelRow) return;

    const row = pair.excelRow;
    const cost = pair.excelCost;
    const date = row['?뺢퇋?쇱옄'] || reconStartDate;
    const dest = row['?뺢퇋?섏감吏'] || row['?꾩옣紐?] || '誘멸린???꾩옣';
    const memo = row['鍮꾧퀬'] || '?묒? 嫄곕옒紐낆꽭??湲곕컲 ?먮룞 諛곗감 ?앹꽦';

    try {
      const newDelivId = `DEL-${date.replace(/-/g, '').slice(2)}-${Math.floor(100 + Math.random() * 900)}`;
      const newDeliv: any = {
        id: newDelivId,
        type: 'INBOUND',
        status: 'DELIVERED',
        requestDate: date,
        loadingDate: date,
        unloadingDate: date,
        destinationAddress: dest,
        transportCompany: selectedReconCompany === 'ALL' ? '湲고??댁넚' : selectedReconCompany,
        deliveryCost: cost,
        finalCost: cost,
        expectedCost: cost,
        isCostSettled: false,
        dispatchCategory: '?낃퀬',
        reconciliationStatus: 'RECONCILED',
        memo: `[紐낆꽭???먮룞?앹꽦] ${memo}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.insertRow('deliveries', newDeliv);

      setReconPairs(prev => prev.map(p => {
        if (p.pairId === pairId) {
          return {
            ...p,
            systemDelivery: newDeliv,
            systemCost: cost,
            diffCost: 0,
            matchStatus: 'MATCHED',
            isReconciled: true,
            memo: `?좉퇋 諛곗감 ?앹꽦 諛?????꾨즺 (${newDelivId})`
          };
        }
        return p;
      }));

      await db.awaitPendingWrites();
      await refreshAllData();
      setReconNotificationMsg(`???좉퇋 諛곗감(${newDelivId})媛 ?앹꽦?섍퀬 ????꾨즺?섏뿀?듬땲??`);
    } catch (e: any) {
      showErrorModal(`諛곗감 ?앹꽦 ?ㅽ뙣: ${e.message}`);
    }
  };

  // ?뮕 [?ъ옣??吏?? ?뮩 ????꾨즺 1嫄댁쓽 ?듯빀 留ㅼ엯 吏湲됱슂泥??앹꽦 (Payment Request Bundle)
  const handleExecuteBundlePaymentRequest = async () => {
    const excelPairs = reconPairs.filter(p => p.excelRow);

    if (excelPairs.length === 0) {
      showErrorModal('吏湲??붿껌???묒꽦?섎젮硫?癒쇱? ?곷떒??[?뱞 ?묒? 嫄곕옒紐낆꽭???낅줈??瑜?吏꾪뻾??二쇱꽭??');
      return;
    }

    // ?ㅻⅨ履??⑤꼸(嫄곕옒紐낆꽭???묒?) ??ぉ 以????誘몄셿猷뚭굔???덈뒗吏 寃??(諛섎젮/?쒖쇅 泥섎━??嫄댁? ?듦낵)
    const unreconciledExcelPairs = excelPairs.filter(p => !p.isReconciled && !p.isExcluded);

    if (unreconciledExcelPairs.length > 0) {
      showErrorModal(`?좑툘 ?낅줈?쒗븳 嫄곕옒紐낆꽭???묒? ??ぉ (${excelPairs.length}嫄? 以??꾩쭅 ????뱀씤?섏? ?딆? ??ぉ??${unreconciledExcelPairs.length}嫄??⑥븘?덉뼱 吏湲됱슂泥?쓣 ?묒꽦?????놁뒿?덈떎.\n\n遺덉씪移?嫄댁? [李⑥븸 ?뱀씤] ?먮뒗 [?ㅼ껌援??쒖쇅/諛섎젮]瑜?泥섎━??二쇱꽭??`);
      return;
    }

    const reconciledPairs = reconPairs.filter(p => p.isReconciled && p.systemDelivery && !p.isExcluded);

    const targetYm = reconStartDate ? reconStartDate.substring(0, 7) : new Date().toISOString().substring(0, 7);
    const bundleCode = `PAY-BUNDLE-${targetYm.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalBundleCost = reconciledPairs.reduce((acc, p) => acc + p.systemCost, 0);

    const targetCompany = transportCompanies.find(tc => tc.id === selectedReconCompany || tc.name === selectedReconCompany);
    const rawVendorName = targetCompany?.name || (selectedReconCompany !== 'ALL' ? selectedReconCompany : (reconciledPairs[0]?.systemDelivery?.transportCompany || '湲고? ?댁넚??));
    const nowIso = new Date().toISOString();

    try {
      // 1. ?붾쭚 留ㅼ엯 ?뺤궛 留덉뒪???덉퐫??(PurchaseSettlement) ?앹꽦
      const settlementId = db.generateNextId('purchaseSettlements', db.purchaseSettlements);
      const settlement = db.insertRow<PurchaseSettlement>('purchaseSettlements', {
        id: settlementId,
        settlementYm: targetYm,
        settlementType: 'TRANSPORT',
        vendorName: rawVendorName,
        totalAmount: totalBundleCost,
        paidAmount: 0,
        status: 'CONFIRMED',
        confirmedAt: nowIso,
        confirmedBy: currentUser?.name || '?댁넚??щ떞??,
        itemCount: reconciledPairs.length,
        memo: `[?댁넚猷?????꾧껐] ${bundleCode} | ${reconciledPairs.length}嫄?吏湲??붿껌`,
        createdAt: nowIso,
        updatedAt: nowIso
      });

      // 2. 1:1 留ㅼ묶 ?곸꽭 ??ぉ (PurchaseSettlementItem) ?앹꽦 諛?諛곗감(Delivery) ?덉퐫??媛깆떊
      for (const pair of reconciledPairs) {
        if (pair.systemDelivery) {
          db.insertRow<PurchaseSettlementItem>('purchaseSettlementItems', {
            settlementId: settlement.id,
            sourceType: 'DELIVERY',
            sourceId: pair.systemDelivery.id,
            itemDescription: `[諛곗감 ?대컲鍮? ${pair.systemDelivery.originAddress || '?곸감吏'} ??${pair.systemDelivery.destinationAddress || '?섏감吏'} (${pair.systemDelivery.driverName || '湲곗궗'}) [?붿껌:${bundleCode}]`,
            quantity: 1,
            unitPrice: pair.systemCost,
            amount: pair.systemCost,
            evidenceFileUrl: uploadedFileName || undefined,
            createdAt: nowIso
          });

          await db.updateRow('deliveries', pair.systemDelivery.id, {
            reconciliationStatus: 'PAYMENT_REQUESTED',
            paymentRequestedAt: nowIso,
            deliveryCostConfirmed: pair.systemCost,
            finalCost: pair.systemCost,
            purchaseBillId: settlement.id,
            memo: `[?듯빀吏湲됱슂泥? ${bundleCode}] ${pair.memo || pair.systemDelivery.memo || ''}`
          } as any);
        }
      }

      await db.awaitPendingWrites();
      refreshAllData();

      setReconPairs(prev => prev.map(p => {
        if (p.isReconciled && p.systemDelivery && !p.isExcluded) {
          return { ...p, matchStatus: 'PAYMENT_REQUESTED' as any };
        }
        return p;
      }));

      // ?뮕 [?ъ슜???몄씡] 吏湲??붿껌 ?꾨즺 利됱떆 吏湲됱긽???꾪꽣瑜?'PAID'濡??꾪솚?섏뿬 ?깅줉??嫄댁씠 ?붾㈃?먯꽌 利됱떆 ?뺤씤?섎룄濡?蹂댁옣
      setReconPaymentFilter('PAID');

      setReconNotificationMsg(`[?듯빀 吏湲됱슂泥??꾨즺] ?붿껌踰덊샇: ${bundleCode} (?뺤궛ID: ${settlement.id}) | 珥?${reconciledPairs.length}嫄?(?⑷퀎 ??{totalBundleCost.toLocaleString()}?? 留ㅼ엯 吏湲??붿껌??[?붾쭚 留ㅼ엯 ?뺤궛] ??μ뿉 ?깅줉?섏뿀?듬땲??`);
      setPaymentSuccessInfo({
        bundleCode,
        totalCount: reconciledPairs.length,
        totalAmount: totalBundleCost,
        companyName: rawVendorName,
        reconMonth: targetYm
      });
    } catch (err: any) {
      showErrorModal('吏湲??붿껌 泥섎━ 以??ㅻ쪟媛 諛쒖깮?섏??듬땲?? ' + err.message);
    }
  };

  // ????듦퀎 吏묎퀎
  const reconStats = useMemo(() => {
    const isPairMode = reconPairs.length > 0;
    
    if (isPairMode) {
      const excelPairs = reconPairs.filter(p => p.excelRow);
      let excelTotalCount = excelPairs.length;
      let excelTotalCost = excelPairs.reduce((acc, p) => acc + p.excelCost, 0);

      let matchedCount = reconPairs.filter(p => p.isReconciled && !p.isExcluded).length;
      let matchedCost = reconPairs.filter(p => p.isReconciled && !p.isExcluded).reduce((acc, p) => acc + p.systemCost, 0);
      let mismatchCount = reconPairs.filter(p => p.matchStatus === 'MISMATCH').length;
      let mismatchCost = reconPairs.filter(p => p.matchStatus === 'MISMATCH').reduce((acc, p) => acc + p.excelCost, 0);
      let excludedCount = reconPairs.filter(p => p.isExcluded).length;
      let excludedCost = reconPairs.filter(p => p.isExcluded).reduce((acc, p) => acc + p.excelCost, 0);
      let paymentRequestedCount = reconPairs.filter(p => p.matchStatus === 'PAYMENT_REQUESTED').length;
      let paymentRequestedCost = reconPairs.filter(p => p.matchStatus === 'PAYMENT_REQUESTED').reduce((acc, p) => acc + p.systemCost, 0);

      return {
        isPairMode: true,
        totalCount: excelTotalCount,
        totalCost: excelTotalCost,
        matchedCount,
        matchedCost,
        mismatchCount,
        mismatchCost,
        excludedCount,
        excludedCost,
        paymentRequestedCount,
        paymentRequestedCost,
        systemCount: completedDeliveriesForRecon.length
      };
    }

    const totalCount = completedDeliveriesForRecon.length;
    const totalCost = completedDeliveriesForRecon.reduce((acc, d) => {
      const cost = getEffectiveDeliveryCost(d);
      return acc + cost;
    }, 0);

    const paymentRequestedDeliveries = completedDeliveriesForRecon.filter(d => (d as any).reconciliationStatus === 'PAYMENT_REQUESTED');
    const matchedDeliveries = completedDeliveriesForRecon.filter(d => (d as any).reconciliationStatus === 'MATCHED' || (d as any).reconciliationStatus === 'RECONCILED');

    return {
      isPairMode: false,
      totalCount,
      totalCost,
      matchedCount: matchedDeliveries.length,
      matchedCost: matchedDeliveries.reduce((sum, d) => sum + getEffectiveDeliveryCost(d), 0),
      mismatchCount: 0,
      mismatchCost: 0,
      excludedCount: 0,
      excludedCost: 0,
      paymentRequestedCount: paymentRequestedDeliveries.length,
      paymentRequestedCost: paymentRequestedDeliveries.reduce((sum, d) => sum + getEffectiveDeliveryCost(d), 0),
      systemCount: totalCount
    };
  }, [reconPairs, completedDeliveriesForRecon]);


  // ?뮕 [?ъ옣??吏?? 嫄대퀎 ????꾨즺 ?좉? 諛?[?⑼툘 ???痍⑥냼 (?湲??먮났)] 湲곕뒫 (湲덉븸 ?곸씠 ?????嫄곗젅)
  const handleTogglePairReconciled = (pairId: string) => {
    const targetPair = reconPairs.find(p => p.pairId === pairId);
    if (!targetPair) return;

    if (!targetPair.isReconciled) {
      // ????꾨즺 ?꾪솚 ??湲덉븸 寃利?
      if (targetPair.diffCost !== 0 || targetPair.systemCost !== targetPair.excelCost) {
        showErrorModal(`?좑툘 [???泥섎━ 嫄곗젅]\n\n??醫뚯륫 ?쒖뒪??湲덉븸: ??{targetPair.systemCost.toLocaleString()}??n???곗륫 ?묒? 泥?뎄湲덉븸: ??{targetPair.excelCost.toLocaleString()}??n??李⑥븸: ??{Math.abs(targetPair.diffCost).toLocaleString()}??n\n醫뚯륫怨??곗륫??湲덉븸???곸씠????ぉ? ???泥섎━媛 遺덇??ν빀?덈떎.`);
        return;
      }
    }

    setReconPairs(prev => prev.map(p => {
      if (p.pairId === pairId) {
        const nextReconciled = !p.isReconciled;
        return {
          ...p,
          isReconciled: nextReconciled,
          matchStatus: nextReconciled ? 'MATCHED' : (p.diffCost !== 0 ? 'MISMATCH' : 'PENDING'),
          memo: nextReconciled ? '?대떦???섎룞 ????꾨즺' : '???痍⑥냼??(?湲??먮났)'
        };
      }
      return p;
    }));
  };

  // ?좏깮嫄??쇨큵 ????꾨즺 (湲덉븸 ?곸씠嫄????嫄곗젅)
  const handleBatchReconcilePairs = () => {
    if (selectedPairIds.size === 0) {
      showErrorModal('????꾨즺 泥섎━????ぉ??1嫄??댁긽 泥댄겕??二쇱꽭??');
      return;
    }

    let rejectedCount = 0;
    let successCount = 0;

    setReconPairs(prev => prev.map(p => {
      if (selectedPairIds.has(p.pairId)) {
        if (p.diffCost !== 0 || p.systemCost !== p.excelCost) {
          rejectedCount++;
          return p; // 湲덉븸 ?곸씠 ??ぉ? ???泥섎━ 嫄곗젅 (?곹깭 ?좎?)
        }
        successCount++;
        return { ...p, isReconciled: true, matchStatus: 'MATCHED', memo: '?좏깮 ??ぉ ?쇨큵 ????꾨즺' };
      }
      return p;
    }));

    setSelectedPairIds(new Set());

    if (rejectedCount > 0) {
      showErrorModal(`?좑툘 ?좏깮????ぉ 以?${rejectedCount}嫄댁? 醫???湲덉븸???곸씠?섏뿬 ???泥섎━媛 嫄곗젅?섏뿀?듬땲??\n\n(湲덉븸???쇱튂?섎뒗 ${successCount}嫄대쭔 ????꾨즺 泥섎━?섏뿀?듬땲??)`);
    } else if (successCount > 0) {
      setReconNotificationMsg(`???좏깮??Pair ??ぉ ${successCount}嫄댁씠 ????꾨즺(MATCHED)濡??꾪솚?섏뿀?듬땲??`);
    }
  };

  // ?뮕 [?ъ옣??吏?? ?좏깮嫄??쇨큵 ???痍⑥냼 (?湲??먮났)
  const handleBatchCancelReconcilePairs = () => {
    if (selectedPairIds.size === 0) {
      showErrorModal('??щ? 痍⑥냼????ぉ??1嫄??댁긽 泥댄겕??二쇱꽭??');
      return;
    }
    setReconPairs(prev => prev.map(p => {
      if (selectedPairIds.has(p.pairId)) {
        return { ...p, isReconciled: false, matchStatus: 'PENDING', memo: '?쇨큵 ???痍⑥냼 (?湲??먮났)' };
      }
      return p;
    }));
    setSelectedPairIds(new Set());
    setReconNotificationMsg(`?⑼툘 ?좏깮??Pair ??ぉ?ㅼ씠 ????湲?PENDING) ?곹깭濡??먮났?섏뿀?듬땲??`);
  };

  // ?묒? ?낅줈?????쒖뒪??誘몃벑濡?泥?뎄 ??ぉ 諛곗뿴
  const unmatchedExcelRows = useMemo(() => {
    return reconPairs
      .filter(p => p.matchStatus === 'EXCEL_ONLY' && p.excelRow)
      .map(p => p.excelRow);
  }, [reconPairs]);

  // ?묒? ?대낫?닿린 ?ㅼ슫濡쒕뱶
  const handleExportReconciliationReport = () => {
    if (reconPairs.length === 0 && completedDeliveriesForRecon.length === 0) {
      showErrorModal('?대낫??????댁뿭???놁뒿?덈떎.');
      return;
    }

    const exportRows = reconPairs.length > 0
      ? reconPairs.map((p, i) => {
          const sysD = p.systemDelivery;
          const contract = sysD ? contracts.find(c => c.id === sysD.contractId) : null;
          const customer = contract ? customers.find(c => c.id === contract.customerId) : null;

          return {
            '?쒕쾲': i + 1,
            '????곹깭': p.isExcluded ? '諛섎젮(?쒖쇅)' : p.isReconciled ? '??ъ셿猷??뺤젙)' : p.matchStatus === 'MISMATCH' ? '湲덉븸遺덉씪移??좎쬆)' : p.matchStatus === 'EXCEL_ONLY' ? '?묒??⑤룆' : p.matchStatus === 'SYSTEM_ONLY' ? '?쒖뒪?쒕떒?? : '??щ?湲?,
            '?쒖뒪??諛곗감ID': sysD?.id || '誘몄〈??,
            '?댁넚?쇱옄': sysD?.loadingDate || sysD?.requestDate || p.excelRow?.['?댁넚?쇱옄'] || p.excelRow?.['?좎쭨'] || '',
            '?댁넚 嫄곕옒泥?: sysD?.transportCompany || sysD?.assignedVehicles?.[0]?.transportCompany || '?먯궗諛곗감',
            '怨좉컼???꾩옣': customer?.name ? `${customer.name} (${sysD?.destinationAddress || ''})` : p.excelRow?.['?섏감吏'] || p.excelRow?.['?꾩갑吏'] || '',
            '?댁넚 湲곗궗紐?: sysD?.driverName || p.excelRow?.['湲곗궗紐?] || p.excelRow?.['?댁넚湲곗궗'] || '',
            '?쒖뒪???댁넚鍮???': p.systemCost,
            '?묒? 泥?뎄????': p.excelCost,
            '李⑥븸(??': p.diffCost,
            '?좎쬆 ?ъ쑀': p.surchargeReason || '',
            '鍮꾧퀬 / ?뱀씠?ы빆': p.memo || ''
          };
        })
      : completedDeliveriesForRecon.map((d, i) => {
          const contract = contracts.find(c => c.id === d.contractId);
          const customer = contract ? customers.find(c => c.id === contract.customerId) : null;
          const cost = getEffectiveDeliveryCost(d);

          return {
            '?쒕쾲': i + 1,
            '諛곗감ID': d.id,
            '?댁넚?쇱옄': d.loadingDate || d.requestDate,
            '?댁넚 嫄곕옒泥?: d.transportCompany || d.assignedVehicles?.[0]?.transportCompany || '?먯궗諛곗감',
            '怨좉컼?щ챸': customer?.name || '誘몄???,
            '?꾩갑吏(?꾩옣)': d.destinationAddress || '',
            '?댁넚 湲곗궗紐?: d.driverName || '湲곗궗誘몄???,
            '李⑥쥌': d.vehicleType || '3.5T',
            '?쒖뒪???댁넚鍮???': cost,
            '?묒? 泥?뎄????': cost,
            '李⑥븸(??': 0,
            '????곹깭': (d as any).reconciliationStatus === 'PAYMENT_REQUESTED' ? '吏湲됱슂泥?셿猷? : '??щ?湲?,
            '鍮꾧퀬 / ?뱀씠?ы빆': d.memo || ''
          };
        });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '?붾쭚_?댁넚猷?1to1??щ궡??);
    XLSX.writeFile(workbook, `?붾쭚_?댁넚猷?1to1??щ궡??${reconStartDate}_${reconEndDate}.xlsx`);
  };

  // ?묒? ?쒗뵆由??ㅼ슫濡쒕뱶
  const handleDownloadExcelTemplate = () => {
    const templateData = [
      { '諛곗감ID': 'DLV-0000001', '?댁넚?쇱옄': '2026-07-28', '?댁넚湲곗궗': '源湲곗궗', '泥?뎄湲덉븸': 70000, '鍮꾧퀬': '?묓샇' },
      { '諛곗감ID': 'DLV-0000002', '?댁넚?쇱옄': '2026-07-28', '?댁넚湲곗궗': '?닿린??, '泥?뎄湲덉븸': 85000, '鍮꾧퀬': '?뱀씠?ы빆 ?놁쓬' }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '嫄곕옒紐낆꽭???묒떇');
    XLSX.writeFile(wb, '?붾쭚_?댁넚猷????嫄곕옒紐낆꽭???묒떇.xlsx');
  };


  // 2. 諛곗감嫄??뺣? ?꾪꽣留?(?곹깭 4?④퀎 + ?붿껌/?댁넚??湲곌컙 ?쇱빱 + 寃?됱뼱)
  const filteredDeliveries = useMemo(() => {
    const list = deliveries.filter(d => {
      const dStatus = getNormalizedDeliveryStatus(d);
      if (activeDispatchStatusTab !== 'ALL' && dStatus !== activeDispatchStatusTab) return false;

      const dDate = d.loadingDate || d.requestDate || d.scheduledDate || d.createdAt?.substring(0, 10);
      if (startDate && dDate && dDate < startDate) return false;
      if (endDate && dDate && dDate > endDate) return false;

      if (!searchQuery || !searchQuery.trim()) return true;
      const q = searchQuery.trim();
      const contract = getContract(d.contractId);
      const customer = contract ? getCustomer(contract.customerId) : null;

      return (
        (d.id && d.id.toLowerCase().includes(q.toLowerCase())) ||
        (d.driverName && matchHangul(d.driverName, q)) ||
        (d.destinationAddress && matchHangul(d.destinationAddress, q)) ||
        (contract && contract.contractNo.toLowerCase().includes(q.toLowerCase())) ||
        (customer && matchHangul(customer.name, q))
      );
    });

    // 理쒖떊 ?깅줉??(createdAt ?대┝李⑥닚, ?놁쑝硫?loadingDate/requestDate ?대┝李⑥닚) ?뺣젹
    return list.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      const dateA = a.loadingDate || a.requestDate || '';
      const dateB = b.loadingDate || b.requestDate || '';
      return dateB.localeCompare(dateA);
    });
  }, [deliveries, activeDispatchStatusTab, startDate, endDate, searchQuery, contracts, customers]);

  // ?뮕 諛곗감 ?꾨즺 ?곹깭?먯꽌 ?섏젙???꾪빐 ?꾩떆 ?좉툑 ?댁젣(Unlock)?섎뒗 紐⑤뱶 state
  const [isEditUnlocked, setIsEditUnlocked] = useState<boolean>(false);

  const handleSelectDelivery = (d: Delivery) => {
    const todayStr = new Date().toISOString().split('T')[0];
    setSelectedDelivery(d);
    setIsEditUnlocked(false); // ?뮕 ?덈줈 ?좏깮 ??湲곕낯 ?좉툑(readOnly) ?곸슜!

    let defaultCat: '異쒓퀬' | '?낃퀬' | '諛섎궔' | '?뺣퉬' | '?대룞' | '援먰솚' = d.dispatchCategory || (d.type === 'EXCHANGE' ? '援먰솚' : d.type === 'OUTBOUND' ? '異쒓퀬' : d.type === 'RETURN' || d.type === 'INBOUND' ? '諛섎궔' : '異쒓퀬');
    setDispatchCategory(defaultCat);

    setLoadingDate(d.loadingDate || todayStr);
    const lSlot = d.loadingTimeSlot || '?ㅼ쟾';
    if (lSlot !== '?ㅼ쟾' && lSlot !== '?ㅽ썑') {
      setLoadingTimeSlot('?щ쭩?쒓컙');
      setLoadingCustomTime(lSlot);
    } else {
      setLoadingTimeSlot(lSlot);
      setLoadingCustomTime('');
    }

    setUnloadingDate(d.unloadingDate || todayStr);
    const uSlot = d.unloadingTimeSlot || '?ㅼ쟾';
    if (uSlot !== '?ㅼ쟾' && uSlot !== '?ㅽ썑') {
      setUnloadingTimeSlot('?щ쭩?쒓컙');
      setUnloadingCustomTime(uSlot);
    } else {
      setUnloadingTimeSlot(uSlot);
      setUnloadingCustomTime('');
    }

    setClosingMemo(d.closingMemo || '');
    setScheduledDate(d.scheduledDate || todayStr);
    setOriginAddress(d.originAddress || '?뱀궗 蹂닿???);

    const contract = getContract(d.contractId);
    const cust = contract ? getCustomer(contract.customerId) : null;
    setDestinationAddress(d.destinationAddress || (cust ? `${cust.name} ?꾩옣` : ''));

    setBillableToCust(d.billableToCustomer || false);
    setBillableCustId(d.billableCustomerId || (contract?.customerId || ''));

    if (d.vehicles) {
      try {
        const parsed = JSON.parse(d.vehicles);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAssignedVehicles(parsed);
          return;
        }
      } catch (e) {}
    }

    setAssignedVehicles([{
      id: 'v-' + Date.now(),
      transportCompany: d.transportCompany || '',
      vehicleType: d.vehicleType || '3.5T',
      vehicleNo: d.vehicleNo || '',
      driverName: d.driverName || '',
      driverContact: d.driverContact || '',
      expectedCost: getEffectiveDeliveryCost(d),
      finalCost: d.finalCost !== undefined && d.finalCost !== null ? d.finalCost : 0,
      deliveryCost: getEffectiveDeliveryCost(d)
    }]);
  };

  const handleVehicleFieldChange = (index: number, field: keyof AssignedVehicleRow, value: any) => {
    setAssignedVehicles(prev => {
      const updated = [...prev];
      let sanitizedValue = value;
      if (field === 'expectedCost' || field === 'finalCost' || field === 'deliveryCost') {
        sanitizedValue = Math.max(0, Number(value) || 0);
      }
      updated[index] = { ...updated[index], [field]: sanitizedValue };

      // 湲곗궗 ?좏깮 ???곕씫泥? 李⑤웾踰덊샇, 李⑥쥌(?ㅼ닔) 諛??댁넚???먮룞 留ㅽ븨
      if (field === 'driverName' && value) {
        const driverMatch = transportDrivers.find(d => d.driverName.trim() === value.trim());
        if (driverMatch) {
          if (driverMatch.driverContact) updated[index].driverContact = driverMatch.driverContact;
          if (driverMatch.vehicleNo) updated[index].vehicleNo = driverMatch.vehicleNo;
          if (driverMatch.vehicleType) updated[index].vehicleType = driverMatch.vehicleType;
          const comp = transportCompanies.find(c => c.id === driverMatch.companyId);
          if (comp) updated[index].transportCompany = comp.name;
        }
      }
      return updated;
    });
  };

  const handleAddVehicleRow = () => {
    setAssignedVehicles(prev => [
      ...prev,
      {
        id: 'v-' + Date.now(),
        transportCompany: '',
        vehicleType: '3.5T',
        vehicleNo: '',
        driverName: '',
        driverContact: '',
        expectedCost: 0,
        finalCost: 0,
        deliveryCost: 0
      }
    ]);
  };

  const handleRemoveVehicleRow = (index: number) => {
    if (assignedVehicles.length <= 1) return;
    setAssignedVehicles(prev => prev.filter((_, i) => i !== index));
  };

  // ?벒 湲곗궗 諛곗감 ?덈궡 臾몄옄 諛쒖넚 / ?대┰蹂대뱶 蹂듭궗
  const handleSendDriverSms = (targetDelivery: Delivery) => {
    const mainVeh = assignedVehicles.find(v => v.driverContact && v.driverContact.trim()) || assignedVehicles[0];
    const contact = mainVeh?.driverContact || targetDelivery.driverContact;
    const name = mainVeh?.driverName || targetDelivery.driverName;
    const vNo = mainVeh?.vehicleNo || targetDelivery.vehicleNo;
    const vType = mainVeh?.vehicleType || targetDelivery.vehicleType;
    const cost = (mainVeh?.finalCost && mainVeh.finalCost > 0 ? mainVeh.finalCost : mainVeh?.expectedCost) || targetDelivery.finalCost || targetDelivery.deliveryCost;

    if (!contact || !contact.trim()) {
      showErrorModal('湲곗궗 ?곕씫泥섍? ?깅줉?섏? ?딆븯?듬땲?? 李⑤웾/湲곗궗 諛곗젙 ???湲곗궗 ?곕씫泥섎? ?낅젰??二쇱꽭??');
      return;
    }

    const contract = contracts.find(c => c.id === targetDelivery.contractId);
    const customer = customers.find(c => c.id === contract?.customerId || c.id === targetDelivery.billableCustomerId);
    const site = sites.find(s => s.id === contract?.siteId || (targetDelivery.destinationAddress && s.name.includes(targetDelivery.destinationAddress)));

    const dObj = {
      ...targetDelivery,
      driverName: name,
      driverContact: contact,
      vehicleNo: vNo,
      vehicleType: vType,
      finalCost: cost,
      destinationAddress: destinationAddress || targetDelivery.destinationAddress,
      originAddress: originAddress || targetDelivery.originAddress,
      loadingDate: loadingDate || targetDelivery.loadingDate,
      loadingTimeSlot: (loadingTimeSlot === '?щ쭩?쒓컙' ? loadingCustomTime : loadingTimeSlot) || targetDelivery.loadingTimeSlot,
      memo: closingMemo || targetDelivery.memo
    };

    const defaultYard = currentTenant?.yards?.find(y => y.isDefault) || currentTenant?.yards?.[0];
    const hqYardAddress = defaultYard?.address || currentTenant?.mainYardAddress || currentTenant?.businessAddress || '蹂몄궗 二쇨린??;
    const hqYardPhone = currentTenant?.tel || '諛곗감/異쒓퀬?';
    const companyName = currentTenant?.displayName || currentTenant?.tradeName || currentTenant?.corporateName || '湲곗뿰由ы봽??;

    const smsBody = buildDispatchSmsText({
      delivery: dObj,
      siteName: site?.name || targetDelivery.destinationAddress,
      siteAddress: targetDelivery.destinationAddress || site?.address,
      siteContactName: site?.contactName,
      siteContactPhone: site?.contact,
      customerName: customer?.name,
      companyName,
      hqYardAddress,
      hqYardPhone,
    });

    launchDispatchSms({
      driverContact: contact,
      smsBody
    });
  };

  // 3. 諛곗감 諛곗젙 ???(status: 'DISPATCHED' 諛곗감 ?꾨즺 ?꾪솚!)
  const handleSaveDispatch = async () => {
    if (!selectedDelivery) return;
    if (!canSave) {
      showErrorModal('諛곗감 ?섏젙 沅뚰븳???놁뒿?덈떎.');
      return;
    }

    // ?슚 異쒓퀬 ?쒗븳(BLOCKED) 嫄곕옒泥?異쒓퀬 諛곗감 ?먯쿇 李⑤떒
    const targetContract = selectedDelivery.contractId ? contracts.find(c => c.id === selectedDelivery.contractId) : null;
    const targetCustomer = targetContract ? customers.find(c => c.id === targetContract.customerId) : null;
    const isOutboundOrExchange = selectedDelivery.type === 'OUTBOUND' || selectedDelivery.dispatchCategory === '異쒓퀬' || selectedDelivery.dispatchCategory === '援먰솚';
    if (isOutboundOrExchange && targetCustomer?.transactionStatus === 'BLOCKED') {
      showErrorModal(`[異쒓퀬?쒗븳] 嫄곕옒泥?[${targetCustomer.name}]?(?? ?곗껜 愿由??먮뒗 寃쎌쁺吏?吏?쒕줈 ?명빐 ?좉퇋 異쒓퀬媛 李⑤떒???곹깭?낅땲?? 諛곗감 湲곗궗瑜?諛곗젙?????놁뒿?덈떎.`, '異쒓퀬 李⑤떒');
      return;
    }

    // ?좑툘 異쒓퀬 ?섎ː媛 諛섎젮???곹깭?몄? 寃??諛??덈갑??寃쎄퀬 ?뚮┝!
    const inspStatus = getOutboundInspectionStatus(selectedDelivery.contractId);
    if (inspStatus === 'REJECTED') {
      showToast('異쒓퀬 寃??諛섎젮 ?대젰???덈뒗 ?섎ː嫄댁쓽 諛곗감 湲곗궗 諛곗젙??吏꾪뻾?⑸땲??', 'warning');
    }

    try {
      const finalLoadingSlot = loadingTimeSlot === '?щ쭩?쒓컙' ? loadingCustomTime : loadingTimeSlot;
      const finalUnloadingSlot = unloadingTimeSlot === '?щ쭩?쒓컙' ? unloadingCustomTime : unloadingTimeSlot;
      const totalExpectedCost = assignedVehicles.reduce((sum, v) => sum + (Number(v.expectedCost) || 0), 0);
      const totalFinalCost = assignedVehicles.reduce((sum, v) => sum + (Number(v.finalCost) || 0), 0);

      const mainVeh = assignedVehicles[0] || {};
      const payload: Partial<Delivery> = {
        status: 'DISPATCHED',
        dispatchCategory: dispatchCategory,
        loadingDate: loadingDate,
        loadingTimeSlot: finalLoadingSlot,
        unloadingDate: unloadingDate,
        unloadingTimeSlot: finalUnloadingSlot,
        scheduledDate: scheduledDate || loadingDate,
        originAddress: originAddress,
        destinationAddress: destinationAddress,
        billableToCustomer: billableToCust,
        billableCustomerId: billableCustId,
        transportCompany: mainVeh.transportCompany || '',
        vehicleType: mainVeh.vehicleType || '3.5T',
        vehicleNo: mainVeh.vehicleNo || '',
        driverName: mainVeh.driverName || '',
        driverContact: mainVeh.driverContact || '',
        expectedCost: totalExpectedCost,
        finalCost: totalFinalCost,
        deliveryCost: totalFinalCost || totalExpectedCost,
        vehicles: JSON.stringify(assignedVehicles),
        closingMemo: closingMemo,
        memo: selectedDelivery.memo || closingMemo,
        updatedAt: new Date().toISOString()
      };

      db.updateRow<Delivery>('deliveries', selectedDelivery.id, payload);
      await db.awaitPendingWrites();

      // [?낅Т ?멸퀎 ?뚯씠?꾨씪?? ?좏뻾 諛곗감 ?섎ː ToDo ?먮룞 ?곴퀎
      await clearHandoverTasks({
        entityId: selectedDelivery.id,
        category: 'DISPATCH_REQUEST',
        completedByUserId: currentUser?.id,
        completedByName: currentUser?.name,
        completionAction: 'DISPATCH_ASSIGNED'
      });

      const curContract = selectedDelivery.contractId ? contracts.find(c => c.id === selectedDelivery.contractId) : null;
      const curCust = curContract ? customers.find(c => c.id === curContract.customerId)?.name : '';
      const curSite = curContract ? sites.find(s => s.id === curContract.siteId)?.name : '';

      // [?낅Т ?멸퀎 ?뚯씠?꾨씪?? 異쒓퀬 嫄댁씤 寃쎌슦 二쇨린??PDI 寃??ToDo ?꾩냽 諛쒗뻾
      if (selectedDelivery.type === 'OUTBOUND') {
        await issueHandoverTask({
          category: 'OUTBOUND_PDI_INSPECTION',
          title: `[異쒓퀬 PDI 寃???붾쭩] ${curCust || '怨좉컼??} (${mainVeh.driverName || '湲곗궗'} 諛곗젙)`,
          content: `李⑤웾 諛곗젙 ?꾨즺 (${mainVeh.driverName || '湲곗궗'}, ${mainVeh.vehicleNo || '李⑤웾踰덊샇'}). ?곸감 ??PDI 湲곕뒫寃?섎? ?꾨즺??二쇱떗?쒖삤.`,
          targetDept: 'YARD',
          priority: 'HIGH',
          actionUrl: '/admin/outbound_inspections',
          entityType: 'DELIVERY',
          entityId: selectedDelivery.id,
          senderId: currentUser?.id,
          senderName: currentUser?.name
        });
      }

      broadcastWorkNotification({
        type: 'DISPATCH',
        title: '諛곗감 ?꾨즺 ?덈궡',
        body: `${curCust || '?꾩옣'} (${curSite || '諛곗감'}) ${mainVeh.driverName || '湲곗궗'} (${mainVeh.vehicleType || '李⑤웾'}) 諛곗젙 ?꾨즺`,
        url: '/admin/dispatch',
        targetDepts: ['SALES', 'YARD', 'ADMIN', 'EXECUTIVE']
      }).catch(console.warn);

      refreshAllData();
      showToast('諛곗감 湲곗궗 諛곗젙 ?꾨즺 (?곹깭: 諛곗감 ?꾨즺)');
      setSelectedDelivery(null);
    } catch (err: any) {
      showErrorModal(`?좑툘 諛곗감 ????ㅽ뙣:\n${err?.message || err}`);
    }
  };

  // 4. ?댁넚 ?꾨즺 泥섎━ (status: 'DELIVERED')
  const handleCompleteDeliveryStatus = async (deliveryId: string) => {
    if (!canSave) return;

    const targetDelivery = deliveries.find(d => d.id === deliveryId);
    if (targetDelivery) {
      const inspStatus = getOutboundInspectionStatus(targetDelivery.contractId);
      if (inspStatus === 'REJECTED') {
        showToast('異쒓퀬 寃??諛섎젮 ?대젰???덈뒗 ?섎ː嫄댁쓽 ?댁넚 ?꾨즺 留덇컧??吏꾪뻾?⑸땲??', 'warning');
      }
    }

    try {
      const isSimpleTransit = targetDelivery?.type === 'INBOUND'
        || targetDelivery?.type === 'MOVEMENT'
        || targetDelivery?.dispatchCategory === '?낃퀬'
        || targetDelivery?.dispatchCategory === '諛섎궔'
        || targetDelivery?.dispatchCategory === '?대룞';

      if (isSimpleTransit) {
        // [?뚯옣 1.3] INBOUND/MOVEMENT 諛곗감 ?꾨즺 = 諛곗감 ?곹깭留?DELIVERED濡?湲곕줉.
        // ?먯궛 ?곹깭(RENTED ??AVAILABLE) ?꾪솚? ?낃퀬寃???붾㈃?먯꽌留??섑뻾?쒕떎.
        // completeInboundDelivery瑜??ш린???몄텧?섏? ?딅뒗??
        db.updateRow<Delivery>('deliveries', deliveryId, {
          status: 'DELIVERED',
          updatedAt: new Date().toISOString()
        });
        await db.awaitPendingWrites();
      } else {
        // OUTBOUND / EXCHANGE: completeDelivery ??異쒓퀬 ?대젰 異붽? + 怨꾩빟 ACTIVE ?꾪솚.
        // ?먯궛 ?곹깭??蹂寃쏀븯吏 ?딆쓬 (異쒓퀬 寃???뱀씤 ?쒖젏??RENTED ?꾪솚 ???뚯옣 1.3).
        await completeDelivery(deliveryId);
        await db.awaitPendingWrites();
      }

      // [?낅Т ?멸퀎 ?뚯씠?꾨씪?? ?댁넚 愿??ToDo ?곴퀎
      await clearHandoverTasks({
        entityId: deliveryId,
        completionAction: 'DELIVERED',
        completedByUserId: currentUser?.id,
        completedByName: currentUser?.name
      });

      // [?낅Т ?멸퀎 ?뚯씠?꾨씪?? ?곸뾽?대떦?먯뿉寃??꾩옣 ?꾩갑 ?꾨즺 ToDo 諛쒗뻾
      const targetContract = targetDelivery?.contractId ? contracts.find(c => c.id === targetDelivery.contractId) : null;
      await issueHandoverTask({
        category: 'SITE_ARRIVAL_CONFIRM',
        title: `[?꾩옣 ?꾩갑 ?꾨즺] ${targetDelivery?.destinationAddress || '?꾩옣'} ?섏감 ?덉갑`,
        content: `?λ퉬媛 ?꾩옣???꾩갑?섏뿬 ?섏감媛 ?꾨즺?섏뿀?듬땲?? 怨좉컼 ?몄닔利??섎졊 諛?媛??媛쒖떆瑜??뺤씤?섏떗?쒖삤.`,
        targetDept: 'SALES',
        assignedUserId: targetContract?.salespersonId,
        priority: 'HIGH',
        actionUrl: '/admin/contract',
        entityType: 'DELIVERY',
        entityId: deliveryId,
        senderId: currentUser?.id,
        senderName: currentUser?.name
      });

      refreshAllData();
      showToast('?댁넚???꾨즺 留덇컧?섏뿀?듬땲?? (?댁넚 ?꾨즺)');
      setSelectedDelivery(null);
    } catch (err: any) {
      showErrorModal(`?좑툘 ?댁넚 ?꾨즺 泥섎━ ?ㅽ뙣:\n${err?.message || err}`);
    }
  };

  // 5. 諛곗감 痍⑥냼 泥섎━ (status: 'CANCELLED')
  const handleCancelDeliveryStatus = async (deliveryId: string) => {
    if (!canSave) return;
    
    try {
      db.updateRow<Delivery>('deliveries', deliveryId, {
        status: 'CANCELLED',
        updatedAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();

      // [?낅Т ?멸퀎 ?뚯씠?꾨씪?? 諛곗감 痍⑥냼 ??愿??ToDo ?먮룞 ?곴퀎
      await clearHandoverTasks({
        entityId: deliveryId,
        completionAction: 'CANCELLED',
        completedByUserId: currentUser?.id,
        completedByName: currentUser?.name
      });

      refreshAllData();
      showToast('諛곗감媛 痍⑥냼?섏뿀?듬땲?? (諛곗감 痍⑥냼)');
      setSelectedDelivery(null);
    } catch (err: any) {
      showErrorModal(`?좑툘 諛곗감 痍⑥냼 泥섎━ ?ㅽ뙣:\n${err?.message || err}`);
    }
  };

  const handleSaveManualDispatch = async () => {
    if (!manualOrigin || !manualDestination) {
      showErrorModal('?곸감吏(異쒕컻吏)? ?섏감吏(?꾩갑吏)瑜??묒꽦??二쇱꽭??');
      return;
    }

    if (manualCategory === '異쒓퀬' || manualCategory === '援먰솚') {
      const targetCust = customers.find(c => c.id === manualCustomerId || (manualContractId && contracts.find(ct => ct.id === manualContractId)?.customerId === c.id));
      if (targetCust?.transactionStatus === 'BLOCKED') {
        showErrorModal(`[異쒓퀬?쒗븳] 嫄곕옒泥?[${targetCust.name}]?(?? ?좉퇋 ?λ퉬 異쒓퀬媛 李⑤떒???곹깭?낅땲?? ?좉퇋 異쒓퀬 諛곗감瑜??앹꽦?????놁뒿?덈떎.`, '異쒓퀬 李⑤떒');
        return;
      }
    }

    try {
      const finalLoadingSlot = manualLoadingTimeSlot === '?щ쭩?쒓컙' ? manualLoadingCustomTime : manualLoadingTimeSlot;
      const finalUnloadingSlot = manualUnloadingTimeSlot === '?щ쭩?쒓컙' ? manualUnloadingCustomTime : manualUnloadingTimeSlot;
      const nowIso = new Date().toISOString();

      db.insertRow<Delivery>('deliveries', {
        type: manualCategory === '異쒓퀬' ? 'OUTBOUND' : manualCategory === '援먰솚' ? 'EXCHANGE' : manualCategory === '?대룞' ? 'MOVEMENT' : manualCategory === '諛섎궔' ? 'RETURN' : 'INBOUND',
        status: 'PENDING',
        dispatchCategory: manualCategory,
        contractId: manualContractId || undefined,
        requestDate: manualLoadingDate,
        scheduledDate: manualLoadingDate,
        loadingDate: manualLoadingDate,
        loadingTimeSlot: finalLoadingSlot,
        unloadingDate: manualUnloadingDate,
        unloadingTimeSlot: finalUnloadingSlot,
        originAddress: manualOrigin,
        destinationAddress: manualDestination,
        deliveryCost: manualExpectedCost,
        expectedCost: manualExpectedCost,
        finalCost: manualExpectedCost,
        billableToCustomer: manualBillable,
        billableCustomerId: manualCustomerId || undefined,
        isCostSettled: false,
        memo: manualMemo || manualClosingMemo,
        closingMemo: manualClosingMemo || manualMemo,
        vehicleRequirements: JSON.stringify(manualVehicles),
        cargoItems: JSON.stringify(manualCargos),
        createdAt: nowIso,
        updatedAt: nowIso
      });

      await db.awaitPendingWrites();
      refreshAllData();
      showToast('?좉퇋 諛곗감嫄댁씠 ?앹꽦?섏뿀?듬땲??');
      setShowManualModal(false);
    } catch (err: any) {
      showErrorModal(`?좑툘 ?섎룞 諛곗감 ?앹꽦 ?ㅽ뙣:\n${err?.message || err}`);
    }
  };


  const getDeliveryStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
      case 'REQUESTED':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> ?윞 諛곗감 ??(?湲?</span>;
      case 'DISPATCHED':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(59,130,246,0.15)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Truck size={12} /> ?뵷 諛곗감 ?꾨즺 (湲곗궗諛곗젙)</span>;
      case 'DELIVERED':
      case 'COMPLETED':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> ?윟 ?댁넚 ?꾨즺</span>;
      case 'CANCELLED':
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(239,68,68,0.15)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><XCircle size={12} /> ?뵶 諛곗감 痍⑥냼</span>;
      default:
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, backgroundColor: 'rgba(148,163,184,0.15)', color: 'var(--text-muted)' }}>誘몄???/span>;
    }
  };

  const handleExportDispatchExcel = () => {
    if (filteredDeliveries.length === 0) {
      showToast('?대낫??諛곗감 ?곗씠?곌? ?놁뒿?덈떎.', 'warning');
      return;
    }
    const rows = filteredDeliveries.map((d, index) => {
      const contract = getContract(d.contractId);
      const customer = contract ? getCustomer(contract.customerId) : null;
      const site = sites.find(s => s.id === contract?.siteId);
      const cargoItems = parseCargoItems(d);
      const cargoStr = cargoItems.map(c => `${c.modelName} ${c.count}?`).join(', ') || (d as any).equipmentSummary || '-';
      const normStatus = getNormalizedDeliveryStatus(d);
      const statusLabel = normStatus === 'PENDING' ? '諛곗감?湲?
        : normStatus === 'DISPATCHED' ? '諛곗감?꾨즺'
        : normStatus === 'DELIVERED' ? '?댁넚?꾨즺'
        : normStatus === 'CANCELLED' ? '諛곗감痍⑥냼' : normStatus;
      const effCost = getEffectiveDeliveryCost(d);
      
      return {
        'No': index + 1,
        '諛곗감踰덊샇': d.id,
        '援щ텇': d.dispatchCategory || d.type || '異쒓퀬',
        '?곹깭': statusLabel,
        '?붿껌?쇱옄': d.requestDate || '-',
        '諛곗감(?곸감)??: d.loadingDate || d.scheduledDate || '-',
        '?섏감(?꾩갑)??: d.unloadingDate || '-',
        '怨꾩빟踰덊샇': contract?.contractNo || '-',
        '怨좉컼??: customer?.name || (d as any).customerName || '-',
        '?꾩옣紐?: site?.name || (d as any).siteName || '-',
        '?댁넚?λ퉬': cargoStr,
        '異쒕컻吏(?곸감吏)': d.originAddress || '?뱀궗 蹂닿???,
        '?꾩갑吏(?섏감吏)': d.destinationAddress || site?.address || '-',
        '?댁넚??: d.transportCompany || '-',
        '李⑥쥌': d.vehicleType || '-',
        '李⑤웾踰덊샇': d.vehicleNo || '-',
        '湲곗궗紐?: d.driverName || '-',
        '湲곗궗?곕씫泥?: d.driverContact || '-',
        '?덉긽?댁넚鍮?: d.expectedCost || 0,
        '?뺤젙?댁넚鍮?: effCost,
        '怨좉컼泥?뎄?щ?': d.billableToCustomer ? '泥?뎄' : '?뱀궗遺??,
        '泥?뎄??곴퀬媛앹궗': d.billableCustomerId ? (getCustomer(d.billableCustomerId)?.name || '-') : '-',
        '?뱀씠?ы빆/硫붾え': d.memo || '',
        '留덇컧鍮꾧퀬': d.closingMemo || ''
      };
    });
    const todayStr = new Date().toISOString().split('T')[0];
    exportToExcel(rows, `諛곗감???${todayStr}`, '諛곗감紐⑸줉');
    showToast(`諛곗감 ???${rows.length}嫄??묒? ?대낫?닿린 ?꾨즺`);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-primary)', position: 'relative' }}>
      {/* ?뚮┝ ?좎뒪??諛곕꼫 (?뚯옣 5.2) */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 99999,
          padding: '10px 18px',
          borderRadius: '6px',
          backgroundColor: toastMessage.type === 'success' ? 'var(--success)' : toastMessage.type === 'error' ? 'var(--danger)' : '#f59e0b',
          color: '#ffffff',
          fontWeight: 600,
          fontSize: '13px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          {toastMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}
      {/* ?ㅻ뜑 ?곸뿭 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontWeight: '800', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Truck size={22} color="var(--primary)" /> 諛곗감 / ?댁넚 愿由?
          </h2>
        </div>
        {activeTab === 'DISPATCH' && canSave && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn-secondary"
              onClick={() => setDispatchExcelModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontWeight: 700, fontSize: '13px' }}
            >
              <FileSpreadsheet size={15} color="var(--primary)" />
              <span>諛곗감 ?묒? ?쇨큵 ?깅줉</span>
            </button>
            <button className="btn-primary" onClick={() => setShowManualModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontWeight: 700, fontSize: '13px' }}>
              <Plus size={15} /> [+ ?섎룞 諛곗감 ?앹꽦]
            </button>
          </div>
        )}
      </div>

      {/* 硫붿씤 ??(?뚯옣 3.1 臾댁닔?앹뼱 嫄댁“ ?쒖?: 諛곗감 愿由?/ ?댁넚猷????- ?댁넚??諛곗감 ?묒쓽???꾩떆 ?④?) */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('DISPATCH')}
          style={{
            padding: '10px 18px', fontSize: '14px', fontWeight: 700, backgroundColor: 'transparent', border: 'none',
            borderBottom: activeTab === 'DISPATCH' ? '3px solid var(--primary)' : 'none',
            color: activeTab === 'DISPATCH' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer',
            whiteSpace: 'nowrap', flexShrink: 0
          }}
        >
          <Truck size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          諛곗감 愿由?
        </button>
        {/* ?댁넚??諛곗감 ?묒쓽 硫붾돱???ъ슜???붿껌?쇰줈 ?꾩떆 ?④? 泥섎━ */}
        <button
          onClick={() => setActiveTab('RECONCILIATION')}
          style={{
            padding: '10px 18px', fontSize: '14px', fontWeight: 700, backgroundColor: 'transparent', border: 'none',
            borderBottom: activeTab === 'RECONCILIATION' ? '3px solid var(--primary)' : 'none',
            color: activeTab === 'RECONCILIATION' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer',
            whiteSpace: 'nowrap', flexShrink: 0
          }}
        >
          <FileText size={15} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          ?댁넚猷????
        </button>
      </div>

      {/* ??1: 諛곗감 愿由?*/}
      {activeTab === 'DISPATCH' && (
        <div>
          {/* ?뱤 ?ㅻ뒛/?댁씪/?대쾲二??곸감 諛곗감 ?듦퀎 諛?*/}
          {(() => {
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>?ㅻ뒛 ?곸감 ?덉젙</span>
                  <strong style={{ fontSize: '15px', color: deliveryCounts.today > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>{deliveryCounts.today}嫄?/strong>
                </div>
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>?댁씪 ?곸감 ?덉젙</span>
                  <strong style={{ fontSize: '15px', color: deliveryCounts.tomorrow > 0 ? '#0070C0' : 'var(--text-muted)' }}>{deliveryCounts.tomorrow}嫄?/strong>
                </div>
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>諛곗감 ?湲?(誘몃같??</span>
                  <strong style={{ fontSize: '15px', color: deliveryCounts.pending > 0 ? '#d97706' : 'var(--text-muted)' }}>{deliveryCounts.pending}嫄?/strong>
                </div>
              </div>
            );
          })()}

          {/* 4?④퀎 諛곗감 吏꾪뻾 ?곹깭 移댁슫????*/}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[
              { key: 'ALL', label: '?꾩껜 蹂닿린', count: deliveries.length },
              { key: 'PENDING', label: '?윞 諛곗감 ??(?湲?', count: deliveries.filter(d => getNormalizedDeliveryStatus(d) === 'PENDING').length },
              { key: 'DISPATCHED', label: '?뵷 諛곗감 ?꾨즺 (湲곗궗諛곗젙)', count: deliveries.filter(d => getNormalizedDeliveryStatus(d) === 'DISPATCHED').length },
              { key: 'DELIVERED', label: '?윟 ?댁넚 ?꾨즺', count: deliveries.filter(d => getNormalizedDeliveryStatus(d) === 'DELIVERED').length },
              { key: 'CANCELLED', label: '?뵶 諛곗감 痍⑥냼', count: deliveries.filter(d => getNormalizedDeliveryStatus(d) === 'CANCELLED').length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveDispatchStatusTab(tab.key)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: activeDispatchStatusTab === tab.key ? 'var(--primary)' : 'var(--border-color)',
                  backgroundColor: activeDispatchStatusTab === tab.key ? 'rgba(59,130,246,0.1)' : 'var(--bg-card)',
                  color: activeDispatchStatusTab === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: activeDispatchStatusTab === tab.key ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                {tab.label}
                <span style={{
                  backgroundColor: activeDispatchStatusTab === tab.key ? 'var(--primary)' : 'var(--bg-body)',
                  color: activeDispatchStatusTab === tab.key ? '#fff' : 'var(--text-muted)',
                  borderRadius: '12px',
                  padding: '1px 7px',
                  fontSize: '11px',
                  fontWeight: 700
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
              <button
                onClick={handleExportDispatchExcel}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <Download size={14} />
                ?묒? ?대낫?닿린
              </button>
            </div>
          </div>

          {/* 2??硫붿씤 ?덉씠?꾩썐 (醫? 諛곗감 紐⑸줉 + ?뱟 湲곌컙議고쉶 | ?? 湲곗궗 諛곗젙 ?? */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '20px' }}>
            
            {/* [醫뚯륫] 諛곗감 紐⑸줉 移대뱶 + ?뱟 ?붿껌/?댁넚??湲곌컙 ?좏깮 ??*/}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 230px)', minHeight: '600px' }}>
              
              {/* ?뱟 諛곗감 ?붿껌/?댁넚??湲곌컙 ?좏깮 ??*/}
              <div style={{ marginBottom: '12px', padding: '10px 12px', backgroundColor: 'var(--bg-body)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={13} /> 諛곗감 ?댁넚???좎껌??湲곌컙 議고쉶
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                      { label: '?ㅻ뒛', type: 'TODAY' },
                      { label: '1二쇱씪', type: 'WEEK' },
                      { label: '1媛쒖썡', type: 'MONTH' },
                      { label: '?꾩껜', type: 'ALL' }
                    ].map(b => (
                      <button
                        key={b.type}
                        onClick={() => handleSetDateRange(b.type as any)}
                        style={{
                          padding: '2px 7px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>~</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                  {(startDate || endDate) && (
                    <button
                      onClick={() => handleSetDateRange('ALL')}
                      title="湲곌컙 珥덇린??
                      style={{
                        padding: '5px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex'
                      }}
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* 寃?됱갹 */}
              <div style={{ marginBottom: '14px', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="怨좉컼??/ ?꾩옣 / 怨꾩빟 / 湲곗궗紐?寃??.."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-body)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* 諛곗감 紐⑸줉 ?뚮뜑留?*/}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                {filteredDeliveries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    議곌굔???쇱튂?섎뒗 諛곗감 ?붿껌嫄댁씠 ?놁뒿?덈떎.
                  </div>
                ) : (
                  filteredDeliveries.map(d => {
                    const contract = getContract(d.contractId);
                    const customer = contract ? getCustomer(contract.customerId) : null;
                    const isSelected = selectedDelivery?.id === d.id;
                    const cargoItems = parseCargoItems(d);
                    const normStatus = getNormalizedDeliveryStatus(d);

                    return (
                      <div 
                        key={d.id}
                        onClick={() => handleSelectDelivery(d)}
                        style={{
                          padding: '14px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? 'rgba(59,130,246,0.05)' : 'var(--bg-body)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 4px 12px rgba(59,130,246,0.12)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                          <span style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: (d.type === 'MOVEMENT' || d.dispatchCategory === '?대룞') ? '#8b5cf6'
                              : (d.type === 'EXCHANGE' || d.dispatchCategory === '援먰솚') ? '#10b981'
                              : (d.type === 'INBOUND' || d.dispatchCategory === '?낃퀬' || d.dispatchCategory === '諛섎궔') ? '#f59e0b'
                              : 'var(--primary)'
                          }}>
                            [{d.dispatchCategory || (d.type === 'MOVEMENT' ? '?대룞' : d.type === 'EXCHANGE' ? '援먰솚' : d.type === 'INBOUND' ? '?뚯닔' : '異쒓퀬')}] {d.requestDate || d.loadingDate}
                          </span>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {getOutboundInspectionBadge(d.contractId)}
                            {getPrintQueueBadge(d)}
                            {getDeliveryStatusBadge(normStatus)}
                          </div>
                        </div>

                        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>?룫 {customer?.name || '怨좉컼??誘몄???}</span>
                          {customer?.transactionStatus === 'BLOCKED' && (
                            <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', backgroundColor: '#ef4444', color: '#fff', flexShrink: 0 }}>
                              異쒓퀬?쒗븳
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            ?뱧 {d.destinationAddress || '紐⑹쟻吏 誘몄???}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDestWeatherForDelivery(d);
                            }}
                            style={{
                              padding: '2px 6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              borderRadius: '4px',
                              border: '1px solid rgba(59, 130, 246, 0.4)',
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              color: '#3B82F6',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              flexShrink: 0,
                              marginLeft: '6px'
                            }}
                            title="?대떦 ?섏감吏 ?좎뵪 諛?二쇨컙 ?덈낫 蹂닿린"
                          >
                            <Sun size={11} color="#F59E0B" /> ?좎뵪
                          </button>
                        </div>

                        {/* ?붾Ъ/?먯궛 ?뺣낫 ?쒖떆 */}
                        {(d.type === 'INBOUND' || d.dispatchCategory === '?낃퀬' || d.dispatchCategory === '諛섎궔') ? (
                          // ?뚯닔 諛곗감: 怨꾩빟/?뚯닔 ?먯궛 紐⑸줉 ?쒖떆 (紐⑤뜽紐?{愿由щ쾲??)
                          <div style={{ padding: '6px 8px', backgroundColor: 'rgba(239,68,68,0.05)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                            ?봽 ?뚯닔 ???&nbsp;
                            {getReturnAssets(d).length > 0
                              ? getReturnAssets(d).map(a => `${a.modelName} {${a.assetNo}}`).join(' / ')
                              : (cargoItems.length > 0 ? cargoItems.map(c => `${c.modelName} ${c.count}?`).join(', ') : '?먯궛 ?뺣낫 誘명솗??)}
                          </div>
                        ) : (
                          // 異쒓퀬 諛곗감: ?붾Ъ cargoItems ?쒖떆
                          <div style={{ padding: '6px 8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            ?벀 ?붾Ъ: {cargoItems.map(c => `${c.modelName} ${c.count}?`).join(', ')}
                          </div>
                        )}

                        {d.driverName && (
                          <div style={{ marginTop: '6px', fontSize: '11.5px', fontWeight: 700, color: '#16a34a' }}>
                            ?슋 湲곗궗: {d.driverName} ({d.vehicleNo || '李⑤웾踰덊샇誘몄긽'})
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* [?곗륫] 諛곗감 湲곗궗 諛곗젙 諛??곸꽭 ??*/}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', height: 'calc(100vh - 230px)', minHeight: '600px', overflowY: 'auto' }}>
              {!selectedDelivery ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <Truck size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                  <p style={{ fontSize: '14px', fontWeight: 600 }}>醫뚯륫?먯꽌 湲곗궗瑜?諛곗젙??諛곗감嫄댁쓣 ?좏깮??二쇱꽭??</p>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
                        ?슋 諛곗감 ?댁넚 湲곗궗 諛곗젙 諛??곹븯李??몃? ?ㅼ젙
                      </h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        諛곗감 ID: {selectedDelivery.id} | ?붿껌?? {selectedDelivery.requestDate}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {getOutboundInspectionBadge(selectedDelivery.contractId)}
                      {getPrintQueueBadge(selectedDelivery)}
                      {getDeliveryStatusBadge(getNormalizedDeliveryStatus(selectedDelivery))}
                      
                      {/* ?뼥截??꾩옣 臾댁씤 ?몄뇙 踰꾪듉 (異쒓퀬: ?꾨┛??, ?낃퀬: ?꾨┛?? ?먮룞 ?쇱슦?? */}
                      <button
                        type="button"
                        onClick={() => handleRemoteQueuePrintDispatchRequest(selectedDelivery, (selectedDelivery.type === 'INBOUND' || selectedDelivery.dispatchCategory === '?낃퀬' || selectedDelivery.dispatchCategory === '諛섎궔') ? 'INBOUND' : 'OUTBOUND')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '7px',
                          backgroundColor: '#1e293b',
                          color: '#ffffff',
                          border: '1px solid #0f172a',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}
                        title="?꾩옣 濡쒖뺄 PC ?꾨┛???꾨┛?? ?먮뒗 ?꾨┛??)濡??먮룞 ?먭꺽 異쒕젰?⑸땲??
                      >
                        <Printer size={13} />
                        {(selectedDelivery.type === 'INBOUND' || selectedDelivery.dispatchCategory === '?낃퀬' || selectedDelivery.dispatchCategory === '諛섎궔') ? '?낃퀬?붿껌???몄뇙' : '異쒓퀬?붿껌???몄뇙'}
                      </button>

                      {/* ?뼥截?釉뚮씪?곗? 吏곸젒 ?몄뇙 踰꾪듉 */}
                      <button
                        type="button"
                        onClick={() => handlePrintDispatchRequest(selectedDelivery, (selectedDelivery.type === 'INBOUND' || selectedDelivery.dispatchCategory === '?낃퀬' || selectedDelivery.dispatchCategory === '諛섎궔') ? 'INBOUND' : 'OUTBOUND')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '7px',
                          backgroundColor: 'var(--bg-app)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}
                        title="?щТ???꾩옱 而댄벂??釉뚮씪?곗??먯꽌 吏곸젒 ?몄뇙"
                      >
                        吏곸젒 ?몄뇙
                      </button>

                      {/* ?벒 湲곗궗 諛곗감 ?덈궡 臾몄옄 諛쒖넚 / ?대┰蹂대뱶 蹂듭궗 踰꾪듉 */}
                      <button
                        type="button"
                        onClick={() => handleSendDriverSms(selectedDelivery)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '7px',
                          backgroundColor: 'rgba(56, 189, 248, 0.12)',
                          color: '#0284c7',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                        }}
                      >
                        <MessageSquare size={13} color="#0284c7" />
                        湲곗궗 諛곗감臾몄옄
                      </button>

                      {/* ?뮕 ?곷떒 諛곗감/?댁넚?꾨즺/痍⑥냼 ?≪뀡 踰꾪듉 */}
                      {canSave && (
                        <>
                          <button
                            onClick={handleSaveDispatch}
                            className="btn-primary"
                            style={{ padding: '6px 14px', fontWeight: 800, fontSize: '12.5px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 6px rgba(59,130,246,0.25)' }}
                          >
                            <ShieldCheck size={14} /> [?뵷 諛곗감 湲곗궗 諛곗젙 ?꾨즺]
                          </button>

                          {getNormalizedDeliveryStatus(selectedDelivery) === 'DISPATCHED' && (
                            <button
                              onClick={() => handleCompleteDeliveryStatus(selectedDelivery.id)}
                              style={{ padding: '6px 14px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 800, fontSize: '12.5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 6px rgba(22,163,74,0.25)' }}
                            >
                              <CheckCircle size={14} /> [?윟 ?댁넚 ?꾨즺 留덇컧]
                            </button>
                          )}

                          <button
                            onClick={() => handleCancelDeliveryStatus(selectedDelivery.id)}
                            style={{ padding: '6px 10px', borderRadius: '7px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            ?슟 諛곗감 痍⑥냼
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {(() => {
                    const normStatus = getNormalizedDeliveryStatus(selectedDelivery);
                    const isDispatchedOrCompleted = normStatus === 'DISPATCHED' || normStatus === 'DELIVERED' || normStatus === 'CANCELLED';
                    // ?뮕 [?ъ옣??吏?? 諛곗감媛 ?대? ?꾨즺/留덇컧??嫄댁? visible = true, enable = false (?섏젙 遺덇? ?좉툑!)
                    const isFormDisabled = !canSave || (isDispatchedOrCompleted && !isEditUnlocked);

                    return (
                      <div>
                        {(() => {
                          const curContract = getContract(selectedDelivery.contractId);
                          const curCustomer = curContract ? getCustomer(curContract.customerId) : null;
                          const isOutOrEx = selectedDelivery.type === 'OUTBOUND' || selectedDelivery.dispatchCategory === '異쒓퀬' || selectedDelivery.dispatchCategory === '援먰솚';
                          if (isOutOrEx && curCustomer?.transactionStatus === 'BLOCKED') {
                            return (
                              <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#b91c1c', fontWeight: 800, fontSize: '13px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertTriangle size={18} color="#ef4444" />
                                <span>[異쒓퀬?쒗븳 嫄곕옒泥? 嫄곕옒泥?[{curCustomer.name}]?(?? ?곗껜 愿由щ줈 ?명빐 ?좉퇋 ?λ퉬 異쒓퀬媛 李⑤떒?섏뿀?듬땲?? 諛곗감瑜??뺤젙?????놁뒿?덈떎.</span>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* 諛곗감 ?몃? ?ㅼ젙 ??(3而щ읆: 諛곗감 援щ텇 | ?곸감?쇱옄 & ?쒓컙 | ?섏감?쇱옄 & ?쒓컙) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr 1.25fr', gap: '14px', marginBottom: '16px' }}>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>諛곗감 援щ텇</label>
                            <select
                              value={dispatchCategory}
                              disabled={isFormDisabled}
                              onChange={e => setDispatchCategory(e.target.value as any)}
                              style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)', fontSize: '12.5px', color: 'var(--text-primary)', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                            >
                              <option value="異쒓퀬">異쒓퀬</option>
                              <option value="?낃퀬">?낃퀬</option>
                              <option value="援먰솚">援먰솚</option>
                              <option value="諛섎궔">諛섎궔</option>
                              <option value="?뺣퉬">?뺣퉬</option>
                              <option value="?대룞">?대룞</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>?곸감?쇱옄 & ?쒓컙</label>
                            <div style={{ display: 'flex', gap: '6px', position: 'relative', height: '34px' }}>
                              <input
                                type="date"
                                value={loadingDate}
                                disabled={isFormDisabled}
                                onChange={e => setLoadingDate(e.target.value)}
                                style={{ flex: 1, padding: '7px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)', fontSize: '12.5px', color: 'var(--text-primary)', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default', marginRight: '106px' }}
                              />
                              <select
                                value={loadingTimeSlot}
                                disabled={isFormDisabled}
                                onChange={e => {
                                  setLoadingTimeSlot(e.target.value);
                                  (e.target as HTMLSelectElement).blur();
                                }}
                                onFocus={e => { (e.target as HTMLSelectElement).size = 10; }}
                                onBlur={e => { (e.target as HTMLSelectElement).size = 1; }}
                                style={{
                                  width: '100px',
                                  padding: '6px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)',
                                  fontSize: '12.5px',
                                  color: 'var(--text-primary)',
                                  opacity: isFormDisabled ? 0.75 : 1,
                                  cursor: isFormDisabled ? 'not-allowed' : 'default',
                                  position: 'absolute',
                                  right: 0,
                                  top: 0,
                                  zIndex: 30,
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                }}
                              >
                                <option value="?ㅼ쟾">?ㅼ쟾</option>
                                <option value="?ㅽ썑">?ㅽ썑</option>
                                <option value="?섏떆">?섏떆</option>
                                <option value="06??>06??/option>
                                <option value="07??>07??/option>
                                <option value="08??>08??/option>
                                <option value="09??>09??/option>
                                <option value="10??>10??/option>
                                <option value="11??>11??/option>
                                <option value="12??>12??/option>
                                <option value="13??>13??/option>
                                <option value="14??>14??/option>
                                <option value="15??>15??/option>
                                <option value="16??>16??/option>
                                <option value="17??>17??/option>
                                <option value="18??>18??/option>
                                <option value="19??>19??/option>
                                <option value="20??>20??/option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>?섏감?쇱옄 & ?쒓컙</label>
                            <div style={{ display: 'flex', gap: '6px', position: 'relative', height: '34px' }}>
                              <input
                                type="date"
                                value={unloadingDate}
                                disabled={isFormDisabled}
                                onChange={e => setUnloadingDate(e.target.value)}
                                style={{ flex: 1, padding: '7px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)', fontSize: '12.5px', color: 'var(--text-primary)', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default', marginRight: '106px' }}
                              />
                              <select
                                value={unloadingTimeSlot}
                                disabled={isFormDisabled}
                                onChange={e => {
                                  setUnloadingTimeSlot(e.target.value);
                                  (e.target as HTMLSelectElement).blur();
                                }}
                                onFocus={e => { (e.target as HTMLSelectElement).size = 10; }}
                                onBlur={e => { (e.target as HTMLSelectElement).size = 1; }}
                                style={{
                                  width: '100px',
                                  padding: '6px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)',
                                  fontSize: '12.5px',
                                  color: 'var(--text-primary)',
                                  opacity: isFormDisabled ? 0.75 : 1,
                                  cursor: isFormDisabled ? 'not-allowed' : 'default',
                                  position: 'absolute',
                                  right: 0,
                                  top: 0,
                                  zIndex: 30,
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                }}
                              >
                                <option value="?ㅼ쟾">?ㅼ쟾</option>
                                <option value="?ㅽ썑">?ㅽ썑</option>
                                <option value="?섏떆">?섏떆</option>
                                <option value="06??>06??/option>
                                <option value="07??>07??/option>
                                <option value="08??>08??/option>
                                <option value="09??>09??/option>
                                <option value="10??>10??/option>
                                <option value="11??>11??/option>
                                <option value="12??>12??/option>
                                <option value="13??>13??/option>
                                <option value="14??>14??/option>
                                <option value="15??>15??/option>
                                <option value="16??>16??/option>
                                <option value="17??>17??/option>
                                <option value="18??>18??/option>
                                <option value="19??>19??/option>
                                <option value="20??>20??/option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>?곸감吏 (異쒕컻吏)</label>
                            <input
                              type="text"
                              value={originAddress}
                              disabled={isFormDisabled}
                              onChange={e => setOriginAddress(e.target.value)}
                              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)', fontSize: '12.5px', color: 'var(--text-primary)', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>?섏감吏 (?꾩갑吏)</label>
                            <input
                              type="text"
                              value={destinationAddress}
                              disabled={isFormDisabled}
                              onChange={e => setDestinationAddress(e.target.value)}
                              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)', fontSize: '12.5px', color: 'var(--text-primary)', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                            />
                          </div>
                        </div>

                        {/* ?????????????????????????????????????????????????????????????????? */}
                        {/* ?슊 諛곗젙 ?댁넚 湲곗궗 諛??댁넚 嫄곕옒泥?紐⑸줉 (isFormDisabled ??鍮꾪솢?깊솕!) */}
                        {/* ?????????????????????????????????????????????????????????????????? */}
                        <div style={{ marginBottom: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>?슊 諛곗젙 ?댁넚 湲곗궗 紐⑸줉</label>
                            {!isFormDisabled && (
                              <button onClick={handleAddVehicleRow} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, borderRadius: '4px', border: '1px solid var(--primary)', color: 'var(--primary)', backgroundColor: 'transparent', cursor: 'pointer' }}>
                                + 李⑤웾 異붽?
                              </button>
                            )}
                          </div>

                          {/* 而щ읆 ?ㅻ뜑 (?ъ옣??吏?? ?덉긽 ?댁넚鍮??꾩닔, ?ㅼ젣 ?댁넚鍮??좏깮???낅젰 2?대줈 遺꾨━) */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.1fr 0.9fr 0.8fr 1.1fr 1fr 1fr 30px', gap: '6px', padding: '6px 10px', backgroundColor: 'var(--bg-body)', borderRadius: '6px', fontSize: '11px', fontWeight: 800, color: 'var(--primary)', marginBottom: '6px', border: '1px solid var(--border-color)' }}>
                            <div>?댁넚??/div>
                            <div>湲곗궗紐?/div>
                            <div>李⑤웾踰덊샇</div>
                            <div>李⑥쥌</div>
                            <div>?곕씫泥?/div>
                            <div>?덉긽?댁넚鍮?/div>
                            <div>?ㅼ젣?댁넚鍮?/div>
                            <div></div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {assignedVehicles.map((veh, idx) => {
                              const matchedComp = transportCompanies.find(c => c.name.trim() === veh.transportCompany.trim());
                              const filteredDrivers = matchedComp
                                ? transportDrivers.filter(d => d.companyId === matchedComp.id)
                                : transportDrivers;

                              return (
                                <div key={veh.id || idx} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', display: 'grid', gridTemplateColumns: '1.2fr 1.1fr 0.9fr 0.8fr 1.1fr 1fr 1fr 30px', gap: '6px', alignItems: 'center' }}>
                                  
                                  {/* 1. ?댁넚????됲듃 */}
                                  <select
                                    value={veh.transportCompany}
                                    disabled={isFormDisabled}
                                    onChange={e => handleVehicleFieldChange(idx, 'transportCompany', e.target.value)}
                                    style={{ padding: '6px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '11.5px', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                                  >
                                    <option value="">-- ?댁넚???좏깮 --</option>
                                    {transportCompanies.map(c => (
                                      <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                  </select>

                                  {/* 2. 湲곗궗紐???됲듃 */}
                                  <select
                                    value={veh.driverName}
                                    disabled={isFormDisabled}
                                    onChange={e => {
                                      handleVehicleFieldChange(idx, 'driverName', e.target.value);
                                    }}
                                    style={{ padding: '6px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '11.5px', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                                  >
                                    <option value="">-- 湲곗궗 ?좏깮 --</option>
                                    {filteredDrivers.map(drv => (
                                      <option key={drv.id} value={drv.driverName}>
                                        {drv.driverName} ({drv.vehicleNo || '李⑤웾誘몄긽'})
                                      </option>
                                    ))}
                                  </select>

                                  {/* 2.5 李⑤웾踰덊샇 */}
                                  <input
                                    type="text"
                                    placeholder="李⑤웾踰덊샇"
                                    value={veh.vehicleNo || ''}
                                    disabled={isFormDisabled}
                                    onChange={e => handleVehicleFieldChange(idx, 'vehicleNo', e.target.value)}
                                    style={{ padding: '6px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '11.5px', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                                  />

                                  {/* 3. 李⑥쥌 ??됲듃 */}
                                  <select
                                    value={veh.vehicleType}
                                    disabled={isFormDisabled}
                                    onChange={e => handleVehicleFieldChange(idx, 'vehicleType', e.target.value)}
                                    style={{ padding: '6px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '11.5px', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                                  >
                                    {VEHICLE_TYPE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>

                                  {/* 4. ?곕씫泥?*/}
                                  <input
                                    type="text"
                                    placeholder="?곕씫泥?
                                    value={veh.driverContact}
                                    disabled={isFormDisabled}
                                    onChange={e => handleVehicleFieldChange(idx, 'driverContact', e.target.value)}
                                    style={{ padding: '6px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '11.5px', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                                  />

                                  {/* 5. ?뮥 ?덉긽 ?댁넚鍮?(?꾩닔) */}
                                  <input
                                    type="number"
                                    placeholder="?덉긽 ?댁넚鍮?
                                    value={veh.expectedCost !== undefined ? veh.expectedCost : ''}
                                    disabled={isFormDisabled}
                                    onChange={e => {
                                      const val = Number(e.target.value);
                                      handleVehicleFieldChange(idx, 'expectedCost', val);
                                      handleVehicleFieldChange(idx, 'deliveryCost', val);
                                    }}
                                    style={{ padding: '6px 6px', borderRadius: '6px', border: '1px solid var(--primary)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-card)', color: 'var(--primary)', fontSize: '11.5px', fontWeight: 800, textAlign: 'right', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                                  />

                                  {/* 6. ?뮫 ?ㅼ젣 ?댁넚鍮?(?좏깮 - ?뚮㈃ 湲덉븸 ?낅젰, 紐⑤Ⅴ硫?湲곕낯媛?0 ?좎?) */}
                                  <input
                                    type="number"
                                    placeholder="0 (?뚮㈃ ?낅젰)"
                                    value={veh.finalCost !== undefined && veh.finalCost !== null ? veh.finalCost : 0}
                                    disabled={isFormDisabled}
                                    onChange={e => {
                                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                                      handleVehicleFieldChange(idx, 'finalCost', val);
                                    }}
                                    style={{ padding: '6px 6px', borderRadius: '6px', border: '1px solid #16a34a', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'rgba(34,197,94,0.05)', color: '#16a34a', fontSize: '11.5px', fontWeight: 800, textAlign: 'right', outline: 'none', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                                  />

                                  {!isFormDisabled && (
                                    <button onClick={() => handleRemoveVehicleRow(idx)} style={{ color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* 留덇컧 鍮꾧퀬 硫붾え */}
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>?뱷 諛곗감 ?뱀씠?ы빆 諛?留덇컧 硫붾え</label>
                          <textarea
                            value={closingMemo}
                            disabled={isFormDisabled}
                            onChange={e => setClosingMemo(e.target.value)}
                            placeholder="諛곗감 湲곗궗 ?꾨떖?ы빆, ?꾩옣 ?뱀씠?ы빆 湲곕줉..."
                            style={{ width: '100%', height: '65px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isFormDisabled ? 'var(--bg-card)' : 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '12.5px', boxSizing: 'border-box', opacity: isFormDisabled ? 0.75 : 1, cursor: isFormDisabled ? 'not-allowed' : 'default' }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* ?뮠 理쒗븯?? 異쒓퀬 ?붿껌 ?먯뿰???먮낯 ?띿뒪??諛뺤뒪 */}
                  <div style={{ marginBottom: '20px', padding: '14px 16px', backgroundColor: 'rgba(59,130,246,0.06)', border: '1.5px solid rgba(59,130,246,0.25)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MessageSquare size={16} /> ?뮠 異쒓퀬 ?붿껌 ?먯뿰???먮낯 ?띿뒪??(諛곗감 ?먮떒 李멸퀬??
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontFamily: 'Consolas, Monaco, monospace', backgroundColor: 'var(--bg-card)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      {selectedDelivery.rawText || selectedDelivery.memo || '?붿껌???먯뿰???먮Ц???놁뒿?덈떎.'}
                    </div>
                  </div>

                  {/* ?뽳툘 ?고븯???곕????≪뀡 諛?(Z-?⑦꽩 4?④퀎 理쒖쥌 ?꾧껐, ?뚯옣 3.5) */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 18px',
                    backgroundColor: 'var(--bg-body)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    marginBottom: '16px'
                  }}>
                    {canSave && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCancelDeliveryStatus(selectedDelivery.id)}
                          style={{ padding: '7px 12px', borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          ?슟 諛곗감 痍⑥냼
                        </button>

                        {getNormalizedDeliveryStatus(selectedDelivery) === 'DISPATCHED' && (
                          <button
                            type="button"
                            onClick={() => handleCompleteDeliveryStatus(selectedDelivery.id)}
                            style={{ padding: '7px 14px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 800, fontSize: '12.5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          >
                            <CheckCircle size={14} /> [?윟 ?댁넚 ?꾨즺 留덇컧]
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleSaveDispatch}
                          className="btn-primary"
                          style={{ padding: '7px 16px', fontWeight: 800, fontSize: '12.5px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        >
                          <ShieldCheck size={15} /> [?뵷 諛곗감 湲곗궗 諛곗젙 ?꾨즺]
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* ?뽳툘 Gutenberg Z-?⑦꽩 4?④퀎 理쒗븯???뚭퀎 ?李⑤?議곗떇 寃利?諛?(?뚯옣 3.5) */}
          {(() => {
            const pendingDeliveries = deliveries.filter(d => d.status === 'PENDING').length;
            const dispatchedDeliveries = deliveries.filter(d => d.status === 'DISPATCHED').length;
            const deliveredDeliveries = deliveries.filter(d => d.status === 'DELIVERED').length;
            const cancelledDeliveries = deliveries.filter(d => d.status === 'CANCELLED').length;
            const exchangeCount = deliveries.filter(d => d.dispatchCategory === '援먰솚' || d.type === 'EXCHANGE').length;

            return (
              <div style={{
                padding: '8px 14px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '11.5px',
                borderRadius: '6px',
                marginTop: '12px',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <span>諛곗감 ?湲? <strong style={{ color: '#d97706' }}>珥?{pendingDeliveries}嫄?/strong></span>
                  <span>|</span>
                  <span>諛곗감 ?꾨즺: <strong style={{ color: 'var(--primary)' }}>珥?{dispatchedDeliveries}嫄?/strong></span>
                  <span>|</span>
                  <span>?댁넚 ?꾨즺: <strong style={{ color: 'var(--success)' }}>珥?{deliveredDeliveries}嫄?/strong></span>
                  <span>|</span>
                  <span>?李??뺣났諛곗감: <strong style={{ color: '#8b5cf6' }}>珥?{exchangeCount}嫄?/strong></span>
                  <span>|</span>
                  <span>痍⑥냼: <strong style={{ color: 'var(--danger)' }}>珥?{cancelledDeliveries}嫄?/strong></span>
                </div>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--success-light)',
                  color: 'var(--success)',
                  fontWeight: 700,
                  fontSize: '11px'
                }}>
                  ?뽳툘 ?李??뺤긽 (諛곗감?섎ː-湲곗궗諛곗젙-?댁넚鍮?1:1 臾닿껐)
                </span>
              </div>
            );
          })()}
        </div>
      )}

      {/* ??2: ?댁넚??諛곗감 ?묒쓽 (?듯솕?뚯씪 ?낅줈??????泥섎━ ??AI 遺꾩꽍 ??諛곗감 留ㅽ븨 ???뺤젙) */}
      {activeTab === 'NEGOTIATION' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ?? [Step 1] 理쒖긽?? ?듯솕 ?뚯씪 ?낅줈??諛??묒쓽 ??(Call Queue Pipeline) ?? */}
          <div style={{
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px',
            padding: '16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileAudio size={18} style={{ color: '#3b82f6' }} />
                  <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    諛곗감 ?묒쓽 ?듯솕 ??(Call Queue)
                  </span>
                  <span style={{
                    padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800,
                    backgroundColor: 'rgba(59,130,246,0.15)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.3)'
                  }}>
                    ?湲?{callQueue.filter(q => q.status !== 'CONFIRMED').length}嫄?
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  ???먮뒗 PC?먯꽌 ?뱀쓬???듯솕 ?뚯씪(.m4a, .mp3, .wav)???낅줈?쒗븯硫?AI媛 ?댁넚?? 李⑥쥌, ?댁넚鍮? ?뱀빟???먮룞 異붿텧?⑸땲??
                </div>
              </div>

              {/* ?듯솕 ?뚯씪 ?낅줈???≪뀡 踰꾪듉 & ?덈뱺 ?명뭼 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="file"
                  ref={callFileInputRef}
                  accept="audio/*,.m4a,.mp3,.wav,.aac,.amr"
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleUploadCallFile(e.target.files[0]);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={isUploadingCall}
                  onClick={() => callFileInputRef.current?.click()}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--primary)',
                    color: '#ffffff', border: 'none', fontWeight: 800, fontSize: '12.5px',
                    cursor: isUploadingCall ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    opacity: isUploadingCall ? 0.7 : 1
                  }}
                >
                  {isUploadingCall ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>AI STT & 遺꾩꽍 以?..</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={15} />
                      <span>?듯솕 ?뱀쓬 ?뚯씪 吏곸젒 ?낅줈??/span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {callUploadError && (
              <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#dc2626', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={14} /> {callUploadError}
              </div>
            )}

            {/* ?듯솕 ??移대뱶 媛濡?由ъ뒪??*/}
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
              {callQueue.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', width: '100%', color: 'var(--text-muted)', fontSize: '12px', backgroundColor: 'var(--bg-body)', borderRadius: '6px' }}>
                  ?깅줉??諛곗감 ?듯솕 ?뱀쓬???놁뒿?덈떎. [?듯솕 ?뱀쓬 ?뚯씪 吏곸젒 ?낅줈?? 踰꾪듉???뚮윭 ???듯솕 ?뚯씪???깅줉?섏떗?쒖삤.
                </div>
              ) : (
                callQueue.map(item => {
                  const isSelected = selectedCallQueueId === item.id;
                  const isConfirmed = item.status === 'CONFIRMED';
                  const isAnalyzing = item.status === 'ANALYZING';

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectCallQueueItem(item)}
                      style={{
                        minWidth: '270px', maxWidth: '300px', flexShrink: 0,
                        padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                        backgroundColor: isSelected ? 'rgba(59,130,246,0.12)' : 'var(--bg-body)',
                        border: isSelected ? '2px solid var(--primary)' : isConfirmed ? '1px solid #10b981' : '1px solid var(--border-color)',
                        display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontSize: '10.5px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px',
                          backgroundColor: isConfirmed ? 'rgba(16,185,129,0.15)' : isAnalyzing ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                          color: isConfirmed ? '#10b981' : isAnalyzing ? '#d97706' : '#2563eb'
                        }}>
                          {isConfirmed ? '??諛곗감?뺤젙?? : isAnalyzing ? '??AI 遺꾩꽍以? : '?윟 遺꾩꽍?꾨즺'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {item.durationSec ? `${item.durationSec}珥? : ''}
                          </span>
                          <button
                            type="button"
                            onClick={e => handleDeleteCallQueueItem(item.id, e)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}
                            title="?먯뿉????젣"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>

                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.fileName}
                      </div>

                      {/* 異붿텧 ?섏씠?쇱씠??諛곗? */}
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {item.extracted.transportCompanyName && (
                          <span style={{ fontSize: '10.5px', fontWeight: 800, backgroundColor: 'rgba(59,130,246,0.15)', color: '#2563eb', padding: '1px 5px', borderRadius: '4px' }}>
                            {item.extracted.transportCompanyName}
                          </span>
                        )}
                        {item.extracted.vehicleType && (
                          <span style={{ fontSize: '10.5px', fontWeight: 800, backgroundColor: 'rgba(139,92,246,0.15)', color: '#8b5cf6', padding: '1px 5px', borderRadius: '4px' }}>
                            {item.extracted.vehicleType}
                          </span>
                        )}
                        {item.extracted.proposedCost ? (
                          <span style={{ fontSize: '10.5px', fontWeight: 800, backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '1px 5px', borderRadius: '4px' }}>
                            ??item.extracted.proposedCost.toLocaleString()}
                          </span>
                        ) : null}
                      </div>

                      {item.extracted.matchedDeliverySummary && (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          留ㅼ묶: {item.extracted.matchedDeliverySummary}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ?? [Step 2 & 3] 2遺꾪븷 留덉뒪???뷀뀒???ㅽ뒠?붿삤 (醫뚯륫 諛곗감 ???+ ?곗륫 AI ?묒쓽 ?곗뒪?? ?? */}
          <div style={{ display: 'flex', gap: '16px', minHeight: '650px', alignItems: 'flex-start' }}>
            {/* ?? 醫뚯륫 Master: 諛곗감 ???嫄?由ъ뒪??(?덈퉬 400px 怨좎젙) ?? */}
            <div style={{
              width: '400px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px',
              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px',
              padding: '14px', boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  <Truck size={16} /> 諛곗감 ???紐⑸줉
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
                  珥?{deliveries.filter(d => d.status !== 'CANCELLED').length}嫄?
                </span>
              </div>

              {/* ?듯솕 AI 異붿쿇 諛곗감 ?곷떒 諛곕꼫 移대뱶 */}
              {selectedCall?.extracted.matchedDeliveryId && (() => {
                const matchedDel = deliveries.find(d => d.id === selectedCall.extracted.matchedDeliveryId);
                if (!matchedDel) return null;
                const mContract = contracts.find(c => c.id === matchedDel.contractId);
                const mCust = customers.find(c => c.id === mContract?.customerId);
                const mSite = sites?.find(s => s.id === mContract?.siteId);
                const isCurrentSelected = selectedNegoDeliveryId === matchedDel.id;
                return (
                  <div
                    onClick={() => setSelectedNegoDeliveryId(matchedDel.id)}
                    style={{
                      padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                      backgroundColor: isCurrentSelected ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)',
                      border: '1.5px dashed #10b981',
                      display: 'flex', flexDirection: 'column', gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Sparkles size={12} /> ?렞 ?듯솕 AI 異붿쿇 留ㅼ묶 諛곗감
                      </span>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        #{matchedDel.id.slice(-6)}
                      </span>
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {mCust?.name || '(怨좉컼??'} 쨌 {mSite?.name || '?꾩옣'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {matchedDel.destinationAddress || matchedDel.originAddress || '?꾩옣 二쇱냼'}
                    </div>
                  </div>
                );
              })()}

              {/* ?꾪꽣 & 寃??*/}
              <div style={{ display: 'flex', gap: '6px' }}>
                <select
                  value={negoFilterStatus}
                  onChange={e => setNegoFilterStatus(e.target.value as any)}
                  style={{
                    padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700
                  }}
                >
                  <option value="ALL">?꾩껜 ?곹깭</option>
                  <option value="PENDING">諛곗감 ?湲?/option>
                  <option value="IN_NEGOTIATION">?묒쓽 以?/option>
                  <option value="CONFIRMED">?묒쓽 ?꾨즺</option>
                </select>
                <input
                  type="text"
                  value={negoSearchQuery}
                  onChange={e => setNegoSearchQuery(e.target.value)}
                  placeholder="怨좉컼/?꾩옣/二쇱냼 寃??.."
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '12px'
                  }}
                />
              </div>

              {/* 諛곗감 嫄??ㅽ겕濡?由ъ뒪??*/}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '580px', overflowY: 'auto' }}>
                {(() => {
                  const filtered = deliveries.filter(d => {
                    if (d.status === 'CANCELLED') return false;
                    const negos = (transportNegotiations || []).filter(n => n.deliveryId === d.id);
                    const hasConfirmed = negos.some(n => n.status === 'CONFIRMED');
                    const hasNegotiating = negos.some(n => n.status === 'IN_NEGOTIATION');

                    if (negoFilterStatus === 'PENDING' && d.status !== 'PENDING') return false;
                    if (negoFilterStatus === 'IN_NEGOTIATION' && !hasNegotiating) return false;
                    if (negoFilterStatus === 'CONFIRMED' && !hasConfirmed) return false;

                    if (negoSearchQuery) {
                      const q = negoSearchQuery.toLowerCase();
                      const contract = contracts.find(c => c.id === d.contractId);
                      const customer = customers.find(c => c.id === contract?.customerId);
                      const site = sites?.find(s => s.id === contract?.siteId);
                      const match = (customer?.name || '').toLowerCase().includes(q) ||
                                    (site?.name || '').toLowerCase().includes(q) ||
                                    (d.destinationAddress || '').toLowerCase().includes(q) ||
                                    (d.originAddress || '').toLowerCase().includes(q);
                      if (!match) return false;
                    }
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '12px' }}>
                        ?대떦 議곌굔??諛곗감 嫄댁씠 ?놁뒿?덈떎.
                      </div>
                    );
                  }

                  return filtered.map(del => {
                    const isSelected = selectedNegoDeliveryId === del.id;
                    const isAiMatched = selectedCall?.extracted.matchedDeliveryId === del.id;
                    const contract = contracts.find(c => c.id === del.contractId);
                    const customer = customers.find(c => c.id === contract?.customerId);
                    const site = sites?.find(s => s.id === contract?.siteId);
                    const negos = (transportNegotiations || []).filter(n => n.deliveryId === del.id);
                    const confirmedNego = negos.find(n => n.status === 'CONFIRMED');

                    const typeLabel = del.type === 'OUTBOUND' ? '異쒓퀬' : del.type === 'INBOUND' ? '?뚯닔' : del.type === 'EXCHANGE' ? '援먰솚' : '?대룞';
                    const typeColor = del.type === 'OUTBOUND' ? '#2563eb' : del.type === 'INBOUND' ? '#dc2626' : del.type === 'EXCHANGE' ? '#0891b2' : '#6b7280';

                    return (
                      <div
                        key={del.id}
                        onClick={() => setSelectedNegoDeliveryId(del.id)}
                        style={{
                          padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s ease',
                          backgroundColor: isSelected ? 'rgba(59,130,246,0.12)' : 'var(--bg-body)',
                          border: isSelected ? '1.5px solid var(--primary)' : isAiMatched ? '1.5px solid #10b981' : '1px solid var(--border-color)',
                          display: 'flex', flexDirection: 'column', gap: '5px', position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 800,
                              backgroundColor: `${typeColor}20`, color: typeColor, border: `1px solid ${typeColor}40`, whiteSpace: 'nowrap'
                            }}>
                              {typeLabel}
                            </span>
                            {isAiMatched && (
                              <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 800, backgroundColor: 'rgba(16,185,129,0.15)', padding: '1px 5px', borderRadius: '4px' }}>
                                ?렞 留ㅼ묶
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {del.loadingDate || del.scheduledDate || del.requestDate}
                          </span>
                        </div>

                        <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {customer?.name || '(怨좉컼??誘몄???'} 쨌 {site?.name || '?꾩옣'}
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={11} /> {del.destinationAddress || del.originAddress || '二쇱냼 誘몄엯??}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981' }}>
                            ??del.deliveryCost ? del.deliveryCost.toLocaleString() : '誘몄젙'}
                          </span>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {confirmedNego ? (
                              <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 800 }}>
                                ?뺤젙: {confirmedNego.transportCompanyName}
                              </span>
                            ) : negos.length > 0 ? (
                              <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(59,130,246,0.15)', color: '#2563eb', fontWeight: 800 }}>
                                寃ъ쟻 {negos.length}嫄?
                              </span>
                            ) : (
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                ?묒쓽?湲?
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* ?? ?곗륫 Detail Studio: ?좏깮??諛곗감???댁넚???묒쓽 ?곗뒪???? */}
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', gap: '14px',
              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px',
              padding: '16px', boxSizing: 'border-box', minWidth: 0
            }}>
              {!selectedNegoDelivery ? (
                <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-muted)' }}>
                  <Truck size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                  <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 6px 0' }}>?좏깮??諛곗감 嫄댁씠 ?놁뒿?덈떎</h4>
                  <p style={{ fontSize: '12px', margin: 0 }}>?곷떒 ?듯솕 ?먯뿉???듯솕瑜??좏깮?섍굅?? 醫뚯륫 紐⑸줉?먯꽌 ?묒쓽??諛곗감 嫄댁쓣 ?좏깮?섏떗?쒖삤.</p>
                </div>
              ) : (
                (() => {
                  const contract = contracts.find(c => c.id === selectedNegoDelivery.contractId);
                  const customer = customers.find(c => c.id === contract?.customerId);
                  const site = sites?.find(s => s.id === contract?.siteId);
                  const currentNegos = (transportNegotiations || []).filter(n => n.deliveryId === selectedNegoDelivery.id);

                  return (
                    <>
                      {/* ?좏깮???듯솕 ?뚯꽦 ?뚮젅?댁뼱 & STT ?꾩궗臾?移대뱶 (?먯뿉???좏깮??寃쎌슦) */}
                      {selectedCall && (
                        <div style={{
                          backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '8px',
                          padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Sparkles size={15} style={{ color: '#3b82f6' }} />
                              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                AI ?듯솕 遺꾩꽍: {selectedCall.fileName}
                              </span>
                              <span style={{
                                fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', fontWeight: 800,
                                backgroundColor: selectedCall.extracted.confidence === 'HIGH' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                color: selectedCall.extracted.confidence === 'HIGH' ? '#10b981' : '#d97706'
                              }}>
                                ?좊ː??{selectedCall.extracted.confidence}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSelectCallQueueItem(selectedCall)}
                              style={{
                                fontSize: '11px', fontWeight: 800, padding: '4px 8px', borderRadius: '4px',
                                backgroundColor: 'rgba(59,130,246,0.15)', color: '#2563eb', border: 'none', cursor: 'pointer'
                              }}
                            >
                              ???쇱뿉 ?ㅼ떆 ?먮룞 梨꾩슦湲?
                            </button>
                          </div>

                          {/* ?ㅻ뵒???뚮젅?댁뼱 */}
                          {selectedCall.audioUrl && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Volume2 size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                              <audio controls src={selectedCall.audioUrl} style={{ width: '100%', height: '32px' }} />
                            </div>
                          )}

                          {/* STT ?뚯꽦 ?꾩궗臾?*/}
                          {selectedCall.transcript && (
                            <div style={{
                              fontSize: '12px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-body)',
                              padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)',
                              lineHeight: 1.5, maxHeight: '80px', overflowY: 'auto'
                            }}>
                              <strong style={{ color: 'var(--text-primary)', marginRight: '6px' }}>[?뚯꽦 ?꾩궗]</strong>
                              "{selectedCall.transcript}"
                            </div>
                          )}
                        </div>
                      )}

                      {/* 1. 諛곗감 湲곕낯 ?뺣낫 移대뱶 */}
                      <div style={{
                        backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '8px',
                        padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
                              諛곗감 踰덊샇 #{selectedNegoDelivery.id.slice(-6)} 쨌 {selectedNegoDelivery.type}
                            </span>
                            {selectedCall?.extracted.matchedDeliveryId === selectedNegoDelivery.id && (
                              <span style={{ fontSize: '10.5px', color: '#10b981', fontWeight: 800, backgroundColor: 'rgba(16,185,129,0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                                ?렞 ?듯솕 留ㅼ묶 ???
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                            {customer?.name || '怨좉컼??} ??{site?.name || '?꾩옣'}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <span><strong>?곸감:</strong> {selectedNegoDelivery.originAddress || '蹂몄궗 二쇨린??} ({selectedNegoDelivery.loadingDate || '-'})</span>
                            <span>??/span>
                            <span><strong>?섏감:</strong> {selectedNegoDelivery.destinationAddress || '?꾩옣 二쇱냼'} ({selectedNegoDelivery.unloadingDate || '-'})</span>
                          </div>
                          {selectedNegoDelivery.memo && (
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                              硫붾え: {selectedNegoDelivery.memo}
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>?꾩옱 ?깅줉 ?댁넚鍮?/div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#10b981' }}>
                            ??selectedNegoDelivery.deliveryCost ? selectedNegoDelivery.deliveryCost.toLocaleString() : '0'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            李⑥쥌: {selectedNegoDelivery.vehicleType || '誘몄???} | ?댁넚?? {selectedNegoDelivery.transportCompany || '誘몄???}
                          </div>
                        </div>
                      </div>

                      {/* 2. 湲??묒닔???댁넚???묒쓽 ?댁뿭 */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h4 style={{ fontSize: '13px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                            <FileText size={14} /> ?댁넚?щ퀎 寃ъ쟻 諛??묒쓽 ?꾪솴 ({currentNegos.length}嫄?
                          </h4>
                        </div>

                        {currentNegos.length === 0 ? (
                          <div style={{ padding: '20px', textAlign: 'center', backgroundColor: 'var(--bg-body)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '12px' }}>
                            ?꾩쭅 ?깅줉???댁넚???묒쓽 ?댁뿭???놁뒿?덈떎. ?꾨옒 ?쇱뿉??泥?寃ъ쟻???깅줉?섍굅???듯솕瑜??뺤젙?섏떗?쒖삤.
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                            {currentNegos.map(n => {
                              const isConfirmed = n.status === 'CONFIRMED';
                              const isRejected = n.status === 'REJECTED';
                              return (
                                <div
                                  key={n.id}
                                  style={{
                                    padding: '12px', borderRadius: '8px', border: isConfirmed ? '2px solid #10b981' : isRejected ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border-color)',
                                    backgroundColor: isConfirmed ? 'rgba(16,185,129,0.08)' : isRejected ? 'rgba(239,68,68,0.03)' : 'var(--bg-body)',
                                    display: 'flex', flexDirection: 'column', gap: '6px'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                      {n.transportCompanyName}
                                    </span>
                                    <span style={{
                                      fontSize: '10.5px', padding: '2px 6px', borderRadius: '4px', fontWeight: 800,
                                      backgroundColor: isConfirmed ? '#10b981' : isRejected ? '#ef4444' : '#2563eb',
                                      color: '#ffffff'
                                    }}>
                                      {isConfirmed ? '?뺤젙/?숈같' : isRejected ? '寃곕젹' : '?묒쓽以?}
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                                    <span>李⑥쥌: <strong>{n.vehicleType}</strong></span>
                                    <span>?쒖떆: <strong style={{ color: '#ef4444' }}>??n.proposedCost.toLocaleString()}</strong></span>
                                    <span>紐⑺몴: <strong style={{ color: '#10b981' }}>??n.targetCost.toLocaleString()}</strong></span>
                                  </div>

                                  {n.specialTerms && (
                                    <div style={{ fontSize: '11px', color: '#d97706', backgroundColor: 'rgba(217,119,6,0.1)', padding: '4px 6px', borderRadius: '4px' }}>
                                      ?뱀빟: {n.specialTerms}
                                    </div>
                                  )}

                                  {n.callSummary && (
                                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                                      {n.callSummary}
                                    </div>
                                  )}

                                  {!isConfirmed && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                                      <button
                                        type="button"
                                        className="btn-primary"
                                        onClick={() => handleConfirmNegotiation(n)}
                                        style={{ padding: '6px 12px', fontSize: '11.5px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                      >
                                        <Check size={13} /> ??議곌굔?쇰줈 諛곗감 ?뺤젙
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* 3. ?좉퇋 ?댁넚??寃ъ쟻 諛??듯솕 ?묒쓽 湲곕줉 ??(?뚯옣 3.4 ?곹븯 ?몃줈 ?ㅽ깮 ?덉씠?꾩썐) */}
                      <div style={{
                        backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '8px',
                        padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h4 style={{ fontSize: '13px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Plus size={14} /> ?댁넚???듯솕 寃ъ쟻 諛??묒쓽 議곌굔
                          </h4>
                          {selectedCall && (
                            <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 700 }}>
                              AI 異붿텧 ?댁슜 ?먮룞 ?낅젰??
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                          {/* 1. ?묒쓽 ?댁넚??*/}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>?묒쓽 ?댁넚??*</label>
                            <select
                              value={negoCompanyId}
                              onChange={e => setNegoCompanyId(e.target.value)}
                              style={{
                                padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700
                              }}
                            >
                              <option value="">?댁넚???좏깮</option>
                              {transportCompanies.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.contact || '?곕씫泥섏뾾??})</option>
                              ))}
                            </select>
                          </div>

                          {/* 2. ?쒖븞 李⑥쥌 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>?쒖븞 李⑥쥌</label>
                            <select
                              value={negoVehicleType}
                              onChange={e => setNegoVehicleType(e.target.value)}
                              style={{
                                padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700
                              }}
                            >
                              {VEHICLE_TYPE_OPTIONS.map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </div>

                          {/* 3. ?댁넚???쒖떆媛 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>?댁넚???쒖떆 湲덉븸 (??</label>
                            <input
                              type="number"
                              value={negoProposedCost || ''}
                              onChange={e => setNegoProposedCost(Number(e.target.value))}
                              placeholder="?? 120000"
                              style={{
                                padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700
                              }}
                            />
                          </div>

                          {/* 4. ?뱀궗 紐⑺몴媛 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>?뱀궗 紐⑺몴 湲덉븸 (??</label>
                            <input
                              type="number"
                              value={negoTargetCost || ''}
                              onChange={e => setNegoTargetCost(Number(e.target.value))}
                              placeholder="?? 100000"
                              style={{
                                padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                          {/* ?뱀빟 ?ы빆 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>?좎쬆/?뚯감 ?뱀빟 硫붾え</label>
                            <input
                              type="text"
                              value={negoSpecialTerms}
                              onChange={e => setNegoSpecialTerms(e.target.value)}
                              placeholder="?? ?뚯감鍮?50%, ?쇨컙 2留뚯썝 ?좎쬆..."
                              style={{
                                padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px'
                              }}
                            />
                          </div>

                          {/* ?듯솕 ?댁슜 ?붿빟 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>?듯솕 諛??묒쓽 ?댁슜 ?붿빟</label>
                            <input
                              type="text"
                              value={negoCallSummary}
                              onChange={e => setNegoCallSummary(e.target.value)}
                              placeholder="?? ?댁씪 ?ㅼ쟾 08???곸감 媛?ν븯?ㅺ퀬 ?뚯떊諛쏆쓬..."
                              style={{
                                padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px'
                              }}
                            />
                          </div>
                        </div>

                        {/* ?고븯???깅줉 諛?1?대┃ 諛곗감 ?뺤젙 踰꾪듉援?*/}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleSaveNegotiation}
                            style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Check size={14} /> ?묒쓽 ?댁슜留????
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={handleConfirmCurrentForm}
                            style={{
                              padding: '8px 20px', fontSize: '12.5px', fontWeight: 800,
                              backgroundColor: '#10b981', borderColor: '#10b981', color: '#ffffff',
                              display: 'inline-flex', alignItems: 'center', gap: '6px'
                            }}
                          >
                            <CheckCircle size={15} /> 狩???議곌굔?쇰줈 諛곗감 諛섏쁺 諛??뺤젙
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* ??3: ?붾쭚 ?댁넚猷????諛?留ㅼ엯 吏湲??붿껌 (Z-?⑦꽩 4?④퀎 吏곷Т ?꾧껐 ?숈꽑) */}
      {activeTab === 'RECONCILIATION' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* ?????????????? ??醫뚯긽??(Start/Scope) & ???곗긽??(Input/Pipeline) Z-?⑦꽩 2???덉씠?꾩썐 ?????????????? */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(520px, 1.4fr) minmax(360px, 1fr)',
            gap: '14px',
            alignItems: 'stretch'
          }}>
            
            {/* ??醫뚯륫 ?곷떒 [START / SCOPE]: ?뺤궛 ???踰붿쐞 ?ㅼ젙 */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              {/* ?ㅼ퐫???ㅻ뜑 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={15} color="var(--primary)" /> ?뺤궛 踰붿쐞 ?ㅼ젙
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  湲곌컙 諛??댁넚???ㅼ퐫??吏??
                </span>
              </div>

              {/* 1. ?뺤궛 ?곗썡 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  ?뺤궛 ?곗썡:
                </label>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {[
                    { label: '26??7??, key: '2026-07' },
                    { label: '26??8??, key: '2026-08' },
                    { label: '?뱀썡', key: 'THIS_MONTH' },
                    { label: '?꾩썡', key: 'LAST_MONTH' },
                    { label: '?꾩껜', key: 'ALL' }
                  ].map(b => (
                    <button
                      key={b.key}
                      onClick={() => handleSetReconDatePreset(b.key as any)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '4px',
                        border: '1px solid',
                        borderColor: (b.key === '2026-07' && reconStartDate === '2026-07-01' && reconEndDate === '2026-07-31') ||
                                     (b.key === '2026-08' && reconStartDate === '2026-08-01' && reconEndDate === '2026-08-31')
                                      ? 'var(--primary)' : 'var(--border-color)',
                        backgroundColor: (b.key === '2026-07' && reconStartDate === '2026-07-01' && reconEndDate === '2026-07-31') ||
                                         (b.key === '2026-08' && reconStartDate === '2026-08-01' && reconEndDate === '2026-08-31')
                                          ? 'rgba(59,130,246,0.12)' : 'var(--bg-body)',
                        color: (b.key === '2026-07' && reconStartDate === '2026-07-01' && reconEndDate === '2026-07-31') ||
                               (b.key === '2026-08' && reconStartDate === '2026-08-01' && reconEndDate === '2026-08-31')
                                ? 'var(--primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {b.label}
                    </button>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: 'var(--bg-body)', padding: '2px 5px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                    <input
                      type="date"
                      value={reconStartDate}
                      onChange={e => setReconStartDate(e.target.value)}
                      style={{ padding: '2px 4px', borderRadius: '3px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '11px' }}
                    />
                    <span style={{ fontSize: '11px' }}>~</span>
                    <input
                      type="date"
                      value={reconEndDate}
                      onChange={e => setReconEndDate(e.target.value)}
                      style={{ padding: '2px 4px', borderRadius: '3px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '11px' }}
                    />
                  </div>
                </div>
              </div>

              {/* 2. ?뺤궛 ?댁넚???좏깮 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  ?뺤궛 ?댁넚??
                </label>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setSelectedReconCompany('ALL')}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '5px',
                      border: '1px solid',
                      borderColor: selectedReconCompany === 'ALL' ? 'var(--primary)' : 'var(--border-color)',
                      backgroundColor: selectedReconCompany === 'ALL' ? 'rgba(59,130,246,0.12)' : 'var(--bg-body)',
                      color: selectedReconCompany === 'ALL' ? 'var(--primary)' : 'var(--text-primary)',
                      fontWeight: selectedReconCompany === 'ALL' ? 800 : 500,
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span>?꾩껜 ?댁넚??/span>
                    <span style={{ padding: '1px 4px', borderRadius: '8px', fontSize: '10px', fontWeight: 800, backgroundColor: 'rgba(59,130,246,0.2)', color: 'var(--primary)' }}>
                      誘몄?湲?{unpaidStatsByCompany.ALL?.unpaid || 0}嫄?
                    </span>
                  </button>

                  {[
                    { name: '寃쎄린', label: '寃쎄린' },
                    { name: '?섏젣??, label: '?섏젣?? },
                    { name: '?먯씤', label: '?먯씤 (?좎젣??' }
                  ].map(comp => {
                    const stat = unpaidStatsByCompany[comp.name] || { total: 0, unpaid: 0, unpaidCost: 0 };
                    const isSelected = selectedReconCompany === comp.name;
                    return (
                      <button
                        key={comp.name}
                        onClick={() => setSelectedReconCompany(comp.name)}
                        style={{
                          padding: '4px 9px',
                          borderRadius: '5px',
                          border: '1px solid',
                          borderColor: isSelected ? 'var(--primary)' : 'var(--border-color)',
                          backgroundColor: isSelected ? 'rgba(59,130,246,0.12)' : 'var(--bg-body)',
                          color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                          fontWeight: isSelected ? 800 : 500,
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <span>{comp.label}</span>
                        <span style={{
                          padding: '1px 4px',
                          borderRadius: '8px',
                          fontSize: '10px',
                          fontWeight: 800,
                          backgroundColor: stat.unpaid > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                          color: stat.unpaid > 0 ? '#dc2626' : '#16a34a'
                        }}>
                          {stat.unpaid}嫄?
                        </span>
                      </button>
                    );
                  })}

                  <select
                    value={selectedReconCompany}
                    onChange={e => setSelectedReconCompany(e.target.value)}
                    style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '11px', height: '26px' }}
                  >
                    <option value="ALL">湲고? ?댁넚??..</option>
                    {transportCompanies.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. 吏湲??곹깭 & 議고쉶 踰꾪듉 */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px dashed var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>吏湲??곹깭:</span>
                  {(() => {
                    const companyStats = unpaidStatsByCompany[selectedReconCompany] || unpaidStatsByCompany.ALL;
                    const unpaidCount = companyStats?.unpaid || 0;
                    const paidCount = (companyStats?.total || 0) - unpaidCount;
                    const totalCount = companyStats?.total || 0;

                    return [
                      { key: 'UNPAID', label: `誘몄셿猷?(${unpaidCount}嫄?` },
                      { key: 'PAID', label: `吏湲됱슂泥??꾨즺 (${paidCount}嫄?` },
                      { key: 'ALL', label: `?꾩껜 (${totalCount}嫄?` }
                    ].map(p => (
                      <button
                        key={p.key}
                        onClick={() => setReconPaymentFilter(p.key as any)}
                        style={{
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: reconPaymentFilter === p.key ? 800 : 500,
                          borderRadius: '4px',
                          border: '1px solid',
                          borderColor: reconPaymentFilter === p.key ? (p.key === 'UNPAID' ? '#dc2626' : 'var(--primary)') : 'var(--border-color)',
                          backgroundColor: reconPaymentFilter === p.key ? (p.key === 'UNPAID' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)') : 'var(--bg-body)',
                          color: reconPaymentFilter === p.key ? (p.key === 'UNPAID' ? '#dc2626' : 'var(--primary)') : 'var(--text-muted)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {p.label}
                      </button>
                    ));
                  })()}
                </div>

                <button
                  onClick={handleReconSearch}
                  className="btn-primary"
                  style={{ padding: '5px 14px', fontSize: '12px', fontWeight: 800, borderRadius: '5px', display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                >
                  <Search size={13} /> 議고쉶
                </button>
              </div>
            </div>

            {/* ???곗륫 ?곷떒 [INPUT / PIPELINE]: ?곗씠???좎엯 ?뚯씠?꾨씪??*/}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Upload size={15} color="var(--primary)" /> 嫄곕옒紐낆꽭???곗씠???좎엯
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  嫄곕옒紐낆꽭????1:1 ?먮룞 ???
                </span>
              </div>

              {/* 硫붿씤 ?≪뀡 踰꾪듉: 嫄곕옒紐낆꽭???낅줈??& ?먮룞???*/}
              <input type="file" ref={fileInputRef} onChange={handleExcelFileUpload} accept=".xlsx, .xls, .csv" style={{ display: 'none' }} />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary"
                style={{
                  padding: '12px 18px',
                  fontSize: '13.5px',
                  fontWeight: 900,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 3px 10px rgba(59,130,246,0.3)',
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: 'var(--primary)',
                  color: '#fff'
                }}
              >
                <Upload size={16} /> 嫄곕옒紐낆꽭???낅줈??& ?먮룞 ???
              </button>

              {/* ?섎떒 ?뚯씠?꾨씪??蹂댁“ 踰꾪듉援?*/}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                <button
                  onClick={handleDownloadExcelTemplate}
                  style={{
                    padding: '6px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '5px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-body)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <FileSpreadsheet size={12} /> ?묒떇 ?ㅼ슫濡쒕뱶
                </button>

                <button
                  onClick={handleExportReconciliationReport}
                  style={{
                    padding: '6px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '5px',
                    border: '1px solid rgba(16,185,129,0.4)',
                    backgroundColor: 'rgba(16,185,129,0.1)',
                    color: '#10b981',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Download size={12} /> ???由ы룷??
                </button>

                <button
                  onClick={async () => {
                    const targetYm = reconStartDate.slice(0, 7);
                    const compId = selectedReconCompany === 'ALL' ? undefined : transportCompanies.find(c => c.name === selectedReconCompany)?.id;
                    try {
                      const count = await convertReconciledDeliveriesToSettlement(targetYm, compId);
                      if (count > 0) {
                        showToast(`????꾨즺 諛곗감 ${count}嫄댁씠 ?붾쭚 留ㅼ엯 ?뺤궛 ??μ쑝濡??닿??섏뿀?듬땲??`);
                      } else {
                        showToast(`[${targetYm}] ?곗썡??????꾨즺 ?곹깭??誘몄씠愿 諛곗감嫄댁씠 ?놁뒿?덈떎.`, 'warning');
                      }
                    } catch (err: any) {
                      showErrorModal(`留ㅼ엯 ?뺤궛 ?닿? ?ㅽ뙣: ${err?.message || err}`);
                    }
                  }}
                  style={{
                    padding: '6px 8px',
                    fontSize: '11px',
                    fontWeight: 800,
                    borderRadius: '5px',
                    border: '1px solid rgba(99,102,241,0.4)',
                    backgroundColor: 'rgba(99,102,241,0.12)',
                    color: '#6366f1',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  留ㅼ엯?뺤궛 ?닿?
                </button>
              </div>
            </div>

          </div>


          {/* ?????????????? ??以묒븰 蹂몃Ц (Body / Inspection): 怨좊???1:1 ????묒뾽? 洹몃━??(?붾㈃??85% ?뺣낫) ?????????????? */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* ?곹깭 ?꾪꽣 諛곗? 諛?+ ?쇨큵 ?뱀씤 踰꾪듉 + 寃?됱갹 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { key: 'ALL', label: '?꾩껜', count: reconPairs.length || completedDeliveriesForRecon.length, color: 'var(--text-primary)', bg: 'var(--bg-body)' },
                  { key: 'MATCHED', label: '????쇱튂', count: reconStats.matchedCount, color: '#16a34a', bg: 'rgba(34,197,94,0.1)' },
                  { key: 'MISMATCH', label: '湲덉븸 遺덉씪移?, count: reconStats.mismatchCount, color: '#ca8a04', bg: 'rgba(234,179,8,0.12)' },
                  { key: 'EXCEL_ONLY', label: '泥?뎄 ?⑤룆', count: reconPairs.filter(p => p.matchStatus === 'EXCEL_ONLY').length, color: '#dc2626', bg: 'rgba(239,68,68,0.1)' },
                  { key: 'SYSTEM_ONLY', label: '?쒖뒪???⑤룆', count: reconPairs.filter(p => p.matchStatus === 'SYSTEM_ONLY').length, color: 'var(--text-muted)', bg: 'var(--bg-body)' },
                  { key: 'EXCLUDED', label: '?ㅼ껌援??쒖쇅', count: reconStats.excludedCount, color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.1)' },
                  { key: 'PAYMENT_REQUESTED', label: '吏湲됱슂泥??꾨즺', count: reconStats.paymentRequestedCount, color: '#2563eb', bg: 'rgba(37,99,235,0.1)' }
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setReconStatusFilter(t.key as any)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: reconStatusFilter === t.key ? t.color : 'var(--border-color)',
                      backgroundColor: reconStatusFilter === t.key ? t.bg : 'var(--bg-body)',
                      color: reconStatusFilter === t.key ? t.color : 'var(--text-secondary)',
                      fontWeight: reconStatusFilter === t.key ? 800 : 500,
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span>{t.label}</span>
                    <strong style={{ fontSize: '11px', opacity: 0.9 }}>{t.count}</strong>
                  </button>
                ))}

                {/* 湲덉븸 遺덉씪移?/ ?좎쬆 嫄??쇨큵 ?뱀씤 踰꾪듉 */}
                {reconStats.mismatchCount > 0 && (
                  <button
                    onClick={handleApproveAllMismatches}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      border: '1px solid #ca8a04',
                      backgroundColor: 'rgba(234,179,8,0.18)',
                      color: '#a16207',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    ?좎쬆 {reconStats.mismatchCount}嫄??쇨큵 ?뱀씤
                  </button>
                )}
              </div>

              {/* 寃?됱갹 */}
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="諛곗감ID / ?꾩옣 / ?낆껜 / 湲곗궗 寃??.."
                  value={reconSearchQuery}
                  onChange={e => setReconSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '4px 8px 4px 26px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '11.5px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* ?뚮┝ 硫붿떆吏 */}
            {reconNotificationMsg && (
              <div style={{ fontSize: '12px', padding: '6px 10px', backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: '6px', color: 'var(--primary)', fontWeight: 600 }}>
                {reconNotificationMsg}
              </div>
            )}

            {/* 1:1 ???洹몃━???뚯씠釉?(???믪씠 42px / ?쒕늿??15嫄?議곕쭩) */}
            <div style={{ maxHeight: 'calc(100vh - 320px)', minHeight: '400px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                  {/* 1?? ?遺꾨쪟 ?곸뿭 ?ㅻ뜑 (?곹깭 | 諛곗감?뺣낫 3??| 鍮꾧탳 | 泥?뎄?뺣낫 3??| 李⑥븸 | 議곗튂) */}
                  <tr style={{ backgroundColor: 'var(--bg-body)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                    <th rowSpan={2} style={{ padding: '6px 8px', width: '65px', textAlign: 'center', verticalAlign: 'middle', borderRight: '1px solid var(--border-color)', fontWeight: 800 }}>
                      ?곹깭
                    </th>
                    <th colSpan={3} style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 800, backgroundColor: 'rgba(59, 130, 246, 0.08)', color: 'var(--primary)', borderRight: '1px solid var(--border-color)' }}>
                      諛곗감?뺣낫
                    </th>
                    <th rowSpan={2} style={{ padding: '6px 4px', width: '36px', textAlign: 'center', verticalAlign: 'middle', borderRight: '1px solid var(--border-color)', fontWeight: 800, color: 'var(--text-muted)' }}>
                      鍮꾧탳
                    </th>
                    <th colSpan={3} style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 800, backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#10b981', borderRight: '1px solid var(--border-color)' }}>
                      泥?뎄?뺣낫
                    </th>
                    <th rowSpan={2} style={{ padding: '6px 8px', width: '120px', textAlign: 'center', verticalAlign: 'middle', borderRight: '1px solid var(--border-color)', fontWeight: 800 }}>
                      李⑥븸
                    </th>
                    <th rowSpan={2} style={{ padding: '6px 8px', width: '130px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 800 }}>
                      議곗튂
                    </th>
                  </tr>

                  {/* 2?? ?몃? ?꾨뱶 ?ㅻ뜑 (諛곗감?뺣낫 3??+ 泥?뎄?뺣낫 3?? */}
                  <tr style={{ backgroundColor: 'var(--bg-body)', borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '11px' }}>
                    {/* 諛곗감?뺣낫 ?섏쐞 */}
                    <th style={{ padding: '6px 8px', width: '85px', backgroundColor: 'rgba(59, 130, 246, 0.03)' }}>
                      ?쇱옄
                    </th>
                    <th style={{ padding: '6px 8px', minWidth: '180px', backgroundColor: 'rgba(59, 130, 246, 0.03)' }}>
                      ?댁뿭 (怨좉컼??/ ?꾩옣 / 湲곗궗)
                    </th>
                    <th style={{ padding: '6px 8px', width: '90px', textAlign: 'right', backgroundColor: 'rgba(59, 130, 246, 0.03)', borderRight: '1px solid var(--border-color)' }}>
                      湲덉븸
                    </th>

                    {/* 泥?뎄?뺣낫 ?섏쐞 */}
                    <th style={{ padding: '6px 8px', width: '85px', backgroundColor: 'rgba(16, 185, 129, 0.03)' }}>
                      泥?뎄???쇱옄
                    </th>
                    <th style={{ padding: '6px 8px', minWidth: '180px', backgroundColor: 'rgba(16, 185, 129, 0.03)' }}>
                      泥?뎄 ?댁뿭 (?꾩옣紐?/ 鍮꾧퀬)
                    </th>
                    <th style={{ padding: '6px 8px', width: '90px', textAlign: 'right', backgroundColor: 'rgba(16, 185, 129, 0.03)', borderRight: '1px solid var(--border-color)' }}>
                      泥?뎄湲덉븸
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reconPairs.length === 0 ? (
                    completedDeliveriesForRecon.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', padding: '50px 10px', color: 'var(--text-muted)' }}>
                          {(() => {
                            const companyStats = unpaidStatsByCompany[selectedReconCompany] || unpaidStatsByCompany.ALL;
                            const unpaidCount = companyStats?.unpaid || 0;
                            const paidCount = (companyStats?.total || 0) - unpaidCount;
                            if (reconPaymentFilter === 'UNPAID' && paidCount > 0) {
                              return `議고쉶??湲곌컙 ??誘몄셿猷???щ??? 諛곗감 ?댁뿭???놁뒿?덈떎. (吏湲됱슂泥??꾨즺??諛곗감 ${paidCount}嫄댁? ?곷떒 [吏湲됱슂泥??꾨즺] ?꾪꽣?먯꽌 ?뺤씤?섏떎 ???덉뒿?덈떎.)`;
                            }
                            return '議고쉶??湲곌컙 ??諛곗감 ?댁뿭???놁뒿?덈떎.';
                          })()}
                        </td>
                      </tr>
                    ) : (
                      completedDeliveriesForRecon
                        .filter(d => {
                          if (reconStatusFilter === 'ALL') return true;
                          if (reconStatusFilter === 'PAYMENT_REQUESTED') return (d as any).reconciliationStatus === 'PAYMENT_REQUESTED';
                          if (reconStatusFilter === 'MATCHED') return (d as any).reconciliationStatus === 'MATCHED' || (d as any).reconciliationStatus === 'RECONCILED';
                          if (reconStatusFilter === 'SYSTEM_ONLY' || reconStatusFilter === 'PENDING') {
                            return !(d as any).reconciliationStatus || (d as any).reconciliationStatus === 'PENDING' || (d as any).reconciliationStatus === 'UNRECONCILED';
                          }
                          return false;
                        })
                        .map(d => {
                          const contract = contracts.find(c => c.id === d.contractId);
                          const customer = contract ? customers.find(c => c.id === contract.customerId) : null;
                          const memoCustomer = d.memo && d.memo.includes('?낆껜:') ? d.memo.split('?낆껜:')[1].split('|')[0].trim() : '';
                          const displayCustomer = customer?.name || memoCustomer || '怨좉컼?щ?吏??;
                          const cost = getEffectiveDeliveryCost(d);
                          const isPaymentReq = (d as any).reconciliationStatus === 'PAYMENT_REQUESTED';
                          const isPaidSettled = (d as any).reconciliationStatus === 'PAID' || (d as any).reconciliationStatus === 'SETTLED' || d.isCostSettled === true;
                          const isMatched = (d as any).reconciliationStatus === 'MATCHED' || (d as any).reconciliationStatus === 'RECONCILED';

                          return (
                            <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)', height: '40px' }}>
                              <td style={{ textAlign: 'center', padding: '6px' }}>
                                {isPaymentReq ? (
                                  <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, backgroundColor: 'rgba(37,99,235,0.12)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.35)', whiteSpace: 'nowrap' }}>
                                    吏湲됱슂泥?
                                  </span>
                                ) : isPaidSettled ? (
                                  <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.35)', whiteSpace: 'nowrap' }}>
                                    吏湲됱셿猷?
                                  </span>
                                ) : isMatched ? (
                                  <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, backgroundColor: 'rgba(34,197,94,0.12)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.35)', whiteSpace: 'nowrap' }}>
                                    ??ъ씪移?
                                  </span>
                                ) : (
                                  <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--bg-body)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                                    ??щ?湲?
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{d.loadingDate || d.requestDate}</td>
                              <td style={{ padding: '6px 10px' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>{displayCustomer}</strong> | {d.destinationAddress || '?꾩갑吏誘몄???} ({d.driverName || '湲곗궗誘몃같??})
                              </td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                                ??cost.toLocaleString()}
                              </td>
                              <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>-</td>
                              {isPaymentReq ? (
                                <td colSpan={4} style={{ textAlign: 'center', padding: '6px 10px', fontSize: '11.5px', backgroundColor: 'rgba(37,99,235,0.03)' }}>
                                  <span style={{ color: '#2563eb', fontWeight: 800 }}>
                                    {d.memo && d.memo.includes('[?듯빀吏湲됱슂泥?') ? d.memo.split(']')[0].replace('[', '') : '留ㅼ엯 吏湲됱슂泥??꾨즺'}
                                  </span>
                                  <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>
                                    {d.paymentRequestedAt ? `(?붿껌?? ${d.paymentRequestedAt.slice(0, 10)})` : ''} | ?뺤젙 ?댁넚猷???(d.deliveryCostConfirmed || cost).toLocaleString()}??(?붾쭚 留ㅼ엯 ?뺤궛 ????깅줉??
                                  </span>
                                </td>
                              ) : isPaidSettled ? (
                                <td colSpan={4} style={{ textAlign: 'center', padding: '6px 10px', fontSize: '11.5px', color: '#10b981', fontWeight: 700, backgroundColor: 'rgba(16,185,129,0.03)' }}>
                                  ?뚭퀎 ?뺤궛 諛?吏湲?吏묓뻾 ?꾨즺 (留ㅼ엯 ?뺤궛 ???諛섏쁺??
                                </td>
                              ) : (
                                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                                  ?곷떒 [?묒? 嫄곕옒紐낆꽭???낅줈?? ??1:1 ??ш? 吏꾪뻾?⑸땲??
                                </td>
                              )}
                              <td style={{ textAlign: 'center', padding: '6px' }}>
                                {isPaymentReq || isPaidSettled ? (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                    ???留덇컧??
                                  </span>
                                ) : (
                                  <button onClick={(e) => handleOpenCostEdit(d, cost, e)} style={{ padding: '2px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', cursor: 'pointer' }}>
                                    湲덉븸?섏젙
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                    )
                  ) : (
                    reconPairs
                      .filter(p => {
                        if (reconStatusFilter === 'ALL') return true;
                        if (reconStatusFilter === 'MATCHED') return p.isReconciled && !p.isExcluded;
                        if (reconStatusFilter === 'MISMATCH') return p.matchStatus === 'MISMATCH';
                        if (reconStatusFilter === 'EXCEL_ONLY') return p.matchStatus === 'EXCEL_ONLY' && !p.isExcluded;
                        if (reconStatusFilter === 'SYSTEM_ONLY') return p.matchStatus === 'SYSTEM_ONLY';
                        if (reconStatusFilter === 'EXCLUDED') return p.isExcluded || p.matchStatus === 'EXCLUDED';
                        if (reconStatusFilter === 'PAYMENT_REQUESTED') return p.matchStatus === 'PAYMENT_REQUESTED';
                        return true;
                      })
                      .sort((a, b) => {
                        // ?뮕 [?ъ옣??吏?? ?댁넚猷????寃곌낵 ??긽 ?좎쭨???ㅻ쫫李⑥닚: 怨쇨굅 ??理쒖떊) ?뺣젹 蹂댁옣
                        const dateA = a.excelRow?.['?뺢퇋?쇱옄'] || a.systemDelivery?.loadingDate || a.systemDelivery?.requestDate || '9999-99-99';
                        const dateB = b.excelRow?.['?뺢퇋?쇱옄'] || b.systemDelivery?.loadingDate || b.systemDelivery?.requestDate || '9999-99-99';
                        if (dateA !== dateB) return dateA.localeCompare(dateB);
                        return (a.pairId || '').localeCompare(b.pairId || '');
                      })
                      .map((pair, pIdx) => {
                        const sys = pair.systemDelivery;
                        const excel = pair.excelRow;
                        const contract = sys ? contracts.find(c => c.id === sys.contractId) : null;
                        const customer = contract ? customers.find(c => c.id === contract.customerId) : null;
                        const memoCustomer = sys?.memo && sys.memo.includes('?낆껜:') ? sys.memo.split('?낆껜:')[1].split('|')[0].trim() : '';
                        const displayCustomer = customer?.name || memoCustomer || '怨좉컼?щ?吏??;

                        const isMatched = pair.isReconciled && !pair.isExcluded;
                        const isMismatch = pair.matchStatus === 'MISMATCH';
                        const isExcelOnly = pair.matchStatus === 'EXCEL_ONLY' && !pair.isExcluded;
                        const isSysOnly = pair.matchStatus === 'SYSTEM_ONLY';
                        const isExcluded = pair.isExcluded || pair.matchStatus === 'EXCLUDED';

                        return (
                          <tr
                            key={pair.pairId || pIdx}
                            onDoubleClick={() => setSelectedReconDetailPair(pair)}
                            title="?붾툝?대┃ ??諛곗감 ?곸꽭 諛?泥?뎄 ?議?紐⑤떖???대┰?덈떎."
                            style={{
                              borderBottom: '1px solid var(--border-color)',
                              backgroundColor: isExcluded ? 'rgba(100,116,139,0.06)' : isMismatch ? 'rgba(234,179,8,0.05)' : isMatched ? 'rgba(34,197,94,0.03)' : isExcelOnly ? 'rgba(239,68,68,0.04)' : 'transparent',
                              height: '42px',
                              cursor: 'pointer'
                            }}
                          >
                            {/* ?곹깭 諛곗? */}
                            <td style={{ textAlign: 'center', padding: '6px', whiteSpace: 'nowrap' }}>
                              {isExcluded ? (
                                <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, backgroundColor: 'rgba(100,116,139,0.15)', color: '#64748b' }}>
                                  ?슟 ?쒖쇅
                                </span>
                              ) : isMatched ? (
                                <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a' }}>
                                  ?윟 ?쇱튂
                                </span>
                              ) : isMismatch ? (
                                <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, backgroundColor: 'rgba(234,179,8,0.18)', color: '#a16207' }}>
                                  ?윞 李⑥븸
                                </span>
                              ) : isExcelOnly ? (
                                <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, backgroundColor: 'rgba(239,68,68,0.15)', color: '#dc2626' }}>
                                  ?뵶 泥?뎄
                                </span>
                              ) : (
                                <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--bg-body)', color: 'var(--text-muted)' }}>
                                  ??諛곗감
                                </span>
                              )}
                            </td>

                            {/* [諛곗감?뺣낫] ?쇱옄 */}
                            <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: sys ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {sys ? (sys.loadingDate || sys.requestDate) : '(誘멸린??'}
                            </td>

                            {/* [諛곗감?뺣낫] ?댁뿭 */}
                            <td style={{ padding: '6px 10px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {sys ? (
                                <>
                                  <strong style={{ color: 'var(--text-primary)' }}>{displayCustomer}</strong> | {sys.destinationAddress || '?꾩갑吏誘몄???}
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>({sys.driverName || '湲곗궗誘몃같??})</span>
                                </>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                              )}
                            </td>

                            {/* [諛곗감?뺣낫] 湲덉븸 */}
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, color: sys ? 'var(--primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {sys ? `??{pair.systemCost.toLocaleString()}` : '-'}
                            </td>

                            {/* VS 湲고샇 */}
                            <td style={{ textAlign: 'center', color: isMatched ? '#16a34a' : isMismatch ? '#ca8a04' : 'var(--text-muted)', fontWeight: 800 }}>
                              {isMatched ? '=' : isMismatch ? '?? : 'VS'}
                            </td>

                            {/* [泥?뎄?뺣낫] ?쇱옄 */}
                            <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: excel ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {excel ? (excel['?뺢퇋?쇱옄'] || excel['?쇱옄'] || excel['?좎쭨'] || excel['?댁넚?쇱옄']) : '(誘멸린??'}
                            </td>

                            {/* [泥?뎄?뺣낫] 泥?뎄 ?댁뿭 */}
                            <td style={{ padding: '6px 10px', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {excel ? (
                                <>
                                  <strong style={{ color: 'var(--text-primary)' }}>{excel['?뺢퇋?섏감吏'] || excel['?꾩옣紐?] || excel['?낆껜紐?] || '?꾩옣誘몄긽'}</strong>
                                  {excel['鍮꾧퀬'] && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>[{excel['鍮꾧퀬']}]</span>}
                                </>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                              )}
                            </td>

                            {/* [泥?뎄?뺣낫] 泥?뎄湲덉븸 */}
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, color: excel ? (isMismatch ? '#ca8a04' : '#16a34a') : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {excel ? `??{pair.excelCost.toLocaleString()}` : '-'}
                            </td>

                            {/* 李⑥븸 */}
                            <td style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {isMismatch ? (
                                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#ca8a04' }}>
                                  {pair.diffCost > 0 ? `+??{pair.diffCost.toLocaleString()}` : `-??{Math.abs(pair.diffCost).toLocaleString()}`}
                                  {pair.surchargeReason && <span style={{ fontSize: '10.5px', display: 'block', color: '#a16207' }}>({pair.surchargeReason})</span>}
                                </span>
                              ) : isExcelOnly ? (
                                <span style={{ fontSize: '11px', color: '#dc2626' }}>泥?뎄 ?⑤룆</span>
                              ) : isSysOnly ? (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>諛곗감 誘몄껌援?/span>
                              ) : (
                                <span style={{ fontSize: '11px', color: '#16a34a' }}>?? (?꾩쟾?쇱튂)</span>
                              )}
                            </td>

                            {/* ?몃씪??議곗튂 踰꾪듉援?*/}
                            <td style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                                {isMismatch && (
                                  <button
                                    onClick={() => handleApproveMismatch(pair.pairId)}
                                    title="泥?뎄 湲덉븸?쇰줈 ?뺤젙?섍퀬 ????꾨즺 泥섎━"
                                    style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 800, borderRadius: '4px', border: '1px solid #ca8a04', backgroundColor: 'rgba(234,179,8,0.15)', color: '#a16207', cursor: 'pointer' }}
                                  >
                                    ??pair.excelCost.toLocaleString()} ?뱀씤
                                  </button>
                                )}

                                {isExcelOnly && (
                                  <>
                                    <button
                                      onClick={() => handleCreateDeliveryFromExcel(pair.pairId)}
                                      title="泥?뎄 ?댁뿭?쇰줈 ?좉퇋 諛곗감瑜??앹꽦?섍퀬 ????꾨즺"
                                      style={{ padding: '3px 6px', fontSize: '10.5px', fontWeight: 700, borderRadius: '4px', border: '1px solid #2563eb', backgroundColor: 'rgba(37,99,235,0.1)', color: '#2563eb', cursor: 'pointer' }}
                                    >
                                      諛곗감?앹꽦
                                    </button>
                                    <button
                                      onClick={() => handleExcludeExcelOnly(pair.pairId)}
                                      title="?ㅼ껌援?嫄댁쑝濡??먮떒?섏뿬 吏湲됱슂泥???곸뿉???쒖쇅"
                                      style={{ padding: '3px 6px', fontSize: '10.5px', fontWeight: 700, borderRadius: '4px', border: '1px solid #dc2626', backgroundColor: 'rgba(239,68,68,0.1)', color: '#dc2626', cursor: 'pointer' }}
                                    >
                                      諛섎젮?쒖쇅
                                    </button>
                                  </>
                                )}

                                {isExcluded && (
                                  <button
                                    onClick={() => handleExcludeExcelOnly(pair.pairId)}
                                    style={{ padding: '3px 6px', fontSize: '10.5px', fontWeight: 700, borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                  >
                                    ?쒖쇅痍⑥냼
                                  </button>
                                )}

                                {isMatched && (
                                  <button
                                    onClick={() => handleTogglePairReconciled(pair.pairId)}
                                    title="????꾨즺 痍⑥냼 (?湲??먮났)"
                                    style={{ padding: '3px 6px', fontSize: '10.5px', fontWeight: 700, borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-muted)', cursor: 'pointer' }}
                                  >
                                    痍⑥냼
                                  </button>
                                )}

                                <button
                                  onClick={() => setSelectedReconDetailPair(pair)}
                                  title="諛곗감 ?곸꽭 諛????寃??紐⑤떖 ?닿린"
                                  style={{ padding: '3px 6px', fontSize: '10.5px', fontWeight: 700, borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                >
                                  ?곸꽭
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ?????????????? ???고븯??(Terminal Action): ?李⑤?議??⑷퀎 寃利?諛?理쒖쥌 ?꾧껐 諛?(?붾㈃ 理쒗븯??怨좎젙) ?????????????? */}
          <div style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 10,
            backgroundColor: 'var(--bg-card)',
            border: '1.5px solid var(--border-color)',
            borderRadius: '10px',
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.12)',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            {/* 醫뚯륫: 4? ?李⑤?議?寃利??⑷퀎??(???????遺꾧린) */}
            {!reconStats.isPairMode ? (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>諛곗감 ?댁넚猷??⑷퀎:</span>
                  <strong style={{ fontSize: '14px', color: 'var(--primary)' }}>??reconStats.totalCost.toLocaleString()}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({reconStats.totalCount}嫄?</span>
                </div>
                <div style={{ padding: '3px 10px', borderRadius: '4px', backgroundColor: 'rgba(100,116,139,0.1)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11.5px', fontWeight: 600 }}>
                  ????湲?(?곗긽??嫄곕옒紐낆꽭???낅줈????1:1 ????쒖옉)
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>泥?뎄珥앹븸:</span>
                  <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>??reconStats.totalCost.toLocaleString()}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({reconStats.totalCount}嫄?</span>
                </div>

                <span style={{ color: 'var(--text-muted)' }}>=</span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>吏湲??뺤젙:</span>
                  <strong style={{ fontSize: '14px', color: '#16a34a' }}>??reconStats.matchedCost.toLocaleString()}</strong>
                  <span style={{ fontSize: '11px', color: '#16a34a' }}>({reconStats.matchedCount}嫄?</span>
                </div>

                <span style={{ color: 'var(--text-muted)' }}>+</span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>諛섎젮쨌?쒖쇅:</span>
                  <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>??reconStats.excludedCost.toLocaleString()}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({reconStats.excludedCount}嫄?</span>
                </div>

                {(() => {
                  const balanceDiff = reconStats.totalCost - (reconStats.matchedCost + reconStats.excludedCost);
                  if (balanceDiff === 0) {
                    return (
                      <div style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#16a34a', fontSize: '11px', fontWeight: 800 }}>
                        ?李?李⑥븸 ?? (?꾩쟾 ?쇱튂)
                      </div>
                    );
                  }
                  return (
                    <div style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#dc2626', fontSize: '11px', fontWeight: 800 }}>
                      ?李?李⑥븸 ??Math.abs(balanceDiff).toLocaleString()} ({balanceDiff > 0 ? '誘명솗???붿븸' : '珥덇낵 ?뺤젙'})
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ?곗륫: ??理쒖쥌 ?꾧껐 踰꾪듉 (?듯빀 留ㅼ엯 吏湲됱슂泥??앹꽦) */}
            <button
              onClick={handleExecuteBundlePaymentRequest}
              disabled={reconStats.matchedCount === 0}
              style={{
                padding: '10px 22px',
                fontSize: '13.5px',
                fontWeight: 900,
                borderRadius: '8px',
                border: 'none',
                backgroundColor: reconStats.matchedCount > 0 ? '#2563eb' : '#94a3b8',
                color: '#fff',
                cursor: reconStats.matchedCount > 0 ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: reconStats.matchedCount > 0 ? '0 4px 14px rgba(37,99,235,0.35)' : 'none',
                whiteSpace: 'nowrap'
              }}
            >
              <Send size={15} /> ????꾨즺 {reconStats.matchedCount}嫄??듯빀 吏湲됱슂泥??앹꽦 ??
            </button>
          </div>

        </div>
      )}

      {/* ?섎룞 諛곗감 紐⑤떖 */}
      {showManualModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0' }}>?슋 ?섎룞 諛곗감 ?좉퇋 ?앹꽦</h3>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>諛곗감 援щ텇???좏삎</label>
              <select value={manualCategory} onChange={e => setManualCategory(e.target.value as any)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }}>
                <option value="異쒓퀬">異쒓퀬</option>
                <option value="?낃퀬">?낃퀬</option>
                <option value="援먰솚">援먰솚</option>
                <option value="諛섎궔">諛섎궔</option>
                <option value="?뺣퉬">?뺣퉬</option>
                <option value="?대룞">?대룞</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>異쒕컻吏 (?곸감吏)</label>
                <input type="text" value={manualOrigin} onChange={e => setManualOrigin(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>?꾩갑吏 (?섏감吏)</label>
                <input type="text" value={manualDestination} onChange={e => setManualDestination(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button onClick={() => setShowManualModal(false)} className="btn-secondary">痍⑥냼</button>
              <button onClick={handleSaveManualDispatch} className="btn-primary" style={{ fontWeight: 800 }}>諛곗감 ?앹꽦 ???/button>
            </div>
          </div>
        </div>
      )}

      {/* ?뮕 [?ъ옣??吏?? 諛곗감 ?댁넚猷?湲덉븸 ?섏젙 紐⑤떖 (DB ?숆린?? */}
      {showCostEditModal && editingDelivery && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 900, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ?뮥 諛곗감 ?댁넚猷?湲덉븸 ?섏젙
              </h3>
              <button onClick={() => setShowCostEditModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>??/button>
            </div>

            <div style={{ backgroundColor: 'var(--bg-body)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px', fontSize: '12.5px' }}>
              <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '4px' }}>?뱦 諛곗감ID: {editingDelivery.id}</div>
              <div>?뱧 ?섏감吏: {editingDelivery.destinationAddress || '誘몄???}</div>
              <div>?슋 湲곗궗紐? {editingDelivery.driverName || '誘몄???}</div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, marginBottom: '6px', display: 'block', color: 'var(--text-primary)' }}>
                蹂寃쏀븷 ?댁넚猷?湲덉븸 (??
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  value={editingCostInput}
                  onChange={e => setEditingCostInput(Number(e.target.value))}
                  placeholder="?? 0"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 30px',
                    borderRadius: '8px',
                    border: '2px solid var(--primary)',
                    backgroundColor: 'var(--bg-body)',
                    color: 'var(--text-primary)',
                    fontSize: '15px',
                    fontWeight: 900,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 900, color: 'var(--primary)' }}>??/span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
                ?뮕 蹂寃?利됱떆 ?먭꺽 DB(Supabase) `deliveries` ?뚯씠釉붿쓽 `deliveryCost`????λ릺怨?諛섏쁺?⑸땲??
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowCostEditModal(false)}
                style={{ padding: '8px 14px', borderRadius: '7px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 700, fontSize: '12.5px' }}
              >
                痍⑥냼
              </button>
              <button
                onClick={handleSaveDeliveryCost}
                style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', backgroundColor: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 900, fontSize: '13px', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
              >
                ?뮶 DB 湲덉븸 ?섏젙 ???
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ?뮕 [?ъ옣??吏?? ?댁넚猷?????곸꽭 諛?遺덉씪移?寃??紐⑤떖 (???붾툝?대┃ ???쒖텧) */}
      {selectedReconDetailPair && (() => {
        const pair = selectedReconDetailPair;
        const sys = pair.systemDelivery;
        const excel = pair.excelRow;
        const contract = sys ? contracts.find(c => c.id === sys.contractId) : null;
        const customer = contract ? customers.find(c => c.id === contract.customerId) : null;
        const site = contract ? sites.find(s => s.id === contract.siteId) : null;
        const memoCustomer = sys?.memo && sys.memo.includes('?낆껜:') ? sys.memo.split('?낆껜:')[1].split('|')[0].trim() : '';
        const displayCustomer = customer?.name || memoCustomer || (excel ? excel['?낆껜紐?] : '怨좉컼?щ?吏??);

        const isMatched = pair.isReconciled && !pair.isExcluded;
        const isMismatch = pair.matchStatus === 'MISMATCH';
        const isExcelOnly = pair.matchStatus === 'EXCEL_ONLY' && !pair.isExcluded;
        const isSysOnly = pair.matchStatus === 'SYSTEM_ONLY';

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99999, padding: '20px'
          }}>
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '24px',
              width: '100%',
              maxWidth: '840px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}>
              {/* 紐⑤떖 ?ㅻ뜑 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 900, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ?슊 諛곗감 ?곸꽭 諛??댁넚猷????寃??
                  </h3>
                  {isMismatch && (
                    <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 800, backgroundColor: 'rgba(234,179,8,0.18)', color: '#ca8a04' }}>
                      ?윞 李⑥븸 遺덉씪移?({pair.diffCost > 0 ? `+??{pair.diffCost.toLocaleString()}` : `-??{Math.abs(pair.diffCost).toLocaleString()}`})
                    </span>
                  )}
                  {isMatched && (
                    <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 800, backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a' }}>
                      ?윟 ????쇱튂 (?? ?꾩쟾?쇱튂)
                    </span>
                  )}
                  {isExcelOnly && (
                    <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 800, backgroundColor: 'rgba(239,68,68,0.15)', color: '#dc2626' }}>
                      ?뵶 泥?뎄???⑤룆 (諛곗감 誘몃컻寃?
                    </span>
                  )}
                  {isSysOnly && (
                    <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 800, backgroundColor: 'var(--bg-body)', color: 'var(--text-muted)' }}>
                      ???쒖뒪??諛곗감 ?⑤룆 (泥?뎄 誘몃룄李?
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedReconDetailPair(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
                >
                  ??
                </button>
              </div>

              {/* ?곷떒 ?李⑤?議?鍮꾧탳 諛?*/}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                gap: '12px',
                alignItems: 'center',
                backgroundColor: 'var(--bg-body)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '14px 20px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>?쒖뒪???깅줉 諛곗감 湲덉븸</span>
                  <span style={{ fontSize: '20px', fontWeight: 900, color: sys ? 'var(--primary)' : 'var(--text-muted)' }}>
                    {sys ? `??{pair.systemCost.toLocaleString()}?? : '諛곗감 ?놁쓬'}
                  </span>
                </div>
                <div style={{ textAlign: 'center', padding: '0 16px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 900, color: isMatched ? '#16a34a' : isMismatch ? '#ca8a04' : 'var(--text-muted)' }}>
                    {isMatched ? '=' : isMismatch ? '?? : 'VS'}
                  </span>
                  {isMismatch && (
                    <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#ca8a04', marginTop: '2px' }}>
                      李⑥븸: {pair.diffCost > 0 ? `+??{pair.diffCost.toLocaleString()}` : `-??{Math.abs(pair.diffCost).toLocaleString()}`}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>?댁넚??泥?뎄 ?댁넚鍮?/span>
                  <span style={{ fontSize: '20px', fontWeight: 900, color: excel ? (isMismatch ? '#ca8a04' : '#16a34a') : 'var(--text-muted)' }}>
                    {excel ? `??{pair.excelCost.toLocaleString()}?? : '泥?뎄 ?놁쓬'}
                  </span>
                </div>
              </div>

              {pair.surchargeReason && (
                <div style={{
                  padding: '8px 14px',
                  backgroundColor: 'rgba(234,179,8,0.1)',
                  border: '1px solid rgba(234,179,8,0.3)',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: '#a16207',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>?뮕</span>
                  <span>?좎쬆 諛?李⑥븸 ?ъ쑀 遺꾩꽍: <strong>{pair.surchargeReason}</strong></span>
                </div>
              )}

              {/* 2??鍮꾧탳 蹂몃Ц (醫뚯륫: ?쒖뒪??諛곗감 ?먯옣 / ?곗륫: ?댁넚??泥?뎄 ?댁뿭) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* 醫뚯륫: ?쒖뒪??諛곗감 ?댁뿭 */}
                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '16px',
                  backgroundColor: 'var(--bg-body)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    ?뱥 ?쒖뒪??諛곗감 ?먯옣
                  </div>
                  {sys ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>諛곗감 踰덊샇 / ID</span>
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{sys.id}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>諛곗감 ?쇱옄</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {sys.loadingDate || sys.requestDate} {sys.loadingTimeSlot ? `(${sys.loadingTimeSlot})` : ''}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>諛곗감 援щ텇 / ?곹깭</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {sys.type === 'OUTBOUND' ? '異쒓퀬' : sys.type === 'INBOUND' ? '?뚯닔' : sys.type === 'EXCHANGE' ? '援먰솚' : sys.type} ({sys.status === 'DELIVERED' ? '?댁넚?꾨즺' : sys.status})
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>怨좉컼??(嫄곕옒泥?</span>
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{displayCustomer}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>?꾩옣紐?/span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{site?.name || sys.destinationAddress || '-'}</span>
                      </div>
                      <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>?곸감吏 (異쒕컻)</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sys.originAddress || '蹂몄궗 二쇨린??}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>?섏감吏 (?꾩갑)</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sys.destinationAddress || '-'}</div>
                      </div>
                      {sys.viaDropoffAddress && (
                        <div>
                          <div style={{ color: '#a16207', fontWeight: 600, marginBottom: '2px' }}>寃쎌쑀吏</div>
                          <div style={{ fontWeight: 700, color: '#ca8a04' }}>{sys.viaDropoffAddress} {sys.viaDropoffName ? `(${sys.viaDropoffName})` : ''}</div>
                        </div>
                      )}
                      <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>諛곗젙 湲곗궗 / 李⑤웾</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {sys.driverName || '湲곗궗誘몃같??} {sys.driverContact ? `(${sys.driverContact})` : ''} | {sys.vehicleNo || '-'} ({sys.vehicleType || '-'})
                        </span>
                      </div>
                      {sys.memo && (
                        <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                          <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>諛곗감 硫붾え</div>
                          <div style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{sys.memo}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      ?쒖뒪?쒖뿉 ?쇱튂?섎뒗 諛곗감 ?댁뿭???놁뒿?덈떎. (泥?뎄 ?⑤룆)
                    </div>
                  )}
                </div>

                {/* ?곗륫: ?댁넚??泥?뎄 ?댁뿭 */}
                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '16px',
                  backgroundColor: 'var(--bg-body)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    ?뱞 ?댁넚??嫄곕옒紐낆꽭??泥?뎄 ?댁뿭
                  </div>
                  {excel ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>紐낆꽭???쇱옄</span>
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                          {excel['?뺢퇋?쇱옄'] || excel['?쇱옄'] || excel['?좎쭨'] || excel['?댁넚?쇱옄'] || '-'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>泥?뎄 ?낆껜紐?/span>
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{excel['?낆껜紐?] || '-'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>泥?뎄 ?꾩옣紐?/span>
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{excel['?꾩옣紐?] || '-'}</span>
                      </div>
                      <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>?곸감吏 (異쒕컻)</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{excel['?곸감吏'] || '-'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>?섏감吏 (?꾩갑)</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{excel['?뺢퇋?섏감吏'] || excel['?섏감吏'] || '-'}</div>
                      </div>
                      <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>?ㅼ닔 / 李⑥쥌</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{excel['?ㅼ닔'] || excel['李⑥쥌'] || '-'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>泥?뎄 ?댁넚鍮?/span>
                        <span style={{ fontWeight: 900, color: '#16a34a', fontSize: '14px' }}>??pair.excelCost.toLocaleString()}??/span>
                      </div>
                      {excel['鍮꾧퀬'] && (
                        <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                          <div style={{ color: '#ca8a04', fontWeight: 700, marginBottom: '2px' }}>紐낆꽭??鍮꾧퀬 / ?뱀씠?ы빆</div>
                          <div style={{ fontWeight: 700, color: '#a16207', backgroundColor: 'rgba(234,179,8,0.1)', padding: '6px 8px', borderRadius: '4px' }}>
                            {excel['鍮꾧퀬']}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      ?댁넚??泥?뎄?쒖뿉 ?대떦 嫄댁쓽 ?댁뿭???놁뒿?덈떎. (諛곗감 ?⑤룆)
                    </div>
                  )}
                </div>
              </div>

              {/* ?섎떒 ?≪뀡 踰꾪듉援?*/}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                <button
                  onClick={() => setSelectedReconDetailPair(null)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '7px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-body)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '13px'
                  }}
                >
                  ?リ린
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {isMismatch && (
                    <>
                      <button
                        onClick={async () => {
                          await handleApproveMismatch(pair.pairId);
                          setSelectedReconDetailPair(null);
                        }}
                        style={{
                          padding: '9px 18px',
                          borderRadius: '7px',
                          border: 'none',
                          backgroundColor: '#ca8a04',
                          color: '#fff',
                          cursor: 'pointer',
                          fontWeight: 800,
                          fontSize: '13px',
                          boxShadow: '0 2px 8px rgba(202,138,4,0.3)'
                        }}
                      >
                        ???묒? 泥?뎄????pair.excelCost.toLocaleString()} ?뱀씤 (????꾨즺)
                      </button>
                    </>
                  )}

                  {isExcelOnly && (
                    <>
                      <button
                        onClick={async () => {
                          await handleCreateDeliveryFromExcel(pair.pairId);
                          setSelectedReconDetailPair(null);
                        }}
                        style={{
                          padding: '9px 16px',
                          borderRadius: '7px',
                          border: 'none',
                          backgroundColor: '#2563eb',
                          color: '#fff',
                          cursor: 'pointer',
                          fontWeight: 800,
                          fontSize: '13px'
                        }}
                      >
                        ?????댁뿭?쇰줈 ?좉퇋 諛곗감 ?앹꽦
                      </button>
                      <button
                        onClick={() => {
                          handleExcludeExcelOnly(pair.pairId);
                          setSelectedReconDetailPair(null);
                        }}
                        style={{
                          padding: '9px 16px',
                          borderRadius: '7px',
                          border: '1px solid #dc2626',
                          backgroundColor: 'rgba(239,68,68,0.1)',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontWeight: 800,
                          fontSize: '13px'
                        }}
                      >
                        ?슟 ?ㅼ껌援?諛섎젮 諛??쒖쇅
                      </button>
                    </>
                  )}

                  {isMatched && (
                    <button
                      onClick={() => {
                        handleTogglePairReconciled(pair.pairId);
                        setSelectedReconDetailPair(null);
                      }}
                      style={{
                        padding: '9px 16px',
                        borderRadius: '7px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-body)',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '13px'
                      }}
                    >
                      ????꾨즺 痍⑥냼 (?湲??먮났)
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ?뮩 留ㅼ엯 吏湲??붿껌 ?꾨즺 ?깃났 紐⑤떖 (?꾩슜 ?꾨즺 移대뱶 UI) */}
      {paymentSuccessInfo && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
          }}
          onClick={() => setPaymentSuccessInfo(null)}
        >
          <div 
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '16px',
              padding: '26px',
              width: '100%',
              maxWidth: '480px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 紐⑤떖 ?ㅻ뜑: ?뱀깋 ?깃났 ?꾩씠肄?+ 嫄댁“??紐낆궗 ??댄? + ?リ린 踰꾪듉 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  <CheckCircle2 size={22} style={{ color: '#10b981' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
                    留ㅼ엯 吏湲??붿껌 ?꾨즺
                  </h3>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    ?댁넚猷?????뱀씤 諛??뚭퀎 吏湲??붿껌 ?깅줉
                  </div>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setPaymentSuccessInfo(null)} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-muted)', 
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 蹂몃Ц 1: ?앸퀎 踰덊샇 & ?곹깭 諛곗? */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px'
            }}>
              <div style={{
                backgroundColor: 'var(--bg-body)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>吏湲됱슂泥?踰덊샇</span>
                <span style={{ fontSize: '13px', fontWeight: 900, color: '#3b82f6', fontFamily: 'monospace' }}>
                  {paymentSuccessInfo.bundleCode}
                </span>
              </div>
              <div style={{
                backgroundColor: 'var(--bg-body)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>泥섎━ ?곹깭</span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 900,
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <CheckCircle2 size={13} /> 吏湲??붿껌 ?깅줉??
                </span>
              </div>
            </div>

            {/* 蹂몃Ц 2: 吏묎퀎 ?곸꽭 移대뱶 */}
            <div style={{
              backgroundColor: 'var(--bg-body)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontSize: '12.5px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>?댁넚 嫄곕옒泥?/span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{paymentSuccessInfo.companyName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>?뺤궛 ??곸썡</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'monospace' }}>{paymentSuccessInfo.reconMonth}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>????꾧껐 諛곗감 嫄댁닔</span>
                <span style={{ color: '#2563eb', fontWeight: 900 }}>{paymentSuccessInfo.totalCount}嫄?/span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '10px',
                borderTop: '1px dashed var(--border-color)',
                marginTop: '2px'
              }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '13px' }}>珥?留ㅼ엯 吏湲됯툑??/span>
                <span style={{ color: '#10b981', fontWeight: 900, fontSize: '18px' }}>
                  ??paymentSuccessInfo.totalAmount.toLocaleString()}??
                </span>
              </div>
            </div>

            {/* 蹂몃Ц 3: ?낅Т ?꾨줈?몄뒪 ?닿? ?덈궡 (嫄댁“???띿뒪?? */}
            <div style={{
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '10px',
              padding: '11px 14px',
              fontSize: '11.5px',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}>
              ?댁넚猷?????댁뿭??[?붾쭚 留ㅼ엯 ?뺤궛] ??μ뿉 ?뺤긽 ?깅줉?섏뿀?듬땲?? 愿由щ? 寃??諛?寃곗옱 ??理쒖쥌 吏湲?吏묓뻾 ?④퀎濡??곌퀎?⑸땲??
              <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                ???꾩옱 ?붾㈃?먯꽌 ?ъ“???? ?곷떒 踰붿쐞 ?ㅼ젙??[吏湲??곹깭: 吏湲됱슂泥??꾨즺] ?꾪꽣瑜??좏깮?섏떆硫??깅줉??吏湲됱슂泥?嫄대뱾???몄젣?좎? ?뺤씤?섏떎 ???덉뒿?덈떎.
              </div>
            </div>

            {/* 紐⑤떖 ?섎떒 踰꾪듉援?*/}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => handleCopyBundleCode(paymentSuccessInfo.bundleCode)}
                style={{
                  padding: '9px 15px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-body)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isBundleCopied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                {isBundleCopied ? '蹂듭궗?? : '?붿껌踰덊샇 蹂듭궗'}
              </button>
              <button
                type="button"
                onClick={() => setPaymentSuccessInfo(null)}
                className="btn-primary"
                style={{
                  padding: '9px 22px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '13px',
                  backgroundColor: '#10b981',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                ?뺤씤
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ?截??댁넚 ?섏감吏 ?좎뵪 諛?二쇨컙 ?덈낫 紐⑤떖 */}
      <DestinationWeatherModal
        isOpen={showDestWeatherModal}
        onClose={() => setShowDestWeatherModal(false)}
        customerName={destWeatherParams.customerName}
        siteName={destWeatherParams.siteName}
        rawAddress={destWeatherParams.rawAddress}
      />

      {/* ?슊 諛곗감 ?섎ː ?묒? ?쇨큵 ?깅줉 紐⑤떖 */}
      <ExcelUploadModal
        isOpen={dispatchExcelModalOpen}
        onClose={() => setDispatchExcelModalOpen(false)}
        title="諛곗감 ?섎ː ?묒? ?쇨큵 ?깅줉 (?⑥씪 EXCHANGE 諛??뺣났?좎씤 ?먮룞 ?곸슜)"
        templateFileName="諛곗감?섎ː_?쇨큵?깅줉"
        columns={dispatchExcelColumns}
        onUpload={handleBatchUploadDeliveries}
      />
    </div>
  );
};

export const TruckDispatch: React.FC = () => (
  <ErrorBoundary fallbackTitle="배차 관리 화면 오류">
    <TruckDispatchContent />
  </ErrorBoundary>
);

