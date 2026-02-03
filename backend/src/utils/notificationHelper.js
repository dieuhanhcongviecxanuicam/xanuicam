// ubndxanuicam/backend/src/utils/notificationHelper.js
// VERSION 2.0 - NEW HELPER FOR CENTRALIZED NOTIFICATIONS

/**
 * @description Hàm helper để tạo thông báo mới một cách tập trung.
 * @param {object} client - PG client cho transaction.
 * @param {number} userId - ID của người nhận thông báo.
 * @param {string} message - Nội dung thông báo.
 * @param {string} [link=null] - Đường dẫn tương đối để người dùng nhấp vào.
 */
const createNotification = async (client, userId, message, link = null) => {
    // Không gửi thông báo cho người dùng không tồn tại
    if (!userId) return;
    try {
        await client.query(
            'INSERT INTO notifications (user_id, message, link) VALUES ($1, $2, $3)',
            [userId, message, link]
        );
    } catch (error) {
        // Ghi log lỗi ra console nhưng không làm gián đoạn luồng chính
        console.error("Lỗi khi tạo thông báo:", error);
    }
};

module.exports = {
    createNotification,
};