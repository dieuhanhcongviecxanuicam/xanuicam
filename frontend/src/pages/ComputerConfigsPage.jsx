import React, { useEffect, useState, useRef } from 'react';
import useAuth from '../hooks/useAuth';
import api from '../api/axios';
import QuickConfigModal from '../components/computer-configs/QuickConfigModal';
import AdminExportLogs from '../components/AdminExportLogs';
import { saveAs } from 'file-saver';

// Helpers exported for testing and reuse
export const isIPv4 = (v) => {
  if (!v) return true;
  const parts = String(v).trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => {
    if (p === '') return false;
    const n = Number(p);
    return Number.isInteger(n) && String(n) === p && n >= 0 && n <= 255;
  });
};

export const isMAC = (v) => {
  if (!v) return true;
  return /^([0-9a-fA-F]{2}([-:])){5}[0-9a-fA-F]{2}$/.test(v) || /^[0-9a-fA-F]{4}\.[0-9a-fA-F]{4}\.[0-9a-fA-F]{4}$/.test(v);
};

export const isIntegerString = (v) => {
  if (v === undefined || v === null || v === '') return true;
  return /^\d+$/.test(String(v));
};

export const normalizeMac = (v) => {
  if (!v) return '';
  const hex = String(v).replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (hex.length !== 12) return v;
  return hex.match(/.{1,2}/g).join(':');
};

export const normalizeIp = (v) => {
  if (!v) return '';
  const parts = String(v).trim().split('.');
  if (parts.length !== 4) return v;
  const nums = parts.map(p => { if (p === '') return NaN; const n = Number(p); return Number.isInteger(n) ? n : NaN; });
  if (nums.some(n => Number.isNaN(n) || n < 0 || n > 255)) return v;
  return nums.join('.');
};

