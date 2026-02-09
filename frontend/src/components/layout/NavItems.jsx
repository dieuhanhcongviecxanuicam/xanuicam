import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import Tooltip from '../../components/common/Tooltip';
import {
  LayoutDashboard, ListChecks, Users, PieChart, History, Building, Settings,
  BookOpen, Megaphone, Calendar, Users2, CalendarPlus, MessageSquare,
  ShieldCheck, KeySquare, CheckSquare, Monitor
} from 'lucide-react';
import { BarChart2 } from 'lucide-react';

const NavItems = ({ isCollapsed, onNavClick, horizontal }) => {
  const { hasPermission } = useContext(AuthContext);

  if (!horizontal) {
    const navLinkClass = ({ isActive }) =>
      `flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4 py-2'} rounded-lg transition-colors duration-200 text-sm ${
        isActive ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-200'
      }`;

    return (
      <>
        <p className={`px-4 pt-2 pb-1 text-xs font-semibold text-slate-400 uppercase ${isCollapsed ? 'hidden' : ''}`}>THEO DÕI & GIAO VIỆC</p>
        <NavLink to="/" end className={navLinkClass} onClick={onNavClick}>
          <Tooltip text={isCollapsed ? 'Bảng điều khiển' : null}>
            <LayoutDashboard className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
            <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Bảng điều khiển</span>
          </Tooltip>
        </NavLink>
        <NavLink to="/tasks" className={navLinkClass} onClick={onNavClick}>
          <Tooltip text={isCollapsed ? 'Quản lý công việc' : null}>
            <ListChecks className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
            <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Quản lý công việc</span>
          </Tooltip>
        </NavLink>
        { /* Removed 'Công Việc Đã Hủy' from sidebar navigation per UX update */ }

        <p className="px-4 pt-4 pb-1 text-xs font-semibold text-slate-400 uppercase">QUẢN LÝ</p>
        {hasPermission(['user_management']) && (
          <NavLink to="/users" className={navLinkClass} onClick={onNavClick}>
            <Tooltip text={isCollapsed ? 'Quản lý tài khoản' : null}>
              <Users className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
              <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Quản lý tài khoản</span>
            </Tooltip>
          </NavLink>
        )}
        {hasPermission(['department_management']) && (
          <NavLink to="/departments" className={navLinkClass} onClick={onNavClick}>
            <Tooltip text={isCollapsed ? 'Quản lý phòng ban' : null}>
              <Building className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
              <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Quản lý phòng ban</span>
            </Tooltip>
          </NavLink>
        )}
        {hasPermission(['role_management']) && (
          <NavLink to="/roles" className={navLinkClass} onClick={onNavClick}>
            <Tooltip text={isCollapsed ? 'Quản lý Phân quyền' : null}>
              <KeySquare className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
              <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Quản lý Phân quyền</span>
            </Tooltip>
          </NavLink>
        )}
        {hasPermission(['view_reports']) && (
          <NavLink to="/reports" className={navLinkClass} onClick={onNavClick}>
            <Tooltip text={isCollapsed ? 'Báo cáo & Thống kê' : null}>
              <PieChart className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
              <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Báo cáo & Thống kê</span>
            </Tooltip>
          </NavLink>
        )}
        {hasPermission(['view_reports']) && (
          <NavLink to="/kpi-chart" className={navLinkClass} onClick={onNavClick}>
            <Tooltip text={isCollapsed ? 'Biểu đồ KPI' : null}>
              <BarChart2 className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
              <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Biểu đồ KPI</span>
            </Tooltip>
          </NavLink>
        )}
        {hasPermission(['view_audit_log']) && (
          <NavLink to="/audit-log" className={navLinkClass} onClick={onNavClick}>
            <Tooltip text={isCollapsed ? 'Theo dõi & Truy vết' : null}>
              <History className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
              <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Theo dõi & Truy vết</span>
            </Tooltip>
          </NavLink>
        )}

        {(hasPermission(['meeting_management', 'room_booking_management'])) && (
          <p className="px-4 pt-4 pb-1 text-xs font-semibold text-slate-400 uppercase">PHÊ DUYỆT</p>
        )}
        {(hasPermission(['meeting_management', 'room_booking_management'])) && (
          <NavLink to="/admin/approvals" className={navLinkClass} onClick={onNavClick}>
            <Tooltip text={isCollapsed ? 'Phê duyệt yêu cầu' : null}>
              <CheckSquare className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
              <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Phê duyệt yêu cầu</span>
            </Tooltip>
          </NavLink>
        )}

        <p className="px-4 pt-4 pb-1 text-xs font-semibold text-slate-400 uppercase">TIỆN ÍCH</p>
        <NavLink to="/data-repo" className={navLinkClass} onClick={onNavClick}>
          <Tooltip text={isCollapsed ? 'Kho dữ liệu số' : null}>
            <BookOpen className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
            <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Kho dữ liệu số</span>
          </Tooltip>
        </NavLink>
        <NavLink to="/media" className={navLinkClass} onClick={onNavClick}>
          <Tooltip text={isCollapsed ? 'Thông tin truyền thông' : null}>
            <Megaphone className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
            <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Thông tin truyền thông</span>
          </Tooltip>
        </NavLink>
        <NavLink to="/schedule" className={navLinkClass} onClick={onNavClick}>
          <Tooltip text={isCollapsed ? 'Lịch làm việc' : null}>
            <Calendar className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
            <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Lịch làm việc</span>
          </Tooltip>
        </NavLink>
        <NavLink to="/meetings" className={navLinkClass} onClick={onNavClick}>
          <Tooltip text={isCollapsed ? 'Họp & Hội nghị' : null}>
            <Users2 className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
            <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Họp & Hội nghị</span>
          </Tooltip>
        </NavLink>
        <NavLink to="/meeting-room" className={navLinkClass} onClick={onNavClick}>
          <Tooltip text={isCollapsed ? 'Đăng ký phòng họp' : null}>
            <CalendarPlus className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
            <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Đăng ký phòng họp</span>
          </Tooltip>
        </NavLink>
        <NavLink to="/feedback" className={navLinkClass} onClick={onNavClick}>
          <Tooltip text={isCollapsed ? 'Góp ý & Cải thiện' : null}>
            <MessageSquare className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
            <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Góp ý & Cải thiện</span>
          </Tooltip>
        </NavLink>

        <p className="px-4 pt-4 pb-1 text-xs font-semibold text-slate-400 uppercase">HỆ THỐNG</p>
        <NavLink to="/settings/profile" className={navLinkClass} onClick={onNavClick}>
          <Tooltip text={isCollapsed ? 'Cài đặt' : null}>
            <Settings className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
            <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Cài đặt</span>
          </Tooltip>
        </NavLink>
        <NavLink to="/computer-configs" className={navLinkClass} onClick={onNavClick}>
          <Tooltip text={isCollapsed ? 'Cấu hình máy tính' : null}>
            <Monitor className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
            <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Cấu hình máy tính</span>
          </Tooltip>
        </NavLink>
        {hasPermission(['system_settings']) && (
          <NavLink to="/admin/settings" className={navLinkClass} onClick={onNavClick}>
            <Tooltip text={isCollapsed ? 'Cài đặt hệ thống' : null}>
              <ShieldCheck className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
              <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Cài đặt hệ thống</span>
            </Tooltip>
          </NavLink>
        )}
        {hasPermission(['system_settings']) && (
          <NavLink to="/admin/feedback" className={navLinkClass} onClick={onNavClick}>
            <Tooltip text={isCollapsed ? 'Quản lý Góp ý' : null}>
              <MessageSquare className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
              <span className={`${isCollapsed ? 'hidden' : 'ml-3'}`}>Quản lý Góp ý</span>
            </Tooltip>
          </NavLink>
        )}
      </>
    );
  }

  // horizontal layout for header dropdown: render groups as rows with items inline
  const groups = [
    {
      title: 'THEO DÕI & GIAO VIỆC',
      items: [
        { to: '/', label: 'Bảng điều khiển', Icon: LayoutDashboard },
        { to: '/tasks', label: 'Quản lý công việc', Icon: ListChecks },
      ],
    },
    {
      title: 'QUẢN LÝ',
      items: [
        { to: '/users', label: 'Quản lý tài khoản', Icon: Users, perm: ['user_management'] },
        { to: '/departments', label: 'Quản lý phòng ban', Icon: Building, perm: ['department_management'] },
        { to: '/roles', label: 'Quản lý Phân quyền', Icon: KeySquare, perm: ['role_management'] },
        { to: '/reports', label: 'Báo cáo & Thống kê', Icon: PieChart, perm: ['view_reports'] },
        { to: '/audit-log', label: 'Theo dõi & Truy vết', Icon: History, perm: ['view_audit_log'] },
      ],
    },
    {
      title: 'PHÊ DUYỆT',
      items: [
        { to: '/admin/approvals', label: 'Phê duyệt yêu cầu', Icon: CheckSquare, perm: ['meeting_management','room_booking_management'] },
      ],
    },
    {
      title: 'TIỆN ÍCH',
      items: [
        { to: '/data-repo', label: 'Kho dữ liệu số', Icon: BookOpen },
        { to: '/media', label: 'Thông tin truyền thông', Icon: Megaphone },
        { to: '/schedule', label: 'Lịch làm việc', Icon: Calendar },
        { to: '/meetings', label: 'Họp & Hội nghị', Icon: Users2 },
        { to: '/meeting-room', label: 'Đăng ký phòng họp', Icon: CalendarPlus },
        { to: '/feedback', label: 'Góp ý & Cải thiện', Icon: MessageSquare },
      ],
    },
    {
      title: 'HỆ THỐNG',
      items: [
        { to: '/settings/profile', label: 'Cài đặt', Icon: Settings },
        { to: '/computer-configs', label: 'Cấu hình máy tính', Icon: Monitor },
        { to: '/admin/settings', label: 'Cài đặt hệ thống', Icon: ShieldCheck, perm: ['system_settings'] },
        { to: '/admin/feedback', label: 'Quản lý Góp ý', Icon: MessageSquare, perm: ['system_settings'] },
      ],
    },
  ];

  const itemClass = (isActive) => `flex items-center space-x-2 px-3 py-1 rounded text-sm ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100'}`;

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="text-xs font-semibold text-slate-400 mb-2">{g.title}</div>
          <div className="flex flex-wrap items-center space-x-3">
            {g.items.map(item => {
              if (item.perm && !hasPermission(item.perm)) return null;
              return (
                <NavLink key={item.to} to={item.to} className={({isActive}) => itemClass(isActive)} onClick={onNavClick}>
                  <item.Icon className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default NavItems;
