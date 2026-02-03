import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SmallButton from './SmallButton';
import { formatDateTime, formatTimeAgo } from '../../utils/formatDate';

function Row({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex gap-3 py-0.5 sm:py-1 border-b last:border-b-0 min-w-0">
      <div className="w-28 sm:w-40 text-slate-600 text-xs flex-shrink-0">{label}</div>
      <div className="flex-1 text-sm sm:text-sm text-slate-800 min-w-0 break-words whitespace-pre-wrap">{value}</div>
    </div>
  );
}

function CopyRow({ label, value, copyKey, onCopy, copied }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex gap-3 py-0.5 sm:py-1 border-b last:border-b-0 items-center min-w-0">
      <div className="w-28 sm:w-40 text-slate-600 text-xs flex-shrink-0">{label}</div>
      <div className="flex-1 text-sm sm:text-sm text-slate-800 min-w-0 flex items-center justify-between">
        <div className="min-w-0 break-words whitespace-pre-wrap pr-2">{value}</div>
        <div className="ml-3 flex items-center gap-2">
          <button aria-label={`Sao chép ${label}`} onClick={() => onCopy(copyKey)} className="text-xs whitespace-nowrap text-slate-600 hover:text-slate-800 border rounded px-2 py-1 bg-white">Sao chép</button>
          {copied === copyKey && <div className="text-xs text-green-600">Đã sao chép</div>}
        </div>
      </div>
    </div>
  );
}

function ScrollListRow({ label, items }) {
  const [showHint, setShowHint] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 1200);
    return () => clearTimeout(t);
  }, []);
  if (!items || (Array.isArray(items) && items.length === 0)) return null;
  const content = Array.isArray(items) ? items.join(', ') : items;
  return (
    <div className="flex gap-3 py-0.5 sm:py-1 border-b last:border-b-0 min-w-0 items-start">
      <div className="w-28 sm:w-40 text-slate-600 text-xs flex-shrink-0">{label}</div>
      <div className="flex-1 min-w-0 relative">
        <div className="max-h-24 sm:max-h-32 overflow-auto device-scroll text-sm text-slate-800 break-words whitespace-pre-wrap p-1 bg-white rounded">{content}</div>
        <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-6 bg-gradient-to-b from-transparent to-white scroll-gradient-anim" />
        {showHint && (
          <div className="pointer-events-none absolute right-2 bottom-2 text-xs text-slate-400 animate-pulse">▾</div>
        )}
      </div>
    </div>
  );
}

