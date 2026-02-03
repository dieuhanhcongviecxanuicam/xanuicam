import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2 } from 'lucide-react';
import apiService from '../../services/apiService';
import { snapToNearestMinutes } from '../../utils/timeUtils';
import ModalWrapper from '../common/ModalWrapper';
import AttachmentViewerModal from '../common/AttachmentViewerModal';

const EventModal = ({ isOpen, onClose, onSuccess, eventData, selectedDate }) => {
    const [formData, setFormData] = useState({ title: '', start_time: '', end_time: '', description: '', location: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [confirmDeleteEvent, setConfirmDeleteEvent] = useState({ open: false });
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [confirmDelete, setConfirmDelete] = useState({ open: false, path: null });
    const [inlineMessage, setInlineMessage] = useState('');
    const [attachmentViewer, setAttachmentViewer] = useState(null);
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);
    const [folderUploads, setFolderUploads] = useState([]);
    const [expandedFolders, setExpandedFolders] = useState({});

    const isEditMode = !!eventData;

    const formatError = (e) => {
        if (!e) return '';
        if (typeof e === 'string') return e;
        if (e && typeof e === 'object') return e.message || JSON.stringify(e);
        try { return String(e); } catch (ex) { return 'Đã có lỗi.'; }
    };

    useEffect(() => {
        if (!isOpen) return;
        if (isEditMode) {
            setFormData({
                title: eventData.title || '',
                start_time: eventData.start_time ? new Date(eventData.start_time).toISOString().slice(0, 16) : '',
                end_time: eventData.end_time ? new Date(eventData.end_time).toISOString().slice(0, 16) : '',
                description: eventData.description || '',
                location: eventData.location || ''
            });
            let att = [];
            try {
                if (eventData.attachment_path) {
                    if (typeof eventData.attachment_path === 'string') {
                        att = JSON.parse(eventData.attachment_path);
                        if (!Array.isArray(att)) att = [eventData.attachment_path];
                    } else if (Array.isArray(eventData.attachment_path)) att = eventData.attachment_path;
                }
            } catch (e) { att = [eventData.attachment_path]; }
            setExistingAttachments(att || []);
        } else {
            const ds = new Date(selectedDate || Date.now());
            const snapped = snapToNearestMinutes(ds, 15);
            const endDefault = new Date(snapped.getTime() + 60 * 60 * 1000);
            setFormData({ title: '', start_time: snapped.toISOString().slice(0, 16), end_time: endDefault.toISOString().slice(0, 16), description: '', location: '' });
            setExistingAttachments([]);
            setSelectedFiles([]);
        }
    }, [isOpen, isEditMode, eventData, selectedDate]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const validateAndAddFiles = (filesList) => {
        const allowed = { pdf: 50 * 1024 * 1024, docx: 20 * 1024 * 1024, xlsx: 20 * 1024 * 1024, jpg: 10 * 1024 * 1024, jpeg: 10 * 1024 * 1024, png: 10 * 1024 * 1024, gif: 10 * 1024 * 1024, bmp: 10 * 1024 * 1024, webp: 10 * 1024 * 1024 };
        const newOnes = [];
        const limitsText = 'PDF < 50MB / Word (.docx), Excel (.xlsx) < 20MB / Hình ảnh < 10MB';
        for (const f of Array.from(filesList)) {
            const name = f.name || '';
            const ext = (name.split('.').pop() || '').toLowerCase();
            const limit = allowed[ext] || 10 * 1024 * 1024;
            if (f.size > limit) { setError(`Tệp ${name} quá lớn (tối đa ${(limit / 1024 / 1024).toFixed(0)}MB). ${limitsText}`); continue; }
            if (!['pdf', 'docx', 'xlsx', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) { setError(`Loại tệp không được hỗ trợ: ${name}`); continue; }
            newOnes.push(f);
        }
        if (newOnes.length > 0) setSelectedFiles(prev => prev.concat(newOnes));
    };

    const onFileInputChange = (e) => { const files = e.target.files; if (!files || files.length === 0) return; validateAndAddFiles(files); e.target.value = ''; };
    const removeSelectedFile = (index) => setSelectedFiles(prev => prev.filter((_, i) => i !== index));

    const onFolderInputChange = (e) => {
        const filesArr = Array.from(e.target.files || []);
        if (filesArr.length === 0) { e.target.value = ''; return; }
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
        e.target.value = '';
    };

    const deleteExistingAttachment = async (path) => {
        setLoading(true); setInlineMessage('');
        try {
            const fd = new FormData(); fd.append('deleted_files', JSON.stringify([path]));
            await apiService.updateEvent(eventData.id, fd);
            setExistingAttachments(prev => prev.filter(p => p !== path));
            setInlineMessage(`Đã xóa file ${path.split('/').pop()} thành công!`);
            setTimeout(() => setInlineMessage(''), 4000);
        } catch (e) { setError(e || 'Lỗi khi xóa tệp.'); } finally { setLoading(false); }
    };

    const handleDelete = () => { if (!isEditMode || !eventData) return; setConfirmDeleteEvent({ open: true }); };
    const performDelete = async () => { if (!isEditMode || !eventData) return; setLoading(true); setError(''); try { await apiService.deleteEvent(eventData.id); onSuccess(); onClose(); } catch (err) { setError(err || 'Đã xảy ra lỗi khi xóa.'); } finally { setLoading(false); } };

    const handleSubmit = async (e) => {
        e.preventDefault(); setLoading(true); setError('');
        try {
            const hasFiles = (selectedFiles && selectedFiles.length > 0) || (folderUploads && folderUploads.length > 0);

            if (hasFiles || isEditMode) {
                const fd = new FormData();
                fd.append('title', formData.title);
                fd.append('start_time', new Date(formData.start_time).toISOString());
                if (formData.end_time) fd.append('end_time', new Date(formData.end_time).toISOString());
                fd.append('description', formData.description || '');
                fd.append('location', formData.location || '');

                // append single-file selections
                if (selectedFiles && selectedFiles.length > 0) {
                    selectedFiles.forEach(f => fd.append('attachments', f));
                }

                // append folder uploads (preserve relative paths when available)
                if (folderUploads && folderUploads.length > 0) {
                    for (const folder of folderUploads) {
                        for (const f of folder.files) {
                            fd.append('attachments', f);
                            if (f.webkitRelativePath) fd.append('attachments_relative_paths[]', f.webkitRelativePath);
                        }
                    }
                }

                // if editing, check for removed existing attachments and inform backend
                if (isEditMode && eventData && eventData.attachment_path) {
                    try {
                        const orig = typeof eventData.attachment_path === 'string' ? JSON.parse(eventData.attachment_path) : eventData.attachment_path;
                        const origArr = Array.isArray(orig) ? orig : (orig ? [orig] : []);
                        const removed = origArr.filter(p => !existingAttachments.includes(p));
                        if (removed.length > 0) fd.append('deleted_files', JSON.stringify(removed));
                    } catch (e) {
                        if (eventData.attachment_path && existingAttachments.length === 0) fd.append('deleted_files', JSON.stringify([eventData.attachment_path]));
                    }
                }

                if (isEditMode) await apiService.updateEvent(eventData.id, fd); else await apiService.createEvent(fd);
            } else {
                // no files and not editing: simple payload
                if (isEditMode) await apiService.updateEvent(eventData.id, formData); else await apiService.createEvent(formData);
            }

            onSuccess(); onClose();
        } catch (err) { setError(err || 'Đã xảy ra lỗi. Vui lòng thử lại.'); } finally { setLoading(false); }
    };

    if (!isOpen) return null;

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg" className="p-6" coverHeader={true}>
            <div className="bg-white rounded-lg w-full">
                <div className="flex justify-between items-center pb-4 border-b px-4 sm:px-6">
                    <h2 className="text-xl font-bold mb-4 sticky top-0 bg-white z-10">{isEditMode ? 'Chỉnh sửa Sự kiện' : 'Thêm lịch mới'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X /></button>
                </div>
                <div className="p-6">
                    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                        {error && <p className="text-red-500 bg-red-50 p-2 rounded-md text-sm mb-4">{formatError(error)}</p>}

                        <div>
                            <label className="block text-sm font-medium text-slate-700">Tiêu đề sự kiện</label>
                            <input name="title" value={formData.title} onChange={handleChange} required className="mt-1 input-style no-native-arrows" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Bắt đầu</label>
                                <input name="start_time" type="datetime-local" value={formData.start_time} onChange={handleChange} required className="mt-1 input-style no-native-arrows" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Kết thúc (tùy chọn)</label>
                                <input name="end_time" type="datetime-local" value={formData.end_time} onChange={handleChange} className="mt-1 input-style no-native-arrows" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700">Địa điểm (tùy chọn)</label>
                            <input name="location" value={formData.location} onChange={handleChange} className="mt-1 input-style no-native-arrows" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700">Mô tả (tùy chọn)</label>
                            <textarea name="description" value={formData.description} onChange={handleChange} rows="3" className="mt-1 input-style no-native-arrows" />
                        </div>

                        <div>
                            <div className="flex items-center gap-3">
                                <label className="block text-sm font-medium text-slate-700 whitespace-nowrap">&nbsp;</label>
                                <div className="flex items-center gap-3 w-full">
                                    <label htmlFor="attachments" className="inline-flex items-center whitespace-nowrap px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">Chọn tệp</label>
                                    <input id="attachments" ref={fileInputRef} type="file" accept=".pdf,.docx,.xlsx,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple onChange={onFileInputChange} className="hidden" />
                                    <button type="button" onClick={() => folderInputRef.current && folderInputRef.current.click()} className="inline-flex items-center whitespace-nowrap px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50">Chọn thư mục</button>
                                    <input ref={folderInputRef} type="file" webkitdirectory="true" directory="true" onChange={onFolderInputChange} className="hidden" />
                                    <div className="text-xs text-slate-400 truncate ml-2 min-w-0">Chọn tệp hoặc thư mục</div>
                                </div>
                            </div>

                            <div className="mt-2">
                                {selectedFiles.length > 0 && (
                                    <ul className="space-y-1">
                                        {selectedFiles.map((f, i) => (
                                            <li key={i} className="flex items-center justify-between text-sm text-slate-700 bg-slate-50 p-2 rounded">
                                                <span className="truncate">{f.name}</span>
                                                <button type="button" onClick={() => removeSelectedFile(i)} className="text-red-500 text-xs">Xóa</button>
                                            </li>
                                        ))}
                                    </ul>
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
                                                        <button type="button" onClick={()=>setExpandedFolders(prev=>({...prev, [folder.name]: true}))} className="text-sm text-cyan-600">Mở thư mục</button>
                                                        <button type="button" onClick={()=>setFolderUploads(prev=>prev.filter((_,i)=>i!==fi))} className="text-red-500 text-xs">Xóa thư mục</button>
                                                    </div>
                                                </div>
                                                {expandedFolders[folder.name] && (
                                                    <div className="mt-2 space-y-1">
                                                        {folder.files.map((f, idx) => (
                                                            <div key={idx} className="flex items-center justify-between text-sm text-slate-600">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="truncate max-w-[60%]">{f.webkitRelativePath || f.name}</span>
                                                                    <button type="button" onClick={()=>{
                                                                        setFolderUploads(prev=>{
                                                                            const copy = JSON.parse(JSON.stringify(prev));
                                                                            const target = copy[fi];
                                                                            if (!target) return prev;
                                                                            target.files = target.files.filter((_,i)=>i!==idx);
                                                                            target.totalSize = target.files.reduce((s,ff)=>s+(Number(ff.size||0)),0);
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

                                {existingAttachments.length > 0 && (
                                    <div className="mt-2">
                                        <div className="text-sm text-slate-600 mb-1">Tệp đã tải lên</div>
                                        <ul className="space-y-1">
                                            {existingAttachments.map((p, i) => (
                                                <li key={i} className="flex items-center justify-between text-sm text-slate-700 bg-white p-2 rounded">
                                                    <button type="button" onClick={() => setAttachmentViewer({ file_path: p, file_name: p.split('/').pop() })} className="text-blue-600 text-left truncate max-w-[70%]">{p.split('/').pop()}</button>
                                                    <button type="button" onClick={() => setConfirmDelete({ open: true, path: p })} className="text-red-500 text-xs">Xóa</button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                        </div>

                        <div className="pt-4 border-t mt-6">
                            {isEditMode && (
                                <div className="mb-3">
                                    <button type="button" onClick={handleDelete} disabled={loading} className="btn-danger mr-2 inline-flex items-center gap-2">
                                        <Trash2 size={16} />
                                        <span>{loading ? 'Đang xóa...' : 'Xóa'}</span>
                                    </button>

                                    {confirmDeleteEvent.open && (
                                        <ModalWrapper isOpen={true} onClose={() => setConfirmDeleteEvent({ open: false })} maxWidth="max-w-md">
                                            <div className="p-6">
                                                <h3 className="text-lg font-semibold mb-4">Xác nhận xóa lịch</h3>
                                                <p className="text-sm text-slate-700 mb-4">Bạn có chắc muốn xóa lịch <strong>{formData.title || (eventData && eventData.title) || ''}</strong>? Hành động này sẽ lưu trữ lịch và tệp đính kèm liên quan.</p>
                                                <div className="flex justify-end gap-2">
                                                    <button type="button" className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setConfirmDeleteEvent({ open: false })}>Hủy</button>
                                                    <button type="button" className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-sm font-medium text-white hover:bg-red-700" onClick={async () => { await performDelete(); setConfirmDeleteEvent({ open: false }); }}>{loading ? 'Đang xóa...' : 'Xóa'}</button>
                                                </div>
                                            </div>
                                        </ModalWrapper>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-end">
                                <button type="button" onClick={onClose} className="btn-secondary mr-2">Hủy</button>
                                <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Đang lưu...' : 'Lưu sự kiện'}</button>
                            </div>
                        </div>
                    </form>

                    {attachmentViewer && <AttachmentViewerModal attachment={attachmentViewer} onClose={() => setAttachmentViewer(null)} />}

                    {confirmDelete.open && (
                        <ModalWrapper isOpen={true} onClose={() => setConfirmDelete({ open: false, path: null })} maxWidth="max-w-md">
                            <div className="p-6">
                                <h3 className="text-lg font-semibold mb-4">Xác nhận xóa tệp</h3>
                                <p className="text-sm text-slate-700 mb-4">Bạn có chắc muốn xóa tệp <strong className="break-all">{String(confirmDelete.path).split('/').pop()}</strong>?</p>
                                <div className="flex justify-end gap-2">
                                    <button type="button" className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setConfirmDelete({ open: false, path: null })}>Hủy</button>
                                        <button type="button" className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-sm font-medium text-white hover:bg-red-700" onClick={async () => { await deleteExistingAttachment(confirmDelete.path); }}>Xóa</button>
                                </div>
                            </div>
                        </ModalWrapper>
                    )}

                    {inlineMessage && <div className="mt-2 text-sm text-green-600">{inlineMessage}</div>}

                </div>
            </div>
        </ModalWrapper>
    );
};

export default EventModal;