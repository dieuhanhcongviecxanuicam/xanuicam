import React, { useState, useEffect, useCallback } from 'react';
import apiService from '../../services/apiService';
import useAuth from '../../hooks/useAuth';
import ModalWrapper from '../common/ModalWrapper';
// useAuth removed here because not used in this component
import Spinner from '../common/Spinner';
// AuthContext import removed because not used

const EditUserModal = ({ isOpen, onClose, onUserUpdated, userId }) => {
    const [formData, setFormData] = useState(null);
    const [roles, setRoles] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const usernameRef = React.useRef(null);
    const { hasPermission } = useAuth();
    const canManageUsers = hasPermission(['user_management']);

    const fetchData = useCallback(async () => {
        if (isOpen && userId) {
            setLoading(true);
            setError('');
            try {
                const [userRes, rolesRes, departmentsRes] = await Promise.all([
                    apiService.getUserById(userId),
                    apiService.getRoles(),
                    apiService.getDepartments({ limit: 1000 })
                ]);
                
                const user = userRes;
                // prefer persisted `is_leader` flag when available, otherwise fall back to role heuristic
                const leaderRole = (rolesRes || []).find(r => r.role_name === 'Lãnh đạo');
                const isLeader = (user && (user.is_leader === true || user.is_leader === '1' || user.is_leader === 'true')) ? true : (leaderRole ? (user.role_id === leaderRole.id) : (user.role_name === 'Lãnh đạo'));
                setFormData({
                    cccd: user.cccd || '',
                    ma_cong_chuc: user.ma_cong_chuc || '',
                    fullName: user.full_name || '',
                    username: user.username || '',
                    email: user.email || '',
                    phone_number: user.phone_number || '',
                    birth_date: user.birth_date ? new Date(user.birth_date).toISOString().split('T')[0] : '',
                    role_id: user.role_id || '',
                    department_id: user.department_id || '',
                    note: user.note || '',
                    is_active: user.is_active,
                    password: '',
                    is_leader: !!isLeader
                });
                setRoles(rolesRes || []);
                setDepartments(departmentsRes.data || []);
            } catch (err) {
                setError("Không thể tải dữ liệu người dùng. " + err);
            } finally {
                setLoading(false);
            }
        }
    }, [isOpen, userId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'username') {
            // optimistic clear username-specific errors
            setError('');
        }
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    // previously used to check permissions; not required in this modal

    const validateOptional = () => {
        const cccd = formData.cccd?.trim();
        if (cccd && !/^0\d{11}$/.test(cccd)) return 'Số CCCD phải có đúng 12 chữ số và bắt đầu bằng 0.';
        const macc = formData.ma_cong_chuc?.trim();
        if (macc && macc.length > 13) return 'Mã Công chức không được vượt quá 13 ký tự.';
        const phone = formData.phone_number?.trim();
        if (phone && !/^0\d{9}$/.test(phone)) return 'Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng 0.';
        const email = formData.email?.trim();
        if (email && email.indexOf('@') === -1) return 'Email không hợp lệ.';
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        // required fields
        if (!formData.fullName || !String(formData.fullName).trim()) return setError('Họ và Tên là bắt buộc.');
        if (!formData.username || !String(formData.username).trim()) return setError('Tên đăng nhập là bắt buộc.');

        const optErr = validateOptional();
        if (optErr) return setError(optErr);

        // Server enforces per-target edit limit (2 edits/day). Do not enforce a separate client-side counter.

        setLoading(true);
        try {
            // Pre-check username uniqueness to provide immediate feedback
            if (formData.username && String(formData.username).trim()) {
                const chk = await apiService.checkUsernameUnique(formData.username, userId);
                if (chk && chk.unique === false) {
                    setError(chk.message || 'Tên đăng nhập đã được sử dụng.');
                    // focus username
                    try { usernameRef.current && usernameRef.current.focus(); } catch (e) {}
                    setLoading(false);
                    return;
                }
            }
            const toSend = { ...formData };

            const payload = new FormData();
            // Include all fields explicitly so privileged users can clear fields by submitting empty values.
            Object.keys(toSend).forEach(key => {
                const val = toSend[key];
                // allow empty string to be sent (to clear a field). Only skip undefined values.
                if (val === undefined) return;
                payload.append(key, val === null ? '' : val);
            });

            // Log payload entries for debugging (convert FormData to plain object for readability)
            try {
                const entries = {};
                for (const pair of payload.entries()) {
                    const [k, v] = pair;
                    // avoid logging large binary blobs
                    if (v instanceof File) entries[k] = `<File ${v.name} size=${v.size}>`;
                    else entries[k] = v;
                }
                console.debug('EditUserModal: submitting payload for userId=', userId, entries);
            } catch (e) {
                console.debug('EditUserModal: failed to serialize payload for logging', e);
            }

            const resp = await apiService.updateUser(userId, payload);
            console.debug('EditUserModal: updateUser response', resp);

            onUserUpdated();
            onClose();

        } catch (err) {
            // Prefer server-provided human message when available.
            try {
                if (!err) {
                    setError('Cập nhật thất bại.');
                } else if (typeof err === 'string') {
                    setError(err);
                } else if (err.message && (!err.last_profile_update && !err.next_allowed_date)) {
                    // If the server already returned a fully formatted message for non-profile cases, use it directly.
                    setError(err.message);
                } else if (err.last_profile_update && err.next_allowed_date) {
                    // Self-edit block: show profile-style message with last and next allowed dates
                    try {
                        const lastDt = new Date(err.last_profile_update);
                        const nextDt = new Date(err.next_allowed_date);
                        const ldd = String(lastDt.getDate()).padStart(2, '0');
                        const lmm = String(lastDt.getMonth() + 1).padStart(2, '0');
                        const lyyyy = lastDt.getFullYear();
                        const ndd = String(nextDt.getDate()).padStart(2, '0');
                        const nmm = String(nextDt.getMonth() + 1).padStart(2, '0');
                        const nyyyy = nextDt.getFullYear();
                        setError(`Bạn đã chỉnh sửa thông tin vào ngày ${ldd}/${lmm}/${lyyyy}, bạn có thể chỉnh sửa lần kế tiếp vào ngày ${ndd}/${nmm}/${nyyyy}!`);
                    } catch (e) {
                        setError('Bạn tạm thời không thể cập nhật.');
                    }
                } else if (err.next_allowed_date) {
                    // Admin editing other user: show VN 07:00 formatted message if provided
                    try {
                        const ndt = new Date(err.next_allowed_date);
                        const dd = String(ndt.getDate()).padStart(2, '0');
                        const mm = String(ndt.getMonth() + 1).padStart(2, '0');
                        const yyyy = ndt.getFullYear();
                        setError(`Vượt quá số lần chỉnh sửa, bạn có thể chỉnh sửa thông tin sau 07 giờ 00 ngày ${dd}/${mm}/${yyyy}`);
                    } catch (e) {
                        setError('Bạn tạm thời không thể cập nhật.');
                    }
                } else if (err.retry_after_seconds || err.retry_after_seconds === 0) {
                    // Fallback: format remaining seconds into days/hours/minutes if server did not provide message.
                    const secs = Number(err.retry_after_seconds || 0);
                    if (!Number.isNaN(secs) && secs > 0) {
                        const days = Math.floor(secs / 86400);
                        const hours = Math.floor((secs % 86400) / 3600);
                        const minutes = Math.floor((secs % 3600) / 60);
                        const parts = [];
                        if (days) parts.push(`${days} ngày`);
                        if (hours) parts.push(`${hours} giờ`);
                        if (minutes) parts.push(`${minutes} phút`);
                        setError(`Vượt quá số lần chỉnh sửa thông tin, bạn có thể chỉnh sửa thông tin sau ${parts.join(' ')}`);
                    } else {
                        setError('Bạn tạm thời không thể cập nhật.');
                    }
                } else {
                    setError(JSON.stringify(err));
                }
            } catch (e) {
                setError('Cập nhật thất bại.');
            }

            // If backend indicates username duplicate, focus username input
            try {
                if (err && typeof err === 'object' && ((err.message && err.message.toLowerCase().includes('tên đăng nhập')) || (typeof err === 'string' && err.toLowerCase().includes('tên đăng nhập')))) {
                    usernameRef.current && usernameRef.current.focus();
                }
            } catch (e) {}
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl">
            <div className="p-6 w-full max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-6">Chỉnh sửa người dùng</h2>
                {loading && !formData ? <Spinner /> : (
                    <>
                        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Họ và Tên</label>
                                    <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required className="mt-1 input-style no-native-arrows" />
                                </div>
                                 <div>
                                    <label className="block text-sm font-medium text-slate-700">Tên đăng nhập</label>
                                    <input ref={usernameRef} type="text" name="username" value={formData.username} onChange={handleChange} required className="mt-1 input-style no-native-arrows" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Mã Công chức</label>
                                    <input type="text" name="ma_cong_chuc" value={formData.ma_cong_chuc} onChange={handleChange} maxLength="13" className="mt-1 input-style no-native-arrows" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Mật khẩu mới (để trống nếu không đổi)</label>
                                    <input type="password" name="password" value={formData.password} onChange={handleChange} className="mt-1 input-style no-native-arrows" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Số CCCD</label>
                                    <input type="text" name="cccd" value={formData.cccd} onChange={handleChange} className="mt-1 input-style no-native-arrows" />
                                </div>                                
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Ngày sinh</label>
                                    <input type="date" name="birth_date" value={formData.birth_date} onChange={handleChange} className="mt-1 input-style no-native-arrows" />
                                </div>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div>
                                    <label className="block text-sm font-medium text-slate-700">Email</label>
                                    <input type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 input-style no-native-arrows" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Số điện thoại</label>
                                    <input type="tel" name="phone_number" value={formData.phone_number} onChange={handleChange} className="mt-1 input-style no-native-arrows" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Vai trò</label>
                                    <select name="role_id" value={formData.role_id} onChange={handleChange} className="mt-1 input-style no-native-arrows">
                                        {Array.isArray(roles) && roles.map(role => <option key={role.id} value={role.id}>{role.role_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Phòng ban/Đơn vị</label>
                                    <select name="department_id" value={formData.department_id} onChange={handleChange} className="mt-1 input-style no-native-arrows">
                                        <option value="">Không thuộc phòng ban</option>
                                        {Array.isArray(departments) && departments.map(dep => <option key={dep.id} value={dep.id}>{dep.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Ghi chú</label>
                                <textarea name="note" value={formData.note} onChange={handleChange} rows="2" className="mt-1 input-style no-native-arrows" />
                            </div>
                            <div className="flex items-center gap-6">
                                <label className="flex items-center">
                                    <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} id="is_active_checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                                    <span className="ml-2 block text-sm text-gray-900">Tài khoản đang hoạt động</span>
                                </label>
                                <label className="flex items-center">
                                    <input type="checkbox" name="is_leader" checked={formData.is_leader} onChange={handleChange} id="is_leader_checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                                    <span className="ml-2 block text-sm text-gray-900">Lãnh đạo</span>
                                </label>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
                                {canManageUsers && (
                                    <button type="button" onClick={async () => {
                                        // Reset avatar to default
                                        try {
                                            setLoading(true);
                                            await apiService.updateUser(userId, { reset_avatar: true });
                                            // Refetch data and inform parent
                                            await fetchData();
                                            try { onUserUpdated && onUserUpdated(); } catch (e) {}
                                        } catch (e) {
                                            setError('Không thể reset avatar.');
                                        } finally {
                                            setLoading(false);
                                        }
                                    }} className="btn-secondary">Reset avatar</button>
                                )}
                                <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
                                <button type="submit" disabled={loading} className="btn-primary">
                                    {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </ModalWrapper>
    );
};

export default EditUserModal;