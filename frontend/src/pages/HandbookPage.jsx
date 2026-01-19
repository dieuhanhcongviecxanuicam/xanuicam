// ubndxanuicam/frontend/src/pages/HandbookPage.jsx
// VERSION 2.1 - ADDED EDIT FUNCTIONALITY

import React, { useState, useEffect, useCallback } from 'react';
import useAuth from '../hooks/useAuth';
import { BookOpen, Plus, Clock, User } from 'lucide-react';
import apiService from '../services/apiService';
import { formatDate } from '../utils/formatDate';
import Spinner from '../components/common/Spinner';
import ArticleModal from '../components/articles/ArticleModal';
import ArticleDetailModal from '../components/articles/ArticleDetailModal';
import Notification from '../components/common/Notification';

const HandbookPage = () => {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalState, setModalState] = useState({ viewId: null, editId: null, isCreating: false });
    const { hasPermission } = useAuth();
    const [notification, setNotification] = useState({ message: '', type: '' });

    const canManageArticles = hasPermission(['article_management']);

    const fetchArticles = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiService.getArticlesByCategory('handbook');
            setArticles(data);
        } catch (error) {
            setNotification({ message: 'Không thể tải dữ liệu cẩm nang.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchArticles();
    }, [fetchArticles]);

    const handleSuccess = () => {
        fetchArticles();
        setNotification({ message: 'Thao tác thành công!', type: 'success' });
        closeModals();
    }

    const closeModals = () => {
        setModalState({ viewId: null, editId: null, isCreating: false });
    };

    const handleEdit = (articleId) => {
        setModalState({ viewId: null, editId: articleId, isCreating: false });
    };

    return (
        <>
            <Notification 
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ message: '', type: '' })}
            />
            {canManageArticles && (
                 <ArticleModal 
                    isOpen={modalState.isCreating || modalState.editId !== null}
                    onClose={closeModals}
                    onSuccess={handleSuccess}
                    category="handbook"
                    articleId={modalState.editId}
                />
            )}
            {modalState.viewId && (
                <ArticleDetailModal 
                    articleId={modalState.viewId}
                    onClose={closeModals}
                    onEdit={handleEdit}
                />
            )}
            <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div className="flex items-center">
                        <BookOpen className="w-8 h-8 text-blue-600 mr-4" />
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800">Cẩm nang sử dụng</h1>
                            <p className="mt-1 text-slate-500">Tài liệu hướng dẫn, quy trình và các thông tin cần thiết.</p>
                        </div>
                    </div>
                    {canManageArticles && (
                        <button onClick={() => setModalState({ ...modalState, isCreating: true })} className="btn-primary">
                            <Plus size={20} className="mr-2"/>
                            Đăng bài mới
                        </button>
                    )}
                </div>
                
                <div className="bg-white p-4 rounded-lg shadow-lg">
                    {loading ? (
                        <div className="flex justify-center items-center py-20"><Spinner /></div>
                    ) : articles.length > 0 ? (
                        <ul className="divide-y divide-slate-200">
                            {articles.map(article => (
                                <li key={article.id} onClick={() => setModalState({ ...modalState, viewId: article.id })} className="p-4 hover:bg-slate-50 cursor-pointer transition-colors duration-200">
                                    <h3 className="font-semibold text-lg text-slate-800 hover:text-blue-600">{article.title}</h3>
                                    <div className="flex items-center text-sm text-slate-500 mt-2 space-x-4">
                                        <div className="flex items-center">
                                            <User size={14} className="mr-1.5"/>
                                            <span>{article.author_name}</span>
                                        </div>
                                        <div className="flex items-center">
                                            <Clock size={14} className="mr-1.5"/>
                                            <span>{formatDate(article.created_at)}</span>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center py-20 text-slate-500">Chưa có bài viết nào trong mục Cẩm nang.</p>
                    )}
                </div>
            </div>
        </>
    );
};

export default HandbookPage;