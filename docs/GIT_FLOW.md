# Quy trình Git Flow cho xanuicam

1. Tạo nhánh mới từ `main` để phát triển tính năng:

   git checkout -b feature/tinh-nang-moi

2. Code & Commit: thực hiện thay đổi, viết commit rõ ràng, viết message có ý nghĩa.

   git add .
   git commit -m "Mô tả ngắn: thêm tính năng X"

3. Push nhánh lên GitHub:

   git push origin feature/tinh-nang-moi

4. Trên GitHub tạo Pull Request (PR) từ `feature/*` vào `main` và chỉ định reviewer.

5. Review & Merge: người quản lý kỹ thuật (code owner) review, nếu OK thì merge.

6. Sau khi merge vào `main`, workflow `.github/workflows/deploy.yml` sẽ chạy tự động và SSH vào server để kéo code mới.

Ghi chú:
- Không làm việc trực tiếp trên `main`.
- Mỗi PR nên có mô tả, link issue (nếu có), và checklist kiểm thử cơ bản.
- Đảm bảo secrets (SSH key, DEPLOY_HOST, DEPLOY_USER) được cấu hình trong repository Settings → Secrets.
