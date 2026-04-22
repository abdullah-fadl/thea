/**
 * CVision HR — OpenAPI 3.0 Specification
 *
 * Full API reference for the CVision SaaS public REST API.
 * Consumed by Swagger UI at /cvision/api-docs and served as JSON at /api/v1/openapi.json.
 */

export const openApiSpec: Record<string, any> = {
  openapi: '3.0.3',
  info: {
    title: 'CVision HR API',
    description: `CVision HR is a comprehensive Human Resources Management SaaS platform designed for businesses operating in Saudi Arabia.

## Authentication

All API requests require an API key passed in the Authorization header:

\`\`\`
Authorization: Bearer cvk_live_xxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

**Live keys** (\`cvk_live_\`) hit production data. **Test keys** (\`cvk_test_\`) operate on a sandbox.

Generate keys from **Settings → API Keys** in the CVision dashboard.

## Rate Limiting

| Plan | Requests / minute |
|------|-------------------|
| Free | 30 |
| Starter | 60 |
| Professional | 120 |
| Enterprise | 300 |

Every response includes rate-limit metadata:

\`\`\`json
{
  "meta": {
    "rateLimit": {
      "limit": 60,
      "remaining": 58,
      "reset": "2026-02-22T19:01:00Z"
    }
  }
}
\`\`\`

## Webhooks

Subscribe to real-time events (employee changes, leave approvals, payroll runs, etc.) via the **/webhooks** endpoints. Payloads are signed with HMAC-SHA256.

## Pagination

List endpoints accept \`page\` (default 1) and \`limit\` (default 20, max 100) query parameters. The response \`meta\` object contains \`page\`, \`limit\`, and \`total\`.

## Errors

All errors follow a consistent structure:

\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable explanation"
  }
}
\`\`\`
`,
    version: '1.0.0',
    contact: {
      name: 'CVision Support',
      email: 'support@cvision.sa',
      url: 'https://cvision.sa',
    },
    license: { name: 'Commercial' },
  },

  servers: [
    { url: 'https://api.cvision.sa/api/v1', description: 'Production' },
    { url: 'http://localhost:3000/api/v1', description: 'Development' },
  ],

  tags: [
    { name: 'Employees', description: 'Employee lifecycle management — create, list, update, terminate' },
    { name: 'Attendance', description: 'Time and attendance tracking — check-in, check-out, records' },
    { name: 'Leaves', description: 'Leave request management — submit, approve, reject' },
    { name: 'Payroll', description: 'Payroll summaries and employee pay slips' },
    { name: 'Performance', description: 'Performance review cycles and reviews' },
    { name: 'Reports', description: 'Saudi government compliance reports — GOSI, WPS, Nitaqat' },
    { name: 'Recruitment', description: 'Job openings and recruitment pipeline' },
    { name: 'Webhooks', description: 'Webhook subscription management and event catalog' },
    { name: 'Tenant', description: 'Tenant / company information and API usage statistics' },
  ],

  security: [{ ApiKeyAuth: [] }],

  // ───────────────────────────── Components ──────────────────────────────

  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'API key with cvk_live_ or cvk_test_ prefix',
      },
    },

    schemas: {
      // ── Common ──
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 150 },
          rateLimit: { $ref: '#/components/schemas/RateLimitInfo' },
        },
      },
      RateLimitInfo: {
        type: 'object',
        properties: {
          limit: { type: 'integer', example: 60 },
          remaining: { type: 'integer', example: 58 },
          reset: { type: 'string', format: 'date-time', example: '2026-02-22T19:01:00Z' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'name is required' },
              retryAfter: { type: 'integer', description: 'Seconds until rate limit resets (429 only)' },
            },
          },
        },
      },

      // ── Employee ──
      Employee: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          tenantId: { type: 'string', example: 'thea-health' },
          employeeId: { type: 'string', example: 'emp_a1b2c3' },
          employeeNumber: { type: 'string', example: 'EMP-001' },
          name: { type: 'string', example: 'Omar Ali' },
          email: { type: 'string', format: 'email', example: 'omar@company.com' },
          phone: { type: 'string', example: '+966501234567' },
          department: { type: 'string', example: 'Nursing' },
          departmentId: { type: 'string' },
          jobTitle: { type: 'string', example: 'Data Analyst' },
          status: { type: 'string', enum: ['Active', 'Probation', 'Terminated', 'Resigned', 'On Leave', 'Suspended'] },
          nationality: { type: 'string', example: 'Egyptian' },
          nationalId: { type: 'string', example: '1098765432' },
          basicSalary: { type: 'number', example: 12000 },
          hireDate: { type: 'string', format: 'date', example: '2025-03-15' },
          contractType: { type: 'string', enum: ['Full-Time', 'Part-Time', 'Contract', 'Internship'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateEmployeeRequest: {
        type: 'object',
        required: ['name', 'email', 'department', 'jobTitle', 'hireDate'],
        properties: {
          name: { type: 'string', example: 'Ahmed Hassan' },
          email: { type: 'string', format: 'email', example: 'ahmed@company.com' },
          phone: { type: 'string', example: '+966509876543' },
          department: { type: 'string', example: 'IT' },
          departmentId: { type: 'string' },
          jobTitle: { type: 'string', example: 'Software Engineer' },
          nationality: { type: 'string', example: 'Saudi' },
          nationalId: { type: 'string', example: '1098765432' },
          basicSalary: { type: 'number', example: 12000 },
          hireDate: { type: 'string', format: 'date', example: '2026-03-01' },
          contractType: { type: 'string', enum: ['Full-Time', 'Part-Time', 'Contract', 'Internship'], default: 'Full-Time' },
        },
      },
      UpdateEmployeeRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          department: { type: 'string' },
          departmentId: { type: 'string' },
          jobTitle: { type: 'string' },
          basicSalary: { type: 'number' },
          status: { type: 'string', enum: ['Active', 'Probation', 'Terminated', 'Resigned', 'On Leave', 'Suspended'] },
        },
      },

      // ── Attendance ──
      AttendanceRecord: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          tenantId: { type: 'string' },
          employeeId: { type: 'string' },
          date: { type: 'string', format: 'date', example: '2026-02-22' },
          type: { type: 'string', enum: ['CHECK_IN', 'CHECK_OUT'] },
          timestamp: { type: 'string', format: 'date-time' },
          location: { type: 'string' },
          notes: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CheckInRequest: {
        type: 'object',
        required: ['employeeId'],
        properties: {
          employeeId: { type: 'string', example: 'emp_a1b2c3' },
          location: { type: 'string', example: 'Main Office' },
          notes: { type: 'string', example: 'Arrived on time' },
        },
      },

      // ── Leave ──
      LeaveRequest: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          tenantId: { type: 'string' },
          employeeId: { type: 'string', example: 'emp_a1b2c3' },
          type: { type: 'string', enum: ['ANNUAL', 'SICK', 'MARRIAGE', 'PATERNITY', 'MATERNITY', 'BEREAVEMENT', 'HAJJ', 'UNPAID'], example: 'ANNUAL' },
          startDate: { type: 'string', format: 'date', example: '2026-03-10' },
          endDate: { type: 'string', format: 'date', example: '2026-03-14' },
          days: { type: 'integer', example: 5 },
          reason: { type: 'string', example: 'Family vacation' },
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateLeaveRequest: {
        type: 'object',
        required: ['employeeId', 'type', 'startDate', 'endDate'],
        properties: {
          employeeId: { type: 'string', example: 'emp_a1b2c3' },
          type: { type: 'string', enum: ['ANNUAL', 'SICK', 'MARRIAGE', 'PATERNITY', 'MATERNITY', 'BEREAVEMENT', 'HAJJ', 'UNPAID'] },
          startDate: { type: 'string', format: 'date', example: '2026-03-10' },
          endDate: { type: 'string', format: 'date', example: '2026-03-14' },
          reason: { type: 'string', example: 'Family vacation' },
        },
      },

      // ── Payroll ──
      PayrollSummary: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          tenantId: { type: 'string' },
          month: { type: 'integer', example: 2 },
          year: { type: 'integer', example: 2026 },
          totalBasicSalary: { type: 'number', example: 450000 },
          totalAllowances: { type: 'number', example: 120000 },
          totalDeductions: { type: 'number', example: 45000 },
          totalNetSalary: { type: 'number', example: 525000 },
          employeeCount: { type: 'integer', example: 45 },
          status: { type: 'string', enum: ['DRAFT', 'PROCESSING', 'COMPLETED', 'PAID'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      PaySlip: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          tenantId: { type: 'string' },
          employeeId: { type: 'string' },
          employeeName: { type: 'string', example: 'Omar Ali' },
          month: { type: 'integer', example: 2 },
          year: { type: 'integer', example: 2026 },
          basicSalary: { type: 'number', example: 12000 },
          housingAllowance: { type: 'number', example: 3000 },
          transportAllowance: { type: 'number', example: 1000 },
          otherAllowances: { type: 'number', example: 500 },
          gosiDeduction: { type: 'number', example: 1080 },
          otherDeductions: { type: 'number', example: 0 },
          netSalary: { type: 'number', example: 15420 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Performance ──
      PerformanceReview: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          tenantId: { type: 'string' },
          employeeId: { type: 'string' },
          cycleId: { type: 'string' },
          reviewerName: { type: 'string', example: 'Dr. Sarah Ahmed' },
          overallRating: { type: 'number', example: 4.2 },
          status: { type: 'string', enum: ['DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'COMPLETED'] },
          competencies: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Communication' },
                rating: { type: 'number', example: 4 },
                comment: { type: 'string' },
              },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ReviewCycle: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          tenantId: { type: 'string' },
          name: { type: 'string', example: 'H1 2026 Review Cycle' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['UPCOMING', 'ACTIVE', 'CLOSED'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Reports ──
      GOSIReport: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          tenantId: { type: 'string' },
          month: { type: 'integer', example: 2 },
          year: { type: 'integer', example: 2026 },
          totalContribution: { type: 'number', example: 35000 },
          employerShare: { type: 'number', example: 23000 },
          employeeShare: { type: 'number', example: 12000 },
          employeeCount: { type: 'integer', example: 45 },
        },
      },
      WPSReport: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          tenantId: { type: 'string' },
          month: { type: 'integer' },
          year: { type: 'integer' },
          totalTransferred: { type: 'number' },
          employeeCount: { type: 'integer' },
          bankFileGenerated: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      NitaqatStatus: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          tenantId: { type: 'string' },
          band: { type: 'string', enum: ['Platinum', 'Green High', 'Green Mid', 'Green Low', 'Yellow', 'Red'], example: 'Green High' },
          saudizationPercent: { type: 'number', example: 42.5 },
          totalEmployees: { type: 'integer', example: 45 },
          saudiEmployees: { type: 'integer', example: 19 },
          requiredPercent: { type: 'number', example: 35 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Recruitment ──
      JobOpening: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          tenantId: { type: 'string' },
          title: { type: 'string', example: 'Senior Nurse' },
          department: { type: 'string', example: 'Nursing' },
          status: { type: 'string', enum: ['OPEN', 'CLOSED', 'ON_HOLD', 'FILLED'] },
          applicantCount: { type: 'integer', example: 12 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Webhooks ──
      WebhookSubscription: {
        type: 'object',
        properties: {
          subscriptionId: { type: 'string', example: 'whk_a1b2c3d4e5f6' },
          tenantId: { type: 'string' },
          url: { type: 'string', format: 'uri', example: 'https://yourapp.com/webhooks/cvision' },
          events: { type: 'array', items: { type: 'string' }, example: ['employee.created', 'leave.approved'] },
          isActive: { type: 'boolean', example: true },
          failureCount: { type: 'integer', example: 0 },
          lastDelivery: { type: 'string', format: 'date-time' },
          lastStatus: { type: 'integer', example: 200 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateWebhookRequest: {
        type: 'object',
        required: ['url', 'events'],
        properties: {
          url: { type: 'string', format: 'uri', example: 'https://yourapp.com/webhooks/cvision' },
          events: {
            type: 'array',
            items: { type: 'string' },
            example: ['employee.created', 'employee.terminated', 'leave.approved'],
            description: 'List of event types to subscribe to. Use "*" for all events.',
          },
        },
      },
      WebhookEvent: {
        type: 'object',
        properties: {
          deliveryId: { type: 'string', example: 'evt_a1b2c3d4e5f6' },
          eventType: { type: 'string', example: 'employee.created' },
          deliveryStatus: { type: 'string', enum: ['PENDING', 'DELIVERED', 'FAILED', 'RETRYING'] },
          attempts: { type: 'integer', example: 1 },
          responseStatus: { type: 'integer', example: 200 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Tenant ──
      TenantInfo: {
        type: 'object',
        properties: {
          tenantId: { type: 'string', example: 'thea-health' },
          companyName: { type: 'string', example: 'Thea Health' },
          subscription: {
            type: 'object',
            properties: {
              plan: { type: 'string', enum: ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] },
              status: { type: 'string', enum: ['ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED', 'EXPIRED'] },
              features: { type: 'array', items: { type: 'string' } },
            },
          },
          settings: {
            type: 'object',
            properties: {
              language: { type: 'string', enum: ['en', 'ar', 'both'] },
              timezone: { type: 'string', example: 'Asia/Riyadh' },
              currency: { type: 'string', example: 'SAR' },
            },
          },
          branding: {
            type: 'object',
            properties: {
              primaryColor: { type: 'string', example: '#FF6B00' },
              secondaryColor: { type: 'string', example: '#1a1a2e' },
              logo: { type: 'string' },
            },
          },
        },
      },
      APIUsage: {
        type: 'object',
        properties: {
          employees: { type: 'integer', example: 45 },
          users: { type: 'integer', example: 8 },
          storage: { type: 'number', description: 'Storage in MB', example: 128 },
          apiCalls: { type: 'integer', description: 'API calls this month', example: 2450 },
          lastActivity: { type: 'string', format: 'date-time' },
        },
      },
    },

    // ── Reusable responses ──
    responses: {
      Unauthorized: {
        description: 'Missing or invalid API key',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header. Use: Bearer cvk_live_xxx' },
            },
          },
        },
      },
      Forbidden: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: { code: 'FORBIDDEN', message: 'API key lacks the "read:employees" permission.' },
            },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: { code: 'NOT_FOUND', message: 'Employee not found' },
            },
          },
        },
      },
      RateLimited: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please wait and try again.', retryAfter: 45 },
            },
          },
        },
      },
      ValidationError: {
        description: 'Request validation failed',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: { code: 'BAD_REQUEST', message: 'name is required' },
            },
          },
        },
      },
    },

    parameters: {
      PageParam: { name: 'page', in: 'query', schema: { type: 'integer', default: 1, minimum: 1 }, description: 'Page number' },
      LimitParam: { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 }, description: 'Items per page (max 100)' },
    },
  },

  // ────────────────────────────── Paths ───────────────────────────────

  paths: {
    // ── Employees ──────────────────────────────────────────────────────
    '/employees': {
      get: {
        tags: ['Employees'],
        summary: 'List employees',
        description: 'Retrieve a paginated list of employees. Supports filtering by department, status, and free-text search.\n\n**Permission:** `read:employees`',
        operationId: 'listEmployees',
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { name: 'department', in: 'query', schema: { type: 'string' }, description: 'Filter by department ID' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['Active', 'Probation', 'Terminated', 'Resigned', 'On Leave', 'Suspended'] }, description: 'Filter by employment status' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by name (EN/AR) or employee number' },
        ],
        responses: {
          200: {
            description: 'Employee list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Employee' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
      post: {
        tags: ['Employees'],
        summary: 'Create employee',
        description: 'Add a new employee to the organization.\n\n**Permission:** `write:employees`',
        operationId: 'createEmployee',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateEmployeeRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Employee created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Employee' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },

    '/employees/{id}': {
      get: {
        tags: ['Employees'],
        summary: 'Get employee',
        description: 'Retrieve a single employee by employee ID or employee number.\n\n**Permission:** `read:employees`',
        operationId: 'getEmployee',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Employee ID or employee number' },
        ],
        responses: {
          200: {
            description: 'Employee details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Employee' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
      put: {
        tags: ['Employees'],
        summary: 'Update employee',
        description: 'Update an existing employee\'s details.\n\n**Permission:** `write:employees`',
        operationId: 'updateEmployee',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Employee ID' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateEmployeeRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Employee updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Employee' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
      delete: {
        tags: ['Employees'],
        summary: 'Delete employee',
        description: 'Soft-delete an employee (sets deletedAt timestamp).\n\n**Permission:** `delete:employees`',
        operationId: 'deleteEmployee',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Employee ID' },
        ],
        responses: {
          200: {
            description: 'Employee deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: { deleted: { type: 'boolean', example: true } },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },

    // ── Attendance ─────────────────────────────────────────────────────
    '/attendance': {
      get: {
        tags: ['Attendance'],
        summary: 'List attendance records',
        description: 'Retrieve attendance records with optional filters.\n\n**Permission:** `read:attendance`',
        operationId: 'listAttendance',
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { name: 'employeeId', in: 'query', schema: { type: 'string' }, description: 'Filter by employee ID' },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Filter by date (YYYY-MM-DD)' },
        ],
        responses: {
          200: {
            description: 'Attendance records',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/AttendanceRecord' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/attendance/check-in': {
      post: {
        tags: ['Attendance'],
        summary: 'Clock in',
        description: 'Record a check-in for an employee.\n\n**Permission:** `write:attendance`',
        operationId: 'checkIn',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CheckInRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Check-in recorded',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/AttendanceRecord' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/attendance/check-out': {
      post: {
        tags: ['Attendance'],
        summary: 'Clock out',
        description: 'Record a check-out for an employee.\n\n**Permission:** `write:attendance`',
        operationId: 'checkOut',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CheckInRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Check-out recorded',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/AttendanceRecord' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },

    // ── Leaves ─────────────────────────────────────────────────────────
    '/leaves': {
      get: {
        tags: ['Leaves'],
        summary: 'List leave requests',
        description: 'Retrieve leave requests with optional filters.\n\n**Permission:** `read:leaves`',
        operationId: 'listLeaves',
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { name: 'employeeId', in: 'query', schema: { type: 'string' }, description: 'Filter by employee ID' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] }, description: 'Filter by status' },
        ],
        responses: {
          200: {
            description: 'Leave requests',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/LeaveRequest' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
      post: {
        tags: ['Leaves'],
        summary: 'Submit leave request',
        description: 'Create a new leave request (status will be PENDING).\n\n**Permission:** `write:leaves`',
        operationId: 'createLeave',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateLeaveRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Leave request created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/LeaveRequest' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/leaves/{id}/approve': {
      put: {
        tags: ['Leaves'],
        summary: 'Approve leave',
        description: 'Approve a pending leave request.\n\n**Permission:** `write:leaves`',
        operationId: 'approveLeave',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Leave request ID' },
        ],
        responses: {
          200: {
            description: 'Leave approved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/LeaveRequest' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/leaves/{id}/reject': {
      put: {
        tags: ['Leaves'],
        summary: 'Reject leave',
        description: 'Reject a pending leave request.\n\n**Permission:** `write:leaves`',
        operationId: 'rejectLeave',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Leave request ID' },
        ],
        responses: {
          200: {
            description: 'Leave rejected',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/LeaveRequest' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },

    // ── Payroll ────────────────────────────────────────────────────────
    '/payroll': {
      get: {
        tags: ['Payroll'],
        summary: 'List payroll summaries',
        description: 'Retrieve payroll run summaries filtered by month/year.\n\n**Permission:** `read:payroll`',
        operationId: 'listPayroll',
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { name: 'month', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 12 }, description: 'Month (1-12)' },
          { name: 'year', in: 'query', schema: { type: 'integer' }, description: 'Year (e.g. 2026)' },
        ],
        responses: {
          200: {
            description: 'Payroll summaries',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/PayrollSummary' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/payroll/slips': {
      get: {
        tags: ['Payroll'],
        summary: 'List pay slips',
        description: 'Retrieve employee pay slips. Optionally filter by employee.\n\n**Permission:** `read:payroll`',
        operationId: 'listPaySlips',
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { name: 'employeeId', in: 'query', schema: { type: 'string' }, description: 'Filter by employee ID' },
        ],
        responses: {
          200: {
            description: 'Pay slips',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/PaySlip' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },

    // ── Performance ────────────────────────────────────────────────────
    '/performance/reviews': {
      get: {
        tags: ['Performance'],
        summary: 'List performance reviews',
        description: 'Retrieve performance reviews (latest 50).\n\n**Permission:** `read:performance`',
        operationId: 'listReviews',
        responses: {
          200: {
            description: 'Performance reviews',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/PerformanceReview' } },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/performance/cycles': {
      get: {
        tags: ['Performance'],
        summary: 'List review cycles',
        description: 'Retrieve performance review cycles.\n\n**Permission:** `read:performance`',
        operationId: 'listCycles',
        responses: {
          200: {
            description: 'Review cycles',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/ReviewCycle' } },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },

    // ── Reports ────────────────────────────────────────────────────────
    '/reports/gosi': {
      get: {
        tags: ['Reports'],
        summary: 'GOSI report',
        description: 'Retrieve General Organization for Social Insurance (GOSI) contribution data.\n\n**Permission:** `read:reports`',
        operationId: 'getGOSIReport',
        parameters: [
          { name: 'month', in: 'query', schema: { type: 'integer' }, description: 'Month (1-12)' },
          { name: 'year', in: 'query', schema: { type: 'integer' }, description: 'Year' },
        ],
        responses: {
          200: {
            description: 'GOSI data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/GOSIReport' } },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/reports/wps': {
      get: {
        tags: ['Reports'],
        summary: 'WPS report',
        description: 'Retrieve Wage Protection System (WPS) transfer data.\n\n**Permission:** `read:reports`',
        operationId: 'getWPSReport',
        responses: {
          200: {
            description: 'WPS data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/WPSReport' } },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/reports/nitaqat': {
      get: {
        tags: ['Reports'],
        summary: 'Nitaqat status',
        description: 'Retrieve Saudization / Nitaqat band status and statistics.\n\n**Permission:** `read:reports`',
        operationId: 'getNitaqatStatus',
        responses: {
          200: {
            description: 'Nitaqat status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/NitaqatStatus' } },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },

    // ── Recruitment ────────────────────────────────────────────────────
    '/recruitment': {
      get: {
        tags: ['Recruitment'],
        summary: 'List job openings',
        description: 'Retrieve recruitment / job opening records.\n\n**Permission:** `read:recruitment`',
        operationId: 'listRecruitment',
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
        ],
        responses: {
          200: {
            description: 'Job openings',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/JobOpening' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
      post: {
        tags: ['Recruitment'],
        summary: 'Create job opening',
        description: 'Create a new recruitment / job opening.\n\n**Permission:** `write:recruitment`',
        operationId: 'createRecruitment',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'department'],
                properties: {
                  title: { type: 'string', example: 'Senior Nurse' },
                  department: { type: 'string', example: 'Nursing' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Job opening created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/JobOpening' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },

    // ── Webhooks ───────────────────────────────────────────────────────
    '/webhooks': {
      get: {
        tags: ['Webhooks'],
        summary: 'List webhook subscriptions',
        description: 'Retrieve all webhook subscriptions for your tenant.\n\n**Permission:** `manage:webhooks`',
        operationId: 'listWebhooks',
        responses: {
          200: {
            description: 'Webhook subscriptions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/WebhookSubscription' } },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
      post: {
        tags: ['Webhooks'],
        summary: 'Create webhook subscription',
        description: 'Subscribe to webhook events. The response includes a `secret` field — save it securely to verify incoming webhook signatures.\n\n**Permission:** `manage:webhooks`',
        operationId: 'createWebhook',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateWebhookRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Webhook created (secret returned once)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      allOf: [
                        { $ref: '#/components/schemas/WebhookSubscription' },
                        {
                          type: 'object',
                          properties: {
                            secret: { type: 'string', example: 'whsec_xxxxxxxxxxxxxxxxxxxxxxxx', description: 'Signing secret — returned only on creation' },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/ValidationError' },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/webhooks/events': {
      get: {
        tags: ['Webhooks'],
        summary: 'List available event types',
        description: 'Retrieve all available webhook event types and their descriptions.\n\n**Permission:** `manage:webhooks`',
        operationId: 'listWebhookEvents',
        responses: {
          200: {
            description: 'Event type catalog',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      example: {
                        'employee.created': 'New employee added',
                        'leave.approved': 'Leave request approved',
                        'payroll.processed': 'Payroll run completed',
                      },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/webhooks/{subscriptionId}': {
      delete: {
        tags: ['Webhooks'],
        summary: 'Delete webhook subscription',
        description: 'Remove a webhook subscription.\n\n**Permission:** `manage:webhooks`',
        operationId: 'deleteWebhook',
        parameters: [
          { name: 'subscriptionId', in: 'path', required: true, schema: { type: 'string' }, description: 'Subscription ID (whk_xxx)' },
        ],
        responses: {
          200: {
            description: 'Webhook deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'object', properties: { deleted: { type: 'boolean', example: true } } },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/webhooks/{subscriptionId}/test': {
      post: {
        tags: ['Webhooks'],
        summary: 'Test webhook',
        description: 'Send a test `test.ping` event to a webhook endpoint to verify connectivity.\n\n**Permission:** `manage:webhooks`',
        operationId: 'testWebhook',
        parameters: [
          { name: 'subscriptionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Test delivery result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        status: { type: 'integer', example: 200 },
                        body: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/webhooks/{subscriptionId}/history': {
      get: {
        tags: ['Webhooks'],
        summary: 'Webhook delivery history',
        description: 'Retrieve delivery history for a specific webhook subscription.\n\n**Permission:** `manage:webhooks`',
        operationId: 'getWebhookHistory',
        parameters: [
          { name: 'subscriptionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Delivery events',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { $ref: '#/components/schemas/WebhookEvent' } },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // ── Tenant ─────────────────────────────────────────────────────────
    '/tenant': {
      get: {
        tags: ['Tenant'],
        summary: 'Get tenant info',
        description: 'Retrieve your company / tenant information, subscription, settings, and branding.\n\n**Permission:** `read:tenant`',
        operationId: 'getTenant',
        responses: {
          200: {
            description: 'Tenant details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/TenantInfo' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/usage': {
      get: {
        tags: ['Tenant'],
        summary: 'API usage stats',
        description: 'Retrieve current resource usage — employees, users, storage, and API call counts.\n\n**Permission:** `read:tenant`',
        operationId: 'getUsage',
        responses: {
          200: {
            description: 'Usage statistics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/APIUsage' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
  },
};
