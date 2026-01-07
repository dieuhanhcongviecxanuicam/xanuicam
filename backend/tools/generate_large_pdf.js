const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const users = parseInt(process.argv[2] || '20000', 10); // number of users
const fields = parseInt(process.argv[3] || '30', 10);

(async () => {
  const start = Date.now();
  const tmp = path.join(require('os').tmpdir(), `stress_pdf_${Date.now()}.pdf`);
  const stream = fs.createWriteStream(tmp);
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.pipe(stream);
  for (let i = 0; i < users; i++) {
    doc.fontSize(12).text(`User ${i}`, { align: 'left' });
    for (let j = 0; j < fields; j++) {
      doc.fontSize(9).text(`field${j+1}: value ${i}_${j}`);
    }
    if (i < users - 1) doc.addPage();
    if (i % 1000 === 0) console.log('added', i);
  }
  doc.end();
  stream.on('finish', () => {
    const stat = fs.statSync(tmp);
    console.log('Wrote', tmp, 'size', stat.size, 'bytes in', (Date.now() - start)/1000, 's');
    console.log('Memory usage', process.memoryUsage());
  });
})();
