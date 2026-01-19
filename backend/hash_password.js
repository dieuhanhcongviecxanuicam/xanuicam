/**
 * File: hash_password.js
 * Description: Một script tiện ích dùng trên command-line để tạo chuỗi hash
 * cho mật khẩu bằng bcrypt.
 * Usage: node hash_password.js <YourPasswordHere>
 */

const bcrypt = require('bcryptjs');

// Lấy mật khẩu từ đối số dòng lệnh
const password = process.argv[2];

if (!password) {
    console.error("Lỗi: Vui lòng cung cấp mật khẩu cần mã hóa.");
    console.log("Cách dùng: node hash_password.js password123");
    process.exit(1);
}

const saltRounds = 10;

// Thực hiện mã hóa
bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
        console.error("Đã xảy ra lỗi khi mã hóa:", err);
        process.exit(1);
    }
    console.log("Mật khẩu của bạn:", password);
    console.log("Chuỗi hash (sao chép và dán vào seed.sql):");
    console.log(hash);
});