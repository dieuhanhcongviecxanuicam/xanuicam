import React, { useState, useEffect } from 'react';
import apiService from '../../services/apiService';
import ModalWrapper from '../common/ModalWrapper';

const CreateUserModal = ({ isOpen, onClose, onUserCreated }) => {
    const initialState = { cccd: '', ma_cong_chuc: '', password: '', fullName: '', username: '', email: '', phone_number: '', birth_date: '', role_id: '', department_id: '', note: '', is_leader: false };
    const [formData, setFormData] = useState(initialState);
    const [roles, setRoles] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const fetchData = async () => {
                try {
                    const [rolesRes, deptsRes] = await Promise.all([
                        apiService.getRoles(),
                        apiService.getDepartments({ limit: 1000 })
                    ]);
                    setRoles(rolesRes || []);
                    setDepartments(deptsRes.data || []);
                    const defaultRole = (rolesRes || []).find(r => r.role_name === 'Chuyên viên');
                    if (defaultRole) {
                        setFormData(prev => ({ ...prev, role_id: defaultRole.id }));
                    } else if (rolesRes && rolesRes.length > 0) {
                        setFormData(prev => ({ ...prev, role_id: rolesRes[0].id }));
                    }
                } catch (err) { setError("Không thể tải dữ liệu cần thiết."); }
            };
            fetchData();
        }
    }, [isOpen]);
    
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        // support checkbox for is_leader
        if (type === 'checkbox') {
            const isChecked = !!checked;
            setFormData(prev => ({ ...prev, [name]: isChecked }));
            return;
        }
        setFormData(prev => ({...prev, [name]: value}));
    }

    const validateOptionalFields = () => {
        // CCCD: either empty or exactly 12 digits starting with 0
        const cccd = formData.cccd?.trim();
        if (cccd && !/^0\d{11}$/.test(cccd)) return 'Số CCCD phải có đúng 12 chữ số và bắt đầu bằng 0.';
        // Mã Công chức: optional, max 13 chars
        const macc = formData.ma_cong_chuc?.trim();
        if (macc && macc.length > 13) return 'Mã Công chức không được vượt quá 13 ký tự.';
        // Phone: either empty or exactly 10 digits starting with 0
        const phone = formData.phone_number?.trim();
        if (phone && !/^0\d{9}$/.test(phone)) return 'Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng 0.';
        // Email: either empty or must contain @
        const email = formData.email?.trim();
        if (email && email.indexOf('@') === -1) return 'Email không hợp lệ.';
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Required fields
        if (!formData.fullName || !String(formData.fullName).trim()) return setError('Họ và Tên là bắt buộc.');
        if (!formData.username || !String(formData.username).trim()) return setError('Tên đăng nhập là bắt buộc.');
        if (!formData.password || String(formData.password).length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự.');

        const optErr = validateOptionalFields();
        if (optErr) return setError(optErr);

        setLoading(true);
        const toSend = { ...formData };

        const payload = new FormData();
        // Append only non-empty values to avoid sending empty strings that may violate unique constraints server-side
        Object.keys(toSend).forEach(key => {
            const val = toSend[key];
            if (val === undefined || val === null) return;
            const str = String(val).trim();
            // For optional fields, skip empty strings
            if (str === '') return;
            payload.append(key, val);
        });

        try {
            const created = await apiService.createUser(payload);
            // Some backends may auto-assign the newly created user as the
            // department manager when department_id is provided. If the new
            // user was not marked as a leader, clear any accidental assignment.
                try {
                    const deptId = formData.department_id;
                    // determine new user id safely to avoid mixed-operator lint errors
                    let newUserId = null;
                    if (created) {
                        if (created.id) newUserId = created.id;
                        else if (created.user_id) newUserId = created.user_id;
                        else if (created.data && created.data.id) newUserId = created.data.id;
                    }
                    if (deptId && newUserId && !formData.is_leader) {
                    try {
                        const dept = await apiService.getDepartmentById(deptId);
                        if (dept && (String(dept.manager_id) === String(newUserId))) {
                            const f = new FormData();
                            f.append('manager_id', '');
                            await apiService.updateDepartment(dept.id, f);
                        }
                    } catch (e) {
                        console.debug('CreateUserModal: failed to sanitize department manager after create', e);
                    }
                }
            } catch (e) {}

            // Wait for parent to refresh list; parent `onUserCreated` returns a promise
            if (onUserCreated && typeof onUserCreated === 'function') {
                try { await onUserCreated(); } catch (e) { /* continue even if refresh failed */ }
            }
            handleClose();
        } catch (err) {
            setError(err || 'Đã xảy ra lỗi. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setFormData(initialState);
        setError('');
        setLoading(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <ModalWrapper isOpen={isOpen} onClose={handleClose} maxWidth="max-w-2xl">
            <div className="p-6 w-full max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-6">Thêm người dùng mới</h2>
                {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Họ và Tên <span className="text-red-500">*</span></label>
                            <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required className="mt-1 input-style no-native-arrows" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700">Tên đăng nhập <span className="text-red-500">*</span></label>
                            <input type="text" name="username" value={formData.username} onChange={handleChange} required className="mt-1 input-style no-native-arrows" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Mã Công chức (tùy chọn)</label>
                            <input type="text" name="ma_cong_chuc" value={formData.ma_cong_chuc} onChange={handleChange} maxLength="13" className="mt-1 input-style no-native-arrows" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Mật khẩu (tối thiểu 6 ký tự) <span className="text-red-500">*</span></label>
                            <input type="password" name="password" value={formData.password} onChange={handleChange} required className="mt-1 input-style no-native-arrows" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Số CCCD (tùy chọn)</label>
                            <input type="text" name="cccd" value={formData.cccd} onChange={handleChange} maxLength="12" className="mt-1 input-style no-native-arrows" />
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
                                {Array.isArray(departments) && departments.map(dep => <option key={dep.id} value={String(dep.id)}>{dep.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center text-sm">
                            <input type="checkbox" name="is_leader" checked={formData.is_leader} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            <span className="ml-2">Lãnh đạo</span>
                        </label>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Ghi chú (tùy chọn)</label>
                        <textarea name="note" value={formData.note} onChange={handleChange} rows="2" className="mt-1 input-style no-native-arrows" />
                    </div>
                    <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
                        <button type="button" onClick={handleClose} className="btn-secondary">Hủy</button>
                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? 'Đang lưu...' : 'Thêm người dùng'}
                        </button>
                    </div>
                </form>
            </div>
        </ModalWrapper>
    );
};

export default CreateUserModal;