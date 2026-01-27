import React, { useState, useEffect, useCallback, useRef } from 'react';
import useAuth from '../../hooks/useAuth';
import apiService from '../../services/apiService';
import eventBus from '../../utils/eventBus';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { X, User, Calendar, Flag, Clock, Check, History, Paperclip, MessageSquare, Edit, Star, Send, UploadCloud, Download, CornerUpLeft } from 'lucide-react';
import Spinner from '../common/Spinner';
import ModalWrapper from '../common/ModalWrapper';
import AttachmentViewerModal from '../common/AttachmentViewerModal';
import EditTaskModal from './EditTaskModal';
import defaultAvatar from '../../assets/images/default-avatar.png';

const InfoItem = ({ icon, label, value }) => (
    <div className="flex items-start">
        <div className="text-slate-400 mr-3 mt-1">{React.cloneElement(icon, { size: 18 })}</div>
        <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="font-semibold text-slate-700">{value || 'Chưa có'}</p>
        </div>
    </div>
);

const ActionButton = ({ onClick, text, icon = null, className = "btn-primary px-3 py-2 text-sm", disabled = false }) => (
     <button type="button" onClick={onClick} disabled={disabled} className={`flex items-center justify-center ${className}`}>
        {icon && React.cloneElement(icon, { size: 14, className: "mr-2" })}
        {text}
    </button>
);

const KpiRating = ({ task, onRate, canRate }) => {
    const [hovered, setHovered] = useState(0);
    const score = task.kpi_score || 0;

    return (
        <div className="mb-6">
            <h3 className="font-semibold mb-2">Đánh giá hiệu suất (KPI)</h3>
            <div className="flex items-center bg-slate-50 p-4 rounded-md">
                {[1, 2, 3].map(star => (
                    <Star
                        key={star}
                        className={`w-8 h-8 cursor-pointer transition-colors
                            ${(hovered || score) >= star ? 'text-yellow-400 fill-current' : 'text-slate-300'}
                            ${canRate ? 'hover:text-yellow-500' : 'cursor-not-allowed'}`}
                        onMouseEnter={() => canRate && setHovered(star)}
                        onMouseLeave={() => canRate && setHovered(0)}
                        onClick={() => canRate && onRate(star)}
                    />
                ))}
                {!canRate && score === 0 && <p className="text-xs text-slate-500 ml-4">Chỉ người giao việc hoặc người có quyền mới có thể đánh giá.</p>}
                 {score > 0 && <p className="text-sm font-semibold text-slate-700 ml-4">{score === 1 ? 'Chưa đạt' : score === 2 ? 'Tốt' : 'Xuất sắc'}</p>}
            </div>
        </div>
    );
};

