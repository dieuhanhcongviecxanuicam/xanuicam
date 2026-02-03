// ubndxanuicam/frontend/src/components/articles/ArticleDetailModal.jsx
// VERSION 2.0 - ADDED EDIT BUTTON

import React, { useState, useCallback, useEffect } from 'react';
import apiService from '../../services/apiService';
import useAuth from '../../hooks/useAuth';
import { User, Clock, Paperclip, Download, Edit } from 'lucide-react';
import Spinner from '../common/Spinner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import AttachmentViewerModal from '../common/AttachmentViewerModal';
import ModalWrapper from '../common/ModalWrapper';

const ArticleDetailModal = ({ articleId, onClose, onEdit }) => {
    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedAttachment, setSelectedAttachment] = useState(null);
    const { hasPermission } = useAuth();
    const canManageArticles = hasPermission(['article_management']);
    const BACKEND_URL = process.env.REACT_APP_API_BASE_URL.replace('/api', '');

    const fetchArticle = useCallback(async () => {
        if (!articleId) return;
        setLoading(true);
        try {
            const res = await apiService.getArticleById(articleId);
            setArticle(res);
        } catch (error) {
            console.error("Lỗi khi tải chi tiết bài viết:", error);
        } finally {
            setLoading(false);
        }
    }, [articleId]);

    useEffect(() => {
        fetchArticle();
    }, [fetchArticle]);

    return (
        <>
            <ModalWrapper isOpen={!!articleId} onClose={onClose} maxWidth="max-w-3xl" className="max-h-[90vh] p-0">
                <div className="bg-white rounded-lg shadow-xl w-full max-h-[90vh] flex flex-col">
                    <div className="flex justify-between items-center p-4 border-b">
                        <h2 className="text-xl font-bold text-slate-800">Chi tiết bài viết</h2>
                        <div>
                            {canManageArticles && (
                                <button onClick={() => onEdit(articleId)} className="btn-secondary mr-2">
                                    <Edit size={16} className="mr-2"/> Chỉnh sửa
                                </button>
                            )}
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                                Đóng
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto p-6">
                        {loading ? <div className="flex justify-center items-center h-full"><Spinner /></div> : article ? (
                            <>
                                <h1 className="text-2xl font-bold text-slate-900">{article.title}</h1>
                                <div className="flex items-center text-sm text-slate-500 mt-2 mb-4 space-x-4">
                                    <div className="flex items-center">
                                        <User size={14} className="mr-1.5"/>
                                        <span>{article.author_name}</span>
                                    </div>
                                    <div className="flex items-center">
                                        <Clock size={14} className="mr-1.5"/>
                                        <span>{format(new Date(article.created_at), 'dd/MM/yyyy', { locale: vi })}</span>
                                    </div>
                                </div>

                                <div className="prose max-w-none text-slate-700 whitespace-pre-wrap">
                                    {article.content}
                                </div>

                                {article.attachments && article.attachments.length > 0 && (
                                    <div className="mt-6">
                                        <h3 className="font-semibold mb-2 flex items-center"><Paperclip size={16} className="mr-2"/> Tệp đính kèm</h3>
                                        <div className="space-y-2">
                                            {article.attachments.map(file => (
                                                <div key={file.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-md">
                                                    <button 
                                                        onClick={() => setSelectedAttachment(file)}
                                                        className="text-blue-600 text-sm hover:underline text-left"
                                                    >
                                                        {file.file_name}
                                                    </button>
                                                    <a 
                                                        href={`${BACKEND_URL}/${file.file_path}`} 
                                                        download={file.file_name} 
                                                        className="p-2 text-slate-500 hover:text-slate-800"
                                                        aria-label="Tải xuống"
                                                    >
                                                        <Download size={16} />
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p>Không thể tải được nội dung bài viết.</p>
                        )}
                    </div>
                </div>
                </ModalWrapper>

                <AttachmentViewerModal
                    attachment={selectedAttachment}
                    onClose={() => setSelectedAttachment(null)}
                />
        </>
    );
};

export default ArticleDetailModal;