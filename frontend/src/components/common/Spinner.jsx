// ubndxanuicam/frontend/src/components/common/Spinner.jsx
import React from 'react';
import { Loader } from 'lucide-react';

const Spinner = ({ fullPage = false }) => {
  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <Loader className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }
  return <Loader className="w-6 h-6 animate-spin text-blue-600" />;
};

export default Spinner;