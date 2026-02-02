// ubndxanuicam/frontend/src/utils/formatDate.js
import { format, formatDistanceToNow, isValid } from 'date-fns';
import { vi } from 'date-fns/locale';

/**
 * @description Kiểm tra xem một giá trị có phải là ngày hợp lệ hay không.
 * @param {Date|string|number} dateInput - Dữ liệu ngày cần kiểm tra.
 * @returns {Date|null} - Trả về đối tượng Date nếu hợp lệ, ngược lại trả về null.
 */
const parseDate = (dateInput) => {
    if (!dateInput) return null;
    const date = new Date(dateInput);
    return isValid(date) ? date : null;
};

/**
 * @description Định dạng ngày tháng sang dạng "dd/MM/yyyy".
 * @param {Date|string|number} dateInput - Ngày cần định dạng.
 * @returns {string} - Chuỗi ngày đã định dạng hoặc chuỗi rỗng nếu ngày không hợp lệ.
 */
export const formatDate = (dateInput) => {
    const date = parseDate(dateInput);
    if (!date) return '';
    return format(date, 'dd/MM/yyyy', { locale: vi });
};

/**
 * @description Định dạng ngày tháng và thời gian sang dạng "HH:mm, dd/MM/yyyy".
 * @param {Date|string|number} dateInput - Ngày cần định dạng.
 * @returns {string} - Chuỗi ngày giờ đã định dạng hoặc chuỗi rỗng.
 */
export const formatDateTime = (dateInput) => {
    const date = parseDate(dateInput);
    if (!date) return '';
    return format(date, 'HH:mm, dd/MM/yyyy', { locale: vi });
};

/**
 * @description Chuyển đổi ngày tháng thành chuỗi thời gian tương đối (ví dụ: "khoảng 2 giờ trước").
 * @param {Date|string|number} dateInput - Ngày cần chuyển đổi.
 * @returns {string} - Chuỗi thời gian tương đối hoặc chuỗi rỗng.
 */
export const formatTimeAgo = (dateInput) => {
    const date = parseDate(dateInput);
    if (!date) return '';
    return formatDistanceToNow(date, { addSuffix: true, locale: vi });
};