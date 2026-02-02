import React, { useMemo, useState, useEffect } from 'react';
import ModalWrapper from '../common/ModalWrapper';
import AttachmentViewerModal from '../common/AttachmentViewerModal';
import { X } from 'lucide-react';
import useDepartments from '../../hooks/useDepartments';

const MeetingDetailModal = ({ isOpen, onClose, booking, onNotify, departmentsMap = {} }) => {
    const [downloading, setDownloading] = useState(false);
    const [viewerAttachment, setViewerAttachment] = useState(null);
    const { departmentsMap: hookDepartmentsMap, getDepartmentById } = useDepartments();
    const [fetchedDepartmentName, setFetchedDepartmentName] = useState(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                if (!booking) return;
                const depId = booking.department_id || booking.department || booking.departmentId;
                if (!depId) return;
                    if (booking.department_name) return; // already present
                    const effectiveDepartmentsMap = (departmentsMap && Object.keys(departmentsMap).length) ? departmentsMap : hookDepartmentsMap;
                    if (effectiveDepartmentsMap && effectiveDepartmentsMap[String(depId)]) return; // map already has it
                const dept = await getDepartmentById(depId).catch(() => null);
                if (!mounted) return;
                if (dept) setFetchedDepartmentName(dept.name || dept.department_name || null);
            } catch (e) {
                // ignore
            }
        })();
        return () => { mounted = false; };
    }, [booking, departmentsMap, hookDepartmentsMap, getDepartmentById]);

    const backendBase = (process.env.REACT_APP_API_BASE_URL ? process.env.REACT_APP_API_BASE_URL.replace(/\/api\/?$/, '') : (process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : ''));

    const attachments = useMemo(() => {
        if (!booking || !booking.attachment_path) return [];
        try {
            const parsed = typeof booking.attachment_path === 'string' ? JSON.parse(booking.attachment_path) : booking.attachment_path;
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            return arr.map(p => ({
                url: `${backendBase}/${String(p).replace(/^\/+/, '')}`,
                name: String(p).split('/').pop()
            }));
        } catch (e) {
            const p = booking.attachment_path;
            return [{ url: `${backendBase}/${String(p).replace(/^\/+/, '')}`, name: String(p).split('/').pop() }];
        }
    }, [booking, backendBase]);

    const downloadAttachment = async (att) => {
        if (!att || !att.url) return;
        try {
            setDownloading(true);
            const resp = await fetch(att.url, { credentials: 'include' });
            if (!resp.ok) throw new Error('Không thể tải tệp.');
            const blob = await resp.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = att.name || 'attachment';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download error', err);
            if (onNotify) onNotify({ message: 'Không thể tải tệp đính kèm.', type: 'error' });
            else alert('Không thể tải tệp đính kèm.');
        } finally {
            setDownloading(false);
        }
    };

    if (!isOpen || !booking) return null;

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-md" className="p-4 sm:p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{booking.title}</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>
            <div className="text-sm text-slate-700 space-y-2 overflow-y-auto">
                {/* Show basis (Căn cứ GM) fields above room info only when provided */}
                {(booking.basis_super || booking.basis_commune) && (
                    <div className={`grid gap-2 ${booking.basis_super && booking.basis_commune ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {booking.basis_super && <div><strong>Căn cứ GM (cấp trên):</strong> <span className="ml-2">{booking.basis_super}</span></div>}
                        {booking.basis_commune && <div><strong>Căn cứ GM (xã):</strong> <span className="ml-2">{booking.basis_commune}</span></div>}
                    </div>
                )}

                <div><strong>Phòng:</strong> {booking.room_name}</div>
                <div><strong>Người đăng ký:</strong> {booking.booker_name || booking.organizer_name || '-'}</div>
                <div>
                    <strong>Thời gian:</strong>
                    <span className="text-cyan-600 text-sm ml-2">{new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} đến {new Date(booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-sm text-slate-400 ml-2">ngày {new Date(booking.created_at || booking.start_time).toLocaleDateString()}</span>
                </div>
                {
                    (() => {
                        const effectiveMap = (departmentsMap && Object.keys(departmentsMap).length) ? departmentsMap : hookDepartmentsMap || {};
                        const depId = booking.department_id || booking.department || booking.departmentId;
                        const displayDepartmentName = booking.department_name || (depId != null ? (effectiveMap[String(depId)] || fetchedDepartmentName || String(depId)) : '-') || '-';
                        return <div><strong>Đơn vị triển khai:</strong> {displayDepartmentName}</div>;
                    })()
                }
                <div><strong>Số lượng:</strong> {booking.attendees_count || '-'}</div>
                <div><strong>Màn hình LED:</strong> {booking.has_led ? 'Có' : 'Không'}</div>
                <div><strong>Nội dung:</strong>
                    <div className="mt-1 p-2 bg-slate-50 rounded text-slate-700 whitespace-pre-wrap">{booking.description || '-'}</div>
                </div>
                {attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {attachments.map((att, i) => (
                            <div key={i} className="flex items-start justify-between gap-3">
                                <div className="text-sm text-slate-700 break-words max-w-[60%]">{att.name}</div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => downloadAttachment(att)} disabled={downloading} className="px-2 py-1 bg-cyan-600 text-white rounded text-xs">
                                        {downloading ? 'Đang tải...' : 'Tải'}
                                    </button>
                                    <button onClick={() => {
                                        const rel = att.url.startsWith(backendBase) ? att.url.substring(backendBase.length) : att.url;
                                        const file_path = String(rel).replace(/^\/+/, '');
                                        setViewerAttachment({ file_path, file_name: att.name });
                                    }} className="px-2 py-1 bg-cyan-100 text-cyan-800 rounded text-xs">Xem</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            {viewerAttachment && (
                <AttachmentViewerModal attachment={viewerAttachment} onClose={() => setViewerAttachment(null)} />
            )}
            </div>
        </ModalWrapper>
    );
};

export default MeetingDetailModal;
