import React, { useEffect, useState, useContext } from 'react';
import auditService from '../../services/auditService';
import PasswordModal from '../common/PasswordModal';
import AuthContext from '../../context/AuthContext';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import ModalWrapper from '../common/ModalWrapper';

const defaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconSize: [25,41],
  iconAnchor: [12,41]
});

function SessionsModal({ open, onClose, onRefresh, onLogoutRequest }) {
  const [sessions, setSessions] = useState([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    auditService.getSessions().then(d => setSessions(d.sessions)).catch(() => setSessions([]));
  }, [open]);

  const handleLogout = async (sid) => {
    if (onLogoutRequest) return onLogoutRequest(sid);
    if (!window.confirm('Đăng xuất session này?')) return;
    await auditService.logoutSession(sid);
    onRefresh();
  };

  // helper(s) intentionally removed to satisfy linter (unused in UI)

  if (!open) return null;
  return (
    <ModalWrapper isOpen={open} onClose={onClose} maxWidth="max-w-3xl" className="p-4">
      <div className="bg-white rounded p-4 w-full">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">Sessions đang hoạt động</h3>
          <button onClick={onClose} className="text-sm text-gray-600">Đóng</button>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full table-auto text-sm">
            <thead>
              <tr className="text-left">
                <th>User</th><th>IP</th><th>UA</th><th>Last seen</th><th></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.session_id} className="border-t">
                  <td>{s.user_name} ({s.username})</td>
                  <td>{s.ip || '-'}</td>
                  <td className="truncate" style={{maxWidth:300}}>{s.user_agent || '-'}</td>
                  <td>{new Date(s.last_seen_at).toLocaleString()}</td>
                  <td><button onClick={() => handleLogout(s.session_id)} className="text-red-600">Đăng xuất</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ModalWrapper>
  );
}

