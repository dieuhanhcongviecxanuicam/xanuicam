import api from '../api/axios';

const getLogs = (params) => api.get('/audit-logs', { params }).then(r => r.data);
const exportLogsCsv = (params) => api.get('/audit-logs', { params: { ...params, export: 'csv' }, responseType: 'blob' }).then(r => r.data);
const exportDecryptedCsv = (params) => api.get('/audit-logs/export-decrypted', { params: { ...params }, responseType: 'blob' }).then(r => r.data);
// Bulk export (supports xlsx/pdf/csv) with password confirmation via POST
const exportLogs = (body) => api.exportPost('/audit-logs/export', body, {}).then(r => r);
const getSessions = () => api.get('/audit-logs/sessions').then(r => r.data);
const logoutSession = (sid) => api.post(`/audit-logs/sessions/${sid}/logout`).then(r => r.data);
const logoutAll = (userId) => api.post(`/audit-logs/sessions/logout-all`, { userId }).then(r => r.data);
const getLog = (id) => api.get(`/audit-logs/${id}`).then(r => r.data);
const exportEntry = (id, format = 'json') => api.get(`/audit-logs/${id}/export`, { params: { format }, responseType: 'blob' }).then(r => r.data);
const logoutSessionWithPassword = (sid, password) => api.post(`/audit-logs/sessions/${sid}/logout`, { password }).then(r => r.data);
const logoutAllWithPassword = (userId, password) => api.post(`/audit-logs/sessions/logout-all`, { userId, password }).then(r => r.data);

const auditService = {
  getLogs,
  exportLogsCsv,
  exportDecryptedCsv,
  exportLogs,
  getSessions,
  logoutSession,
  logoutAll,
  getLog,
  exportEntry,
  logoutSessionWithPassword,
  logoutAllWithPassword
};

export default auditService;
