import React, { useState } from 'react';

const CreateMeetingBox = ({ onCreate }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!title || title.trim().length === 0) return alert('Tiêu đề là bắt buộc');
    setLoading(true);
    try {
      const created = await onCreate(title.trim(), desc.trim());
      if (created) {
        setTitle(''); setDesc('');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="mt-4 p-3 border rounded bg-white">
      <h5 className="font-medium mb-2">Tạo menu tài liệu cuộc họp</h5>
      <input className="w-full border p-1 mb-2" placeholder="Tiêu đề cuộc họp" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea className="w-full border p-1 mb-2" placeholder="Mô tả" value={desc} onChange={e => setDesc(e.target.value)} />
      <div className="flex justify-end">
        <button className="btn-primary" onClick={submit} disabled={loading}>{loading ? 'Đang...' : 'Tạo'}</button>
      </div>
    </div>
  );
};

export default CreateMeetingBox;
