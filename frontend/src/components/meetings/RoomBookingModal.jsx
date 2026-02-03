// ubndxanuicam/frontend/src/components/meetings/RoomBookingModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import apiService from '../../services/apiService';
import { sanitizeDigits, parseIntegerOrNull, validateIntegerInRange, clampInteger } from '../../utils/numberValidation';
import ModalWrapper from '../common/ModalWrapper';
import AttachmentViewerModal from '../common/AttachmentViewerModal';

const ROOMS = ['Phòng họp lầu 2', 'Hội trường UBND', 'Phòng tiếp công dân'];

const RoomBookingModal = ({ isOpen, onClose, onSuccess, selectedTime, selectedRoom, booking }) => {
    const [formData, setFormData] = useState({
        room_name: '',
        title: '',
        // replaced single "Mục đích sử dụng" with two fields below
        basis_super: '',
        basis_commune: '',
        // leader: support selecting existing user or custom text
            leader_selected: '', // '' | userId | '__custom__'
            leader_custom: '',
            leader_input: '', // free-text / datalist value for leader selector
        description: '',
        start_time: '',
        end_time: '',
        department_id: '',
        department_input: '',
        attendees_count: '1',
        other_invited_count: '0',
        has_led: false
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [leaders, setLeaders] = useState([]);
    const [attachmentFiles, setAttachmentFiles] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [viewAttachment, setViewAttachment] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState({ open: false, path: null });
    const [fileError, setFileError] = useState('');
    const [quotaWarning, setQuotaWarning] = useState('');
    const [formErrors, setFormErrors] = useState({});
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);
    const [folderUploads, setFolderUploads] = useState([]); // { name, files: [], totalSize }
    const [expandedFolders, setExpandedFolders] = useState({});

    useEffect(() => {
        if (!isOpen) return;
        // helper: format Date -> 'YYYY-MM-DDTHH:mm' local for datetime-local input
        const formatLocalInput = (d) => {
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        if (booking) {
            // Edit mode: show local datetime values
                setFormData({
                title: booking.title || '',
                room_name: booking.room_name,
                basis_super: booking.basis_super || '',
                basis_commune: booking.basis_commune || '',
                leader_selected: booking.leader_in_charge ? String(booking.leader_in_charge) : (booking.leader_name ? '__custom__' : ''),
                leader_custom: booking.leader_in_charge ? '' : (booking.leader_name || ''),
                    leader_input: booking.leader_in_charge ? (booking.leader_name || '') : (booking.leader_name || ''),
                description: booking.description || '',
                start_time: formatLocalInput(new Date(booking.start_time)),
                end_time: formatLocalInput(new Date(booking.end_time)),
                department_id: booking.department_id || '',
                department_input: booking.department_name || booking.department_id || '',
                attendees_count: booking.attendees_count ? String(booking.attendees_count) : '',
                other_invited_count: booking.other_invited_count ? String(booking.other_invited_count) : '0',
                has_led: !!booking.has_led
            });
            // parse existing attachments for display
            try {
                const paths = typeof booking.attachment_path === 'string' ? JSON.parse(booking.attachment_path) : booking.attachment_path;
                const arr = Array.isArray(paths) ? paths : (paths ? [paths] : []);
                setExistingAttachments(arr);
            } catch (e) {
                if (booking.attachment_path) setExistingAttachments([booking.attachment_path]);
                else setExistingAttachments([]);
            }
            return;
        }
        // if creating new booking, ensure previous attachment state is cleared
        setExistingAttachments([]);
        setAttachmentFiles([]);
        if (selectedTime) {
            const start = new Date(selectedTime);
            const snappedStart = new Date(Math.round(start.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000));
            const end = new Date(snappedStart.getTime() + 60 * 60 * 1000);
            setFormData({
                title: '',
                room_name: selectedRoom || ROOMS[0], // default
                basis_super: '',
                basis_commune: '',
                leader_selected: '',
                leader_custom: '',
                    leader_input: '',
                description: '',
                start_time: formatLocalInput(snappedStart),
                end_time: formatLocalInput(end),
                department_id: '',
                department_input: '',
                attendees_count: '1',
                other_invited_count: '0',
                has_led: false
            });
            return;
        }

        // No selectedTime and not editing: default to now -> +1h
        const now = new Date();
        const snappedNow = new Date(Math.round(now.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000));
        const defaultStart = snappedNow;
        const defaultEnd = new Date(snappedNow.getTime() + 60 * 60 * 1000);
        setFormData({
            title: '',
            room_name: selectedRoom || ROOMS[0],
            basis_super: '',
            basis_commune: '',
            leader_selected: '',
            leader_custom: '',
                leader_input: '',
            description: '',
            start_time: formatLocalInput(defaultStart),
            end_time: formatLocalInput(defaultEnd),
            department_id: '',
            department_input: '',
            attendees_count: '1',
            other_invited_count: '0',
            has_led: false
        });
    }, [isOpen, selectedTime, selectedRoom, booking]);

    useEffect(() => {
        let mounted = true;
        apiService.getDepartments().then(resp => {
            const list = Array.isArray(resp) ? resp : (resp && resp.data) ? resp.data : [];
            if (mounted) setDepartments(list);
        }).catch(() => {});
                // Determine leaders: prefer users with persisted `is_leader` flag; fall back to role-name heuristics
        (async () => {
            try {
                const roles = await apiService.getRoles();
                const rolesList = Array.isArray(roles) ? roles : (roles && roles.data) ? roles.data : [];
                // find best match for role name containing 'Lãnh' or exact 'Lãnh đạo'
                let leaderRole = rolesList.find(r => r.name === 'Lãnh đạo' || r.role_name === 'Lãnh đạo' || (r.name && String(r.name).includes('Lãnh')) || (r.role_name && String(r.role_name).includes('Lãnh')));
                const leaderRoleId = leaderRole ? (leaderRole.id || leaderRole.role_id) : null;

                // Fetch full user list (use large limit) and filter client-side for leader flag/role.
                let usersResp = await apiService.getUsers({ limit: 1000 }).catch(() => null);
                if (!usersResp) usersResp = await apiService.getUsers().catch(() => null);
                const usersList = Array.isArray(usersResp) ? usersResp : (usersResp && usersResp.data) ? usersResp.data : [];
                if (!mounted) return;
                const userHasLeaderFlag = (u) => !!u && (u.is_leader === true || u.is_leader === '1' || u.is_leader === 'true' || u.is_leader === 1);

                const userHasLeaderRole = (u) => {
                    if (!u) return false;
                    if (leaderRoleId) {
                        if (u.role_id && String(u.role_id) === String(leaderRoleId)) return true;
                        if (u.role && String(u.role) === String(leaderRoleId)) return true;
                    }
                    if (Array.isArray(u.roles)) {
                        if (u.roles.some(r => String(r) === String(leaderRoleId))) return true;
                        if (u.roles.some(r => r && (String(r.id) === String(leaderRoleId) || String(r.role_id) === String(leaderRoleId) || (r.name && String(r.name).includes('Lãnh'))))) return true;
                    }
                    if (u.role === 'Lãnh đạo' || u.role_name === 'Lãnh đạo') return true;
                    if ((u.role && String(u.role).includes('Lãnh')) || (u.role_name && String(u.role_name).includes('Lãnh')) || (u.name && String(u.name).includes('Lãnh'))) return true;
                    return false;
                };

                // prefer persisted is_leader flag when present
                let filtered = usersList.filter(u => userHasLeaderFlag(u));
                if (filtered.length === 0) filtered = usersList.filter(userHasLeaderRole);
                // sort by display name for consistent UX
                filtered.sort((a, b) => {
                    const aName = a.full_name || a.name || a.username || '';
                    const bName = b.full_name || b.name || b.username || '';
                    return String(aName).localeCompare(String(bName));
                });
                setLeaders(filtered);
            } catch (e) {
                // fallback: load users and filter by role name
                try {
                    const resp = await apiService.getUsers();
                    const users = Array.isArray(resp) ? resp : (resp && resp.data) ? resp.data : [];
                    const filtered = users.filter(u => (u.role === 'Lãnh đạo' || u.role_name === 'Lãnh đạo' || (u.role && String(u.role).includes('Lãnh')) || (u.role_name && String(u.role_name).includes('Lãnh'))));
                    if (mounted) setLeaders(filtered);
                } catch (e2) {
                    // ignore
                }
            }
        })();
        return () => { mounted = false; };
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const integerKeyDown = (e) => {
        // prevent scientific notation, plus/minus, decimal point
        if (['e','E','+','-','.'].includes(e.key)) e.preventDefault();
    };

    const handleIntegerChange = (name, min, max, defaultVal) => (e) => {
        const raw = e.target.value;
        if (raw === '') {
            setFormData(fd => ({ ...fd, [name]: '' }));
            setFormErrors(prev => ({ ...prev, [name]: null }));
            return;
        }
        const cleaned = sanitizeDigits(raw);
        if (cleaned === '') {
            setFormData(fd => ({ ...fd, [name]: '' }));
            const msg = `Phải là số nguyên${typeof min !== 'undefined' ? ` ≥ ${min}` : ''}${typeof max !== 'undefined' ? ` và ≤ ${max}` : ''}.`;
            setFormErrors(prev => ({ ...prev, [name]: msg }));
            return;
        }
        const n = parseIntegerOrNull(cleaned);
        setFormData(fd => ({ ...fd, [name]: String(n) }));
        const res = validateIntegerInRange(n, min, max);
        setFormErrors(prev => ({ ...prev, [name]: res.valid ? null : res.message }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        // prevent submit if client-side validation errors
        const hasErr = Object.values(formErrors || {}).some(x => x);
        if (hasErr) {
            setError('Vui lòng sửa các lỗi trong biểu mẫu trước khi gửi.');
            setLoading(false);
            return;
        }
        try {
            // validate that end is after start
            const s = new Date(formData.start_time);
            const en = new Date(formData.end_time);
            if (en <= s) {
                setError('Thời gian kết thúc phải sau thời gian bắt đầu.');
                setLoading(false);
                return;
            }
            // Build payload (FormData supports optional file attachments)
            const payload = new FormData();
            payload.append('room_name', formData.room_name);
            payload.append('title', formData.title || '');
            // always include basis fields (allow sending empty string to clear)
            payload.append('basis_super', formData.basis_super || '');
            payload.append('basis_commune', formData.basis_commune || '');
            // leader: either selected user id or custom text
            if (formData.leader_selected && formData.leader_selected !== '__custom__') payload.append('leader_in_charge', formData.leader_selected);
            if (formData.leader_selected === '__custom__' && formData.leader_custom) payload.append('leader_in_charge_text', formData.leader_custom);
            if (!formData.leader_selected && formData.leader_custom) payload.append('leader_in_charge_text', formData.leader_custom);
            payload.append('description', formData.description || '');
            payload.append('start_time', new Date(formData.start_time).toISOString());
            payload.append('end_time', new Date(formData.end_time).toISOString());
            if (formData.department_id) payload.append('department_id', formData.department_id);
            if (formData.attendees_count !== '' && formData.attendees_count !== null) payload.append('attendees_count', String(formData.attendees_count));
            if (typeof formData.other_invited_count !== 'undefined' && formData.other_invited_count !== null) payload.append('other_invited_count', String(formData.other_invited_count));
            payload.append('has_led', formData.has_led ? 'true' : 'false');
            if (attachmentFiles && attachmentFiles.length > 0) {
                for (const f of attachmentFiles) payload.append('attachments', f);
            }
            // include files selected via folder upload
            if (folderUploads && folderUploads.length > 0) {
                for (const folder of folderUploads) {
                    for (const f of folder.files) {
                        payload.append('attachments', f);
                        if (f.webkitRelativePath) payload.append('attachments_relative_paths[]', f.webkitRelativePath);
                    }
                }
            }

            // If user removed existing attachments client-side, inform backend
            if (existingAttachments && booking && booking.attachment_path) {
                // existingAttachments contains the remaining ones; to indicate removals send removed_attachments if any
                try {
                    const orig = typeof booking.attachment_path === 'string' ? JSON.parse(booking.attachment_path) : booking.attachment_path;
                    const origArr = Array.isArray(orig) ? orig : (orig ? [orig] : []);
                    const removed = origArr.filter(p => !existingAttachments.includes(p));
                    if (removed.length > 0) payload.append('deleted_files', JSON.stringify(removed));
                } catch (e) {
                    // if parsing fails and user removed the single one
                    if (booking.attachment_path && existingAttachments.length === 0) payload.append('deleted_files', JSON.stringify([booking.attachment_path]));
                }
            }

            if (booking) {
                const updated = await apiService.updateRoomBooking(booking.id, payload);
                try { apiService.logEvent({ module: 'Đặt phòng', action: 'Cập nhật', details: updated.title || '', resource_type: 'room_booking', resource_id: updated.id, change: { updated } }).catch(()=>{}); } catch(e){}
            } else {
                const created = await apiService.createRoomBooking(payload);
                try { apiService.logEvent({ module: 'Đặt phòng', action: 'Tạo', details: created.title || '', resource_type: 'room_booking', resource_id: created.id, change: created }).catch(()=>{}); } catch(e){}
            }
            onSuccess();
            onClose();
        } catch (err) {
            const msg = err && err.message ? err.message : (typeof err === 'string' ? err : JSON.stringify(err));
            setError(msg || 'Đặt phòng thất bại. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg" className="p-6" coverHeader={true}>
            <div className="bg-white rounded-lg w-full">
                <h2 className="text-xl font-bold mb-4 sticky top-0 bg-white z-10">Đăng ký phòng họp</h2>
                {error && <p className="text-red-500 bg-red-50 p-2 rounded-md text-sm mb-4">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* CẢI TIẾN: Cho phép chọn phòng trong modal */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Phòng họp</label>
                            <select name="room_name" value={formData.room_name} onChange={handleChange} required className="mt-1 input-style w-full max-w-full">
                                {ROOMS.map(room => <option key={room} value={room}>{room}</option>)}
                            </select>
                        </div>
                        <div>
                            <div className="flex gap-3">
                                <div className="flex-1 min-w-0">
                                    <label className="block text-sm font-medium text-slate-700">Số lượng ĐB</label>
                                    <input
                                        name="attendees_count"
                                        type="number"
                                        min="1"
                                        max="500"
                                        step="1"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={formData.attendees_count}
                                        onKeyDown={integerKeyDown}
                                        onChange={handleIntegerChange('attendees_count', 1, 500, 1)}
                                        onBlur={()=>{
                                            const parsed = parseIntegerOrNull(formData.attendees_count);
                                            const clamped = clampInteger(parsed, 1, 500, 1);
                                            setFormData(fd=>({...fd, attendees_count: String(clamped)}));
                                            setFormErrors(prev=>({...prev, attendees_count: null}));
                                        }}
                                        className={`mt-1 input-style no-native-arrows w-full ${formErrors.attendees_count ? 'input-error' : ''}`}
                                    />
                                    {formErrors.attendees_count && <div className="field-error">{formErrors.attendees_count}</div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <label className="block text-sm font-medium text-slate-700">Số lượng K.Mời</label>
                                    <input
                                        name="other_invited_count"
                                        type="number"
                                        min="0"
                                        max="500"
                                        step="1"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={formData.other_invited_count}
                                        onKeyDown={integerKeyDown}
                                        onChange={handleIntegerChange('other_invited_count', 0, 500, 0)}
                                        onBlur={()=>{
                                            const parsed = parseIntegerOrNull(formData.other_invited_count);
                                            const clamped = clampInteger(parsed, 0, 500, 0);
                                            setFormData(fd=>({...fd, other_invited_count: String(clamped)}));
                                            setFormErrors(prev=>({...prev, other_invited_count: null}));
                                        }}
                                        className={`mt-1 input-style no-native-arrows w-full ${formErrors.other_invited_count ? 'input-error' : ''}`}
                                    />
                                    {formErrors.other_invited_count && <div className="field-error">{formErrors.other_invited_count}</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* LED checkbox placed under room selector and shows full label text when visible */}
                    {formData.room_name === 'Hội trường UBND' && (
                        <div className="mt-2 flex items-center gap-2">
                            <input id="has_led" name="has_led" type="checkbox" checked={formData.has_led} onChange={(e)=>setFormData({...formData, has_led: e.target.checked})} className="led-checkbox" />
                            <label htmlFor="has_led" className="text-sm text-slate-700">Tích chọn nếu có nhu cầu sử dụng màn hình LED</label>
                        </div>
                    )}
                <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Căn cứ GM (cấp trên)</label>
                                <input name="basis_super" value={formData.basis_super} onChange={handleChange} className="mt-1 input-style no-native-arrows" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Căn cứ GM (xã)</label>
                            <input name="basis_commune" value={formData.basis_commune} onChange={handleChange} className="mt-1 input-style no-native-arrows" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Tiêu đề <span className="text-red-500">*</span></label>
                        <input name="title" value={formData.title} onChange={handleChange} required className="mt-1 input-style no-native-arrows" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Từ</label>
                            <input
                                name="start_time"
                                type="datetime-local"
                                value={formData.start_time}
                                onChange={handleChange}
                                required
                                className="mt-1 input-style no-native-arrows"
                                aria-describedby="time-help"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Đến</label>
                            <input
                                name="end_time"
                                type="datetime-local"
                                value={formData.end_time}
                                onChange={handleChange}
                                required
                                className="mt-1 input-style no-native-arrows"
                                aria-describedby="time-help"
                            />
                        </div>
                    </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Lãnh đạo chủ trì</label>
                                {leaders && leaders.length > 0 ? (
                                    <>
                                        <input
                                            name="leader_input"
                                            list="leaders-list"
                                            placeholder="Chọn hoặc nhập tên chủ trì"
                                            value={formData.leader_input || ''}
                                            onChange={(e)=>{
                                                const v = e.target.value;
                                                const found = leaders.find(l => (l.full_name || l.name || l.username) === v);
                                                if (found) setFormData({...formData, leader_selected: String(found.id), leader_custom: '', leader_input: v});
                                                else setFormData({...formData, leader_selected: '__custom__', leader_custom: v, leader_input: v});
                                            }}
                                            className="mt-1 input-style no-native-arrows"
                                        />
                                        <datalist id="leaders-list">
                                            {leaders.map(l => <option key={l.id} value={l.full_name || l.name || l.username} />)}
                                        </datalist>
                                    </>
                                ) : (
                                    <input name="leader_custom" placeholder="Nhập tên người chủ trì" value={formData.leader_custom} onChange={(e)=>setFormData({...formData, leader_custom: e.target.value, leader_input: e.target.value})} className="mt-1 input-style no-native-arrows" />
                                )}
                            </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Đơn vị triển khai</label>
                                    <input
                                        name="department_input"
                                        list="departments-list"
                                        placeholder="-- Chọn đơn vị --"
                                        value={formData.department_input || ''}
                                        onChange={(e)=>{
                                            const v = e.target.value;
                                            const found = departments.find(d => (d.name || '') === v || String(d.id) === v);
                                            if (found) setFormData({...formData, department_id: String(found.id), department_input: v});
                                            else setFormData({...formData, department_id: '', department_input: v});
                                        }}
                                        className="mt-1 input-style no-native-arrows w-full"
                                    />
                                    <datalist id="departments-list">
                                        {departments.map(d => <option key={d.id} value={d.name} />)}
                                    </datalist>
                                </div>
                        </div>

                    

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Mô tả thêm (tùy chọn)</label>
                        <textarea name="description" value={formData.description} onChange={handleChange} rows="3" className="mt-1 input-style no-native-arrows" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                                <label className="inline-flex items-center">
                                <button type="button" onClick={() => fileInputRef.current && fileInputRef.current.click()} className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50">Chọn tệp</button>
                                <button type="button" onClick={() => folderInputRef.current && folderInputRef.current.click()} className="ml-2 inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50">Chọn thư mục</button>
                                </label>
                            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.xlsx,.xls,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png" multiple onChange={(e)=>{
                            const filesArr = Array.from(e.target.files || []);
                            if (filesArr.length === 0) { setAttachmentFiles([]); setFileError(''); return; }
                            // validate per-file limits: pdf<=10MB, docx/xlsx<=5MB, images<=50MB
                            for (const f of filesArr) {
                                const name = f.name || '';
                                const ext = (name.split('.').pop() || '').toLowerCase();
                                const size = Number(f.size || 0);
                                if (ext === 'pdf' && size > 10 * 1024 * 1024) { setFileError(`Tệp ${name} vượt quá giới hạn PDF 10MB`); e.target.value = ''; setAttachmentFiles([]); return; }
                                if ((ext === 'docx' || ext === 'doc') && size > 5 * 1024 * 1024) { setFileError(`Tệp ${name} vượt quá giới hạn Word 5MB`); e.target.value = ''; setAttachmentFiles([]); return; }
                                if ((ext === 'xlsx' || ext === 'xls') && size > 5 * 1024 * 1024) { setFileError(`Tệp ${name} vượt quá giới hạn Excel 5MB`); e.target.value = ''; setAttachmentFiles([]); return; }
                                if ((ext === 'jpg' || ext === 'jpeg' || ext === 'png') && size > 50 * 1024 * 1024) { setFileError(`Ảnh ${name} vượt quá giới hạn 50MB`); e.target.value = ''; setAttachmentFiles([]); return; }
                                // reject unknown extensions
                                const allowed = ['pdf','docx','doc','xlsx','xls','jpg','jpeg','png'];
                                if (!allowed.includes(ext)) { setFileError(`Định dạng tệp ${name} không được hỗ trợ.`); e.target.value = ''; setAttachmentFiles([]); return; }
                            }
                            setFileError(''); setAttachmentFiles(filesArr);
                            // quota warning: if new upload bundle exceeds 80% of 10GB
                            try {
                                const totalNew = filesArr.reduce((s,f)=>s + (Number(f.size||0)),0) + folderUploads.reduce((s,ff)=>s + (Number(ff.totalSize||0)),0);
                                const threshold = 10 * 1024 * 1024 * 1024 * 0.8;
                                if (totalNew > threshold) setQuotaWarning('Cảnh báo: tổng dung lượng tệp tải lên vượt quá 80% của hạn mức 10GB.'); else setQuotaWarning('');
                            } catch (e) { setQuotaWarning(''); }
                        }} className="mt-1 hidden" />
                            <input ref={folderInputRef} type="file" webkitdirectory="true" directory="true" multiple accept=".pdf,.docx,.xlsx,.xls,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png" onChange={(e)=>{
                                const filesArr = Array.from(e.target.files || []);
                                if (filesArr.length === 0) { return; }
                                // total folder size validation
                                const total = filesArr.reduce((s,f)=>s + (Number(f.size||0)), 0);
                                if (total > 100 * 1024 * 1024) { setFileError('Tổng dung lượng thư mục vượt quá 100MB'); e.target.value = ''; return; }
                                // per-file validation (reuse same rules)
                                for (const f of filesArr) {
                                    const name = f.name || '';
                                    const ext = (name.split('.').pop() || '').toLowerCase();
                                    const size = Number(f.size || 0);
                                    if (ext === 'pdf' && size > 10 * 1024 * 1024) { setFileError(`Tệp ${name} vượt quá giới hạn PDF 10MB`); e.target.value = ''; return; }
                                    if ((ext === 'docx' || ext === 'doc') && size > 5 * 1024 * 1024) { setFileError(`Tệp ${name} vượt quá giới hạn Word 5MB`); e.target.value = ''; return; }
                                    if ((ext === 'xlsx' || ext === 'xls') && size > 5 * 1024 * 1024) { setFileError(`Tệp ${name} vượt quá giới hạn Excel 5MB`); e.target.value = ''; return; }
                                    if ((ext === 'jpg' || ext === 'jpeg' || ext === 'png') && size > 50 * 1024 * 1024) { setFileError(`Ảnh ${name} vượt quá giới hạn 50MB`); e.target.value = ''; return; }
                                    const allowed = ['pdf','docx','doc','xlsx','xls','jpg','jpeg','png'];
                                    if (!allowed.includes(ext)) { setFileError(`Định dạng tệp ${name} không được hỗ trợ.`); e.target.value = ''; return; }
                                }
                                // group by top-level folder from webkitRelativePath
                                const grouped = {};
                                for (const f of filesArr) {
                                    const rel = f.webkitRelativePath || f.name;
                                    const top = rel.split('/')[0] || rel;
                                    if (!grouped[top]) grouped[top] = [];
                                    grouped[top].push(f);
                                }
                                const newFolders = Object.keys(grouped).map(k=>({ name: k, files: grouped[k], totalSize: grouped[k].reduce((s,f)=>s+(Number(f.size||0)),0) }));
                                setFolderUploads(prev => prev.concat(newFolders));
                                setFileError('');
                                // quota check for folder uploads
                                try {
                                    const totalNew = (attachmentFiles.reduce((s,f)=>s + (Number(f.size||0)),0)) + folderUploads.reduce((s,ff)=>s + (Number(ff.totalSize||0)),0) + newFolders.reduce((s,ff)=>s + (Number(ff.totalSize||0)),0);
                                    const threshold = 10 * 1024 * 1024 * 1024 * 0.8;
                                    if (totalNew > threshold) setQuotaWarning('Cảnh báo: tổng dung lượng tệp tải lên vượt quá 80% của hạn mức 10GB.'); else setQuotaWarning('');
                                } catch (e) { setQuotaWarning(''); }
                                e.target.value = '';
                            }} className="mt-1 hidden" />
                            {fileError && <div className="mt-2 text-sm text-red-600">{fileError} <div className="text-xs text-red-500">Hỗ trợ: PDF ≤10MB, DOCX/XLSX ≤5MB, JPG/PNG ≤50MB</div></div>}
                            {quotaWarning && <div className="mt-2 text-sm text-yellow-600">{quotaWarning}</div>}
                        </div>
                        {attachmentFiles.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {attachmentFiles.map((f, idx) => (
                                    <div key={idx} className="text-sm text-slate-600 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span>{f.name}</span>
                                            <button type="button" onClick={()=>{
                                                setAttachmentFiles(prev => prev.filter((_,i)=>i!==idx));
                                            }} className="text-red-500 text-xs">Xóa</button>
                                        </div>
                                        <span className="text-xs text-slate-400">{(f.size/1024/1024).toFixed(2)} MB</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {folderUploads && folderUploads.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {folderUploads.map((folder, fi) => (
                                    <div key={fi} className="border rounded p-2 bg-gray-50">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <button type="button" onClick={()=>setExpandedFolders(prev=>({...prev, [folder.name]: !prev[folder.name]}))} className="text-sm font-medium text-slate-700">{expandedFolders[folder.name] ? '▾' : '▸'} {folder.name}</button>
                                                <span className="text-xs text-slate-500">{(folder.totalSize/1024/1024).toFixed(2)} MB</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button type="button" onClick={()=>{
                                                    // download all files in folder individually
                                                    for (const f of folder.files) {
                                                        try {
                                                            const url = URL.createObjectURL(f);
                                                            const a = document.createElement('a');
                                                            a.href = url;
                                                            a.download = f.name;
                                                            document.body.appendChild(a);
                                                            a.click();
                                                            a.remove();
                                                            URL.revokeObjectURL(url);
                                                        } catch (e) {}
                                                    }
                                                }} className="text-sm text-cyan-600">Tải</button>
                                                <button type="button" onClick={()=>setExpandedFolders(prev=>({...prev, [folder.name]: true}))} className="text-sm text-cyan-600">Mở thư mục</button>
                                                <button type="button" onClick={()=>{
                                                    // remove whole folder
                                                    setFolderUploads(prev=>prev.filter((_,i)=>i!==fi));
                                                }} className="text-red-500 text-xs">Xóa thư mục</button>
                                            </div>
                                        </div>
                                        {expandedFolders[folder.name] && (
                                            <div className="mt-2 space-y-1">
                                                {folder.files.map((f, idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-sm text-slate-600">
                                                        <div className="flex items-center gap-3">
                                                            <span className="truncate max-w-[60%]">{f.webkitRelativePath || f.name}</span>
                                                            <button type="button" onClick={()=>{
                                                                // remove file from folder
                                                                setFolderUploads(prev=>{
                                                                    const copy = JSON.parse(JSON.stringify(prev));
                                                                    const target = copy[fi];
                                                                    if (!target) return prev;
                                                                    target.files = target.files.filter((_,i)=>i!==idx);
                                                                    target.totalSize = target.files.reduce((s,ff)=>s+(Number(ff.size||0)),0);
                                                                    // if folder is empty, remove folder
                                                                    if (target.files.length === 0) copy.splice(fi,1);
                                                                    return copy;
                                                                });
                                                            }} className="text-red-500 text-xs">Xóa</button>
                                                        </div>
                                                        <span className="text-xs text-slate-400">{(f.size/1024/1024).toFixed(2)} MB</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {existingAttachments && existingAttachments.length > 0 && (
                            <div className="text-sm mt-2 space-y-1">
                                {existingAttachments.map((p, i) => {
                                    const name = p ? String(p).split('/').pop() : `file-${i}`;
                                    return (
                                        <div key={i} className="flex items-center justify-between">
                                            <button type="button" onClick={()=>setViewAttachment({ file_path: p, file_name: name })} className="text-cyan-600 text-left truncate max-w-[70%]">{name}</button>
                                            <button type="button" onClick={()=>setConfirmDelete({ open: true, path: p })} className="text-red-500 text-xs">Xóa</button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {confirmDelete.open && (
                            <ModalWrapper isOpen={true} onClose={()=>setConfirmDelete({open:false,path:null})} maxWidth="max-w-md">
                                <div className="p-6">
                                    <h3 className="text-lg font-semibold mb-4">Xác nhận xóa tệp</h3>
                                    <p className="text-sm text-slate-700 mb-4">Bạn có chắc muốn xóa tệp <strong className="break-all">{String(confirmDelete.path).split('/').pop()}</strong>?</p>
                                    <div className="flex justify-end gap-2">
                                        <button type="button" className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={()=>setConfirmDelete({open:false,path:null})}>Hủy</button>
                                        <button type="button" className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-sm font-medium text-white hover:bg-red-700" onClick={async ()=>{
                                            setLoading(true);
                                            try {
                                                await apiService.updateRoomBooking(booking.id, { deleted_files: [confirmDelete.path] });
                                                setExistingAttachments(prev => prev.filter(x=>x!==confirmDelete.path));
                                                const filename = String(confirmDelete.path).split('/').pop();
                                                if (onSuccess) onSuccess({ action: 'deleted_file', filename });
                                            } catch (err) {
                                                const msg = err && err.message ? err.message : (typeof err === 'string' ? err : JSON.stringify(err));
                                                setError(msg || 'Xóa tệp thất bại');
                                            } finally {
                                                setLoading(false);
                                                setConfirmDelete({open:false,path:null});
                                            }
                                        }}>Xóa</button>
                                    </div>
                                </div>
                            </ModalWrapper>
                        )}
                        {viewAttachment && (
                            <AttachmentViewerModal attachment={{ file_path: viewAttachment.file_path, file_name: viewAttachment.file_name }} onClose={()=>setViewAttachment(null)} />
                        )}
                    </div>
                    <div className="flex justify-end pt-4 border-t mt-6">
                        {booking && (
                            <button type="button" onClick={async () => {
                                const ok = window.confirm(`Bạn có chắc muốn xóa lịch "${booking.title || ''}" không?`);
                                if (!ok) return;
                                setLoading(true);
                                try {
                                    await apiService.deleteRoomBooking(booking.id);
                                    if (onSuccess) onSuccess({ action: 'deleted', id: booking.id });
                                    onClose();
                                } catch (err) {
                                    const msg = err && err.message ? err.message : (typeof err === 'string' ? err : JSON.stringify(err));
                                    setError(msg || 'Xóa thất bại');
                                } finally {
                                    setLoading(false);
                                }
                            }} className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-sm font-medium text-white hover:bg-red-700 mr-2">Xóa</button>
                        )}
                        <button type="button" onClick={onClose} className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 mr-2">Hủy</button>
                        <button type="submit" disabled={loading} className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                            {loading ? 'Đang gửi...' : 'Gửi yêu cầu'}
                        </button>
                    </div>
                </form>
            </div>
        </ModalWrapper>
    );
};

export default RoomBookingModal;