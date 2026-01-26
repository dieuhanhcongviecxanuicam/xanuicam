// ubndxanuicam/frontend/src/App.js
// VERSION 2.1 - FINALIZED ROUTING STRUCTURE
import { Routes, Route } from 'react-router-dom';

// --- Layout & Authentication ---
import DashboardLayout from './components/layout/DashboardLayout';
import PrivateRoute from './components/routes/PrivateRoute';

// --- Core Pages ---
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import ProfilePage from './pages/settings/ProfilePage';

// --- Management Pages ---
import UsersPage from './pages/UsersPage';
import DepartmentsPage from './pages/DepartmentsPage';
import ReportsPage from './pages/ReportsPage';
import KpiChartPage from './pages/KpiChartPage';
import AuditLogPage from './pages/AuditLogPage';
import RolesPage from './pages/RolesPage';

// --- NEW & UPDATED PAGES ---
import SettingsPage from './pages/SettingsPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import HandbookPage from './pages/HandbookPage';
import MediaPage from './pages/MediaPage';
import MaintenancePage from './pages/MaintenancePage';
import AccessDeniedPage from './pages/AccessDeniedPage';
import SchedulePage from './pages/SchedulePage';
import FeedbackPage from './pages/FeedbackPage';
import FeedbackAdminPage from './pages/admin/FeedbackAdminPage';
import MeetingsPage from './pages/MeetingsPage';
import DevPreviewPage from './pages/DevPreviewPage';
import MeetingRoomPage from './pages/MeetingRoomPage';
import DeletedRoomAttachmentsPage from './pages/DeletedRoomAttachmentsPage';
import DeletedRoomBookingsPage from './pages/DeletedRoomBookingsPage';
import DeletedCalendarAttachments from './pages/DeletedCalendarAttachments';
import DeletedCalendarEvents from './pages/DeletedCalendarEvents';
import DeletedUsersPage from './pages/DeletedUsersPage';
import DeletedTasksPage from './pages/DeletedTasksPage';
import DeletedRolesPage from './pages/DeletedRolesPage';
import DeletedDepartmentsPage from './pages/DeletedDepartmentsPage';
import ApprovalPage from './pages/admin/ApprovalPage';
import ProfileMFA from './pages/settings/ProfileMFA';
import NotificationsPage from './pages/settings/NotificationsPage';
import ActivityPage from './pages/settings/ActivityPage';
// Use the live ComputerConfigsPage implementation
import ComputerConfigsPage from './pages/ComputerConfigsPage';


function App() {
  return (
    <Routes>
      {/* Dev-only preview route available without auth for local testing */}
      {process.env.NODE_ENV === 'development' && (
        <Route path="/dev/preview" element={<DevPreviewPage />} />
      )}
      {/* ============================================= */}
      {/* == CÁC ROUTE CÔNG KHAI (KHÔNG CẦN ĐĂNG NHẬP) == */}
      {/* ============================================= */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/maintenance" element={<MaintenancePage />} />
      <Route path="/access-denied" element={<AccessDeniedPage />} />

      {/* Dashboard mounted at root */}
      <Route path="/" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
        {/* Trang chính */}
        <Route index element={<DashboardPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="tasks/deleted" element={<PrivateRoute requiredPermissions={['task_management']}><DeletedTasksPage /></PrivateRoute>} />
        
        {/* Các trang Quản lý - Yêu cầu quyền hạn cụ thể */}
        <Route path="users" element={<PrivateRoute requiredPermissions={['user_management']}><UsersPage /></PrivateRoute>} />
        <Route path="users/deleted" element={<PrivateRoute requiredPermissions={['user_management']}><DeletedUsersPage /></PrivateRoute>} />
        <Route path="roles/deleted" element={<PrivateRoute requiredPermissions={['role_management']}><DeletedRolesPage /></PrivateRoute>} />
        <Route path="departments/deleted" element={<PrivateRoute requiredPermissions={['department_management']}><DeletedDepartmentsPage /></PrivateRoute>} />
        <Route path="departments" element={<PrivateRoute requiredPermissions={['department_management']}><DepartmentsPage /></PrivateRoute>} />
        <Route path="roles" element={<PrivateRoute requiredPermissions={['role_management']}><RolesPage /></PrivateRoute>} />
        <Route path="reports" element={<PrivateRoute requiredPermissions={['view_reports']}><ReportsPage /></PrivateRoute>} />
        <Route path="kpi-chart" element={<PrivateRoute requiredPermissions={['view_reports']}><KpiChartPage /></PrivateRoute>} />
        <Route path="audit-log" element={<PrivateRoute requiredPermissions={['view_audit_log']}><AuditLogPage /></PrivateRoute>} />
        
        {/* Các trang dành riêng cho Admin cấp cao */}
        <Route path="admin/settings" element={<PrivateRoute requiredPermissions={['system_settings']}><AdminSettingsPage /></PrivateRoute>} />
        <Route path="admin/feedback" element={<PrivateRoute requiredPermissions={['system_settings']}><FeedbackAdminPage /></PrivateRoute>} />
        <Route path="admin/approvals" element={<PrivateRoute requiredPermissions={['meeting_management', 'room_booking_management']}><ApprovalPage /></PrivateRoute>} />

        
        {/* Trang Cài đặt cá nhân */}
        <Route path="settings" element={<SettingsPage />}>
          <Route path="profile" element={<ProfilePage />} />
          <Route path="mfa" element={<ProfileMFA />} />
          {/* Các trang cài đặt chưa phát triển */}
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="activity" element={<ActivityPage />} />
        </Route>

        {/* Các trang Tiện ích */}
        <Route path="handbook" element={<HandbookPage />} />
        <Route path="media" element={<MediaPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="meetings" element={<MeetingsPage />} /> 
        <Route path="dev/preview" element={<DevPreviewPage />} />
        <Route path="meeting-room" element={<MeetingRoomPage />} /> 
        <Route path="meeting-room/deleted" element={<PrivateRoute requiredPermissions={['room_booking_management']}><DeletedRoomBookingsPage /></PrivateRoute>} />
        <Route path="meeting-room/deleted-attachments" element={<PrivateRoute requiredPermissions={['room_booking_management']}><DeletedRoomAttachmentsPage /></PrivateRoute>} />
        <Route path="schedule/deleted-attachments" element={<PrivateRoute requiredPermissions={['event_management']}><DeletedCalendarAttachments /></PrivateRoute>} />
        <Route path="schedule/deleted" element={<PrivateRoute requiredPermissions={['event_management']}><DeletedCalendarEvents /></PrivateRoute>} />
        <Route path="feedback" element={<FeedbackPage />} />
        {/* Meeting Docs page removed */}
        <Route path="computer-configs" element={<ComputerConfigsPage />} />
        {/** ComputerConfigsPage enabled */}
      </Route>
    </Routes>
  );
}

export default App;