import React from 'react';
import AttachmentViewerModal from '../components/common/AttachmentViewerModal';

// Simple page to preview arbitrary URLs in modal (dev-only)
const DevPreviewPage = () => {
  const [attachment, setAttachment] = React.useState(null);
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Dev File Preview</h2>
      <p className="mb-4 text-sm text-slate-600">Paste a file URL or a backend-relative path like <code>/uploads/meeting_docs/your.pdf</code></p>
      <div className="flex gap-2 mb-4">
        <input id="dev-url" className="input-style flex-1" placeholder="https://... or /uploads/..." />
        <button className="btn" onClick={() => {
          const v = document.getElementById('dev-url').value.trim(); if (!v) return; setAttachment({ file_path: v, file_name: v.split('/').pop() });
        }}>Preview</button>
      </div>
      {attachment && <AttachmentViewerModal attachment={attachment} onClose={() => setAttachment(null)} />}
    </div>
  );
};

export default DevPreviewPage;
