import React, { useState, useEffect } from 'react';
import apiService from '../../services/apiService';
import Spinner from '../common/Spinner';
import ModalWrapper from '../common/ModalWrapper';

const RoleModal = ({ isOpen, onClose, onSuccess, roleId }) => {
    const [formData, setFormData] = useState({
        role_name: '',
        description: '',
        color: '#64748b',
        level: 3,
        permissions: []
    });
    const [allPermissions, setAllPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [, setTotalRoles] = useState(null);
    const [disableSave, setDisableSave] = useState(false);

    const isEditMode = roleId != null;

    useEffect(() => {
        if (isOpen) {
            const fetchInitialData = async () => {
                setLoading(true);
                setError('');
                try {
                    const permissionsRes = await apiService.getAllPermissions();
                    setAllPermissions(permissionsRes);

                    if (isEditMode) {
                        const roleRes = await apiService.getRoleById(roleId);
                        setFormData({
                            role_name: roleRes.role_name,
                            description: roleRes.description || '',
                            color: roleRes.color || '#64748b',
                            level: roleRes.level,
                            permissions: roleRes.permissions || []
                        });
                    } else {
                        setFormData({ role_name: '', description: '', color: '#64748b', level: 3, permissions: [] });
                    }

                    // fetch counts to decide whether Save should be disabled
                    try {
                        const [active, deleted] = await Promise.all([
                            apiService.getRoles(),
                            apiService.getDeletedRoles({ limit: 1000 })
                        ]);
                        const aCount = Array.isArray(active) ? active.length : 0;
                        const dCount = Array.isArray(deleted) ? deleted.length : 0;
                        const total = aCount + dCount;
                        setTotalRoles(total);
                        setDisableSave(!isEditMode && total >= 100);
                    } catch (e) {
                        // if counting fails, rely on server-side enforcement and allow submission
                        setTotalRoles(null);
                        setDisableSave(false);
                    }
                } catch (err) {
                    setError('Không thể tải dữ liệu cần thiết.');
                } finally {
                    setLoading(false);
                }
            };
            fetchInitialData();
        }
    }, [isOpen, roleId, isEditMode]);

    const handlePermissionChange = (permissionId) => {
        setFormData(prev => {
            const newPermissions = prev.permissions.includes(permissionId)
                ? prev.permissions.filter(id => id !== permissionId)
                : [...prev.permissions, permissionId];
            return { ...prev, permissions: newPermissions };
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (isEditMode) {
                await apiService.updateRole(roleId, formData);
                apiService.logEvent({ action: 'role.updated', resource_type: 'role', resource_id: roleId }).catch(()=>{});
            } else {
                // Client-side check: ensure total roles (active + deleted) < 100 before attempting create
                try {
                    const [active, deleted] = await Promise.all([
                        apiService.getRoles(),
                        apiService.getDeletedRoles({ limit: 1000 })
                    ]);
                    const total = (Array.isArray(active) ? active.length : 0) + (Array.isArray(deleted) ? deleted.length : 0);
                    if (total >= 100) {
                        setError('Không thể tạo vai trò mới: giới hạn tổng số vai trò (100) đã đạt.');
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    // If we cannot determine counts, allow server to enforce but warn
                    console.warn('Could not validate role counts client-side, proceeding to server check.', e);
                }

                await apiService.createRole(formData);
                apiService.logEvent({ action: 'role.created', resource_type: 'role', resource_id: null }).catch(()=>{});
            }
            onSuccess();
            onClose();
        } catch (err) {
            const msg = typeof err === 'string' ? err : (err && (err.message || err.error)) || 'Đã có lỗi xảy ra.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-3xl" className="p-6 max-h-[90vh] flex flex-col">
                <h2 className="text-xl font-bold mb-6">{isEditMode ? 'Chỉnh sửa Vai trò' : 'Tạo Vai trò Mới'}</h2>
                
                {loading && <Spinner />}

                {!loading && (
                    <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto pr-2">
                        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
                        
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 items-end">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">Tên Vai trò</label>
                                        <input name="role_name" value={formData.role_name} onChange={handleChange} required className="mt-1 input-style" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">Màu sắc</label>
                                        <input name="color" type="color" value={formData.color} onChange={handleChange} className="mt-1 h-10 p-1 border border-slate-300 rounded-md w-20 no-native-arrows" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">Cấp bậc (Level)</label>
                                        <input name="level" type="number" min="1" max="4" value={formData.level} onChange={handleChange} required className="mt-1 input-style no-native-arrows" />
                                    </div>
                                </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Mô tả</label>
                            <textarea name="description" value={formData.description} onChange={handleChange} rows="2" className="mt-1 input-style" />
                        </div>
                        
                        <div className="mt-6">
                            <h3 className="text-md font-semibold text-slate-800 mb-2">Quyền hạn</h3>
                            <div className="flex items-center mb-3">
                                <input type="checkbox" id="perm-all" className="h-4 w-4 text-blue-600 border-gray-300 rounded" onChange={(e)=>{
                                    const checked = e.target.checked;
                                    if(checked) setFormData(prev=>({...prev, permissions: allPermissions.map(p=>p.id)}));
                                    else setFormData(prev=>({...prev, permissions: []}));
                                }} checked={allPermissions.length>0 && formData.permissions.length===allPermissions.length} />
                                <label htmlFor="perm-all" className="ml-3 text-sm text-slate-600">Tất cả</label>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 border p-4 rounded-lg">
                                {allPermissions.map(p => {
                                    // Normalize some permission descriptions for the UI
                                    let label = p.description || p.permission_name || '';
                                    if (/allow managing users/i.test(label) || /manage users/i.test(p.permission_name)) {
                                        label = 'Cho phép quản lý tài khoản';
                                    }
                                    if (/export/i.test(label) && /tasks/i.test(label)) {
                                        label = 'Cho phép xuất các công việc (Excel/PDF/CSV)';
                                    }
                                    return (
                                    <div key={p.id} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id={`perm-${p.id}`}
                                            checked={formData.permissions.includes(p.id)}
                                            onChange={() => handlePermissionChange(p.id)}
                                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <label htmlFor={`perm-${p.id}`} className="ml-3 text-sm text-slate-600">{label}</label>
                                    </div>
                                )})}
                            </div>
                        </div>
                    </form>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
                    <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
                                        <div className="flex flex-col items-end">
                                            {disableSave && (
                                                <p className="text-sm text-red-500 mb-2">Không thể tạo vai trò mới: giới hạn tổng số vai trò (100) đã đạt.</p>
                                            )}
                                            <button type="submit" onClick={handleSubmit} disabled={loading || disableSave} className="btn-primary">
                                                {loading ? 'Đang lưu...' : 'Lưu'}
                                            </button>
                                        </div>
                </div>
            </ModalWrapper>
    );
};

export default RoleModal;