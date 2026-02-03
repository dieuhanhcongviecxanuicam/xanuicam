// ubndxanuicam/frontend/src/components/layout/Sidebar.jsx
// VERSION 2.1 - IMPROVED MOBILE SCROLLING

import React, { useContext } from 'react';
import AuthContext from '../../context/AuthContext';
import NavItems from './NavItems';
import zaloQR from '../../assets/images/zalo-qr.jpg';
import logoImg from '../../assets/images/logo.png';

const Sidebar = ({ isSidebarOpen, setSidebarOpen }) => {
  const { user } = useContext(AuthContext);

  if (!user) return null;

  return (
    <>
      <aside className={`fixed top-0 left-0 z-40 h-screen bg-white shadow-md transition-all duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`} style={{ width: 288 }}>
        <div className="flex items-center justify-between h-16 border-b flex-shrink-0 px-4">
          <div className="flex items-center">
            <img src={logoImg} alt="Logo" className="h-10 w-10 object-contain" />
            <span className="ml-3 text-lg font-bold text-slate-800">UBND xã Núi Cấm</span>
          </div>
        </div>

        <nav className="mt-4 px-4 space-y-1 flex-grow overflow-y-auto pb-4">
          <NavItems isCollapsed={false} onNavClick={() => setSidebarOpen(false)} />
        </nav>

        <div className="px-4 py-4 border-t flex-shrink-0">
          <a href="https://zalo.me/3388785049828093387" target="_blank" rel="noopener noreferrer" className="flex items-center p-3 rounded-lg bg-slate-100 hover:bg-slate-200">
            <img src={zaloQR} alt="Zalo OA QR Code" className="w-10 h-10 rounded-md" />
            <div className="ml-3">
              <p className="text-sm font-semibold text-slate-800">Chính quyền số</p>
              <p className="text-xs text-slate-500">xã Núi Cấm</p>
            </div>
          </a>
        </div>
      </aside>
      {isSidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden" onClick={() => setSidebarOpen(false)}></div>}
    </>
  );
};

export default Sidebar;