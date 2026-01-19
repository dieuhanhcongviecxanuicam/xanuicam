import React, { useEffect, useState } from 'react';

const RotatingSlogans = ({ slogans = [], interval = 10000, fadeMs = 800 }) => {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!slogans || slogans.length === 0) return;
    const cycle = setInterval(() => {
      // fade out, change text, fade in
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % slogans.length);
        setVisible(true);
      }, fadeMs);
    }, interval);
    return () => clearInterval(cycle);
  }, [slogans, interval, fadeMs]);
  if (!slogans || slogans.length === 0) return null;
  return (
    <div className={`my-3 text-sm text-slate-600 transition-opacity duration-${Math.min(2000, Math.max(200, fadeMs))} ease-in-out`} style={{ opacity: visible ? 1 : 0 }}>
      {slogans[idx]}
    </div>
  );
};

export default RotatingSlogans;
