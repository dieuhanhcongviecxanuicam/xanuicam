// ubndxanuicam/frontend/src/components/articles/ArticleModal.jsx
// VERSION 2.1 - FIXED CREATE MODE BUG

import React, { useState, useEffect } from 'react';
import apiService from '../../services/apiService';
import { UploadCloud, FileText, Trash2 } from 'lucide-react';
import Spinner from '../common/Spinner';
import ModalWrapper from '../common/ModalWrapper';

const ArticleModal = ({ isOpen, onClose, onSuccess, category, articleId }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [files, setFiles] = useState([]);
    const [existingFiles, setExistingFiles] = useState([]);
    const [deletedFileIds, setDeletedFileIds] = useState([]);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isEditMode = articleId != null;

    // SỬA LỖI: Tách logic xử lý khi modal mở/đóng và khi chỉnh sửa
    useEffect(() => {
        // Nếu modal không được mở, reset toàn bộ trạng thái để chuẩn bị cho lần mở tiếp theo
        if (!isOpen) {
            setTitle('');
            setContent('');
            setFiles([]);
            setExistingFiles([]);
            setDeletedFileIds([]);
            setError('');
            setLoading(false);
            return;
        }

        // Nếu mở ở chế độ chỉnh sửa, tải dữ liệu bài viết
        if (isEditMode) {
            const fetchArticleData = async () => {
                setLoading(true);
                try {
                    const data = await apiService.getArticleById(articleId);
                    setTitle(data.title);
                    setContent(data.content);
                    setExistingFiles(data.attachments || []);
                } catch (err) {
                    setError('Không thể tải dữ liệu bài viết.');
                } finally {
                    setLoading(false);
                }
            };
            fetchArticleData();
        }
    }, [isOpen, isEditMode, articleId]);

    const handleFileChange = (e) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files)]);
        }
    };
    
    const removeNewFile = (fileName) => {
        setFiles(prev => prev.filter(file => file.name !== fileName));
    };

    const removeExistingFile = (fileId) => {
        setExistingFiles(prev => prev.filter(file => file.id !== fileId));
        setDeletedFileIds(prev => [...prev, fileId]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);

        try {
            if (isEditMode) {
                files.forEach(file => formData.append('attachments', file));
                formData.append('deleted_attachments', JSON.stringify(deletedFileIds));
                await apiService.updateArticle(articleId, formData);
            } else {
                formData.append('category', category);
                files.forEach(file => formData.append('attachments', file));
                await apiService.createArticle(formData);
            }
            onSuccess();
            // onClose() sẽ được gọi trong hàm onSuccess của component cha
        } catch (err) {
            setError(err || 'Thao tác thất bại. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-3xl">
            <div className="p-6 w-full flex flex-col max-h-[90vh]">
                <h2 className="text-xl font-bold mb-6">
                    {isEditMode ? 'Chỉnh sửa bài viết' : `Đăng bài mới vào mục "${category === 'handbook' ? 'Cẩm nang' : 'Truyền thông'}"`}
                </h2>
                <form onSubmit={handleSubmit} className="flex-grow flex flex-col overflow-hidden">
                    {loading && !title ? <Spinner /> : (
                        <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                            {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Tiêu đề</label>
                                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1 input-style" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Nội dung</label>
                                <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows="10" className="mt-1 input-style" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Tệp đính kèm</label>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md">
                                    <div className="space-y-1 text-center">
                                        <UploadCloud className="mx-auto h-12 w-12 text-slate-400" />
                                        <div className="flex text-sm text-slate-600">
                                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">
                                                <span>Tải lên tệp tin mới</span>
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple onChange={handleFileChange} />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {(existingFiles.length > 0 || files.length > 0) && (
                                <div className="space-y-2">
                                    {existingFiles.length > 0 && <h4 className="font-medium text-sm">Các tệp hiện có:</h4>}
                                    {existingFiles.map(file => (
                                        <div key={file.id} className="flex items-center justify-between bg-slate-100 p-2 rounded">
                                            <div className="flex items-center text-sm"><FileText size={16} className="mr-2 text-slate-500"/><span>{file.file_name}</span></div>
                                            <button type="button" onClick={() => removeExistingFile(file.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                    {files.length > 0 && <h4 className="font-medium text-sm mt-2">Các tệp mới tải lên:</h4>}
                                    {files.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between bg-blue-50 p-2 rounded">
                                            <div className="flex items-center text-sm"><FileText size={16} className="mr-2 text-blue-500"/><span>{file.name}</span></div>
                                            <button type="button" onClick={() => removeNewFile(file.name)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex justify-end space-x-3 pt-4 border-t mt-6 flex-shrink-0">
                        <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? 'Đang lưu...' : isEditMode ? 'Lưu thay đổi' : 'Đăng bài'}
                        </button>
                    </div>
                </form>
            </div>
        </ModalWrapper>
    );
};

export default ArticleModal;