const express = require('express');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
process.env.UPLOAD_REJECTION_LOG = process.env.UPLOAD_REJECTION_LOG || require('path').join(__dirname, '..', 'tmp', 'harness_upload_rejections.log');
const { attachmentUpload } = require('../src/middlewares/uploadMiddleware');
const app = express();
app.use(express.urlencoded({ extended: true }));
app.post('/test-upload', attachmentUpload.array('attachments', 6), (req,res)=>{
  res.json({ ok: true, files: (req.files||[]).map(f=>({originalname:f.originalname,filename:f.filename,size:f.size})), body: req.body });
});
app.use((err,req,res,next)=>{
  console.error('HARNESS ERROR', err && (err.message||err));
  res.status(err && (err.statusCode||500)).json({ error: err && err.message || 'server error' });
});
const PORT = 8081;
app.listen(PORT, '127.0.0.1', ()=>console.log('local upload_harness listening on 127.0.0.1:'+PORT));