export default function DeviceDetailsModal({ open, onClose, device }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose && onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      try { prev && prev.focus(); } catch (e) {}
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose]);

  const dev = device || {};
  // some callers pass { fingerprint, sessions }
  const session = (dev.sessions && dev.sessions[0]) || dev;

  const geo = session.geo || {};
  const md = session.metadata || {};

  

  const [copied, setCopied] = useState('');
  const doCopy = async (key, text) => {
    try {
      if (!text) return;
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    } catch (e) {
      // ignore copy errors silently
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center" role="presentation" aria-hidden="false" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black bg-opacity-40" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }} />
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            className="relative bg-white rounded-lg shadow-lg w-full max-w-4xl p-4 sm:p-6 overflow-hidden max-h-[90vh] sm:max-h-[80vh] text-xs sm:text-sm"
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold">Chi tiết thiết bị</h3>
              <div className="flex items-center gap-2">
                <div className="text-xs text-slate-500">Phiên: {dev.sessions ? dev.sessions.length : (dev.sessionCount || 1)}</div>
                <button onClick={() => doCopy('copy_all', JSON.stringify(dev, null, 2))} className="text-xs whitespace-nowrap text-slate-600 hover:text-slate-800 border rounded px-2 py-1 bg-white">Sao chép toàn bộ</button>
                {copied === 'copy_all' && <div className="text-xs text-green-600">Đã sao chép</div>}
                <SmallButton variant="secondary" onClick={onClose}>Đóng</SmallButton>
              </div>
            </div>
            <div className="overflow-auto max-h-[72vh] sm:max-h-[65vh] pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-700">
                <div className="bg-slate-50 p-2 sm:p-3 rounded border min-w-0">
                <Row label="Trình duyệt" value={session.ua?.browser ? `${session.ua.browser} ${session.ua.version||''}` : (session.deviceType || session.os || '—')} />
                <CopyRow label="User Agent" value={session.ua?.raw || md.ua || '—'} copyKey={`ua_${dev.fingerprint||''}`} onCopy={(k)=> doCopy(k, session.ua?.raw || md.ua || '')} copied={copied} />
                <Row label="Ngôn ngữ" value={session.ua?.language || md.language || '—'} />
                <Row label="Múi giờ" value={md.timezone || '—'} />
                <Row label="IP" value={session.ip || '—'} />
                <Row label="Địa điểm" value={geo.city || geo.country ? `${geo.city || ''}${geo.country ? ' - ' + geo.country : ''}` : '—'} />
                <Row label="ISP" value={geo.isp || '—'} />
                <CopyRow label="Fingerprint" value={dev.fingerprint || '—'} copyKey={`fp_${dev.fingerprint||''}`} onCopy={(k)=> doCopy(k, dev.fingerprint || '')} copied={copied} />
                <Row label="FPJS ID" value={md.fpjsId || '—'} />
              </div>
                <div className="bg-slate-50 p-2 sm:p-3 rounded border min-w-0">
                <Row label="Màn hình" value={md.screen ? `${md.screen.width}x${md.screen.height} @${md.screen.pixelRatio||1}x` : '—'} />
                <Row label="CPU (cores)" value={md.hardwareConcurrency || '—'} />
                <Row label="RAM (GB)" value={md.deviceMemory || '—'} />
                <Row label="Kết nối" value={md.connectionType || '—'} />
                <ScrollListRow label="Plugins" items={md.plugins} />
                <ScrollListRow label="Fonts" items={md.fonts} />
                <Row label="Canvas hash" value={md.canvasHash ? (md.canvasHash.slice(0, 24) + (md.canvasHash.length>24?'...':'')) : '—'} />
                <Row label="WebGL hash" value={md.webglHash ? (md.webglHash.slice(0, 24) + (md.webglHash.length>24?'...':'')) : '—'} />
                <Row label="Audio hash" value={md.audioHash ? (md.audioHash.slice(0, 24) + (md.audioHash.length>24?'...':'')) : '—'} />
                <Row label="Composite fingerprint" value={md.compositeHash || '—'} />
                <Row label="Hardware UUID" value={md.hardwareUUID || '—'} />
                <Row label="WebAuthn" value={md.webauthn ? 'Supported' : '—'} />
                <Row label="Incognito" value={md.incognito === true ? 'Yes' : md.incognito === false ? 'No' : '—'} />
                <Row label="Battery" value={md.battery ? (typeof md.battery === 'object' ? `${md.battery.level || '—'} (${md.battery.charging ? 'charging' : 'not charging'})` : md.battery) : '—'} />
              </div>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Phiên chi tiết</h4>
              <div className="space-y-2 text-xs text-slate-700">
                {(dev.sessions || []).map((s, i) => (
                  <div key={s.sessionId || i} className="p-2 border rounded bg-white">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-medium">{s.ua?.browser ? `${s.ua.browser} ${s.ua.version||''}` : s.deviceType || s.os || '—'}</div>
                        <div className="text-slate-500">{s.ip || '—'} · {s.ua?.language || s.metadata?.language || '—'}</div>
                      </div>
                      <div className="text-right text-slate-500 text-xs">
                        <div>{formatDateTime(s.createdAt)}</div>
                        <div>{formatTimeAgo(s.lastSeenAt)}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {(!dev.sessions || dev.sessions.length === 0) && <div className="text-slate-500">Không có phiên chi tiết.</div>}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
