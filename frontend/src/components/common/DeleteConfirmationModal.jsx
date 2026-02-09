import React from 'react';
import { AlertTriangle } from 'lucide-react';
import ModalWrapper from './ModalWrapper';

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    const handleConfirm = async () => {
        try {
            await onConfirm();
        } catch (error) {
            // Có thể hiển thị lỗi ở đây nếu cần
            console.error("Lỗi khi thực hiện hành động xóa:", error);
        } finally {
            onClose();
        }
    };

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-md" className="p-6 sm:p-8">
                <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                        <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">{title}</h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-500">{message}</p>
                        </div>
                    </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 sm:w-auto sm:text-sm"
                        onClick={handleConfirm}
                    >
                        Xác nhận Xóa
                    </button>
                    <button
                        type="button"
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:w-auto sm:text-sm"
                        onClick={onClose}
                    >
                        Hủy
                    </button>
                </div>
        </ModalWrapper>
    );
};

export default DeleteConfirmationModal;