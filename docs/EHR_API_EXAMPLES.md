# EHR Core API - Example cURL Commands

This document provides example cURL commands for all EHR Core API endpoints.

**Base URL**: `http://localhost:3000/api/admin`

**Authentication**: All requests require authentication via cookie `auth-token` (set after login).

---

## 1. Create EHR User

**POST** `/api/admin/ehr/users`

```bash
curl -X POST http://localhost:3000/api/admin/ehr/users \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{
    "userId": "user-uuid-from-core-users",
    "email": "doctor@hospital.com",
    "firstName": "John",
    "lastName": "Doe",
    "licenseNumber": "MD12345",
    "specialty": "Cardiology",
    "npi": "1234567890",
    "title": "Dr.",
    "department": "Cardiology",
    "role": "PHYSICIAN"
  }'
```

---

## 2. Create Patient

**POST** `/api/admin/patients`

```bash
curl -X POST http://localhost:3000/api/admin/patients \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{
    "mrn": "MRN-2025-001",
    "firstName": "Jane",
    "middleName": "Marie",
    "lastName": "Smith",
    "dateOfBirth": "1985-06-15",
    "gender": "FEMALE",
    "phone": "+1234567890",
    "email": "jane.smith@example.com",
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA"
    },
    "nationalId": "123456789",
    "insuranceId": "INS-12345",
    "insuranceProvider": "Blue Cross"
  }'
```

---

## 3. Get Patient by ID

**GET** `/api/admin/patients/{id}`

```bash
curl -X GET "http://localhost:3000/api/admin/patients/patient-uuid-here" \
  -H "Cookie: auth-token=YOUR_TOKEN"
```

---

## 4. Create Encounter

**POST** `/api/admin/encounters`

```bash
curl -X POST http://localhost:3000/api/admin/encounters \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{
    "patientId": "patient-uuid-here",
    "mrn": "MRN-2025-001",
    "encounterType": "INPATIENT",
    "admissionDate": "2025-01-15T10:00:00.000Z",
    "department": "Cardiology",
    "service": "Cardiac Care",
    "location": "Room 101, Bed A",
    "attendingPhysicianId": "physician-uuid-here",
    "admittingPhysicianId": "physician-uuid-here",
    "chiefComplaint": "Chest pain",
    "primaryDiagnosis": "Acute coronary syndrome",
    "diagnosisCodes": ["I21.9"]
  }'
```

---

## 5. Create Order

**POST** `/api/admin/orders`

```bash
curl -X POST http://localhost:3000/api/admin/orders \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{
    "patientId": "patient-uuid-here",
    "mrn": "MRN-2025-001",
    "encounterId": "encounter-uuid-here",
    "orderType": "MEDICATION",
    "description": "Aspirin 81mg daily",
    "code": "314076",
    "codeSystem": "SNOMED",
    "orderedBy": "physician-uuid-here",
    "priority": "ROUTINE",
    "instructions": "Take with food",
    "frequency": "Daily",
    "quantity": "30 tablets",
    "duration": "30 days"
  }'
```

---

## 6. Create Task

**POST** `/api/admin/tasks`

```bash
curl -X POST http://localhost:3000/api/admin/tasks \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{
    "patientId": "patient-uuid-here",
    "mrn": "MRN-2025-001",
    "encounterId": "encounter-uuid-here",
    "orderId": "order-uuid-here",
    "title": "Review lab results",
    "description": "Patient CBC results need physician review",
    "taskType": "CLINICAL",
    "assignedTo": "physician-uuid-here",
    "department": "Cardiology",
    "priority": "HIGH",
    "dueDate": "2025-01-16T09:00:00.000Z",
    "notes": "Results available in lab system"
  }'
```

---

## 7. Create Note

**POST** `/api/admin/notes`

```bash
curl -X POST http://localhost:3000/api/admin/notes \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{
    "patientId": "patient-uuid-here",
    "mrn": "MRN-2025-001",
    "encounterId": "encounter-uuid-here",
    "noteType": "PROGRESS",
    "title": "Daily Progress Note",
    "content": "Patient is doing well. Vital signs stable. Continue current treatment plan.",
    "authoredBy": "physician-uuid-here",
    "authorName": "Dr. John Doe",
    "authorTitle": "MD",
    "status": "FINAL",
    "sections": [
      {
        "section": "SUBJECTIVE",
        "content": "Patient reports feeling better"
      },
      {
        "section": "OBJECTIVE",
        "content": "Vital signs: BP 120/80, HR 72, O2 sat 98%"
      },
      {
        "section": "ASSESSMENT",
        "content": "Stable condition"
      },
      {
        "section": "PLAN",
        "content": "Continue current medications"
      }
    ]
  }'
```

---

## 8. Grant Privilege

**POST** `/api/admin/privileges/grant`

```bash
curl -X POST http://localhost:3000/api/admin/privileges/grant \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{
    "userId": "user-uuid-here",
    "resource": "patient",
    "action": "view",
    "scope": "department",
    "departmentId": "cardiology-dept-id",
    "expiresAt": "2025-12-31T23:59:59.000Z"
  }'
```

---

## 9. Revoke Privilege

**POST** `/api/admin/privileges/revoke`

```bash
curl -X POST http://localhost:3000/api/admin/privileges/revoke \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{
    "privilegeId": "privilege-uuid-here"
  }'
```

---

## 10. Get Audit Logs

**GET** `/api/admin/audit`

```bash
# Get all audit logs (last 100)
curl -X GET "http://localhost:3000/api/admin/audit?limit=100" \
  -H "Cookie: auth-token=YOUR_TOKEN"

# Filter by user
curl -X GET "http://localhost:3000/api/admin/audit?userId=user-uuid-here" \
  -H "Cookie: auth-token=YOUR_TOKEN"

# Filter by resource type
curl -X GET "http://localhost:3000/api/admin/audit?resourceType=patient" \
  -H "Cookie: auth-token=YOUR_TOKEN"

# Filter by patient
curl -X GET "http://localhost:3000/api/admin/audit?patientId=patient-uuid-here" \
  -H "Cookie: auth-token=YOUR_TOKEN"

# Filter by date range
curl -X GET "http://localhost:3000/api/admin/audit?startDate=2025-01-01T00:00:00.000Z&endDate=2025-01-31T23:59:59.000Z" \
  -H "Cookie: auth-token=YOUR_TOKEN"

# Combined filters
curl -X GET "http://localhost:3000/api/admin/audit?resourceType=patient&startDate=2025-01-01T00:00:00.000Z&limit=50" \
  -H "Cookie: auth-token=YOUR_TOKEN"
```

---

## Response Formats

### Success Response (201 for POST, 200 for GET)

```json
{
  "success": true,
  "patient": { ... },
  // or "user", "encounter", "order", "task", "note", "privilege"
  // or "logs": [ ... ], "count": 10 for audit endpoint
}
```

### Error Response (400/404/500)

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "mrn",
      "message": "mrn is required"
    }
  ]
}
```

---

## Notes

1. All timestamps must be in ISO 8601 format (e.g., `2025-01-15T10:00:00.000Z`)
2. All dates must be in YYYY-MM-DD format (e.g., `2025-01-15`)
3. Authentication is required for all endpoints (via `auth-token` cookie)
4. All mutations automatically create audit log entries
5. UUIDs should be valid UUID v4 format
6. MRN (Medical Record Number) must be unique per patient

