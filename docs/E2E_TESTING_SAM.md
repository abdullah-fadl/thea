# End-to-End Testing Guide: SAM Platform Routes

## 🎯 الهدف
التأكد من أن جميع SAM routes تُحفظ البيانات في `thea_tenant__1.sam_*` فقط، ولا يوجد أي touch لـ `hospital_ops` أو `policy_system`.

---

## 📋 سيناريوهات الاختبار

### 1. Upload (Single + Bulk)

#### Single Upload
- **Route**: `POST /api/sam/policy-engine/ingest`
- **Method**: FormData with file
- **Expected**: 
  - Document saved in `thea_tenant__1.sam_policy_documents`
  - NO document in `hospital_ops.policy_documents`

#### Bulk Upload
- **Route**: `POST /api/sam/policies/bulk-upload`
- **Method**: FormData with multiple files
- **Expected**:
  - All documents saved in `thea_tenant__1.sam_policy_documents`
  - NO documents in `hospital_ops.policy_documents`

**MongoDB Check**:
```javascript
// في thea_tenant__1
db.sam_policy_documents.find({}).sort({createdAt: -1}).limit(5)

// تأكد أنه لا يوجد في hospital_ops
// (إذا كان hospital_ops موجود في نفس cluster)
// use hospital_ops
// db.policy_documents.find({tenantId: "1"}).count() // يجب أن يكون 0
```

---

### 2. Library List + Search

#### List Policies
- **Route**: `GET /api/sam/policies/list`
- **Expected**: 
  - Returns policies from `thea_tenant__1.sam_policy_documents` only
  - Query uses `getTenantCollection(req, 'policy_documents', 'sam')`

**MongoDB Check**:
```javascript
// في thea_tenant__1
db.sam_policy_documents.find({isActive: true, tenantId: "1"}).count()
```

---

### 3. By Department Filter

#### Filter by Department
- **Route**: `GET /api/sam/policies/list?departmentId=<id>`
- **Expected**:
  - Filters by `departmentIds` array in `sam_policy_documents`
  - Returns only policies matching department

**MongoDB Check**:
```javascript
// في thea_tenant__1
db.sam_policy_documents.find({
  tenantId: "1",
  isActive: true,
  departmentIds: "<departmentId>"
}).count()
```

---

### 4. Rename

#### Rename Policy
- **Route**: `PATCH /api/sam/policies/[id]/rename`
- **Method**: `{filename: "new-name.pdf"}`
- **Expected**:
  - Updates `originalFileName` and `title` in `thea_tenant__1.sam_policy_documents`
  - NO update in `hospital_ops.policy_documents`

**MongoDB Check**:
```javascript
// في thea_tenant__1
db.sam_policy_documents.findOne({id: "<policyId>"})
// تأكد أن originalFileName و title تم تحديثهما
```

---

### 5. Archive / Unarchive

#### Archive
- **Route**: `POST /api/sam/policies/[id]/archive`
- **Expected**:
  - Sets `status: 'archived'`, `archivedAt`, `archivedBy` in `thea_tenant__1.sam_policy_documents`
  - NO update in `hospital_ops.policy_documents`

**MongoDB Check**:
```javascript
// في thea_tenant__1
db.sam_policy_documents.findOne({id: "<policyId>"})
// تأكد أن status = 'archived' و archivedAt موجود
```

---

### 6. Replace File

#### Replace Policy File
- **Route**: `POST /api/sam/policies/[id]/replace`
- **Method**: FormData with new file
- **Expected**:
  - Updates `filePath`, `storedFileName`, `fileSize` in `thea_tenant__1.sam_policy_documents`
  - NO update in `hospital_ops.policy_documents`

**MongoDB Check**:
```javascript
// في thea_tenant__1
db.sam_policy_documents.findOne({id: "<policyId>"})
// تأكد أن filePath و storedFileName تم تحديثهما
```

---

### 7. Bulk Actions / Bulk Operations

#### Bulk Actions
- **Route**: `POST /api/sam/policies/bulk-actions`
- **Method**: `{itemIds: [...], action: 'archive'|'delete'|'reclassify'}`
- **Expected**:
  - Updates multiple policies in `thea_tenant__1.sam_policy_documents`
  - NO updates in `hospital_ops.policy_documents`

#### Bulk Operations
- **Route**: `POST /api/sam/policies/bulk-operations`
- **Method**: `{itemIds: [...], operation: 'delete'|'archive'|'reclassify'}`
- **Expected**: Same as bulk-actions

**MongoDB Check**:
```javascript
// في thea_tenant__1
db.sam_policy_documents.find({
  id: {$in: ["<id1>", "<id2>", ...]},
  tenantId: "1"
})
// تأكد أن جميع policies تم تحديثها
```

---

