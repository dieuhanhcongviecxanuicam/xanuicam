// ubndxanuicam/frontend/src/pages/UsersPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreVertical, Edit, Trash2, UserCheck, UserX, XCircle } from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import useAuth from '../hooks/useAuth';
import apiService from '../services/apiService';
import PasswordExportModal from '../components/users/PasswordExportModal';
import CreateUserModal from '../components/users/CreateUserModal';
import EditUserModal from '../components/users/EditUserModal';
import DeleteUserModal from '../components/users/DeleteUserModal';
import MfaConfirmModal from '../components/common/MfaConfirmModal'
import Spinner from '../components/common/Spinner';
import Notification from '../components/common/Notification';
import Pagination from '../components/common/Pagination';
import QuickUserSummary from '../components/users/QuickUserSummary';
import UserTasksModal from '../components/users/UserTasksModal';
// pagination uses in-file controls similar to ComputerConfigsPage
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import defaultAvatar from '../assets/images/default-avatar.png';

const RoleBadge = ({ name, color = '#64748b' }) => (
    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full" style={{ backgroundColor: `${color}20`, color: color }}>
        {name}
    </span>
);

const UsersPage = () => {
    const [users, setUsers] = useState([]);
    const [allUsersForModal, setAllUsersForModal] = useState([]);
    const [accountSummary, setAccountSummary] = useState({ total: 0, locked: 0, no_department: 0 });
    const [departments, setDepartments] = useState([]);
        const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    
        const [filters, setFilters] = useState({ search: '', departmentId: '', created_from: '', mfa_enabled: '', locked: '', no_department: false });
        const [pageSize, setPageSize] = useState(() => {
            try { return parseInt(localStorage.getItem('users_page_size') || '10', 10); } catch (e) { return 10; }
        });
    const [modals, setModals] = useState({ create: false, edit: false, delete: false, tasks: false });
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const [notification, setNotification] = useState({ message: '', type: '' });
    const { hasPermission } = useAuth();
    const canManageUsers = hasPermission(['user_management']);
    const BACKEND_URL = process.env.REACT_APP_API_BASE_URL.replace('/api', '');
    const navigate = useNavigate();

    // account summary will be provided by API per current filters

    const fetchData = useCallback(async (page, currentFilters = {}) => {
        setLoading(true);
        try {
                // allow callers to override limit by passing { limit: X } in currentFilters
                const params = { page, limit: (currentFilters && currentFilters.limit) ? currentFilters.limit : pageSize, ...currentFilters };
                // strip accidental limit duplication from params spread
                if (params.limit === undefined) params.limit = pageSize;
                const usersRes = await apiService.getUsers(params);
                setUsers(usersRes.data);
                setPagination(usersRes.pagination);
                if (usersRes.meta) setAccountSummary(usersRes.meta);
        } catch (error) {
            setNotification({ message: 'Không thể tải dữ liệu người dùng.', type: 'error'});
        } finally {
            setLoading(false);
        }
    }, [pageSize]);
    
    useEffect(() => {
        const fetchInitialOptions = async () => {
            try {
                const [deptsRes, allUsersRes] = await Promise.all([
                    apiService.getDepartments({ limit: 1000 }),
                    apiService.getUsers({ limit: 1000 })
                ]);
                setDepartments(deptsRes.data || []);
                setAllUsersForModal(allUsersRes.data || []);
            } catch (error) {
                console.log("Không thể tải các tùy chọn cho bộ lọc.");
            }
        };
        fetchInitialOptions();
    }, []);

    useEffect(() => {
        const handler = setTimeout(() => {
            fetchData(pagination.currentPage, filters);
        }, 300);
        return () => clearTimeout(handler);
    }, [pagination.currentPage, filters, fetchData]);

    useEffect(() => {
        try { localStorage.setItem('users_page_size', String(pageSize)); } catch (e) {}
    }, [pageSize]);

    const handleFilterChange = (e) => {
        // support both real events and synthetic objects like { target: { name, value } }
        const target = e && e.target ? e.target : (e && e.target === undefined ? e : null);
        if (!target) return;
        const { name } = target;
        let value;
        if (target.type === 'checkbox') value = !!target.checked;
        else value = target.value;

        // Integrate "Không có phòng ban" into the 'locked' (account status) select.
        if (name === 'locked') {
            if (value === 'no_department') {
                setFilters(prev => ({ ...prev, locked: '', no_department: true }));
            } else {
                // when choosing a normal locked value, clear no_department
                setFilters(prev => ({ ...prev, locked: value === '' ? '' : value, no_department: false }));
            }
        } else {
            setFilters(prev => ({ ...prev, [name]: value }));
        }
        setPagination(p => ({ ...p, currentPage: 1 }));
    };
    
    const handleSuccess = useCallback(async () => {
        // After creating/updating users, ensure we show the latest data starting from page 1
        setPagination(p => ({ ...p, currentPage: 1 }));

        // Retry/backoff strategy to reduce race conditions where the newly created user
        // isn't immediately visible due to caching or eventual consistency.
        const maxAttempts = 4;
        let attempt = 0;
        let delay = 500;
        while (attempt < maxAttempts) {
            try {
                await fetchData(1, { ...filters, _reload: Date.now() });
                // After successful fetch, break — UI updated
                break;
            } catch (e) {
                    // wait and retry
                    const wait = (ms) => new Promise(res => setTimeout(res, ms));
                    await wait(delay);
                    attempt += 1;
                    delay *= 2;
                }
        }
    }, [fetchData, filters]);

    const handleToggleStatus = async (user) => {
        // Open MFA confirmation modal before toggling status
        setMfaTarget({ action: 'toggle', user });
    };

    const handleUnlockUser = async (user) => {
        try {
            await apiService.unlockUser(user.id);
            setNotification({ message: 'Tài khoản đã được mở khóa và số lần thử sai đã được đặt lại.', type: 'success' });
            handleSuccess();
        } catch (error) {
            setNotification({ message: error || 'Mở khóa thất bại.', type: 'error' });
        }
    };

    const openModal = (modalName, data = null) => {
        if (modalName === 'tasks' || modalName === 'edit' || modalName === 'delete') {
            setSelectedUser(data);
        }
        if (modalName === 'taskDetail') {
            setSelectedTask(data);
        }
        setModals(prev => ({ ...prev, [modalName]: true }));
    };

    const closeModal = (modalName) => {
        setSelectedUser(null);
        setSelectedTask(null);
        setModals(prev => ({ ...prev, [modalName]: false }));
    };
    
    const handleUserDeleted = () => {
        setNotification({ message: 'Xóa người dùng thành công!', type: 'success' });
        if (users.length === 1 && pagination.currentPage > 1) {
            setPagination(p => ({ ...p, currentPage: p.currentPage - 1 }));
        } else {
            handleSuccess();
        }
    };

    const [exportModal, setExportModal] = useState({ open: false, format: 'xlsx' });
    const [exportQuota, setExportQuota] = useState(null);
    const [mfaTarget, setMfaTarget] = useState(null);

    // hover summary caches & state
    const [hoverCache, setHoverCache] = useState({ users: {}, tasks: {}, departments: {} });
    const [hoverState, setHoverState] = useState({ visible: false, type: null, data: null, x: 0, y: 0 });

    // showHover accepts an optional mouse event to position the popover at cursor
    const showHover = async (type, user, e) => {
        if (!user) return;
        try {
            if (type === 'user') {
                if (hoverCache.users[user.id]) {
                    setHoverState({ visible: true, type: 'user', data: hoverCache.users[user.id], x: e ? e.clientX : 0, y: e ? e.clientY : 0 });
                    return;
                }
                const detail = await apiService.getUserById(user.id);
                setHoverCache(h => ({ ...h, users: { ...h.users, [user.id]: detail } }));
                setHoverState({ visible: true, type: 'user', data: detail, x: e ? e.clientX : 0, y: e ? e.clientY : 0 });
            } else if (type === 'tasks') {
                if (hoverCache.tasks[user.id]) {
                    setHoverState({ visible: true, type: 'tasks', data: hoverCache.tasks[user.id], x: e ? e.clientX : 0, y: e ? e.clientY : 0 });
                    return;
                }
                const tasks = await apiService.getUserTasks(user.id);
                const payload = { userName: user.full_name, count: (Array.isArray(tasks) ? tasks.length : (tasks.meta && tasks.meta.total) || 0), items: Array.isArray(tasks) ? tasks : (tasks.data || []) };
                setHoverCache(h => ({ ...h, tasks: { ...h.tasks, [user.id]: payload } }));
                setHoverState({ visible: true, type: 'tasks', data: payload, x: e ? e.clientX : 0, y: e ? e.clientY : 0 });
            } else if (type === 'department') {
                if (!user.department_id && !user.departmentId) {
                    setHoverState({ visible: true, type: 'department', data: { name: user.department_name || 'Chưa có' }, x: e ? e.clientX : 0, y: e ? e.clientY : 0 });
                    return;
                }
                const depId = user.department_id || user.departmentId || user.department_id;
                if (hoverCache.departments[depId]) {
                    setHoverState({ visible: true, type: 'department', data: hoverCache.departments[depId], x: e ? e.clientX : 0, y: e ? e.clientY : 0 });
                    return;
                }
                try {
                    const dept = await apiService.getDepartmentById(depId);
                    setHoverCache(h => ({ ...h, departments: { ...h.departments, [depId]: dept } }));
                    setHoverState({ visible: true, type: 'department', data: dept, x: e ? e.clientX : 0, y: e ? e.clientY : 0 });
                } catch (e) {
                    setHoverState({ visible: true, type: 'department', data: { name: user.department_name || 'Chưa có' }, x: e ? e.clientX : 0, y: e ? e.clientY : 0 });
                }
            }
        } catch (e) {
            // ignore errors for hover
        }
    };

    const hideHover = () => setHoverState({ visible: false, type: null, data: null, x: 0, y: 0 });

    const fetchExportQuota = async () => {
        try {
            const q = await apiService.getExportQuota();
            setExportQuota(q);
        } catch (e) {
            // ignore; quota is optional
        }
    };

    useEffect(() => {
        fetchExportQuota();
    }, []);

    const handleTaskSelect = (task) => {
        closeModal('tasks');
        openModal('taskDetail', task);
    };
    
    const openExportModal = async (format) => {
        setExportModal({ open: true, format });
        await fetchExportQuota();
    };

    const handleExportConfirm = async (mfaCode) => {
        setLoading(true);
        try {
            const body = { format: exportModal.format, filters, mfaToken: mfaCode };
            // Use raw export so we can read headers and blob
            const res = await apiService.exportUsersRaw(body);
            const blob = res && res.data ? res.data : res;
            let filename = `xanuicam_users_export.${exportModal.format === 'xlsx' ? 'xlsx' : exportModal.format === 'pdf' ? 'pdf' : 'csv'}`;
            try {
                const headers = res && res.headers;
                const cd = headers && (typeof headers.get === 'function' ? headers.get('content-disposition') : headers['content-disposition']);
                if (cd) {
                    const m1 = /filename\*=UTF-8''([^;\n]+)/.exec(cd) || /filename="?([^";]+)"?/.exec(cd);
                    if (m1 && m1[1]) filename = decodeURIComponent(m1[1]);
                }
            } catch (e) {}
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            setNotification({ message: 'Đã xuất báo cáo.', type: 'success' });
            setExportModal({ open: false, format: 'xlsx' });
            await fetchExportQuota();
        } catch (err) {
            // err may be thrown as parsed error object from apiService.handleError
            const message = (err && (err.message || err.error)) ? (err.message || err.error) : 'Lỗi khi xuất báo cáo.';
            setNotification({ message, type: 'error' });
            // if rate limited, refresh quota
            if (err && err.retry_after_seconds) {
                await fetchExportQuota();
            }
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div>
            <Notification 
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ message: '', type: '' })}
            />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Quản lý tài khoản</h1>
                    <p className="text-sm text-slate-500">Tạo, chỉnh sửa và phân quyền cho các tài khoản.</p>
                </div>
                {canManageUsers && (
                    <div className="flex gap-2">
                        <button onClick={() => openModal('create')} className="btn-primary">
                            <Plus size={20} className="mr-2"/>
                            <span className="hidden sm:inline">Tạo Tài khoản</span>
                            <span className="sm:hidden">Tạo mới</span>
                        </button>
                        <button onClick={() => navigate('/users/deleted')} className="btn-secondary"><span className="hidden sm:inline">Tài khoản đã xóa</span><span className="sm:hidden">Đã xóa</span></button>
                        <Menu as="div" className="relative inline-block text-left">
                            <Menu.Button className="btn-secondary"><span className="hidden sm:inline">Xuất báo cáo ▾</span><span className="sm:hidden">Xuất file ▾</span></Menu.Button>
                            <Transition as={React.Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                <Menu.Items className="origin-top-right absolute right-0 mt-2 w-40 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                                    <div className="py-1">
                                        <Menu.Item>
                                            {({ active }) => (
                                                <button onClick={() => openExportModal('xlsx')} className={`${active ? 'bg-slate-100' : ''} w-full text-left px-4 py-2 text-sm`}>Xuất Excel</button>
                                            )}
                                        </Menu.Item>
                                        <Menu.Item>
                                            {({ active }) => (
                                                <button onClick={() => openExportModal('pdf')} className={`${active ? 'bg-slate-100' : ''} w-full text-left px-4 py-2 text-sm`}>Xuất PDF</button>
                                            )}
                                        </Menu.Item>
                                        <Menu.Item>
                                            {({ active }) => (
                                                <button onClick={() => openExportModal('csv')} className={`${active ? 'bg-slate-100' : ''} w-full text-left px-4 py-2 text-sm`}>Xuất CSV</button>
                                            )}
                                        </Menu.Item>
                                    </div>
                                </Menu.Items>
                            </Transition>
                        </Menu>
                    </div>
                )}
            </div>

            <div className="mb-4 flex flex-nowrap gap-4 p-4 bg-white rounded-lg shadow-sm overflow-x-auto">
                <div className="relative flex-grow min-w-[250px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"/>
                    <input
                        type="text"
                        name="search"
                        placeholder="Tìm theo tên hoặc tên đăng nhập..."
                        value={filters.search}
                        onChange={handleFilterChange}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg"
                    />
                </div>
                <div className="relative w-auto max-w-[280px]">
                     <select 
                        name="departmentId"
                        value={filters.departmentId}
                        onChange={handleFilterChange}
                        className="w-full input-style"
                     >
                         <option value="">Lọc theo phòng ban</option>
                         {Array.isArray(departments) && departments.map(dep => <option key={dep.id} value={dep.id}>{dep.name}</option>)}
                     </select>
                     {filters.departmentId && (
                         <button onClick={() => handleFilterChange({ target: { name: 'departmentId', value: '' }})} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                             <XCircle size={18}/>
                         </button>
                     )}
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <label className="sr-only" htmlFor="created_from">Ngày tạo từ</label>
                        <input id="created_from" type="date" name="created_from" value={filters.created_from} onChange={handleFilterChange} className="input-style" />
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="sr-only" htmlFor="mfa_enabled">MFA</label>
                        <select id="mfa_enabled" name="mfa_enabled" value={filters.mfa_enabled} onChange={handleFilterChange} className="input-style">
                            <option value="">Lọc theo MFA</option>
                            <option value="1">Bật MFA</option>
                            <option value="0">Tắt MFA</option>
                        </select>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <label className="sr-only" htmlFor="locked">Trạng thái tài khoản</label>
                        <select id="locked" name="locked" value={filters.locked === true || filters.no_department ? (filters.no_department ? 'no_department' : String(filters.locked)) : filters.locked} onChange={handleFilterChange} className="input-style">
                            <option value="">Lọc theo trạng thái</option>
                            <option value="1">Đã khóa</option>
                            <option value="0">Hoạt động</option>
                            <option value="no_department">Không có phòng ban</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white shadow-lg rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tài khoản</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng công việc</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Phòng ban</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Hành động</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {loading && (
                            <tr><td colSpan="5" className="text-center py-10"><Spinner /></td></tr>
                        )}
                        {!loading && users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <img className="h-10 w-10 rounded-full object-cover" src={user.avatar ? `${BACKEND_URL}/${user.avatar}` : defaultAvatar} alt="Avatar" />
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-slate-900 cursor-pointer" tabIndex={0} onMouseEnter={(e) => showHover('user', user, e)} onMouseMove={(e) => showHover('user', user, e)} onMouseLeave={hideHover} onFocus={() => showHover('user', user)} onBlur={hideHover} onClick={() => openModal('edit', user)}>{user.full_name}</div>
                                            <div className="text-sm text-slate-500">@{user.username || 'N/A'}</div>
                                             <RoleBadge name={user.role_name} color={user.role_color} />
                                        </div>
                                    </div>
                                </td>
                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                    <button className="text-blue-600 hover:underline cursor-pointer" onClick={() => openModal('tasks', user)}>
                                        {Number(user.task_count) > 0 ? `${user.task_count} công việc` : ''}
                                    </button>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600" tabIndex={0}>{user.department_name || 'Chưa có'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                      {user.is_active ? 'Hoạt động' : 'Đã khóa'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {canManageUsers && (
                                        <Menu as="div" className="relative inline-block text-left">
                                            <Menu.Button className="p-2 rounded-full hover:bg-slate-100 focus:outline-none">
                                                <MoreVertical className="h-5 w-5 text-slate-500" />
                                            </Menu.Button>
                                            <Transition as={React.Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                                <Menu.Items className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                                                    <div className="py-1">
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                <button onClick={() => openModal('edit', user)} className={`${active ? 'bg-slate-100' : ''} group flex items-center w-full px-4 py-2 text-sm text-slate-700`}>
                                                                    <Edit className="mr-3 h-5 w-5 text-slate-400" /> Chỉnh sửa
                                                                </button>
                                                            )}
                                                        </Menu.Item>
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                    <div>
                                                                        <button onClick={() => handleToggleStatus(user)} className={`${active ? 'bg-slate-100' : ''} group flex items-center w-full px-4 py-2 text-sm text-slate-700`}>
                                                                            {user.is_active 
                                                                                ? <><UserX className="mr-3 h-5 w-5 text-yellow-500" /> Khóa tài khoản</> 
                                                                                : <><UserCheck className="mr-3 h-5 w-5 text-green-500" /> Mở khóa</>
                                                                            }
                                                                        </button>
                                                                        {!user.is_active && (
                                                                            <button onClick={() => handleUnlockUser(user)} className={`group flex items-center w-full px-4 py-2 text-sm text-slate-700`}>
                                                                                <UserCheck className="mr-3 h-5 w-5 text-blue-500" /> Mở khóa (reset số lần thử)
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                            )}
                                                        </Menu.Item>
                                                        <div className="border-t my-1"></div>
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                <button onClick={() => openModal('delete', user)} className={`${active ? 'bg-slate-100' : ''} group flex items-center w-full px-4 py-2 text-sm text-red-700`}>
                                                                    <Trash2 className="mr-3 h-5 w-5 text-red-400" /> Xóa tài khoản
                                                                </button>
                                                            )}
                                                        </Menu.Item>
                                                    </div>
                                                </Menu.Items>
                                            </Transition>
                                        </Menu>
                                    )}
                                </td>
                            </tr>
                        ))}
                         {users.length === 0 && !loading && (
                            <tr>
                                <td colSpan="5" className="text-center py-10 text-slate-500">Không tìm thấy người dùng phù hợp.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                <Pagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    onPageChange={(p) => { setPagination(prev => ({ ...prev, currentPage: p })); fetchData(p, filters); }}
                    perPage={pageSize}
                    onPerPageChange={(n) => { setPageSize(n); setPagination(prev => ({ ...prev, currentPage: 1 })); fetchData(1, { ...filters, limit: n }); try { localStorage.setItem('users_page_size', String(n)); } catch (e) {} }}
                    perPageOptions={[10,20,30,50]}
                    summary={{ total: (accountSummary && (accountSummary.totalAll || accountSummary.total)) || 0 }}
                    summaryLabel="Số lượng tài khoản"
                    useTextButtons={true}
                    showPerPageLabel={true}
                />
            </div>
            
            <CreateUserModal isOpen={modals.create} onClose={() => closeModal('create')} onUserCreated={handleSuccess} />
            {selectedUser && <EditUserModal isOpen={modals.edit} onClose={() => closeModal('edit')} onUserUpdated={handleSuccess} userId={selectedUser.id} />}
            {selectedUser && <DeleteUserModal isOpen={modals.delete} onClose={() => closeModal('delete')} onUserDeleted={() => { closeModal('delete'); handleUserDeleted(); }} user={selectedUser} />}
            
            <UserTasksModal 
                isOpen={modals.tasks}
                userId={selectedUser?.id}
                userName={selectedUser?.full_name}
                onClose={() => closeModal('tasks')}
                onTaskSelect={handleTaskSelect}
            />

            <PasswordExportModal
                isOpen={exportModal.open}
                onClose={() => setExportModal({ open: false, format: 'xlsx' })}
                onConfirm={handleExportConfirm}
                format={exportModal.format}
                quota={exportQuota}
            />

            <QuickUserSummary visible={hoverState.visible} type={hoverState.type} data={hoverState.data} onClose={hideHover} x={hoverState.x} y={hoverState.y} />

            <MfaConfirmModal
                isOpen={!!mfaTarget}
                onClose={() => setMfaTarget(null)}
                title={mfaTarget?.action === 'toggle' ? `Xác thực để ${mfaTarget?.user?.is_active ? 'khóa' : 'mở khóa'} tài khoản` : 'Xác thực MFA'}
                onConfirm={async (code) => {
                    if (!mfaTarget) return
                    if (mfaTarget.action === 'toggle') {
                        try {
                            await apiService.toggleUserStatus(mfaTarget.user.id, !mfaTarget.user.is_active, { mfaToken: code })
                            setNotification({ message: `Đã ${mfaTarget.user.is_active ? 'khóa' : 'mở khóa'} tài khoản thành công.`, type: 'success' });
                            handleSuccess();
                        } catch (err) {
                            throw err
                        }
                    }
                }}
            />

            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    users={allUsersForModal}
                    onClose={() => closeModal('taskDetail')}
                    onUpdate={() => {
                        closeModal('taskDetail');
                        handleSuccess();
                    }}
                />
            )}
        </div>
    );
};

export default UsersPage;