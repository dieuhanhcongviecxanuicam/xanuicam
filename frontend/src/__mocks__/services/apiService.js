const mock = {
  __esModule: true,
  default: {
    getTaskHistory: jest.fn(() => Promise.resolve([])),
    getTaskComments: jest.fn(() => Promise.resolve([])),
    getTaskAttachments: jest.fn(() => Promise.resolve([])),
    getTask: jest.fn((id) => Promise.resolve({ id, title: `T-${id}`, assignee_id: 2, creator_id: 1, due_date: new Date().toISOString(), description: 'mock', kpi_score: 0 })),
    updateTaskStatus: jest.fn(() => Promise.resolve()),
    addTaskComment: jest.fn(() => Promise.resolve()),
    addTaskAttachment: jest.fn(() => Promise.resolve()),
    updateTaskKpi: jest.fn(() => Promise.resolve()),
    // Deleted tasks
    getDeletedTasks: jest.fn(() => Promise.resolve({ items: [], total: 0 })),
    restoreDeletedTask: jest.fn(() => Promise.resolve()),
    permanentlyDeleteTask: jest.fn(() => Promise.resolve()),
    // Audit helper
    logEvent: jest.fn(() => Promise.resolve()),
    // Export helpers
    getExportQuota: jest.fn(() => Promise.resolve({ usedToday: 0, limit: 5, remaining: 5 })),
    exportUsersRaw: jest.fn(() => Promise.resolve({ data: new Blob(), headers: new Map() })),
    // Reports
    getDetailedTaskReport: jest.fn(() => Promise.resolve({ items: [], total: 0 })),
    // Users
    getUsers: jest.fn(() => Promise.resolve({ data: [], pagination: { currentPage: 1, totalPages: 1 } })),
    getDepartments: jest.fn(() => Promise.resolve({ data: [] })),
  }
};

module.exports = mock;
