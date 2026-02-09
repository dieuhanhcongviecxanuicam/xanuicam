// ubndxanuicam/frontend/src/components/common/Pagination.jsx
import React from 'react';
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';

const Pagination = ({ currentPage, totalPages, onPageChange, perPage = 10, onPerPageChange, perPageOptions = [10,20,50,100], summary = null, summaryLabel = 'Số lượng tài khoản', useTextButtons = false, showPerPageLabel = false }) => {

    const handlePageChange = (page) => {
        if (page < 1 || page > totalPages) return;
        onPageChange(page);
    };

    return (
        <div className="flex justify-between items-center mt-4 text-sm text-slate-600">
            <div className="flex items-center gap-3">
                {onPerPageChange && (
                    <div className="flex items-center gap-2">
                        {showPerPageLabel && <span className="text-sm text-slate-600">Hiển thị</span>}
                        <select value={perPage} onChange={(e) => onPerPageChange(parseInt(e.target.value,10))} className="input-style px-2 py-1">
                            {perPageOptions.map(o => <option key={o} value={o}>{o} b/c</option>)}
                        </select>
                    </div>
                )}
                {summary && (
                    <p className="text-sm text-slate-600">
                        {summaryLabel}: <span className="font-bold">{summary.total || 0}</span>
                    </p>
                )}
                <p>
                    Trang <span className="font-bold">{currentPage}</span> / <span className="font-bold">{totalPages}</span>
                </p>
            </div>
            <div className="flex items-center gap-1">
                {useTextButtons ? (
                    <>
                        <button className="btn-secondary px-3 py-1" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>Trước</button>
                        <button className="btn-secondary px-3 py-1" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>Tiếp</button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => handlePageChange(1)}
                            disabled={currentPage === 1}
                            className="p-2 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Trang đầu"
                        >
                            <ChevronsLeft size={16} />
                        </button>
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="p-2 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Trang trước"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Trang sau"
                        >
                            <ChevronRight size={16} />
                        </button>
                        <button
                            onClick={() => handlePageChange(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Trang cuối"
                        >
                            <ChevronsRight size={16} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default Pagination;