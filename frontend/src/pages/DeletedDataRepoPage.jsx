import React, { useEffect, useState } from 'react';
import apiService from '../services/apiService';
import useAuth from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const DeletedDataRepoPage = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            try {
                const data = await apiService.getDeletedArticles({ limit: 500 });
                setItems(Array.isArray(data) ? data : []);
            } catch (e) {
                setError(e && e.message ? e.message : 'Không thể tải danh sách bài viết đã xóa.');
            } finally { setLoading(false); }
        };
        fetch();
    }, []);

    const handleRestore = async (id) => {
        if (!window.confirm('Khôi phục bài viết này?')) return;
        try {
            await apiService.restoreDeletedArticle(id);
            setItems(prev => prev.filter(i => i.id !== id));
            alert('Khôi phục thành công.');
        } catch (e) {
            alert((e && e.message) || 'Khôi phục thất bại');
        }
    };

    if (!user || !(Array.isArray(user.permissions) && (user.permissions.includes('article_management') || user.permissions.includes('full_access')))) {
        return <div className="p-6">Bạn không có quyền truy cập trang này.</div>;
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold">Bài viết đã xóa - Kho dữ liệu số</h1>
                <div>
                    <button onClick={() => navigate('/data-repo')} className="btn">Quay lại Kho dữ liệu số</button>
                </div>
            </div>
            {loading ? <p>Đang tải...</p> : (
                <>
                    {error && <p className="text-red-500">{error}</p>}
                    <div className="overflow-auto bg-white rounded shadow p-4">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left">
                                    <th>ID</th>
                                    <th>Tiêu đề</th>
                                    <th>Tác giả</th>
                                    <th>Thời gian</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(it => (
                                    <tr key={it.id} className="border-t">
                                        <td>{it.id}</td>
                                        <td className="truncate max-w-xs">{it.title}</td>
                                        <td>{it.author_name || it.deleted_by_name}</td>
                                        <td>{it.deleted_at ? new Date(it.deleted_at).toLocaleString() : ''}</td>
                                        <td><button onClick={()=>handleRestore(it.id)} className="text-sm bg-green-600 text-white px-2 py-1 rounded">Khôi phục</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};

export default DeletedDataRepoPage;
