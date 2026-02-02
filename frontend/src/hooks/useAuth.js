// ubndxanuicam/frontend/src/hooks/useAuth.js
import { useContext } from 'react';
import AuthContext from '../context/AuthContext';

/**
 * @description Hook tùy chỉnh để truy cập AuthContext một cách dễ dàng.
 * Thay vì phải import useContext và AuthContext trong mỗi component,
 * chúng ta chỉ cần gọi hook này.
 * @returns {object} - Toàn bộ giá trị của AuthContext (user, login, logout, etc.).
 */
const useAuth = () => {
    return useContext(AuthContext);
};

export default useAuth;