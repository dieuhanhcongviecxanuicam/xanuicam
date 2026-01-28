const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

// Simple converter service that runs a LibreOffice Docker container to convert files
// Usage (dev):
// 1. cd backend/converter
// 2. npm ci
// 3. npm run dev
// POST /convert with JSON { path: '<relative path under project root, e.g. uploads/.../file.docx' }

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

const DOCKER_IMAGE = process.env.DOCKER_LIBREOFFICE_IMAGE || 'libreoffice';
const PORT = process.env.DOCX_CONVERTER_PORT || 4001;

app.post('/convert', async (req, res) => {
  try {
    const rawPath = req.body.path || req.query.path;
    if (!rawPath) return res.status(400).json({ message: 'Missing path' });
    const normalized = path.normalize(rawPath).replace(/\\/g, '/');
    if (!normalized.startsWith('uploads/')) return res.status(400).json({ message: 'Invalid path' });
    const sourcePath = path.join(process.cwd(), normalized);
    if (!fs.existsSync(sourcePath)) return res.status(404).json({ message: 'File not found' });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docconv-'));
    const fileName = path.basename(sourcePath);
    const workSrc = path.join(tmpDir, fileName);
    fs.copyFileSync(sourcePath, workSrc);

    // Run Docker container mounting tmpDir as /work
    // Image should provide soffice (LibreOffice). You can set DOCKER_LIBREOFFICE_IMAGE to your preferred image.
    const args = [
      'run', '--rm',
      '-v', `${tmpDir}:/work`,
      DOCKER_IMAGE,
      'soffice', '--headless', '--convert-to', 'pdf', '--outdir', '/work', fileName
    ];

    try {
      execFileSync('docker', args, { stdio: 'ignore', timeout: 120_000 });
    } catch (e) {
      // conversion failed
      console.error('Docker conversion failed', e && e.message ? e.message : e);
      // cleanup and return error
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (ex) {}
      return res.status(500).json({ message: 'Conversion failed (docker may be missing or image not available)' });
    }

    // find generated pdf
    const files = fs.readdirSync(tmpDir);
    const pdf = files.find(f => f.toLowerCase().endsWith('.pdf'));
    if (!pdf) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (ex) {}
      return res.status(500).json({ message: 'Converted PDF not found' });
    }

    const pdfPath = path.join(tmpDir, pdf);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(pdf)}"`);
    // secure download headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store');
    res.setHeader('X-Download-Options', 'noopen');
    const stream = fs.createReadStream(pdfPath);
    stream.on('end', () => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (ex) {}
    });
    return stream.pipe(res);
  } catch (e) {
    console.error('Convert endpoint error', e && e.message ? e.message : e);
    return res.status(500).json({ message: 'Internal error' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true, dockerImage: DOCKER_IMAGE }));

app.listen(PORT, () => console.log(`Docx converter service running on port ${PORT}. POST /convert`));
