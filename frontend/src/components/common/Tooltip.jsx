import React from 'react';

const Tooltip = ({ children, text }) => {
    return (
        <span className="relative group inline-flex">
            {children}
            {text && (
                <span className="absolute left-1/2 transform -translate-x-1/2 -translate-y-2 opacity-0 group-hover:opacity-100 translate-y-[-6px] group-hover:translate-y-0 transition-all duration-150 delay-75 bg-black text-white text-xs rounded py-1 px-2 whitespace-nowrap z-50 pointer-events-none">
                    {text}
                </span>
            )}
        </span>
    );
};

export default Tooltip;