function MapModal({ open, onClose, markers }) {
  if (!open) return null;
  const center = markers.length ? [markers[0].latitude, markers[0].longitude] : [21.028511,105.804817];
  return (
    <ModalWrapper isOpen={open} onClose={onClose} maxWidth="max-w-4xl" className="p-2">
      <div className="bg-white rounded p-2 w-full h-96">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">Bản đồ vị trí truy cập</h3>
          <button onClick={onClose} className="text-sm text-gray-600">Đóng</button>
        </div>
        <div className="h-80">
          <MapContainer center={center} zoom={5} style={{height:'100%', width:'100%'}}>
            {process.env.REACT_APP_MAPBOX_TOKEN ? (
              <TileLayer url={`https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=${process.env.REACT_APP_MAPBOX_TOKEN}`} id="mapbox/streets-v11" />
            ) : (
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            )}
            {markers.map((m, idx) => (
              m.latitude && m.longitude ? (
                <Marker key={idx} position={[m.latitude, m.longitude]} icon={defaultIcon}>
                  <Popup>
                    <div className="text-sm">
                      <div><strong>{m.user_name || m.username}</strong></div>
                      <div>{m.ip}</div>
                      <div>{m.city ? `${m.city}, ${m.country}` : ''}</div>
                      <div>{m.isp || ''}</div>
                      <div className="text-xs text-gray-500">{new Date(m.created_at).toLocaleString()}</div>
                    </div>
                  </Popup>
                </Marker>
              ) : null
            ))}
          </MapContainer>
        </div>
      </div>
    </ModalWrapper>
  );
}

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [detailsModal, setDetailsModal] = useState({ open: false, data: null });
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwValue, setPwValue] = useState('');
  const [pwAction, setPwAction] = useState(null);
  const [pwTarget, setPwTarget] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10); // default 10 as requested
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const loadLogsRef = React.useRef(null);

  const loadLogs = async (p = page, f = filters) => {
    setLoading(true);
    try {
      const data = await auditService.getLogs({ page: p, limit: perPage, ...f });
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
      setPage(data.currentPage || p);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  // Keep a ref to the latest loadLogs so effects can call it without needing it in deps
  loadLogsRef.current = loadLogs;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadLogs(1); }, []);

  const openPassword = (action, target, description) => {
    setPwAction(action);
    setPwTarget(target);
    setPwValue('');
    setPwModalOpen(true);
  };

  const handlePasswordConfirm = async () => {
    try {
      if (pwAction === 'logoutSession') {
        await auditService.logoutSessionWithPassword(pwTarget, pwValue);
        alert('Đã đăng xuất phiên.');
      } else if (pwAction === 'logoutAll') {
        await auditService.logoutAllWithPassword(pwTarget, pwValue);
        alert('Đã đăng xuất tất cả phiên.');
      }
      setPwModalOpen(false);
      setDetailsModal({ open: false, data: null });
      fetch(1);
    } catch (e) {
      console.error(e);
      alert(e && e.message ? e.message : 'Lỗi khi thực hiện hành động.');
    }
  };

  // Subscribe to server-sent events for real-time logs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const url = `${process.env.REACT_APP_API_BASE_URL || '/api'}/audit-logs/stream`;
    let es;
    let pollInterval;
    try {
      es = new EventSource(url);
      es.addEventListener('audit', (ev) => {
        try {
          const d = JSON.parse(ev.data);
          const newItem = { id: d.id, created_at: d.created_at, user_name: d.username, username: d.username, action: d.action, module: d.module, status: d.status, session_id: d.session_id, ip: d.ip, city: d.city, country: d.country, latitude: d.latitude, longitude: d.longitude, isp: d.isp };
          setLogs(prev => [ newItem, ...prev ]);
        } catch (e) {}
      });
      // Listen for updates to existing audit records (geo enrichment, status changes, etc.)
      es.addEventListener('audit_update', (ev) => {
        try {
          const d = JSON.parse(ev.data);
          setLogs(prev => {
            const exists = prev.some(l => l.id === d.id);
            const updated = prev.map(l => l.id === d.id ? { ...l, ...d } : l);
            // If the record wasn't present, prepend it (safety)
            return exists ? updated : [ { id: d.id, created_at: d.created_at, user_name: d.username || d.user_name, username: d.username || d.user_name, action: d.action, module: d.module, status: d.status, session_id: d.session_id, ip: d.ip, city: d.city, country: d.country, latitude: d.latitude, longitude: d.longitude, isp: d.isp }, ...prev ];
          });
        } catch (e) {}
      });
      es.onerror = () => {
        es.close();
        // fallback to polling (inline to avoid stale deps)
        pollInterval = setInterval(() => {
          try { if (loadLogsRef.current) loadLogsRef.current(1); } catch (e) {}
        }, 5000);
      };
    } catch (e) {
      // EventSource not supported; fallback to polling (inline)
      pollInterval = setInterval(() => { try { if (loadLogsRef.current) loadLogsRef.current(1); } catch (e) {} }, 5000);
    }
    return () => { if (es) es.close(); if (pollInterval) clearInterval(pollInterval); };
  }, []);

  const handleExport = async () => {
    const blob = await auditService.exportLogsCsv({ page, limit: perPage, ...filters });
    const url = window.URL.createObjectURL(new Blob([blob]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const { hasPermission } = useContext(AuthContext);

  const handleExportDecrypted = async () => {
    try {
      const blob = await auditService.exportDecryptedCsv({ page, limit: perPage, ...filters });
      const url = window.URL.createObjectURL(new Blob([blob]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_decrypted_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error('Export decrypted failed', e);
      alert('Bạn không có quyền tải dữ liệu đã giải mã hoặc có lỗi xảy ra.');
    }
  };

  const handleViewOnMap = (log) => {
    const q = log.city ? `${log.city}, ${log.country}` : log.ip || '';
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    try { window.open(url, '_blank', 'noopener,noreferrer'); } catch (e) { /* ignore */ }
  };

  const handleOpenDetails = async (log) => {
    // fetch detailed view from backend
    try {
      const data = await auditService.getLog(log.id);
      setDetailsModal({ open: true, data });
    } catch (e) {
      // fallback to existing content
      setDetailsModal({ open: true, data: log });
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Theo dõi & Truy vết (Audit Log)</h2>
        <div className="space-x-2">
          <button className="btn" onClick={() => setSessionsOpen(true)}>Sessions</button>
          <button className="btn" onClick={() => setMapOpen(true)}>Map</button>
          <button className="btn" onClick={handleExport}>Export CSV</button>
          {hasPermission && hasPermission(['export_audit_decrypted']) && (
            <button className="btn bg-red-600 text-white" onClick={async () => {
              const ok = window.confirm('Bạn có chắc muốn tải CSV đã giải mã? Hành động này sẽ ghi lại lịch sử.');
              if (!ok) return;
              await handleExportDecrypted();
            }}>Export CSV (Decrypted)</button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <input aria-label="Tìm theo hành động" className="border p-2 flex-1" placeholder="Tìm theo hành động..." onChange={e => setFilters(prev => ({...prev, action: e.target.value}))} />
          <input aria-label="Tìm theo người" className="border p-2 flex-1" placeholder="Tìm theo người thực hiện..." onChange={e => setFilters(prev => ({...prev, user: e.target.value}))} />
          <select aria-label="Chọn module" className="border p-2" onChange={e => setFilters(prev => ({...prev, module: e.target.value}))}>
            <option value="">Tất cả Module</option>
            <option value="Auth">Auth</option>
            <option value="Security">Security</option>
              <option value="Đặt phòng">Đặt phòng</option>
            <option value="Tasks">Tasks</option>
            <option value="Audit">Audit</option>
          </select>
          <select aria-label="Chọn sự kiện" className="border p-2" onChange={e => setFilters(prev => ({...prev, event: e.target.value}))}>
            <option value="">Tất cả sự kiện</option>
            <option value="lock">Khóa</option>
            <option value="unlock">Mở khóa</option>
          </select>
          <div className="flex items-center gap-2">
            <label className="text-sm">Từ</label>
            <input type="date" className="border p-2" onChange={e => setFilters(prev => ({...prev, startDate: e.target.value}))} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Đến</label>
            <input type="date" className="border p-2" onChange={e => setFilters(prev => ({...prev, endDate: e.target.value}))} />
          </div>
          <div className="flex items-center">
            <button className="btn" onClick={() => fetch(1, filters)}>Áp dụng</button>
            <button className="btn ml-2" onClick={() => { setFilters({}); setPerPage(10); fetch(1, {}); }}>Đặt lại</button>
          </div>
        </div>
      </div>

      <div className="overflow-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Thời gian</th>
              <th className="p-2 text-left">Người dùng</th>
              <th className="p-2 text-left">IP / Vị trí</th>
              <th className="p-2 text-left">Thiết bị / OS</th>
              <th className="p-2 text-left">Hành động</th>
              <th className="p-2 text-left">Phiên</th>
              <th className="p-2 text-left">Chi tiết</th>
              <th className="p-2 text-left">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-4">Đang tải...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} className="p-4">Không có dữ liệu.</td></tr>
            ) : logs.map(l => (
              <tr key={l.id} className="border-t">
                <td className="p-2">{new Date(l.created_at).toLocaleString()}</td>
                <td className="p-2">{l.user_name || l.username}</td>
                <td className="p-2">
                  <div className="flex items-center space-x-2">
                    <div>{l.ip || '-'}</div>
                    {/* Geo-enriched indicator */}
                    {l.latitude && l.longitude && l.isp ? (
                      <div title="Đã geo-enrich" className="text-green-600 text-xs">●</div>
                    ) : (
                      <div title="Chưa geo-enrich" className="text-gray-400 text-xs">○</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{l.city ? `${l.city}, ${l.country}` : ''}</div>
                </td>
                <td className="p-2">{l.device_type || '-'} / {l.os || '-'}</td>
                <td className="p-2">{l.action} {l.status ? `(${l.status})` : ''}</td>
                <td className="p-2">{l.session_id || '-'}</td>
                <td className="p-2">
                  <button className="btn btn-sm bg-blue-50 text-blue-600 border border-blue-100 px-2 py-1 rounded" onClick={() => handleOpenDetails(l)}>Xem</button>
                </td>
                <td className="p-2"><button className="btn btn-sm bg-white text-blue-600 border border-gray-200 px-2 py-1 rounded" onClick={() => handleViewOnMap(l)}>Xem bản đồ</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-3">
        <div className="flex items-center gap-3">
          <div className="text-sm">Hiển thị</div>
          <div className="inline-flex items-center border rounded overflow-hidden">
            {[10,20,50,100].map(n => (
              <button key={n} onClick={() => { setPerPage(n); setPage(1); fetch(1, filters); }} className={`px-3 py-1 text-sm ${perPage===n? 'bg-slate-200 font-semibold':''}`}>{n}</button>
            ))}
          </div>
          <div className="ml-2">Trang {page} / {totalPages}</div>
        </div>
        <div>
          <button disabled={page<=1} onClick={() => { setPage(p => p-1); fetch(page-1); }} className="btn mr-2">Trước</button>
          <button disabled={page>=totalPages} onClick={() => { setPage(p => p+1); fetch(page+1); }} className="btn">Sau</button>
        </div>
      </div>

      <SessionsModal open={sessionsOpen} onClose={() => setSessionsOpen(false)} onRefresh={() => fetch()} onLogoutRequest={(sid) => openPassword('logoutSession', sid)} />
      <MapModal open={mapOpen} onClose={() => setMapOpen(false)} markers={logs.filter(l => l.latitude && l.longitude).map(l => ({
        latitude: l.latitude,
        longitude: l.longitude,
        user_name: l.user_name,
        username: l.username,
        ip: l.ip,
        city: l.city,
        country: l.country,
        isp: l.isp,
        created_at: l.created_at
      }))} />
      {detailsModal.open && (
        <ModalWrapper isOpen={detailsModal.open} onClose={() => setDetailsModal({open:false, data:null})} maxWidth="max-w-2xl" className="p-4">
          <div className="bg-white rounded p-4 w-full">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">Chi tiết nhật ký</h3>
              <button onClick={() => setDetailsModal({open:false, data:null})} className="text-sm text-gray-600">Đóng</button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-semibold">Người thực hiện</div>
                <div>{detailsModal.data.user_name || detailsModal.data.username}</div>
                <div className="mt-2 font-semibold">Phiên</div>
                <div>{detailsModal.data.session_id || '-'}</div>
                <div className="mt-2 font-semibold">Hành động</div>
                <div>{detailsModal.data.module} / {detailsModal.data.action}</div>
                <div className="mt-2 font-semibold">Thời gian</div>
                <div>{detailsModal.data.created_at ? new Date(detailsModal.data.created_at).toLocaleString() : '-'}</div>
              </div>
              <div>
                <div className="font-semibold">Địa chỉ IP</div>
                  <div className="flex items-center space-x-2">
                    <div>{detailsModal.data.ip || '-' }</div>
                    <div className="text-xs text-gray-500">{detailsModal.data.ip_version || ''}</div>
                    <button className="text-xs text-blue-600" onClick={() => navigator.clipboard?.writeText(detailsModal.data.ip || '')}>Copy IP</button>
                  </div>
                <div className="mt-2 font-semibold">Vị trí / ISP</div>
                <div>{detailsModal.data.city ? `${detailsModal.data.city}, ${detailsModal.data.country}` : '-'} <div className="text-xs text-gray-500">{detailsModal.data.isp || ''}</div></div>
                <div className="mt-2 font-semibold">Bản đồ</div>
                <div>{(detailsModal.data.latitude && detailsModal.data.longitude) ? `${detailsModal.data.latitude}, ${detailsModal.data.longitude}` : '-'}</div>
                  <div className="text-right mt-1">
                    <button className="text-xs text-blue-600" onClick={() => {
                      const coords = (detailsModal.data.latitude && detailsModal.data.longitude) ? `${detailsModal.data.latitude},${detailsModal.data.longitude}` : '';
                      navigator.clipboard?.writeText(coords || '');
                    }}>Copy coords</button>
                  </div>
              </div>
              <div>
                <div className="font-semibold">Thiết bị</div>
                <div>{detailsModal.data.ua?.device || detailsModal.data.device_type || '-'}</div>
                <div className="mt-2 font-semibold">Hệ điều hành</div>
                <div>{detailsModal.data.ua?.os || detailsModal.data.os || '-'}</div>
                <div className="mt-2 font-semibold">Trình duyệt</div>
                <div>{detailsModal.data.ua?.browser || '-'} {detailsModal.data.ua?.version ? `v${detailsModal.data.ua.version}` : ''}</div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <div className="font-semibold">User Agent (raw)</div>
                  <button className="text-xs text-blue-600" onClick={() => { navigator.clipboard?.writeText(detailsModal.data.ua?.raw || detailsModal.data.user_agent || ''); }}>Copy</button>
                </div>
                <pre className="text-xs overflow-auto max-h-40 p-2 bg-gray-100 rounded">{detailsModal.data.ua?.raw || detailsModal.data.user_agent || '-'}</pre>
                <div className="mt-2 font-semibold">MAC</div>
                <div className="flex items-center space-x-2">
                  <div>{detailsModal.data.mac || '-'}</div>
                  <button className="text-xs text-blue-600" onClick={() => navigator.clipboard?.writeText(detailsModal.data.mac || '')}>Copy MAC</button>
                </div>
              </div>
              <div className="col-span-2">
                <div className="font-semibold">Chi tiết (JSON)</div>
                <pre className="text-xs overflow-auto max-h-52 p-2 bg-gray-50 rounded">{JSON.stringify(detailsModal.data.details ? (typeof detailsModal.data.details === 'string' ? (() => { try { return JSON.parse(detailsModal.data.details); } catch(e){ return detailsModal.data.details; } })() : detailsModal.data.details) : {}, null, 2)}</pre>
                <div className="flex items-center justify-end space-x-2 mt-2">
                  <button className="btn btn-sm" onClick={async () => {
                    try {
                      const blob = await auditService.exportEntry(detailsModal.data.id, 'json');
                      const url = window.URL.createObjectURL(new Blob([blob]));
                      const a = document.createElement('a'); a.href = url; a.download = `audit_${detailsModal.data.id}.json`; document.body.appendChild(a); a.click(); a.remove();
                    } catch (e) { console.error(e); alert('Export failed.'); }
                  }}>Export JSON</button>
                  <button className="btn btn-sm" onClick={async () => {
                    try {
                      const blob = await auditService.exportEntry(detailsModal.data.id, 'csv');
                      const url = window.URL.createObjectURL(new Blob([blob]));
                      const a = document.createElement('a'); a.href = url; a.download = `audit_${detailsModal.data.id}.csv`; document.body.appendChild(a); a.click(); a.remove();
                    } catch (e) { console.error(e); alert('Export failed.'); }
                  }}>Export CSV</button>
                </div>
              </div>
              <div className="col-span-2 flex justify-end space-x-2 mt-3">
                {detailsModal.data.session_id && (
                  <button className="btn btn-sm bg-red-500 text-white" onClick={() => openPassword('logoutSession', detailsModal.data.session_id)}>Đăng xuất phiên</button>
                )}
                {detailsModal.data.user_id && (
                  <button className="btn btn-sm bg-red-600 text-white" onClick={() => openPassword('logoutAll', detailsModal.data.user_id)}>Đăng xuất tất cả phiên</button>
                )}
              </div>
            </div>
          </div>
        </ModalWrapper>
      )}
      <PasswordModal open={pwModalOpen} value={pwValue} onChange={setPwValue} onCancel={() => setPwModalOpen(false)} onConfirm={handlePasswordConfirm} description={pwAction === 'logoutAll' ? 'Nhập mật khẩu admin để đăng xuất tất cả phiên của người dùng.' : 'Nhập mật khẩu admin để đăng xuất phiên.'} confirmLabel="Xác nhận" />
    </div>
  );
}
