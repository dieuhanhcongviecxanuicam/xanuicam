import React from 'react';

const VARIANTS = {
  primary: 'inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50',
  secondary: 'inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50',
  danger: 'inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-sm font-medium text-white hover:bg-red-700'
};

const SmallButton = ({ variant = 'primary', className = '', children, ...props }) => {
  const cls = `${VARIANTS[variant] || VARIANTS.primary} ${className}`.trim();
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
};

export default SmallButton;
