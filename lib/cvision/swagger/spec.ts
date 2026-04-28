/**
 * OpenAPI 3.0 specification for CVision HR API.
 *
 * Served via /api/cvision/docs and consumable by Swagger UI,
 * Redoc, or Postman import.
 */

export const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'CVision HR API',
    version: '1.0.0',
    description: 'Complete HR Management System API — Saudi Arabia compliant.\n\nAll endpoints require a valid Bearer JWT token. Every request is tenant-scoped.',
    contact: { email: 'api@cvision.com' },
    license: { name: 'Proprietary' },
  },
  servers: [
    { url: '/api/cvision', description: 'Current environment' },
  ],
  tags: [
    { name: 'Employees', description: 'Employee lifecycle management' },
    { name: 'Attendance', description: 'Clock-in / clock-out & attendance tracking' },
    { name: 'Payroll', description: 'Payroll processing, payslips, GOSI' },
    { name: 'Recruitment', description: 'Job requisitions, candidates, ATS pipeline' },
    { name: 'Leave', description: 'Leave requests, balances, approvals' },
    { name: 'Insurance', description: 'Health insurance management & claims' },
    { name: 'Training', description: 'Courses, enrollments, certificates' },
    { name: 'Loans', description: 'Employee loans & advances' },
    { name: 'Performance', description: 'Performance reviews & goals' },
    { name: 'Compliance', description: 'Saudi compliance, Nitaqat, GOSI' },
    { name: 'Transport', description: 'Transport routes & allowances' },
    { name: 'Cafeteria', description: 'Meal plans & bookings' },
    { name: 'OKRs', description: 'KPIs & OKRs' },
    { name: 'Safety', description: 'Occupational health & safety' },
    { name: 'Workflows', description: 'Workflow engine & approvals' },
    { name: 'Teams', description: 'Team management' },
    { name: 'Search', description: 'Global search' },
    { name: 'Files', description: 'Document management' },
    { name: 'Email', description: 'Email queue & templates' },
    { name: 'Webhooks', description: 'Outbound webhooks' },
    { name: 'System', description: 'Health, jobs, backup, seed data' },
  ],
  paths: {
    '/employees': {
      get: {
        tags: ['Employees'],
        summary: 'List or search employees',
        parameters: [
          { name: 'action', in: 'query', required: true, schema: { type: 'string', enum: ['list', 'detail', 'search', 'by-department', 'expiring-iqamas', 'expiring-contracts'] } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'RESIGNED', 'TERMINATED', 'ON_LEAVE'] } },
          { name: 'department', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search query (name, email, ID)' },
        ],
        responses: {
          200: { description: 'List of employees', content: { 'application/json': { schema: { $ref: '#/components/schemas/EmployeeListResponse' } } } },
          401: { description: 'Unauthorized' },
        },
        security: [{ bearerAuth: [] }],
      },
      post: {
        tags: ['Employees'],
        summary: 'Create or update an employee',
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/EmployeeInput' } } } },
        responses: { 200: { description: 'Success' } },
        security: [{ bearerAuth: [] }],
      },
    },
    '/attendance': {
      get: {
        tags: ['Attendance'],
        summary: 'Query attendance records',
        parameters: [
          { name: 'action', in: 'query', required: true, schema: { type: 'string', enum: ['today', 'by-employee', 'by-date', 'summary'] } },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'employeeId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Attendance data' } },
        security: [{ bearerAuth: [] }],
      },
    },
    '/payroll': {
      get: {
        tags: ['Payroll'],
        summary: 'Payroll data & payslips',
        parameters: [
          { name: 'action', in: 'query', required: true, schema: { type: 'string', enum: ['runs', 'payslip', 'summary', 'gosi-report'] } },
          { name: 'period', in: 'query', schema: { type: 'string', example: '2026-01' } },
        ],
        responses: { 200: { description: 'Payroll data' } },
        security: [{ bearerAuth: [] }],
      },
    },
    '/search': {
      get: {
        tags: ['Search'],
        summary: 'Global search across all modules',
        parameters: [
          { name: 'action', in: 'query', schema: { type: 'string', enum: ['search', 'recent'] } },
          { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2 } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['EMPLOYEE', 'CANDIDATE', 'JOB', 'DOCUMENT', 'POLICY'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 15 } },
        ],
        responses: { 200: { description: 'Search results' } },
        security: [{ bearerAuth: [] }],
      },
    },
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check — database, cache, uptime',
        responses: {
          200: { description: 'All services healthy' },
          503: { description: 'One or more services degraded' },
        },
      },
    },
    '/seed': {
      post: {
        tags: ['System'],
        summary: 'Generate demo data or clear all data',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { action: { type: 'string', enum: ['generate-demo', 'clear-all'] }, force: { type: 'boolean' }, confirm: { type: 'boolean' } } } } },
        },
        responses: { 200: { description: 'Success' } },
        security: [{ bearerAuth: [] }],
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Employee: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          employeeId: { type: 'string', example: 'EMP-0001' },
          name: { type: 'string', example: 'Ahmed Al-Harbi' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string', example: '+966512345678' },
          nationalId: { type: 'string', example: '1XXXXXXXXX' },
          nationality: { type: 'string' },
          gender: { type: 'string', enum: ['MALE', 'FEMALE'] },
          department: { type: 'string' },
          position: { type: 'string' },
          joinDate: { type: 'string', format: 'date' },
          basicSalary: { type: 'number' },
          housingAllowance: { type: 'number' },
          transportAllowance: { type: 'number' },
          status: { type: 'string', enum: ['ACTIVE', 'RESIGNED', 'TERMINATED', 'ON_LEAVE'] },
        },
      },
      EmployeeInput: {
        type: 'object',
        required: ['action'],
        properties: {
          action: { type: 'string', enum: ['create', 'update', 'terminate', 'transfer'] },
          data: { $ref: '#/components/schemas/Employee' },
        },
      },
      EmployeeListResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          data: { type: 'array', items: { $ref: '#/components/schemas/Employee' } },
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: false },
          error: { type: 'string' },
        },
      },
    },
  },
};
