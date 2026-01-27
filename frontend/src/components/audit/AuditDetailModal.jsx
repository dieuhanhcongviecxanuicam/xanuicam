import React, { useEffect, useState } from 'react';
import auditService from '../../services/auditService';
import apiService from '../../services/apiService';
import { X, DownloadCloud, MapPin } from 'lucide-react';
import Spinner from '../common/Spinner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import ModalWrapper from '../common/ModalWrapper';

const Field = ({ label, value, children }) => {
  // Hide fields where value is missing or placeholder '-' (system did not collect)
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '-') return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-44 text-sm text-slate-500">{label}</div>
      <div className="flex-1 text-sm text-slate-800 break-words">{children || value}</div>
    </div>
  );
};

const AuditDetailModal = ({ isOpen, onClose, auditId }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    if (!auditId) return;
    let mounted = true;
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await auditService.getLog(auditId);
        if (!mounted) return;
        setData(res);
        // Try to fetch current user full name to show up-to-date 'Họ và Tên'
        try {
          if (res && res.user_id) {
            const user = await apiService.getUserById(res.user_id);
            if (mounted && user && user.full_name) {
              setData(prev => ({ ...(prev || {}), _actor_full_name: user.full_name }));
            }
          }
        } catch (e) {
          // ignore user fetch errors
        }
      } catch (e) {
        console.error('Lỗi khi tải chi tiết audit:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetch();
    return () => { mounted = false; };
  }, [isOpen, auditId]);

  if (!isOpen) return null;

  const handleExport = async (fmt) => {
    try {
      if (fmt === 'pdf') {
        // client-side printable view as fallback (no server PDF dependency)
        const html = `
          <html><head><title>Audit ${auditId}</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:20px}h1{font-size:18px}pre{white-space:pre-wrap;font-family:monospace}</style></head>
          <body>
            <h1>Audit ${auditId} - Chi tiết</h1>
            <div>${Object.keys(data || {}).map(k => `<strong>${k}:</strong> ${String((data||{})[k] ?? '-').replace(/</g,'&lt;')}`).join('<br/>')}</div>
            <script>window.onload = function(){ window.print(); setTimeout(()=>window.close(),100); }</script>
          </body></html>`;
        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
        return;
      }

      try {
        const blob = await auditService.exportEntry(auditId, fmt);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_${auditId}.${fmt === 'csv' ? 'csv' : 'json'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        return;
      } catch (e) {
        // fallback: construct client-side export from loaded `data`
        console.warn('Server export failed, using client-side fallback', e);
        if (!data) throw e;
        if (fmt === 'json') {
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `audit_${auditId}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); return;
        }
        if (fmt === 'csv') {
          // build flat CSV with the required fields
          const fields = [
            'audit_id','user_id','username','actor_full_name','target_user_id','target_full_name','action','status','reason',
            'user_agent','browser','browser_version','language','plugins',
            'os','os_version','screen_width','screen_height','pixel_ratio','hardware_concurrency','device_memory','battery_level','battery_charging',
            'ip','ip_version','country','city','latitude','longitude','timezone','isp','connection_type',
            'canvas_hash','webgl_hash','audio_hash','fonts','webrtc_local_ips','fingerprint','hardware_uuid','composite_hash',
            'incognito','webauthn_supported','method','url','session_id','created_at','details'
          ];
          const getVal = (obj, key) => {
            switch(key) {
              case 'audit_id': return auditId;
              case 'actor_full_name': return data._actor_full_name || data.user_name || '';
              case 'user_agent': return data.ua?.raw || data.user_agent || '';
              case 'browser': return data.ua?.browser || '';
              case 'browser_version': return data.ua?.version || '';
              case 'language': return (data.metadata && data.metadata.language) || data.ua?.language || '';
              case 'plugins': return (data.metadata && data.metadata.plugins) ? (Array.isArray(data.metadata.plugins) ? data.metadata.plugins.join(';') : String(data.metadata.plugins)) : '';
              case 'os': return data.ua?.os || data.ua?.ua_os || data.os || '';
              case 'os_version': return data.ua?.osVersion || (data.metadata && data.metadata.osVersion) || '';
              case 'screen_width': return data.metadata?.screen?.width || '';
              case 'screen_height': return data.metadata?.screen?.height || '';
              case 'pixel_ratio': return data.metadata?.screen?.pixelRatio || '';
              case 'hardware_concurrency': return data.metadata?.hardwareConcurrency || '';
              case 'device_memory': return data.metadata?.deviceMemory || '';
              case 'battery_level': return data.metadata?.battery?.level || '';
              case 'battery_charging': return data.metadata?.battery?.charging || '';
              case 'ip': return data.ip || '';
              case 'ip_version': return data.ip_version || '';
              case 'country': return data.country || '';
              case 'city': return data.city || '';
              case 'latitude': return data.latitude || '';
              case 'longitude': return data.longitude || '';
              case 'timezone': return (data.metadata && data.metadata.timezone) || data.timezone || '';
              case 'isp': return data.isp || data.metadata?.isp || '';
              case 'connection_type': return data.metadata?.connectionType || '';
              case 'canvas_hash': return data.metadata?.canvasHash || '';
              case 'webgl_hash': return data.metadata?.webglHash || '';
              case 'audio_hash': return data.metadata?.audioHash || '';
              case 'fonts': return data.metadata?.fonts ? (Array.isArray(data.metadata.fonts) ? data.metadata.fonts.join(';') : data.metadata.fonts) : '';
              case 'webrtc_local_ips': return data.metadata?.webrtcLocalIps ? data.metadata.webrtcLocalIps.join(';') : '';
              case 'fingerprint': return data.fingerprint || data.metadata?.fingerprint || data.device_fingerprint_hash || '';
              case 'hardware_uuid': return data.metadata?.hardwareUUID || '';
              case 'composite_hash': return data.metadata?.compositeHash || '';
              case 'incognito': return data.metadata?.incognito === true ? 'true' : data.metadata?.incognito === false ? 'false' : '';
              case 'webauthn_supported': return data.metadata?.webauthn ? 'true' : 'false';
              case 'details': return (data.details || '').replace(/\n/g, ' ').replace(/\r/g,'');
              default: return (data[key] !== undefined && data[key] !== null) ? String(data[key]) : '';
            }
          };
          const csvRows = [fields.join(',')];
          const row = fields.map(f => `"${String(getVal(data,f)).replace(/"/g,'""')}"`).join(',');
          csvRows.push(row);
          const bom = '\uFEFF';
          const csvContent = bom + csvRows.join('\n');
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `audit_${auditId}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); return;
        }
      }
    } catch (e) {
      console.error('Export failed', e);
      alert('Không thể xuất báo cáo.');
    }
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-3xl" className="max-h-[90vh] flex flex-col p-0">
      <div className="bg-white rounded-lg shadow-xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold text-slate-800">Chi tiết hành động</h2>
          <div className="flex items-center gap-3">
            <button onClick={() => handleExport('csv')} className="text-slate-500 hover:text-slate-700 flex items-center gap-2">
              <DownloadCloud /> CSV
            </button>
            <button onClick={() => handleExport('json')} className="text-slate-500 hover:text-slate-700 flex items-center gap-2">
              <DownloadCloud /> JSON
            </button>
            <button onClick={() => handleExport('pdf')} className="text-slate-500 hover:text-slate-700 flex items-center gap-2">
              <DownloadCloud /> PDF
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X /></button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center h-48"><Spinner/></div>
          ) : !data ? (
            <p className="text-center text-slate-500 py-10">Không có dữ liệu.</p>
          ) : (
            <div className="space-y-4 text-sm">
              <Field label="User Agent" value={data.ua?.raw || data.user_agent || '-'} />
              <Field label="Ngôn ngữ" value={(data.metadata && data.metadata.language) || data.ua?.language || '-'} />
              <Field label="Tên trình duyệt & Phiên bản" value={data.ua?.browser ? `${data.ua.browser} ${data.ua.version || ''}` : '-'} />
              <Field label="Tiện ích mở rộng (Plugins)" value={data.metadata?.plugins ? (Array.isArray(data.metadata.plugins) ? data.metadata.plugins.join(', ') : String(data.metadata.plugins)) : '-'} />

              <Field label="Hệ điều hành (OS)" value={data.ua?.os || data.ua?.ua_os || data.os || '-'} />
              <Field label="Độ phân giải màn hình" value={data.metadata?.screen ? `${data.metadata.screen.width || '-'} x ${data.metadata.screen.height || '-'} @${data.metadata.screen.pixelRatio||1}x` : '-'} />
              <Field label="CPU (số lõi)" value={data.metadata?.hardwareConcurrency || '-'} />
              <Field label="Bộ nhớ RAM (approx)" value={data.metadata?.deviceMemory || '-'} />
              <Field label="Tình trạng Pin" value={data.metadata?.battery ? `Level: ${data.metadata.battery.level||'-'} Charging: ${data.metadata.battery.charging ? 'Yes' : 'No'}` : '-'} />

              <Field label="Địa chỉ IP" value={data.ip ? `${data.ip} ${data.ip_version ? `(${data.ip_version})` : ''}` : '-'} />
              <Field label="Vị trí địa lý" value={`${data.country || '-'}${data.city ? ', ' + data.city : ''} ${data.latitude && data.longitude ? `(${data.latitude}, ${data.longitude})` : ''}`} />
              <Field label="Múi giờ" value={(data.metadata && data.metadata.timezone) || data.timezone || '-'} />
              <Field label="Loại kết nối" value={data.metadata?.connectionType || '-'} />

              <Field label="Canvas hash" value={data.metadata?.canvasHash ? data.metadata.canvasHash : '-'} />
              <Field label="WebGL hash" value={data.metadata?.webglHash ? data.metadata.webglHash : '-'} />
              <Field label="Audio hash" value={data.metadata?.audioHash ? data.metadata.audioHash : '-'} />
              <Field label="Fonts" value={data.metadata?.fonts ? (Array.isArray(data.metadata.fonts) ? data.metadata.fonts.join(', ') : data.metadata.fonts) : '-'} />
              <Field label="WebRTC local IPs" value={data.metadata?.webrtcLocalIps ? (Array.isArray(data.metadata.webrtcLocalIps) ? data.metadata.webrtcLocalIps.join(', ') : String(data.metadata.webrtcLocalIps)) : '-'} />

              <Field label="Fingerprint (sha256)" value={data.fingerprint || data.device_fingerprint_hash || (data.metadata && data.metadata.fingerprint) || '-'} />
              <Field label="Hardware UUID" value={data.metadata?.hardwareUUID || '-'} />
              <Field label="Mã băm tổng hợp" value={data.metadata?.compositeHash || '-'} />

              <Field label="IP tĩnh/động" value={data.ip_type || data.ip || '-'} />
              <Field label="User-Agent chi tiết" value={data.ua?.raw || '-'} />
              <Field label="ISP" value={data.isp || data.metadata?.isp || '-'} />

              <Field label="Incognito/Private Mode" value={data.metadata?.incognito === true ? 'Yes' : data.metadata?.incognito === false ? 'No' : '-'} />
              <Field label="Hỗ trợ WebAuthn (biometric)" value={data.metadata?.webauthn ? 'Supported' : 'Not supported'} />

              <div className="pt-3 border-t">
                <Field label="User ID / Username" value={`${data.user_id || ''}${data.username ? ` / ${data.username}` : ''}`} />
                <Field label="Họ và Tên" value={data._actor_full_name || data.user_name || '-'} />
                {data.target_full_name && (
                  <Field label="Người được chỉnh sửa" value={`${data.target_user_id ? data.target_user_id + ' / ' : ''}${data.target_full_name}`} />
                )}
                <Field label="Trạng thái" value={`${data.status || ''} ${data.reason ? `- ${data.reason}` : ''}`} />
                <Field label="Phương thức đăng nhập" value={data.method || '-'} />
                <Field label="URL truy cập" value={data.url || null}>
                  {data.url && (
                    <a href={data.url} onClick={(e)=>{
                      try {
                        e.preventDefault();
                        // Sanitize: only navigate same-origin within the SPA; open external links in a new tab safely.
                        const url = new URL(String(data.url), window.location.origin);
                        if (url.origin === window.location.origin) {
                          // same-origin: use location.assign to preserve history
                          window.location.assign(url.pathname + url.search + url.hash);
                        } else {
                          // external: open in a new tab with noopener to avoid giving the new page access
                          window.open(url.toString(), '_blank', 'noopener');
                        }
                      } catch (ex) {
                        // If URL parsing fails, don't navigate — avoid open-redirect
                        console.warn('Blocked unsafe redirect to', data.url);
                      }
                    }} className="text-blue-600 hover:underline break-words">{data.url}</a>
                  )}
                </Field>
                <Field label="Session ID" value={data.session_id || '-'} />
                <Field label="Timestamp" value={data.created_at ? format(new Date(data.created_at), "yyyy-MM-dd : HH:mm:ss", { locale: vi }) : '-'} />
                <div>
                  <div className="w-44 text-sm text-slate-500">Chi tiết</div>
                  <div className="flex-1">
                    {data.details ? (
                      // If details contain an old->new update phrase, try to surface it clearly.
                      (() => {
                        const txt = String(data.details);
                        const m = txt.match(/(đã cập nhật .*?)"([^"]*)".*?thành .*?"([^"]*)"/i);
                        if (m) {
                          return (
                            <div className="text-sm text-slate-800 bg-slate-50 p-3 rounded border border-slate-100 mt-1">
                              <div className="mb-2">{txt}</div>
                              <div className="text-xs text-slate-600">Thay đổi: <span className="font-medium">{m[2]}</span> → <span className="font-medium">{m[3]}</span></div>
                            </div>
                          );
                        }
                        return <pre className="whitespace-pre-wrap text-xs bg-slate-50 p-3 rounded border border-slate-100 mt-1">{txt}</pre>;
                      })()
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-slate-600 mt-3"><MapPin/> Lịch sử truy cập (phiên liên quan)</div>
                <div className="mt-2 text-sm text-slate-700">Phiên liên quan: <span className="font-medium">{data.session_id || '-'}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
};

export default AuditDetailModal;
