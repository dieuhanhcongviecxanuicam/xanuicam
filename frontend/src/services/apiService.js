// ubndxanuicam/frontend/src/services/apiService.js
// VERSION 4.2 - FULLY FEATURED AND FINALIZED

import api from '../api/axios';

const handleResponse = (response) => response.data;
const handleError = (error) => {
    // If server returned a structured error object, throw it so callers
    // can inspect fields like `retry_after_seconds`.
    if (error.response && error.response.data) {
        throw error.response.data;
    }
    throw error.message || 'Đã có lỗi xảy ra từ máy chủ.';
};

const apiService = {
    // Auth
    login: (credentials) => api.post('/auth/login', credentials).then(handleResponse).catch(handleError),
    updateProfile: (formData) => api.put('/auth/profile', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(handleResponse).catch(handleError),
    changePassword: (passwords) => api.post('/auth/change-password', passwords).then(handleResponse).catch(handleError),

    // Users
    getUsers: (params) => api.get('/users', { params }).then(handleResponse).catch(handleError),
    getUserById: (id) => api.get(`/users/${id}`).then(handleResponse).catch(handleError),
    checkUsernameUnique: (username, excludeId) => api.get('/users/unique', { params: { username, excludeId } }).then(handleResponse).catch(handleError),
    createUser: (userData) => {
        if (userData instanceof FormData) return api.post('/users', userData).then(handleResponse).catch(handleError);
        return api.post('/users', userData).then(handleResponse).catch(handleError);
    },
    updateUser: (id, userData) => {
        if (userData instanceof FormData) return api.patch(`/users/${id}`, userData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(handleResponse).catch(handleError);
        return api.patch(`/users/${id}`, userData).then(handleResponse).catch(handleError);
    },
    deleteUser: (id, body) => api.delete(`/users/${id}`, { data: body }).then(handleResponse).catch(handleError),
    toggleUserStatus: (id, isActive, body = {}) => api.patch(`/users/${id}/status`, { is_active: isActive, ...body }).then(handleResponse).catch(handleError),
    unlockUser: (id) => api.post(`/users/${id}/unlock`).then(handleResponse).catch(handleError),
    getUserTasks: (userId) => api.get(`/users/${userId}/tasks`).then(handleResponse).catch(handleError),
    // exportUsers returns parsed response.data for JSON routes
    exportUsers: (body) => api.post('/users/export', body, { headers: { Accept: '*/*' } }).then(handleResponse).catch(handleError),
    // exportUsersRaw returns the full response wrapper (including headers) for binary downloads
    exportUsersRaw: (body) => api.post('/users/export', body, { headers: { Accept: '*/*' } }).catch(handleError),
    getExportQuota: () => api.get('/users/export/quota').then(handleResponse).catch(handleError),
    // Deleted (archived) users
    getDeletedUsers: (params) => api.get('/users/deleted', { params }).then(handleResponse).catch(handleError),
    restoreDeletedUser: (id) => api.post(`/users/deleted/${id}/restore`).then(handleResponse).catch(handleError),
    permanentlyDeleteUser: (id, body) => api.delete(`/users/deleted/${id}`, { data: body }).then(handleResponse).catch(handleError),

    // Departments
    getDepartments: (params) => api.get('/departments', { params }).then(handleResponse).catch(handleError),
    getDepartmentById: (id) => api.get(`/departments/${id}`).then(handleResponse).catch(handleError),
    createDepartment: (formData) => api.post('/departments', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(handleResponse).catch(handleError),
    updateDepartment: (id, formData) => api.put(`/departments/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(handleResponse).catch(handleError),
    deleteDepartment: (id) => api.delete(`/departments/${id}`).then(handleResponse).catch(handleError),
    // Deleted / archived departments
    getDeletedDepartments: (params) => api.get('/departments/deleted', { params }).then(handleResponse).catch(handleError),
    restoreDeletedDepartment: (id) => api.post(`/departments/deleted/${id}/restore`).then(handleResponse).catch(handleError),
    permanentlyDeleteDepartment: (id, body) => api.delete(`/departments/deleted/${id}`, { data: body }).then(handleResponse).catch(handleError),
    // Export departments
    exportDepartments: (body) => api.post('/departments/export', body, { headers: { Accept: '*/*' } }).then(handleResponse).catch(handleError),
    exportDepartmentsRaw: (body) => api.exportPost('/departments/export', body).catch(handleError),

    // Roles & Permissions
    getRoles: () => api.get('/roles').then(handleResponse).catch(handleError),
    getAllPermissions: () => api.get('/roles/permissions').then(handleResponse).catch(handleError),
    // map old permission descriptions to friendly keys on the frontend where needed
    getRoleById: (id) => api.get(`/roles/${id}`).then(handleResponse).catch(handleError),
    createRole: (roleData) => api.post('/roles', roleData).then(handleResponse).catch(handleError),
    updateRole: (id, roleData) => api.put(`/roles/${id}`, roleData).then(handleResponse).catch(handleError),
    deleteRole: (id) => api.delete(`/roles/${id}`).then(handleResponse).catch(handleError),
    // Deleted roles
    getDeletedRoles: (params) => api.get('/roles/deleted/list', { params }).then(handleResponse).catch(handleError),
    restoreDeletedRole: (id) => api.post(`/roles/deleted/${id}/restore`).then(handleResponse).catch(handleError),
    permanentlyDeleteRole: (id) => api.delete(`/roles/deleted/${id}/permanent`).then(handleResponse).catch(handleError),
    
    // Tasks
    getTasks: () => api.get('/tasks').then(handleResponse).catch(handleError),
    getTask: (id) => api.get(`/tasks/${id}`).then(handleResponse).catch(handleError),
    createTask: (taskData) => api.post('/tasks', taskData).then(handleResponse).catch(handleError),
    updateTask: (id, taskData) => api.put(`/tasks/${id}`, taskData).then(handleResponse).catch(handleError),
    updateTaskStatus: (id, status, details) => api.patch(`/tasks/${id}/status`, { status, details }).then(handleResponse).catch(handleError),
    updateTaskKpi: (id, kpi_score) => api.patch(`/tasks/${id}/kpi`, { kpi_score }).then(handleResponse).catch(handleError),
    getTaskHistory: (id) => api.get(`/tasks/${id}/history`).then(handleResponse).catch(handleError),
    getTaskComments: (id) => api.get(`/tasks/${id}/comments`).then(handleResponse).catch(handleError),
    addTaskComment: (id, content) => api.post(`/tasks/${id}/comments`, { content }).then(handleResponse).catch(handleError),
    getTaskAttachments: (id) => api.get(`/tasks/${id}/attachments`).then(handleResponse).catch(handleError),
    addTaskAttachment: (id, formData) => api.post(`/tasks/${id}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(handleResponse).catch(handleError),
    // Deleted tasks management
    getDeletedTasks: (params) => api.get('/tasks/deleted', { params }).then(handleResponse).catch(handleError),
    restoreDeletedTask: (id) => api.post(`/tasks/deleted/${id}/restore`).then(handleResponse).catch(handleError),
    permanentlyDeleteTask: (id, body) => api.delete(`/tasks/deleted/${id}`, { data: body }).then(handleResponse).catch(handleError),
    // Export tasks (use exportPost helper to receive blob + filename)
    exportTasks: (body) => api.post('/tasks/export', body, { headers: { Accept: '*/*' } }).then(handleResponse).catch(handleError),
    exportTasksRaw: (body) => api.exportPost('/tasks/export', body).catch(handleError),
    
    // Articles
    getArticlesByCategory: (category) => api.get(`/articles/${category}`).then(handleResponse).catch(handleError),
    getArticleById: (id) => api.get(`/articles/view/${id}`).then(handleResponse).catch(handleError),
    createArticle: (formData) => api.post('/articles', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(handleResponse).catch(handleError),
    updateArticle: (id, formData) => api.put(`/articles/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(handleResponse).catch(handleError),
    deleteArticle: (id) => api.delete(`/articles/${id}`).then(handleResponse).catch(handleError),
    // Deleted articles & attachments
    getDeletedArticles: (params) => api.get('/articles/deleted', { params }).then(handleResponse).catch(handleError),
    restoreDeletedArticle: (id) => api.post(`/articles/deleted/${id}/restore`).then(handleResponse).catch(handleError),
    getDeletedArticleAttachments: (params) => api.get('/articles/deleted-attachments', { params }).then(handleResponse).catch(handleError),
    restoreDeletedArticleAttachment: (id) => api.post(`/articles/deleted-attachments/${id}/restore`).then(handleResponse).catch(handleError),

    // Meetings & Room Bookings
    getMeetings: (params) => api.get('/meetings', { params }).then(handleResponse).catch(handleError),
    createMeeting: (meetingData) => api.post('/meetings', meetingData).then(handleResponse).catch(handleError),
    updateMeetingStatus: (id, status) => api.patch(`/meetings/${id}/status`, { status }).then(handleResponse).catch(handleError),
    getRoomBookings: async (params) => {
        try {
            return await api.get('/room-bookings', { params }).then(handleResponse).catch(handleError);
        } catch (err) {
            // In development, some local setups may not use the CRA proxy correctly
            // Retry with an explicit localhost:5000 URL to reduce 404 noise.
            if (process.env.NODE_ENV === 'development') {
                try {
                    const host = window && window.location && window.location.hostname ? window.location.hostname : 'localhost';
                    const fallback = `${window.location.protocol}//${host}:5000/api/room-bookings`;
                    return await api.get(fallback, { params }).then(handleResponse).catch(handleError);
                } catch (e) {
                    throw err;
                }
            }
            throw err;
        }
    },
    createRoomBooking: (bookingData) => {
        if (bookingData instanceof FormData) {
            return api.post('/room-bookings', bookingData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(handleResponse).catch(handleError);
        }
        return api.post('/room-bookings', bookingData).then(handleResponse).catch(handleError);
    },
    updateRoomBookingStatus: (id, status) => api.patch(`/room-bookings/${id}/status`, { status }).then(handleResponse).catch(handleError),
    updateRoomBooking: (id, bookingData) => {
        if (bookingData instanceof FormData) {
            return api.put(`/room-bookings/${id}`, bookingData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(handleResponse).catch(handleError);
        }
        return api.put(`/room-bookings/${id}`, bookingData).then(handleResponse).catch(handleError);
    },
    // Deleted attachments archive
    getDeletedRoomBookingAttachments: (params) => api.get('/room-bookings/deleted-attachments', { params }).then(handleResponse).catch(handleError),
    restoreDeletedRoomBookingAttachment: (id) => api.post(`/room-bookings/deleted-attachments/${id}/restore`).then(handleResponse).catch(handleError),
    // Deleted room bookings (archived bookings list + restore)
    getDeletedRoomBookings: (params) => api.get('/room-bookings/deleted', { params }).then(handleResponse).catch(handleError),
    restoreDeletedRoomBooking: (id) => api.post(`/room-bookings/deleted/${id}/restore`).then(handleResponse).catch(handleError),
    deleteRoomBooking: (id) => api.delete(`/room-bookings/${id}`).then(handleResponse).catch(handleError),
    // Approvals (combined)
    getApprovals: () => api.get('/approvals').then(handleResponse).catch(handleError),
    
    // Calendar Events (Schedule Page)
    getEvents: (params) => api.get('/calendar', { params }).then(handleResponse).catch(handleError),
    createEvent: (eventData) => {
        if (eventData instanceof FormData) {
            return api.post('/calendar', eventData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(handleResponse).catch(handleError);
        }
        return api.post('/calendar', eventData).then(handleResponse).catch(handleError);
    },
    updateEvent: (id, eventData) => {
        if (eventData instanceof FormData) {
            return api.put(`/calendar/${id}`, eventData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(handleResponse).catch(handleError);
        }
        return api.put(`/calendar/${id}`, eventData).then(handleResponse).catch(handleError);
    },
    deleteEvent: (id) => api.delete(`/calendar/${id}`).then(handleResponse).catch(handleError),
    getDeletedCalendarAttachments: (params) => api.get('/calendar/deleted-attachments', { params }).then(handleResponse).catch(handleError),
    restoreDeletedCalendarAttachment: (id) => api.post(`/calendar/deleted-attachments/${id}/restore`).then(handleResponse).catch(handleError),
    // Deleted calendar events (archived)
    getDeletedCalendarEvents: (params) => api.get('/calendar/deleted', { params }).then(handleResponse).catch(handleError),
    restoreDeletedCalendarEvent: (id) => api.post(`/calendar/deleted/${id}/restore`).then(handleResponse).catch(handleError),

    // Feedback
    submitFeedback: (feedbackData) => api.post('/feedback', feedbackData).then(handleResponse).catch(handleError),
    getAllFeedback: () => api.get('/feedback').then(handleResponse).catch(handleError),
    getMyFeedback: () => api.get('/feedback/my-feedback').then(handleResponse).catch(handleError),
    getFeedbackById: (id) => api.get(`/feedback/${id}`).then(handleResponse).catch(handleError),
    respondToFeedback: (id, responseData) => api.put(`/feedback/${id}/respond`, responseData).then(handleResponse).catch(handleError),
    
    // System, Audit, Notifications
    getSystemSettings: () => api.get('/system/settings').then(handleResponse).catch(handleError),
    updateMaintenanceMode: (maintenanceData) => api.put('/system/settings/maintenance', maintenanceData).then(handleResponse).catch(handleError),
    updateBroadcastNotification: (notificationData) => api.put('/system/settings/notification', notificationData).then(handleResponse).catch(handleError),
    // Public broadcast notification (no auth required)
    getPublicBroadcastNotification: () => api.get('/system/notification').then(handleResponse).catch(handleError),
    getAuditLogs: (params) => api.get('/audit-logs', { params }).then(handleResponse).catch(handleError),
    // Log an audit/event entry (frontend helper)
    logEvent: (body) => api.post('/audit-logs', body).then(handleResponse).catch(handleError),
    getAuditExportQuota: () => api.get('/audit-logs/export/quota').then(handleResponse).catch(handleError),
    // QA: user update actions tracking
    getUserUpdateActions: (params) => api.get('/system/user-update-actions', { params }).then(handleResponse).catch(handleError),
    clearUserUpdateActions: (body) => api.delete('/system/user-update-actions', { data: body }).then(handleResponse).catch(handleError),
    // MFA
    mfaSetup: () => api.post('/auth/mfa/setup').then(handleResponse).catch(handleError),
    mfaVerify: (body) => api.post('/auth/mfa/verify', body).then(handleResponse).catch(handleError),
    mfaDisable: (body) => {
        // Ensure the token is attached even if axios interceptor hasn't applied it yet.
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (token) return api.post('/auth/mfa/disable', body, { headers: { Authorization: `Bearer ${token}` } }).then(handleResponse).catch(handleError);
        } catch (e) {
            // fall through to default call
        }
        return api.post('/auth/mfa/disable', body).then(handleResponse).catch(handleError);
    },
    mfaInfo: () => api.get('/auth/mfa/info').then(handleResponse).catch(handleError),
    mfaRotate: () => api.post('/auth/mfa/rotate').then(handleResponse).catch(handleError),
    logoutSession: (sid) => api.post(`/auth/sessions/${sid}/logout`).then(handleResponse).catch(handleError),
    getNotifications: () => api.get('/notifications').then(handleResponse).catch(handleError),
    getNotificationPrefs: () => api.get('/notifications/prefs').then(handleResponse).catch(handleError),
    updateNotificationPrefs: (prefs) => api.put('/notifications/prefs', prefs).then(handleResponse).catch(handleError),
    markNotificationAsRead: (id) => api.post(`/notifications/${id}/read`).then(handleResponse).catch(handleError),
    markAllNotificationsAsRead: () => api.post('/notifications/mark-all-as-read').then(handleResponse).catch(handleError),

    // Reports
    getReportFilters: () => api.get('/reports/filters').then(handleResponse).catch(handleError),
    getOverviewStats: (params) => api.get('/reports/overview-stats', { params }).then(handleResponse).catch(handleError),
    getDetailedTaskReport: (params) => api.get('/reports/detailed-tasks', { params }).then(handleResponse).catch(handleError),
    // KPI scores aggregated per user/department
    // params may include page and pageSize to request server-side pagination
    getKpiScores: (params) => api.get('/reports/kpi-scores', { params }).then(handleResponse).catch(handleError),
};

export default apiService;