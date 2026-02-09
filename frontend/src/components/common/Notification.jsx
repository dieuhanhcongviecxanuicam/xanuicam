// ubndxanuicam/frontend/src/components/common/Notification.jsx
import React, { useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';

const Notification = ({ message, type, onClose }) => {
    const [visible, setVisible] = useState(false);

    const handleClose = useCallback(() => {
        setVisible(false);
        // Delay việc gọi onClose để animation kịp chạy
        setTimeout(() => onClose(), 300);
    }, [onClose]);

    React.useEffect(() => {
        if (message) {
            setVisible(true);
            const timer = setTimeout(() => {
                handleClose();
            }, 5000); // Tự động đóng sau 5 giây
            return () => clearTimeout(timer);
        }
    }, [message, type, handleClose]);
    
    if (!message) return null;

    const displayMessage = typeof message === 'string' ? message : (message && (message.message || message.error || message.msg)) || JSON.stringify(message);

    const isSuccess = type === 'success';
    const bgColor = isSuccess ? 'bg-green-500' : 'bg-red-500';
    const Icon = isSuccess ? CheckCircle : AlertTriangle;

    return (
        <div className={`fixed top-5 right-5 z-[100] transition-transform duration-300 ${visible ? 'translate-x-0' : 'translate-x-[120%]'}`}>
            <div className={`flex items-center text-white rounded-md shadow-lg p-4 ${bgColor}`}>
                <Icon className="w-6 h-6 mr-3" />
                <p className="text-sm font-medium">{displayMessage}</p>
                <button onClick={handleClose} className="ml-4 p-1 rounded-full hover:bg-black/20">
                    <X size={18} />
                </button>
            </div>
        </div>
    );
};

export default Notification;