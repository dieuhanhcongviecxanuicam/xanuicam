import React from 'react';

const DevBanner = () => {
  const show = process.env.NODE_ENV === 'development' || process.env.REACT_APP_SHOW_DEV_BANNER === 'true';
  if (!show) return null;
  return (
    <div className="bg-yellow-300 text-black px-4 py-2 text-sm text-center">
      DEV MODE: Local UI edit active — changes are being tested locally
    </div>
  );
};

export default DevBanner;
