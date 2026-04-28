export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'CVision HR API',
    version: '2.0.0',
    description: 'نظام إدارة الموارد البشرية الذكي — Smart HR Management System API',
    contact: { name: 'Thea Health', email: 'dev@thea.com.sa' },
  },
  servers: [{ url: '/api/cvision', description: 'CVision API' }],
  tags: [
    { name: 'Employees', description: 'Employee management — إدارة الموظفين' },
    { name: 'Leaves', description: 'Leave management — إدارة الإجازات' },
    { name: 'Loans', description: 'Loans & advances — السلف والقروض' },
    { name: 'Payroll', description: 'Payroll processing — الرواتب' },
    { name: 'Recruitment', description: 'Recruitment & ATS — التوظيف' },
    { name: 'Training', description: 'Training & development — التدريب' },
    { name: 'Performance', description: 'KPIs & OKRs — الأداء' },
    { name: 'Letters', description: 'Letter generation — الخطابات' },
    { name: 'Workflows', description: 'Workflow engine — سير العمل' },
    { name: 'Delegations', description: 'Delegation system — التفويضات' },
    { name: 'Notifications', description: 'Notifications center — الإشعارات' },
    { name: 'Audit', description: 'Audit log — سجل التدقيق' },
    { name: 'Org Development', description: 'OD Systems — التطوير التنظيمي' },
    { name: 'Reports', description: 'Reporting engine — التقارير' },
    { name: 'Search', description: 'Global search — البحث العام' },
    { name: 'Bulk', description: 'Bulk operations — العمليات الجماعية' },
    { name: 'Files', description: 'File management — إدارة الملفات' },
    { name: 'Dashboards', description: 'Custom dashboards — لوحات المعلومات' },
    { name: 'Webhooks', description: 'Webhooks & integrations — الربط الآلي' },
    { name: 'Data Warehouse', description: 'DW & BI — مستودع البيانات' },
    { name: 'Chatbot', description: 'AI chatbot — المساعد الذكي' },
    { name: 'Cron', description: 'Scheduled jobs — المهام المجدولة' },
    { name: 'Admin', description: 'System administration — الإدارة' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http' as const, scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: { type: 'object' as const, properties: { ok: { type: 'boolean' as const, example: false }, error: { type: 'string' as const } } },
      Success: { type: 'object' as const, properties: { ok: { type: 'boolean' as const, example: true }, data: { type: 'object' as const } } },
      Employee: {
        type: 'object' as const,
        properties: {
          employeeId: { type: 'string' as const }, name: { type: 'string' as const }, nameEn: { type: 'string' as const },
          email: { type: 'string' as const }, phone: { type: 'string' as const }, departmentName: { type: 'string' as const },
          jobTitle: { type: 'string' as const }, status: { type: 'string' as const, enum: ['active', 'inactive', 'terminated'] },
          joinDate: { type: 'string' as const, format: 'date' }, basicSalary: { type: 'number' as const },
        },
      },
      Leave: {
        type: 'object' as const,
        properties: {
          leaveId: { type: 'string' as const }, employeeId: { type: 'string' as const }, leaveType: { type: 'string' as const },
          startDate: { type: 'string' as const, format: 'date' }, endDate: { type: 'string' as const, format: 'date' },
          days: { type: 'number' as const }, status: { type: 'string' as const, enum: ['PENDING', 'APPROVED', 'REJECTED'] },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/employees': {
      get: { tags: ['Employees'], summary: 'List employees', description: 'Get all employees with optional filters', parameters: [
        { name: 'action', in: 'query' as const, schema: { type: 'string' as const, enum: ['list', 'get', 'stats'] } },
        { name: 'q', in: 'query' as const, schema: { type: 'string' as const }, description: 'Search query' },
        { name: 'department', in: 'query' as const, schema: { type: 'string' as const } },
        { name: 'status', in: 'query' as const, schema: { type: 'string' as const } },
      ], responses: { '200': { description: 'Employee list' }, '401': { description: 'Unauthorized' } } },
      post: { tags: ['Employees'], summary: 'Create/update employee', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Employee' } } } }, responses: { '200': { description: 'Success' } } },
    },
    '/leaves': {
      get: { tags: ['Leaves'], summary: 'List leaves', parameters: [
        { name: 'action', in: 'query' as const, schema: { type: 'string' as const } },
        { name: 'employeeId', in: 'query' as const, schema: { type: 'string' as const } },
        { name: 'status', in: 'query' as const, schema: { type: 'string' as const } },
      ], responses: { '200': { description: 'Leave list' } } },
      post: { tags: ['Leaves'], summary: 'Create/approve/reject leave', responses: { '200': { description: 'Success' } } },
    },
    '/loans': {
      get: { tags: ['Loans'], summary: 'List loans', responses: { '200': { description: 'Loan list' } } },
      post: { tags: ['Loans'], summary: 'Create/approve loan', responses: { '200': { description: 'Success' } } },
    },
    '/payroll': {
      get: { tags: ['Payroll'], summary: 'Get payroll data', responses: { '200': { description: 'Payroll data' } } },
      post: { tags: ['Payroll'], summary: 'Process payroll', responses: { '200': { description: 'Success' } } },
    },
    '/training': {
      get: { tags: ['Training'], summary: 'List training courses/enrollments', responses: { '200': { description: 'Training data' } } },
      post: { tags: ['Training'], summary: 'Create course/enroll', responses: { '200': { description: 'Success' } } },
    },
    '/letters': {
      get: { tags: ['Letters'], summary: 'List letters', responses: { '200': { description: 'Letters list' } } },
      post: { tags: ['Letters'], summary: 'Request/generate letter', responses: { '200': { description: 'Success' } } },
    },
    '/workflows': {
      get: { tags: ['Workflows'], summary: 'List workflow instances/templates', responses: { '200': { description: 'Workflow data' } } },
      post: { tags: ['Workflows'], summary: 'Create/action workflow', responses: { '200': { description: 'Success' } } },
    },
    '/delegations': {
      get: { tags: ['Delegations'], summary: 'List delegations', responses: { '200': { description: 'Delegations list' } } },
      post: { tags: ['Delegations'], summary: 'Create/revoke delegation', responses: { '200': { description: 'Success' } } },
    },
    '/notifications': {
      get: { tags: ['Notifications'], summary: 'List notifications', responses: { '200': { description: 'Notifications list' } } },
      post: { tags: ['Notifications'], summary: 'Mark read/send notification', responses: { '200': { description: 'Success' } } },
    },
    '/audit-log': {
      get: { tags: ['Audit'], summary: 'List audit log entries', parameters: [
        { name: 'action', in: 'query' as const, schema: { type: 'string' as const }, description: 'list or stats' },
      ], responses: { '200': { description: 'Audit log entries' } } },
    },
    '/search': {
      get: { tags: ['Search'], summary: 'Global search across all modules', parameters: [
        { name: 'q', in: 'query' as const, required: true, schema: { type: 'string' as const } },
        { name: 'scope', in: 'query' as const, schema: { type: 'string' as const } },
      ], responses: { '200': { description: 'Search results grouped by module' } } },
    },
    '/bulk': {
      get: { tags: ['Bulk'], summary: 'Get bulk operation status/history', responses: { '200': { description: 'Bulk operations' } } },
      post: { tags: ['Bulk'], summary: 'Execute bulk operation', description: 'Requires BULK_OPERATIONS permission', responses: { '200': { description: 'Operation result' } } },
    },
    '/files': {
      get: { tags: ['Files'], summary: 'List/download files', responses: { '200': { description: 'File list or download' } } },
      post: { tags: ['Files'], summary: 'Upload file', responses: { '200': { description: 'Upload result' } } },
    },
    '/dashboards': {
      get: { tags: ['Dashboards'], summary: 'List/get dashboards and widget data', responses: { '200': { description: 'Dashboard data' } } },
      post: { tags: ['Dashboards'], summary: 'Create/update/delete dashboard', responses: { '200': { description: 'Success' } } },
    },
    '/webhooks': {
      get: { tags: ['Webhooks'], summary: 'List webhooks and delivery logs', responses: { '200': { description: 'Webhook data' } } },
      post: { tags: ['Webhooks'], summary: 'Create/update/test webhook', responses: { '200': { description: 'Success' } } },
    },
    '/reports': {
      get: { tags: ['Reports'], summary: 'List reports/templates, generate report', responses: { '200': { description: 'Report data' } } },
      post: { tags: ['Reports'], summary: 'Save/schedule report', responses: { '200': { description: 'Success' } } },
    },
    '/data-warehouse': {
      get: { tags: ['Data Warehouse'], summary: 'DW tables, status, query, export', responses: { '200': { description: 'DW data' } } },
      post: { tags: ['Data Warehouse'], summary: 'Run ETL pipeline', description: 'Requires REPORTS_EXPORT permission', responses: { '200': { description: 'ETL result' } } },
    },
    '/chatbot': {
      get: { tags: ['Chatbot'], summary: 'Chat history', responses: { '200': { description: 'Chat sessions' } } },
      post: { tags: ['Chatbot'], summary: 'Send message to chatbot', responses: { '200': { description: 'Chatbot response with quick actions' } } },
    },
    '/cron': {
      get: { tags: ['Cron'], summary: 'Cron job status or trigger all', responses: { '200': { description: 'Job status' } } },
      post: { tags: ['Cron'], summary: 'Run specific cron job', description: 'Requires CONFIG_WRITE permission', responses: { '200': { description: 'Job result' } } },
    },
  },
};