const TaskDetailModal = ({ task, users, onClose, onUpdate }) => {
    const [taskData, setTaskData] = useState(task);
    const [history, setHistory] = useState([]);
    const [comments, setComments] = useState([]);
    const [attachments, setAttachments] = useState([]);
    const [newComment, setNewComment] = useState("");
    
    const [loading, setLoading] = useState({ history: true, comments: true, attachments: true });
    const [actionLoading, setActionLoading] = useState(false);
    
    const [selectedAttachment, setSelectedAttachment] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    
    const { user, hasPermission } = useAuth();
    const fileInputRef = useRef(null);
    const BACKEND_URL = (process.env.REACT_APP_API_BASE_URL || '').replace('/api', '');

    const handleDownload = async (file) => {
        try {
            const url = `${BACKEND_URL}/${file.file_path}`;
            const res = await fetch(url, { method: 'GET', credentials: 'include' });
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const link = document.createElement('a');
            const blobUrl = window.URL.createObjectURL(blob);
            link.href = blobUrl;
            link.download = file.file_name || 'download';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Error downloading file', error);
            // fallback: open in new tab (safe)
            try {
                window.open(`${BACKEND_URL}/${file.file_path}`, '_blank', 'noopener,noreferrer');
            } catch (e) {
                // ignore
            }
        }
    };

    const fetchTaskDetails = useCallback(async () => {
        if (!taskData?.id) return;
        setLoading({ history: true, comments: true, attachments: true });
        try {
            const historyP = Promise.resolve(apiService.getTaskHistory(taskData.id)).then(r => r || []).finally(() => setLoading(prev => ({...prev, history: false})));
            const commentsP = Promise.resolve(apiService.getTaskComments(taskData.id)).then(r => r || []).finally(() => setLoading(prev => ({...prev, comments: false})));
            const attachmentsP = Promise.resolve(apiService.getTaskAttachments(taskData.id)).then(r => r || []).finally(() => setLoading(prev => ({...prev, attachments: false})));
            const taskP = Promise.resolve(apiService.getTask(taskData.id)).then(r => r || {});

            const [historyRes, commentsRes, attachmentsRes, taskRes] = await Promise.all([historyP, commentsP, attachmentsP, taskP]);
            setHistory(historyRes || []);
            setComments(commentsRes || []);
            setAttachments(attachmentsRes || []);
            // Ensure we have the latest task data (including kpi_score) so KPI stars show correctly
            if (taskRes && taskRes.id) setTaskData(taskRes);
        } catch (error) {
            console.error("Lỗi khi tải dữ liệu chi tiết công việc:", error);
        }
    }, [taskData.id]);

    useEffect(() => {
        fetchTaskDetails();
    }, [fetchTaskDetails]);

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        setActionLoading(true);
        try {
            await apiService.addTaskComment(taskData.id, newComment);
            // audit log (fire-and-forget, swallow errors)
            apiService.logEvent({ action: 'task.comment.added', resource_type: 'task', resource_id: taskData.id, details: newComment }).catch(() => {});
            setNewComment("");
            fetchTaskDetails();
        } catch (error) {
            console.error("Lỗi khi gửi bình luận:", error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        setActionLoading(true);
        try {
            await apiService.addTaskAttachment(taskData.id, formData);
            apiService.logEvent({ action: 'task.attachment.added', resource_type: 'task', resource_id: taskData.id, details: file.name }).catch(() => {});
            fetchTaskDetails();
        } catch (error) {
            console.error("Lỗi khi tải tệp lên:", error);
        } finally {
            setActionLoading(false);
            e.target.value = null;
        }
    };

    const handleStatusUpdate = async (newStatus, details = '') => {
        setActionLoading(true);
        try {
            if (details !== undefined && details !== '') {
                await apiService.updateTaskStatus(taskData.id, newStatus, details);
            } else {
                await apiService.updateTaskStatus(taskData.id, newStatus);
            }
            apiService.logEvent({ action: 'task.status.updated', resource_type: 'task', resource_id: taskData.id, details, meta: { status: newStatus } }).catch(() => {});
            onUpdate();
            onClose();
        } catch (error) {
            console.error("Lỗi cập nhật trạng thái:", error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleKpiRate = async (score) => {
        setActionLoading(true);
        try {
            await apiService.updateTaskKpi(taskData.id, score);
            setTaskData(prev => ({...prev, kpi_score: score}));
            fetchTaskDetails();
            if (typeof onUpdate === 'function') onUpdate();
            // emit event for live update across app
            eventBus.emit('task.kpi.updated', { id: taskData.id, kpi_score: score });
            apiService.logEvent({ action: 'task.kpi.rated', resource_type: 'task', resource_id: taskData.id, details: `kpi_score:${score}`, meta: { kpi_score: score } }).catch(() => {});
        } catch(error) {
            console.error("Lỗi khi đánh giá KPI", error);
        } finally {
            setActionLoading(false);
        }
    };
    
    const isAssignee = user.id === taskData.assignee_id;
    const isCreator = user.id === taskData.creator_id;
    const canApprove = hasPermission(['approve_task']);
    const canEditTask = hasPermission(['edit_delete_task']) || isCreator;
    const canAccept = isAssignee && taskData.status === 'Mới tạo';
    const canStart = isAssignee && (taskData.status === 'Tiếp nhận' || taskData.status === 'Yêu cầu làm lại');
    const canReport = isAssignee && taskData.status === 'Đang thực hiện';
    const canReview = (isCreator || canApprove) && taskData.status === 'Chờ duyệt';
    const canRateKpi = (isCreator || canApprove) && taskData.status === 'Hoàn thành';

    return (
        <>
                    <EditTaskModal 
                        isOpen={isEditModalOpen}
                        onClose={() => setIsEditModalOpen(false)}
                        onSuccess={onUpdate}
                        task={taskData}
                        users={users}
                    />

                    <ModalWrapper isOpen={true} onClose={onClose} maxWidth="max-w-3xl" className="overflow-hidden flex flex-col p-0" coverHeader={true}>
                        <div className="flex flex-col">
                            <div className="flex justify-between items-center p-6 border-b flex-shrink-0">
                        <div className="flex items-center">
                            <h2 className="text-xl font-bold text-slate-800">{taskData.title}</h2>
                            {canEditTask && (
                                <button onClick={() => setIsEditModalOpen(true)} className="ml-4 flex items-center text-sm text-blue-600 hover:text-blue-800">
                                    <Edit size={14} className="mr-1" /> Thay đổi
                                </button>
                            )}
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X /></button>
                    </div>
                    
                    <div className="p-6 pb-6" style={{WebkitOverflowScrolling: 'touch', overflowY: 'auto', maxHeight: 'calc(100vh - 120px)', touchAction: 'pan-y'}}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <InfoItem icon={<User />} label="Người giao việc" value={taskData.creator_name} />
                            <InfoItem icon={<User />} label="Người thực hiện" value={taskData.assignee_name} />
                            <InfoItem icon={<Calendar />} label="Ngày hết hạn" value={format(new Date(taskData.due_date), 'dd/MM/yyyy', { locale: vi })} />
                            <InfoItem icon={<Flag />} label="Độ ưu tiên" value={taskData.priority} />
                            <InfoItem icon={<Clock />} label="Trạng thái" value={taskData.status} />
                        </div>
                        
                        <div className="mb-6">
                            <h3 className="font-semibold mb-2">Mô tả công việc</h3>
                            <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-md whitespace-pre-wrap">{taskData.description || "Không có mô tả chi tiết."}</p>
                        </div>

                        {taskData.status === 'Hoàn thành' && (
                            <KpiRating task={taskData} onRate={handleKpiRate} canRate={canRateKpi && !actionLoading} />
                        )}

                        <div className="mb-6">
                            <h3 className="font-semibold mb-2 flex items-center"><History size={16} className="mr-2"/> Lịch sử hoạt động</h3>
                            {loading.history ? <Spinner /> : (
                                <div className="space-y-4 text-sm text-slate-600 max-h-48 overflow-y-auto border-l-2 border-slate-200 ml-1 pl-5">
                                    {history.length > 0 ? history.map(item => (
                                        <div key={item.id} className="relative">
                                            <div className="absolute -left-[27px] top-1 w-3 h-3 bg-slate-300 rounded-full border-2 border-white"></div>
                                            <p className="font-semibold text-slate-800">{item.action}</p>
                                            <p className="text-xs text-slate-500">
                                                bởi <span className="font-medium">{item.user_name}</span> lúc {format(new Date(item.created_at), 'HH:mm, dd/MM/yyyy', { locale: vi })}
                                            </p>
                                            {item.details && <p className="text-xs italic text-slate-500 mt-1 whitespace-pre-wrap">"{item.details}"</p>}
                                        </div>
                                    )) : <p className="text-xs text-slate-500">Chưa có lịch sử hoạt động.</p>}
                                </div>
                            )}
                        </div>

                        <div className="mb-6">
                            <h3 className="font-semibold mb-2 flex items-center"><MessageSquare size={16} className="mr-2"/> Bình luận & Trao đổi</h3>
                            <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
                                {loading.comments ? <Spinner /> : comments.map(comment => (
                                    <div key={comment.id} className="flex items-start">
                                        <img src={comment.avatar ? `${BACKEND_URL}/${comment.avatar}` : defaultAvatar} alt={comment.full_name} className="w-8 h-8 rounded-full mr-3 object-cover"/>
                                        <div className="flex-1 bg-slate-100 rounded-lg p-3">
                                            <div className="flex justify-between items-center">
                                                <p className="font-semibold text-sm">{comment.full_name}</p>
                                                <p className="text-xs text-slate-400">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: vi })}</p>
                                            </div>
                                            <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{comment.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={handleCommentSubmit} className="mt-4 flex items-center">
                                <input 
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Viết bình luận..."
                                    className="input-style no-native-arrows flex-1"
                                    disabled={actionLoading}
                                />
                                <button type="submit" className="ml-2 p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={actionLoading || !newComment.trim()}>
                                    <Send size={18}/>
                                </button>
                            </form>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2 flex items-center"><Paperclip size={16} className="mr-2"/> File đính kèm & Báo cáo</h3>
                            <div className="space-y-2">
                                {loading.attachments ? <Spinner/> : attachments.map(file => (
                                    <div key={file.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-md">
                                        <button onClick={() => setSelectedAttachment(file)} className="text-blue-600 text-sm hover:underline text-left truncate">
                                            {file.file_name}
                                        </button>
                                        <button type="button" onClick={() => handleDownload(file)} className="p-2 text-slate-500 hover:text-slate-800 flex-shrink-0" title="Tải xuống">
                                            <Download size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2">
                                <label htmlFor="file-upload" className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 flex items-center">
                                    <UploadCloud size={16} className="mr-2"/> Tải lên tệp mới
                                </label>
                                <input id="file-upload" type="file" className="hidden" onChange={handleFileUpload} ref={fileInputRef} disabled={actionLoading} />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t bg-slate-50 flex items-center justify-end gap-3 flex-shrink-0">
                        <button type="button" onClick={onClose} className="btn-secondary">Đóng</button>
                        {isAssignee && (
                            <button type="button" className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm" onClick={async () => {
                                if (!window.confirm('Xác nhận hủy công việc này?')) return;
                                await handleStatusUpdate('Đã hủy');
                            }}>Xóa công việc</button>
                        )}
                        {canAccept && <ActionButton onClick={() => handleStatusUpdate('Tiếp nhận')} text="Tiếp nhận" disabled={actionLoading} />}
                        {canStart && <ActionButton onClick={() => handleStatusUpdate('Đang thực hiện')} text="Bắt đầu" disabled={actionLoading} />}
                        {canReport && <ActionButton onClick={() => handleStatusUpdate('Chờ duyệt')} text="Báo cáo" disabled={actionLoading} />}
                        {canReview && (
                            <div className="flex items-center gap-2">
                                <ActionButton onClick={() => handleStatusUpdate('Yêu cầu làm lại')} text="Yêu cầu làm lại" icon={<CornerUpLeft/>} className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 text-sm" disabled={actionLoading} />
                                <ActionButton onClick={() => handleStatusUpdate('Hoàn thành')} text="Duyệt & Hoàn thành" icon={<Check />} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm" disabled={actionLoading} />
                            </div>
                        )}
                    </div>
                </div>
            </ModalWrapper>
            {/* Render attachment viewer AFTER the main task modal so its portal mounts later
                and modal stacking (modalStack) places the image viewer above the task detail. */}
            <AttachmentViewerModal 
                attachment={selectedAttachment}
                onClose={() => setSelectedAttachment(null)}
            />
        </>
    );
};

export default TaskDetailModal;