### 8. Lifecycle Status + Alerts

#### Lifecycle Status
- **Route**: `POST /api/sam/policies/lifecycle/status`
- **Expected**:
  - Reads from `thea_tenant__1.sam_policy_documents`
  - Updates status based on expiry/review dates

#### Lifecycle Alerts
- **Route**: `GET /api/sam/policies/lifecycle/alerts`
- **Expected**:
  - Reads from `thea_tenant__1.sam_policy_documents`
  - Returns alerts based on expiry/review dates

**MongoDB Check**:
```javascript
// في thea_tenant__1
db.sam_policy_documents.find({
  tenantId: "1",
  isActive: true,
  $or: [
    {expiryDate: {$lte: new Date()}},
    {nextReviewDate: {$lte: new Date()}}
  ]
}).count()
```

---

### 9. Fix Entity Type

#### Fix Entity Type
- **Route**: `POST /api/sam/policies/fix-entity-type`
- **Method**: `{fileName: "...", entityType: "sop"}`
- **Expected**:
  - Updates `entityType` in `thea_tenant__1.sam_policy_documents`
  - NO update in `hospital_ops.policy_documents`

**MongoDB Check**:
```javascript
// في thea_tenant__1
db.sam_policy_documents.findOne({
  originalFileName: "<fileName>",
  tenantId: "1"
})
// تأكد أن entityType تم تحديثه
```

---

## 🔍 مراقبة MongoDB Atlas

### أثناء الاختبار:

1. **افتح MongoDB Atlas Compass** أو **MongoDB Shell**

2. **راقب Collections التالية**:
   ```javascript
   // ✅ يجب أن توجد البيانات هنا:
   use thea_tenant__1
   db.sam_policy_documents.find({}).count()
   db.sam_taxonomy_operations.find({}).count()
   db.sam_taxonomy_functions.find({}).count()
   db.sam_taxonomy_risk_domains.find({}).count()
   
   // ❌ يجب أن لا توجد بيانات جديدة هنا:
   // (إذا كان hospital_ops موجود في نفس cluster)
   use hospital_ops
   db.policy_documents.find({tenantId: "1"}).count() // يجب أن يكون 0
   ```

3. **راقب Operations Logs في MongoDB Atlas**:
   - افتح **Metrics** → **Operations**
   - ابحث عن `insert` و `update` operations
   - تأكد أن جميع operations على `thea_tenant__1` database

---

## 📊 Checklist للاختبار

- [ ] Upload (Single) → `thea_tenant__1.sam_policy_documents`
- [ ] Upload (Bulk) → `thea_tenant__1.sam_policy_documents`
- [ ] List → Reads from `thea_tenant__1.sam_policy_documents`
- [ ] Search → Reads from `thea_tenant__1.sam_policy_documents`
- [ ] By Department Filter → Filters `thea_tenant__1.sam_policy_documents`
- [ ] Rename → Updates `thea_tenant__1.sam_policy_documents`
- [ ] Archive → Updates `thea_tenant__1.sam_policy_documents`
- [ ] Replace → Updates `thea_tenant__1.sam_policy_documents`
- [ ] Bulk Actions → Updates `thea_tenant__1.sam_policy_documents`
- [ ] Bulk Operations → Updates `thea_tenant__1.sam_policy_documents`
- [ ] Lifecycle Status → Reads/Updates `thea_tenant__1.sam_policy_documents`
- [ ] Lifecycle Alerts → Reads `thea_tenant__1.sam_policy_documents`
- [ ] Fix Entity Type → Updates `thea_tenant__1.sam_policy_documents`
- [ ] NO writes to `hospital_ops.policy_documents`
- [ ] NO writes to `policy_system.*`

---

## 🐛 إذا ظهر Mismatch

إذا لاحظت أن البيانات تُحفظ في مكان خاطئ:

1. **سجّل**:
   - Route: `/api/sam/policies/...`
   - HTTP Method: `POST` / `GET` / `PATCH`
   - Request Payload: `{...}`
   - Database: `hospital_ops` / `policy_system` / etc.
   - Collection: `policy_documents` / `taxonomy_*` / etc.

2. **أرسل**:
   ```
   Route: POST /api/sam/policies/bulk-actions
   Payload: {itemIds: [...], action: 'archive'}
   Database: hospital_ops (❌ خطأ)
   Collection: policy_documents
   Expected: thea_tenant__1.sam_policy_documents
   ```

---

## ✅ Verification Script (بعد E2E)

بعد ما نضمن أن كل شيء شغال، سنعمل script للتحقق التلقائي:

```typescript
// scripts/verify-sam-routes.ts
// Checks that all SAM routes use getTenantCollection
// Checks that no routes use getCollection('policy_documents')
// Checks MongoDB directly to verify data location
```
