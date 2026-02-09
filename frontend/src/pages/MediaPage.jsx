// ubndxanuicam/frontend/src/pages/MediaPage.jsx
// VERSION 2.1 - ADDED EDIT FUNCTIONALITY

import React, { useState, useEffect, useCallback } from 'react';
import useAuth from '../hooks/useAuth';
import { Megaphone, Plus, Clock, User } from 'lucide-react';
import apiService from '../services/apiService';
import { formatDate } from '../utils/formatDate';
import Spinner from '../components/common/Spinner';
import ArticleModal from '../components/articles/ArticleModal';
import ArticleDetailModal from '../components/articles/ArticleDetailModal';
import Notification from '../components/common/Notification';

const MediaPage = () => {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    // NÂNG CẤP: Quản lý trạng thái modal một cách tập trung
    const [modalState, setModalState] = useState({ viewId: null, editId: null, isCreating: false });
    const { hasPermission } = useAuth();
    const [notification, setNotification] = useState({ message: '', type: '' });

    const canManageArticles = hasPermission(['article_management']);

    const fetchArticles = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiService.getArticlesByCategory('media');
            setArticles(data);
        } catch (error) {
            console.error("Lỗi khi tải tin tức:", error);
            setNotification({ message: 'Không thể tải dữ liệu truyền thông.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchArticles();
    }, [fetchArticles]);

    // Hàm đóng tất cả các modal và làm mới dữ liệu
    const handleSuccess = () => {
        fetchArticles();
        setNotification({ message: 'Thao tác thành công!', type: 'success' });
        closeModals();
    }

    // Hàm đóng tất cả các modal
    const closeModals = () => {
        setModalState({ viewId: null, editId: null, isCreating: false });
    };

    // Hàm được gọi khi người dùng nhấn nút "Chỉnh sửa" từ modal chi tiết
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
                    category="media"
                    articleId={modalState.editId}
                />
            )}
            {modalState.viewId && (
                <ArticleDetailModal 
                    articleId={modalState.viewId}
                    onClose={closeModals}
                    onEdit={handleEdit} // SỬA LỖI: Truyền hàm handleEdit vào component
                />
            )}
            <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div className="flex items-center">
                        <Megaphone className="w-8 h-8 text-green-600 mr-4" />
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800">Thông tin truyền thông</h1>
                            <p className="mt-1 text-slate-500">Các thông báo, tin tức và hoạt động của đơn vị.</p>
                        </div>
                    </div>
                    {canManageArticles && (
                        <button onClick={() => setModalState({ ...modalState, isCreating: true })} className="btn-primary">
                            <Plus size={20} className="mr-2"/>
                            Đăng tin mới
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
                        <p className="text-center py-20 text-slate-500">Chưa có tin tức nào được đăng tải.</p>
                    )}
                </div>
            </div>
        </>
    );
};

export default MediaPage;