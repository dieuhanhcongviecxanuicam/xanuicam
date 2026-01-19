import React, { useState, useEffect, useCallback } from 'react';
import apiService from '../services/apiService';
import { Plus, Edit, Trash2, KeySquare } from 'lucide-react';
import Spinner from '../components/common/Spinner';
import RoleModal from '../components/roles/RoleModal';
import { Link } from 'react-router-dom';
import DeleteConfirmationModal from '../components/common/DeleteConfirmationModal';
import Notification from '../components/common/Notification';
import { useNavigate } from 'react-router-dom';

const RolesPage = () => {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null);
    const [notification, setNotification] = useState({ message: '', type: '' });

    const fetchRoles = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiService.getRoles();
            setRoles(response);
        } catch (error) {
            console.error("Lỗi khi tải danh sách vai trò:", error);
            setNotification({ message: 'Không thể tải danh sách vai trò.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRoles();
    }, [fetchRoles]);
    
    const navigate = useNavigate();

    const handleOpenCreateModal = () => {
        setSelectedRole(null);
        setIsModalOpen(true);
    };
    
    const handleOpenEditModal = (role) => {
        setSelectedRole(role);
        setIsModalOpen(true);
    };

    const handleOpenDeleteModal = (role) => {
        setSelectedRole(role);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!selectedRole) return;
        try {
            const response = await apiService.deleteRole(selectedRole.id);
            setNotification({ message: response.message || 'Xóa vai trò thành công!', type: 'success' });
            apiService.logEvent({ action: 'role.deleted', resource_type: 'role', resource_id: selectedRole.id }).catch(()=>{});
            setRoles(currentRoles => currentRoles.filter(role => role.id !== selectedRole.id));
        } catch (error) {
            const msg = typeof error === 'string' ? error : (error && (error.message || error.error)) || 'Xóa vai trò thất bại.';
            setNotification({ message: msg, type: 'error' });
        }
    };

    if (loading) return <Spinner fullPage />;

    return (
        <>
            <Notification 
                message={notification.message} 
                type={notification.type}
                onClose={() => setNotification({ message: '', type: '' })}
            />
            <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Quản lý Phân quyền</h1>
                        <p className="text-sm text-slate-500">Tạo, chỉnh sửa và gán quyền hạn cho các vai trò trong hệ thống.</p>
                    </div>
                                        <div className="flex items-center gap-3">
                                              <Link to="/roles/deleted" className="btn-secondary whitespace-nowrap">Vai trò đã xóa</Link>
                                            <button onClick={handleOpenCreateModal} className="btn-primary">
                                                    <Plus size={20} className="mr-2"/>
                                                    Tạo vai trò mới
                                            </button>
                                        </div>
                </div>

                <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                    <ul className="divide-y divide-slate-200">
                        {roles.map(role => (
                            <li key={role.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-slate-50">
                                <div className="flex items-center">
                                    <div className="p-2 rounded-full mr-4" style={{ backgroundColor: `${role.color}20` }}>
                                        <KeySquare size={20} style={{ color: role.color }} />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-800">{role.role_name}</p>
                                        <p className="text-sm text-slate-500">{role.description || 'Không có mô tả'}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleOpenEditModal(role)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-100 rounded-full">
                                        <Edit size={18} />
                                    </button>
                                    <button onClick={() => handleOpenDeleteModal(role)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-100 rounded-full">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                
                <RoleModal 
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => {
                        fetchRoles();
                        setNotification({ message: selectedRole ? 'Cập nhật vai trò thành công!' : 'Tạo vai trò mới thành công!', type: 'success' });
                    }}
                    roleId={selectedRole?.id}
                />
                
                {/* Route to deleted roles page */}
                {window.location.pathname === '/roles/deleted' ? null : null}
                
                <DeleteConfirmationModal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onConfirm={handleDelete}
                    title="Xác nhận xóa vai trò"
                    message={`Bạn có chắc chắn muốn xóa vai trò "${selectedRole?.role_name}"?`}
                />
            </div>
        </>
    );
};

export default RolesPage;