const ComputerConfigsPage = () => {
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const { hasPermission } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [prefetchCache, setPrefetchCache] = useState({});
  const [hoveredUser, setHoveredUser] = useState(null);
  const [hoverTimeout, setHoverTimeout] = useState(null);

  const [formData, setFormData] = useState({
    hostname: '',
    os: '',
    windows_version: '',
    office_version: '',
    os_version: '',
    cpu: '',
    ram_gb: '',
    disk_gb: '',
    disk_type: '',
    serial: '',
    mac: '',
    ip: '',
    model: '',
    manufacturer: '',
    purchase_date: '',
    warranty_until: '',
    asset_tag: '',
    assigned_department: '',
    location: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [ipPrefix, setIpPrefix] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const ipPrefixOptions = ['', '192.168', '10.0', '172.16'];
  const [collapsedSoftware, setCollapsedSoftware] = useState(false);
  const [collapsedHardware, setCollapsedHardware] = useState(false);
  const [collapsedAsset, setCollapsedAsset] = useState(false);
  const overlayRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalAll, setTotalAll] = useState(null);
  const [exportMenuFor, setExportMenuFor] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [exportSelectedOpen, setExportSelectedOpen] = useState(false);
  const [exportAllOpen, setExportAllOpen] = useState(false);
  const [exportConfirm, setExportConfirm] = useState({ open: false, all: false, ids: [], format: 'xlsx', filtered: false });
  const [exportInProgress, setExportInProgress] = useState(false);
  

  useEffect(() => {
    api.get('/departments')
      .then(r => setDepartments(r.data.data || r.data || []))
      .catch(() => setDepartments([]));
    loadUsers(null, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close export dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    const onDocClick = (e) => {
      const tgt = e.target;
      if (!tgt.closest || !tgt.closest('[data-export-dropdown]')) {
        setExportMenuFor(null);
        setExportSelectedOpen(false);
        setExportAllOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setExportMenuFor(null);
        setExportSelectedOpen(false);
        setExportAllOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const loadUsers = (dept, search, pageNum = 1, limit = pageSize) => {
    setSelectedDept(dept);
    setPage(pageNum);
    const params = { departmentId: dept ? dept.id : '', page: pageNum, limit };
    if (search) params.search = search;
    api.get('/users', { params })
      .then(r => {
        const payload = r.data || {};
        setUsers(payload.data || []);
        if (payload.pagination) {
          setTotalPages(payload.pagination.totalPages || 1);
          setPage(payload.pagination.currentPage || 1);
          setTotalItems(payload.pagination.totalItems || (payload.meta && payload.meta.total) || (payload.data && payload.data.length) || 0);
          if (payload.meta && typeof payload.meta.totalAll !== 'undefined') setTotalAll(payload.meta.totalAll);
        } else if (payload.meta && payload.meta.total) {
          const tot = payload.meta.total || 0;
          setTotalItems(tot);
          setTotalPages(Math.max(1, Math.ceil(tot / limit)));
          if (payload.meta && typeof payload.meta.totalAll !== 'undefined') setTotalAll(payload.meta.totalAll);
        }
      })
      .catch(() => { setUsers([]); setTotalPages(1); setTotalItems(0); setTotalAll(null); });
  };

  const handleSearch = (val) => {
    setSearchText(val);
    // debounce quick typing; only search when empty or at least 2 chars
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      if (!val || String(val).trim().length >= 2) {
        loadUsers(selectedDept, val, 1, pageSize);
      }
    }, 300);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    loadUsers(selectedDept, searchText, newPage, pageSize);
  };

  const toggleSelectAll = (checked) => {
    if (checked) {
      const s = new Set(users.map(u => u.id));
      setSelectedIds(s);
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const downloadBlob = (blob, filename) => {
    try {
      saveAs(blob, filename);
    } catch (e) {
      // fallback
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }
  };

  const exportBulk = async ({ all = false, ids = [], format = 'xlsx', filtered = false }) => {
    // open confirmation modal
    setExportConfirm({ open: true, all, ids, format, filtered });
  };

  const confirmExport = async () => {
    const { all, ids, format, filtered } = exportConfirm;
    setExportInProgress(true);
    try {
      const body = {};
      if (!all) body.userIds = ids;
      if (filtered) body.filters = { departmentId: selectedDept ? selectedDept.id : '', search: searchText };
      // use centralized export helper which returns { blob, filename }
      const out = await api.exportPost('/computer-configs/export', body, {});
      if (out && out.blob) {
        downloadBlob(out.blob, out.filename || `xanuicam_export.${format}`);
      } else {
        try { alert('Lỗi khi xuất file'); } catch (e) {}
      }
    } catch (e) {
      console.error('exportBulk', e);
      // api.exportPost shows a toast; for safety, also show an alert fallback
      try { alert(e && e.message ? e.message : 'Lỗi khi xuất file'); } catch (e2) { /* ignore */ }
    } finally {
      setExportInProgress(false);
      setExportConfirm({ open: false, all: false, ids: [], format: 'xlsx', filtered: false });
    }
  };

  const formatTimestamp = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    const dd = pad(d.getDate());
    const mm = pad(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return { date: `${dd}${mm}${yyyy}`, datetime: `${dd}${mm}${yyyy}${hh}${min}${ss}`, sheetName: `xanuicam_computer_${dd}${mm}${yyyy}` };
  };

  const exportExcel = async (user) => {
    try {
      // Use server-side export to avoid client-side SheetJS vulnerabilities.
      const body = { userIds: [user.id], format: 'xlsx' };
      const out = await api.exportPost('/computer-configs/export', body, {});
      if (out && out.blob) {
        downloadBlob(out.blob, out.filename || `xanuicam_computer_${formatTimestamp(new Date()).datetime}.xlsx`);
      } else {
        if (api && api.showToast) api.showToast('Lỗi khi xuất Excel', 'error'); else alert('Lỗi khi xuất Excel');
      }
    } catch (e) {
      console.error('exportExcel', e);
      if (api && api.showToast) api.showToast('Lỗi khi xuất Excel', 'error'); else alert('Lỗi khi xuất Excel');
    } finally {
      setExportMenuFor(null);
    }
  };

  const exportPDF = async (user) => {
    try {
      // Use server-side export to avoid client-side PDF library vulnerabilities.
      const body = { userIds: [user.id], format: 'pdf' };
      const out = await api.exportPost('/computer-configs/export', body, {});
      if (out && out.blob) {
        downloadBlob(out.blob, out.filename || `xanuicam_computer_${formatTimestamp(new Date()).datetime}.pdf`);
      } else {
        if (api && api.showToast) api.showToast('Lỗi khi xuất PDF', 'error'); else alert('Lỗi khi xuất PDF');
      }
    } catch (e) {
      console.error('exportPDF', e);
      if (api && api.showToast) api.showToast('Lỗi khi xuất PDF', 'error'); else alert('Lỗi khi xuất PDF');
    } finally {
      setExportMenuFor(null);
    }
  };

  const editConfig = async (user, forViewOnly = false) => {
    setEditingUser(user);
    hasPermission(['user_management']);
    try {
      const res = await api.get(`/computer-configs/user/${user.id}`);
      const cfg = res.data && (res.data.config || res.data) ? (res.data.config || res.data) : {};
      // Replace entire formData from fetched config to avoid leaking previous user's values
      const assignedVal = cfg.assigned_department || '';
      let assignedDepartment = assignedVal;
      if (assignedVal && typeof assignedVal === 'string') {
        const asId = departments.find(d => d.id && String(d.id) === assignedVal);
        if (asId) assignedDepartment = String(asId.id);
        else {
          const byName = departments.find(d => d.name === assignedVal);
          if (byName) assignedDepartment = String(byName.id);
        }
      }
      setFormData({
        hostname: cfg.hostname || '',
        os: cfg.os || '',
        windows_version: cfg.windows_version || '',
        office_version: cfg.office_version || '',
        os_version: cfg.os_version || '',
        cpu: cfg.cpu || '',
        ram_gb: cfg.ram_gb || '',
        disk_gb: cfg.disk_gb || '',
        disk_type: cfg.disk_type || '',
        serial: cfg.serial || '',
        mac: cfg.mac || '',
        ip: cfg.ip || '',
        model: cfg.model || '',
        manufacturer: cfg.manufacturer || '',
        purchase_date: cfg.purchase_date || '',
        warranty_until: cfg.warranty_until || '',
        asset_tag: cfg.asset_tag || '',
        assigned_department: assignedDepartment,
        location: cfg.location || '',
        notes: cfg.notes || ''
      });
    } catch (e) {
      // ignore
    }
  };

  // Prefetch brief config when hovering to improve UX
  const prefetchConfig = async (user) => {
    if (!user || prefetchCache[user.id]) return;
    try {
      const res = await api.get(`/computer-configs/user/${user.id}`);
      setPrefetchCache(prev => ({ ...prev, [user.id]: res.data && (res.data.config || res.data) ? (res.data.config || res.data) : {} }));
    } catch (e) {
      // ignore
    }
  };

  const handleMouseEnter = (user) => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    prefetchConfig(user);
    setHoveredUser(user);
  };

  const handleMouseLeave = () => {
    const t = setTimeout(() => setHoveredUser(null), 250);
    setHoverTimeout(t);
  };

  // (use module-level helpers)

  // Close modal on Escape key
  useEffect(() => {
    if (!editingUser) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setEditingUser(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editingUser]);

  useEffect(() => {
    const e = {};
    if (!isMAC(formData.mac)) e.mac = 'Định dạng MAC không hợp lệ';
    if (!isIPv4(formData.ip)) e.ip = 'Địa chỉ IP IPv4 không hợp lệ';
    if (ipPrefix && formData.ip) {
      if (!formData.ip.startsWith(ipPrefix + '.')) e.ipPrefix = `IP phải bắt đầu bằng tiền tố ${ipPrefix}`;
    }
    if (!isIntegerString(formData.ram_gb)) e.ram_gb = 'RAM phải là số nguyên (GB)';
    if (!isIntegerString(formData.disk_gb)) e.disk_gb = 'Dung lượng ổ đĩa phải là số nguyên (GB)';
    setErrors(e);
  }, [formData, ipPrefix]);

  // (use module-level normalizeMac/normalizeIp)

  const saveConfig = async () => {
    if (!editingUser) return;
    if (Object.keys(errors).length > 0) {
      alert('Có lỗi trong biểu mẫu, vui lòng sửa trước khi lưu');
      return;
    }
    setSaveStatus('Đang lưu...');
    const parsed = { ...formData, mac: normalizeMac(formData.mac) };
    try {
      await api.post(`/computer-configs/user/${editingUser.id}`, { config: parsed });
      setSaveStatus('Lưu thành công');
      // attempt to create an audit log (best-effort)
      try {
        await api.post('/audit-logs', {
          action: 'update_computer_config',
          user_id: editingUser.id,
          details: parsed
        }).catch(() => {});
      } catch (e) {
        // ignore audit failures
      }
      setTimeout(() => setSaveStatus(''), 2500);
      setEditingUser(null);
    } catch (err) {
      setSaveStatus('Lưu thất bại');
      console.error('saveConfig error', err && err.message);
    }
  };

  const renderSoftwareSection = () => (
    <>
      <div>
        <label className="block text-sm">Hệ điều hành</label>
        <input className="border p-1 w-full" value={formData.os} onChange={e => setFormData(prev => ({ ...prev, os: e.target.value }))} />
      </div>
      <div>
        <label className="block text-sm">Phiên bản Windows</label>
        <input className="border p-1 w-full" value={formData.windows_version} onChange={e => setFormData(prev => ({ ...prev, windows_version: e.target.value }))} />
      </div>
      <div>
        <label className="block text-sm">Phiên bản Office</label>
        <input className="border p-1 w-full" value={formData.office_version} onChange={e => setFormData(prev => ({ ...prev, office_version: e.target.value }))} />
      </div>
      <div>
        <label className="block text-sm">Phiên bản hệ điều hành (OS)</label>
        <input className="border p-1 w-full" value={formData.os_version} onChange={e => setFormData(prev => ({ ...prev, os_version: e.target.value }))} />
      </div>
    </>
  );

  const renderHardwareSection = () => (
    <>
      {/* Primary hardware row: CPU, RAM, Disk, Disk type, Serial */}
      <div>
        <label className="block text-sm">CPU</label>
        <input className="border p-1 w-full" value={formData.cpu} onChange={e => setFormData(prev => ({ ...prev, cpu: e.target.value }))} />
      </div>
      <div>
        <label className="block text-sm">RAM (GB)</label>
        <input className="border p-1 w-full" value={formData.ram_gb} onChange={e => setFormData(prev => ({ ...prev, ram_gb: e.target.value }))} />
        {errors.ram_gb && <div className="text-red-600 text-xs mt-1">{errors.ram_gb}</div>}
      </div>
      <div>
        <label className="block text-sm">Loại ổ cứng</label>
        <select className="border p-1 w-full" value={formData.disk_type} onChange={e => setFormData(prev => ({ ...prev, disk_type: e.target.value }))}>
          <option value="">-- Chưa chọn --</option>
          <option value="HDD">HDD</option>
          <option value="SSD">SSD</option>
        </select>
      </div>
      <div>
        <label className="block text-sm">Dung lượng ổ cứng (GB)</label>
        <input className="border p-1 w-full" value={formData.disk_gb} onChange={e => setFormData(prev => ({ ...prev, disk_gb: e.target.value }))} />
        {errors.disk_gb && <div className="text-red-600 text-xs mt-1">{errors.disk_gb}</div>}
      </div>
      <div>
        <label className="block text-sm">Số serial</label>
        <input className="border p-1 w-full" value={formData.serial} onChange={e => setFormData(prev => ({ ...prev, serial: e.target.value }))} />
      </div>

      {/* Secondary hardware row: Model, Manufacturer (placed below) */}
      <div>
        <label className="block text-sm">Model</label>
        <input className="border p-1 w-full" value={formData.model} onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))} />
      </div>
      <div>
        <label className="block text-sm">Nhà sản xuất</label>
        <input className="border p-1 w-full" value={formData.manufacturer} onChange={e => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))} />
      </div>
    </>
  );

  const renderAssetSection = () => (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="block text-sm">Ngày mua</label>
          <input type="date" className="border p-1 w-full" value={formData.purchase_date} onChange={e => setFormData(prev => ({ ...prev, purchase_date: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm">Bảo hành đến</label>
          <input type="date" className="border p-1 w-full" value={formData.warranty_until} onChange={e => setFormData(prev => ({ ...prev, warranty_until: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm">Đơn vị bảo hành</label>
          <input className="border p-1 w-full" value={formData.location} onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))} />
        </div>
      </div>
      <div className="mt-2">
        <label className="block text-sm">Ghi chú</label>
        <textarea className="border p-1 w-full" value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} />
      </div>
    </>
  );

  return (
    <div className="px-4 sm:px-6 pt-6 pb-24 sm:pb-6 max-w-screen-xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">Quản lý cấu hình máy tính theo tài khoản</h2>
      <div className="flex gap-4">
        <div className="w-64">
          <h4 className="font-medium">Phòng ban</h4>
          <ul className="mt-2">
            <li key="all" className={`p-2 cursor-pointer ${selectedDept === null ? 'bg-blue-100 text-blue-800 font-medium' : ''}`} onClick={() => loadUsers(null)}>Tất cả</li>
            {departments.map(d => (
              <li key={d.id} className={`p-2 cursor-pointer ${selectedDept && selectedDept.id === d.id ? 'bg-blue-100 text-blue-800 font-medium' : ''}`} onClick={() => loadUsers(d)}>{d.name}</li>
            ))}
          </ul>
        </div>

        <div className="flex-1">
          <h4 className="font-medium">Tài khoản</h4>
          <div className="mb-2 flex items-center gap-2">
            <input value={searchText} onChange={e => handleSearch(e.target.value)} placeholder="Tìm theo tên hoặc tên đăng nhập" className="border p-2 w-full md:w-96" />
            <button onClick={() => loadUsers(selectedDept, searchText)} className="btn-secondary">Tìm</button>

            <div className="relative ml-2" data-export-dropdown>
              <button className="btn-secondary" onClick={() => setExportSelectedOpen(s => !s)} disabled={selectedIds.size === 0}>Xuất đã chọn ▾</button>
              {exportSelectedOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow-lg z-20">
                  <button className="block w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => exportBulk({ all: false, ids: Array.from(selectedIds), format: 'xlsx' })} disabled={selectedIds.size === 0}>Xuất đã chọn (Excel)</button>
                  <button className="block w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => exportBulk({ all: false, ids: Array.from(selectedIds), format: 'pdf' })} disabled={selectedIds.size === 0}>Xuất đã chọn (PDF)</button>
                  
                </div>
              )}
            </div>

            <div className="relative" data-export-dropdown>
              <button className="btn-secondary" onClick={() => setExportAllOpen(s => !s)}>Xuất tất cả ▾</button>
              {exportAllOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow-lg z-20">
                  <button className="block w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => exportBulk({ all: true, ids: [], format: 'xlsx' })}>Xuất tất cả (Excel)</button>
                  <button className="block w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => exportBulk({ all: true, ids: [], format: 'pdf' })}>Xuất tất cả (PDF)</button>
                  
                </div>
              )}
            </div>

            <div className="ml-4 text-sm text-slate-600">Đã chọn: {selectedIds.size}</div>
            <AdminExportLogs />
          </div>
          <table className="min-w-full mt-2">
            <thead>
              <tr className="text-left"><th><input type="checkbox" onChange={e => toggleSelectAll(e.target.checked)} checked={selectedIds.size === users.length && users.length > 0} /></th><th>Họ tên</th><th>Tên đăng nhập</th><th>Hành động</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={`border-t ${u.is_active === false ? 'bg-red-50' : ''}`} title={u.is_active === false ? 'Tài khoản đã bị vô hiệu hóa' : ''}>
                  <td className="px-2 py-2"><input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} /></td>
                  <td>
                    <button
                      title="Di chuột để xem, nhấp để mở chi tiết"
                      onMouseEnter={() => handleMouseEnter(u)}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => editConfig(u, false)}
                      className={`text-left hover:underline ${u.is_active === false ? 'text-red-600' : 'text-blue-600'}`}
                    >{u.full_name}</button>
                  </td>
                  <td>
                    <button title="Nhấp để xem chi tiết" onMouseEnter={() => handleMouseEnter(u)} onMouseLeave={handleMouseLeave} onClick={() => editConfig(u, false)} className={`text-left hover:underline ${u.is_active === false ? 'text-red-600' : 'text-slate-700'}`}>{u.username}</button>
                  </td>
                  <td>
                    {hasPermission(['user_management']) ? (
                      <div className="relative inline-block text-left" data-export-dropdown>
                        <button className="btn-primary" onClick={() => setExportMenuFor(exportMenuFor === u.id ? null : u.id)}>Xuất cấu hình ▾</button>
                        {exportMenuFor === u.id && (
                          <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-lg z-10">
                            <button className="block w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => exportExcel(u)}>Xuất Excel</button>
                            <button className="block w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => exportPDF(u)}>Xuất PDF</button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500">Không có quyền</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <label className="text-sm text-slate-600">Hiển thị</label>
                <select className="border px-2 py-1 rounded" value={pageSize} onChange={e => { const v = parseInt(e.target.value, 10); setPageSize(v); loadUsers(selectedDept, searchText, 1, v); setPage(1); }}>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div className="text-sm text-slate-600">Số lượng máy tính: <span className="font-medium">{totalAll !== null ? totalAll : totalItems}</span> máy</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-secondary" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>Trước</button>
              <div className="px-2">{page} / {totalPages}</div>
              <button className="btn-secondary" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}>Tiếp</button>
            </div>
          </div>
          {exportConfirm.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black opacity-40 z-40" />
              <div className="bg-white rounded p-4 z-50 w-96">
                <h3 className="font-semibold">Xác nhận xuất file</h3>
                <p className="text-sm mt-2">Bạn có chắc muốn xuất {exportConfirm.all ? 'tất cả người dùng' : (exportConfirm.ids.length + ' người dùng đã chọn')} sang {exportConfirm.format === 'xlsx' ? 'Excel' : 'PDF'}?</p>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button className="btn-secondary" onClick={() => setExportConfirm({ open: false, all: false, ids: [], format: 'xlsx', filtered: false })} disabled={exportInProgress}>Hủy</button>
                  <button className="btn-primary flex items-center gap-2" onClick={confirmExport} disabled={exportInProgress}>
                    {exportInProgress ? <span className="loader h-4 w-4 border-2 border-white rounded-full animate-spin" /> : null}
                    Xuất
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {editingUser && (
        <div ref={overlayRef} onMouseDown={(e) => { if (e.target === overlayRef.current) setEditingUser(null); }} className="fixed inset-0 flex items-start justify-center bg-black bg-opacity-40 z-50">
                <div className="absolute top-16 left-0 right-0 bottom-0 bg-white p-4 sm:relative sm:top-auto sm:left-auto sm:right-auto sm:bottom-auto sm:p-6 sm:rounded-lg w-full sm:w-[min(90%,1200px)] mx-0 sm:mx-auto overflow-auto pb-6 sm:pb-12">
            <h3 className="font-semibold">Cấu hình máy tính của {editingUser.full_name}</h3>
            <div className="mb-2">
              <fieldset disabled={!hasPermission(['user_management'])} className="space-y-2">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="text-sm font-medium">(Biểu mẫu thông tin chi tiết cấu hình máy tính phục vụ mục đích công vụ)</div>
                <div className="w-full sm:w-1/3 mt-2 sm:mt-0">
                  <label className="block text-sm">Địa chỉ MAC</label>
                  <input
                    className="border p-1 w-full"
                    value={formData.mac}
                    onChange={e => setFormData(prev => ({ ...prev, mac: e.target.value }))}
                    onBlur={() => setFormData(prev => ({ ...prev, mac: normalizeMac(prev.mac) }))}
                  />
                  {errors.mac && <div className="text-red-600 text-xs mt-1">{errors.mac}</div>}
                </div>
              </div>

              <label className="block text-sm font-semibold mt-4">THÔNG TIN CHUNG</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                <div>
                  <label className="block text-sm">Địa chỉ IP</label>
                  <input
                    className="border p-1 w-full"
                    value={formData.ip}
                    onChange={e => setFormData(prev => ({ ...prev, ip: e.target.value }))}
                    onBlur={() => setFormData(prev => ({ ...prev, ip: normalizeIp(prev.ip) }))}
                  />
                  {errors.ip && <div className="text-red-600 text-xs mt-1">{errors.ip}</div>}
                </div>
                <div>
                  <label className="block text-sm">Mã tài sản</label>
                  <input className="border p-1 w-full" value={formData.asset_tag} onChange={e => setFormData(prev => ({ ...prev, asset_tag: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm">IP</label>
                  <select className="border p-1 w-full" value={ipPrefix} onChange={e => setIpPrefix(e.target.value)}>
                    {ipPrefixOptions.map(p => <option key={p} value={p}>{p || '-- Chưa chọn --'}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <label className="block text-sm font-semibold">THÔNG TIN PHẦN MỀM</label>
                <button className="text-sm text-slate-500" onClick={() => setCollapsedSoftware(s => !s)}>{collapsedSoftware ? 'Mở' : 'Thu gọn'}</button>
              </div>

              {!collapsedSoftware && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-2">
                  {renderSoftwareSection()}
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                <label className="block text-sm font-semibold">THÔNG TIN PHẦN CỨNG</label>
                <button className="text-sm text-slate-500" onClick={() => setCollapsedHardware(s => !s)}>{collapsedHardware ? 'Mở' : 'Thu gọn'}</button>
              </div>

              {!collapsedHardware && (
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mt-2">
                  {renderHardwareSection()}
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                <label className="block text-sm font-semibold">THÔNG TIN TÀI SẢN</label>
                <button className="text-sm text-slate-500" onClick={() => setCollapsedAsset(s => !s)}>{collapsedAsset ? 'Mở' : 'Thu gọn'}</button>
              </div>

              {!collapsedAsset && (
                <div className="mt-2">
                  {renderAssetSection()}
                </div>
              )}

              </fieldset>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="text-sm text-slate-600">{saveStatus}</div>
                <div className="flex items-center gap-2">
                  <button className="btn-secondary" onClick={() => { setEditingUser(null); }}>Hủy</button>
                  {hasPermission(['user_management']) ? (
                    <button className={`btn-primary ${Object.keys(errors).length ? 'opacity-60 cursor-not-allowed' : ''}`} onClick={saveConfig} disabled={Object.keys(errors).length > 0}>Lưu</button>
                  ) : (
                    <span className="text-xs text-slate-500">Bạn không có quyền chỉnh sửa</span>
                  )}
                </div>
              </div>
          </div>
        </div>
      )}
      {/* Quick read-only summary for hovered user */}
      {hoveredUser && (
        <QuickConfigModal
          visible={!!hoveredUser}
          user={hoveredUser}
          config={prefetchCache[hoveredUser.id]}
          onClose={() => setHoveredUser(null)}
        />
      )}
    </div>
  );
};

export default ComputerConfigsPage;
