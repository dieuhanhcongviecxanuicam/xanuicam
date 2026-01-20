const puppeteer = require('puppeteer');
const fs = require('fs');
(async () => {
  const url = process.env.URL || 'http://localhost:3002';
  const outDir = 'tmp';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  } catch (e) {
    console.warn('Could not reach dev server at', url, '— proceeding to inject into blank page');
    await page.goto('about:blank');
  }

  // Ensure body exists
  await page.evaluate(() => { if (!document.body) document.write('<body></body>'); });

  // Insert modal markup that mirrors ModalWrapper + TaskDetailModal structure
  const modalHtml = `
    <div class="modal-portal-container" id="test-modal-root">
      <div class="fixed inset-0 overflow-y-auto" style="z-index:1000;">
        <div class="absolute inset-0 bg-black bg-opacity-60"></div>
        <div class="flex justify-center items-start p-4 min-h-screen" style="z-index:1001;">
          <div role="dialog" aria-modal="true" class="relative bg-white h-full rounded-none shadow-xl w-full max-w-3xl overflow-hidden flex flex-col p-0 max-h-full overflow-y-auto" style="z-index:1002;">
            <div class="flex flex-col">
              <div class="flex justify-between items-center p-6 border-b flex-shrink-0">
                <div class="flex items-center">
                  <h2 class="text-xl font-bold text-slate-800">Mẫu: Chi tiết công việc</h2>
                </div>
                <button class="text-slate-400 hover:text-slate-600">X</button>
              </div>
              <div class="p-6 pb-6" style="overflow-y:auto; max-height: calc(100vh - 120px);">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div class="bg-slate-50 p-4 rounded">Người giao việc: Nguyễn A</div>
                  <div class="bg-slate-50 p-4 rounded">Người thực hiện: Trần B</div>
                </div>
                <div class="mb-6">
                  <h3 class="font-semibold mb-2">Mô tả công việc</h3>
                  <p class="text-sm text-slate-600 bg-slate-50 p-4 rounded-md">Mô tả demo: Làm việc theo yêu cầu, kiểm tra tính năng modal full-bleed trên mobile.</p>
                </div>
              </div>
              <div class="p-4 border-t bg-slate-50 flex items-center justify-end gap-3 flex-shrink-0">
                <button class="btn-secondary">Đóng</button>
                <button class="btn-primary">Tiếp nhận</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  await page.evaluate((html) => {
    let container = document.getElementById('test-modal-root');
    if (container) container.remove();
    container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    // add some basic minimal Tailwind-like styles for buttons if not present
    if (!document.getElementById('test-modal-styles')) {
      const s = document.createElement('style');
      s.id = 'test-modal-styles';
      s.innerText = `
        .btn-secondary { background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 12px; border-radius: 6px; }
        .btn-primary { background: #2563eb; color: white; padding: 6px 12px; border-radius: 6px; }
        .bg-slate-50 { background: #f8fafc; }
        .text-slate-800 { color: #0f172a; }
      `;
      document.head.appendChild(s);
    }
  }, modalHtml);

  // Mobile screenshot (iPhone 12-ish)
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: 'tmp/modal_mobile.png', fullPage: true });

  // Desktop screenshot
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: 'tmp/modal_desktop.png', fullPage: true });

  console.log('Screenshots written to tmp/modal_mobile.png and tmp/modal_desktop.png');
  await browser.close();
})();
