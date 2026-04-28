-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('THEA_OWNER', 'ADMIN', 'GROUP_ADMIN', 'HOSPITAL_ADMIN', 'SUPERVISOR', 'STAFF', 'VIEWER');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('DEMO', 'TRIAL', 'PAID', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "PatientGender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PatientMasterStatus" AS ENUM ('KNOWN', 'UNKNOWN', 'MERGED');

-- CreateEnum
CREATE TYPE "EncounterType" AS ENUM ('ER', 'OPD', 'IPD', 'PROCEDURE');

-- CreateEnum
CREATE TYPE "EncounterCoreStatus" AS ENUM ('CREATED', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "EncounterSourceSystem" AS ENUM ('REGISTRATION', 'ER', 'IPD', 'OPD');

-- CreateEnum
CREATE TYPE "OpdVisitType" AS ENUM ('FVC', 'FVH', 'FU', 'RV', 'REF');

-- CreateEnum
CREATE TYPE "OpdFlowState" AS ENUM ('ARRIVED', 'WAITING_NURSE', 'IN_NURSING', 'READY_FOR_DOCTOR', 'WAITING_DOCTOR', 'IN_DOCTOR', 'PROCEDURE_PENDING', 'PROCEDURE_DONE_WAITING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OpdArrivalState" AS ENUM ('NOT_ARRIVED', 'ARRIVED', 'IN_ROOM', 'LEFT');

-- CreateEnum
CREATE TYPE "OpdArrivalSource" AS ENUM ('RECEPTION', 'PATIENT', 'WALK_IN', 'APPOINTMENT', 'REFERRAL', 'TRANSFER');

-- CreateEnum
CREATE TYPE "OpdStatus" AS ENUM ('OPEN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OpdPaymentStatus" AS ENUM ('PAID', 'SKIPPED', 'PENDING');

-- CreateEnum
CREATE TYPE "OpdPaymentServiceType" AS ENUM ('CONSULTATION', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "OpdPaymentMethod" AS ENUM ('CASH', 'CARD', 'ONLINE');

-- CreateEnum
CREATE TYPE "OpdDoctorNoteType" AS ENUM ('SOAP', 'FREE');

-- CreateEnum
CREATE TYPE "OpdFallRiskLabel" AS ENUM ('LOW', 'MED', 'HIGH');

-- CreateEnum
CREATE TYPE "OpdDispositionType" AS ENUM ('OPD_REFERRAL', 'ER_REFERRAL', 'ADMISSION');

-- CreateEnum
CREATE TYPE "OpdPriority" AS ENUM ('URGENT', 'HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "ErStatus" AS ENUM ('ARRIVED', 'REGISTERED', 'TRIAGE_IN_PROGRESS', 'TRIAGE_COMPLETED', 'WAITING_BED', 'IN_BED', 'SEEN_BY_DOCTOR', 'ORDERS_IN_PROGRESS', 'RESULTS_PENDING', 'DECISION', 'DISCHARGED', 'ADMITTED', 'TRANSFERRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ErArrivalMethod" AS ENUM ('WALKIN', 'AMBULANCE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "ErPaymentStatus" AS ENUM ('INSURANCE', 'CASH', 'PENDING');

-- CreateEnum
CREATE TYPE "ErBedState" AS ENUM ('VACANT', 'OCCUPIED', 'CLEANING', 'RESERVED');

-- CreateEnum
CREATE TYPE "ErStaffAssignmentRole" AS ENUM ('PRIMARY_DOCTOR', 'PRIMARY_NURSE', 'TRIAGE_NURSE');

-- CreateEnum
CREATE TYPE "CvisionRequestType" AS ENUM ('LEAVE', 'SALARY_CERTIFICATE', 'EMPLOYMENT_LETTER', 'EXPENSE_CLAIM', 'COMPLAINT', 'TRANSFER', 'TRAINING', 'EQUIPMENT', 'PAYROLL_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "CvisionRequestStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ESCALATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CvisionRequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CvisionAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EARLY_LEAVE', 'ON_LEAVE', 'HOLIDAY', 'REST_DAY');

-- CreateEnum
CREATE TYPE "CvisionShiftType" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'SPLIT', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "CvisionScheduleApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CvisionEmployeeStatus" AS ENUM ('ACTIVE', 'PROBATION', 'ON_ANNUAL_LEAVE', 'ON_SICK_LEAVE', 'ON_MATERNITY_LEAVE', 'ON_UNPAID_LEAVE', 'SUSPENDED', 'SUSPENDED_WITHOUT_PAY', 'NOTICE_PERIOD', 'RESIGNED', 'TERMINATED', 'END_OF_CONTRACT', 'RETIRED', 'DECEASED');

-- CreateEnum
CREATE TYPE "CvisionGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "CvisionEmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP');

-- CreateEnum
CREATE TYPE "CvisionContractType" AS ENUM ('PERMANENT', 'FIXED_TERM', 'LOCUM', 'PART_TIME', 'INTERN');

-- CreateEnum
CREATE TYPE "CvisionContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED');

-- CreateEnum
CREATE TYPE "CvisionLeaveType" AS ENUM ('ANNUAL', 'SICK', 'UNPAID', 'MATERNITY', 'PATERNITY', 'MARRIAGE', 'BEREAVEMENT', 'HAJJ', 'COMPASSIONATE', 'STUDY', 'OTHER');

-- CreateEnum
CREATE TYPE "CvisionLeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CvisionLoanStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAID_OFF', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CvisionPayrollRunStatus" AS ENUM ('DRAFT', 'DRY_RUN', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "CvisionRequisitionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CvisionRequisitionReason" AS ENUM ('NEW_POSITION', 'REPLACEMENT', 'BACKFILL', 'EXPANSION', 'OTHER');

-- CreateEnum
CREATE TYPE "CvisionCandidateStatus" AS ENUM ('APPLIED', 'NEW', 'SCREENING', 'SCREENED', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CvisionCandidateSource" AS ENUM ('PORTAL', 'REFERRAL', 'AGENCY', 'DIRECT', 'OTHER', 'CV_INBOX', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "CvisionInterviewType" AS ENUM ('PHONE', 'VIDEO', 'IN_PERSON', 'TECHNICAL', 'PANEL', 'HR');

-- CreateEnum
CREATE TYPE "CvisionInterviewStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CvisionOfferStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'NEGOTIATING', 'APPROVED', 'REJECTED', 'HR_REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CvisionCvParseStatus" AS ENUM ('QUEUED', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "CvisionCvInboxItemStatus" AS ENUM ('UPLOADED', 'PARSED', 'SUGGESTED', 'ASSIGNED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImdadAdjustmentReason" AS ENUM ('PHYSICAL_COUNT', 'DAMAGE', 'EXPIRY', 'THEFT', 'SYSTEM_CORRECTION', 'RETURN', 'DONATION', 'SAMPLE', 'TRANSFER_CORRECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "ImdadAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ImdadAnnualPlanStatus" AS ENUM ('DRAFT', 'DEPARTMENT_REVIEW', 'HOSPITAL_REVIEW', 'CORPORATE_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "ImdadApprovalDocumentType" AS ENUM ('PURCHASE_REQUISITION', 'PURCHASE_ORDER', 'CONTRACT', 'BUDGET', 'ASSET_DISPOSAL', 'BUDGET_TRANSFER', 'INVOICE');

-- CreateEnum
CREATE TYPE "ImdadApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DELEGATED', 'ESCALATED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "ImdadApproverType" AS ENUM ('SPECIFIC_USER', 'ROLE', 'DEPARTMENT_HEAD', 'COST_CENTER_OWNER');

-- CreateEnum
CREATE TYPE "ImdadAssetStatus" AS ENUM ('IN_SERVICE', 'OUT_OF_SERVICE', 'UNDER_MAINTENANCE', 'CALIBRATION_DUE', 'CONDEMNED', 'DISPOSED', 'IN_STORAGE', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "ImdadAttachmentCategory" AS ENUM ('VENDOR_DOCUMENT', 'CONTRACT', 'INVOICE', 'GRN_PHOTO', 'QUALITY_CERTIFICATE', 'SFDA_REGISTRATION', 'INSURANCE_CERTIFICATE', 'DELIVERY_NOTE', 'CORRESPONDENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "ImdadAuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'SUBMIT', 'RECEIVE', 'DISPENSE', 'TRANSFER', 'ADJUST', 'RESERVE', 'RELEASE', 'OVERRIDE', 'ESCALATE', 'CONFIGURE', 'LOGIN', 'EXPORT', 'IMPORT_DATA');

-- CreateEnum
CREATE TYPE "ImdadAuditOutcome" AS ENUM ('COMPLIANT', 'MINOR_FINDINGS', 'MAJOR_FINDINGS', 'CRITICAL_FINDINGS', 'NON_COMPLIANT');

-- CreateEnum
CREATE TYPE "ImdadBatchStatus" AS ENUM ('ACTIVE', 'QUARANTINE', 'EXPIRED', 'CONSUMED', 'RECALLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ImdadBenchmarkMetric" AS ENUM ('COST_PER_BED', 'EQUIPMENT_AGE_RATIO', 'MAINTENANCE_COST_RATIO', 'SUPPLY_COST_PER_PATIENT', 'UTILIZATION_RATE', 'DOWNTIME_RATIO', 'PROCUREMENT_CYCLE_TIME', 'BUDGET_VARIANCE');

-- CreateEnum
CREATE TYPE "ImdadBinStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ImdadBudgetPeriodType" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'PROJECT');

-- CreateEnum
CREATE TYPE "ImdadBudgetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'FROZEN', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImdadBudgetTransferStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "ImdadCertificateType" AS ENUM ('SFDA_REGISTRATION', 'GMP_CERTIFICATE', 'ISO_CERTIFICATE', 'HALAL_CERTIFICATE', 'COA', 'COC', 'INSURANCE', 'IMPORT_LICENSE', 'STORAGE_LICENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "ImdadChargeStatus" AS ENUM ('PENDING', 'CHARGED', 'REVERSED', 'VOIDED', 'BILLED');

-- CreateEnum
CREATE TYPE "ImdadChargeType" AS ENUM ('CONSUMPTION', 'REQUISITION', 'PO_RECEIPT', 'RETURN_CREDIT', 'ADJUSTMENT', 'WASTE', 'INTERDEPT');

-- CreateEnum
CREATE TYPE "ImdadConfigScope" AS ENUM ('GLOBAL', 'ORGANIZATION', 'DEPARTMENT', 'USER');

-- CreateEnum
CREATE TYPE "ImdadContractStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'TERMINATED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ImdadContractType" AS ENUM ('SUPPLY_AGREEMENT', 'FRAMEWORK_AGREEMENT', 'SERVICE_AGREEMENT', 'CONSIGNMENT', 'BLANKET_ORDER');

-- CreateEnum
CREATE TYPE "ImdadCycleCountFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ImdadDecisionActionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImdadDecisionActionType" AS ENUM ('PURCHASE_REQUISITION', 'TRANSFER_REQUEST', 'MAINTENANCE_ORDER', 'VENDOR_EVALUATION', 'BUDGET_REALLOCATION', 'ALERT_NOTIFICATION', 'SCHEDULE_INSPECTION', 'EMERGENCY_ORDER', 'DISPOSAL_REQUEST', 'CONTRACT_RENEWAL');

-- CreateEnum
CREATE TYPE "ImdadDecisionStatus" AS ENUM ('GENERATED', 'PENDING_REVIEW', 'AUTO_APPROVED', 'APPROVED', 'REJECTED', 'EXECUTING', 'COMPLETED', 'OVERRIDDEN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ImdadDecisionType" AS ENUM ('DEVICE_REPLACEMENT', 'BUDGET_ALLOCATION', 'SUPPLY_REORDER', 'VENDOR_SWITCH', 'RISK_MITIGATION', 'COST_OPTIMIZATION', 'PHASED_INVESTMENT', 'COMPLIANCE_ACTION', 'CAPACITY_EXPANSION', 'EMERGENCY_PROCUREMENT');

-- CreateEnum
CREATE TYPE "ImdadDelegationType" AS ENUM ('FULL', 'APPROVAL_ONLY', 'VIEW_ONLY', 'SPECIFIC');

-- CreateEnum
CREATE TYPE "ImdadDepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'DECLINING_BALANCE', 'SUM_OF_YEARS', 'UNITS_OF_PRODUCTION');

-- CreateEnum
CREATE TYPE "ImdadDeviceReplacementUrgency" AS ENUM ('IMMEDIATE', 'WITHIN_6_MONTHS', 'WITHIN_1_YEAR', 'WITHIN_2_YEARS', 'WITHIN_3_YEARS', 'MONITOR_ONLY');

-- CreateEnum
CREATE TYPE "ImdadDiscrepancyResolution" AS ENUM ('ACCEPT_AS_IS', 'RETURN_TO_VENDOR', 'CREDIT_NOTE', 'REPLACEMENT', 'PARTIAL_ACCEPT');

-- CreateEnum
CREATE TYPE "ImdadDispenseStatus" AS ENUM ('PENDING', 'PICKING', 'PICKED', 'VERIFIED', 'DISPENSED', 'PARTIALLY_DISPENSED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImdadDisposalMethod" AS ENUM ('SOLD', 'DONATED', 'SCRAPPED', 'RETURNED_VENDOR', 'TRADED_IN', 'RECYCLED');

-- CreateEnum
CREATE TYPE "ImdadEscalationLevel" AS ENUM ('NONE', 'DEPARTMENT', 'HOSPITAL', 'CORPORATE');

-- CreateEnum
CREATE TYPE "ImdadEventBusChannel" AS ENUM ('INVENTORY', 'PROCUREMENT', 'WAREHOUSE', 'FINANCIAL', 'CLINICAL', 'QUALITY', 'ASSET', 'ANALYTICS', 'PLATFORM');

-- CreateEnum
CREATE TYPE "ImdadEventBusStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "ImdadFormularyStatus" AS ENUM ('ACTIVE', 'RESTRICTED', 'NON_FORMULARY', 'DISCONTINUED', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "ImdadGRNStatus" AS ENUM ('DRAFT', 'PENDING_QC', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImdadInspectionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'CONDITIONAL_PASS', 'CANCELLED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "ImdadInspectionType" AS ENUM ('INCOMING', 'IN_PROCESS', 'OUTGOING', 'RANDOM', 'COMPLAINT_DRIVEN', 'PERIODIC', 'RECALL');

-- CreateEnum
CREATE TYPE "ImdadInvestmentPhase" AS ENUM ('PHASE_1', 'PHASE_2', 'PHASE_3', 'SINGLE_PHASE');

-- CreateEnum
CREATE TYPE "ImdadInvoiceStatus" AS ENUM ('DRAFT', 'RECEIVED', 'VERIFIED', 'MATCHED', 'DISPUTED', 'APPROVED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ImdadItemStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED', 'PENDING_APPROVAL', 'RECALLED');

-- CreateEnum
CREATE TYPE "ImdadItemType" AS ENUM ('PHARMACEUTICAL', 'MEDICAL_SUPPLY', 'MEDICAL_DEVICE', 'LABORATORY', 'SURGICAL', 'GENERAL', 'FOOD_SERVICE', 'MAINTENANCE', 'IT_EQUIPMENT', 'FURNITURE', 'LINEN', 'CLEANING', 'IMPLANT', 'REAGENT');

-- CreateEnum
CREATE TYPE "ImdadKpiPeriodType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ImdadMaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "ImdadMaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'CALIBRATION', 'SAFETY_CHECK', 'UPGRADE', 'INSTALLATION');

-- CreateEnum
CREATE TYPE "ImdadMovementType" AS ENUM ('RECEIPT', 'ISSUE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN_TO_VENDOR', 'RETURN_FROM_DEPARTMENT', 'WRITE_OFF', 'DISPENSING', 'CONSUMPTION');

-- CreateEnum
CREATE TYPE "ImdadNotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "ImdadNotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ImdadPOStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'INVOICED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImdadPRStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'CANCELLED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "ImdadPaymentMethod" AS ENUM ('BANK_TRANSFER', 'CHECK', 'ELECTRONIC', 'CREDIT_CARD', 'CASH');

-- CreateEnum
CREATE TYPE "ImdadPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'SUBMITTED', 'PROCESSED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImdadPermissionCategory" AS ENUM ('INVENTORY', 'PROCUREMENT', 'WAREHOUSE', 'FINANCIAL', 'CLINICAL', 'QUALITY', 'ASSET', 'ANALYTICS', 'ADMIN', 'VENDOR_PORTAL');

-- CreateEnum
CREATE TYPE "ImdadPickStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'PICKED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImdadPlatformKey" AS ENUM ('IMDAD');

-- CreateEnum
CREATE TYPE "ImdadProposalCategory" AS ENUM ('CAPITAL_EQUIPMENT', 'OPERATIONAL_SUPPLY', 'MAINTENANCE_CONTRACT', 'TECHNOLOGY_UPGRADE', 'FACILITY_IMPROVEMENT', 'STAFFING', 'TRAINING', 'REGULATORY_COMPLIANCE', 'EMERGENCY_RESERVE');

-- CreateEnum
CREATE TYPE "ImdadProposalPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'DEFERRED');

-- CreateEnum
CREATE TYPE "ImdadPutAwayStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImdadRecallSeverity" AS ENUM ('CLASS_I', 'CLASS_II', 'CLASS_III', 'VOLUNTARY');

-- CreateEnum
CREATE TYPE "ImdadRecallStatus" AS ENUM ('DRAFT', 'INITIATED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImdadReceivingDockStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED');

-- CreateEnum
CREATE TYPE "ImdadReorderMethod" AS ENUM ('MIN_MAX', 'PAR_LEVEL', 'ECONOMIC_ORDER_QTY', 'DEMAND_FORECAST', 'MANUAL');

-- CreateEnum
CREATE TYPE "ImdadReturnReason" AS ENUM ('PATIENT_DISCHARGE', 'MEDICATION_CHANGE', 'ADVERSE_REACTION', 'EXPIRED', 'DAMAGED', 'DUPLICATE_ORDER', 'CANCELLED_ORDER', 'OTHER');

-- CreateEnum
CREATE TYPE "ImdadRoleType" AS ENUM ('IMDAD_CORPORATE_DIRECTOR', 'IMDAD_CORPORATE_MANAGER', 'IMDAD_CORPORATE_ANALYST', 'IMDAD_CORPORATE_AUDITOR', 'IMDAD_HOSPITAL_DIRECTOR', 'IMDAD_HOSPITAL_MANAGER', 'IMDAD_PROCUREMENT_OFFICER', 'IMDAD_PROCUREMENT_STAFF', 'IMDAD_WAREHOUSE_MANAGER', 'IMDAD_WAREHOUSE_STAFF', 'IMDAD_INVENTORY_MANAGER', 'IMDAD_INVENTORY_STAFF', 'IMDAD_QUALITY_OFFICER', 'IMDAD_BUDGET_CONTROLLER', 'IMDAD_DEPARTMENT_REQUESTER', 'IMDAD_DEPARTMENT_HEAD', 'IMDAD_NURSE_REQUESTER', 'IMDAD_PHARMACIST', 'IMDAD_CABINET_TECHNICIAN', 'IMDAD_VENDOR_PORTAL', 'IMDAD_ASSET_MANAGER', 'IMDAD_FINANCE_OFFICER', 'IMDAD_COMPLIANCE_OFFICER', 'IMDAD_VIEWER');

-- CreateEnum
CREATE TYPE "ImdadSessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ImdadSignalSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "ImdadSignalType" AS ENUM ('LIFECYCLE_BREACH', 'FAILURE_SPIKE', 'STOCKOUT_RISK', 'EXPIRY_WARNING', 'BUDGET_OVERRUN', 'COMPLIANCE_GAP', 'DEMAND_SURGE', 'VENDOR_RISK', 'TEMPERATURE_BREACH', 'COMPATIBILITY_GAP', 'UTILIZATION_DROP', 'MAINTENANCE_COST_SPIKE', 'SAFETY_ALERT', 'RECALL_TRIGGER');

-- CreateEnum
CREATE TYPE "ImdadStockCountStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImdadSupplyRequestPriority" AS ENUM ('ROUTINE', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ImdadSupplyRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_APPROVAL', 'APPROVED', 'REJECTED', 'PO_GENERATED', 'WORK_ORDER_CREATED', 'TRANSFER_INITIATED', 'BUDGET_APPROVED', 'COMPLETED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "ImdadSupplyRequestType" AS ENUM ('SUPPLY_REQUEST', 'MAINTENANCE_REQUEST', 'TRANSFER_REQUEST', 'BUDGET_REQUEST', 'REPLENISHMENT_REQUEST');

-- CreateEnum
CREATE TYPE "ImdadTemperatureZone" AS ENUM ('AMBIENT', 'COOL', 'FROZEN', 'DEEP_FROZEN', 'CONTROLLED_ROOM');

-- CreateEnum
CREATE TYPE "ImdadTransferStatus" AS ENUM ('DRAFT', 'REQUESTED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImdadTransferType" AS ENUM ('INTER_WAREHOUSE', 'INTER_DEPARTMENT', 'ZONE_TO_ZONE', 'REPLENISHMENT', 'RETURN', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ImdadUoMType" AS ENUM ('COUNT', 'EACH', 'PACK', 'BOX', 'CASE', 'PALLET', 'WEIGHT', 'MG', 'G', 'KG', 'VOLUME', 'ML', 'L', 'LENGTH', 'CM', 'M', 'AREA', 'SQM');

-- CreateEnum
CREATE TYPE "ImdadVendorStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'CONDITIONAL', 'PROBATION', 'SUSPENDED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "ImdadVendorTier" AS ENUM ('PREFERRED', 'APPROVED', 'CONDITIONAL', 'PROBATION', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ImdadWarehouseZoneType" AS ENUM ('GENERAL', 'COLD_CHAIN', 'CONTROLLED', 'HAZMAT', 'HIGH_VALUE', 'QUARANTINE', 'RECEIVING', 'STAGING', 'RETURNS');

-- CreateTable
CREATE TABLE "admission_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "sourceEncounterId" UUID,
    "sourceHandoffId" UUID,
    "patientMasterId" UUID NOT NULL,
    "patientName" TEXT NOT NULL,
    "mrn" TEXT,
    "requestingDoctorId" UUID NOT NULL,
    "requestingDoctorName" TEXT NOT NULL,
    "admittingDoctorId" UUID,
    "admittingDoctorName" TEXT,
    "targetDepartment" TEXT NOT NULL,
    "targetUnit" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'ELECTIVE',
    "bedType" TEXT NOT NULL DEFAULT 'GENERAL',
    "primaryDiagnosis" TEXT,
    "primaryDiagnosisCode" TEXT,
    "clinicalSummary" TEXT,
    "reasonForAdmission" TEXT,
    "pendingOrders" JSONB NOT NULL DEFAULT '[]',
    "allergies" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "cancelReason" TEXT,
    "cancelledBy" UUID,
    "cancelledAt" TIMESTAMPTZ,
    "expectedLOS" INTEGER,
    "isolationRequired" BOOLEAN NOT NULL DEFAULT false,
    "isolationType" TEXT,
    "episodeId" UUID,
    "bedReservationId" UUID,
    "createdByUserId" UUID,
    "updatedByUserId" UUID,
    "paymentType" TEXT,
    "insuranceId" UUID,
    "insurerName" TEXT,
    "policyNumber" TEXT,
    "memberId" TEXT,
    "eligibilityCheckId" UUID,
    "eligibilityStatus" TEXT,
    "eligibilityCheckedAt" TIMESTAMPTZ,
    "preauthId" UUID,
    "preauthStatus" TEXT,
    "preauthNumber" TEXT,
    "estimatedCost" DECIMAL(12,2),
    "estimatedCostBreakdown" JSONB,
    "depositRequired" DECIMAL(12,2),
    "depositCollected" DECIMAL(12,2),
    "depositPaymentId" UUID,
    "depositMethod" TEXT,
    "depositReceiptNumber" TEXT,
    "depositCollectedAt" TIMESTAMPTZ,
    "billingEncounterCoreId" UUID,
    "payerContextId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "admission_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_checklists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "admissionRequestId" UUID NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "completionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allRequiredComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "admission_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bed_reservations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "admissionRequestId" UUID NOT NULL,
    "bedId" UUID NOT NULL,
    "reservedBy" UUID NOT NULL,
    "reservedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bed_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ward_transfer_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "patientName" TEXT NOT NULL,
    "fromWard" TEXT,
    "fromBed" TEXT,
    "fromUnit" TEXT,
    "toWard" TEXT NOT NULL,
    "toUnit" TEXT,
    "toBedType" TEXT,
    "toBedId" UUID,
    "reason" TEXT NOT NULL,
    "clinicalJustification" TEXT,
    "requestedBy" UUID NOT NULL,
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "completedBy" UUID,
    "completedAt" TIMESTAMPTZ,
    "transferSummary" TEXT,
    "nursingHandoff" JSONB,
    "transferType" TEXT NOT NULL DEFAULT 'REGULAR',
    "urgency" TEXT NOT NULL DEFAULT 'ROUTINE',
    "targetUnitType" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "rejectedBy" UUID,
    "rejectedAt" TIMESTAMPTZ,
    "rejectionReason" TEXT,
    "escalationCriteria" JSONB,
    "acuityData" JSONB,
    "sbarData" JSONB,
    "icuEventId" UUID,
    "orderTemplateId" UUID,
    "ordersApplied" JSONB,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ward_transfer_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_order_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "departmentKey" TEXT NOT NULL,
    "diagnosisCode" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "admission_order_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "settings" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" TEXT,
    "feature" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "durationMs" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cds_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID,
    "encounterId" UUID,
    "type" TEXT,
    "category" TEXT,
    "severity" TEXT,
    "message" TEXT,
    "recommendation" TEXT,
    "trigger" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cds_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_kpi_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "category" TEXT,
    "description" TEXT,
    "unit" TEXT,
    "target" DECIMAL(12,4),
    "warningThreshold" DECIMAL(12,4),
    "criticalThreshold" DECIMAL(12,4),
    "direction" TEXT,
    "formula" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "analytics_kpi_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_kpi_values" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "kpiId" UUID NOT NULL,
    "value" DECIMAL(12,4),
    "periodStart" TIMESTAMPTZ NOT NULL,
    "periodEnd" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "analytics_kpi_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "infection_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID,
    "encounterId" UUID,
    "type" TEXT,
    "organism" TEXT,
    "site" TEXT,
    "onsetDate" DATE,
    "isHAI" BOOLEAN NOT NULL DEFAULT false,
    "department" TEXT,
    "status" TEXT NOT NULL DEFAULT 'suspected',
    "resistancePattern" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isolationRequired" BOOLEAN NOT NULL DEFAULT false,
    "isolationType" TEXT,
    "reportedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "infection_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveillance_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "type" TEXT,
    "severity" TEXT,
    "message" TEXT,
    "messageAr" TEXT,
    "details" JSONB,
    "status" TEXT DEFAULT 'OPEN',
    "assignedTo" UUID,
    "responseActions" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "surveillance_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_day_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "recordDate" DATE NOT NULL,
    "department" TEXT NOT NULL,
    "patientDays" INTEGER NOT NULL DEFAULT 0,
    "ventilatorDays" INTEGER NOT NULL DEFAULT 0,
    "centralLineDays" INTEGER NOT NULL DEFAULT 0,
    "urinaryCatheterDays" INTEGER NOT NULL DEFAULT 0,
    "recordedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "device_day_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hand_hygiene_audits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "auditDate" DATE NOT NULL,
    "department" TEXT NOT NULL,
    "observerUserId" UUID NOT NULL,
    "staffCategory" TEXT NOT NULL,
    "moment" TEXT NOT NULL,
    "compliant" BOOLEAN NOT NULL DEFAULT false,
    "method" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hand_hygiene_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "antibiotic_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID,
    "encounterId" UUID,
    "drugCode" TEXT,
    "drugName" TEXT,
    "drugNameAr" TEXT,
    "category" TEXT,
    "route" TEXT,
    "dose" DECIMAL(12,4),
    "doseUnit" TEXT,
    "frequency" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "durationDays" INTEGER,
    "indication" TEXT,
    "cultureGuided" BOOLEAN NOT NULL DEFAULT false,
    "deEscalated" BOOLEAN NOT NULL DEFAULT false,
    "restrictedDrug" BOOLEAN NOT NULL DEFAULT false,
    "prescriberId" TEXT,
    "department" TEXT,
    "ddd" DECIMAL(12,4),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "antibiotic_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stewardship_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "type" TEXT,
    "severity" TEXT,
    "message" TEXT,
    "messageAr" TEXT,
    "patientId" UUID,
    "encounterId" UUID,
    "drugName" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stewardship_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_errors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID,
    "encounterId" UUID,
    "orderId" UUID,
    "errorType" TEXT,
    "errorCategory" TEXT,
    "drugCode" TEXT,
    "drugName" TEXT,
    "drugNameAr" TEXT,
    "intendedDrug" TEXT,
    "intendedDose" TEXT,
    "actualDrug" TEXT,
    "actualDose" TEXT,
    "severity" TEXT,
    "stage" TEXT,
    "outcome" TEXT,
    "contributingFactors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "descriptionAr" TEXT,
    "reportedBy" TEXT,
    "reportedByRole" TEXT,
    "department" TEXT,
    "isNearMiss" BOOLEAN NOT NULL DEFAULT false,
    "preventable" BOOLEAN NOT NULL DEFAULT true,
    "rootCause" TEXT,
    "correctiveAction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'reported',
    "resolvedAt" TIMESTAMPTZ,
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "medication_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "isolation_precautions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "encounterId" UUID,
    "isolationType" TEXT NOT NULL,
    "reason" TEXT,
    "organism" TEXT,
    "startedAt" TIMESTAMPTZ NOT NULL,
    "endedAt" TIMESTAMPTZ,
    "startedByUserId" UUID NOT NULL,
    "startedByName" TEXT,
    "endedByUserId" UUID,
    "endedByName" TEXT,
    "roomNumber" TEXT,
    "bedLabel" TEXT,
    "isNegativePressure" BOOLEAN NOT NULL DEFAULT false,
    "isAnteroom" BOOLEAN NOT NULL DEFAULT false,
    "ppeGown" BOOLEAN NOT NULL DEFAULT false,
    "ppeGloves" BOOLEAN NOT NULL DEFAULT false,
    "ppeMaskSurgical" BOOLEAN NOT NULL DEFAULT false,
    "ppeMaskN95" BOOLEAN NOT NULL DEFAULT false,
    "ppePapr" BOOLEAN NOT NULL DEFAULT false,
    "ppeEyeProtection" BOOLEAN NOT NULL DEFAULT false,
    "ppeShoeCovers" BOOLEAN NOT NULL DEFAULT false,
    "signagePosted" BOOLEAN NOT NULL DEFAULT false,
    "complianceAudits" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "discontinuedReason" TEXT,
    "clearanceCriteria" TEXT,
    "clearanceMet" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "isolation_precautions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbreak_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "organism" TEXT,
    "infectionType" TEXT,
    "department" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "declaredByUserId" UUID NOT NULL,
    "declaredByName" TEXT,
    "cases" JSONB,
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "activeCases" INTEGER NOT NULL DEFAULT 0,
    "recoveredCases" INTEGER NOT NULL DEFAULT 0,
    "sourceIdentified" BOOLEAN NOT NULL DEFAULT false,
    "sourceDescription" TEXT,
    "transmissionRoute" TEXT,
    "controlMeasures" JSONB,
    "notifiedAuthorities" BOOLEAN NOT NULL DEFAULT false,
    "notifiedDate" DATE,
    "notifiedTo" TEXT,
    "staffCommunication" JSONB,
    "environmentalActions" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "resolutionDate" DATE,
    "resolutionNotes" TEXT,
    "lessonsLearned" TEXT,
    "afterActionReport" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "outbreak_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_catalog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "itemType" TEXT NOT NULL,
    "departmentDomain" TEXT,
    "applicability" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unitType" TEXT NOT NULL,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "allowedForCash" BOOLEAN NOT NULL DEFAULT true,
    "allowedForInsurance" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "labSpecimen" TEXT,
    "labMethod" TEXT,
    "labPrepNotes" TEXT,
    "radModality" TEXT,
    "radBodySite" TEXT,
    "radContrastRequired" BOOLEAN,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "charge_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_catalog_counters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "itemType" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "charge_catalog_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID NOT NULL,
    "patientMasterId" UUID,
    "departmentKey" TEXT,
    "source" JSONB NOT NULL,
    "chargeCatalogId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitType" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "payerType" TEXT NOT NULL DEFAULT 'CASH',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "voidedAt" TIMESTAMPTZ,
    "voidedBy" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "charge_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "patient" JSONB,
    "provider" JSONB,
    "totals" JSONB NOT NULL,
    "breakdown" JSONB,
    "lineItems" JSONB NOT NULL,
    "payerContext" JSONB,
    "readiness" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "submittedAt" TEXT,
    "submittedByUserId" TEXT,
    "rejectedAt" TIMESTAMPTZ,
    "rejectedByUserId" TEXT,
    "rejectionReason" TEXT,
    "remittedAt" TIMESTAMPTZ,
    "remittedByUserId" TEXT,
    "remittanceAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "claim_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "invoiceId" TEXT,
    "encounterCoreId" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "voidedAt" TIMESTAMPTZ,
    "voidedBy" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "billing_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "encounterCoreId" UUID NOT NULL,
    "patientMasterId" UUID,
    "items" JSONB NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMPTZ,
    "paidAt" TIMESTAMPTZ,
    "promoCode" TEXT,
    "promoDiscount" DECIMAL(12,2),
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_payers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "billing_payers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "payerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "billing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_policy_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "payerId" UUID NOT NULL,
    "planId" UUID,
    "ruleType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "ruleKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "billing_policy_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_lock" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMPTZ,
    "lockedBy" TEXT,
    "lockReason" TEXT,
    "unlockedAt" TIMESTAMPTZ,
    "unlockedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "lastLockIdempotencyKey" TEXT,
    "lastUnlockIdempotencyKey" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "billing_lock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_posting" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "postedAt" TIMESTAMPTZ,
    "postedBy" TEXT,
    "unpostedAt" TIMESTAMPTZ,
    "unpostedBy" TEXT,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "billing_posting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payer_context" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID NOT NULL,
    "mode" TEXT NOT NULL,
    "insuranceCompanyId" TEXT,
    "insuranceCompanyName" TEXT,
    "memberOrPolicyRef" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "payer_context_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_catalog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "form" TEXT NOT NULL,
    "strength" TEXT,
    "routes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chargeCatalogId" UUID NOT NULL,
    "chargeCode" TEXT NOT NULL,
    "isControlled" BOOLEAN NOT NULL DEFAULT false,
    "controlledSchedule" TEXT,
    "controlledClass" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "medication_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMPTZ,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "minAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nphies_eligibility_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" TEXT NOT NULL,
    "insuranceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "nphies_eligibility_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nphies_claims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" TEXT NOT NULL,
    "insuranceId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "isResubmission" BOOLEAN NOT NULL DEFAULT false,
    "originalClaimReference" TEXT,
    "nphiesClaimId" TEXT,
    "nphiesClaimReference" TEXT,
    "status" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "adjudicatedAmount" DECIMAL(12,2),
    "payerAmount" DECIMAL(12,2),
    "patientResponsibility" DECIMAL(12,2),
    "denialReason" TEXT,
    "denialReasonAr" TEXT,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "nphies_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nphies_prior_auths" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" TEXT NOT NULL,
    "insuranceId" TEXT NOT NULL,
    "encounterId" TEXT,
    "status" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "authorizationNumber" TEXT,
    "expiryDate" TIMESTAMPTZ,
    "approvedServices" JSONB,
    "denialReason" TEXT,
    "denialReasonAr" TEXT,
    "response" JSONB NOT NULL,
    "lastStatusCheck" TIMESTAMPTZ,
    "latestResponse" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "nphies_prior_auths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_credit_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID NOT NULL,
    "patientMasterId" UUID,
    "chargeEventId" UUID,
    "invoiceId" UUID,
    "creditNoteNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "appliedAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,
    "cancelledBy" TEXT,
    "cancelReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "billing_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_payment_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "orderId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "status" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_payment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_catalog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "nameEn" TEXT,
    "nameLower" TEXT,
    "serviceType" TEXT NOT NULL,
    "description" TEXT,
    "chargeCatalogId" UUID,
    "chargeCode" TEXT,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "pricing" JSONB,
    "rules" JSONB,
    "specialtyCode" TEXT,
    "applicability" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedForCash" BOOLEAN NOT NULL DEFAULT true,
    "allowedForInsurance" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "departmentDomain" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_catalog_counters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "specialty" TEXT NOT NULL DEFAULT '',
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_catalog_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_usage_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "serviceCatalogId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "createdByEmail" TEXT,

    CONSTRAINT "service_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplies_catalog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameLower" TEXT,
    "category" TEXT,
    "usageUnit" TEXT,
    "description" TEXT,
    "chargeCatalogId" UUID,
    "chargeCode" TEXT,
    "chargeGenerated" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "supplies_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_catalog_counters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "supply_catalog_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_usage_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "supplyCatalogId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "encounterId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "createdByEmail" TEXT,

    CONSTRAINT "supply_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnosis_catalog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "icd10" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "diagnosis_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameLower" TEXT,
    "description" TEXT,
    "fixedPrice" DECIMAL(12,2) NOT NULL,
    "overridesCharges" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "pricing_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_package_counters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pricing_package_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_package_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "packageId" TEXT NOT NULL,
    "packageCode" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "appliedPrice" DECIMAL(12,2) NOT NULL,
    "overridesCharges" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,
    "createdByEmail" TEXT,

    CONSTRAINT "pricing_package_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_usage_idempotency" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "usageEventId" TEXT,
    "chargeEventId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "createdByEmail" TEXT,

    CONSTRAINT "catalog_usage_idempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_bank_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "encounterId" UUID,
    "requestedBy" UUID NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'ROUTINE',
    "indication" TEXT NOT NULL,
    "bloodType" TEXT,
    "products" JSONB NOT NULL DEFAULT '[]',
    "crossmatch" BOOLEAN NOT NULL DEFAULT true,
    "consentObtained" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "blood_bank_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "bloodType" TEXT NOT NULL,
    "expiryDate" TIMESTAMPTZ NOT NULL,
    "collectionDate" TIMESTAMPTZ,
    "volume" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "donorId" TEXT,
    "reservedFor" UUID,
    "temperature" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "blood_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfusions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "administeredBy" UUID NOT NULL,
    "startTime" TIMESTAMPTZ NOT NULL,
    "endTime" TIMESTAMPTZ,
    "rate" INTEGER,
    "preVitals" JSONB,
    "postVitals" JSONB,
    "monitoringLog" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "stoppedReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transfusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfusion_reactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "transfusionId" UUID NOT NULL,
    "reactionType" TEXT NOT NULL,
    "onset" TIMESTAMPTZ NOT NULL,
    "symptoms" TEXT[],
    "severity" TEXT NOT NULL,
    "actionTaken" TEXT NOT NULL,
    "outcome" TEXT,
    "reportedToBank" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfusion_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_gaps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "encounterCoreId" UUID,
    "gapType" TEXT NOT NULL,
    "sourceOrderId" UUID,
    "sourceOrderKind" TEXT,
    "sourceOrderName" TEXT,
    "sourceOrderNameAr" TEXT,
    "reason" TEXT,
    "reasonAr" TEXT,
    "dueAt" TIMESTAMPTZ,
    "detectedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" TEXT NOT NULL DEFAULT 'ROUTINE',
    "severityScore" INTEGER NOT NULL DEFAULT 50,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMPTZ,
    "resolvedBy" UUID,
    "resolvedReason" TEXT,
    "dismissedAt" TIMESTAMPTZ,
    "dismissedBy" UUID,
    "dismissedReason" TEXT,
    "lastOutreachAt" TIMESTAMPTZ,
    "outreachCount" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "care_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_gap_outreach_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "careGapId" UUID NOT NULL,
    "outreachType" TEXT NOT NULL,
    "channel" TEXT,
    "message" TEXT,
    "messageAr" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "outcome" TEXT,
    "outcomeNotes" TEXT,
    "sentAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMPTZ,
    "performedBy" UUID,
    "performedByName" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_gap_outreach_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_care_paths" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "encounterCoreId" UUID,
    "episodeId" UUID,
    "erEncounterId" UUID,
    "date" DATE NOT NULL,
    "departmentType" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "patientSnapshot" JSONB,
    "dietOrder" JSONB,
    "instructions" JSONB,
    "roundsSchedule" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "completionPct" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generationSource" TEXT NOT NULL DEFAULT 'AUTO',
    "bedsidePin" TEXT,
    "bedsideToken" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "daily_care_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_path_shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "carePathId" UUID NOT NULL,
    "shiftType" TEXT NOT NULL,
    "nurseUserId" UUID,
    "nurseName" TEXT,
    "nurseNameAr" TEXT,
    "startTime" TIMESTAMPTZ NOT NULL,
    "endTime" TIMESTAMPTZ NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalTasks" INTEGER NOT NULL DEFAULT 0,
    "completedTasks" INTEGER NOT NULL DEFAULT 0,
    "missedTasks" INTEGER NOT NULL DEFAULT 0,
    "heldTasks" INTEGER NOT NULL DEFAULT 0,
    "signedAt" TIMESTAMPTZ,
    "signedByUserId" UUID,
    "signatureData" TEXT,
    "summary" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "care_path_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_path_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "carePathId" UUID NOT NULL,
    "shiftId" UUID,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "scheduledTime" TIMESTAMPTZ NOT NULL,
    "scheduledEndTime" TIMESTAMPTZ,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'ROUTINE',
    "sourceType" TEXT NOT NULL DEFAULT 'AUTO',
    "sourceOrderId" UUID,
    "sourcePrescriptionId" UUID,
    "sourceCarePlanId" UUID,
    "taskData" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resultData" JSONB,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "completedByUserId" UUID,
    "completedByName" TEXT,
    "completedByNameAr" TEXT,
    "missedReason" TEXT,
    "missedReasonText" TEXT,
    "missedReasonTextAr" TEXT,
    "requiresWitness" BOOLEAN NOT NULL DEFAULT false,
    "witnessUserId" UUID,
    "witnessName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "care_path_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_path_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "carePathId" UUID NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "message" TEXT,
    "messageAr" TEXT,
    "sourceOrderId" UUID,
    "orderDetails" JSONB,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMPTZ,
    "acknowledgedByUserId" UUID,
    "acknowledgedByName" TEXT,
    "acknowledgedAction" TEXT,
    "generatedTaskId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_path_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opd_visit_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID,
    "opdEncounterId" UUID,
    "patientId" UUID,
    "chiefComplaint" TEXT,
    "historyOfPresentIllness" TEXT,
    "reviewOfSystems" JSONB,
    "pastMedicalHistory" TEXT,
    "familyHistory" TEXT,
    "socialHistory" TEXT,
    "physicalExam" TEXT,
    "physicalExamStructured" JSONB,
    "assessment" TEXT,
    "plan" TEXT,
    "diagnoses" JSONB,
    "vitalsSnapshot" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "signedAt" TIMESTAMPTZ,
    "signedBy" UUID,
    "amendedAt" TIMESTAMPTZ,
    "amendedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,

    CONSTRAINT "opd_visit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "physical_exams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID,
    "patientId" UUID,
    "systems" JSONB,
    "summary" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMPTZ,
    "finalizedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,

    CONSTRAINT "physical_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_medications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID,
    "drugName" TEXT,
    "dose" TEXT,
    "unit" TEXT,
    "frequency" TEXT,
    "route" TEXT,
    "strength" TEXT,
    "form" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" UUID,
    "verifiedAt" TIMESTAMPTZ,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "home_medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "death_declarations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterCoreId" UUID,
    "declaredAt" TIMESTAMPTZ NOT NULL,
    "declaredBy" UUID,
    "causeOfDeath" TEXT,
    "placeOfDeath" TEXT,
    "manner" TEXT,
    "notes" TEXT,
    "isFinalised" BOOLEAN NOT NULL DEFAULT false,
    "finalisedAt" TIMESTAMPTZ,
    "finalisedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "death_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID,
    "source" JSONB,
    "taskType" TEXT,
    "title" TEXT,
    "priority" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMPTZ,
    "assignedToUserId" TEXT,
    "claimedAt" TIMESTAMPTZ,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "notDoneReason" TEXT,
    "cancelReason" TEXT,
    "idempotencyKey" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_task_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "payload" JSONB,

    CONSTRAINT "clinical_task_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID,
    "encounterCoreId" UUID,
    "context" TEXT,
    "area" TEXT,
    "role" TEXT,
    "noteType" TEXT,
    "title" TEXT,
    "content" TEXT,
    "metadata" JSONB,
    "author" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT,

    CONSTRAINT "clinical_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_handover" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID,
    "episodeId" UUID,
    "fromRole" TEXT,
    "toRole" TEXT,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "summary" TEXT,
    "risks" JSONB,
    "pendingTasks" JSONB,
    "pendingResults" JSONB,
    "activeOrders" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "finalizedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT,

    CONSTRAINT "clinical_handover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "consentType" TEXT,
    "patientId" UUID,
    "encounterId" UUID,
    "signatureData" TEXT,
    "signedBy" TEXT,
    "guardianName" TEXT,
    "guardianRelation" TEXT,
    "witnessName" TEXT,
    "notes" TEXT,
    "signedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "withdrawnAt" TIMESTAMPTZ,
    "withdrawnBy" TEXT,
    "withdrawalReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "clinical_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" TEXT,
    "platform" TEXT,
    "type" TEXT,
    "subject" TEXT,
    "trigger" TEXT,
    "source" TEXT,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "errorMessage" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clinical_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consult_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "encounterId" UUID,
    "episodeId" UUID,
    "requestedBy" UUID NOT NULL,
    "specialty" TEXT NOT NULL,
    "consultantId" UUID,
    "urgency" TEXT NOT NULL DEFAULT 'ROUTINE',
    "clinicalQuestion" TEXT NOT NULL,
    "clinicalSummary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "acknowledgedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "consult_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consult_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "consultantId" UUID NOT NULL,
    "findings" TEXT NOT NULL,
    "impression" TEXT,
    "recommendations" TEXT NOT NULL,
    "followUpNeeded" BOOLEAN NOT NULL DEFAULT false,
    "followUpDate" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "consult_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wound_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "encounterId" UUID,
    "assessedBy" UUID NOT NULL,
    "assessmentDate" TIMESTAMPTZ NOT NULL,
    "woundType" TEXT NOT NULL,
    "woundLocation" TEXT NOT NULL,
    "stage" TEXT,
    "length" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "depth" DOUBLE PRECISION,
    "tunneling" BOOLEAN NOT NULL DEFAULT false,
    "undermining" BOOLEAN NOT NULL DEFAULT false,
    "woundBed" JSONB,
    "exudate" JSONB,
    "periwoundSkin" TEXT,
    "odor" TEXT,
    "painScore" INTEGER,
    "treatment" JSONB,
    "photoAttachmentId" TEXT,
    "healingTrajectory" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wound_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutritional_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "assessedBy" UUID NOT NULL,
    "assessmentDate" TIMESTAMPTZ NOT NULL,
    "mustScore" INTEGER,
    "mnaScore" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "idealWeight" DOUBLE PRECISION,
    "weightChangePct" DOUBLE PRECISION,
    "appetiteStatus" TEXT,
    "swallowingStatus" TEXT,
    "dietaryHistory" TEXT,
    "foodAllergies" TEXT,
    "route" TEXT,
    "caloricNeed" INTEGER,
    "proteinNeed" DOUBLE PRECISION,
    "fluidNeed" INTEGER,
    "recommendations" TEXT,
    "followUpDate" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "nutritional_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_work_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "assessedBy" UUID NOT NULL,
    "assessmentDate" TIMESTAMPTZ NOT NULL,
    "referralReason" TEXT NOT NULL,
    "livingArrangement" TEXT,
    "primaryCaregiver" TEXT,
    "supportSystem" TEXT,
    "financialStatus" TEXT,
    "employmentStatus" TEXT,
    "substanceUse" TEXT,
    "domesticViolence" BOOLEAN,
    "mentalHealthHistory" TEXT,
    "religiousCulturalNeeds" TEXT,
    "barriers" TEXT,
    "strengths" TEXT,
    "plan" TEXT,
    "dischargeBarriers" TEXT,
    "followUpPlan" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "social_work_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_work_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "noteType" TEXT NOT NULL DEFAULT 'PROGRESS',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_work_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_education_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "encounterId" UUID,
    "educatorId" UUID NOT NULL,
    "educationDate" TIMESTAMPTZ NOT NULL,
    "topics" JSONB NOT NULL DEFAULT '[]',
    "method" TEXT[],
    "barriers" TEXT[],
    "interpreter" BOOLEAN NOT NULL DEFAULT false,
    "comprehension" TEXT NOT NULL,
    "followUpNeeded" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_education_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "infection_surveillance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "reportedBy" UUID NOT NULL,
    "reportDate" TIMESTAMPTZ NOT NULL,
    "infectionType" TEXT NOT NULL,
    "onset" TEXT NOT NULL,
    "organism" TEXT,
    "sensitivityProfile" JSONB,
    "isolationPrecautions" TEXT[],
    "isolationStartDate" TIMESTAMPTZ,
    "isolationEndDate" TIMESTAMPTZ,
    "treatmentStarted" BOOLEAN NOT NULL DEFAULT false,
    "treatment" TEXT,
    "outcome" TEXT,
    "cultureResults" JSONB,
    "notifiable" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "infection_surveillance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partograms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "admissionTime" TIMESTAMPTZ NOT NULL,
    "gestationalAge" INTEGER,
    "gravidaPara" TEXT,
    "membraneStatus" TEXT,
    "ruptureTime" TIMESTAMPTZ,
    "cervixOnAdmission" INTEGER,
    "presentingPart" TEXT,
    "fetalPosition" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deliveryTime" TIMESTAMPTZ,
    "deliveryMode" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "partograms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partogram_observations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "partogramId" UUID NOT NULL,
    "observedAt" TIMESTAMPTZ NOT NULL,
    "observedBy" TEXT NOT NULL,
    "bp" TEXT,
    "pulse" INTEGER,
    "temperature" DOUBLE PRECISION,
    "urineOutput" INTEGER,
    "fhr" INTEGER,
    "fhrPattern" TEXT,
    "cervixDilation" INTEGER,
    "effacement" INTEGER,
    "stationLevel" TEXT,
    "contractionFreq" INTEGER,
    "contractionDuration" INTEGER,
    "contractionStrength" TEXT,
    "oxytocin" DOUBLE PRECISION,
    "medications" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partogram_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dietary_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "episodeId" UUID,
    "dietType" TEXT NOT NULL,
    "specialInstructions" TEXT,
    "allergies" TEXT,
    "texture" TEXT,
    "fluidRestriction" INTEGER,
    "calorieTarget" INTEGER,
    "proteinTarget" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMPTZ,
    "orderedBy" UUID NOT NULL,
    "orderedByName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "dietary_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "dietaryOrderId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "mealType" TEXT NOT NULL,
    "scheduledDate" TIMESTAMPTZ NOT NULL,
    "scheduledTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deliveredAt" TIMESTAMPTZ,
    "deliveredBy" TEXT,
    "intakePercent" INTEGER,
    "refusalReason" TEXT,
    "menuItems" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "meal_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tpn_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "orderedBy" TEXT NOT NULL,
    "orderDate" TIMESTAMPTZ NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "totalVolume" INTEGER NOT NULL,
    "infusionRate" DOUBLE PRECISION NOT NULL,
    "infusionHours" INTEGER NOT NULL DEFAULT 24,
    "dextrose" JSONB NOT NULL,
    "aminoAcids" JSONB NOT NULL,
    "lipids" JSONB,
    "electrolytes" JSONB NOT NULL,
    "vitamins" JSONB,
    "traceElements" JSONB,
    "additives" JSONB,
    "totalCalories" INTEGER,
    "totalProtein" DOUBLE PRECISION,
    "caloriesPerKg" DOUBLE PRECISION,
    "proteinPerKg" DOUBLE PRECISION,
    "glucoseInfusionRate" DOUBLE PRECISION,
    "osmolarity" DOUBLE PRECISION,
    "accessType" TEXT NOT NULL DEFAULT 'CENTRAL',
    "labMonitoring" JSONB,
    "compatibilityCheck" BOOLEAN NOT NULL DEFAULT false,
    "pharmacistVerified" BOOLEAN NOT NULL DEFAULT false,
    "pharmacistId" TEXT,
    "verifiedAt" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMPTZ,
    "endDate" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tpn_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_catalog_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "category" TEXT NOT NULL,
    "dietTypes" TEXT[],
    "calories" INTEGER,
    "protein" DOUBLE PRECISION,
    "carbohydrates" DOUBLE PRECISION,
    "fat" DOUBLE PRECISION,
    "fiber" DOUBLE PRECISION,
    "sodium" DOUBLE PRECISION,
    "potassium" DOUBLE PRECISION,
    "sugar" DOUBLE PRECISION,
    "servingSize" TEXT,
    "allergens" TEXT[],
    "texture" TEXT,
    "isVegetarian" BOOLEAN NOT NULL DEFAULT false,
    "isVegan" BOOLEAN NOT NULL DEFAULT false,
    "isHalal" BOOLEAN NOT NULL DEFAULT true,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "diet_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calorie_intake_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "recordDate" DATE NOT NULL,
    "mealType" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "totalCalories" INTEGER NOT NULL,
    "totalProtein" DOUBLE PRECISION,
    "totalCarbs" DOUBLE PRECISION,
    "totalFat" DOUBLE PRECISION,
    "intakePercent" INTEGER,
    "fluidIntake" INTEGER,
    "recordedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calorie_intake_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "patientName" TEXT,
    "encounterId" UUID,
    "requestType" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'routine',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "origin" TEXT NOT NULL,
    "originDetails" TEXT,
    "destination" TEXT NOT NULL,
    "destinationDetails" TEXT,
    "requestedBy" UUID NOT NULL,
    "requestedByName" TEXT,
    "assignedTo" UUID,
    "assignedToName" TEXT,
    "scheduledAt" TIMESTAMPTZ,
    "dispatchedAt" TIMESTAMPTZ,
    "pickedUpAt" TIMESTAMPTZ,
    "arrivedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,
    "cancelReason" TEXT,
    "transportMode" TEXT NOT NULL DEFAULT 'wheelchair',
    "oxygenRequired" BOOLEAN NOT NULL DEFAULT false,
    "monitorRequired" BOOLEAN NOT NULL DEFAULT false,
    "ivPumpRequired" BOOLEAN NOT NULL DEFAULT false,
    "isolationRequired" BOOLEAN NOT NULL DEFAULT false,
    "isolationType" TEXT,
    "nurseEscort" BOOLEAN NOT NULL DEFAULT false,
    "specialInstructions" TEXT,
    "estimatedDuration" INTEGER,
    "actualDuration" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transport_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_staff" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "currentTask" UUID,
    "zone" TEXT,
    "shiftStart" TIMESTAMPTZ,
    "shiftEnd" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transport_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formulary_drugs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "genericName" TEXT NOT NULL,
    "genericNameAr" TEXT NOT NULL,
    "brandNames" JSONB NOT NULL DEFAULT '[]',
    "sfdaRegistration" TEXT,
    "atcCode" TEXT,
    "atcCategory" TEXT,
    "therapeuticClass" TEXT NOT NULL,
    "therapeuticClassAr" TEXT NOT NULL,
    "formularyStatus" TEXT NOT NULL DEFAULT 'formulary',
    "restrictionCriteria" TEXT,
    "restrictionCriteriaAr" TEXT,
    "approverRole" TEXT,
    "routes" JSONB NOT NULL DEFAULT '[]',
    "forms" JSONB NOT NULL DEFAULT '[]',
    "maxDailyDose" DOUBLE PRECISION,
    "maxDailyDoseUnit" TEXT,
    "renalAdjustment" BOOLEAN NOT NULL DEFAULT false,
    "hepaticAdjustment" BOOLEAN NOT NULL DEFAULT false,
    "pregnancyCategory" TEXT NOT NULL DEFAULT 'C',
    "lactationSafe" BOOLEAN NOT NULL DEFAULT false,
    "pediatricApproved" BOOLEAN NOT NULL DEFAULT true,
    "geriatricCaution" BOOLEAN NOT NULL DEFAULT false,
    "highAlert" BOOLEAN NOT NULL DEFAULT false,
    "controlled" BOOLEAN NOT NULL DEFAULT false,
    "controlSchedule" TEXT,
    "lasaPairs" JSONB NOT NULL DEFAULT '[]',
    "blackBoxWarning" TEXT,
    "blackBoxWarningAr" TEXT,
    "interactions" JSONB NOT NULL DEFAULT '[]',
    "contraindications" JSONB NOT NULL DEFAULT '[]',
    "contraindicationsAr" JSONB NOT NULL DEFAULT '[]',
    "monitoringRequired" JSONB NOT NULL DEFAULT '[]',
    "storageConditions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "formulary_drugs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formulary_restriction_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "drugId" UUID NOT NULL,
    "drugName" TEXT,
    "patientId" UUID,
    "encounterId" UUID,
    "requestedBy" UUID NOT NULL,
    "requestedByName" TEXT,
    "reason" TEXT NOT NULL,
    "clinicalJustification" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" UUID,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formulary_restriction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icd10_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "chapter" TEXT,
    "category" TEXT,
    "isCommon" BOOLEAN NOT NULL DEFAULT false,
    "synonyms" TEXT[],
    "parentCode" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "icd10_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_gas_analyses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "episodeId" UUID,
    "sampleType" TEXT NOT NULL,
    "ph" DOUBLE PRECISION,
    "paCo2" DOUBLE PRECISION,
    "paO2" DOUBLE PRECISION,
    "hco3" DOUBLE PRECISION,
    "baseExcess" DOUBLE PRECISION,
    "saO2" DOUBLE PRECISION,
    "lactate" DOUBLE PRECISION,
    "fio2" DOUBLE PRECISION,
    "aaGradient" DOUBLE PRECISION,
    "pfRatio" DOUBLE PRECISION,
    "oxygenationIndex" DOUBLE PRECISION,
    "interpretation" JSONB,
    "autoInterpretation" TEXT,
    "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
    "criticalAlert" BOOLEAN NOT NULL DEFAULT false,
    "collectedAt" TIMESTAMPTZ NOT NULL,
    "analyzedByUserId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "blood_gas_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lis_connection_status" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "analyzerId" TEXT NOT NULL,
    "analyzerName" TEXT NOT NULL,
    "connectionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "lastMessageAt" TIMESTAMPTZ,
    "lastErrorAt" TIMESTAMPTZ,
    "lastError" TEXT,
    "messagesProcessed" INTEGER NOT NULL DEFAULT 0,
    "messagesFailed" INTEGER NOT NULL DEFAULT 0,
    "errorRate" DOUBLE PRECISION,
    "uptime" DOUBLE PRECISION,
    "ipAddress" TEXT,
    "port" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lis_connection_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radiology_peer_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "studyId" UUID NOT NULL,
    "originalReportId" UUID NOT NULL,
    "originalReaderId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "score" TEXT,
    "clinicallySignificant" BOOLEAN NOT NULL DEFAULT false,
    "discrepancyDetails" TEXT,
    "reviewerComments" TEXT,
    "originalReaderNotified" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMPTZ,
    "isRandomSelection" BOOLEAN NOT NULL DEFAULT true,
    "modality" TEXT,
    "bodyPart" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "radiology_peer_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radiology_prior_studies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "currentStudyId" UUID NOT NULL,
    "priorStudyId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "modality" TEXT NOT NULL,
    "bodyPart" TEXT,
    "priorStudyDate" TIMESTAMPTZ NOT NULL,
    "comparisonNotes" TEXT,
    "linkedByUserId" UUID,
    "autoLinked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radiology_prior_studies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_meal_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "mealType" TEXT NOT NULL,
    "ward" TEXT,
    "totalTrays" INTEGER NOT NULL DEFAULT 0,
    "trayDetails" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "producedAt" TIMESTAMPTZ,
    "deliveredAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "kitchen_meal_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_tray_cards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "mealPlanId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "patientName" TEXT NOT NULL,
    "roomNumber" TEXT,
    "bedNumber" TEXT,
    "dietType" TEXT NOT NULL,
    "allergies" JSONB,
    "textureModification" TEXT,
    "specialRequests" TEXT,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMPTZ,
    "receivedByNurse" TEXT,
    "receivedAt" TIMESTAMPTZ,
    "returnedAt" TIMESTAMPTZ,
    "wasteAmount" TEXT,
    "wasteReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "kitchen_tray_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iv_admixture_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "episodeId" UUID,
    "drug" TEXT NOT NULL,
    "drugCode" TEXT,
    "diluent" TEXT NOT NULL,
    "diluentVolume" DOUBLE PRECISION NOT NULL,
    "drugDose" DOUBLE PRECISION NOT NULL,
    "drugDoseUnit" TEXT NOT NULL,
    "finalConcentration" DOUBLE PRECISION,
    "concentrationUnit" TEXT,
    "infusionRate" DOUBLE PRECISION,
    "infusionDuration" DOUBLE PRECISION,
    "compatibility" TEXT,
    "ySiteCompatible" JSONB,
    "stabilityHours" INTEGER,
    "storageCondition" TEXT,
    "beyondUseDate" TIMESTAMPTZ,
    "status" TEXT NOT NULL,
    "preparedByUserId" UUID,
    "verifiedByUserId" UUID,
    "labelPrinted" BOOLEAN NOT NULL DEFAULT false,
    "batchId" TEXT,
    "orderedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "iv_admixture_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adc_cabinets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "cabinetName" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "status" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMPTZ,
    "totalPockets" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "adc_cabinets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adc_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "cabinetId" UUID NOT NULL,
    "pocketNumber" TEXT,
    "drugName" TEXT NOT NULL,
    "drugCode" TEXT,
    "transactionType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "patientId" UUID,
    "orderId" UUID,
    "userId" UUID NOT NULL,
    "userName" TEXT,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "witnessUserId" UUID,
    "previousCount" INTEGER,
    "newCount" INTEGER,
    "discrepancy" BOOLEAN NOT NULL DEFAULT false,
    "discrepancyAmount" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adc_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adc_inventory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "cabinetId" UUID NOT NULL,
    "pocketNumber" TEXT NOT NULL,
    "drugName" TEXT NOT NULL,
    "drugCode" TEXT,
    "currentQuantity" INTEGER NOT NULL DEFAULT 0,
    "minQuantity" INTEGER NOT NULL DEFAULT 0,
    "maxQuantity" INTEGER NOT NULL DEFAULT 0,
    "parLevel" INTEGER NOT NULL DEFAULT 0,
    "needsRestock" BOOLEAN NOT NULL DEFAULT false,
    "lastCountAt" TIMESTAMPTZ,
    "lastCountByUserId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "adc_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctg_recordings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "episodeId" UUID,
    "startedAt" TIMESTAMPTZ NOT NULL,
    "endedAt" TIMESTAMPTZ,
    "durationMinutes" INTEGER,
    "fhrData" JSONB,
    "contractionData" JSONB,
    "baselineRate" INTEGER,
    "variability" TEXT,
    "accelerations" JSONB,
    "decelerations" JSONB,
    "category" TEXT,
    "interpretation" TEXT,
    "annotations" JSONB,
    "status" TEXT NOT NULL,
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMPTZ,
    "archivedUrl" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ctg_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speech_recognition_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "reportId" UUID,
    "engineType" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" TEXT NOT NULL,
    "rawTranscript" TEXT,
    "editedTranscript" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION,
    "durationSeconds" INTEGER,
    "commands" JSONB,
    "startedAt" TIMESTAMPTZ NOT NULL,
    "endedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "speech_recognition_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_erasure_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "reviewNotes" TEXT,
    "completedAt" TIMESTAMPTZ,
    "retainedData" JSONB,
    "deletedData" JSONB,

    CONSTRAINT "data_erasure_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_breach_incidents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'detected',
    "detectedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detectedBy" TEXT NOT NULL,
    "containedAt" TIMESTAMPTZ,
    "resolvedAt" TIMESTAMPTZ,
    "affectedRecords" INTEGER NOT NULL DEFAULT 0,
    "affectedPatients" INTEGER NOT NULL DEFAULT 0,
    "dataCategories" TEXT[],
    "rootCause" TEXT,
    "remediation" TEXT,
    "notifiedAuthority" BOOLEAN NOT NULL DEFAULT false,
    "authorityNotifiedAt" TIMESTAMPTZ,
    "notifiedPatients" BOOLEAN NOT NULL DEFAULT false,
    "patientsNotifiedAt" TIMESTAMPTZ,
    "timeline" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "data_breach_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_administrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "medicationId" UUID,
    "medicationName" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "scheduledTime" TIMESTAMPTZ NOT NULL,
    "administeredTime" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "holdReason" TEXT,
    "refusalReason" TEXT,
    "notes" TEXT,
    "nurseId" UUID,
    "nurseName" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "medication_administrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nursing_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterCoreId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "vitalSigns" JSONB,
    "painLevel" INTEGER,
    "fallRisk" TEXT,
    "pressureUlcerRisk" TEXT,
    "notes" TEXT,
    "assessedBy" UUID,
    "assessedByName" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "nursing_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_infra_providers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "staffId" TEXT,
    "employmentType" TEXT,
    "shortCode" TEXT,
    "specialtyCode" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "clinical_infra_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_infra_clinics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unitId" TEXT,
    "specialtyId" UUID,
    "allowedRoomIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shortCode" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "clinical_infra_clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_infra_specialties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shortCode" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "clinical_infra_specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_infra_provider_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "licenseNumber" TEXT,
    "unitIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specialtyIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consultationServiceCode" TEXT,
    "level" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clinical_infra_provider_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_infra_provider_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "primaryClinicId" TEXT,
    "parallelClinicIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clinical_infra_provider_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT,
    "floorId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_infra_facilities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "clinical_infra_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_infra_floors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "facilityId" UUID,
    "name" TEXT NOT NULL,
    "shortCode" TEXT,
    "level" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "clinical_infra_floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_infra_units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT,
    "type" TEXT,
    "floorId" UUID,
    "facilityId" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "clinical_infra_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_infra_rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "unitId" UUID,
    "floorId" UUID,
    "name" TEXT NOT NULL,
    "shortCode" TEXT,
    "roomType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "clinical_infra_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_infra_beds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "roomId" UUID,
    "label" TEXT NOT NULL,
    "shortCode" TEXT,
    "bedType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "clinical_infra_beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_infra_provider_unit_scopes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "unitId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_infra_provider_unit_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_infra_provider_room_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "roomId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_infra_provider_room_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumable_stores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "locationType" TEXT NOT NULL,
    "locationRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "parLevel" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "consumable_stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumable_store_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "supplyCatalogId" UUID NOT NULL,
    "currentQty" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "maxLevel" INTEGER NOT NULL DEFAULT 0,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMPTZ,
    "lastCountedAt" TIMESTAMPTZ,
    "lastCountedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "consumable_store_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumable_stock_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "supplyCatalogId" UUID NOT NULL,
    "movementType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousQty" INTEGER NOT NULL,
    "newQty" INTEGER NOT NULL,
    "reason" TEXT,
    "encounterCoreId" UUID,
    "patientMasterId" UUID,
    "batchNumber" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "consumable_stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumable_usage_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID NOT NULL,
    "patientMasterId" UUID,
    "department" TEXT NOT NULL,
    "supplyCatalogId" UUID NOT NULL,
    "supplyCode" TEXT NOT NULL,
    "supplyName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "wasteQty" INTEGER NOT NULL DEFAULT 0,
    "storeId" UUID,
    "usageContext" TEXT NOT NULL,
    "notes" TEXT,
    "templateId" UUID,
    "chargeEventId" UUID,
    "isChargeable" BOOLEAN NOT NULL DEFAULT true,
    "costPrice" DECIMAL(12,2),
    "totalCost" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "voidedAt" TIMESTAMPTZ,
    "voidedBy" TEXT,
    "voidReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "createdByName" TEXT,

    CONSTRAINT "consumable_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumable_usage_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "department" TEXT NOT NULL,
    "usageContext" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "consumable_usage_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" TEXT NOT NULL,
    "name" TEXT,
    "dbName" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "planType" "PlanType" NOT NULL DEFAULT 'ENTERPRISE',
    "entitlementSam" BOOLEAN NOT NULL DEFAULT false,
    "entitlementHealth" BOOLEAN NOT NULL DEFAULT false,
    "entitlementEdrac" BOOLEAN NOT NULL DEFAULT false,
    "entitlementCvision" BOOLEAN NOT NULL DEFAULT false,
    "entitlementScm" BOOLEAN NOT NULL DEFAULT false,
    "integrations" JSONB,
    "subscriptionEndsAt" TIMESTAMPTZ,
    "gracePeriodEndsAt" TIMESTAMPTZ,
    "gracePeriodEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxUsers" INTEGER NOT NULL DEFAULT 100,
    "subscriptionContractId" TEXT,
    "orgTypeId" TEXT,
    "sector" TEXT,
    "countryCode" TEXT,
    "orgTypeChangeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "settings" JSONB,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_id_counters" (
    "tenantId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "public_id_counters_pkey" PRIMARY KEY ("tenantId","entityType")
);

-- CreateTable
CREATE TABLE "tenant_context_packs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "orgTypeId" TEXT NOT NULL,
    "orgTypeNameSnapshot" TEXT NOT NULL,
    "sectorSnapshot" TEXT NOT NULL,
    "countryCode" TEXT,
    "accreditationSets" JSONB NOT NULL DEFAULT '[]',
    "requiredDocumentTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "baselineOperations" JSONB,
    "baselineFunctions" JSONB,
    "baselineRiskDomains" JSONB,
    "glossary" JSONB,
    "behavior" JSONB,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenant_context_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_context_overlays" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_context_overlays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT,
    "role" TEXT NOT NULL,
    "groupId" UUID,
    "hospitalId" UUID,
    "department" TEXT,
    "staffId" TEXT,
    "employeeNo" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activeSessionId" TEXT,
    "platformAccessSam" BOOLEAN,
    "platformAccessHealth" BOOLEAN,
    "platformAccessEdrac" BOOLEAN,
    "platformAccessCvision" BOOLEAN,
    "platformAccessScm" BOOLEAN,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorBackupCodes" JSONB,
    "twoFactorEnabledAt" TIMESTAMPTZ,
    "twoFactorPending" JSONB,
    "passwordChangedAt" TIMESTAMPTZ,
    "passwordHistory" JSONB,
    "forcePasswordChange" BOOLEAN NOT NULL DEFAULT false,
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessionId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID,
    "activeTenantId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "idleExpiresAt" TIMESTAMPTZ,
    "absoluteExpiresAt" TIMESTAMPTZ,
    "lastActivityAt" TIMESTAMPTZ,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "success" BOOLEAN NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actorEmail" TEXT,
    "groupId" TEXT,
    "hospitalId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "method" TEXT,
    "path" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "entryHash" TEXT,
    "previousHash" TEXT,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT,
    "labelAr" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "role_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "org_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospitals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "maxUsers" INTEGER NOT NULL DEFAULT 100,
    "currentUsers" INTEGER NOT NULL DEFAULT 0,
    "planType" TEXT NOT NULL DEFAULT 'enterprise',
    "enabledSam" BOOLEAN NOT NULL DEFAULT false,
    "enabledTheaHealth" BOOLEAN NOT NULL DEFAULT false,
    "enabledEdrac" BOOLEAN NOT NULL DEFAULT false,
    "enabledCvision" BOOLEAN NOT NULL DEFAULT false,
    "enabledImdad" BOOLEAN NOT NULL DEFAULT false,
    "enabledFeatures" JSONB DEFAULT '{}',
    "storageLimit" BIGINT NOT NULL DEFAULT 1000000000,
    "aiQuota" JSONB,
    "branchLimits" JSONB,
    "subscriptionStartsAt" TIMESTAMPTZ NOT NULL,
    "subscriptionEndsAt" TIMESTAMPTZ,
    "gracePeriodEnabled" BOOLEAN NOT NULL DEFAULT false,
    "gracePeriodEndsAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscription_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "areas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "departments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "value" JSONB,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "lastUsedAt" TIMESTAMPTZ,
    "userAgent" TEXT,
    "ip" TEXT,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_states" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "lastPlatformKey" TEXT,
    "lastRoute" TEXT,
    "lastTenantId" TEXT,
    "lastVisitedAt" TIMESTAMPTZ,
    "autoRestore" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "session_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_portal_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "portalUserId" TEXT NOT NULL,
    "patientMasterId" TEXT,
    "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_portal_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mobile" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "recipientUserId" UUID,
    "recipientRole" TEXT,
    "recipientType" TEXT,
    "recipientDeptKey" TEXT,
    "type" TEXT NOT NULL DEFAULT 'in-app',
    "kind" TEXT NOT NULL DEFAULT 'SYSTEM',
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "scope" TEXT NOT NULL DEFAULT 'SYSTEM',
    "channel" TEXT,
    "title" TEXT,
    "body" TEXT,
    "message" TEXT,
    "metadata" JSONB,
    "entity" JSONB,
    "dedupeKey" TEXT,
    "actorUserId" UUID,
    "actorUserEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "readAt" TIMESTAMPTZ,
    "sentAt" TIMESTAMPTZ,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_quotas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "quotaType" TEXT,
    "maxLimit" INTEGER NOT NULL DEFAULT 0,
    "currentUsage" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMPTZ,
    "periodEnd" TIMESTAMPTZ,
    "metadata" JSONB,
    "scopeType" TEXT,
    "scopeId" TEXT,
    "featureKey" TEXT,
    "limit" INTEGER NOT NULL DEFAULT 999999,
    "used" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startsAt" TIMESTAMPTZ,
    "endsAt" TIMESTAMPTZ,
    "lockedAt" TIMESTAMPTZ,
    "createdBy" UUID,
    "updatedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "usage_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT,
    "nameAr" TEXT,
    "sector" TEXT,
    "orgTypeId" TEXT,
    "countryCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" JSONB,
    "logo" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organization_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "countryCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organization_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_type_proposals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orgTypeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "proposal" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organization_type_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approved_access_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT,
    "requestedAt" TIMESTAMPTZ NOT NULL,
    "approvedAt" TIMESTAMPTZ,
    "approvedBy" UUID,
    "approvedByEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "accessToken" TEXT,
    "allowedPlatforms" JSONB,
    "allowedActions" TEXT[] DEFAULT ARRAY['view', 'export']::TEXT[],
    "reason" TEXT,
    "notes" TEXT,
    "lastUsedAt" TIMESTAMPTZ,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "approved_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approved_access_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventType" TEXT NOT NULL,
    "requestId" TEXT,
    "ownerId" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approved_access_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "break_the_glass_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requesterName" TEXT,
    "requesterRole" TEXT,
    "patientId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonCategory" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "revokedAt" TIMESTAMPTZ,
    "revokedBy" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "ipAddress" TEXT,

    CONSTRAINT "break_the_glass_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "staffName" TEXT NOT NULL,
    "staffNameAr" TEXT,
    "credentialType" TEXT NOT NULL,
    "credentialNumber" TEXT,
    "issuingAuthority" TEXT NOT NULL,
    "issuingAuthorityAr" TEXT,
    "issueDate" TIMESTAMPTZ NOT NULL,
    "expiryDate" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'active',
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "verifiedBy" UUID,
    "verifiedAt" TIMESTAMPTZ,
    "documentUrl" TEXT,
    "category" TEXT,
    "specialtyCode" TEXT,
    "notes" TEXT,
    "reminderSentAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "staff_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_privileges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "staffName" TEXT NOT NULL,
    "privilegeType" TEXT NOT NULL,
    "privilegeCode" TEXT,
    "department" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "grantedBy" UUID NOT NULL,
    "grantedByName" TEXT,
    "grantedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ,
    "conditions" TEXT,
    "supervisorId" UUID,
    "caseLogRequired" INTEGER,
    "caseLogCompleted" INTEGER NOT NULL DEFAULT 0,
    "lastReviewDate" TIMESTAMPTZ,
    "nextReviewDate" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clinical_privileges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "credentialId" UUID,
    "privilegeId" UUID,
    "userId" UUID NOT NULL,
    "alertType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "messageAr" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credential_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "keyHash" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "integration_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cssd_trays" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "trayName" TEXT NOT NULL,
    "trayCode" TEXT NOT NULL,
    "department" TEXT,
    "instruments" JSONB NOT NULL DEFAULT '[]',
    "totalInstruments" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cssd_trays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cssd_cycles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "trayId" UUID NOT NULL,
    "loadNumber" TEXT NOT NULL,
    "machine" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "cycleNumber" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "pressure" DOUBLE PRECISION,
    "duration" INTEGER,
    "biologicalIndicator" BOOLEAN NOT NULL DEFAULT false,
    "biologicalResult" TEXT,
    "chemicalIndicator" TEXT,
    "startTime" TIMESTAMPTZ NOT NULL,
    "endTime" TIMESTAMPTZ,
    "operator" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "expiryDate" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cssd_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cssd_dispatches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "trayId" UUID NOT NULL,
    "dispatchedTo" TEXT NOT NULL,
    "dispatchedBy" UUID NOT NULL,
    "dispatchedAt" TIMESTAMPTZ NOT NULL,
    "receivedBy" UUID,
    "receivedAt" TIMESTAMPTZ,
    "returnedBy" UUID,
    "returnedAt" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'DISPATCHED',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cssd_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cssd_recalls" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "trayId" UUID NOT NULL,
    "recallReason" TEXT NOT NULL,
    "recallType" TEXT NOT NULL DEFAULT 'MANDATORY',
    "severity" TEXT NOT NULL DEFAULT 'HIGH',
    "initiatedBy" TEXT NOT NULL,
    "initiatedAt" TIMESTAMPTZ NOT NULL,
    "affectedLoads" JSONB,
    "affectedDispatches" JSONB,
    "notifications" JSONB,
    "rootCause" TEXT,
    "correctiveAction" TEXT,
    "preventiveAction" TEXT,
    "investigationNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedBy" TEXT,
    "closedAt" TIMESTAMPTZ,
    "closedNotes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cssd_recalls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "type" "CvisionRequestType" NOT NULL,
    "priority" "CvisionRequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requesterEmployeeId" TEXT NOT NULL,
    "targetManagerEmployeeId" TEXT,
    "departmentId" TEXT NOT NULL,
    "status" "CvisionRequestStatus" NOT NULL DEFAULT 'OPEN',
    "statusChangedAt" TIMESTAMPTZ,
    "statusReason" TEXT,
    "confidentiality" TEXT NOT NULL DEFAULT 'normal',
    "assignedToUserId" TEXT,
    "assignedAt" TIMESTAMPTZ,
    "escalatedAt" TIMESTAMPTZ,
    "escalationReason" TEXT,
    "slaDueAt" TIMESTAMPTZ,
    "slaBreached" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMPTZ,
    "closedBy" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMPTZ,
    "attachments" JSONB,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "cvision_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_request_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cvision_request_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMPTZ,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cvision_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "categories" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "content" TEXT NOT NULL,
    "contentAr" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "targetDepartments" JSONB,
    "targetRoles" JSONB,
    "publishedAt" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_letters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "templateId" TEXT,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "contentAr" TEXT,
    "generatedAt" TIMESTAMPTZ NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issuedAt" TIMESTAMPTZ,
    "issuedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_letter_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentAr" TEXT,
    "variables" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_letter_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "content" TEXT NOT NULL,
    "contentAr" TEXT,
    "category" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiresAcknowledgment" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_policy_acknowledgments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "policyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cvision_policy_acknowledgments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_workflows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_workflow_instances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "workflowId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "data" JSONB,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_workflow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_approval_matrix" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "requestType" TEXT NOT NULL,
    "departmentId" TEXT,
    "approverRoles" JSONB NOT NULL,
    "thresholds" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_approval_matrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_delegations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "delegatorEmployeeId" TEXT NOT NULL,
    "delegateeEmployeeId" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT,
    "actorEmail" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "changes" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cvision_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_auth_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cvision_auth_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_tenant_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "settings" JSONB,
    "branding" JSONB,
    "modules" JSONB,
    "workSchedule" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_sequences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_import_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalRows" INTEGER,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "cvision_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_deleted_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "deletedBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cvision_deleted_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_saved_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "filters" JSONB,
    "columns" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_calendar_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "date" DATE NOT NULL,
    "endDate" DATE,
    "type" TEXT NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_surveys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "description" TEXT,
    "questions" JSONB NOT NULL,
    "targetDepartments" JSONB,
    "targetRoles" JSONB,
    "startDate" DATE,
    "endDate" DATE,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_survey_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "surveyId" TEXT NOT NULL,
    "respondentId" TEXT,
    "answers" JSONB NOT NULL,
    "submittedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cvision_survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_recognitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "recipientEmployeeId" TEXT NOT NULL,
    "nominatorEmployeeId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_recognitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_reward_points" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT,
    "source" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cvision_reward_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_org_health_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assessmentDate" DATE NOT NULL,
    "scores" JSONB NOT NULL,
    "recommendations" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_org_health_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_org_designs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "structure" JSONB NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_org_designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_change_initiatives" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "objectives" JSONB,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "startDate" DATE,
    "endDate" DATE,
    "ownerId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_change_initiatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_culture_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "assessmentDate" DATE NOT NULL,
    "dimensions" JSONB NOT NULL,
    "overallScore" DECIMAL(65,30),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_culture_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_strategic_alignment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "objective" TEXT NOT NULL,
    "departmentId" TEXT,
    "alignmentScore" DECIMAL(65,30),
    "details" JSONB,
    "period" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_strategic_alignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_teams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "leadEmployeeId" TEXT,
    "members" JSONB NOT NULL,
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_muqeem_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "iqamaNumber" TEXT,
    "expiryDate" DATE,
    "borderNumber" TEXT,
    "passportNumber" TEXT,
    "passportExpiry" DATE,
    "visaType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_muqeem_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_muqeem_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "expiryDate" DATE NOT NULL,
    "daysRemaining" INTEGER NOT NULL,
    "isAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cvision_muqeem_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_integration_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_integration_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_integration_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "configId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "errorMessage" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cvision_integration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_retention_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "score" DECIMAL(65,30) NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "factors" JSONB NOT NULL,
    "calculatedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cvision_retention_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_retention_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "message" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cvision_retention_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_dashboards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "widgets" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "type" "CvisionShiftType" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "isOvernight" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_shift_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "pattern" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_shift_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_shift_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_attendance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shiftId" TEXT,
    "checkIn" TIMESTAMPTZ,
    "checkOut" TIMESTAMPTZ,
    "status" "CvisionAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "workingMinutes" INTEGER,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyLeaveMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "notes" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_attendance_corrections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "correctionType" TEXT NOT NULL,
    "originalValue" TEXT,
    "correctedValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_attendance_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_biometric_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "deviceId" TEXT,
    "punchTime" TIMESTAMPTZ NOT NULL,
    "direction" TEXT,
    "rawData" JSONB,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "attendanceId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cvision_biometric_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_schedule_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shiftId" TEXT,
    "scheduleType" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_schedule_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_schedule_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "departmentId" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "weekEndDate" DATE NOT NULL,
    "status" "CvisionScheduleApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "submittedBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMPTZ NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_schedule_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_employee_shift_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "preferredShiftType" "CvisionShiftType",
    "availableDays" JSONB,
    "restrictions" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_employee_shift_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_department_work_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "departmentId" TEXT NOT NULL,
    "workDays" JSONB NOT NULL,
    "defaultShiftId" TEXT,
    "overtimePolicy" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_department_work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_geofences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(65,30) NOT NULL,
    "longitude" DECIMAL(65,30) NOT NULL,
    "radiusMeters" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "branchId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_geofences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "parentId" UUID,
    "managerId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "cvision_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "departmentId" UUID,
    "managerId" UUID,
    "headNurseId" UUID,
    "nursingManagerId" UUID,
    "minStaffDay" INTEGER,
    "minStaffNight" INTEGER,
    "minStaffEvening" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "cvision_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_job_titles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "departmentId" UUID,
    "unitId" UUID,
    "gradeId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "requirements" JSONB,
    "responsibilities" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "cvision_job_titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_grades" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "level" INTEGER NOT NULL,
    "minSalary" DECIMAL(12,2),
    "maxSalary" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "cvision_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_branches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "address" JSONB,
    "city" TEXT,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "cvision_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeNo" TEXT NOT NULL,
    "nationalId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstNameAr" TEXT,
    "lastNameAr" TEXT,
    "fullName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "dateOfBirth" DATE,
    "gender" "CvisionGender",
    "nationality" TEXT,
    "departmentId" UUID,
    "unitId" UUID,
    "jobTitleId" UUID,
    "positionId" UUID,
    "gradeId" UUID,
    "managerEmployeeId" UUID,
    "branchId" UUID,
    "workLocation" TEXT,
    "nursingRole" TEXT,
    "status" "CvisionEmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "statusEffectiveAt" TIMESTAMPTZ,
    "statusReason" TEXT,
    "hiredAt" TIMESTAMPTZ,
    "probationEndDate" DATE,
    "activatedAt" TIMESTAMPTZ,
    "resignedAt" TIMESTAMPTZ,
    "terminatedAt" TIMESTAMPTZ,
    "contractEndDate" DATE,
    "userId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "address" JSONB,
    "emergencyContact" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "cvision_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_employee_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "fromStatus" "CvisionEmployeeStatus",
    "toStatus" "CvisionEmployeeStatus" NOT NULL,
    "reason" TEXT,
    "effectiveDate" DATE NOT NULL,
    "lastWorkingDay" DATE,
    "endOfServiceAmount" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_employee_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "contractNo" TEXT NOT NULL,
    "employeeId" UUID NOT NULL,
    "type" "CvisionContractType" NOT NULL,
    "status" "CvisionContractStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "basicSalary" DECIMAL(12,2),
    "housingAllowance" DECIMAL(12,2),
    "transportAllowance" DECIMAL(12,2),
    "otherAllowances" DECIMAL(12,2),
    "vacationDaysPerYear" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "renewedFromContractId" UUID,
    "terminationDate" DATE,
    "terminationReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "cvision_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_budgeted_positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "positionCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "departmentId" UUID,
    "unitId" UUID,
    "jobTitleId" UUID,
    "gradeId" UUID,
    "budgetedHeadcount" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "cvision_budgeted_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_position_slots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "requisitionId" UUID,
    "employeeId" UUID,
    "status" TEXT NOT NULL DEFAULT 'VACANT',
    "filledAt" TIMESTAMPTZ,
    "frozenAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_position_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_employee_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "notes" TEXT,
    "expiryDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "cvision_employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_insurance_providers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "contactInfo" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_insurance_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_insurance_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "providerId" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "coverageDetails" JSONB,
    "premium" DECIMAL(12,2),
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_insurance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_employee_insurances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "enrollmentDate" DATE NOT NULL,
    "membershipNumber" TEXT,
    "dependents" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_employee_insurances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_insurance_claims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT,
    "claimNumber" TEXT NOT NULL,
    "claimDate" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "attachments" JSONB,
    "approvedAmount" DECIMAL(12,2),
    "paidAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_insurance_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_insurance_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_insurance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_travel_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "purpose" TEXT,
    "departureDate" DATE NOT NULL,
    "returnDate" DATE NOT NULL,
    "estimatedCost" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "attachments" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_travel_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_expense_claims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "travelRequestId" TEXT,
    "claimDate" DATE NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "items" JSONB NOT NULL,
    "receipts" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "paidAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_expense_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assetCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "employeeId" TEXT,
    "departmentId" TEXT,
    "serialNumber" TEXT,
    "purchaseDate" DATE,
    "purchaseCost" DECIMAL(12,2),
    "condition" TEXT NOT NULL DEFAULT 'good',
    "status" TEXT NOT NULL DEFAULT 'available',
    "assignedDate" DATE,
    "returnDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_transport_routes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stops" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_transport_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_transport_vehicles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacity" INTEGER,
    "driverId" TEXT,
    "routeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_transport_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_transport_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "routeId" TEXT,
    "vehicleId" TEXT,
    "pickupPoint" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_transport_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_transport_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestDate" DATE NOT NULL,
    "pickupLocation" TEXT NOT NULL,
    "dropoffLocation" TEXT NOT NULL,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_transport_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_transport_trips" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "routeId" TEXT,
    "date" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "passengers" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_transport_trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_transport_issues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "vehicleId" TEXT,
    "reportedBy" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_transport_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_safety_incidents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "reportedBy" TEXT NOT NULL,
    "incidentDate" DATE NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "severity" TEXT NOT NULL,
    "injuredEmployeeId" TEXT,
    "witnesses" JSONB,
    "rootCause" TEXT,
    "correctiveAction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'reported',
    "investigatedBy" TEXT,
    "resolvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_safety_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_grievances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "againstEmployeeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMPTZ,
    "isConfidential" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_grievances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_leaves" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "leaveType" "CvisionLeaveType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "days" DECIMAL(5,2) NOT NULL,
    "reason" TEXT,
    "status" "CvisionLeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "rejectionReason" TEXT,
    "attachments" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "cvision_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_leave_balances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "leaveType" "CvisionLeaveType" NOT NULL,
    "year" INTEGER NOT NULL,
    "entitled" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "used" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "pending" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "carriedOver" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "adjustment" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_payroll_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "baseSalary" DECIMAL(12,2) NOT NULL,
    "allowances" JSONB NOT NULL,
    "deductions" JSONB NOT NULL,
    "bankIban" TEXT,
    "wpsId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_payroll_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_payroll_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "status" "CvisionPayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "totals" JSONB,
    "approvedAt" TIMESTAMPTZ,
    "approvedBy" UUID,
    "paidAt" TIMESTAMPTZ,
    "paidBy" UUID,
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_payslips" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "gross" DECIMAL(12,2) NOT NULL,
    "net" DECIMAL(12,2) NOT NULL,
    "breakdown" JSONB NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_payroll_exports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "format" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "rowCount" INTEGER NOT NULL,
    "checksum" TEXT,
    "exportedAt" TIMESTAMPTZ NOT NULL,
    "exportedBy" UUID NOT NULL,
    "metadata" JSONB,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_payroll_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_payroll_dry_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "employeeCount" INTEGER NOT NULL,
    "totalGross" DECIMAL(12,2),
    "totalNet" DECIMAL(12,2),
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_payroll_dry_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_loans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "loanNumber" TEXT NOT NULL,
    "principal" DECIMAL(12,2) NOT NULL,
    "monthlyDeduction" DECIMAL(12,2) NOT NULL,
    "remaining" DECIMAL(12,2) NOT NULL,
    "status" "CvisionLoanStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_loan_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "maxAmount" DECIMAL(12,2),
    "maxMonths" INTEGER,
    "maxActiveLoans" INTEGER NOT NULL DEFAULT 1,
    "eligibilityMonths" INTEGER NOT NULL DEFAULT 6,
    "interestRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_loan_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_salary_structures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "gradeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_employee_compensations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "basicSalary" DECIMAL(12,2) NOT NULL,
    "allowances" JSONB NOT NULL,
    "benefits" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_employee_compensations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_journal_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "runId" UUID,
    "entryDate" DATE NOT NULL,
    "description" TEXT,
    "entries" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "postedAt" TIMESTAMPTZ,
    "postedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_gl_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "componentType" TEXT NOT NULL,
    "glAccountCode" TEXT NOT NULL,
    "glAccountName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_gl_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_department_budgets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "totalBudget" DECIMAL(14,2) NOT NULL,
    "utilized" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remaining" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_department_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_headcount_budgets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "budgetedCount" INTEGER NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "frozen" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_headcount_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_performance_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reviewCycleId" TEXT,
    "reviewerEmployeeId" TEXT,
    "period" TEXT NOT NULL,
    "overallScore" DECIMAL(65,30),
    "ratings" JSONB NOT NULL,
    "strengths" TEXT,
    "areasForImprovement" TEXT,
    "goals" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "acknowledgedAt" TIMESTAMPTZ,
    "acknowledgedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_review_cycles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_review_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_okrs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT,
    "departmentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "keyResults" JSONB NOT NULL,
    "progress" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "parentOkrId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_okrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_kpis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "target" DECIMAL(65,30),
    "actual" DECIMAL(65,30),
    "unit" TEXT,
    "frequency" TEXT,
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_disciplinary_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "issuedDate" DATE NOT NULL,
    "expiryDate" DATE,
    "issuedBy" TEXT NOT NULL,
    "witnessedBy" TEXT,
    "employeeResponse" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "attachments" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_disciplinary_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_promotions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fromJobTitleId" TEXT,
    "toJobTitleId" TEXT,
    "fromGradeId" TEXT,
    "toGradeId" TEXT,
    "fromDepartmentId" TEXT,
    "toDepartmentId" TEXT,
    "effectiveDate" DATE NOT NULL,
    "salaryChange" JSONB,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_training_courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "category" TEXT,
    "provider" TEXT,
    "duration" INTEGER,
    "cost" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "isExternal" BOOLEAN NOT NULL DEFAULT false,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "maxParticipants" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_training_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_training_enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "courseId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "scheduledDate" DATE,
    "completedDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'enrolled',
    "score" DECIMAL(65,30),
    "certificate" JSONB,
    "feedback" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_training_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_training_budgets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "departmentId" TEXT,
    "fiscalYear" INTEGER NOT NULL,
    "allocated" DECIMAL(65,30) NOT NULL,
    "spent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "remaining" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_training_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_succession_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "positionId" TEXT,
    "jobTitleId" TEXT,
    "currentHolderId" TEXT,
    "successors" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_succession_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_employee_onboardings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "templateId" TEXT,
    "startDate" DATE NOT NULL,
    "expectedEndDate" DATE,
    "completedDate" DATE,
    "tasks" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "assignedBuddyId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_employee_onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_onboarding_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT,
    "tasks" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_onboarding_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_offboardings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "lastWorkingDay" DATE NOT NULL,
    "reason" TEXT,
    "tasks" JSONB NOT NULL,
    "clearances" JSONB,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "completedDate" DATE,
    "exitInterviewNotes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_offboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_employee_profile_sections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_employee_profile_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_employee_profile_section_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "prevData" JSONB NOT NULL,
    "nextData" JSONB NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "changeReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cvision_employee_profile_section_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_profile_section_schemas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "schema" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_profile_section_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_job_requisitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "requisitionNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" UUID NOT NULL,
    "unitId" UUID,
    "jobTitleId" UUID,
    "gradeId" UUID,
    "positionId" UUID,
    "headcountRequested" INTEGER NOT NULL DEFAULT 1,
    "reason" "CvisionRequisitionReason" NOT NULL DEFAULT 'NEW_POSITION',
    "employmentType" TEXT,
    "requirements" JSONB,
    "skills" JSONB,
    "experienceYears" JSONB,
    "salaryRange" JSONB,
    "status" "CvisionRequisitionStatus" NOT NULL DEFAULT 'DRAFT',
    "statusChangedAt" TIMESTAMPTZ,
    "statusReason" TEXT,
    "approvals" JSONB,
    "createdByUserId" UUID,
    "submittedAt" TIMESTAMPTZ,
    "submittedBy" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "approvedBy" TEXT,
    "openedAt" TIMESTAMPTZ,
    "closedAt" TIMESTAMPTZ,
    "targetStartDate" DATE,
    "closingDate" DATE,
    "applicantCount" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "cvision_job_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_candidates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "requisitionId" UUID,
    "applicationId" UUID,
    "departmentId" UUID,
    "jobTitleId" UUID,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" "CvisionCandidateSource" NOT NULL DEFAULT 'DIRECT',
    "referredBy" TEXT,
    "status" "CvisionCandidateStatus" NOT NULL DEFAULT 'NEW',
    "statusChangedAt" TIMESTAMPTZ,
    "statusReason" TEXT,
    "screeningScore" INTEGER,
    "notes" TEXT,
    "screenedBy" TEXT,
    "screenedAt" TIMESTAMPTZ,
    "interviews" JSONB,
    "offer" JSONB,
    "hiredAt" TIMESTAMPTZ,
    "employeeId" UUID,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "cvision_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_candidate_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "extractedText" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_candidate_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_interviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "requisitionId" UUID,
    "roundNumber" INTEGER NOT NULL,
    "type" "CvisionInterviewType" NOT NULL,
    "status" "CvisionInterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledDate" DATE NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "duration" INTEGER,
    "location" TEXT,
    "meetingLink" TEXT,
    "interviewers" JSONB,
    "notes" TEXT,
    "score" INTEGER,
    "feedback" TEXT,
    "decision" TEXT,
    "aiAnalysis" JSONB,
    "completedAt" TIMESTAMPTZ,
    "completedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_interview_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "interviewId" UUID NOT NULL,
    "sessionType" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ,
    "endedAt" TIMESTAMPTZ,
    "recording" JSONB,
    "transcript" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_job_postings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "requisitionId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "departmentName" TEXT,
    "location" TEXT,
    "employmentType" TEXT,
    "salaryRange" JSONB,
    "requirements" JSONB,
    "benefits" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ,
    "applicationCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "postingId" UUID NOT NULL,
    "candidateId" UUID,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "coverLetter" TEXT,
    "resumeKey" TEXT,
    "answers" JSONB,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_cv_parse_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "status" "CvisionCvParseStatus" NOT NULL DEFAULT 'QUEUED',
    "extractedRawText" TEXT,
    "extractedJson" JSONB,
    "meta" JSONB,
    "errors" TEXT,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_cv_parse_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_cv_inbox_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "parsedCount" INTEGER NOT NULL DEFAULT 0,
    "suggestedCount" INTEGER NOT NULL DEFAULT 0,
    "assignedCount" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_cv_inbox_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_cv_inbox_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "extractedRawText" TEXT,
    "status" "CvisionCvInboxItemStatus" NOT NULL DEFAULT 'UPLOADED',
    "parseError" TEXT,
    "suggestedRequisitionIds" JSONB,
    "suggestedScores" JSONB,
    "assignedRequisitionId" UUID,
    "assignedCandidateId" UUID,
    "assignedAt" TIMESTAMPTZ,
    "assignedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_cv_inbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_talent_pool" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "category" TEXT,
    "skills" JSONB,
    "notes" TEXT,
    "addedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_talent_pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_killout_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "requisitionId" UUID,
    "question" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "options" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "correctAnswer" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cvision_killout_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_candidate_rankings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "requisitionId" UUID,
    "overallScore" DECIMAL(5,2),
    "criteria" JSONB,
    "rankedBy" TEXT,
    "rankedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_candidate_rankings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cvision_manpower_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "positionId" UUID,
    "budgetedHeadcount" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "notes" TEXT,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cvision_manpower_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discharge_summary" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID NOT NULL,
    "sourceSystem" TEXT,
    "disposition" TEXT,
    "summaryText" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "discharge_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discharge_prescriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "reconciliationId" UUID,
    "drugName" TEXT,
    "dose" TEXT,
    "unit" TEXT,
    "frequency" TEXT,
    "route" TEXT,
    "duration" TEXT,
    "quantity" TEXT,
    "refills" INTEGER,
    "instructions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "discharge_prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "med_reconciliations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "type" TEXT,
    "items" JSONB,
    "homeMedications" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedBy" TEXT,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "med_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enhanced_discharge_summaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "encounterCoreId" UUID,
    "patientMasterId" UUID,
    "admissionDate" TIMESTAMPTZ,
    "dischargeDate" TIMESTAMPTZ,
    "attendingPhysician" TEXT,
    "admittingDiagnosis" TEXT,
    "dischargeDiagnoses" JSONB,
    "procedures" JSONB,
    "hospitalCourse" TEXT,
    "significantFindings" TEXT,
    "consultations" JSONB,
    "conditionAtDischarge" TEXT,
    "functionalStatus" TEXT,
    "dischargeMedications" JSONB,
    "medReconciliation" JSONB,
    "followUpAppointments" JSONB,
    "pendingResults" JSONB,
    "activityRestrictions" TEXT,
    "dietInstructions" TEXT,
    "woundCare" TEXT,
    "equipmentNeeded" JSONB,
    "homeHealth" BOOLEAN NOT NULL DEFAULT false,
    "homeHealthDetails" TEXT,
    "patientEducation" JSONB,
    "warningSignsToWatch" JSONB,
    "emergencyInstructions" TEXT,
    "codeStatus" TEXT,
    "advanceDirective" BOOLEAN NOT NULL DEFAULT false,
    "authorUserId" UUID,
    "authorName" TEXT,
    "signedAt" TIMESTAMPTZ,
    "coSignerUserId" UUID,
    "coSignerName" TEXT,
    "coSignedAt" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "enhanced_discharge_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ehr_patients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "mrn" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "gender" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "phone" TEXT,
    "email" TEXT,
    "address" JSONB,
    "nationalId" TEXT,
    "insuranceId" TEXT,
    "insuranceProvider" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deceasedDate" DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "ehr_patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ehr_privileges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" TEXT,
    "departmentId" TEXT,
    "expiresAt" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMPTZ,
    "revokedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ehr_privileges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ehr_encounters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "mrn" TEXT,
    "encounterNumber" TEXT,
    "encounterType" TEXT NOT NULL DEFAULT 'OUTPATIENT',
    "admissionDate" TIMESTAMPTZ,
    "dischargeDate" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "department" TEXT,
    "service" TEXT,
    "location" TEXT,
    "attendingPhysicianId" TEXT,
    "chiefComplaint" TEXT,
    "primaryDiagnosis" TEXT,
    "diagnosisCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ehr_encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ehr_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "mrn" TEXT,
    "orderType" TEXT NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "code" TEXT,
    "orderedBy" TEXT,
    "orderingProviderName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priority" TEXT NOT NULL DEFAULT 'ROUTINE',
    "instructions" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ehr_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ehr_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID,
    "noteType" TEXT NOT NULL DEFAULT 'PROGRESS',
    "title" TEXT,
    "content" TEXT,
    "authoredBy" TEXT,
    "authorName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "authoredAt" TIMESTAMPTZ,
    "sections" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ehr_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ehr_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID,
    "encounterId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taskType" TEXT NOT NULL DEFAULT 'OTHER',
    "assignedTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "completedBy" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ehr_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ehr_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ehr_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ehr_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "licenseNumber" TEXT,
    "specialty" TEXT,
    "department" TEXT,
    "role" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ehr_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_core" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterType" "EncounterType" NOT NULL,
    "status" "EncounterCoreStatus" NOT NULL DEFAULT 'CREATED',
    "department" TEXT NOT NULL,
    "openedAt" TIMESTAMPTZ,
    "closedAt" TIMESTAMPTZ,
    "sourceSystem" "EncounterSourceSystem",
    "sourceId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,
    "closedByUserId" TEXT,

    CONSTRAINT "encounter_core_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assetTag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "purchaseDate" DATE,
    "warrantyExpiry" DATE,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPERATIONAL',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_maintenance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "maintenanceType" TEXT NOT NULL,
    "performedBy" UUID NOT NULL,
    "performedAt" TIMESTAMPTZ NOT NULL,
    "nextDueDate" TIMESTAMPTZ,
    "findings" TEXT,
    "partsReplaced" JSONB NOT NULL DEFAULT '[]',
    "calibrationData" JSONB,
    "cost" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_issues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "reportedBy" UUID NOT NULL,
    "reportedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedBy" UUID,
    "resolvedAt" TIMESTAMPTZ,
    "resolution" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "equipment_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_patients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID,
    "tempMrn" TEXT,
    "mrn" TEXT,
    "fullName" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "dob" DATE,
    "gender" TEXT,
    "nationalId" TEXT,
    "iqama" TEXT,
    "passport" TEXT,
    "phone" TEXT,
    "status" TEXT DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "er_patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_encounters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID,
    "patientId" UUID NOT NULL,
    "status" "ErStatus" NOT NULL DEFAULT 'ARRIVED',
    "arrivalMethod" "ErArrivalMethod" NOT NULL DEFAULT 'WALKIN',
    "paymentStatus" "ErPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "triageLevel" INTEGER,
    "chiefComplaint" TEXT,
    "startedAt" TIMESTAMPTZ NOT NULL,
    "closedAt" TIMESTAMPTZ,
    "createdByUserId" TEXT NOT NULL,
    "visitNumber" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "er_encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_triage_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "encounterId" UUID NOT NULL,
    "nurseId" TEXT NOT NULL,
    "painScore" INTEGER,
    "vitals" JSONB,
    "allergiesShort" TEXT,
    "chronicShort" TEXT,
    "triageStartAt" TIMESTAMPTZ NOT NULL,
    "triageEndAt" TIMESTAMPTZ,
    "aiSuggestedLevel" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "er_triage_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_beds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "zone" TEXT NOT NULL,
    "bedLabel" TEXT NOT NULL,
    "state" "ErBedState" NOT NULL DEFAULT 'VACANT',
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "er_beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_bed_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "encounterId" UUID NOT NULL,
    "bedId" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ NOT NULL,
    "unassignedAt" TIMESTAMPTZ,
    "assignedByUserId" TEXT NOT NULL,

    CONSTRAINT "er_bed_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_staff_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "encounterId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ErStaffAssignmentRole" NOT NULL,
    "assignedAt" TIMESTAMPTZ NOT NULL,
    "unassignedAt" TIMESTAMPTZ,

    CONSTRAINT "er_staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "encounterId" UUID NOT NULL,
    "authorId" TEXT NOT NULL,
    "noteType" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "er_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_doctor_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "encounterId" UUID NOT NULL,
    "authorId" TEXT NOT NULL,
    "noteType" TEXT,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "freeText" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "er_doctor_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_nursing_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "authorId" TEXT NOT NULL,
    "nurseId" TEXT,
    "category" TEXT,
    "type" TEXT,
    "content" TEXT NOT NULL,
    "vitals" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mewsScore" INTEGER,
    "mewsLevel" TEXT,
    "consciousness" TEXT,
    "fallRiskScore" INTEGER,
    "fallRiskLevel" TEXT,
    "gcsScore" INTEGER,
    "bradenScore" INTEGER,
    "bradenRisk" TEXT,
    "painData" JSONB,
    "bradenData" JSONB,
    "ioData" JSONB,
    "sbarData" JSONB,
    "familyCommData" JSONB,
    "proceduresData" JSONB,
    "nursingTasksData" JSONB,
    "marData" JSONB,

    CONSTRAINT "er_nursing_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_dispositions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "destination" TEXT,
    "notes" TEXT,
    "admitWardUnit" TEXT,
    "handoffSbar" TEXT,
    "transferType" TEXT,
    "dischargeInstructions" TEXT,
    "finalDiagnosis" TEXT,
    "reasonForAdmission" TEXT,
    "decidedBy" TEXT NOT NULL,
    "decidedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "er_dispositions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "taskType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "label" TEXT,
    "orderSetKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT,
    "assignedTo" TEXT,
    "dueAt" TIMESTAMPTZ,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "resultAcknowledgedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "er_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_observations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "observationType" TEXT NOT NULL,
    "code" TEXT,
    "value" TEXT,
    "numericValue" DECIMAL(12,4),
    "unit" TEXT,
    "referenceRange" TEXT,
    "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
    "observedAt" TIMESTAMPTZ NOT NULL,
    "recordedBy" TEXT,
    "nurseId" TEXT,
    "vitals" JSONB,
    "painScore" INTEGER,
    "avpu" TEXT,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "criticalReasons" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "er_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_escalations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "escalatedTo" TEXT,
    "escalatedBy" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "urgency" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMPTZ,
    "resolvedBy" TEXT,
    "resolvedByUserId" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "er_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "severity" TEXT DEFAULT 'INFO',
    "readAt" TIMESTAMPTZ,
    "readByUserId" UUID,
    "createdBySystem" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "er_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_nursing_handovers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID,
    "fromNurseId" TEXT NOT NULL,
    "toNurseId" TEXT NOT NULL,
    "type" TEXT,
    "shiftType" TEXT,
    "patientSummary" TEXT,
    "sbar" JSONB,
    "pendingTasks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criticalAlerts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "handoverNotes" TEXT,
    "acknowledgedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "er_nursing_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_handovers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "erEncounterId" UUID,
    "ipdEpisodeId" TEXT,
    "fromDepartment" TEXT,
    "toDepartment" TEXT,
    "patientSummary" TEXT,
    "diagnosis" TEXT,
    "pendingOrders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "handoverNotes" TEXT,
    "handedOverBy" TEXT NOT NULL,
    "receivedBy" TEXT,
    "receivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respiratory_screenings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID,
    "patientId" UUID,
    "screeningData" JSONB,
    "result" TEXT,
    "riskLevel" TEXT,
    "screenedBy" TEXT,
    "screenedAt" TIMESTAMPTZ NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respiratory_screenings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_nursing_transfer_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "fromNurseId" TEXT NOT NULL,
    "toNurseId" TEXT,
    "requestedByUserId" TEXT,
    "reason" TEXT,
    "urgency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT,
    "notes" TEXT,
    "resolvedBy" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMPTZ,
    "resolution" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "er_nursing_transfer_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_sequences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "sequenceKey" TEXT NOT NULL,
    "currentVal" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "er_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mci_incidents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "triggerType" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "commandStructure" JSONB,
    "surgeCapacity" JSONB,
    "activatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedByUserId" UUID NOT NULL,
    "deactivatedAt" TIMESTAMPTZ,
    "deactivatedByUserId" UUID,
    "deactivationReason" TEXT,
    "patientCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mci_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mci_patients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "patientId" UUID,
    "triageTag" TEXT NOT NULL,
    "tagNumber" TEXT NOT NULL,
    "name" TEXT,
    "estimatedAge" INTEGER,
    "gender" TEXT,
    "chiefComplaint" TEXT,
    "triageNotes" TEXT,
    "disposition" TEXT,
    "arrivedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mci_patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "er_triage_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "scaleType" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "criteria" JSONB,
    "autoSuggestedLevel" INTEGER,
    "overrideReason" TEXT,
    "reassessmentDueAt" TIMESTAMPTZ,
    "assessedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "er_triage_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_alert_instances" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "alertRuleId" UUID NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "severity" "ImdadAlertSeverity" NOT NULL,
    "kpiCode" TEXT NOT NULL,
    "actualValue" DECIMAL(65,30) NOT NULL,
    "thresholdValue" DECIMAL(65,30) NOT NULL,
    "message" TEXT NOT NULL,
    "messageAr" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "acknowledgedBy" UUID,
    "acknowledgedAt" TIMESTAMPTZ,
    "resolvedAt" TIMESTAMPTZ,
    "resolvedBy" UUID,
    "firedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_alert_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_alert_rules" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "ruleName" TEXT NOT NULL,
    "ruleNameAr" TEXT,
    "ruleCode" TEXT NOT NULL,
    "kpiCode" TEXT NOT NULL,
    "conditionType" TEXT NOT NULL,
    "thresholdValue" DECIMAL(65,30) NOT NULL,
    "severity" "ImdadAlertSeverity" NOT NULL DEFAULT 'WARNING',
    "scopeType" TEXT,
    "scopeId" UUID,
    "notifyRoles" TEXT[] DEFAULT ARRAY[]::text[],
    "notifyUserIds" TEXT[] DEFAULT ARRAY[]::text[],
    "notifyChannels" TEXT[] DEFAULT ARRAY['IN_APP'::text],
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 60,
    "lastTriggeredAt" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_annual_budget_plans" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "planCode" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "planNameAr" TEXT,
    "status" "ImdadAnnualPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMPTZ,
    "submittedBy" UUID,
    "reviewedAt" TIMESTAMPTZ,
    "reviewedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "approvedBy" UUID,
    "totalCapitalBudget" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalOperationalBudget" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalMaintenanceBudget" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalRequestedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalApprovedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAllocatedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "corporateNotes" TEXT,
    "corporateNotesAr" TEXT,
    "aiSummary" TEXT,
    "aiSummaryAr" TEXT,
    "aiRiskScore" DECIMAL(65,30),
    "aiOptimizationSavings" DECIMAL(65,30),
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_annual_budget_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_approval_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "approverId" UUID NOT NULL,
    "status" "ImdadApprovalStatus" NOT NULL,
    "comments" TEXT,
    "delegatedToId" UUID,
    "decidedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSoDViolation" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_approval_delegations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "delegatorUserId" UUID NOT NULL,
    "delegateUserId" UUID NOT NULL,
    "validFrom" TIMESTAMPTZ NOT NULL,
    "validUntil" TIMESTAMPTZ NOT NULL,
    "documentTypes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_approval_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_approval_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "prId" UUID,
    "poId" UUID,
    "contractId" UUID,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "totalSteps" INTEGER NOT NULL DEFAULT 1,
    "status" "ImdadApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "timeoutHours" INTEGER DEFAULT 48,
    "escalateToId" UUID,
    "submittedBy" UUID NOT NULL,
    "submittedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_approval_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "approverId" UUID NOT NULL,
    "approverRole" TEXT,
    "timeoutHours" INTEGER DEFAULT 48,
    "canDelegate" BOOLEAN NOT NULL DEFAULT true,
    "status" "ImdadApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_approval_workflow_rule_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "approverType" "ImdadApproverType" NOT NULL,
    "approverUserId" UUID,
    "approverRoleKey" TEXT,
    "canDelegate" BOOLEAN NOT NULL DEFAULT true,
    "timeoutHours" INTEGER NOT NULL DEFAULT 48,
    "escalateToUserId" UUID,
    "escalateToRoleKey" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_approval_workflow_rule_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_approval_workflow_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "ruleOrder" INTEGER NOT NULL,
    "minAmount" DECIMAL(65,30) NOT NULL,
    "maxAmount" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_approval_workflow_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_approval_workflow_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "documentType" "ImdadApprovalDocumentType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "descriptionAr" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_approval_workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_asset_disposals" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "disposalNumber" TEXT NOT NULL,
    "assetId" UUID NOT NULL,
    "assetTag" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "disposalMethod" "ImdadDisposalMethod" NOT NULL,
    "disposalDate" TIMESTAMPTZ NOT NULL,
    "disposalReason" TEXT NOT NULL,
    "disposalReasonAr" TEXT,
    "bookValueAtDisposal" DECIMAL(65,30),
    "proceedsAmount" DECIMAL(65,30),
    "gainLoss" DECIMAL(65,30),
    "recipientName" TEXT,
    "recipientContact" TEXT,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "hazmatDisposal" BOOLEAN NOT NULL DEFAULT false,
    "disposalCertificate" TEXT,
    "processedBy" UUID NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::text[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_asset_disposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_asset_transfers" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "assetId" UUID NOT NULL,
    "assetTag" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "fromDepartmentId" UUID NOT NULL,
    "fromDepartmentName" TEXT,
    "fromLocationId" UUID,
    "fromCustodianId" UUID,
    "toDepartmentId" UUID NOT NULL,
    "toDepartmentName" TEXT,
    "toLocationId" UUID,
    "toCustodianId" UUID,
    "transferDate" TIMESTAMPTZ NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonAr" TEXT,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" UUID NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_asset_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_assets" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "assetTag" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetNameAr" TEXT,
    "assetCategory" TEXT NOT NULL,
    "assetSubCategory" TEXT,
    "status" "ImdadAssetStatus" NOT NULL DEFAULT 'IN_SERVICE',
    "serialNumber" TEXT,
    "modelNumber" TEXT,
    "manufacturer" TEXT,
    "brand" TEXT,
    "barcode" TEXT,
    "locationId" UUID,
    "departmentId" UUID,
    "buildingFloor" TEXT,
    "roomNumber" TEXT,
    "purchaseOrderId" UUID,
    "vendorId" UUID,
    "vendorName" TEXT,
    "purchaseDate" TIMESTAMPTZ,
    "purchaseCost" DECIMAL(65,30),
    "warrantyStartDate" TIMESTAMPTZ,
    "warrantyEndDate" TIMESTAMPTZ,
    "warrantyProvider" TEXT,
    "commissionDate" TIMESTAMPTZ,
    "expectedLifeYears" INTEGER,
    "decommissionDate" TIMESTAMPTZ,
    "depreciationMethod" "ImdadDepreciationMethod",
    "salvageValue" DECIMAL(65,30),
    "currentBookValue" DECIMAL(65,30),
    "accumulatedDepreciation" DECIMAL(65,30),
    "lastDepreciationDate" TIMESTAMPTZ,
    "maintenanceFrequencyDays" INTEGER,
    "lastMaintenanceDate" TIMESTAMPTZ,
    "nextMaintenanceDate" TIMESTAMPTZ,
    "calibrationFrequencyDays" INTEGER,
    "lastCalibrationDate" TIMESTAMPTZ,
    "nextCalibrationDate" TIMESTAMPTZ,
    "criticalityLevel" TEXT,
    "riskClassification" TEXT,
    "custodianUserId" UUID,
    "custodianName" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::text[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_attachments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "category" "ImdadAttachmentCategory" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageBucket" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "uploadedBy" UUID NOT NULL,
    "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMPTZ,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" UUID,
    "verifiedAt" TIMESTAMPTZ,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_audit_findings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "auditId" UUID NOT NULL,
    "findingNumber" INTEGER NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "evidence" TEXT,
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::text[],
    "correctiveAction" TEXT,
    "correctiveActionAr" TEXT,
    "responsibleParty" TEXT,
    "deadline" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMPTZ,
    "closedBy" UUID,
    "verifiedAt" TIMESTAMPTZ,
    "verifiedBy" UUID,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,

    CONSTRAINT "imdad_audit_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_audit_log_partitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "partitionKey" TEXT NOT NULL,
    "startDate" TIMESTAMPTZ NOT NULL,
    "endDate" TIMESTAMPTZ NOT NULL,
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "lastHash" TEXT,
    "isSealed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imdad_audit_log_partitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID,
    "actorUserId" UUID,
    "actorRole" TEXT,
    "actorEmail" TEXT,
    "action" "ImdadAuditAction" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" UUID,
    "boundedContext" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "method" TEXT,
    "path" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "previousData" JSONB,
    "newData" JSONB,
    "metadata" JSONB,
    "hashChain" TEXT,
    "previousHash" TEXT,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partitionKey" TEXT,

    CONSTRAINT "imdad_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_batch_lots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "lotNumber" TEXT,
    "serialNumber" TEXT,
    "manufacturingDate" TIMESTAMPTZ,
    "expiryDate" TIMESTAMPTZ,
    "receivedDate" TIMESTAMPTZ,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(65,30),
    "supplierId" UUID,
    "status" "ImdadBatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "quarantineReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_batch_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_bins" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "binCode" TEXT NOT NULL,
    "binLabel" TEXT,
    "binLabelAr" TEXT,
    "aisle" TEXT,
    "rack" TEXT,
    "shelf" TEXT,
    "position" TEXT,
    "barcode" TEXT,
    "widthCm" DECIMAL(65,30),
    "heightCm" DECIMAL(65,30),
    "depthCm" DECIMAL(65,30),
    "maxWeightKg" DECIMAL(65,30),
    "status" "ImdadBinStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentItemId" UUID,
    "currentQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isMixedItem" BOOLEAN NOT NULL DEFAULT false,
    "cycleCountFrequency" "ImdadCycleCountFrequency",
    "lastCountDate" TIMESTAMPTZ,
    "nextCountDate" TIMESTAMPTZ,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_budget_benchmarks" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "annualPlanId" UUID,
    "fiscalYear" INTEGER NOT NULL,
    "metric" "ImdadBenchmarkMetric" NOT NULL,
    "metricValue" DECIMAL(65,30) NOT NULL,
    "networkAverage" DECIMAL(65,30),
    "networkMedian" DECIMAL(65,30),
    "networkBest" DECIMAL(65,30),
    "networkWorst" DECIMAL(65,30),
    "percentileRank" DECIMAL(65,30),
    "trend" TEXT,
    "trendAr" TEXT,
    "departmentId" UUID,
    "calculatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_budget_benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_budget_consumptions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "budgetId" UUID NOT NULL,
    "budgetLineId" UUID,
    "referenceType" TEXT NOT NULL,
    "referenceId" UUID NOT NULL,
    "referenceNumber" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "isCommitment" BOOLEAN NOT NULL DEFAULT false,
    "isReversal" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "consumedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,

    CONSTRAINT "imdad_budget_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_budget_lines" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "budgetId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "glAccountCode" TEXT,
    "itemCategoryCode" TEXT,
    "allocatedAmount" DECIMAL(65,30) NOT NULL,
    "consumedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "committedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "availableAmount" DECIMAL(65,30) NOT NULL,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_budget_proposals" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "annualPlanId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "departmentName" TEXT NOT NULL,
    "departmentNameAr" TEXT,
    "proposalCode" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "category" "ImdadProposalCategory" NOT NULL,
    "priority" "ImdadProposalPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "description" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "justification" TEXT,
    "justificationAr" TEXT,
    "requestedAmount" DECIMAL(65,30) NOT NULL,
    "approvedAmount" DECIMAL(65,30),
    "previousYearSpend" DECIMAL(65,30),
    "projectedSavings" DECIMAL(65,30),
    "roiPercentage" DECIMAL(65,30),
    "clinicalImpactScore" INTEGER,
    "riskIfNotApproved" TEXT,
    "riskIfNotApprovedAr" TEXT,
    "status" "ImdadAnnualPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMPTZ,
    "submittedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "approvedBy" UUID,
    "reviewerNotes" TEXT,
    "reviewerNotesAr" TEXT,
    "aiRecommendation" TEXT,
    "aiRecommendationAr" TEXT,
    "aiAnomalyFlags" JSONB,
    "aiAlternatives" JSONB,
    "supportingData" JSONB,
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::text[],
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_budget_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_budget_transfers" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "fromBudgetId" UUID NOT NULL,
    "fromBudgetLineId" UUID,
    "toBudgetId" UUID NOT NULL,
    "toBudgetLineId" UUID,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "reason" TEXT NOT NULL,
    "reasonAr" TEXT,
    "status" "ImdadBudgetTransferStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" UUID NOT NULL,
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "executedAt" TIMESTAMPTZ,
    "rejectionReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_budget_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_budgets" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "budgetCode" TEXT NOT NULL,
    "budgetName" TEXT NOT NULL,
    "budgetNameAr" TEXT,
    "fiscalYear" INTEGER NOT NULL,
    "periodType" "ImdadBudgetPeriodType" NOT NULL,
    "periodStart" TIMESTAMPTZ NOT NULL,
    "periodEnd" TIMESTAMPTZ NOT NULL,
    "costCenterId" UUID NOT NULL,
    "departmentId" UUID,
    "categoryCode" TEXT,
    "allocatedAmount" DECIMAL(65,30) NOT NULL,
    "adjustedAmount" DECIMAL(65,30) NOT NULL,
    "consumedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "committedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "availableAmount" DECIMAL(65,30) NOT NULL,
    "warningThreshold" DECIMAL(65,30) NOT NULL DEFAULT 80,
    "criticalThreshold" DECIMAL(65,30) NOT NULL DEFAULT 95,
    "status" "ImdadBudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_charge_capture_items" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "chargeCaptureId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "unitCost" DECIMAL(65,30) NOT NULL,
    "totalCost" DECIMAL(65,30) NOT NULL,
    "batchLotId" UUID,
    "serialNumber" TEXT,
    "inventoryTransactionId" UUID,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,

    CONSTRAINT "imdad_charge_capture_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_charge_captures" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "chargeNumber" TEXT NOT NULL,
    "chargeType" "ImdadChargeType" NOT NULL,
    "chargeDate" TIMESTAMPTZ NOT NULL,
    "costCenterId" UUID NOT NULL,
    "departmentId" UUID,
    "locationId" UUID,
    "patientId" UUID,
    "encounterId" UUID,
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "budgetId" UUID,
    "budgetLineId" UUID,
    "notes" TEXT,
    "metadata" JSONB,
    "isPosted" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMPTZ,
    "postedBy" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_charge_captures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_compliance_certificates" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "certificateType" "ImdadCertificateType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "entityName" TEXT,
    "issuingAuthority" TEXT NOT NULL,
    "issuingAuthorityAr" TEXT,
    "certificateRef" TEXT,
    "issuedDate" TIMESTAMPTZ NOT NULL,
    "expiryDate" TIMESTAMPTZ NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" UUID,
    "verifiedAt" TIMESTAMPTZ,
    "renewalReminderDays" INTEGER NOT NULL DEFAULT 60,
    "renewalStatus" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::text[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_compliance_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_consumption_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "consumptionType" TEXT NOT NULL,
    "patientId" UUID,
    "encounterId" UUID,
    "batchLotId" UUID,
    "unitCost" DECIMAL(65,30),
    "totalCost" DECIMAL(65,30),
    "consumedBy" UUID NOT NULL,
    "consumedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imdad_consumption_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_contract_amendments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "amendmentNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "valueBefore" DECIMAL(65,30),
    "valueAfter" DECIMAL(65,30),
    "dateBefore" TIMESTAMPTZ,
    "dateAfter" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "effectiveDate" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,

    CONSTRAINT "imdad_contract_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_contract_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "minQty" INTEGER,
    "maxQty" INTEGER,
    "discountPct" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_contract_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID,
    "contractNumber" TEXT NOT NULL,
    "vendorId" UUID NOT NULL,
    "type" "ImdadContractType" NOT NULL DEFAULT 'SUPPLY_AGREEMENT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "value" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "paymentTerms" TEXT,
    "startDate" TIMESTAMPTZ NOT NULL,
    "endDate" TIMESTAMPTZ NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "renewalTermDays" INTEGER,
    "status" "ImdadContractStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "fileUrl" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_cost_centers" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "parentId" UUID,
    "departmentId" UUID,
    "glAccountCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "managerUserId" UUID,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_dashboard_configs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "configName" TEXT NOT NULL,
    "configNameAr" TEXT,
    "configType" TEXT NOT NULL,
    "userId" UUID,
    "roleType" TEXT,
    "layout" JSONB NOT NULL,
    "widgets" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_dashboard_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_decision_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "decisionId" UUID NOT NULL,
    "actionCode" TEXT NOT NULL,
    "actionType" "ImdadDecisionActionType" NOT NULL,
    "sequenceOrder" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "description" TEXT,
    "status" "ImdadDecisionActionStatus" NOT NULL DEFAULT 'PENDING',
    "targetEntityType" TEXT,
    "targetEntityId" UUID,
    "estimatedCost" DECIMAL(65,30),
    "scheduledDate" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "resultData" JSONB,
    "errorMessage" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_decision_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "decisionCode" TEXT NOT NULL,
    "decisionType" "ImdadDecisionType" NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "description" TEXT,
    "descriptionAr" TEXT,
    "confidenceScore" DECIMAL(65,30) NOT NULL,
    "riskScore" DECIMAL(65,30),
    "impactScore" DECIMAL(65,30),
    "costImpact" DECIMAL(65,30),
    "savingsEstimate" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "status" "ImdadDecisionStatus" NOT NULL DEFAULT 'GENERATED',
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "autoApprovalThreshold" DECIMAL(65,30),
    "escalationLevel" "ImdadEscalationLevel" NOT NULL DEFAULT 'NONE',
    "executionDeadline" TIMESTAMPTZ,
    "executedAt" TIMESTAMPTZ,
    "executedBy" UUID,
    "overriddenAt" TIMESTAMPTZ,
    "overriddenBy" UUID,
    "overrideReason" TEXT,
    "sourceSignals" JSONB,
    "recommendedActions" JSONB,
    "alternativeOptions" JSONB,
    "aiReasoning" TEXT,
    "aiReasoningAr" TEXT,
    "departmentId" UUID,
    "relatedAssetIds" TEXT[] DEFAULT ARRAY[]::text[],
    "relatedItemIds" TEXT[] DEFAULT ARRAY[]::text[],
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_delegation_chains" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "delegatorUserId" UUID NOT NULL,
    "delegateUserId" UUID NOT NULL,
    "delegationType" "ImdadDelegationType" NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonAr" TEXT,
    "startDate" TIMESTAMPTZ NOT NULL,
    "endDate" TIMESTAMPTZ NOT NULL,
    "maxApprovalAmount" DECIMAL(65,30),
    "departmentIds" TEXT[] DEFAULT ARRAY[]::text[],
    "permissionKeys" TEXT[] DEFAULT ARRAY[]::text[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMPTZ,
    "revokedBy" UUID,
    "revocationReason" TEXT,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_delegation_chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_department_users" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "canRequisition" BOOLEAN NOT NULL DEFAULT true,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "canReceive" BOOLEAN NOT NULL DEFAULT false,
    "canDispense" BOOLEAN NOT NULL DEFAULT false,
    "maxApprovalLimit" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMPTZ,
    "endDate" TIMESTAMPTZ,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_department_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "type" TEXT,
    "parentId" UUID,
    "costCenterId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_device_replacement_plans" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "annualPlanId" UUID,
    "departmentId" UUID NOT NULL,
    "departmentName" TEXT NOT NULL,
    "departmentNameAr" TEXT,
    "assetId" UUID NOT NULL,
    "assetTag" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetNameAr" TEXT,
    "manufacturer" TEXT,
    "modelNumber" TEXT,
    "currentAge" INTEGER NOT NULL,
    "expectedLifeYears" INTEGER NOT NULL,
    "lifecycleExceeded" BOOLEAN NOT NULL DEFAULT false,
    "performanceDegradation" DECIMAL(65,30),
    "maintenanceCostRatio" DECIMAL(65,30),
    "downtimeHoursYTD" DECIMAL(65,30),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "compatibilityIssues" TEXT,
    "compatibilityIssuesAr" TEXT,
    "technologyObsolescence" BOOLEAN NOT NULL DEFAULT false,
    "replacementUrgency" "ImdadDeviceReplacementUrgency" NOT NULL DEFAULT 'WITHIN_1_YEAR',
    "estimatedReplacementCost" DECIMAL(65,30),
    "recommendedModel" TEXT,
    "recommendedVendor" TEXT,
    "suggestedPhase" "ImdadInvestmentPhase",
    "aiRiskScore" DECIMAL(65,30),
    "aiImpactAnalysis" TEXT,
    "aiImpactAnalysisAr" TEXT,
    "clinicalImpact" TEXT,
    "clinicalImpactAr" TEXT,
    "patientSafetyRisk" BOOLEAN NOT NULL DEFAULT false,
    "regulatoryRisk" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_device_replacement_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_dispense_lines" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "dispenseRequestId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "orderedQty" DECIMAL(65,30) NOT NULL,
    "dispensedQty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "returnedQty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unitOfMeasure" TEXT NOT NULL,
    "batchLotId" UUID,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMPTZ,
    "sourceLocationId" UUID,
    "sourceBinId" UUID,
    "dosage" TEXT,
    "frequency" TEXT,
    "route" TEXT,
    "duration" TEXT,
    "unitCost" DECIMAL(65,30),
    "totalCost" DECIMAL(65,30),
    "isSubstituted" BOOLEAN NOT NULL DEFAULT false,
    "substitutionReason" TEXT,
    "originalItemId" UUID,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,

    CONSTRAINT "imdad_dispense_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_dispense_requests" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "dispenseNumber" TEXT NOT NULL,
    "status" "ImdadDispenseStatus" NOT NULL DEFAULT 'PENDING',
    "orderType" TEXT NOT NULL,
    "orderId" UUID,
    "orderNumber" TEXT,
    "patientId" UUID,
    "patientMrn" TEXT,
    "patientName" TEXT,
    "departmentId" UUID NOT NULL,
    "departmentName" TEXT,
    "wardId" UUID,
    "bedNumber" TEXT,
    "prescriberId" UUID,
    "prescriberName" TEXT,
    "pharmacyLocationId" UUID,
    "pharmacyName" TEXT,
    "dispensedBy" UUID,
    "dispensedAt" TIMESTAMPTZ,
    "verifiedBy" UUID,
    "verifiedAt" TIMESTAMPTZ,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "requiredByDate" TIMESTAMPTZ,
    "notes" TEXT,
    "clinicalNotes" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_dispense_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_event_bus_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID,
    "channel" "ImdadEventBusChannel" NOT NULL,
    "eventType" TEXT NOT NULL,
    "sourceBC" TEXT NOT NULL,
    "targetBC" TEXT,
    "payload" JSONB NOT NULL,
    "correlationId" UUID,
    "status" "ImdadEventBusStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "processedAt" TIMESTAMPTZ,
    "deadLetteredAt" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_event_bus_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_formulary_items" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "formularyStatus" "ImdadFormularyStatus" NOT NULL DEFAULT 'ACTIVE',
    "formularyCategory" TEXT,
    "therapeuticClass" TEXT,
    "genericName" TEXT,
    "genericNameAr" TEXT,
    "isControlled" BOOLEAN NOT NULL DEFAULT false,
    "controlSchedule" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalLevel" TEXT,
    "maxDailyDose" TEXT,
    "maxOrderQty" DECIMAL(65,30),
    "indications" TEXT,
    "indicationsAr" TEXT,
    "contraindications" TEXT,
    "sideEffects" TEXT,
    "interactions" TEXT,
    "storageInstructions" TEXT,
    "unitPrice" DECIMAL(65,30),
    "insuranceCovered" BOOLEAN NOT NULL DEFAULT true,
    "lastReviewDate" TIMESTAMPTZ,
    "nextReviewDate" TIMESTAMPTZ,
    "reviewedBy" UUID,
    "committeeApproval" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_formulary_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_goods_receiving_note_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "grnId" UUID NOT NULL,
    "poLineId" UUID,
    "itemId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "orderedQty" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL,
    "acceptedQty" INTEGER NOT NULL DEFAULT 0,
    "rejectedQty" INTEGER NOT NULL DEFAULT 0,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMPTZ,
    "manufacturingDate" TIMESTAMPTZ,
    "unitCost" DECIMAL(65,30),
    "locationId" UUID,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_goods_receiving_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_goods_receiving_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "poId" UUID NOT NULL,
    "vendorId" UUID,
    "status" "ImdadGRNStatus" NOT NULL DEFAULT 'DRAFT',
    "receivedBy" UUID NOT NULL,
    "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedBy" UUID,
    "verifiedAt" TIMESTAMPTZ,
    "qualityStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "qualityCheckedBy" UUID,
    "qualityCheckedAt" TIMESTAMPTZ,
    "deliveryNoteNumber" TEXT,
    "deliveryDate" TIMESTAMPTZ,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_goods_receiving_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_grn_discrepancies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "grnId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "expectedQty" INTEGER,
    "actualQty" INTEGER,
    "description" TEXT NOT NULL,
    "resolution" "ImdadDiscrepancyResolution",
    "resolvedBy" UUID,
    "resolvedAt" TIMESTAMPTZ,
    "resolutionNotes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_grn_discrepancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_inspection_checklists" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "inspectionId" UUID NOT NULL,
    "checkNumber" INTEGER NOT NULL,
    "checkName" TEXT NOT NULL,
    "checkNameAr" TEXT,
    "checkCategory" TEXT,
    "specification" TEXT,
    "tolerance" TEXT,
    "result" TEXT,
    "actualValue" TEXT,
    "isDefect" BOOLEAN NOT NULL DEFAULT false,
    "defectDescription" TEXT,
    "severity" TEXT,
    "notes" TEXT,
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::text[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,

    CONSTRAINT "imdad_inspection_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_inspection_templates" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "templateCode" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateNameAr" TEXT,
    "inspectionType" "ImdadInspectionType" NOT NULL,
    "itemCategory" TEXT,
    "checks" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_inspection_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_inventory_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "adjustmentNumber" TEXT NOT NULL,
    "itemId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "reason" "ImdadAdjustmentReason" NOT NULL,
    "reasonDetail" TEXT,
    "quantityChange" INTEGER NOT NULL,
    "previousStock" INTEGER NOT NULL,
    "newStock" INTEGER NOT NULL,
    "costImpact" DECIMAL(65,30),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" UUID NOT NULL,
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "rejectionReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_inventory_locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "type" TEXT NOT NULL,
    "parentId" UUID,
    "departmentId" UUID,
    "temperatureZone" TEXT,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_inventory_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_inventory_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "movementType" "ImdadMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" UUID,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMPTZ,
    "unitCost" DECIMAL(65,30),
    "totalCost" DECIMAL(65,30),
    "performedBy" UUID NOT NULL,
    "performedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "notes" TEXT,
    "fromOrgId" UUID,
    "toOrgId" UUID,
    "fromLocationId" UUID,
    "toLocationId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imdad_inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_invoice_lines" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID,
    "itemCode" TEXT,
    "description" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitOfMeasure" TEXT,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "lineTotal" DECIMAL(65,30) NOT NULL,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "poLineId" UUID,
    "poLineNumber" INTEGER,
    "grnLineId" UUID,
    "grnLineNumber" INTEGER,
    "matchStatus" TEXT DEFAULT 'UNMATCHED',
    "quantityVariance" DECIMAL(65,30),
    "priceVariance" DECIMAL(65,30),
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,

    CONSTRAINT "imdad_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_invoices" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "internalNumber" TEXT NOT NULL,
    "vendorId" UUID NOT NULL,
    "vendorName" TEXT NOT NULL,
    "invoiceDate" TIMESTAMPTZ NOT NULL,
    "dueDate" TIMESTAMPTZ NOT NULL,
    "receivedDate" TIMESTAMPTZ,
    "purchaseOrderId" UUID,
    "purchaseOrderNumber" TEXT,
    "grnId" UUID,
    "grnNumber" TEXT,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(65,30) NOT NULL DEFAULT 15,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "status" "ImdadInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "isMatched" BOOLEAN NOT NULL DEFAULT false,
    "matchVariance" DECIMAL(65,30),
    "matchTolerancePct" DECIMAL(65,30) NOT NULL DEFAULT 2,
    "paymentTerms" TEXT,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "metadata" JSONB,
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::text[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_item_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "parentId" UUID,
    "level" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_item_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_item_locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "maxStock" INTEGER,
    "reorderQty" INTEGER,
    "safetyStock" INTEGER NOT NULL DEFAULT 0,
    "lastCountDate" TIMESTAMPTZ,
    "lastReceiptDate" TIMESTAMPTZ,
    "lastIssueDate" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "imdad_item_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_item_masters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID,
    "code" TEXT NOT NULL,
    "barcode" TEXT,
    "gtin" TEXT,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "itemType" "ImdadItemType" NOT NULL,
    "categoryId" UUID,
    "subcategory" TEXT,
    "genericName" TEXT,
    "brandName" TEXT,
    "baseUomId" UUID,
    "purchaseUomId" UUID,
    "dispensingUomId" UUID,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "isControlled" BOOLEAN NOT NULL DEFAULT false,
    "requiresColdChain" BOOLEAN NOT NULL DEFAULT false,
    "hazardClass" TEXT,
    "expiryTracked" BOOLEAN NOT NULL DEFAULT true,
    "minShelfLifeDays" INTEGER,
    "requiresSerialTracking" BOOLEAN NOT NULL DEFAULT false,
    "requiresBatchTracking" BOOLEAN NOT NULL DEFAULT true,
    "standardCost" DECIMAL(65,30),
    "lastPurchaseCost" DECIMAL(65,30),
    "weightedAvgCost" DECIMAL(65,30),
    "taxRate" DECIMAL(65,30),
    "manufacturer" TEXT,
    "countryOfOrigin" TEXT,
    "sfdaRegistration" TEXT,
    "formularyStatus" TEXT,
    "abcClassification" TEXT,
    "vedClassification" TEXT,
    "lastReviewedAt" TIMESTAMPTZ,
    "status" "ImdadItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_item_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_item_substitutes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "substituteId" UUID NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,

    CONSTRAINT "imdad_item_substitutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_job_executions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID,
    "jobName" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "triggerEvent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,
    "durationMs" INTEGER,
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "resultSummary" JSONB,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_job_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_kpi_snapshots" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "kpiCode" TEXT NOT NULL,
    "periodType" "ImdadKpiPeriodType" NOT NULL,
    "periodStart" TIMESTAMPTZ NOT NULL,
    "periodEnd" TIMESTAMPTZ NOT NULL,
    "numericValue" DECIMAL(65,30),
    "previousValue" DECIMAL(65,30),
    "targetValue" DECIMAL(65,30),
    "percentChange" DECIMAL(65,30),
    "dimensionType" TEXT,
    "dimensionId" UUID,
    "dimensionName" TEXT,
    "dataPoints" INTEGER NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imdad_kpi_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_maintenance_orders" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "assetId" UUID NOT NULL,
    "assetTag" TEXT,
    "assetName" TEXT,
    "maintenanceType" "ImdadMaintenanceType" NOT NULL,
    "status" "ImdadMaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledDate" TIMESTAMPTZ NOT NULL,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "assignedTo" UUID,
    "assignedTeam" TEXT,
    "externalVendorId" UUID,
    "externalVendorName" TEXT,
    "description" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "workPerformed" TEXT,
    "workPerformedAr" TEXT,
    "findings" TEXT,
    "findingsAr" TEXT,
    "partsUsed" JSONB,
    "laborHours" DECIMAL(65,30),
    "laborCost" DECIMAL(65,30),
    "partsCost" DECIMAL(65,30),
    "externalCost" DECIMAL(65,30),
    "totalCost" DECIMAL(65,30),
    "resultStatus" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNotes" TEXT,
    "downtimeHours" DECIMAL(65,30),
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "metadata" JSONB,
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::text[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_maintenance_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_non_conformance_reports" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "ncrNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "description" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "category" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" UUID,
    "itemId" UUID,
    "vendorId" UUID,
    "severity" TEXT NOT NULL,
    "impactAssessment" TEXT,
    "impactAssessmentAr" TEXT,
    "rootCause" TEXT,
    "rootCauseAr" TEXT,
    "investigatedBy" UUID,
    "investigatedAt" TIMESTAMPTZ,
    "correctiveAction" TEXT,
    "correctiveActionAr" TEXT,
    "preventiveAction" TEXT,
    "preventiveActionAr" TEXT,
    "actionDeadline" TIMESTAMPTZ,
    "responsibleUserId" UUID,
    "closedAt" TIMESTAMPTZ,
    "closedBy" UUID,
    "verifiedAt" TIMESTAMPTZ,
    "verifiedBy" UUID,
    "reportedBy" UUID NOT NULL,
    "reportedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "metadata" JSONB,
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::text[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_non_conformance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_notification_preferences" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channel" "ImdadNotificationChannel" NOT NULL,
    "templateCode" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "digestMode" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_notification_templates" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "templateCode" TEXT NOT NULL,
    "channel" "ImdadNotificationChannel" NOT NULL,
    "priority" "ImdadNotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "subjectEn" TEXT NOT NULL,
    "subjectAr" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "targetRoles" TEXT[] DEFAULT ARRAY[]::text[],
    "targetEvent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "body" TEXT,
    "bodyAr" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "actionUrl" TEXT,
    "resourceType" TEXT,
    "resourceId" UUID,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMPTZ,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedAt" TIMESTAMPTZ,
    "channels" TEXT[] DEFAULT ARRAY['in_app'::text],
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "smsSent" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_operational_signals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "signalCode" TEXT NOT NULL,
    "signalType" "ImdadSignalType" NOT NULL,
    "severity" "ImdadSignalSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "description" TEXT,
    "descriptionAr" TEXT,
    "sourceEntity" TEXT NOT NULL,
    "sourceEntityId" UUID,
    "departmentId" UUID,
    "metricValue" DECIMAL(65,30),
    "threshold" DECIMAL(65,30),
    "deviationPct" DECIMAL(65,30),
    "detectedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ,
    "sourceDecisionId" UUID,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" UUID,
    "acknowledgedAt" TIMESTAMPTZ,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_operational_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "type" TEXT,
    "region" TEXT,
    "city" TEXT,
    "address" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "bedCount" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "goLiveDate" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_patient_charges" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "chargeNumber" TEXT NOT NULL,
    "status" "ImdadChargeStatus" NOT NULL DEFAULT 'PENDING',
    "patientId" UUID NOT NULL,
    "patientMrn" TEXT,
    "patientName" TEXT,
    "encounterId" UUID,
    "itemId" UUID NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(65,30) NOT NULL,
    "insuranceCovered" BOOLEAN NOT NULL DEFAULT false,
    "insuranceAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "patientAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dispenseRequestId" UUID,
    "departmentId" UUID NOT NULL,
    "costCenterId" UUID,
    "billedAt" TIMESTAMPTZ,
    "billingReference" TEXT,
    "reversedAt" TIMESTAMPTZ,
    "reversalReason" TEXT,
    "chargedBy" UUID NOT NULL,
    "chargedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_patient_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_patient_returns" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "reason" "ImdadReturnReason" NOT NULL,
    "dispenseRequestId" UUID,
    "dispenseNumber" TEXT,
    "patientId" UUID,
    "patientMrn" TEXT,
    "patientName" TEXT,
    "departmentId" UUID NOT NULL,
    "departmentName" TEXT,
    "itemId" UUID NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "batchLotId" UUID,
    "batchNumber" TEXT,
    "disposition" TEXT NOT NULL DEFAULT 'RETURN_TO_STOCK',
    "isRestockable" BOOLEAN NOT NULL DEFAULT true,
    "unitCost" DECIMAL(65,30),
    "totalCredit" DECIMAL(65,30),
    "returnedBy" UUID NOT NULL,
    "returnedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedBy" UUID,
    "processedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_patient_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_payment_batches" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "paymentDate" TIMESTAMPTZ NOT NULL,
    "vendorId" UUID NOT NULL,
    "vendorName" TEXT NOT NULL,
    "invoiceId" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "paymentMethod" "ImdadPaymentMethod" NOT NULL,
    "paymentReference" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "bankAccountCode" TEXT,
    "bankName" TEXT,
    "status" "ImdadPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "processedAt" TIMESTAMPTZ,
    "failureReason" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_payment_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID,
    "permissionKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "category" "ImdadPermissionCategory" NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_phased_investments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "annualPlanId" UUID NOT NULL,
    "investmentCode" TEXT NOT NULL,
    "investmentName" TEXT NOT NULL,
    "investmentNameAr" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "totalInvestment" DECIMAL(65,30) NOT NULL,
    "phase" "ImdadInvestmentPhase" NOT NULL DEFAULT 'PHASE_1',
    "phaseYear" INTEGER NOT NULL,
    "phaseAmount" DECIMAL(65,30) NOT NULL,
    "cumulativeSpend" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalPhases" INTEGER NOT NULL DEFAULT 1,
    "itemsInPhase" INTEGER NOT NULL DEFAULT 0,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "priorityScore" DECIMAL(65,30),
    "riskScore" DECIMAL(65,30),
    "departmentId" UUID,
    "departmentName" TEXT,
    "assetCategory" TEXT,
    "status" "ImdadAnnualPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMPTZ,
    "approvedBy" UUID,
    "aiJustification" TEXT,
    "aiJustificationAr" TEXT,
    "costDistribution" JSONB,
    "milestones" JSONB,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_phased_investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_pick_lines" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "pickListId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "requestedQty" DECIMAL(65,30) NOT NULL,
    "pickedQty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unitOfMeasure" TEXT NOT NULL,
    "sourceBinId" UUID NOT NULL,
    "sourceBinCode" TEXT,
    "batchLotId" UUID,
    "serialNumber" TEXT,
    "isPicked" BOOLEAN NOT NULL DEFAULT false,
    "pickedAt" TIMESTAMPTZ,
    "pickedBy" UUID,
    "shortageQty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "shortageReason" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,

    CONSTRAINT "imdad_pick_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_pick_lists" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "pickNumber" TEXT NOT NULL,
    "status" "ImdadPickStatus" NOT NULL DEFAULT 'PENDING',
    "sourceType" TEXT NOT NULL,
    "sourceId" UUID NOT NULL,
    "sourceNumber" TEXT,
    "destinationLocationId" UUID,
    "destinationDepartmentId" UUID,
    "assignedTo" UUID,
    "assignedAt" TIMESTAMPTZ,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "requiredByDate" TIMESTAMPTZ,
    "notes" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_pick_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_print_templates" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "templateCode" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateNameAr" TEXT,
    "documentType" TEXT NOT NULL,
    "paperSize" TEXT NOT NULL DEFAULT 'A4',
    "orientation" TEXT NOT NULL DEFAULT 'PORTRAIT',
    "headerHtml" TEXT,
    "bodyHtml" TEXT NOT NULL,
    "footerHtml" TEXT,
    "includesLogo" BOOLEAN NOT NULL DEFAULT true,
    "includesBarcode" BOOLEAN NOT NULL DEFAULT false,
    "includesQrCode" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_print_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_proposal_line_items" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "itemDescriptionAr" TEXT,
    "itemCode" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCost" DECIMAL(65,30) NOT NULL,
    "totalCost" DECIMAL(65,30) NOT NULL,
    "currentAssetTag" TEXT,
    "replacesAssetId" UUID,
    "isReplacement" BOOLEAN NOT NULL DEFAULT false,
    "vendorSuggestion" TEXT,
    "leadTimeDays" INTEGER,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_proposal_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_purchase_order_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "poId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(65,30) NOT NULL,
    "totalCost" DECIMAL(65,30) NOT NULL,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "uomId" UUID,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMPTZ,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_purchase_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "poNumber" TEXT NOT NULL,
    "vendorId" UUID NOT NULL,
    "contractId" UUID,
    "prId" UUID,
    "status" "ImdadPOStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "paymentTerms" TEXT,
    "vendorName" TEXT,
    "deliveryDate" TIMESTAMPTZ,
    "expectedDeliveryDate" TIMESTAMPTZ,
    "deliveryAddress" TEXT,
    "shippingMethod" TEXT,
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "orderDate" TIMESTAMPTZ,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMPTZ,
    "invoiceAmount" DECIMAL(65,30),
    "zakatcaVerified" BOOLEAN NOT NULL DEFAULT false,
    "budgetId" UUID,
    "costCenterId" UUID,
    "notes" TEXT,
    "sentAt" TIMESTAMPTZ,
    "acknowledgedAt" TIMESTAMPTZ,
    "closedAt" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_purchase_requisition_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "prId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "uomId" UUID,
    "estimatedUnitCost" DECIMAL(65,30),
    "estimatedTotal" DECIMAL(65,30),
    "preferredVendorId" UUID,
    "contractId" UUID,
    "contractLineId" UUID,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_purchase_requisition_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_purchase_requisitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "prNumber" TEXT NOT NULL,
    "title" TEXT,
    "status" "ImdadPRStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "departmentId" UUID,
    "costCenterId" UUID,
    "requestedBy" UUID NOT NULL,
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "justification" TEXT,
    "estimatedTotal" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "requiredDate" TIMESTAMPTZ,
    "budgetId" UUID,
    "budgetLineId" UUID,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_purchase_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_put_away_lines" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "putAwayTaskId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "batchLotId" UUID,
    "serialNumber" TEXT,
    "targetBinId" UUID NOT NULL,
    "actualBinId" UUID,
    "isPutAway" BOOLEAN NOT NULL DEFAULT false,
    "putAwayAt" TIMESTAMPTZ,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,

    CONSTRAINT "imdad_put_away_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_put_away_rules" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "ruleName" TEXT NOT NULL,
    "ruleNameAr" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "itemCategory" TEXT,
    "itemType" TEXT,
    "storageCondition" TEXT,
    "isControlled" BOOLEAN,
    "isHazardous" BOOLEAN,
    "targetZoneType" "ImdadWarehouseZoneType",
    "targetZoneId" UUID,
    "targetBinPrefix" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_put_away_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_put_away_tasks" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "taskNumber" TEXT NOT NULL,
    "grnId" UUID NOT NULL,
    "grnNumber" TEXT,
    "status" "ImdadPutAwayStatus" NOT NULL DEFAULT 'PENDING',
    "assignedTo" UUID,
    "assignedAt" TIMESTAMPTZ,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_put_away_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_quality_inspections" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "inspectionNumber" TEXT NOT NULL,
    "inspectionType" "ImdadInspectionType" NOT NULL,
    "status" "ImdadInspectionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "referenceType" TEXT NOT NULL,
    "referenceId" UUID NOT NULL,
    "referenceNumber" TEXT,
    "itemId" UUID,
    "itemCode" TEXT,
    "itemName" TEXT,
    "batchLotId" UUID,
    "batchNumber" TEXT,
    "sampleSize" INTEGER,
    "totalQuantity" DECIMAL(65,30),
    "scheduledDate" TIMESTAMPTZ,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "inspectorId" UUID,
    "inspectorName" TEXT,
    "reviewerId" UUID,
    "overallResult" TEXT,
    "defectsFound" INTEGER NOT NULL DEFAULT 0,
    "defectRate" DECIMAL(65,30),
    "dispositionAction" TEXT,
    "correctiveActionRequired" BOOLEAN NOT NULL DEFAULT false,
    "findings" TEXT,
    "findingsAr" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::text[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_quality_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_recall_actions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "recallId" UUID NOT NULL,
    "actionNumber" INTEGER NOT NULL,
    "locationId" UUID,
    "locationName" TEXT,
    "actionType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "quantityFound" DECIMAL(65,30),
    "quantityActioned" DECIMAL(65,30),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assignedTo" UUID,
    "completedAt" TIMESTAMPTZ,
    "completedBy" UUID,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,

    CONSTRAINT "imdad_recall_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_recalls" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "recallNumber" TEXT NOT NULL,
    "status" "ImdadRecallStatus" NOT NULL DEFAULT 'DRAFT',
    "severity" "ImdadRecallSeverity" NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "batchNumbers" TEXT[] DEFAULT ARRAY[]::text[],
    "vendorId" UUID,
    "vendorName" TEXT,
    "recallReason" TEXT NOT NULL,
    "recallReasonAr" TEXT,
    "sfdaReferenceNumber" TEXT,
    "manufacturerRecallRef" TEXT,
    "quantityAffected" DECIMAL(65,30),
    "quantityRecovered" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "quantityDestroyed" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "locationsAffected" INTEGER NOT NULL DEFAULT 0,
    "initiatedAt" TIMESTAMPTZ NOT NULL,
    "initiatedBy" UUID NOT NULL,
    "completedAt" TIMESTAMPTZ,
    "completedBy" UUID,
    "sfdaNotified" BOOLEAN NOT NULL DEFAULT false,
    "sfdaNotifiedAt" TIMESTAMPTZ,
    "publicNotice" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "metadata" JSONB,
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::text[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_recalls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_receiving_docks" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "dockCode" TEXT NOT NULL,
    "dockName" TEXT NOT NULL,
    "dockNameAr" TEXT,
    "status" "ImdadReceivingDockStatus" NOT NULL DEFAULT 'AVAILABLE',
    "dockType" TEXT NOT NULL DEFAULT 'STANDARD',
    "currentGrnId" UUID,
    "currentVendorName" TEXT,
    "occupiedSince" TIMESTAMPTZ,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_receiving_docks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_reorder_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "method" "ImdadReorderMethod" NOT NULL DEFAULT 'MIN_MAX',
    "minLevel" INTEGER NOT NULL DEFAULT 0,
    "maxLevel" INTEGER,
    "reorderPoint" INTEGER NOT NULL DEFAULT 0,
    "reorderQuantity" INTEGER,
    "safetyStock" INTEGER NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "isAutoReorder" BOOLEAN NOT NULL DEFAULT false,
    "preferredVendorId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_reorder_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_replenishment_rules" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "sourceLocationId" UUID NOT NULL,
    "destLocationId" UUID NOT NULL,
    "minLevel" DECIMAL(65,30) NOT NULL,
    "maxLevel" DECIMAL(65,30) NOT NULL,
    "replenishQty" DECIMAL(65,30) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_replenishment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_report_definitions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "reportCode" TEXT NOT NULL,
    "reportName" TEXT NOT NULL,
    "reportNameAr" TEXT,
    "reportCategory" TEXT NOT NULL,
    "description" TEXT,
    "descriptionAr" TEXT,
    "queryConfig" JSONB NOT NULL,
    "filterDefaults" JSONB,
    "columnConfig" JSONB,
    "supportedFormats" TEXT[] DEFAULT ARRAY['PDF'::text, 'EXCEL'::text, 'CSV'::text],
    "defaultFormat" TEXT NOT NULL DEFAULT 'PDF',
    "paperSize" TEXT NOT NULL DEFAULT 'A4',
    "orientation" TEXT NOT NULL DEFAULT 'LANDSCAPE',
    "isScheduled" BOOLEAN NOT NULL DEFAULT false,
    "scheduleExpression" TEXT,
    "scheduleRecipients" TEXT[] DEFAULT ARRAY[]::text[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_report_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_report_executions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "reportDefinitionId" UUID NOT NULL,
    "reportCode" TEXT NOT NULL,
    "reportName" TEXT NOT NULL,
    "executedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedBy" UUID NOT NULL,
    "executionTimeMs" INTEGER,
    "filterParams" JSONB,
    "periodStart" TIMESTAMPTZ,
    "periodEnd" TIMESTAMPTZ,
    "outputFormat" TEXT NOT NULL,
    "outputStorageKey" TEXT,
    "outputSizeBytes" INTEGER,
    "rowCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imdad_report_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_role_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "roleKey" TEXT NOT NULL,
    "roleType" "ImdadRoleType" NOT NULL,
    "description" TEXT,
    "descriptionAr" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::text[],
    "incompatibleRoles" TEXT[] DEFAULT ARRAY[]::text[],
    "maxConcurrentUsers" INTEGER,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_role_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_sequence_counters" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "sequenceType" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "fiscalYear" INTEGER,
    "padLength" INTEGER NOT NULL DEFAULT 6,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_sequence_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_sfda_integration_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "requestType" TEXT NOT NULL,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "httpStatusCode" INTEGER,
    "referenceType" TEXT,
    "referenceId" UUID,
    "isSuccess" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMPTZ,
    "requestedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imdad_sfda_integration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_stock_count_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "countId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "systemQty" INTEGER NOT NULL,
    "countedQty" INTEGER,
    "variance" INTEGER,
    "varianceValue" DECIMAL(65,30),
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMPTZ,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_stock_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_stock_counts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "countNumber" TEXT NOT NULL,
    "locationId" UUID NOT NULL,
    "countType" TEXT NOT NULL,
    "status" "ImdadStockCountStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledDate" TIMESTAMPTZ,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "matchedItems" INTEGER NOT NULL DEFAULT 0,
    "varianceItems" INTEGER NOT NULL DEFAULT 0,
    "totalVarianceValue" DECIMAL(65,30),
    "assignedTo" UUID,
    "countedBy" UUID,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,

    CONSTRAINT "imdad_stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_stock_reservations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_stock_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "transactionType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousStock" INTEGER NOT NULL,
    "newStock" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" UUID,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMPTZ,
    "unitCost" DECIMAL(65,30),
    "performedBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imdad_stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_supply_request_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "roleNameAr" TEXT,
    "status" "ImdadApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "slaHours" INTEGER NOT NULL DEFAULT 24,
    "pendingSince" TIMESTAMPTZ,
    "decidedAt" TIMESTAMPTZ,
    "decidedBy" TEXT,
    "comments" TEXT,
    "escalatedTo" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_supply_request_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_supply_request_audit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "requestCode" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "performedByRole" TEXT NOT NULL,
    "previousState" TEXT NOT NULL,
    "newState" TEXT NOT NULL,
    "stepRole" TEXT,
    "comments" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imdad_supply_request_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_supply_request_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "itemId" TEXT,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "estimatedCost" DECIMAL(65,30) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_supply_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_supply_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID,
    "code" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "requestType" "ImdadSupplyRequestType" NOT NULL DEFAULT 'SUPPLY_REQUEST',
    "hospitalId" TEXT NOT NULL,
    "hospitalName" TEXT NOT NULL,
    "hospitalNameAr" TEXT,
    "department" TEXT NOT NULL,
    "departmentAr" TEXT,
    "requestedBy" TEXT NOT NULL,
    "requestedByAr" TEXT,
    "requestedByUserId" UUID,
    "requestedByRole" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "priority" "ImdadSupplyRequestPriority" NOT NULL DEFAULT 'ROUTINE',
    "justification" TEXT,
    "justificationAr" TEXT,
    "totalEstimatedCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "ImdadSupplyRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "currentApprovalStep" INTEGER NOT NULL DEFAULT 0,
    "poCode" TEXT,
    "workOrderCode" TEXT,
    "expectedDelivery" TIMESTAMPTZ,
    "slaDeadlineAt" TIMESTAMPTZ NOT NULL,
    "slaBreached" BOOLEAN NOT NULL DEFAULT false,
    "deviceId" TEXT,
    "deviceName" TEXT,
    "maintenanceType" TEXT,
    "sourceHospitalId" TEXT,
    "targetHospitalId" TEXT,
    "budgetCategory" TEXT,
    "budgetPeriod" TEXT,
    "budgetAmount" DECIMAL(65,30),
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_supply_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_system_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID,
    "configKey" TEXT NOT NULL,
    "configValue" JSONB NOT NULL,
    "scope" "ImdadConfigScope" NOT NULL DEFAULT 'ORGANIZATION',
    "scopeId" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_system_pulses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "pulseTimestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeDecisions" INTEGER NOT NULL DEFAULT 0,
    "pendingActions" INTEGER NOT NULL DEFAULT 0,
    "criticalSignals" INTEGER NOT NULL DEFAULT 0,
    "highSignals" INTEGER NOT NULL DEFAULT 0,
    "totalAssets" INTEGER NOT NULL DEFAULT 0,
    "assetsAtRisk" INTEGER NOT NULL DEFAULT 0,
    "inventoryHealth" DECIMAL(65,30),
    "budgetHealth" DECIMAL(65,30),
    "complianceHealth" DECIMAL(65,30),
    "overallHealthScore" DECIMAL(65,30),
    "operationalPressure" DECIMAL(65,30),
    "supplyChainVelocity" DECIMAL(65,30),
    "riskIndex" DECIMAL(65,30),
    "aiInsights" JSONB,
    "trendDirection" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_system_pulses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_temperature_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "sensorId" TEXT,
    "temperature" DECIMAL(65,30) NOT NULL,
    "humidity" DECIMAL(65,30),
    "recordedAt" TIMESTAMPTZ NOT NULL,
    "isOutOfRange" BOOLEAN NOT NULL DEFAULT false,
    "alertSent" BOOLEAN NOT NULL DEFAULT false,
    "alertSentAt" TIMESTAMPTZ,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imdad_temperature_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_transfer_lines" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "transferId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "requestedQty" DECIMAL(65,30) NOT NULL,
    "shippedQty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "receivedQty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unitOfMeasure" TEXT NOT NULL,
    "batchLotId" UUID,
    "serialNumber" TEXT,
    "sourceBinId" UUID,
    "destBinId" UUID,
    "unitCost" DECIMAL(65,30),
    "totalCost" DECIMAL(65,30),
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,

    CONSTRAINT "imdad_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_transfer_requests" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "transferType" "ImdadTransferType" NOT NULL,
    "status" "ImdadTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceLocationId" UUID NOT NULL,
    "sourceLocationName" TEXT,
    "sourceDepartmentId" UUID,
    "destLocationId" UUID NOT NULL,
    "destLocationName" TEXT,
    "destDepartmentId" UUID,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "requiredByDate" TIMESTAMPTZ,
    "requestedBy" UUID NOT NULL,
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "shippedAt" TIMESTAMPTZ,
    "receivedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "rejectionReason" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_transfer_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_units_of_measure" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "type" "ImdadUoMType" NOT NULL,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_uom_conversions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "fromUomId" UUID NOT NULL,
    "toUomId" UUID NOT NULL,
    "factor" DECIMAL(65,30) NOT NULL,
    "itemId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_uom_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_user_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "departmentScope" TEXT,
    "validFrom" TIMESTAMPTZ,
    "validUntil" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "grantedBy" UUID,
    "grantedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_vendor_audits" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "auditNumber" TEXT NOT NULL,
    "vendorId" UUID NOT NULL,
    "vendorName" TEXT NOT NULL,
    "auditType" TEXT NOT NULL,
    "auditScope" TEXT,
    "auditScopeAr" TEXT,
    "plannedDate" TIMESTAMPTZ NOT NULL,
    "actualDate" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "leadAuditorId" UUID NOT NULL,
    "leadAuditorName" TEXT,
    "auditTeam" TEXT[] DEFAULT ARRAY[]::text[],
    "outcome" "ImdadAuditOutcome",
    "findingsCount" INTEGER NOT NULL DEFAULT 0,
    "criticalFindings" INTEGER NOT NULL DEFAULT 0,
    "majorFindings" INTEGER NOT NULL DEFAULT 0,
    "minorFindings" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "summaryAr" TEXT,
    "recommendations" TEXT,
    "recommendationsAr" TEXT,
    "nextAuditDue" TIMESTAMPTZ,
    "capaRequired" BOOLEAN NOT NULL DEFAULT false,
    "capaDeadline" TIMESTAMPTZ,
    "notes" TEXT,
    "metadata" JSONB,
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::text[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_vendor_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_vendor_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID,
    "vendorId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_vendor_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_vendor_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID,
    "vendorId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentNumber" TEXT,
    "issuedAt" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" UUID,
    "verifiedAt" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_vendor_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_vendor_scorecards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID,
    "vendorId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "deliveryScore" DECIMAL(65,30),
    "qualityScore" DECIMAL(65,30),
    "pricingScore" DECIMAL(65,30),
    "responsivenessScore" DECIMAL(65,30),
    "complianceScore" DECIMAL(65,30),
    "overallScore" DECIMAL(65,30),
    "recommendedTier" "ImdadVendorTier",
    "notes" TEXT,
    "assessedBy" UUID,
    "assessedAt" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imdad_vendor_scorecards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_vendors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "organizationId" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "type" TEXT NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "address" TEXT,
    "crNumber" TEXT,
    "vatNumber" TEXT,
    "taxId" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "website" TEXT,
    "paymentTerms" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "bankName" TEXT,
    "bankAccount" TEXT,
    "iban" TEXT,
    "rating" DECIMAL(65,30),
    "tier" "ImdadVendorTier",
    "status" "ImdadVendorStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "sfdaLicense" TEXT,
    "sfdaLicenseExpiry" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_ward_par_levels" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "departmentName" TEXT,
    "locationId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "parLevel" DECIMAL(65,30) NOT NULL,
    "maxLevel" DECIMAL(65,30) NOT NULL,
    "reorderQty" DECIMAL(65,30) NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "avgDailyUsage" DECIMAL(65,30),
    "lastCalculatedAt" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_ward_par_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_warehouse_zones" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "zoneCode" TEXT NOT NULL,
    "zoneName" TEXT NOT NULL,
    "zoneNameAr" TEXT,
    "zoneType" "ImdadWarehouseZoneType" NOT NULL,
    "temperatureZone" "ImdadTemperatureZone",
    "minTemperature" DECIMAL(65,30),
    "maxTemperature" DECIMAL(65,30),
    "humidityMin" DECIMAL(65,30),
    "humidityMax" DECIMAL(65,30),
    "totalBins" INTEGER NOT NULL DEFAULT 0,
    "usedBins" INTEGER NOT NULL DEFAULT 0,
    "maxWeight" DECIMAL(65,30),
    "requiresBadgeAccess" BOOLEAN NOT NULL DEFAULT false,
    "requiredClearanceLevel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_warehouse_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_warehouses" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "warehouseCode" TEXT NOT NULL,
    "warehouseName" TEXT NOT NULL,
    "warehouseNameAr" TEXT,
    "facilityType" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT NOT NULL DEFAULT 'SA',
    "totalAreaSqm" DECIMAL(65,30),
    "totalBins" INTEGER NOT NULL DEFAULT 0,
    "usedBins" INTEGER NOT NULL DEFAULT 0,
    "operatingHoursStart" TEXT,
    "operatingHoursEnd" TEXT,
    "operatingDays" TEXT[] DEFAULT ARRAY['SUN'::text, 'MON'::text, 'TUE'::text, 'WED'::text, 'THU'::text],
    "hasTemperatureMonitoring" BOOLEAN NOT NULL DEFAULT false,
    "temperatureZones" TEXT[],
    "managerUserId" UUID,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "imdad_warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_webhook_deliveries" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "webhookId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "httpStatusCode" INTEGER,
    "responseBody" TEXT,
    "responseTimeMs" INTEGER,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "isSuccess" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imdad_webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imdad_webhooks" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "organizationId" UUID,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "eventTypes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "headers" JSONB,
    "retryPolicy" JSONB,
    "lastTriggeredAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imdad_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "department" TEXT,
    "protocol" TEXT,
    "connectionType" TEXT,
    "host" TEXT,
    "port" INTEGER,
    "aeTitle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "lastHeartbeat" TIMESTAMPTZ,
    "config" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "instruments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "protocol" TEXT,
    "messageType" TEXT,
    "instrumentId" UUID,
    "rawMessage" TEXT,
    "parsedData" JSONB,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMPTZ,
    "receivedAt" TIMESTAMPTZ,
    "processedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "engineType" TEXT,
    "mirthUrl" TEXT,
    "mirthApiPort" INTEGER,
    "hl7ListenerPort" INTEGER,
    "httpListenerPort" INTEGER,
    "theaCallbackUrl" TEXT,
    "autoRouteResults" BOOLEAN NOT NULL DEFAULT false,
    "retryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "channels" JSONB,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "integration_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_adt_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "messageId" TEXT,
    "eventType" TEXT,
    "patientId" TEXT,
    "patientName" TEXT,
    "dateOfBirth" TEXT,
    "sex" TEXT,
    "patientClass" TEXT,
    "assignedLocation" TEXT,
    "attendingDoctor" TEXT,
    "admitDateTime" TIMESTAMPTZ,
    "dischargeDateTime" TIMESTAMPTZ,
    "visitNumber" TEXT,
    "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_adt_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fhir_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "reason" TEXT,
    "criteria" TEXT,
    "channelType" TEXT,
    "channelEndpoint" TEXT,
    "channelPayload" TEXT,
    "channelHeaders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "end" TIMESTAMPTZ,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fhir_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fhir_subscription_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "action" TEXT,
    "status" TEXT,
    "httpStatus" INTEGER,
    "endpoint" TEXT,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fhir_subscription_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dicom_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "wadoUrl" TEXT,
    "qidoUrl" TEXT,
    "stowUrl" TEXT,
    "aeTitle" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "dicom_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipd_episodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "encounterType" TEXT,
    "patient" JSONB,
    "serviceUnit" TEXT,
    "admittingDoctorUserId" TEXT,
    "bedClass" TEXT,
    "admissionNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "source" JSONB,
    "location" JSONB,
    "ownership" JSONB,
    "reasonForAdmission" TEXT,
    "doctorSummary" TEXT,
    "nursingSummary" TEXT,
    "pendingTasks" JSONB,
    "pendingResults" JSONB,
    "riskFlags" JSONB,
    "closedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,

    CONSTRAINT "ipd_episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipd_admissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID,
    "encounterId" UUID,
    "patientMasterId" UUID,
    "bedId" UUID,
    "patientId" TEXT,
    "patientName" TEXT,
    "admissionDate" DATE,
    "admissionTime" TEXT,
    "doctorName" TEXT,
    "diagnosis" TEXT,
    "dischargeDate" DATE,
    "assignedAt" TIMESTAMPTZ,
    "assignedByUserId" TEXT,
    "releasedAt" TIMESTAMPTZ,
    "releasedByUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipd_admissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipd_beds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "bedLabel" TEXT,
    "label" TEXT,
    "ward" TEXT,
    "room" TEXT,
    "unit" TEXT,
    "departmentId" TEXT,
    "departmentName" TEXT,
    "roomLabel" TEXT,
    "roomId" TEXT,
    "unitLabel" TEXT,
    "unitId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipd_beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipd_vitals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "recordedAt" TIMESTAMPTZ,
    "recordedByUserId" TEXT,
    "vitals" JSONB,
    "painScore" INTEGER,
    "avpu" TEXT,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "criticalReasons" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipd_vitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipd_downtime_incidents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ,
    "endedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "ipd_downtime_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipd_icu_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "encounterCoreId" UUID,
    "type" TEXT NOT NULL,
    "destination" TEXT,
    "source" TEXT,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ipd_icu_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipd_care_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "problem" TEXT,
    "goals" TEXT,
    "interventions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ipd_care_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipd_med_order_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ipd_med_order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipd_mar_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "scheduledFor" TIMESTAMPTZ,
    "performedAt" TIMESTAMPTZ,
    "status" TEXT,
    "dose" TEXT,
    "route" TEXT,
    "note" TEXT,
    "performedByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ipd_mar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipd_nursing_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "assessment" JSONB,
    "createdByUserId" TEXT,
    "mewsScore" INTEGER,
    "mewsLevel" TEXT,
    "fallRiskScore" INTEGER,
    "fallRiskLevel" TEXT,
    "gcsScore" INTEGER,
    "bradenScore" INTEGER,
    "bradenRisk" TEXT,
    "consciousness" TEXT,
    "painData" JSONB,
    "bradenData" JSONB,
    "ioData" JSONB,
    "sbarData" JSONB,
    "familyCommData" JSONB,
    "proceduresData" JSONB,
    "carePlanData" JSONB,
    "handoverData" JSONB,
    "nursingTasksData" JSONB,
    "marData" JSONB,
    "icuMonitoring" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ipd_nursing_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipd_nursing_daily_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "date" TEXT,
    "responseToCarePlan" TEXT,
    "vitalsSummary" TEXT,
    "issues" TEXT,
    "escalations" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ipd_nursing_daily_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipd_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "encounterId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ipd_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventilator_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ NOT NULL,
    "endedAt" TIMESTAMPTZ,
    "mode" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "recordings" JSONB NOT NULL DEFAULT '[]',
    "weaningPlan" TEXT,
    "extubationTime" TIMESTAMPTZ,
    "extubationNote" TEXT,
    "recordedBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ventilator_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fluid_balance_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "shift" TEXT NOT NULL,
    "shiftDate" DATE NOT NULL,
    "enteredBy" UUID NOT NULL,
    "intakes" JSONB NOT NULL DEFAULT '[]',
    "outputs" JSONB NOT NULL DEFAULT '[]',
    "totalIntake" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalOutput" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fluid_balance_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipd_admission_intake" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "handoffId" UUID NOT NULL,
    "episodeId" UUID,
    "encounterId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ipd_admission_intake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icu_care_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "shift" TEXT NOT NULL DEFAULT 'MORNING',
    "nurseId" TEXT NOT NULL,
    "dailyGoals" JSONB NOT NULL,
    "careBundle" JSONB,
    "sedationLevel" TEXT,
    "painScore" INTEGER,
    "deliriumScreen" TEXT,
    "mobilityGoal" TEXT,
    "nutritionStatus" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "icu_care_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sofa_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "scoredAt" TIMESTAMPTZ NOT NULL,
    "scoredBy" TEXT NOT NULL,
    "respiratory" INTEGER NOT NULL,
    "coagulation" INTEGER NOT NULL,
    "liver" INTEGER NOT NULL,
    "cardiovascular" INTEGER NOT NULL,
    "cns" INTEGER NOT NULL,
    "renal" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sofa_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icu_ventilator_checks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "checkedAt" TIMESTAMPTZ NOT NULL,
    "checkedBy" TEXT NOT NULL,
    "mode" TEXT,
    "fio2" DOUBLE PRECISION,
    "tidalVolume" INTEGER,
    "respiratoryRate" INTEGER,
    "peep" DOUBLE PRECISION,
    "pip" DOUBLE PRECISION,
    "pplat" DOUBLE PRECISION,
    "compliance" DOUBLE PRECISION,
    "minuteVolume" DOUBLE PRECISION,
    "spo2" DOUBLE PRECISION,
    "etco2" DOUBLE PRECISION,
    "alarms" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "icu_ventilator_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icu_apache_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "scoredAt" TIMESTAMPTZ NOT NULL,
    "scoredByUserId" UUID NOT NULL,
    "scoredByName" TEXT,
    "version" TEXT NOT NULL DEFAULT 'II',
    "temperature" DOUBLE PRECISION,
    "meanArterialPressure" DOUBLE PRECISION,
    "heartRate" INTEGER,
    "respiratoryRate" INTEGER,
    "oxygenation" DOUBLE PRECISION,
    "fio2" DOUBLE PRECISION,
    "arterialPh" DOUBLE PRECISION,
    "serumSodium" DOUBLE PRECISION,
    "serumPotassium" DOUBLE PRECISION,
    "serumCreatinine" DOUBLE PRECISION,
    "hematocrit" DOUBLE PRECISION,
    "whiteBloodCount" DOUBLE PRECISION,
    "glasgowComaScale" INTEGER,
    "temperatureScore" INTEGER,
    "mapScore" INTEGER,
    "hrScore" INTEGER,
    "rrScore" INTEGER,
    "oxygenScore" INTEGER,
    "phScore" INTEGER,
    "sodiumScore" INTEGER,
    "potassiumScore" INTEGER,
    "creatinineScore" INTEGER,
    "hctScore" INTEGER,
    "wbcScore" INTEGER,
    "gcsScore" INTEGER,
    "agePoints" INTEGER,
    "chronicHealthPoints" INTEGER,
    "isEmergencySurgery" BOOLEAN NOT NULL DEFAULT false,
    "chronicConditions" JSONB,
    "acutePhysiologyScore" INTEGER,
    "totalScore" INTEGER,
    "predictedMortality" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "icu_apache_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icu_sedation_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "assessedAt" TIMESTAMPTZ NOT NULL,
    "assessedByUserId" UUID NOT NULL,
    "assessedByName" TEXT,
    "scaleType" TEXT NOT NULL DEFAULT 'RASS',
    "rassScore" INTEGER,
    "rassLabel" TEXT,
    "sasScore" INTEGER,
    "sasLabel" TEXT,
    "targetRass" INTEGER,
    "targetSas" INTEGER,
    "isOnTarget" BOOLEAN,
    "sedationDrugs" JSONB,
    "painScore" INTEGER,
    "painTool" TEXT,
    "bpsScore" INTEGER,
    "cpotScore" INTEGER,
    "interventions" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "icu_sedation_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icu_delirium_screens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "screenedAt" TIMESTAMPTZ NOT NULL,
    "screenedByUserId" UUID NOT NULL,
    "screenedByName" TEXT,
    "toolUsed" TEXT NOT NULL DEFAULT 'CAM_ICU',
    "feature1AcuteOnset" BOOLEAN,
    "feature2Inattention" BOOLEAN,
    "aseLetterScore" INTEGER,
    "asePictureScore" INTEGER,
    "feature3AlteredLOC" BOOLEAN,
    "currentRass" INTEGER,
    "feature4Disorganized" BOOLEAN,
    "questionErrors" INTEGER,
    "commandFollowed" BOOLEAN,
    "camIcuPositive" BOOLEAN,
    "deliriumType" TEXT,
    "icdscScore" INTEGER,
    "icdscItems" JSONB,
    "riskFactors" JSONB,
    "nonPharmInterventions" JSONB,
    "pharmInterventions" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "icu_delirium_screens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icu_bundle_compliance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "auditDate" DATE NOT NULL,
    "auditedByUserId" UUID NOT NULL,
    "auditedByName" TEXT,
    "bundleType" TEXT NOT NULL,
    "vapHobElevated" BOOLEAN,
    "vapDailyWean" BOOLEAN,
    "vapOralCare" BOOLEAN,
    "vapDvtProphylaxis" BOOLEAN,
    "vapPepticProphylaxis" BOOLEAN,
    "vapSubglotticSuction" BOOLEAN,
    "vapCircuitNotChanged" BOOLEAN,
    "clabsiHandHygiene" BOOLEAN,
    "clabsiMaxBarrier" BOOLEAN,
    "clabsiChlorhexidine" BOOLEAN,
    "clabsiOptimalSite" BOOLEAN,
    "clabsiDailyReview" BOOLEAN,
    "clabsiDressingIntact" BOOLEAN,
    "clabsiLineDate" DATE,
    "clabsiLineDays" INTEGER,
    "cautiIndication" BOOLEAN,
    "cautiAsepticInsert" BOOLEAN,
    "cautiSecured" BOOLEAN,
    "cautiBagBelow" BOOLEAN,
    "cautiDailyReview" BOOLEAN,
    "cautiRemovalDate" DATE,
    "cautiCathDays" INTEGER,
    "totalElements" INTEGER,
    "compliantElements" INTEGER,
    "compliancePercent" DOUBLE PRECISION,
    "deviationNotes" TEXT,
    "actionPlan" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "icu_bundle_compliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icu_code_blues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID,
    "patientMasterId" UUID,
    "location" TEXT,
    "codeCalledAt" TIMESTAMPTZ NOT NULL,
    "codeCalledBy" TEXT,
    "teamArrivedAt" TIMESTAMPTZ,
    "initialRhythm" TEXT,
    "events" JSONB NOT NULL DEFAULT '[]',
    "cprStartedAt" TIMESTAMPTZ,
    "cprEndedAt" TIMESTAMPTZ,
    "totalCprMin" INTEGER,
    "shocks" JSONB,
    "medications" JSONB,
    "airwayManagement" TEXT,
    "intubatedAt" TIMESTAMPTZ,
    "intubatedBy" TEXT,
    "ivAccess" JSONB,
    "ioAccess" BOOLEAN DEFAULT false,
    "ioSite" TEXT,
    "teamLeader" TEXT,
    "cprProvider1" TEXT,
    "cprProvider2" TEXT,
    "airwayManager" TEXT,
    "medicationNurse" TEXT,
    "recorder" TEXT,
    "outcome" TEXT,
    "roscAt" TIMESTAMPTZ,
    "timeOfDeath" TIMESTAMPTZ,
    "postRoscPlan" TEXT,
    "familyNotified" BOOLEAN NOT NULL DEFAULT false,
    "familyNotifiedAt" TIMESTAMPTZ,
    "familyNotifiedBy" TEXT,
    "debriefCompleted" BOOLEAN NOT NULL DEFAULT false,
    "debriefNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "icu_code_blues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brain_death_protocols" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "episodeId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREREQUISITES',
    "prerequisites" JSONB,
    "exam1" JSONB,
    "waitingPeriodHours" INTEGER DEFAULT 6,
    "exam2" JSONB,
    "confirmatoryTest" JSONB,
    "declaredAt" TIMESTAMPTZ,
    "declaredByUserId" UUID,
    "scotNotified" BOOLEAN NOT NULL DEFAULT false,
    "scotNotifiedAt" TIMESTAMPTZ,
    "abortedReason" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "brain_death_protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organ_donations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "brainDeathProtocolId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDENTIFIED',
    "scotReferralAt" TIMESTAMPTZ,
    "scotReferenceNumber" TEXT,
    "familyApproach" JSONB,
    "donorManagement" JSONB,
    "organAllocation" JSONB,
    "procurementOrCaseId" UUID,
    "procurementScheduledAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organ_donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID,
    "patientName" TEXT,
    "mrn" TEXT,
    "encounterId" UUID,
    "testCode" TEXT,
    "testName" TEXT,
    "testNameAr" TEXT,
    "category" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'ROUTINE',
    "clinicalNotes" TEXT,
    "orderingDoctorId" TEXT,
    "orderingDoctorName" TEXT,
    "fasting" BOOLEAN NOT NULL DEFAULT false,
    "specimenType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "orderedAt" TIMESTAMPTZ,
    "orderedBy" TEXT,
    "orderedByName" TEXT,
    "specimenId" TEXT,
    "collectedAt" TIMESTAMPTZ,
    "collectedBy" TEXT,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lab_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_specimens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "specimenId" TEXT,
    "orderId" UUID,
    "patientId" UUID,
    "encounterId" UUID,
    "testCode" TEXT,
    "tubeType" TEXT,
    "collectedAt" TIMESTAMPTZ,
    "collectedBy" TEXT,
    "collectorName" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_specimens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_critical_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "orderId" UUID,
    "testCode" TEXT,
    "testName" TEXT,
    "patientId" UUID,
    "patientName" TEXT,
    "mrn" TEXT,
    "encounterId" UUID,
    "value" TEXT,
    "unit" TEXT,
    "criticalType" TEXT,
    "threshold" TEXT,
    "source" TEXT,
    "acknowledgedAt" TIMESTAMPTZ,
    "acknowledgedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_critical_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_qc_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "analyteCode" TEXT NOT NULL,
    "analyteName" JSONB,
    "lotNumber" TEXT,
    "level" TEXT,
    "value" DECIMAL(12,4),
    "mean" DECIMAL(12,4),
    "sd" DECIMAL(12,4),
    "zScore" DECIMAL(12,4),
    "performedAt" TIMESTAMPTZ,
    "performedBy" TEXT,
    "violations" JSONB,
    "status" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_qc_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results_incoming" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "testCode" TEXT,
    "testName" TEXT,
    "value" TEXT,
    "unit" TEXT,
    "abnormalFlag" TEXT,
    "referenceRange" TEXT,
    "orderId" UUID,
    "hl7MessageId" TEXT,
    "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_results_incoming_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_micro_cultures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "orderId" UUID,
    "specimenId" UUID,
    "patientId" UUID,
    "patientName" TEXT,
    "mrn" TEXT,
    "encounterId" UUID,
    "specimenType" TEXT,
    "specimenSource" TEXT,
    "collectedAt" TIMESTAMPTZ,
    "receivedAt" TIMESTAMPTZ,
    "mediaUsed" JSONB,
    "gramStain" TEXT,
    "gramStainResult" TEXT,
    "growthStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "organisms" JSONB,
    "sensitivities" JSONB,
    "esblDetected" BOOLEAN,
    "mrsaDetected" BOOLEAN,
    "vreDetected" BOOLEAN,
    "cprDetected" BOOLEAN,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "preliminaryAt" TIMESTAMPTZ,
    "finalizedAt" TIMESTAMPTZ,
    "finalizedBy" TEXT,
    "interpretation" TEXT,
    "clinicalSignificance" TEXT,
    "infectionControlAlert" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lab_micro_cultures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_tat_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "testCode" TEXT,
    "testName" TEXT,
    "category" TEXT,
    "priority" TEXT,
    "orderedAt" TIMESTAMPTZ,
    "collectedAt" TIMESTAMPTZ,
    "receivedAt" TIMESTAMPTZ,
    "processingStartAt" TIMESTAMPTZ,
    "resultAt" TIMESTAMPTZ,
    "verifiedAt" TIMESTAMPTZ,
    "orderToCollect" INTEGER,
    "collectToReceive" INTEGER,
    "receiveToResult" INTEGER,
    "resultToVerify" INTEGER,
    "totalTat" INTEGER,
    "targetTatMin" INTEGER,
    "withinTarget" BOOLEAN,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_tat_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_result_amendments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "resultId" UUID NOT NULL,
    "orderId" UUID,
    "amendmentNumber" INTEGER NOT NULL DEFAULT 1,
    "originalValues" JSONB NOT NULL,
    "amendedValues" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "amendedByUserId" UUID NOT NULL,
    "amendedByName" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_result_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_auto_validation_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "testCode" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdBy" UUID,
    "updatedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lab_auto_validation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "type" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "parentId" UUID,
    "level" INTEGER,
    "path" TEXT,
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "org_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floor_departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "floorId" TEXT,
    "departmentId" TEXT,
    "departmentName" TEXT,
    "departmentCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "floor_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID NOT NULL,
    "patientId" UUID,
    "departmentKey" TEXT NOT NULL,
    "enteredAt" TIMESTAMPTZ,
    "exitedAt" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'IN',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nursing_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "nurseId" TEXT,
    "nurseName" TEXT,
    "employeeId" TEXT,
    "position" TEXT,
    "isTeamLeader" BOOLEAN NOT NULL DEFAULT false,
    "isChargeNurse" BOOLEAN NOT NULL DEFAULT false,
    "weekStartDate" DATE,
    "weekEndDate" DATE,
    "assignments" JSONB,
    "totalWeeklyHours" INTEGER,
    "targetWeeklyHours" INTEGER,
    "overtimeHours" INTEGER,
    "undertimeHours" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "nursing_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nursing_shift_metrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "department" TEXT,
    "shift" TEXT,
    "date" DATE NOT NULL,
    "nursesOnDuty" INTEGER NOT NULL DEFAULT 0,
    "patientCount" INTEGER NOT NULL DEFAULT 0,
    "completedTasks" INTEGER NOT NULL DEFAULT 0,
    "pendingTasks" INTEGER NOT NULL DEFAULT 0,
    "criticalAlerts" INTEGER NOT NULL DEFAULT 0,
    "avgResponseMin" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nursing_shift_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT,
    "members" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_lookups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" TEXT,
    "clientRequestId" TEXT,
    "identityType" TEXT,
    "identityLast4" TEXT,
    "identityValueHash" TEXT,
    "identityValueEncrypted" TEXT,
    "dob" TEXT,
    "contextArea" TEXT,
    "status" TEXT,
    "matchLevel" TEXT,
    "payload" JSONB,
    "provider" TEXT,
    "providerTraceId" TEXT,
    "dedupeKey" TEXT,
    "patientMasterId" UUID,
    "reasonCode" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_lookups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_rate_limits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 10,
    "lastRefill" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_apply_idempotency" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "response" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_apply_idempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "absher_verification_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "idNumber" TEXT,
    "idType" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "absher_verification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nafis_visit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "request" JSONB,
    "response" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "nafis_visit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nafis_statistics_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "request" JSONB,
    "response" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "nafis_statistics_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nafis_disease_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "request" JSONB,
    "response" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "nafis_disease_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dental_charts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "conditions" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "dental_charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dental_treatments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "toothNumber" TEXT,
    "surface" TEXT,
    "procedureCode" TEXT,
    "procedureName" TEXT,
    "procedureNameAr" TEXT,
    "fee" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "priority" TEXT,
    "notes" TEXT,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "dental_treatments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obgyn_forms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "type" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "obgyn_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_cancellations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "bookingId" UUID,
    "steps" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_cancellations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_experience" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID,
    "type" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "px_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "visitId" UUID,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "severity" TEXT,
    "assignedDeptKey" TEXT,
    "dueAt" TIMESTAMPTZ,
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMPTZ,
    "resolutionMinutes" INTEGER,
    "detailsEn" TEXT,
    "detailsAr" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "px_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_checks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clientName" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dental_procedures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "treatmentId" UUID,
    "toothNumber" TEXT NOT NULL,
    "surface" TEXT,
    "procedureCode" TEXT,
    "procedureName" TEXT,
    "procedureNameAr" TEXT,
    "icdCode" TEXT,
    "anesthesiaType" TEXT,
    "duration" INTEGER,
    "materials" JSONB,
    "complications" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "performedBy" TEXT NOT NULL,
    "performedAt" TIMESTAMPTZ NOT NULL,
    "nextVisitDate" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dental_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodontal_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "recordDate" TIMESTAMPTZ NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "pocketDepths" JSONB NOT NULL,
    "bleedingOnProbe" JSONB,
    "furcation" JSONB,
    "mobility" JSONB,
    "plaqScore" DOUBLE PRECISION,
    "gingiScore" DOUBLE PRECISION,
    "diagnosis" TEXT,
    "treatmentPlan" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodontal_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newborn_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "motherPatientId" UUID NOT NULL,
    "laborRecordId" UUID,
    "dateOfBirth" TIMESTAMPTZ NOT NULL,
    "timeOfBirth" TIMESTAMPTZ,
    "gestationalAge" INTEGER,
    "gestationalAgeDays" INTEGER,
    "birthWeight" DECIMAL(8,2),
    "birthLength" DECIMAL(8,2),
    "headCircumference" DECIMAL(8,2),
    "gender" TEXT,
    "deliveryType" TEXT,
    "presentation" TEXT,
    "apgar1Min" INTEGER,
    "apgar5Min" INTEGER,
    "apgar10Min" INTEGER,
    "resuscitationNeeded" BOOLEAN NOT NULL DEFAULT false,
    "resuscitationSteps" JSONB,
    "heartRate" INTEGER,
    "respiratoryRate" INTEGER,
    "temperature" DECIMAL(4,1),
    "oxygenSaturation" INTEGER,
    "skinColor" TEXT,
    "cry" TEXT,
    "tone" TEXT,
    "reflexes" TEXT,
    "anomalies" JSONB,
    "cordBloodGas" JSONB,
    "cordClamped" BOOLEAN NOT NULL DEFAULT false,
    "cordClampTime" TIMESTAMPTZ,
    "cordBloodBanked" BOOLEAN NOT NULL DEFAULT false,
    "vitaminKGiven" BOOLEAN NOT NULL DEFAULT false,
    "eyeProphylaxis" BOOLEAN NOT NULL DEFAULT false,
    "firstFeedTime" TIMESTAMPTZ,
    "feedingType" TEXT,
    "skinToSkin" BOOLEAN NOT NULL DEFAULT false,
    "skinToSkinTime" TIMESTAMPTZ,
    "bandApplied" BOOLEAN NOT NULL DEFAULT false,
    "footprintsTaken" BOOLEAN NOT NULL DEFAULT false,
    "nicuAdmission" BOOLEAN NOT NULL DEFAULT false,
    "nicuAdmissionReason" TEXT,
    "nicuAdmittedAt" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dischargedAt" TIMESTAMPTZ,
    "attendingPhysician" TEXT,
    "attendingPhysicianId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "newborn_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodontal_charts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "chartDate" TIMESTAMPTZ NOT NULL,
    "teeth" JSONB NOT NULL,
    "bopPercentage" DOUBLE PRECISION,
    "summary" TEXT,
    "examinedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "periodontal_charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orthodontic_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "applianceType" TEXT NOT NULL,
    "treatmentStartDate" TIMESTAMPTZ,
    "estimatedDuration" INTEGER,
    "treatmentPlan" JSONB,
    "cephalometricData" JSONB,
    "retentionPlan" JSONB,
    "notes" TEXT,
    "doctorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "orthodontic_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orthodontic_visits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "visitDate" TIMESTAMPTZ NOT NULL,
    "visitType" TEXT NOT NULL,
    "wireDetails" JSONB,
    "bracketsReplaced" JSONB,
    "elastics" JSONB,
    "progressPhotos" JSONB,
    "notes" TEXT,
    "nextVisitDate" TIMESTAMPTZ,
    "doctorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "orthodontic_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oncology_patients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "icdCode" TEXT,
    "stage" TEXT,
    "histology" TEXT,
    "primarySite" TEXT,
    "diagnosisDate" TIMESTAMPTZ,
    "ecogStatus" INTEGER,
    "oncologistId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "oncology_patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oncology_protocols" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "protocolName" TEXT NOT NULL,
    "intent" TEXT NOT NULL DEFAULT 'CURATIVE',
    "startDate" TIMESTAMPTZ,
    "endDate" TIMESTAMPTZ,
    "totalCycles" INTEGER,
    "completedCycles" INTEGER NOT NULL DEFAULT 0,
    "regimen" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "suspendReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "oncology_protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chemo_cycles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "protocolName" TEXT NOT NULL,
    "scheduledDate" TIMESTAMPTZ NOT NULL,
    "administeredDate" TIMESTAMPTZ,
    "administeredBy" TEXT,
    "premedications" JSONB,
    "drugs" JSONB NOT NULL,
    "vitals" JSONB,
    "toxicity" JSONB,
    "labsPreCycle" JSONB,
    "bsa" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "delayReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "chemo_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tumor_board_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "caseDate" TIMESTAMPTZ NOT NULL,
    "presentedBy" TEXT NOT NULL,
    "attendees" JSONB,
    "clinicalSummary" TEXT NOT NULL,
    "imagingFindings" TEXT,
    "pathologyFindings" TEXT,
    "currentTreatment" TEXT,
    "discussion" TEXT,
    "recommendation" TEXT NOT NULL,
    "followUpDate" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tumor_board_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chemo_protocol_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "cancerType" TEXT NOT NULL,
    "intent" TEXT NOT NULL DEFAULT 'CURATIVE',
    "emetogenicRisk" TEXT,
    "totalCyclesDefault" INTEGER,
    "cycleLengthDays" INTEGER,
    "drugs" JSONB NOT NULL,
    "premedications" JSONB,
    "hydration" JSONB,
    "doseModifications" JSONB,
    "supportiveCare" JSONB,
    "references" JSONB,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "chemo_protocol_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctcae_toxicity_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "cycleId" UUID,
    "assessmentDate" TIMESTAMPTZ NOT NULL,
    "assessedBy" TEXT NOT NULL,
    "ctcaeVersion" TEXT NOT NULL DEFAULT '5.0',
    "toxicities" JSONB NOT NULL,
    "overallWorstGrade" INTEGER,
    "doseModRequired" BOOLEAN NOT NULL DEFAULT false,
    "treatmentHeld" BOOLEAN NOT NULL DEFAULT false,
    "treatmentDiscontinued" BOOLEAN NOT NULL DEFAULT false,
    "nextAssessmentDate" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ctcae_toxicity_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tnm_stagings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "cancerType" TEXT NOT NULL,
    "stagingSystem" TEXT NOT NULL DEFAULT 'AJCC_8TH',
    "stagingType" TEXT NOT NULL DEFAULT 'CLINICAL',
    "tCategory" TEXT NOT NULL,
    "nCategory" TEXT NOT NULL,
    "mCategory" TEXT NOT NULL,
    "stageGroup" TEXT,
    "gradeGroup" TEXT,
    "biomarkers" JSONB,
    "stagingDate" TIMESTAMPTZ NOT NULL,
    "stagedBy" TEXT NOT NULL,
    "method" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tnm_stagings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radiation_therapy_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "planName" TEXT NOT NULL,
    "technique" TEXT NOT NULL,
    "intent" TEXT NOT NULL DEFAULT 'CURATIVE',
    "targetSite" TEXT NOT NULL,
    "targetVolumes" JSONB,
    "totalDoseGy" DOUBLE PRECISION NOT NULL,
    "dosePerFraction" DOUBLE PRECISION NOT NULL,
    "totalFractions" INTEGER NOT NULL,
    "completedFractions" INTEGER NOT NULL DEFAULT 0,
    "frequency" TEXT NOT NULL DEFAULT 'DAILY_5',
    "machine" TEXT,
    "energy" TEXT,
    "startDate" TIMESTAMPTZ,
    "endDate" TIMESTAMPTZ,
    "concurrentChemo" TEXT,
    "oarConstraints" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "suspendReason" TEXT,
    "physicist" TEXT,
    "oncologistId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "radiation_therapy_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radiation_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "fractionNumber" INTEGER NOT NULL,
    "sessionDate" TIMESTAMPTZ NOT NULL,
    "deliveredDoseGy" DOUBLE PRECISION,
    "machine" TEXT,
    "technician" TEXT,
    "setupVerification" TEXT,
    "skinReaction" TEXT,
    "patientTolerance" TEXT,
    "isocenterShift" JSONB,
    "treatmentTime" INTEGER,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radiation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opd_encounters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "status" "OpdStatus" NOT NULL DEFAULT 'OPEN',
    "arrivalState" "OpdArrivalState" NOT NULL DEFAULT 'NOT_ARRIVED',
    "arrivalSource" "OpdArrivalSource",
    "visitType" "OpdVisitType",
    "opdFlowState" "OpdFlowState",
    "priority" "OpdPriority",
    "arrivedAt" TIMESTAMPTZ,
    "nursingStartAt" TIMESTAMPTZ,
    "nursingEndAt" TIMESTAMPTZ,
    "doctorStartAt" TIMESTAMPTZ,
    "doctorEndAt" TIMESTAMPTZ,
    "procedureStartAt" TIMESTAMPTZ,
    "procedureEndAt" TIMESTAMPTZ,
    "paymentStatus" "OpdPaymentStatus",
    "paymentServiceType" "OpdPaymentServiceType",
    "paymentPaidAt" TIMESTAMPTZ,
    "paymentAmount" DECIMAL(12,2),
    "paymentMethod" "OpdPaymentMethod",
    "paymentInvoiceId" TEXT,
    "paymentReference" TEXT,
    "dispositionType" "OpdDispositionType",
    "dispositionNote" TEXT,
    "billingMeta" JSONB,
    "clinicExtensions" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "criticalVitalsFlag" JSONB,
    "returnToNursingLog" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "opd_encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opd_nursing_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "opdEncounterId" UUID NOT NULL,
    "createdByUserId" TEXT,
    "nursingNote" TEXT,
    "chiefComplaintShort" TEXT,
    "painScore" INTEGER,
    "painLocation" TEXT,
    "fallRiskScore" INTEGER,
    "fallRiskLabel" "OpdFallRiskLabel",
    "fallRiskData" JSONB,
    "consciousness" TEXT,
    "onSupplementalO2" BOOLEAN NOT NULL DEFAULT false,
    "mewsScore" INTEGER,
    "mewsRiskLevel" TEXT,
    "mewsData" JSONB,
    "gcsScore" INTEGER,
    "gcsCategory" TEXT,
    "gcsData" JSONB,
    "sbarData" JSONB,
    "painData" JSONB,
    "familyCommData" JSONB,
    "proceduresData" JSONB,
    "ioData" JSONB,
    "bradenScore" INTEGER,
    "bradenRisk" TEXT,
    "bradenData" JSONB,
    "carePlanData" JSONB,
    "handoverData" JSONB,
    "nursingTasksData" JSONB,
    "marData" JSONB,
    "vitals" JSONB,
    "pfe" JSONB,
    "timeOutChecklist" JSONB,
    "isCorrected" BOOLEAN NOT NULL DEFAULT false,
    "correctedAt" TIMESTAMPTZ,
    "correctedByUserId" TEXT,
    "correctionReason" TEXT,
    "correctedEntryId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opd_nursing_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opd_doctor_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "opdEncounterId" UUID NOT NULL,
    "noteType" "OpdDoctorNoteType" NOT NULL,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "freeText" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opd_doctor_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opd_doctor_addenda" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "opdEncounterId" UUID NOT NULL,
    "noteType" "OpdDoctorNoteType" NOT NULL,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "freeText" TEXT,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opd_doctor_addenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opd_results_viewed" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "opdEncounterId" UUID NOT NULL,
    "resultId" TEXT NOT NULL,
    "viewedAt" TIMESTAMPTZ NOT NULL,
    "viewedBy" TEXT NOT NULL,

    CONSTRAINT "opd_results_viewed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opd_bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID,
    "patientId" UUID,
    "encounterCoreId" UUID,
    "resourceId" UUID,
    "clinicId" TEXT,
    "doctorId" TEXT,
    "departmentId" TEXT,
    "slotId" UUID,
    "slotIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bookingType" TEXT NOT NULL DEFAULT 'PATIENT',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "visitType" "OpdVisitType",
    "date" TEXT,
    "bookingDate" DATE,
    "startAt" TIMESTAMPTZ,
    "endAt" TIMESTAMPTZ,
    "startTime" TIMESTAMPTZ,
    "endTime" TIMESTAMPTZ,
    "checkedInAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "reason" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMPTZ,
    "cancelledByUserId" TEXT,
    "noShowAt" TIMESTAMPTZ,
    "noShowReason" TEXT,
    "pendingPaymentAt" TIMESTAMPTZ,
    "isWalkIn" BOOLEAN NOT NULL DEFAULT false,
    "chiefComplaint" TEXT,
    "specialtyCode" TEXT,
    "priority" TEXT,
    "isPrimaryClinicBooking" BOOLEAN,
    "payment" JSONB,
    "billingMeta" JSONB,
    "isFirstVisit" BOOLEAN,
    "reminderSentAt" TIMESTAMPTZ,
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "opd_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opd_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID,
    "patientId" UUID,
    "kind" TEXT,
    "orderType" TEXT,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ORDERED',
    "priority" TEXT,
    "orderDetails" JSONB,
    "results" JSONB,
    "notes" TEXT,
    "orderedBy" TEXT,
    "orderedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "opd_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opd_daily_data" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "departmentId" TEXT,
    "doctorId" TEXT,
    "employmentType" TEXT,
    "subspecialty" TEXT,
    "isPrimarySpecialty" BOOLEAN,
    "rooms" INTEGER,
    "slotsPerHour" INTEGER,
    "clinicStartTime" TEXT,
    "clinicEndTime" TEXT,
    "totalPatients" INTEGER NOT NULL DEFAULT 0,
    "booked" INTEGER NOT NULL DEFAULT 0,
    "walkIn" INTEGER NOT NULL DEFAULT 0,
    "noShow" INTEGER NOT NULL DEFAULT 0,
    "timeDistribution" JSONB,
    "fv" INTEGER NOT NULL DEFAULT 0,
    "fcv" INTEGER NOT NULL DEFAULT 0,
    "fuv" INTEGER NOT NULL DEFAULT 0,
    "rv" INTEGER NOT NULL DEFAULT 0,
    "procedures" INTEGER NOT NULL DEFAULT 0,
    "orSurgeries" INTEGER NOT NULL DEFAULT 0,
    "admissions" INTEGER NOT NULL DEFAULT 0,
    "cath" INTEGER NOT NULL DEFAULT 0,
    "deliveriesNormal" INTEGER NOT NULL DEFAULT 0,
    "deliveriesSC" INTEGER NOT NULL DEFAULT 0,
    "ivf" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "opd_daily_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opd_census" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "clinicId" TEXT,
    "departmentId" TEXT,
    "doctorId" TEXT,
    "patientCount" INTEGER NOT NULL DEFAULT 0,
    "newPatients" INTEGER NOT NULL DEFAULT 0,
    "followUpPatients" INTEGER NOT NULL DEFAULT 0,
    "booked" INTEGER NOT NULL DEFAULT 0,
    "waiting" INTEGER NOT NULL DEFAULT 0,
    "procedures" INTEGER NOT NULL DEFAULT 0,
    "scheduledTime" INTEGER,
    "actualTime" INTEGER,
    "utilizationRate" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "opd_census_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opd_meeting_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "title" TEXT,
    "date" DATE,
    "attendees" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "agenda" TEXT,
    "minutes" TEXT,
    "decisions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actionItems" JSONB,
    "reportContent" JSONB,
    "persistedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "opd_meeting_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opd_recommendations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID,
    "patientId" UUID,
    "type" TEXT,
    "severity" TEXT,
    "title" TEXT,
    "titleAr" TEXT,
    "titleEn" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "actionAr" TEXT,
    "actionEn" TEXT,
    "priority" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "departmentId" TEXT,
    "departmentName" TEXT,
    "doctorId" TEXT,
    "doctorName" TEXT,
    "metric" TEXT,
    "metricValue" DECIMAL(12,2),
    "threshold" DECIMAL(12,2),
    "confidence" DECIMAL(5,2),
    "expiresAt" TIMESTAMPTZ,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMPTZ,
    "acknowledgedBy" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedAt" TIMESTAMPTZ,
    "dismissedBy" TEXT,
    "dismissReason" TEXT,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "validatedAt" TIMESTAMPTZ,
    "validationResult" JSONB,
    "persistedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "opd_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "or_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "encounterCoreId" UUID,
    "episodeId" UUID,
    "patientMasterId" UUID,
    "procedureName" TEXT,
    "procedureCode" TEXT,
    "departmentKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "scheduledDate" DATE,
    "scheduledStartTime" TIMESTAMPTZ,
    "scheduledEndTime" TIMESTAMPTZ,
    "estimatedDurationMin" INTEGER,
    "roomName" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'ELECTIVE',
    "caseType" TEXT,
    "surgeonName" TEXT,
    "anesthesiologistName" TEXT,
    "asaClass" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "or_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "or_case_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "step" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "or_case_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "or_time_outs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "performedAt" TIMESTAMPTZ NOT NULL,
    "performedBy" UUID NOT NULL,
    "patientIdConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "procedureConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "siteConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "consentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "antibioticGiven" BOOLEAN NOT NULL DEFAULT false,
    "imagingAvailable" BOOLEAN NOT NULL DEFAULT false,
    "equipmentReady" BOOLEAN NOT NULL DEFAULT false,
    "teamIntroduced" BOOLEAN NOT NULL DEFAULT false,
    "criticalConcerns" TEXT,
    "signatures" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "or_time_outs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "or_anesthesia_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "anesthesiologistId" UUID NOT NULL,
    "anesthesiaType" TEXT NOT NULL,
    "inductionTime" TIMESTAMPTZ,
    "emergenceTime" TIMESTAMPTZ,
    "airwayManagement" TEXT,
    "agents" JSONB NOT NULL DEFAULT '[]',
    "vitalsLog" JSONB NOT NULL DEFAULT '[]',
    "fluidBalance" JSONB,
    "complications" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "or_anesthesia_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "or_pacu_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "nurseId" UUID NOT NULL,
    "arrivalTime" TIMESTAMPTZ NOT NULL,
    "dischargeTime" TIMESTAMPTZ,
    "aldreteScores" JSONB NOT NULL DEFAULT '[]',
    "vitalsLog" JSONB NOT NULL DEFAULT '[]',
    "painMgmt" JSONB,
    "nausea" BOOLEAN NOT NULL DEFAULT false,
    "shivering" BOOLEAN NOT NULL DEFAULT false,
    "bleeding" TEXT,
    "disposition" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "or_pacu_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "or_surgical_teams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "surgeon" TEXT,
    "assistantSurgeon" TEXT,
    "anesthesiologist" TEXT,
    "scrubNurse" TEXT,
    "circulatingNurse" TEXT,
    "perfusionist" TEXT,
    "specialistConsult" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "or_surgical_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "or_implants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "itemName" TEXT NOT NULL,
    "manufacturer" TEXT,
    "lotNumber" TEXT,
    "serialNumber" TEXT,
    "expiryDate" DATE,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "site" TEXT,
    "recordedBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "or_implants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "or_surgical_counts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "phase" TEXT NOT NULL,
    "instruments" JSONB NOT NULL DEFAULT '[]',
    "sponges" JSONB NOT NULL DEFAULT '[]',
    "needles" JSONB NOT NULL DEFAULT '[]',
    "blades" JSONB NOT NULL DEFAULT '[]',
    "otherItems" JSONB NOT NULL DEFAULT '[]',
    "totalExpected" INTEGER NOT NULL DEFAULT 0,
    "totalActual" INTEGER NOT NULL DEFAULT 0,
    "isDiscrepancy" BOOLEAN NOT NULL DEFAULT false,
    "discrepancyNote" TEXT,
    "discrepancyResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMPTZ,
    "resolvedByUserId" UUID,
    "countedByUserId" UUID NOT NULL,
    "countedByName" TEXT,
    "verifiedByUserId" UUID,
    "verifiedByName" TEXT,
    "verifiedAt" TIMESTAMPTZ,
    "countedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "or_surgical_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "or_specimen_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "patientMasterId" UUID,
    "specimenLabel" TEXT NOT NULL,
    "specimenType" TEXT NOT NULL,
    "site" TEXT,
    "destination" TEXT NOT NULL,
    "fixative" TEXT,
    "containerType" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "collectedByUserId" UUID NOT NULL,
    "collectedByName" TEXT,
    "collectedAt" TIMESTAMPTZ NOT NULL,
    "handedToUserId" UUID,
    "handedToName" TEXT,
    "handedAt" TIMESTAMPTZ,
    "sentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "sentConfirmedAt" TIMESTAMPTZ,
    "sentConfirmedBy" UUID,
    "pathologySpecimenId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "or_specimen_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "or_nursing_pre_ops" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "assessedByUserId" UUID NOT NULL,
    "assessedByName" TEXT,
    "assessedAt" TIMESTAMPTZ NOT NULL,
    "patientIdVerified" BOOLEAN NOT NULL DEFAULT false,
    "idBandChecked" BOOLEAN NOT NULL DEFAULT false,
    "npoCompliant" BOOLEAN NOT NULL DEFAULT false,
    "lastOralIntakeTime" TIMESTAMPTZ,
    "npoNotes" TEXT,
    "allergiesReviewed" BOOLEAN NOT NULL DEFAULT false,
    "allergiesList" JSONB NOT NULL DEFAULT '[]',
    "homeMediaReviewed" BOOLEAN NOT NULL DEFAULT false,
    "homeMedications" JSONB NOT NULL DEFAULT '[]',
    "vitals" JSONB,
    "ivAccess" BOOLEAN NOT NULL DEFAULT false,
    "ivSite" TEXT,
    "ivGauge" TEXT,
    "ivFluid" TEXT,
    "skinIntegrity" TEXT,
    "skinNotes" TEXT,
    "mentalStatus" TEXT,
    "jewelryRemoved" BOOLEAN NOT NULL DEFAULT false,
    "denturesRemoved" BOOLEAN NOT NULL DEFAULT false,
    "prostheticsRemoved" BOOLEAN NOT NULL DEFAULT false,
    "hearingAidsRemoved" BOOLEAN NOT NULL DEFAULT false,
    "belongingsSecured" BOOLEAN NOT NULL DEFAULT false,
    "belongingsNotes" TEXT,
    "surgicalConsentSigned" BOOLEAN NOT NULL DEFAULT false,
    "anesthesiaConsentSigned" BOOLEAN NOT NULL DEFAULT false,
    "bloodConsentSigned" BOOLEAN NOT NULL DEFAULT false,
    "labResultsReviewed" BOOLEAN NOT NULL DEFAULT false,
    "imagingReviewed" BOOLEAN NOT NULL DEFAULT false,
    "bloodProductsReady" BOOLEAN NOT NULL DEFAULT false,
    "pregnancyTestResult" TEXT,
    "surgicalSiteMarked" BOOLEAN NOT NULL DEFAULT false,
    "siteMarkedBy" TEXT,
    "laterality" TEXT,
    "fallRiskAssessed" BOOLEAN NOT NULL DEFAULT false,
    "fallRiskLevel" TEXT,
    "dvtProphylaxis" BOOLEAN NOT NULL DEFAULT false,
    "dvtMethod" TEXT,
    "patientEducation" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "nursingNotes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "or_nursing_pre_ops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "or_anesthesia_pre_ops" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "assessedByUserId" UUID NOT NULL,
    "assessedByName" TEXT,
    "assessedAt" TIMESTAMPTZ NOT NULL,
    "asaClass" TEXT,
    "asaEmergency" BOOLEAN NOT NULL DEFAULT false,
    "mallampatiScore" TEXT,
    "thyroMentalDistance" TEXT,
    "mouthOpening" TEXT,
    "neckMobility" TEXT,
    "dentitionStatus" TEXT,
    "beardPresent" BOOLEAN NOT NULL DEFAULT false,
    "predictedDifficultAirway" BOOLEAN NOT NULL DEFAULT false,
    "airwayNotes" TEXT,
    "cardiacHistory" JSONB,
    "respiratoryHistory" JSONB,
    "hepaticHistory" JSONB,
    "renalHistory" JSONB,
    "endocrineHistory" JSONB,
    "neurologicHistory" JSONB,
    "hematologicHistory" JSONB,
    "previousAnesthesia" BOOLEAN NOT NULL DEFAULT false,
    "previousComplications" TEXT,
    "familyAnesthesiaHx" TEXT,
    "currentMedications" JSONB NOT NULL DEFAULT '[]',
    "herbals" TEXT,
    "npoVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastSolidsTime" TIMESTAMPTZ,
    "lastClearLiquidsTime" TIMESTAMPTZ,
    "plannedAnesthesiaType" TEXT,
    "plannedAirway" TEXT,
    "preMedications" JSONB NOT NULL DEFAULT '[]',
    "cardiacRiskIndex" TEXT,
    "pulmonaryRiskScore" TEXT,
    "bleedingRisk" TEXT,
    "ponvRisk" TEXT,
    "risksExplained" BOOLEAN NOT NULL DEFAULT false,
    "consentObtained" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "specialConsiderations" TEXT,
    "anesthesiaNotes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "or_anesthesia_pre_ops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "or_nursing_docs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "position" TEXT,
    "positionAids" JSONB,
    "positionVerifiedBy" UUID,
    "skinPrepAgent" TEXT,
    "skinPrepArea" TEXT,
    "skinPrepPerformedBy" UUID,
    "skinIntegrityPreOp" TEXT,
    "skinIntegrityPostOp" TEXT,
    "tourniquetUsed" BOOLEAN NOT NULL DEFAULT false,
    "tourniquetSite" TEXT,
    "tourniquetPressure" INTEGER,
    "tourniquetOnTime" TIMESTAMPTZ,
    "tourniquetOffTime" TIMESTAMPTZ,
    "tourniquetTotalMin" INTEGER,
    "electrocauteryUsed" BOOLEAN NOT NULL DEFAULT false,
    "electrocauteryType" TEXT,
    "electrocauterySettings" JSONB,
    "groundPadPlacement" TEXT,
    "estimatedBloodLossMl" INTEGER,
    "irrigationUsedMl" INTEGER,
    "drainType" TEXT,
    "drainOutput" TEXT,
    "nursingNotes" TEXT,
    "documentedByUserId" UUID NOT NULL,
    "documentedByName" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "or_nursing_docs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "or_operative_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "surgeonUserId" UUID NOT NULL,
    "surgeonName" TEXT,
    "preOpDiagnosis" TEXT,
    "postOpDiagnosis" TEXT,
    "procedurePerformed" TEXT,
    "procedureCode" TEXT,
    "operationType" TEXT,
    "laterality" TEXT,
    "incisionTime" TIMESTAMPTZ,
    "closureTime" TIMESTAMPTZ,
    "totalDurationMin" INTEGER,
    "assistantSurgeon" TEXT,
    "anesthesiologist" TEXT,
    "scrubNurse" TEXT,
    "circulatingNurse" TEXT,
    "anesthesiaType" TEXT,
    "findings" TEXT,
    "techniqueDescription" TEXT,
    "complications" TEXT,
    "estimatedBloodLossMl" INTEGER,
    "drains" JSONB,
    "specimens" JSONB,
    "implants" JSONB,
    "closureMethod" TEXT,
    "dressingType" TEXT,
    "postOpInstructions" TEXT,
    "dietInstructions" TEXT,
    "activityLevel" TEXT,
    "followUpPlan" TEXT,
    "disposition" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "signedAt" TIMESTAMPTZ,
    "amendedAt" TIMESTAMPTZ,
    "amendmentReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "or_operative_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "or_post_op_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "orderedByUserId" UUID NOT NULL,
    "orderedByName" TEXT,
    "admitTo" TEXT,
    "bedType" TEXT,
    "condition" TEXT,
    "vitalFrequency" TEXT,
    "neurovascularChecks" BOOLEAN NOT NULL DEFAULT false,
    "neurovascularFreq" TEXT,
    "activityLevel" TEXT,
    "positionRestrictions" TEXT,
    "fallPrecautions" BOOLEAN NOT NULL DEFAULT false,
    "dietType" TEXT,
    "fluidRestriction" TEXT,
    "ivFluids" JSONB,
    "painManagement" JSONB,
    "antibiotics" JSONB,
    "anticoagulation" JSONB,
    "antiemetics" JSONB,
    "otherMedications" JSONB,
    "woundCareInstructions" TEXT,
    "drainManagement" TEXT,
    "dressingChanges" TEXT,
    "dvtProphylaxis" BOOLEAN NOT NULL DEFAULT false,
    "dvtMethod" TEXT,
    "oxygenTherapy" TEXT,
    "incentiveSpirometry" BOOLEAN NOT NULL DEFAULT false,
    "coughDeepBreath" BOOLEAN NOT NULL DEFAULT false,
    "intakeOutputMonitoring" BOOLEAN NOT NULL DEFAULT false,
    "foleyPresent" BOOLEAN NOT NULL DEFAULT false,
    "foleyRemovalPlan" TEXT,
    "labOrders" JSONB,
    "imagingOrders" JSONB,
    "callDoctorIf" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "activatedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "or_post_op_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "or_preference_cards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "surgeonId" TEXT NOT NULL,
    "surgeonName" TEXT NOT NULL,
    "procedureName" TEXT NOT NULL,
    "procedureCode" TEXT,
    "specialty" TEXT,
    "instruments" JSONB NOT NULL,
    "sutures" JSONB,
    "implants" JSONB,
    "equipment" JSONB,
    "medications" JSONB,
    "positioning" TEXT,
    "skinPrep" TEXT,
    "draping" TEXT,
    "specialRequests" TEXT,
    "estimatedDuration" INTEGER,
    "roomPreference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "or_preference_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "or_utilization_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "roomName" TEXT NOT NULL,
    "totalSlotMinutes" INTEGER NOT NULL,
    "bookedMinutes" INTEGER NOT NULL DEFAULT 0,
    "actualMinutes" INTEGER NOT NULL DEFAULT 0,
    "casesScheduled" INTEGER NOT NULL DEFAULT 0,
    "casesCompleted" INTEGER NOT NULL DEFAULT 0,
    "casesCancelled" INTEGER NOT NULL DEFAULT 0,
    "avgTurnoverMinutes" DOUBLE PRECISION,
    "firstCaseOnTime" BOOLEAN,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "utilizationPct" DOUBLE PRECISION,
    "overtime" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "or_utilization_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_hub" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID,
    "patientMasterId" UUID,
    "sourceSystem" TEXT,
    "sourceEncounterId" UUID,
    "sourceDepartment" TEXT,
    "kind" TEXT NOT NULL,
    "departmentKey" TEXT,
    "orderCode" TEXT,
    "orderName" TEXT,
    "orderNameAr" TEXT,
    "priority" TEXT DEFAULT 'ROUTINE',
    "clinicalText" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ORDERED',
    "orderedAt" TIMESTAMPTZ,
    "acceptedAt" TIMESTAMPTZ,
    "inProgressAt" TIMESTAMPTZ,
    "resultedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,
    "cancelReason" TEXT,
    "assignedToUserId" UUID,
    "assignedToDept" TEXT,
    "meta" JSONB,
    "idempotencyKey" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,

    CONSTRAINT "orders_hub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    "performedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "resultType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PRELIMINARY',
    "data" JSONB,
    "summary" TEXT,
    "interpretedBy" UUID,
    "verifiedBy" UUID,
    "verifiedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "order_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "testId" TEXT,
    "orderId" UUID,
    "patientId" UUID,
    "encounterId" UUID,
    "testCode" TEXT,
    "testName" TEXT,
    "testNameAr" TEXT,
    "parameters" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "collectedAt" TIMESTAMPTZ,
    "resultedAt" TIMESTAMPTZ,
    "verifiedAt" TIMESTAMPTZ,
    "verifiedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radiology_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "orderId" UUID,
    "encounterId" UUID,
    "patientId" UUID,
    "examCode" TEXT,
    "examName" TEXT,
    "examNameAr" TEXT,
    "modality" TEXT,
    "bodyPart" TEXT,
    "findings" TEXT,
    "impression" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "radiologistId" UUID,
    "hasImages" BOOLEAN NOT NULL DEFAULT false,
    "reportedAt" TIMESTAMPTZ,
    "verifiedAt" TIMESTAMPTZ,
    "verifiedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "radiology_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connect_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "sourceSystem" TEXT,
    "sourceId" TEXT,
    "patientId" UUID,
    "encounterId" UUID,
    "orderId" UUID,
    "source" JSONB,
    "patientLink" JSONB,
    "order" JSONB,
    "result" JSONB,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "matchedAt" TIMESTAMPTZ,
    "appliedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "connect_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connect_ingest_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "source" JSONB,
    "occurredAt" TEXT,
    "patientHash" TEXT,
    "dedupeKey" TEXT,
    "clientRequestId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "connect_ingest_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connect_device_vitals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "source" JSONB,
    "occurredAt" TEXT,
    "patientLink" JSONB,
    "location" JSONB,
    "vitals" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "connect_device_vitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storage" JSONB,
    "checksum" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_acks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "orderResultId" UUID NOT NULL,
    "orderId" UUID,
    "userId" TEXT,
    "roleAtAck" TEXT,
    "ackAt" TIMESTAMPTZ NOT NULL,
    "comment" TEXT,
    "idempotencyKey" TEXT,

    CONSTRAINT "result_acks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "category" TEXT,
    "scope" TEXT,
    "departmentKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roleScope" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "items" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "order_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_set_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "orderSetId" UUID NOT NULL,
    "kind" TEXT,
    "orderCode" TEXT,
    "displayName" TEXT,
    "defaults" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "order_set_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_set_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "orderSetId" UUID NOT NULL,
    "encounterRef" JSONB,
    "encounterRefKey" TEXT,
    "createdOrderIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "appliedByUserId" TEXT,
    "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_set_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_context_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "encounterCoreId" UUID,
    "noteId" TEXT,
    "noteType" TEXT,
    "reason" TEXT,
    "linkedByUserId" TEXT,
    "linkedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "updatedByUserId" TEXT,
    "idempotencyKey" TEXT,

    CONSTRAINT "order_context_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_result_acks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "encounterCoreId" UUID,
    "userId" TEXT,
    "reason" TEXT,
    "time" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "order_result_acks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pathology_specimens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "caseId" UUID,
    "orderId" UUID,
    "accessionNumber" TEXT,
    "specimenType" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "clinicalHistory" TEXT,
    "clinicalDiagnosis" TEXT,
    "collectedBy" UUID,
    "collectedAt" TIMESTAMPTZ,
    "receivedAt" TIMESTAMPTZ,
    "receivedBy" UUID,
    "fixative" TEXT,
    "numberOfParts" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "grossingData" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pathology_specimens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pathology_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "specimenId" UUID NOT NULL,
    "pathologistId" UUID NOT NULL,
    "grossDescription" TEXT,
    "microscopicDescription" TEXT,
    "specialStains" TEXT,
    "immunohistochemistry" TEXT,
    "ihcMarkers" JSONB NOT NULL DEFAULT '[]',
    "molecularStudies" TEXT,
    "molecularResults" JSONB NOT NULL DEFAULT '[]',
    "tumorCharacteristics" JSONB,
    "diagnosis" TEXT NOT NULL DEFAULT '',
    "icdCode" TEXT,
    "snomed" TEXT,
    "comments" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "signedAt" TIMESTAMPTZ,
    "signedBy" UUID,
    "amendedAt" TIMESTAMPTZ,
    "amendedBy" UUID,
    "amendmentNote" TEXT,
    "amendments" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pathology_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_master" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "mrn" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "dob" DATE,
    "gender" "PatientGender" NOT NULL DEFAULT 'UNKNOWN',
    "nationalId" TEXT,
    "iqama" TEXT,
    "passport" TEXT,
    "identifiers" JSONB,
    "status" "PatientMasterStatus" NOT NULL DEFAULT 'KNOWN',
    "mergedIntoPatientId" UUID,
    "mergedAt" TIMESTAMPTZ,
    "mobile" TEXT,
    "email" TEXT,
    "bloodType" TEXT,
    "nationality" TEXT,
    "city" TEXT,
    "knownAllergies" JSONB,
    "emergencyContact" JSONB,
    "insuranceCompanyName" TEXT,
    "links" JSONB,
    "nationalId_hash" TEXT,
    "iqama_hash" TEXT,
    "passport_hash" TEXT,
    "fullName_hash" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,

    CONSTRAINT "patient_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_allergies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "allergen" TEXT NOT NULL,
    "reaction" TEXT,
    "type" TEXT NOT NULL DEFAULT 'DRUG',
    "severity" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "nkda" BOOLEAN NOT NULL DEFAULT false,
    "onsetDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "patient_allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_problems" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "problemName" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "icdCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "onsetDate" DATE,
    "resolvedDate" DATE,
    "severity" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "patient_problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_insurance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "payerName" TEXT NOT NULL,
    "payerId" TEXT,
    "insurerId" TEXT,
    "insurerName" TEXT,
    "policyNumber" TEXT,
    "memberId" TEXT,
    "groupNumber" TEXT,
    "planType" TEXT,
    "relation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "effectiveDate" DATE,
    "expiryDate" DATE,
    "startDate" TIMESTAMPTZ,
    "endDate" TIMESTAMPTZ,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "lastEligibilityCheck" TIMESTAMPTZ,
    "eligible" BOOLEAN,
    "coverageActive" BOOLEAN,
    "remainingBenefit" DECIMAL(12,2),
    "eligibilityStatus" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "patient_insurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_identity_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "system" TEXT NOT NULL,
    "sourcePatientId" TEXT NOT NULL,
    "mrn" TEXT,
    "tempMrn" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_identity_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_proxy_access" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "proxyUserId" UUID NOT NULL,
    "proxyName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'ALL',
    "allowedEncounterIds" JSONB,
    "verificationMethod" TEXT,
    "verificationDocumentUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ,
    "revokedByUserId" UUID,
    "revokeReason" TEXT,
    "expiresAt" TIMESTAMPTZ,
    "patientDob" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "portal_proxy_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_inventory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "medicationId" TEXT,
    "medicationName" TEXT NOT NULL,
    "medicationNameAr" TEXT,
    "barcode" TEXT,
    "batchNumber" TEXT,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2),
    "expiryDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMPTZ,
    "createdBy" TEXT,

    CONSTRAINT "pharmacy_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_prescriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" TEXT,
    "patientName" TEXT,
    "mrn" TEXT,
    "encounterId" UUID,
    "medication" TEXT,
    "medicationAr" TEXT,
    "genericName" TEXT,
    "strength" TEXT,
    "form" TEXT,
    "route" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "quantity" INTEGER,
    "refills" INTEGER,
    "instructions" TEXT,
    "instructionsAr" TEXT,
    "doctorId" TEXT,
    "doctorName" TEXT,
    "priority" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "prescribedAt" TIMESTAMPTZ,
    "prescribedBy" TEXT,
    "prescriberName" TEXT,
    "verifiedAt" TIMESTAMPTZ,
    "verifiedBy" TEXT,
    "verifierName" TEXT,
    "verificationNotes" TEXT,
    "dispensedAt" TIMESTAMPTZ,
    "dispensedBy" TEXT,
    "dispenserName" TEXT,
    "pharmacistNotes" TEXT,
    "pickedUpAt" TIMESTAMPTZ,
    "pickedUpRecordedBy" TEXT,
    "cancelledAt" TIMESTAMPTZ,
    "cancelledBy" TEXT,
    "cancellationReason" TEXT,
    "ordersHubId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pharmacy_prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_stock_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "medicationId" TEXT,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousStock" INTEGER,
    "newStock" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "createdByName" TEXT,

    CONSTRAINT "pharmacy_stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_unit_doses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "prescriptionId" UUID,
    "episodeId" UUID,
    "patientId" UUID,
    "patientName" TEXT,
    "mrn" TEXT,
    "wardUnit" TEXT,
    "bedLabel" TEXT,
    "medication" TEXT NOT NULL,
    "genericName" TEXT,
    "strength" TEXT,
    "form" TEXT,
    "route" TEXT,
    "dose" TEXT,
    "frequency" TEXT,
    "scheduledTime" TIMESTAMPTZ,
    "preparedByUserId" UUID,
    "preparedByName" TEXT,
    "preparedAt" TIMESTAMPTZ,
    "verifiedByUserId" UUID,
    "verifiedByName" TEXT,
    "verifiedAt" TIMESTAMPTZ,
    "dispensedByUserId" UUID,
    "dispensedByName" TEXT,
    "dispensedAt" TIMESTAMPTZ,
    "administeredByUserId" UUID,
    "administeredByName" TEXT,
    "administeredAt" TIMESTAMPTZ,
    "administrationNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "returnReason" TEXT,
    "wasteReason" TEXT,
    "wasteWitnessUserId" UUID,
    "wasteWitnessName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pharmacy_unit_doses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_controlled_substance_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "medication" TEXT NOT NULL,
    "genericName" TEXT,
    "schedule" TEXT,
    "strength" TEXT,
    "form" TEXT,
    "transactionType" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "balanceBefore" DOUBLE PRECISION,
    "balanceAfter" DOUBLE PRECISION,
    "patientId" UUID,
    "patientName" TEXT,
    "mrn" TEXT,
    "prescriptionId" UUID,
    "performedByUserId" UUID NOT NULL,
    "performedByName" TEXT,
    "witnessUserId" UUID,
    "witnessName" TEXT,
    "wasteMethod" TEXT,
    "wasteAmount" DOUBLE PRECISION,
    "sourceLocation" TEXT,
    "destinationLocation" TEXT,
    "lotNumber" TEXT,
    "expiryDate" DATE,
    "verifiedByUserId" UUID,
    "verifiedByName" TEXT,
    "verifiedAt" TIMESTAMPTZ,
    "discrepancyFound" BOOLEAN NOT NULL DEFAULT false,
    "discrepancyNote" TEXT,
    "discrepancyResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedByUserId" UUID,
    "resolvedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pharmacy_controlled_substance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pt_referrals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "encounterId" UUID,
    "episodeId" UUID,
    "referredBy" UUID NOT NULL,
    "specialty" TEXT NOT NULL DEFAULT 'PHYSIOTHERAPY',
    "reason" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'ROUTINE',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pt_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pt_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "referralId" UUID NOT NULL,
    "assessedBy" UUID NOT NULL,
    "chiefComplaint" TEXT NOT NULL,
    "historyOfPresentIllness" TEXT,
    "pastHistory" TEXT,
    "functionalStatus" JSONB,
    "goalShortTerm" TEXT,
    "goalLongTerm" TEXT,
    "treatmentPlan" TEXT,
    "frequency" TEXT,
    "precautions" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pt_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pt_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "referralId" UUID NOT NULL,
    "therapistId" UUID NOT NULL,
    "sessionDate" TIMESTAMPTZ NOT NULL,
    "duration" INTEGER,
    "interventions" JSONB NOT NULL DEFAULT '[]',
    "patientResponse" TEXT,
    "progressNote" TEXT,
    "painBefore" INTEGER,
    "painAfter" INTEGER,
    "nextSession" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pt_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_portal_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "mobile" TEXT NOT NULL,
    "patientMasterId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "patient_portal_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_portal_rate_limits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_portal_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_portal_pending_registrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "fullName" TEXT,
    "idType" TEXT,
    "idNumber" TEXT,
    "mobile" TEXT NOT NULL,
    "patientMasterId" UUID,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_portal_pending_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "providerId" TEXT,
    "lastMessage" TEXT,
    "lastMessageAt" TIMESTAMPTZ,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "patient_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "senderName" TEXT,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_clinical_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "history" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "patient_clinical_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_chat_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "messages" JSONB,
    "topic" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "patient_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_explain_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "type" TEXT,
    "request" TEXT,
    "response" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_explain_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psychiatric_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "encounterId" UUID,
    "assessedBy" TEXT NOT NULL,
    "assessmentDate" TIMESTAMPTZ NOT NULL,
    "chiefComplaint" TEXT NOT NULL,
    "presentingIllness" TEXT,
    "psychiatricHistory" TEXT,
    "medicalHistory" TEXT,
    "familyHistory" TEXT,
    "substanceUse" JSONB,
    "mentalStatusExam" JSONB NOT NULL,
    "riskAssessment" JSONB,
    "diagnosis" TEXT,
    "icdCode" TEXT,
    "dsm5Diagnosis" TEXT,
    "formulation" TEXT,
    "treatmentPlan" TEXT,
    "disposition" TEXT,
    "followUpDate" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "psychiatric_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psych_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "authorId" TEXT NOT NULL,
    "noteDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "noteType" TEXT NOT NULL DEFAULT 'PROGRESS',
    "content" TEXT NOT NULL,
    "medications" JSONB,
    "moodRating" INTEGER,
    "suicidalRisk" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "psych_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psych_medications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "assessmentId" UUID,
    "drug" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "route" TEXT NOT NULL DEFAULT 'ORAL',
    "indication" TEXT,
    "startDate" TIMESTAMPTZ NOT NULL,
    "endDate" TIMESTAMPTZ,
    "prescribedBy" TEXT NOT NULL,
    "sideEffects" TEXT,
    "adherence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "psych_medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psych_restraint_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "encounterId" UUID,
    "orderedByUserId" UUID NOT NULL,
    "orderedByName" TEXT,
    "orderedAt" TIMESTAMPTZ NOT NULL,
    "orderExpiry" TIMESTAMPTZ,
    "renewals" JSONB,
    "interventionType" TEXT NOT NULL,
    "restraintType" TEXT,
    "seclusionRoom" TEXT,
    "reason" TEXT NOT NULL,
    "behaviorDescription" TEXT,
    "alternativesAttempted" JSONB,
    "startedAt" TIMESTAMPTZ NOT NULL,
    "endedAt" TIMESTAMPTZ,
    "totalDurationMin" INTEGER,
    "monitoringChecks" JSONB,
    "monitoringFreqMin" INTEGER NOT NULL DEFAULT 15,
    "patientResponse" TEXT,
    "injuriesNoted" BOOLEAN NOT NULL DEFAULT false,
    "injuryDescription" TEXT,
    "physicianAssessedAt" TIMESTAMPTZ,
    "physicianAssessedBy" TEXT,
    "physicianNotes" TEXT,
    "debriefCompleted" BOOLEAN NOT NULL DEFAULT false,
    "debriefNotes" TEXT,
    "patientDebriefNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "discontinuedReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "psych_restraint_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psych_risk_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "encounterId" UUID,
    "assessedByUserId" UUID NOT NULL,
    "assessedByName" TEXT,
    "assessedAt" TIMESTAMPTZ NOT NULL,
    "assessmentType" TEXT NOT NULL,
    "suicideIdeation" BOOLEAN,
    "ideationType" TEXT,
    "ideationIntensity" INTEGER,
    "suicideBehavior" BOOLEAN,
    "behaviorType" TEXT,
    "nonSuicidalSelfInjury" BOOLEAN,
    "phq9Score" INTEGER,
    "phq9Item9" INTEGER,
    "brosetConfusion" BOOLEAN,
    "brosetIrritability" BOOLEAN,
    "brosetBoisterousness" BOOLEAN,
    "brosetVerbalThreats" BOOLEAN,
    "brosetPhysicalThreats" BOOLEAN,
    "brosetAttackObjects" BOOLEAN,
    "brosetScore" INTEGER,
    "staticFactors" JSONB,
    "dynamicFactors" JSONB,
    "protectiveFactors" JSONB,
    "suicideRiskLevel" TEXT,
    "violenceRiskLevel" TEXT,
    "overallRiskLevel" TEXT,
    "safetyPlanCreated" BOOLEAN NOT NULL DEFAULT false,
    "safetyPlan" JSONB,
    "interventions" JSONB,
    "dispositionPlan" TEXT,
    "supervisionLevel" TEXT,
    "environmentalSafety" BOOLEAN,
    "reassessmentDue" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "psych_risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psych_mental_status_exams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "encounterId" UUID,
    "assessedByUserId" UUID NOT NULL,
    "assessedByName" TEXT,
    "assessedAt" TIMESTAMPTZ NOT NULL,
    "appearance" JSONB,
    "behavior" JSONB,
    "speech" JSONB,
    "moodReported" TEXT,
    "affectObserved" TEXT,
    "affectCongruence" TEXT,
    "affectRange" TEXT,
    "thoughtProcess" TEXT,
    "thoughtContent" JSONB,
    "delusionType" TEXT,
    "perceptions" JSONB,
    "cognition" JSONB,
    "mmseScore" INTEGER,
    "mocaScore" INTEGER,
    "insight" TEXT,
    "judgment" TEXT,
    "reliability" TEXT,
    "summary" TEXT,
    "clinicalImpression" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "psych_mental_status_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psych_treatment_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "encounterId" UUID,
    "createdByUserId" UUID NOT NULL,
    "createdByName" TEXT,
    "dsm5Diagnosis" TEXT,
    "icdCode" TEXT,
    "diagnosisNotes" TEXT,
    "psychiatricProblems" JSONB,
    "medicalProblems" JSONB,
    "goals" JSONB,
    "patientInvolved" BOOLEAN NOT NULL DEFAULT false,
    "familyInvolved" BOOLEAN NOT NULL DEFAULT false,
    "participationNotes" TEXT,
    "reviewSchedule" TEXT,
    "nextReviewDate" TIMESTAMPTZ,
    "lastReviewedAt" TIMESTAMPTZ,
    "lastReviewedBy" TEXT,
    "reviewHistory" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "discontinuedReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "psych_treatment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psych_progress_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "encounterId" UUID,
    "treatmentPlanId" UUID,
    "authorUserId" UUID NOT NULL,
    "authorName" TEXT,
    "noteDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "noteType" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "dataSection" TEXT,
    "assessmentSection" TEXT,
    "planSection" TEXT,
    "goalProgress" JSONB,
    "medicationResponse" JSONB,
    "riskReassessment" JSONB,
    "briefMse" JSONB,
    "groupSessionId" UUID,
    "sessionDurationMin" INTEGER,
    "nextSessionDate" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "signedAt" TIMESTAMPTZ,
    "signedBy" TEXT,
    "cosignedBy" TEXT,
    "cosignedAt" TIMESTAMPTZ,
    "amendmentNotes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "psych_progress_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psych_scale_administrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "encounterId" UUID,
    "administeredByUserId" UUID NOT NULL,
    "administeredByName" TEXT,
    "administeredAt" TIMESTAMPTZ NOT NULL,
    "scaleType" TEXT NOT NULL,
    "scaleName" TEXT NOT NULL,
    "scaleVersion" TEXT,
    "responses" JSONB NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "subscaleScores" JSONB,
    "severityLevel" TEXT,
    "severityLabel" TEXT,
    "interpretation" TEXT,
    "clinicianNotes" TEXT,
    "treatmentPlanId" UUID,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "psych_scale_administrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psych_involuntary_holds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "episodeId" UUID,
    "encounterId" UUID,
    "orderedByUserId" UUID NOT NULL,
    "orderedByName" TEXT,
    "orderedAt" TIMESTAMPTZ NOT NULL,
    "legalBasis" TEXT,
    "dangerToSelf" BOOLEAN NOT NULL DEFAULT false,
    "dangerToSelfEvidence" TEXT,
    "dangerToOthers" BOOLEAN NOT NULL DEFAULT false,
    "dangerToOthersEvidence" TEXT,
    "gravelyDisabled" BOOLEAN NOT NULL DEFAULT false,
    "gravelyDisabledEvidence" TEXT,
    "additionalCriteria" TEXT,
    "holdType" TEXT NOT NULL DEFAULT 'INITIAL_72H',
    "holdStartAt" TIMESTAMPTZ NOT NULL,
    "holdExpiresAt" TIMESTAMPTZ NOT NULL,
    "extensionRequested" BOOLEAN NOT NULL DEFAULT false,
    "extensionReason" TEXT,
    "courtOrderRef" TEXT,
    "courtOrderDate" TIMESTAMPTZ,
    "psychiatricEvalAt" TIMESTAMPTZ,
    "psychiatricEvalBy" TEXT,
    "evalFindings" TEXT,
    "patientNotified" BOOLEAN NOT NULL DEFAULT false,
    "patientNotifiedAt" TIMESTAMPTZ,
    "legalRepNotified" BOOLEAN NOT NULL DEFAULT false,
    "legalRepNotifiedAt" TIMESTAMPTZ,
    "appealInfo" TEXT,
    "rightsDocumented" BOOLEAN NOT NULL DEFAULT false,
    "familyNotified" BOOLEAN NOT NULL DEFAULT false,
    "familyNotifiedAt" TIMESTAMPTZ,
    "familyNotifiedBy" TEXT,
    "familyContactName" TEXT,
    "reviews" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "resolvedAt" TIMESTAMPTZ,
    "resolvedBy" TEXT,
    "resolutionNotes" TEXT,
    "conversionToVoluntary" BOOLEAN NOT NULL DEFAULT false,
    "voluntaryConsentAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "psych_involuntary_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psych_group_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "groupName" TEXT NOT NULL,
    "groupType" TEXT NOT NULL,
    "description" TEXT,
    "facilitatorUserId" UUID NOT NULL,
    "facilitatorName" TEXT,
    "coFacilitatorId" UUID,
    "coFacilitatorName" TEXT,
    "schedule" TEXT,
    "maxParticipants" INTEGER NOT NULL DEFAULT 12,
    "location" TEXT,
    "roster" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMPTZ,
    "endDate" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "psych_group_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psych_group_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "sessionDate" TIMESTAMPTZ NOT NULL,
    "facilitatorUserId" UUID NOT NULL,
    "facilitatorName" TEXT,
    "theme" TEXT,
    "topicsCovered" TEXT,
    "keyDiscussions" TEXT,
    "materialsUsed" TEXT,
    "attendance" JSONB,
    "attendedCount" INTEGER NOT NULL DEFAULT 0,
    "absentCount" INTEGER NOT NULL DEFAULT 0,
    "sessionNotes" TEXT,
    "facilitatorReflections" TEXT,
    "nextSessionPlan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "cancelledReason" TEXT,
    "durationMin" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "psych_group_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_incidents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "type" TEXT,
    "severity" TEXT,
    "location" TEXT,
    "encounterCoreId" UUID,
    "episodeId" UUID,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "updatedAt" TIMESTAMPTZ,
    "updatedByUserId" TEXT,

    CONSTRAINT "quality_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_rca" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "whatHappened" TEXT,
    "why" TEXT,
    "correctiveAction" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "quality_rca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rca_analyses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "incidentId" UUID,
    "title" TEXT NOT NULL,
    "incidentDate" TIMESTAMPTZ NOT NULL,
    "analysisDate" TIMESTAMPTZ NOT NULL,
    "facilitatorId" TEXT NOT NULL,
    "teamMembers" JSONB,
    "problemStatement" TEXT NOT NULL,
    "timeline" JSONB,
    "fishbone" JSONB,
    "whyChain" JSONB,
    "rootCauses" JSONB NOT NULL,
    "contributingFactors" JSONB,
    "recommendations" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "lessonsLearned" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "rca_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fmea_analyses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "processName" TEXT NOT NULL,
    "processScope" TEXT,
    "team" JSONB,
    "conductedDate" TIMESTAMPTZ NOT NULL,
    "facilitatorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "fmea_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fmea_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "analysisId" UUID NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "processStep" TEXT NOT NULL,
    "failureMode" TEXT NOT NULL,
    "failureEffect" TEXT NOT NULL,
    "failureCause" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "occurrence" INTEGER NOT NULL,
    "detectability" INTEGER NOT NULL,
    "rpn" INTEGER NOT NULL,
    "currentControls" TEXT,
    "recommendedAction" TEXT,
    "actionOwner" TEXT,
    "targetDate" TIMESTAMPTZ,
    "actionTaken" TEXT,
    "newSeverity" INTEGER,
    "newOccurrence" INTEGER,
    "newDetectability" INTEGER,
    "newRpn" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fmea_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentinel_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "reportedBy" TEXT NOT NULL,
    "reportDate" TIMESTAMPTZ NOT NULL,
    "eventDate" TIMESTAMPTZ NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "patientMasterId" UUID,
    "immediateActions" TEXT,
    "disclosureDate" TIMESTAMPTZ,
    "jciCategory" TEXT,
    "rcaCompleted" BOOLEAN NOT NULL DEFAULT false,
    "rcaId" UUID,
    "status" TEXT NOT NULL DEFAULT 'REPORTED',
    "closedAt" TIMESTAMPTZ,
    "preventiveMeasures" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "sentinel_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_gap_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "category" TEXT NOT NULL,
    "gapType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "criteria" JSONB NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'moderate',
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "lastRunAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "care_gap_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_gap_findings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "patientName" TEXT,
    "gapType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'moderate',
    "status" TEXT NOT NULL DEFAULT 'open',
    "dueDate" TIMESTAMPTZ,
    "identifiedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addressedAt" TIMESTAMPTZ,
    "addressedBy" TEXT,
    "dismissedReason" TEXT,
    "ruleId" UUID,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "care_gap_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readmission_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "patientName" TEXT,
    "originalEncounterId" UUID NOT NULL,
    "originalAdmitDate" TIMESTAMPTZ NOT NULL,
    "originalDischargeDate" TIMESTAMPTZ NOT NULL,
    "originalDiagnosis" TEXT,
    "originalDepartment" TEXT,
    "readmitEncounterId" UUID NOT NULL,
    "readmitDate" TIMESTAMPTZ NOT NULL,
    "readmitDiagnosis" TEXT,
    "readmitDepartment" TEXT,
    "daysBetween" INTEGER NOT NULL,
    "isPreventable" TEXT NOT NULL DEFAULT 'unknown',
    "rootCause" TEXT,
    "rootCauseAr" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "reviewNotes" TEXT,
    "actionPlan" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "readmission_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbahi_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assessmentDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessorId" TEXT,
    "assessorName" TEXT,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "domainScores" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "findings" JSONB NOT NULL DEFAULT '[]',
    "actionPlan" JSONB NOT NULL DEFAULT '[]',
    "nextReviewDate" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cbahi_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbahi_evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "standardId" TEXT NOT NULL,
    "elementId" TEXT,
    "evidenceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewerNotes" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMPTZ,

    CONSTRAINT "cbahi_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdo_outcome_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID,
    "patientId" UUID,
    "outcomeType" TEXT NOT NULL,
    "severity" TEXT,
    "careSetting" TEXT,
    "occurredAt" TIMESTAMPTZ NOT NULL,
    "description" TEXT,
    "contributing" JSONB,
    "isNegative" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cdo_outcome_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdo_response_time_metrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID,
    "metricType" TEXT NOT NULL,
    "careSetting" TEXT,
    "timeMinutes" DOUBLE PRECISION NOT NULL,
    "thresholdMin" DOUBLE PRECISION,
    "exceededThreshold" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cdo_response_time_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_decision_prompts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID,
    "patientId" UUID,
    "promptType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT,
    "description" TEXT,
    "suggestedAction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMPTZ,
    "resolvedAt" TIMESTAMPTZ,
    "careSetting" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_decision_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipsg_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "assessmentDate" TIMESTAMPTZ NOT NULL,
    "assessorId" TEXT NOT NULL,
    "assessorName" TEXT,
    "period" TEXT NOT NULL,
    "ipsg1Score" INTEGER,
    "ipsg1Findings" JSONB,
    "ipsg2Score" INTEGER,
    "ipsg2Findings" JSONB,
    "ipsg3Score" INTEGER,
    "ipsg3Findings" JSONB,
    "ipsg4Score" INTEGER,
    "ipsg4Findings" JSONB,
    "ipsg5Score" INTEGER,
    "ipsg5Findings" JSONB,
    "ipsg6Score" INTEGER,
    "ipsg6Findings" JSONB,
    "overallScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "actionItems" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ipsg_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortality_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "encounterId" UUID,
    "episodeId" UUID,
    "dateOfDeath" TIMESTAMPTZ NOT NULL,
    "ageAtDeath" INTEGER,
    "gender" TEXT,
    "primaryDiagnosis" TEXT NOT NULL,
    "icdCode" TEXT,
    "secondaryDiagnoses" JSONB,
    "department" TEXT NOT NULL,
    "attendingPhysician" TEXT NOT NULL,
    "admissionDate" TIMESTAMPTZ,
    "lengthOfStay" INTEGER,
    "deathType" TEXT NOT NULL,
    "preventability" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "reviewDate" TIMESTAMPTZ,
    "reviewerId" TEXT,
    "reviewerName" TEXT,
    "reviewCommittee" JSONB,
    "timelineOfCare" JSONB,
    "contributingFactors" JSONB,
    "systemIssues" JSONB,
    "qualityOfCare" TEXT,
    "delayInDiagnosis" BOOLEAN NOT NULL DEFAULT false,
    "delayInTreatment" BOOLEAN NOT NULL DEFAULT false,
    "communicationIssue" BOOLEAN NOT NULL DEFAULT false,
    "handoffIssue" BOOLEAN NOT NULL DEFAULT false,
    "findings" TEXT,
    "recommendations" JSONB,
    "lessonsLearned" TEXT,
    "actionPlan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "mAndMPresented" BOOLEAN NOT NULL DEFAULT false,
    "mAndMDate" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mortality_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientName" TEXT,
    "patientMrn" TEXT,
    "patientMasterId" UUID,
    "encounterCoreId" UUID,
    "type" TEXT,
    "fromProviderId" TEXT,
    "fromProviderName" TEXT,
    "fromSpecialtyCode" TEXT,
    "fromSpecialtyName" TEXT,
    "toProviderId" TEXT,
    "toProviderName" TEXT,
    "toSpecialtyCode" TEXT,
    "toSpecialtyName" TEXT,
    "toUserId" TEXT,
    "reason" TEXT,
    "urgency" TEXT,
    "diagnosisCodes" JSONB,
    "clinicalNotes" TEXT,
    "externalFacility" TEXT,
    "transferBilling" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "acceptedBy" TEXT,
    "acceptedAt" TIMESTAMPTZ,
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMPTZ,
    "rejectionReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortuary_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterCoreId" UUID NOT NULL,
    "patientMasterId" UUID,
    "bodyTagNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "location" JSONB,
    "releaseDetails" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "updatedAt" TIMESTAMPTZ,

    CONSTRAINT "mortuary_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_reminders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "patientName" TEXT,
    "patientNameAr" TEXT,
    "patientMobile" TEXT,
    "patientEmail" TEXT,
    "doctorName" TEXT,
    "doctorNameAr" TEXT,
    "clinicName" TEXT,
    "clinicNameAr" TEXT,
    "appointmentDate" DATE NOT NULL,
    "appointmentTime" TEXT,
    "channel" TEXT NOT NULL,
    "reminderType" TEXT NOT NULL,
    "scheduledAt" TIMESTAMPTZ NOT NULL,
    "messageTemplate" TEXT,
    "messageContent" TEXT,
    "messageContentAr" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "sentAt" TIMESTAMPTZ,
    "deliveredAt" TIMESTAMPTZ,
    "failReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "responseType" TEXT,
    "respondedAt" TIMESTAMPTZ,
    "responseToken" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appointment_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "portalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "before24h" BOOLEAN NOT NULL DEFAULT true,
    "before2h" BOOLEAN NOT NULL DEFAULT true,
    "customHoursBefore" INTEGER,
    "smsTemplateAr" TEXT,
    "smsTemplateEn" TEXT,
    "emailTemplateAr" TEXT,
    "emailTemplateEn" TEXT,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reminder_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "theaEngineId" TEXT,
    "policyEngineId" TEXT,
    "title" TEXT NOT NULL,
    "originalFileName" TEXT,
    "filename" TEXT,
    "fileType" TEXT,
    "category" TEXT,
    "entityType" TEXT,
    "source" TEXT,
    "scope" TEXT,
    "departmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "operationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMPTZ,
    "archivedAt" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "statusUpdatedAt" TIMESTAMPTZ,
    "effectiveDate" DATE,
    "expiryDate" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "owners" JSONB,
    "reviewCycleMonths" INTEGER,
    "nextReviewDate" DATE,
    "classification" JSONB,
    "operationalMappingNeedsReview" BOOLEAN NOT NULL DEFAULT false,
    "tagsStatus" TEXT,
    "indexedAt" TIMESTAMPTZ,
    "progress" JSONB,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "policy_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "type" TEXT,
    "severity" TEXT,
    "message" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "departmentId" TEXT,
    "setting" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "frequency" TEXT,
    "ownerRole" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "practices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "departmentId" TEXT,
    "setting" TEXT,
    "createdBy" TEXT,
    "inputPracticeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resultsJson" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrity_findings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "ruleId" TEXT,
    "rulesetId" TEXT,
    "runId" TEXT,
    "title" TEXT,
    "summary" TEXT,
    "type" TEXT,
    "category" TEXT,
    "severity" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "documentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "archivedAt" TIMESTAMPTZ,
    "resolvedAt" TIMESTAMPTZ,
    "resolvedBy" TEXT,
    "acknowledgedAt" TIMESTAMPTZ,
    "acknowledgedBy" TEXT,
    "snoozedUntil" TIMESTAMPTZ,
    "snoozedAt" TIMESTAMPTZ,
    "snoozedBy" TEXT,
    "updatedAt" TIMESTAMPTZ,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integrity_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrity_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "documentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rulesetId" TEXT,
    "scope" JSONB,
    "progress" JSONB,
    "result" JSONB,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,
    "cancelledBy" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ,

    CONSTRAINT "integrity_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrity_rulesets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "integrity_rulesets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentTitle" TEXT,
    "title" TEXT,
    "taskType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "dueDate" TIMESTAMPTZ,
    "assignedTo" TEXT,
    "assigneeUserId" TEXT,
    "assigneeEmail" TEXT,
    "assigneeDisplayName" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ,

    CONSTRAINT "document_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "documentType" TEXT,
    "title" TEXT,
    "departmentId" TEXT,
    "operationId" TEXT,
    "requiredType" TEXT,
    "latestContent" TEXT,
    "latestVersion" INTEGER NOT NULL DEFAULT 1,
    "versions" JSONB,
    "orgProfileSnapshot" JSONB,
    "contextRulesSnapshot" JSONB,
    "publishedTheaEngineId" TEXT,
    "publishedAt" TIMESTAMPTZ,
    "publishedBy" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "draft_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_lifecycle_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "policyId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_lifecycle_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "documentId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "entityType" TEXT,
    "departmentId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "operation_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrity_activity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integrity_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sam_compliance_requirements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "standardId" UUID,
    "standardCode" TEXT,
    "category" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'NOT_MET',
    "dueDate" DATE,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "assignedTo" TEXT,
    "departmentId" TEXT,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sam_compliance_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sam_compliance_violations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "requirementId" UUID,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ,
    "resolvedBy" TEXT,
    "departmentId" TEXT,
    "assignedTo" TEXT,
    "correctiveActionId" UUID,
    "slaDeadline" TIMESTAMPTZ,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sam_compliance_violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sam_corrective_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "violationId" UUID,
    "findingId" UUID,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "description" TEXT,
    "actionType" TEXT NOT NULL DEFAULT 'CORRECTIVE',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assignedTo" TEXT,
    "departmentId" TEXT,
    "dueDate" DATE,
    "completedAt" TIMESTAMPTZ,
    "completedBy" TEXT,
    "verifiedAt" TIMESTAMPTZ,
    "verifiedBy" TEXT,
    "rootCause" TEXT,
    "actionTaken" TEXT,
    "effectiveness" TEXT,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sam_corrective_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sam_risk_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "description" TEXT,
    "riskCategory" TEXT,
    "likelihood" INTEGER NOT NULL DEFAULT 1,
    "impact" INTEGER NOT NULL DEFAULT 1,
    "riskScore" INTEGER NOT NULL DEFAULT 1,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "status" TEXT NOT NULL DEFAULT 'IDENTIFIED',
    "departmentId" TEXT,
    "assignedTo" TEXT,
    "mitigationPlan" TEXT,
    "residualRisk" INTEGER,
    "dueDate" DATE,
    "reviewDate" DATE,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sam_risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sam_risk_mitigations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "riskId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "description" TEXT,
    "strategy" TEXT NOT NULL DEFAULT 'MITIGATE',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "assignedTo" TEXT,
    "dueDate" DATE,
    "completedAt" TIMESTAMPTZ,
    "completedBy" TEXT,
    "effectivenessScore" INTEGER,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sam_risk_mitigations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sam_risk_follow_ups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "riskId" UUID NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMPTZ NOT NULL,
    "completedAt" TIMESTAMPTZ,
    "completedBy" TEXT,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sam_risk_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sam_standards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "framework" TEXT NOT NULL DEFAULT 'CBAHI',
    "chapter" TEXT,
    "section" TEXT,
    "version" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sam_standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sam_standard_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "standardId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
    "score" INTEGER,
    "assessedBy" TEXT,
    "assessedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "departmentId" TEXT,
    "gapAnalysis" TEXT,
    "actionPlan" TEXT,
    "nextReviewDate" DATE,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sam_standard_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sam_standard_evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "standardId" UUID NOT NULL,
    "assessmentId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "uploadedBy" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sam_standard_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sam_policy_acknowledgments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "policyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "userEmail" TEXT,
    "acknowledgedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER,
    "ipAddress" TEXT,
    "metadata" JSONB,

    CONSTRAINT "sam_policy_acknowledgments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sam_reminders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "recipientId" TEXT,
    "recipientEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMPTZ,
    "sentAt" TIMESTAMPTZ,
    "acknowledgedAt" TIMESTAMPTZ,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sam_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sam_evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "referenceId" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "fileUrl" TEXT,
    "storageKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "uploadedBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sam_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "resourceType" TEXT NOT NULL,
    "departmentKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "nameAr" TEXT,
    "nameEn" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resourceRef" JSONB,
    "resourceRefProviderId" UUID,
    "resourceRefKind" TEXT,
    "clinicId" TEXT,
    "specialtyCode" TEXT,
    "consultationServiceCode" TEXT,
    "level" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "scheduling_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_slots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "startAt" TIMESTAMPTZ NOT NULL,
    "endAt" TIMESTAMPTZ NOT NULL,
    "generationKey" TEXT,
    "templateId" UUID,
    "derivedFrom" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduling_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_reservations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "reservationId" UUID,
    "slotId" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "reservationType" TEXT NOT NULL,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "bookingId" UUID,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMPTZ,
    "idempotencyKey" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMPTZ,
    "cancelledByUserId" TEXT,
    "expiredAt" TIMESTAMPTZ,
    "expiredByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "scheduling_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "name" TEXT,
    "dayOfWeek" INTEGER,
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "startTime" TEXT,
    "endTime" TEXT,
    "slotDuration" INTEGER,
    "slotMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "rrule" TEXT,
    "effectiveFrom" TEXT,
    "effectiveTo" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "scheduling_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_availability_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "date" TEXT NOT NULL,
    "blocks" JSONB,
    "opens" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" UUID,

    CONSTRAINT "scheduling_availability_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "multi_resource_bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "appointmentId" UUID,
    "resources" JSONB NOT NULL,
    "startAt" TIMESTAMPTZ NOT NULL,
    "endAt" TIMESTAMPTZ NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "conflictDetails" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdByUserId" UUID,

    CONSTRAINT "multi_resource_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_waitlist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "patientName" TEXT NOT NULL,
    "desiredProviderId" UUID,
    "desiredClinic" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'ROUTINE',
    "dateRangeStart" TIMESTAMPTZ,
    "dateRangeEnd" TIMESTAMPTZ,
    "preferredTimes" JSONB,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "offeredSlotId" UUID,
    "offeredAt" TIMESTAMPTZ,
    "respondedAt" TIMESTAMPTZ,
    "position" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "scheduling_waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomy_sectors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "taxonomy_sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomy_scopes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "taxonomy_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomy_entity_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "taxonomy_entity_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomy_functions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "taxonomy_functions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomy_operations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "taxonomy_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomy_risk_domains" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "taxonomy_risk_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tele_consultations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "doctorId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMPTZ NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "type" TEXT NOT NULL DEFAULT 'VIDEO',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "chiefComplaint" TEXT,
    "notes" TEXT,
    "meetingUrl" TEXT,
    "meetingId" TEXT,
    "startedAt" TIMESTAMPTZ,
    "endedAt" TIMESTAMPTZ,
    "actualDuration" INTEGER,
    "prescription" JSONB,
    "followUpNeeded" BOOLEAN NOT NULL DEFAULT false,
    "followUpDate" TIMESTAMPTZ,
    "patientRating" INTEGER,
    "patientFeedback" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tele_consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tele_availability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "doctorId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotDuration" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tele_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tele_visits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "encounterId" UUID,
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMPTZ NOT NULL,
    "joinedByPatientAt" TIMESTAMPTZ,
    "joinedByDoctorAt" TIMESTAMPTZ,
    "endedAt" TIMESTAMPTZ,
    "duration" INTEGER,
    "roomId" TEXT,
    "recordingUrl" TEXT,
    "recordingConsent" BOOLEAN NOT NULL DEFAULT false,
    "connectionQuality" TEXT,
    "chatLog" JSONB,
    "sharedFiles" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tele_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tele_prescriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "teleVisitId" UUID NOT NULL,
    "encounterId" UUID,
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "medications" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "pharmacyId" UUID,
    "deliveryOption" TEXT,
    "deliveryAddress" TEXT,
    "deliveryStatus" TEXT,
    "wasfatyRef" TEXT,
    "sentToPatientAt" TIMESTAMPTZ,
    "dispensedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tele_prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rpm_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "deviceType" TEXT NOT NULL,
    "deviceName" TEXT,
    "manufacturer" TEXT,
    "serialNumber" TEXT,
    "integrationSource" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rpm_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rpm_readings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "deviceId" UUID,
    "readingType" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "unit" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ NOT NULL,
    "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
    "alertTriggered" BOOLEAN NOT NULL DEFAULT false,
    "alertAckedBy" UUID,
    "alertAckedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rpm_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rpm_thresholds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "readingType" TEXT NOT NULL,
    "lowCritical" DOUBLE PRECISION,
    "lowWarning" DOUBLE PRECISION,
    "highWarning" DOUBLE PRECISION,
    "highCritical" DOUBLE PRECISION,
    "diastolicLowCritical" DOUBLE PRECISION,
    "diastolicLowWarning" DOUBLE PRECISION,
    "diastolicHighWarning" DOUBLE PRECISION,
    "diastolicHighCritical" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "setByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rpm_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transplant_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "organType" TEXT NOT NULL,
    "transplantType" TEXT NOT NULL DEFAULT 'DECEASED_DONOR',
    "status" TEXT NOT NULL DEFAULT 'EVALUATION',
    "evaluationDate" TIMESTAMPTZ,
    "listingDate" TIMESTAMPTZ,
    "transplantDate" TIMESTAMPTZ,
    "donorId" UUID,
    "surgeonId" TEXT,
    "nephrologyId" TEXT,
    "crossmatchResult" TEXT,
    "pra" DOUBLE PRECISION,
    "hlaMatch" JSONB,
    "coldIschemiaTime" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transplant_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transplant_followups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "visitDate" TIMESTAMPTZ NOT NULL,
    "daysPostTransplant" INTEGER,
    "clinicianId" TEXT NOT NULL,
    "graftFunction" TEXT,
    "labs" JSONB,
    "medications" JSONB,
    "complications" TEXT,
    "biopsyDone" BOOLEAN NOT NULL DEFAULT false,
    "biopsyResult" TEXT,
    "plan" TEXT,
    "nextVisit" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transplant_followups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transplant_rejections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "onsetDate" TIMESTAMPTZ NOT NULL,
    "type" TEXT NOT NULL,
    "banffGrade" TEXT,
    "treatment" TEXT NOT NULL,
    "response" TEXT,
    "graftLoss" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transplant_rejections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transplant_waitlist_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "patientMasterId" UUID NOT NULL,
    "caseId" UUID,
    "organType" TEXT NOT NULL,
    "bloodType" TEXT NOT NULL,
    "urgencyStatus" TEXT NOT NULL DEFAULT 'ROUTINE',
    "medicalStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "listingDate" TIMESTAMPTZ NOT NULL,
    "evaluationComplete" BOOLEAN NOT NULL DEFAULT false,
    "primaryDiagnosis" TEXT NOT NULL,
    "icdCode" TEXT,
    "meldScore" INTEGER,
    "childPughScore" TEXT,
    "pra" DOUBLE PRECISION,
    "hlaTyping" JSONB,
    "crossmatchHistory" JSONB,
    "dialysisStartDate" TIMESTAMPTZ,
    "dialysisType" TEXT,
    "previousTransplants" INTEGER NOT NULL DEFAULT 0,
    "waitingDays" INTEGER NOT NULL DEFAULT 0,
    "priorityScore" DOUBLE PRECISION,
    "region" TEXT,
    "transplantCenter" TEXT,
    "statusHistory" JSONB,
    "notes" TEXT,
    "lastReviewDate" TIMESTAMPTZ,
    "nextReviewDate" TIMESTAMPTZ,
    "removedReason" TEXT,
    "removedDate" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transplant_waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_routing_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB,
    "conditionLogic" TEXT,
    "actions" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflow_routing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_escalation_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "trigger" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "levels" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflow_escalation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_escalation_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "trigger" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "patientId" UUID,
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "maxLevel" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'active',
    "escalatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMPTZ,
    "acknowledgedBy" TEXT,
    "resolvedAt" TIMESTAMPTZ,
    "notifications" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflow_escalation_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_pathways" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "category" TEXT,
    "tasks" JSONB,
    "totalDurationMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clinical_pathways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_pathway_instances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "pathwayId" UUID NOT NULL,
    "pathwayName" TEXT,
    "patientId" UUID,
    "encounterId" UUID,
    "startedAt" TIMESTAMPTZ,
    "startedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "tasks" JSONB,
    "compliance" INTEGER,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clinical_pathway_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admission_requests_tenantId_status_idx" ON "admission_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "admission_requests_tenantId_patientMasterId_idx" ON "admission_requests"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "admission_requests_tenantId_createdAt_idx" ON "admission_requests"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "admission_requests_tenantId_paymentType_idx" ON "admission_requests"("tenantId", "paymentType");

-- CreateIndex
CREATE INDEX "admission_checklists_tenantId_idx" ON "admission_checklists"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "admission_checklists_tenantId_admissionRequestId_key" ON "admission_checklists"("tenantId", "admissionRequestId");

-- CreateIndex
CREATE INDEX "bed_reservations_tenantId_admissionRequestId_idx" ON "bed_reservations"("tenantId", "admissionRequestId");

-- CreateIndex
CREATE INDEX "bed_reservations_tenantId_bedId_status_idx" ON "bed_reservations"("tenantId", "bedId", "status");

-- CreateIndex
CREATE INDEX "ward_transfer_requests_tenantId_episodeId_idx" ON "ward_transfer_requests"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "ward_transfer_requests_tenantId_status_idx" ON "ward_transfer_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ward_transfer_requests_tenantId_transferType_idx" ON "ward_transfer_requests"("tenantId", "transferType");

-- CreateIndex
CREATE INDEX "ward_transfer_requests_tenantId_urgency_idx" ON "ward_transfer_requests"("tenantId", "urgency");

-- CreateIndex
CREATE INDEX "admission_order_templates_tenantId_departmentKey_idx" ON "admission_order_templates"("tenantId", "departmentKey");

-- CreateIndex
CREATE INDEX "admission_order_templates_tenantId_isActive_idx" ON "admission_order_templates"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ai_config_tenantId_key_key" ON "ai_config"("tenantId", "key");

-- CreateIndex
CREATE INDEX "ai_audit_log_tenantId_idx" ON "ai_audit_log"("tenantId");

-- CreateIndex
CREATE INDEX "cds_alerts_tenantId_idx" ON "cds_alerts"("tenantId");

-- CreateIndex
CREATE INDEX "analytics_kpi_definitions_tenantId_idx" ON "analytics_kpi_definitions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_kpi_values_tenantId_kpiId_periodStart_key" ON "analytics_kpi_values"("tenantId", "kpiId", "periodStart");

-- CreateIndex
CREATE INDEX "infection_events_tenantId_idx" ON "infection_events"("tenantId");

-- CreateIndex
CREATE INDEX "infection_events_tenantId_status_idx" ON "infection_events"("tenantId", "status");

-- CreateIndex
CREATE INDEX "surveillance_alerts_tenantId_idx" ON "surveillance_alerts"("tenantId");

-- CreateIndex
CREATE INDEX "device_day_records_tenantId_idx" ON "device_day_records"("tenantId");

-- CreateIndex
CREATE INDEX "device_day_records_tenantId_recordDate_idx" ON "device_day_records"("tenantId", "recordDate");

-- CreateIndex
CREATE UNIQUE INDEX "device_day_records_tenantId_department_recordDate_key" ON "device_day_records"("tenantId", "department", "recordDate");

-- CreateIndex
CREATE INDEX "hand_hygiene_audits_tenantId_idx" ON "hand_hygiene_audits"("tenantId");

-- CreateIndex
CREATE INDEX "hand_hygiene_audits_tenantId_department_idx" ON "hand_hygiene_audits"("tenantId", "department");

-- CreateIndex
CREATE INDEX "hand_hygiene_audits_tenantId_auditDate_idx" ON "hand_hygiene_audits"("tenantId", "auditDate");

-- CreateIndex
CREATE INDEX "antibiotic_usage_tenantId_idx" ON "antibiotic_usage"("tenantId");

-- CreateIndex
CREATE INDEX "stewardship_alerts_tenantId_idx" ON "stewardship_alerts"("tenantId");

-- CreateIndex
CREATE INDEX "medication_errors_tenantId_idx" ON "medication_errors"("tenantId");

-- CreateIndex
CREATE INDEX "medication_errors_tenantId_status_idx" ON "medication_errors"("tenantId", "status");

-- CreateIndex
CREATE INDEX "medication_errors_tenantId_errorType_idx" ON "medication_errors"("tenantId", "errorType");

-- CreateIndex
CREATE INDEX "medication_errors_tenantId_severity_idx" ON "medication_errors"("tenantId", "severity");

-- CreateIndex
CREATE INDEX "isolation_precautions_tenantId_patientMasterId_idx" ON "isolation_precautions"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "isolation_precautions_tenantId_status_idx" ON "isolation_precautions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "isolation_precautions_tenantId_isolationType_idx" ON "isolation_precautions"("tenantId", "isolationType");

-- CreateIndex
CREATE INDEX "outbreak_events_tenantId_idx" ON "outbreak_events"("tenantId");

-- CreateIndex
CREATE INDEX "outbreak_events_tenantId_status_idx" ON "outbreak_events"("tenantId", "status");

-- CreateIndex
CREATE INDEX "charge_catalog_tenantId_status_idx" ON "charge_catalog"("tenantId", "status");

-- CreateIndex
CREATE INDEX "charge_catalog_tenantId_itemType_idx" ON "charge_catalog"("tenantId", "itemType");

-- CreateIndex
CREATE UNIQUE INDEX "charge_catalog_tenantId_code_key" ON "charge_catalog"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "charge_catalog_counters_tenantId_itemType_key" ON "charge_catalog_counters"("tenantId", "itemType");

-- CreateIndex
CREATE INDEX "charge_events_tenantId_encounterCoreId_status_idx" ON "charge_events"("tenantId", "encounterCoreId", "status");

-- CreateIndex
CREATE INDEX "charge_events_tenantId_idempotencyKey_idx" ON "charge_events"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "claims_tenantId_createdAt_idx" ON "claims"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "claims_tenantId_encounterCoreId_key" ON "claims"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "claim_events_tenantId_claimId_createdAt_idx" ON "claim_events"("tenantId", "claimId", "createdAt");

-- CreateIndex
CREATE INDEX "billing_payments_tenantId_encounterCoreId_idx" ON "billing_payments"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "billing_payments_tenantId_createdAt_idx" ON "billing_payments"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "billing_invoices_tenantId_encounterCoreId_idx" ON "billing_invoices"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "billing_invoices_tenantId_createdAt_idx" ON "billing_invoices"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoices_tenantId_invoiceNumber_key" ON "billing_invoices"("tenantId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "billing_payers_tenantId_status_idx" ON "billing_payers"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_payers_tenantId_code_key" ON "billing_payers"("tenantId", "code");

-- CreateIndex
CREATE INDEX "billing_plans_tenantId_payerId_idx" ON "billing_plans"("tenantId", "payerId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_plans_tenantId_payerId_planCode_key" ON "billing_plans"("tenantId", "payerId", "planCode");

-- CreateIndex
CREATE INDEX "billing_policy_rules_tenantId_payerId_idx" ON "billing_policy_rules"("tenantId", "payerId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_policy_rules_tenantId_ruleKey_key" ON "billing_policy_rules"("tenantId", "ruleKey");

-- CreateIndex
CREATE UNIQUE INDEX "billing_lock_tenantId_encounterCoreId_key" ON "billing_lock"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_posting_tenantId_encounterCoreId_key" ON "billing_posting"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "payer_context_tenantId_idempotencyKey_idx" ON "payer_context"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "payer_context_tenantId_encounterCoreId_key" ON "payer_context"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "medication_catalog_tenantId_genericName_idx" ON "medication_catalog"("tenantId", "genericName");

-- CreateIndex
CREATE UNIQUE INDEX "medication_catalog_tenantId_code_key" ON "medication_catalog"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "medication_catalog_tenantId_chargeCatalogId_key" ON "medication_catalog"("tenantId", "chargeCatalogId");

-- CreateIndex
CREATE INDEX "promo_codes_tenantId_isActive_idx" ON "promo_codes"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_tenantId_code_key" ON "promo_codes"("tenantId", "code");

-- CreateIndex
CREATE INDEX "nphies_eligibility_logs_tenantId_patientId_idx" ON "nphies_eligibility_logs"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "nphies_claims_tenantId_encounterId_idx" ON "nphies_claims"("tenantId", "encounterId");

-- CreateIndex
CREATE INDEX "nphies_claims_tenantId_patientId_idx" ON "nphies_claims"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "nphies_prior_auths_tenantId_patientId_idx" ON "nphies_prior_auths"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "nphies_prior_auths_tenantId_encounterId_idx" ON "nphies_prior_auths"("tenantId", "encounterId");

-- CreateIndex
CREATE INDEX "billing_credit_notes_tenantId_encounterCoreId_idx" ON "billing_credit_notes"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "billing_credit_notes_tenantId_status_idx" ON "billing_credit_notes"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_credit_notes_tenantId_creditNoteNumber_key" ON "billing_credit_notes"("tenantId", "creditNoteNumber");

-- CreateIndex
CREATE INDEX "order_payment_logs_tenantId_orderId_idx" ON "order_payment_logs"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "service_catalog_tenantId_serviceType_idx" ON "service_catalog"("tenantId", "serviceType");

-- CreateIndex
CREATE INDEX "service_catalog_tenantId_status_idx" ON "service_catalog"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "service_catalog_tenantId_code_key" ON "service_catalog"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "service_catalog_tenantId_nameLower_key" ON "service_catalog"("tenantId", "nameLower");

-- CreateIndex
CREATE UNIQUE INDEX "service_catalog_counters_tenantId_type_specialty_key" ON "service_catalog_counters"("tenantId", "type", "specialty");

-- CreateIndex
CREATE INDEX "service_usage_events_tenantId_serviceCatalogId_idx" ON "service_usage_events"("tenantId", "serviceCatalogId");

-- CreateIndex
CREATE INDEX "service_usage_events_tenantId_createdAt_idx" ON "service_usage_events"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "supplies_catalog_tenantId_status_idx" ON "supplies_catalog"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "supplies_catalog_tenantId_code_key" ON "supplies_catalog"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "supplies_catalog_tenantId_nameLower_key" ON "supplies_catalog"("tenantId", "nameLower");

-- CreateIndex
CREATE UNIQUE INDEX "supply_catalog_counters_tenantId_key" ON "supply_catalog_counters"("tenantId");

-- CreateIndex
CREATE INDEX "supply_usage_events_tenantId_supplyCatalogId_idx" ON "supply_usage_events"("tenantId", "supplyCatalogId");

-- CreateIndex
CREATE INDEX "supply_usage_events_tenantId_createdAt_idx" ON "supply_usage_events"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "diagnosis_catalog_tenantId_name_idx" ON "diagnosis_catalog"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "diagnosis_catalog_tenantId_code_key" ON "diagnosis_catalog"("tenantId", "code");

-- CreateIndex
CREATE INDEX "pricing_packages_tenantId_status_idx" ON "pricing_packages"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_packages_tenantId_code_key" ON "pricing_packages"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_packages_tenantId_nameLower_key" ON "pricing_packages"("tenantId", "nameLower");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_package_counters_tenantId_key" ON "pricing_package_counters"("tenantId");

-- CreateIndex
CREATE INDEX "pricing_package_applications_tenantId_encounterId_idx" ON "pricing_package_applications"("tenantId", "encounterId");

-- CreateIndex
CREATE INDEX "pricing_package_applications_tenantId_packageId_idx" ON "pricing_package_applications"("tenantId", "packageId");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_package_applications_tenantId_requestId_key" ON "pricing_package_applications"("tenantId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_usage_idempotency_tenantId_requestId_kind_key" ON "catalog_usage_idempotency"("tenantId", "requestId", "kind");

-- CreateIndex
CREATE INDEX "blood_bank_requests_tenantId_idx" ON "blood_bank_requests"("tenantId");

-- CreateIndex
CREATE INDEX "blood_bank_requests_tenantId_patientMasterId_idx" ON "blood_bank_requests"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "blood_bank_requests_tenantId_status_idx" ON "blood_bank_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "blood_units_tenantId_idx" ON "blood_units"("tenantId");

-- CreateIndex
CREATE INDEX "blood_units_tenantId_status_idx" ON "blood_units"("tenantId", "status");

-- CreateIndex
CREATE INDEX "blood_units_tenantId_bloodType_idx" ON "blood_units"("tenantId", "bloodType");

-- CreateIndex
CREATE INDEX "transfusions_tenantId_idx" ON "transfusions"("tenantId");

-- CreateIndex
CREATE INDEX "transfusions_tenantId_requestId_idx" ON "transfusions"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "transfusions_tenantId_patientMasterId_idx" ON "transfusions"("tenantId", "patientMasterId");

-- CreateIndex
CREATE UNIQUE INDEX "transfusion_reactions_transfusionId_key" ON "transfusion_reactions"("transfusionId");

-- CreateIndex
CREATE INDEX "transfusion_reactions_tenantId_transfusionId_idx" ON "transfusion_reactions"("tenantId", "transfusionId");

-- CreateIndex
CREATE INDEX "care_gaps_tenantId_idx" ON "care_gaps"("tenantId");

-- CreateIndex
CREATE INDEX "care_gaps_tenantId_patientMasterId_idx" ON "care_gaps"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "care_gaps_tenantId_status_idx" ON "care_gaps"("tenantId", "status");

-- CreateIndex
CREATE INDEX "care_gaps_tenantId_gapType_idx" ON "care_gaps"("tenantId", "gapType");

-- CreateIndex
CREATE INDEX "care_gaps_tenantId_priority_idx" ON "care_gaps"("tenantId", "priority");

-- CreateIndex
CREATE INDEX "care_gaps_tenantId_dueAt_idx" ON "care_gaps"("tenantId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "care_gaps_tenantId_sourceOrderId_key" ON "care_gaps"("tenantId", "sourceOrderId");

-- CreateIndex
CREATE INDEX "care_gap_outreach_logs_tenantId_careGapId_idx" ON "care_gap_outreach_logs"("tenantId", "careGapId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_care_paths_bedsideToken_key" ON "daily_care_paths"("bedsideToken");

-- CreateIndex
CREATE INDEX "daily_care_paths_tenantId_idx" ON "daily_care_paths"("tenantId");

-- CreateIndex
CREATE INDEX "daily_care_paths_tenantId_date_idx" ON "daily_care_paths"("tenantId", "date");

-- CreateIndex
CREATE INDEX "daily_care_paths_tenantId_date_departmentType_idx" ON "daily_care_paths"("tenantId", "date", "departmentType");

-- CreateIndex
CREATE INDEX "daily_care_paths_tenantId_patientMasterId_idx" ON "daily_care_paths"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "daily_care_paths_tenantId_status_idx" ON "daily_care_paths"("tenantId", "status");

-- CreateIndex
CREATE INDEX "daily_care_paths_bedsideToken_idx" ON "daily_care_paths"("bedsideToken");

-- CreateIndex
CREATE UNIQUE INDEX "daily_care_paths_tenantId_patientMasterId_date_departmentTy_key" ON "daily_care_paths"("tenantId", "patientMasterId", "date", "departmentType");

-- CreateIndex
CREATE INDEX "care_path_shifts_tenantId_carePathId_idx" ON "care_path_shifts"("tenantId", "carePathId");

-- CreateIndex
CREATE INDEX "care_path_shifts_tenantId_nurseUserId_idx" ON "care_path_shifts"("tenantId", "nurseUserId");

-- CreateIndex
CREATE INDEX "care_path_tasks_tenantId_carePathId_idx" ON "care_path_tasks"("tenantId", "carePathId");

-- CreateIndex
CREATE INDEX "care_path_tasks_tenantId_carePathId_status_idx" ON "care_path_tasks"("tenantId", "carePathId", "status");

-- CreateIndex
CREATE INDEX "care_path_tasks_tenantId_carePathId_category_idx" ON "care_path_tasks"("tenantId", "carePathId", "category");

-- CreateIndex
CREATE INDEX "care_path_tasks_tenantId_carePathId_scheduledTime_idx" ON "care_path_tasks"("tenantId", "carePathId", "scheduledTime");

-- CreateIndex
CREATE INDEX "care_path_tasks_tenantId_shiftId_idx" ON "care_path_tasks"("tenantId", "shiftId");

-- CreateIndex
CREATE INDEX "care_path_tasks_sourceOrderId_idx" ON "care_path_tasks"("sourceOrderId");

-- CreateIndex
CREATE INDEX "care_path_alerts_tenantId_carePathId_idx" ON "care_path_alerts"("tenantId", "carePathId");

-- CreateIndex
CREATE INDEX "care_path_alerts_tenantId_carePathId_acknowledged_idx" ON "care_path_alerts"("tenantId", "carePathId", "acknowledged");

-- CreateIndex
CREATE INDEX "opd_visit_notes_tenantId_idx" ON "opd_visit_notes"("tenantId");

-- CreateIndex
CREATE INDEX "opd_visit_notes_tenantId_encounterCoreId_idx" ON "opd_visit_notes"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "opd_visit_notes_tenantId_patientId_idx" ON "opd_visit_notes"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "physical_exams_tenantId_idx" ON "physical_exams"("tenantId");

-- CreateIndex
CREATE INDEX "physical_exams_tenantId_encounterCoreId_idx" ON "physical_exams"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "home_medications_tenantId_idx" ON "home_medications"("tenantId");

-- CreateIndex
CREATE INDEX "home_medications_tenantId_patientId_idx" ON "home_medications"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "death_declarations_tenantId_idx" ON "death_declarations"("tenantId");

-- CreateIndex
CREATE INDEX "death_declarations_tenantId_patientId_idx" ON "death_declarations"("tenantId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_tasks_idempotencyKey_key" ON "clinical_tasks"("idempotencyKey");

-- CreateIndex
CREATE INDEX "clinical_tasks_tenantId_idx" ON "clinical_tasks"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_tasks_tenantId_encounterCoreId_idx" ON "clinical_tasks"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "clinical_tasks_tenantId_status_idx" ON "clinical_tasks"("tenantId", "status");

-- CreateIndex
CREATE INDEX "clinical_task_events_tenantId_idx" ON "clinical_task_events"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_task_events_tenantId_taskId_idx" ON "clinical_task_events"("tenantId", "taskId");

-- CreateIndex
CREATE INDEX "clinical_notes_tenantId_encounterCoreId_idx" ON "clinical_notes"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "clinical_notes_tenantId_patientMasterId_idx" ON "clinical_notes"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "clinical_handover_tenantId_idx" ON "clinical_handover"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_handover_tenantId_encounterCoreId_idx" ON "clinical_handover"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "clinical_handover_tenantId_episodeId_idx" ON "clinical_handover"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "clinical_handover_tenantId_status_idx" ON "clinical_handover"("tenantId", "status");

-- CreateIndex
CREATE INDEX "clinical_consents_tenantId_patientId_idx" ON "clinical_consents"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "clinical_consents_tenantId_encounterId_idx" ON "clinical_consents"("tenantId", "encounterId");

-- CreateIndex
CREATE INDEX "clinical_events_tenantId_idx" ON "clinical_events"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_events_tenantId_status_idx" ON "clinical_events"("tenantId", "status");

-- CreateIndex
CREATE INDEX "consult_requests_tenantId_idx" ON "consult_requests"("tenantId");

-- CreateIndex
CREATE INDEX "consult_requests_tenantId_patientMasterId_idx" ON "consult_requests"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "consult_requests_tenantId_status_idx" ON "consult_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "consult_requests_tenantId_consultantId_idx" ON "consult_requests"("tenantId", "consultantId");

-- CreateIndex
CREATE UNIQUE INDEX "consult_responses_requestId_key" ON "consult_responses"("requestId");

-- CreateIndex
CREATE INDEX "consult_responses_tenantId_requestId_idx" ON "consult_responses"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "wound_assessments_tenantId_idx" ON "wound_assessments"("tenantId");

-- CreateIndex
CREATE INDEX "wound_assessments_tenantId_patientMasterId_idx" ON "wound_assessments"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "nutritional_assessments_tenantId_idx" ON "nutritional_assessments"("tenantId");

-- CreateIndex
CREATE INDEX "nutritional_assessments_tenantId_patientMasterId_idx" ON "nutritional_assessments"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "social_work_assessments_tenantId_idx" ON "social_work_assessments"("tenantId");

-- CreateIndex
CREATE INDEX "social_work_assessments_tenantId_patientMasterId_idx" ON "social_work_assessments"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "social_work_notes_tenantId_assessmentId_idx" ON "social_work_notes"("tenantId", "assessmentId");

-- CreateIndex
CREATE INDEX "patient_education_records_tenantId_idx" ON "patient_education_records"("tenantId");

-- CreateIndex
CREATE INDEX "patient_education_records_tenantId_patientMasterId_idx" ON "patient_education_records"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "infection_surveillance_tenantId_idx" ON "infection_surveillance"("tenantId");

-- CreateIndex
CREATE INDEX "infection_surveillance_tenantId_patientMasterId_idx" ON "infection_surveillance"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "infection_surveillance_tenantId_infectionType_idx" ON "infection_surveillance"("tenantId", "infectionType");

-- CreateIndex
CREATE INDEX "partograms_tenantId_idx" ON "partograms"("tenantId");

-- CreateIndex
CREATE INDEX "partograms_tenantId_patientMasterId_idx" ON "partograms"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "partogram_observations_tenantId_partogramId_idx" ON "partogram_observations"("tenantId", "partogramId");

-- CreateIndex
CREATE INDEX "dietary_orders_tenantId_idx" ON "dietary_orders"("tenantId");

-- CreateIndex
CREATE INDEX "dietary_orders_tenantId_patientId_idx" ON "dietary_orders"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "dietary_orders_tenantId_status_idx" ON "dietary_orders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "dietary_orders_tenantId_episodeId_idx" ON "dietary_orders"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "meal_services_tenantId_idx" ON "meal_services"("tenantId");

-- CreateIndex
CREATE INDEX "meal_services_tenantId_dietaryOrderId_idx" ON "meal_services"("tenantId", "dietaryOrderId");

-- CreateIndex
CREATE INDEX "meal_services_tenantId_patientId_idx" ON "meal_services"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "meal_services_tenantId_scheduledDate_idx" ON "meal_services"("tenantId", "scheduledDate");

-- CreateIndex
CREATE INDEX "meal_services_tenantId_status_idx" ON "meal_services"("tenantId", "status");

-- CreateIndex
CREATE INDEX "tpn_orders_tenantId_idx" ON "tpn_orders"("tenantId");

-- CreateIndex
CREATE INDEX "tpn_orders_tenantId_patientMasterId_idx" ON "tpn_orders"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "diet_catalog_items_tenantId_idx" ON "diet_catalog_items"("tenantId");

-- CreateIndex
CREATE INDEX "diet_catalog_items_tenantId_category_idx" ON "diet_catalog_items"("tenantId", "category");

-- CreateIndex
CREATE INDEX "calorie_intake_records_tenantId_idx" ON "calorie_intake_records"("tenantId");

-- CreateIndex
CREATE INDEX "calorie_intake_records_tenantId_patientMasterId_idx" ON "calorie_intake_records"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "calorie_intake_records_tenantId_patientMasterId_recordDate_idx" ON "calorie_intake_records"("tenantId", "patientMasterId", "recordDate");

-- CreateIndex
CREATE INDEX "transport_requests_tenantId_idx" ON "transport_requests"("tenantId");

-- CreateIndex
CREATE INDEX "transport_requests_tenantId_status_idx" ON "transport_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "transport_requests_tenantId_urgency_idx" ON "transport_requests"("tenantId", "urgency");

-- CreateIndex
CREATE INDEX "transport_requests_tenantId_assignedTo_idx" ON "transport_requests"("tenantId", "assignedTo");

-- CreateIndex
CREATE INDEX "transport_requests_tenantId_patientId_idx" ON "transport_requests"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "transport_staff_tenantId_idx" ON "transport_staff"("tenantId");

-- CreateIndex
CREATE INDEX "transport_staff_tenantId_status_idx" ON "transport_staff"("tenantId", "status");

-- CreateIndex
CREATE INDEX "transport_staff_tenantId_userId_idx" ON "transport_staff"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "formulary_drugs_tenantId_idx" ON "formulary_drugs"("tenantId");

-- CreateIndex
CREATE INDEX "formulary_drugs_tenantId_genericName_idx" ON "formulary_drugs"("tenantId", "genericName");

-- CreateIndex
CREATE INDEX "formulary_drugs_tenantId_atcCode_idx" ON "formulary_drugs"("tenantId", "atcCode");

-- CreateIndex
CREATE INDEX "formulary_drugs_tenantId_therapeuticClass_idx" ON "formulary_drugs"("tenantId", "therapeuticClass");

-- CreateIndex
CREATE INDEX "formulary_drugs_tenantId_formularyStatus_idx" ON "formulary_drugs"("tenantId", "formularyStatus");

-- CreateIndex
CREATE INDEX "formulary_drugs_tenantId_highAlert_idx" ON "formulary_drugs"("tenantId", "highAlert");

-- CreateIndex
CREATE INDEX "formulary_drugs_tenantId_controlled_idx" ON "formulary_drugs"("tenantId", "controlled");

-- CreateIndex
CREATE INDEX "formulary_restriction_requests_tenantId_idx" ON "formulary_restriction_requests"("tenantId");

-- CreateIndex
CREATE INDEX "formulary_restriction_requests_tenantId_status_idx" ON "formulary_restriction_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "formulary_restriction_requests_tenantId_drugId_idx" ON "formulary_restriction_requests"("tenantId", "drugId");

-- CreateIndex
CREATE INDEX "formulary_restriction_requests_tenantId_requestedBy_idx" ON "formulary_restriction_requests"("tenantId", "requestedBy");

-- CreateIndex
CREATE INDEX "icd10_codes_code_idx" ON "icd10_codes"("code");

-- CreateIndex
CREATE INDEX "icd10_codes_category_idx" ON "icd10_codes"("category");

-- CreateIndex
CREATE INDEX "icd10_codes_isCommon_idx" ON "icd10_codes"("isCommon");

-- CreateIndex
CREATE INDEX "icd10_codes_parentCode_idx" ON "icd10_codes"("parentCode");

-- CreateIndex
CREATE UNIQUE INDEX "icd10_codes_code_key" ON "icd10_codes"("code");

-- CreateIndex
CREATE INDEX "blood_gas_analyses_tenantId_idx" ON "blood_gas_analyses"("tenantId");

-- CreateIndex
CREATE INDEX "blood_gas_analyses_tenantId_patientId_idx" ON "blood_gas_analyses"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "blood_gas_analyses_tenantId_encounterId_idx" ON "blood_gas_analyses"("tenantId", "encounterId");

-- CreateIndex
CREATE INDEX "lis_connection_status_tenantId_idx" ON "lis_connection_status"("tenantId");

-- CreateIndex
CREATE INDEX "lis_connection_status_tenantId_status_idx" ON "lis_connection_status"("tenantId", "status");

-- CreateIndex
CREATE INDEX "radiology_peer_reviews_tenantId_idx" ON "radiology_peer_reviews"("tenantId");

-- CreateIndex
CREATE INDEX "radiology_peer_reviews_tenantId_reviewerId_idx" ON "radiology_peer_reviews"("tenantId", "reviewerId");

-- CreateIndex
CREATE INDEX "radiology_peer_reviews_tenantId_originalReaderId_idx" ON "radiology_peer_reviews"("tenantId", "originalReaderId");

-- CreateIndex
CREATE INDEX "radiology_prior_studies_tenantId_idx" ON "radiology_prior_studies"("tenantId");

-- CreateIndex
CREATE INDEX "radiology_prior_studies_tenantId_patientId_idx" ON "radiology_prior_studies"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "radiology_prior_studies_tenantId_currentStudyId_idx" ON "radiology_prior_studies"("tenantId", "currentStudyId");

-- CreateIndex
CREATE INDEX "kitchen_meal_plans_tenantId_idx" ON "kitchen_meal_plans"("tenantId");

-- CreateIndex
CREATE INDEX "kitchen_meal_plans_tenantId_date_idx" ON "kitchen_meal_plans"("tenantId", "date");

-- CreateIndex
CREATE INDEX "kitchen_meal_plans_tenantId_ward_idx" ON "kitchen_meal_plans"("tenantId", "ward");

-- CreateIndex
CREATE INDEX "kitchen_tray_cards_tenantId_idx" ON "kitchen_tray_cards"("tenantId");

-- CreateIndex
CREATE INDEX "kitchen_tray_cards_tenantId_mealPlanId_idx" ON "kitchen_tray_cards"("tenantId", "mealPlanId");

-- CreateIndex
CREATE INDEX "kitchen_tray_cards_tenantId_patientId_idx" ON "kitchen_tray_cards"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "iv_admixture_orders_tenantId_idx" ON "iv_admixture_orders"("tenantId");

-- CreateIndex
CREATE INDEX "iv_admixture_orders_tenantId_patientId_idx" ON "iv_admixture_orders"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "iv_admixture_orders_tenantId_status_idx" ON "iv_admixture_orders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "adc_cabinets_tenantId_idx" ON "adc_cabinets"("tenantId");

-- CreateIndex
CREATE INDEX "adc_transactions_tenantId_idx" ON "adc_transactions"("tenantId");

-- CreateIndex
CREATE INDEX "adc_transactions_tenantId_cabinetId_idx" ON "adc_transactions"("tenantId", "cabinetId");

-- CreateIndex
CREATE INDEX "adc_transactions_tenantId_drugName_idx" ON "adc_transactions"("tenantId", "drugName");

-- CreateIndex
CREATE INDEX "adc_transactions_tenantId_isOverride_idx" ON "adc_transactions"("tenantId", "isOverride");

-- CreateIndex
CREATE INDEX "adc_transactions_tenantId_discrepancy_idx" ON "adc_transactions"("tenantId", "discrepancy");

-- CreateIndex
CREATE INDEX "adc_inventory_tenantId_idx" ON "adc_inventory"("tenantId");

-- CreateIndex
CREATE INDEX "adc_inventory_tenantId_cabinetId_idx" ON "adc_inventory"("tenantId", "cabinetId");

-- CreateIndex
CREATE INDEX "adc_inventory_tenantId_needsRestock_idx" ON "adc_inventory"("tenantId", "needsRestock");

-- CreateIndex
CREATE INDEX "ctg_recordings_tenantId_idx" ON "ctg_recordings"("tenantId");

-- CreateIndex
CREATE INDEX "ctg_recordings_tenantId_patientId_idx" ON "ctg_recordings"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "speech_recognition_sessions_tenantId_idx" ON "speech_recognition_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "speech_recognition_sessions_tenantId_userId_idx" ON "speech_recognition_sessions"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "data_erasure_requests_tenantId_patientId_idx" ON "data_erasure_requests"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "data_erasure_requests_tenantId_status_idx" ON "data_erasure_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "data_breach_incidents_tenantId_status_idx" ON "data_breach_incidents"("tenantId", "status");

-- CreateIndex
CREATE INDEX "data_breach_incidents_tenantId_detectedAt_idx" ON "data_breach_incidents"("tenantId", "detectedAt");

-- CreateIndex
CREATE INDEX "medication_administrations_tenantId_idx" ON "medication_administrations"("tenantId");

-- CreateIndex
CREATE INDEX "medication_administrations_tenantId_encounterCoreId_idx" ON "medication_administrations"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "medication_administrations_tenantId_patientId_idx" ON "medication_administrations"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "medication_administrations_tenantId_status_idx" ON "medication_administrations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "nursing_assessments_tenantId_idx" ON "nursing_assessments"("tenantId");

-- CreateIndex
CREATE INDEX "nursing_assessments_tenantId_encounterCoreId_idx" ON "nursing_assessments"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "nursing_assessments_tenantId_patientId_idx" ON "nursing_assessments"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "nursing_assessments_tenantId_type_idx" ON "nursing_assessments"("tenantId", "type");

-- CreateIndex
CREATE INDEX "clinical_infra_providers_tenantId_idx" ON "clinical_infra_providers"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_infra_providers_tenantId_email_idx" ON "clinical_infra_providers"("tenantId", "email");

-- CreateIndex
CREATE INDEX "clinical_infra_providers_tenantId_shortCode_idx" ON "clinical_infra_providers"("tenantId", "shortCode");

-- CreateIndex
CREATE INDEX "clinical_infra_clinics_tenantId_idx" ON "clinical_infra_clinics"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_infra_clinics_tenantId_shortCode_key" ON "clinical_infra_clinics"("tenantId", "shortCode");

-- CreateIndex
CREATE INDEX "clinical_infra_specialties_tenantId_idx" ON "clinical_infra_specialties"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_infra_specialties_tenantId_code_key" ON "clinical_infra_specialties"("tenantId", "code");

-- CreateIndex
CREATE INDEX "clinical_infra_provider_profiles_tenantId_idx" ON "clinical_infra_provider_profiles"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_infra_provider_profiles_tenantId_providerId_key" ON "clinical_infra_provider_profiles"("tenantId", "providerId");

-- CreateIndex
CREATE INDEX "clinical_infra_provider_assignments_tenantId_idx" ON "clinical_infra_provider_assignments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_infra_provider_assignments_tenantId_providerId_key" ON "clinical_infra_provider_assignments"("tenantId", "providerId");

-- CreateIndex
CREATE INDEX "departments_tenantId_idx" ON "departments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenantId_code_key" ON "departments"("tenantId", "code");

-- CreateIndex
CREATE INDEX "clinical_infra_facilities_tenantId_idx" ON "clinical_infra_facilities"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_infra_facilities_tenantId_shortCode_key" ON "clinical_infra_facilities"("tenantId", "shortCode");

-- CreateIndex
CREATE INDEX "clinical_infra_floors_tenantId_idx" ON "clinical_infra_floors"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_infra_floors_tenantId_shortCode_key" ON "clinical_infra_floors"("tenantId", "shortCode");

-- CreateIndex
CREATE INDEX "clinical_infra_units_tenantId_idx" ON "clinical_infra_units"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_infra_units_tenantId_type_idx" ON "clinical_infra_units"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_infra_units_tenantId_shortCode_key" ON "clinical_infra_units"("tenantId", "shortCode");

-- CreateIndex
CREATE INDEX "clinical_infra_rooms_tenantId_idx" ON "clinical_infra_rooms"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_infra_rooms_tenantId_shortCode_key" ON "clinical_infra_rooms"("tenantId", "shortCode");

-- CreateIndex
CREATE INDEX "clinical_infra_beds_tenantId_idx" ON "clinical_infra_beds"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_infra_beds_tenantId_bedType_idx" ON "clinical_infra_beds"("tenantId", "bedType");

-- CreateIndex
CREATE INDEX "clinical_infra_provider_unit_scopes_tenantId_idx" ON "clinical_infra_provider_unit_scopes"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_infra_provider_unit_scopes_providerId_idx" ON "clinical_infra_provider_unit_scopes"("providerId");

-- CreateIndex
CREATE INDEX "clinical_infra_provider_room_assignments_tenantId_idx" ON "clinical_infra_provider_room_assignments"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_infra_provider_room_assignments_providerId_idx" ON "clinical_infra_provider_room_assignments"("providerId");

-- CreateIndex
CREATE INDEX "consumable_stores_tenantId_status_idx" ON "consumable_stores"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "consumable_stores_tenantId_code_key" ON "consumable_stores"("tenantId", "code");

-- CreateIndex
CREATE INDEX "consumable_store_items_tenantId_storeId_status_idx" ON "consumable_store_items"("tenantId", "storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "consumable_store_items_tenantId_storeId_supplyCatalogId_key" ON "consumable_store_items"("tenantId", "storeId", "supplyCatalogId");

-- CreateIndex
CREATE INDEX "consumable_stock_movements_tenantId_storeId_createdAt_idx" ON "consumable_stock_movements"("tenantId", "storeId", "createdAt");

-- CreateIndex
CREATE INDEX "consumable_stock_movements_tenantId_supplyCatalogId_created_idx" ON "consumable_stock_movements"("tenantId", "supplyCatalogId", "createdAt");

-- CreateIndex
CREATE INDEX "consumable_usage_events_tenantId_encounterCoreId_status_idx" ON "consumable_usage_events"("tenantId", "encounterCoreId", "status");

-- CreateIndex
CREATE INDEX "consumable_usage_events_tenantId_department_createdAt_idx" ON "consumable_usage_events"("tenantId", "department", "createdAt");

-- CreateIndex
CREATE INDEX "consumable_usage_events_tenantId_idempotencyKey_idx" ON "consumable_usage_events"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "consumable_usage_templates_tenantId_department_isActive_idx" ON "consumable_usage_templates"("tenantId", "department", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_tenantId_key" ON "tenants"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_settings_tenantId_idx" ON "tenant_settings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenantId_key_key" ON "tenant_settings"("tenantId", "key");

-- CreateIndex
CREATE INDEX "tenant_context_packs_tenantId_idx" ON "tenant_context_packs"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_context_overlays_tenantId_idx" ON "tenant_context_overlays"("tenantId");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_tenantId_key" ON "users"("email", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionId_key" ON "sessions"("sessionId");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_tenantId_idx" ON "sessions"("tenantId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "login_attempts_email_idx" ON "login_attempts"("email");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "role_definitions_tenantId_idx" ON "role_definitions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "role_definitions_tenantId_key_key" ON "role_definitions"("tenantId", "key");

-- CreateIndex
CREATE INDEX "org_groups_tenantId_idx" ON "org_groups"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "org_groups_tenantId_code_key" ON "org_groups"("tenantId", "code");

-- CreateIndex
CREATE INDEX "hospitals_tenantId_idx" ON "hospitals"("tenantId");

-- CreateIndex
CREATE INDEX "hospitals_groupId_idx" ON "hospitals"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_tenantId_code_key" ON "hospitals"("tenantId", "code");

-- CreateIndex
CREATE INDEX "subscription_contracts_tenantId_idx" ON "subscription_contracts"("tenantId");

-- CreateIndex
CREATE INDEX "subscription_contracts_status_idx" ON "subscription_contracts"("status");

-- CreateIndex
CREATE INDEX "tenant_users_tenantId_idx" ON "tenant_users"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_users_userId_idx" ON "tenant_users"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_tenantId_userId_key" ON "tenant_users"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "session_states_userId_key" ON "session_states"("userId");

-- CreateIndex
CREATE INDEX "session_states_userId_idx" ON "session_states"("userId");

-- CreateIndex
CREATE INDEX "patient_portal_sessions_tenantId_idx" ON "patient_portal_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "patient_portal_sessions_portalUserId_idx" ON "patient_portal_sessions"("portalUserId");

-- CreateIndex
CREATE INDEX "patient_portal_sessions_expiresAt_idx" ON "patient_portal_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "otp_tokens_mobile_idx" ON "otp_tokens"("mobile");

-- CreateIndex
CREATE INDEX "otp_tokens_expiresAt_idx" ON "otp_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "notifications_tenantId_idx" ON "notifications"("tenantId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_recipientUserId_idx" ON "notifications"("recipientUserId");

-- CreateIndex
CREATE INDEX "notifications_recipientType_idx" ON "notifications"("recipientType");

-- CreateIndex
CREATE INDEX "notifications_recipientDeptKey_idx" ON "notifications"("recipientDeptKey");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_kind_idx" ON "notifications"("kind");

-- CreateIndex
CREATE INDEX "notifications_severity_idx" ON "notifications"("severity");

-- CreateIndex
CREATE INDEX "notifications_scope_idx" ON "notifications"("scope");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_dedupeKey_idx" ON "notifications"("dedupeKey");

-- CreateIndex
CREATE INDEX "usage_quotas_tenantId_idx" ON "usage_quotas"("tenantId");

-- CreateIndex
CREATE INDEX "usage_quotas_tenantId_scopeType_scopeId_featureKey_idx" ON "usage_quotas"("tenantId", "scopeType", "scopeId", "featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "usage_quotas_tenantId_quotaType_key" ON "usage_quotas"("tenantId", "quotaType");

-- CreateIndex
CREATE UNIQUE INDEX "organization_profiles_tenantId_key" ON "organization_profiles"("tenantId");

-- CreateIndex
CREATE INDEX "organization_types_status_idx" ON "organization_types"("status");

-- CreateIndex
CREATE INDEX "organization_type_proposals_orgTypeId_idx" ON "organization_type_proposals"("orgTypeId");

-- CreateIndex
CREATE INDEX "organization_type_proposals_status_idx" ON "organization_type_proposals"("status");

-- CreateIndex
CREATE INDEX "approved_access_tokens_ownerId_idx" ON "approved_access_tokens"("ownerId");

-- CreateIndex
CREATE INDEX "approved_access_tokens_tenantId_idx" ON "approved_access_tokens"("tenantId");

-- CreateIndex
CREATE INDEX "approved_access_tokens_status_idx" ON "approved_access_tokens"("status");

-- CreateIndex
CREATE INDEX "approved_access_tokens_accessToken_idx" ON "approved_access_tokens"("accessToken");

-- CreateIndex
CREATE INDEX "approved_access_audit_logs_requestId_idx" ON "approved_access_audit_logs"("requestId");

-- CreateIndex
CREATE INDEX "approved_access_audit_logs_ownerId_idx" ON "approved_access_audit_logs"("ownerId");

-- CreateIndex
CREATE INDEX "approved_access_audit_logs_tenantId_idx" ON "approved_access_audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "approved_access_audit_logs_timestamp_idx" ON "approved_access_audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "break_the_glass_requests_tenantId_idx" ON "break_the_glass_requests"("tenantId");

-- CreateIndex
CREATE INDEX "break_the_glass_requests_tenantId_requesterId_idx" ON "break_the_glass_requests"("tenantId", "requesterId");

-- CreateIndex
CREATE INDEX "break_the_glass_requests_tenantId_patientId_idx" ON "break_the_glass_requests"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "break_the_glass_requests_tenantId_status_idx" ON "break_the_glass_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "staff_credentials_tenantId_idx" ON "staff_credentials"("tenantId");

-- CreateIndex
CREATE INDEX "staff_credentials_tenantId_userId_idx" ON "staff_credentials"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "staff_credentials_tenantId_status_idx" ON "staff_credentials"("tenantId", "status");

-- CreateIndex
CREATE INDEX "staff_credentials_tenantId_credentialType_idx" ON "staff_credentials"("tenantId", "credentialType");

-- CreateIndex
CREATE INDEX "staff_credentials_tenantId_expiryDate_idx" ON "staff_credentials"("tenantId", "expiryDate");

-- CreateIndex
CREATE INDEX "clinical_privileges_tenantId_idx" ON "clinical_privileges"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_privileges_tenantId_userId_idx" ON "clinical_privileges"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "clinical_privileges_tenantId_status_idx" ON "clinical_privileges"("tenantId", "status");

-- CreateIndex
CREATE INDEX "clinical_privileges_tenantId_privilegeType_idx" ON "clinical_privileges"("tenantId", "privilegeType");

-- CreateIndex
CREATE INDEX "credential_alerts_tenantId_idx" ON "credential_alerts"("tenantId");

-- CreateIndex
CREATE INDEX "credential_alerts_tenantId_userId_idx" ON "credential_alerts"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "credential_alerts_tenantId_isRead_idx" ON "credential_alerts"("tenantId", "isRead");

-- CreateIndex
CREATE INDEX "credential_alerts_tenantId_alertType_idx" ON "credential_alerts"("tenantId", "alertType");

-- CreateIndex
CREATE UNIQUE INDEX "integration_api_keys_keyHash_key" ON "integration_api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "integration_api_keys_keyHash_idx" ON "integration_api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "integration_api_keys_tenantId_type_idx" ON "integration_api_keys"("tenantId", "type");

-- CreateIndex
CREATE INDEX "cssd_trays_tenantId_idx" ON "cssd_trays"("tenantId");

-- CreateIndex
CREATE INDEX "cssd_trays_tenantId_department_idx" ON "cssd_trays"("tenantId", "department");

-- CreateIndex
CREATE INDEX "cssd_cycles_tenantId_idx" ON "cssd_cycles"("tenantId");

-- CreateIndex
CREATE INDEX "cssd_cycles_tenantId_trayId_idx" ON "cssd_cycles"("tenantId", "trayId");

-- CreateIndex
CREATE INDEX "cssd_cycles_tenantId_status_idx" ON "cssd_cycles"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cssd_dispatches_tenantId_idx" ON "cssd_dispatches"("tenantId");

-- CreateIndex
CREATE INDEX "cssd_dispatches_tenantId_cycleId_idx" ON "cssd_dispatches"("tenantId", "cycleId");

-- CreateIndex
CREATE INDEX "cssd_dispatches_tenantId_status_idx" ON "cssd_dispatches"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cssd_recalls_tenantId_idx" ON "cssd_recalls"("tenantId");

-- CreateIndex
CREATE INDEX "cssd_recalls_tenantId_cycleId_idx" ON "cssd_recalls"("tenantId", "cycleId");

-- CreateIndex
CREATE INDEX "cssd_recalls_tenantId_status_idx" ON "cssd_recalls"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_requests_tenantId_idx" ON "cvision_requests"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_requests_tenantId_status_idx" ON "cvision_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_requests_tenantId_requesterEmployeeId_idx" ON "cvision_requests"("tenantId", "requesterEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_requests_tenantId_requestNumber_key" ON "cvision_requests"("tenantId", "requestNumber");

-- CreateIndex
CREATE INDEX "cvision_request_events_tenantId_idx" ON "cvision_request_events"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_request_events_tenantId_requestId_idx" ON "cvision_request_events"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "cvision_notifications_tenantId_idx" ON "cvision_notifications"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_notifications_tenantId_userId_isRead_idx" ON "cvision_notifications"("tenantId", "userId", "isRead");

-- CreateIndex
CREATE INDEX "cvision_notification_preferences_tenantId_idx" ON "cvision_notification_preferences"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_notification_preferences_tenantId_userId_channel_key" ON "cvision_notification_preferences"("tenantId", "userId", "channel");

-- CreateIndex
CREATE INDEX "cvision_announcements_tenantId_idx" ON "cvision_announcements"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_letters_tenantId_idx" ON "cvision_letters"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_letters_tenantId_employeeId_idx" ON "cvision_letters"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_letter_templates_tenantId_idx" ON "cvision_letter_templates"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_policies_tenantId_idx" ON "cvision_policies"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_policy_acknowledgments_tenantId_idx" ON "cvision_policy_acknowledgments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_policy_acknowledgments_tenantId_policyId_employeeId_key" ON "cvision_policy_acknowledgments"("tenantId", "policyId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_workflows_tenantId_idx" ON "cvision_workflows"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_workflow_instances_tenantId_idx" ON "cvision_workflow_instances"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_workflow_instances_tenantId_workflowId_idx" ON "cvision_workflow_instances"("tenantId", "workflowId");

-- CreateIndex
CREATE INDEX "cvision_workflow_instances_tenantId_resourceType_resourceId_idx" ON "cvision_workflow_instances"("tenantId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "cvision_approval_matrix_tenantId_idx" ON "cvision_approval_matrix"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_delegations_tenantId_idx" ON "cvision_delegations"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_delegations_tenantId_delegateeEmployeeId_idx" ON "cvision_delegations"("tenantId", "delegateeEmployeeId");

-- CreateIndex
CREATE INDEX "cvision_audit_logs_tenantId_idx" ON "cvision_audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_audit_logs_tenantId_resourceType_resourceId_idx" ON "cvision_audit_logs"("tenantId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "cvision_audit_logs_tenantId_actorUserId_idx" ON "cvision_audit_logs"("tenantId", "actorUserId");

-- CreateIndex
CREATE INDEX "cvision_audit_logs_createdAt_idx" ON "cvision_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "cvision_auth_events_tenantId_idx" ON "cvision_auth_events"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_auth_events_tenantId_userId_idx" ON "cvision_auth_events"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_tenant_settings_tenantId_key" ON "cvision_tenant_settings"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_tenant_settings_tenantId_idx" ON "cvision_tenant_settings"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_sequences_tenantId_idx" ON "cvision_sequences"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_sequences_tenantId_entityType_key" ON "cvision_sequences"("tenantId", "entityType");

-- CreateIndex
CREATE INDEX "cvision_import_jobs_tenantId_idx" ON "cvision_import_jobs"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_deleted_records_tenantId_idx" ON "cvision_deleted_records"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_deleted_records_tenantId_resourceType_idx" ON "cvision_deleted_records"("tenantId", "resourceType");

-- CreateIndex
CREATE INDEX "cvision_saved_reports_tenantId_idx" ON "cvision_saved_reports"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_calendar_events_tenantId_idx" ON "cvision_calendar_events"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_calendar_events_tenantId_date_idx" ON "cvision_calendar_events"("tenantId", "date");

-- CreateIndex
CREATE INDEX "cvision_surveys_tenantId_idx" ON "cvision_surveys"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_survey_responses_tenantId_idx" ON "cvision_survey_responses"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_survey_responses_tenantId_surveyId_idx" ON "cvision_survey_responses"("tenantId", "surveyId");

-- CreateIndex
CREATE INDEX "cvision_recognitions_tenantId_idx" ON "cvision_recognitions"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_recognitions_tenantId_recipientEmployeeId_idx" ON "cvision_recognitions"("tenantId", "recipientEmployeeId");

-- CreateIndex
CREATE INDEX "cvision_reward_points_tenantId_idx" ON "cvision_reward_points"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_reward_points_tenantId_employeeId_idx" ON "cvision_reward_points"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_org_health_assessments_tenantId_idx" ON "cvision_org_health_assessments"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_org_designs_tenantId_idx" ON "cvision_org_designs"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_change_initiatives_tenantId_idx" ON "cvision_change_initiatives"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_culture_assessments_tenantId_idx" ON "cvision_culture_assessments"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_strategic_alignment_tenantId_idx" ON "cvision_strategic_alignment"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_teams_tenantId_idx" ON "cvision_teams"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_muqeem_records_tenantId_idx" ON "cvision_muqeem_records"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_muqeem_records_tenantId_employeeId_idx" ON "cvision_muqeem_records"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_muqeem_alerts_tenantId_idx" ON "cvision_muqeem_alerts"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_muqeem_alerts_tenantId_employeeId_idx" ON "cvision_muqeem_alerts"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_integration_configs_tenantId_idx" ON "cvision_integration_configs"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_integration_logs_tenantId_idx" ON "cvision_integration_logs"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_integration_logs_tenantId_configId_idx" ON "cvision_integration_logs"("tenantId", "configId");

-- CreateIndex
CREATE INDEX "cvision_retention_scores_tenantId_idx" ON "cvision_retention_scores"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_retention_scores_tenantId_employeeId_idx" ON "cvision_retention_scores"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_retention_alerts_tenantId_idx" ON "cvision_retention_alerts"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_retention_alerts_tenantId_employeeId_idx" ON "cvision_retention_alerts"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_dashboards_tenantId_idx" ON "cvision_dashboards"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_shifts_tenantId_idx" ON "cvision_shifts"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_shifts_tenantId_isActive_idx" ON "cvision_shifts"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_shifts_tenantId_code_key" ON "cvision_shifts"("tenantId", "code");

-- CreateIndex
CREATE INDEX "cvision_shift_templates_tenantId_idx" ON "cvision_shift_templates"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_shift_templates_tenantId_isActive_idx" ON "cvision_shift_templates"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "cvision_shift_assignments_tenantId_idx" ON "cvision_shift_assignments"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_shift_assignments_tenantId_employeeId_idx" ON "cvision_shift_assignments"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_shift_assignments_tenantId_date_idx" ON "cvision_shift_assignments"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_shift_assignments_tenantId_employeeId_date_key" ON "cvision_shift_assignments"("tenantId", "employeeId", "date");

-- CreateIndex
CREATE INDEX "cvision_attendance_tenantId_idx" ON "cvision_attendance"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_attendance_tenantId_employeeId_idx" ON "cvision_attendance"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_attendance_tenantId_date_idx" ON "cvision_attendance"("tenantId", "date");

-- CreateIndex
CREATE INDEX "cvision_attendance_tenantId_status_idx" ON "cvision_attendance"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_attendance_tenantId_employeeId_date_idx" ON "cvision_attendance"("tenantId", "employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_attendance_tenantId_employeeId_date_key" ON "cvision_attendance"("tenantId", "employeeId", "date");

-- CreateIndex
CREATE INDEX "cvision_attendance_corrections_tenantId_idx" ON "cvision_attendance_corrections"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_attendance_corrections_tenantId_employeeId_idx" ON "cvision_attendance_corrections"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_attendance_corrections_tenantId_attendanceId_idx" ON "cvision_attendance_corrections"("tenantId", "attendanceId");

-- CreateIndex
CREATE INDEX "cvision_attendance_corrections_tenantId_status_idx" ON "cvision_attendance_corrections"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_biometric_logs_tenantId_idx" ON "cvision_biometric_logs"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_biometric_logs_tenantId_employeeId_idx" ON "cvision_biometric_logs"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_biometric_logs_tenantId_punchTime_idx" ON "cvision_biometric_logs"("tenantId", "punchTime");

-- CreateIndex
CREATE INDEX "cvision_biometric_logs_tenantId_processed_idx" ON "cvision_biometric_logs"("tenantId", "processed");

-- CreateIndex
CREATE INDEX "cvision_schedule_entries_tenantId_idx" ON "cvision_schedule_entries"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_schedule_entries_tenantId_employeeId_idx" ON "cvision_schedule_entries"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_schedule_entries_tenantId_date_idx" ON "cvision_schedule_entries"("tenantId", "date");

-- CreateIndex
CREATE INDEX "cvision_schedule_entries_tenantId_employeeId_date_idx" ON "cvision_schedule_entries"("tenantId", "employeeId", "date");

-- CreateIndex
CREATE INDEX "cvision_schedule_approvals_tenantId_idx" ON "cvision_schedule_approvals"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_schedule_approvals_tenantId_departmentId_idx" ON "cvision_schedule_approvals"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "cvision_schedule_approvals_tenantId_status_idx" ON "cvision_schedule_approvals"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_schedule_approvals_tenantId_weekStartDate_idx" ON "cvision_schedule_approvals"("tenantId", "weekStartDate");

-- CreateIndex
CREATE INDEX "cvision_employee_shift_preferences_tenantId_idx" ON "cvision_employee_shift_preferences"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_employee_shift_preferences_tenantId_employeeId_idx" ON "cvision_employee_shift_preferences"("tenantId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_employee_shift_preferences_tenantId_employeeId_key" ON "cvision_employee_shift_preferences"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_department_work_schedules_tenantId_idx" ON "cvision_department_work_schedules"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_department_work_schedules_tenantId_isActive_idx" ON "cvision_department_work_schedules"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_department_work_schedules_tenantId_departmentId_key" ON "cvision_department_work_schedules"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "cvision_geofences_tenantId_idx" ON "cvision_geofences"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_geofences_tenantId_isActive_idx" ON "cvision_geofences"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "cvision_departments_tenantId_idx" ON "cvision_departments"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_departments_tenantId_isActive_idx" ON "cvision_departments"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "cvision_departments_parentId_idx" ON "cvision_departments"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_departments_tenantId_code_key" ON "cvision_departments"("tenantId", "code");

-- CreateIndex
CREATE INDEX "cvision_units_tenantId_idx" ON "cvision_units"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_units_tenantId_departmentId_idx" ON "cvision_units"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "cvision_units_tenantId_isActive_idx" ON "cvision_units"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_units_tenantId_code_key" ON "cvision_units"("tenantId", "code");

-- CreateIndex
CREATE INDEX "cvision_job_titles_tenantId_idx" ON "cvision_job_titles"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_job_titles_tenantId_departmentId_idx" ON "cvision_job_titles"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "cvision_job_titles_tenantId_isActive_idx" ON "cvision_job_titles"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_job_titles_tenantId_code_key" ON "cvision_job_titles"("tenantId", "code");

-- CreateIndex
CREATE INDEX "cvision_grades_tenantId_idx" ON "cvision_grades"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_grades_tenantId_isActive_idx" ON "cvision_grades"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_grades_tenantId_code_key" ON "cvision_grades"("tenantId", "code");

-- CreateIndex
CREATE INDEX "cvision_branches_tenantId_idx" ON "cvision_branches"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_branches_tenantId_isActive_idx" ON "cvision_branches"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_branches_tenantId_code_key" ON "cvision_branches"("tenantId", "code");

-- CreateIndex
CREATE INDEX "cvision_employees_tenantId_idx" ON "cvision_employees"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_employees_tenantId_status_idx" ON "cvision_employees"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_employees_tenantId_departmentId_idx" ON "cvision_employees"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "cvision_employees_tenantId_unitId_idx" ON "cvision_employees"("tenantId", "unitId");

-- CreateIndex
CREATE INDEX "cvision_employees_tenantId_managerEmployeeId_idx" ON "cvision_employees"("tenantId", "managerEmployeeId");

-- CreateIndex
CREATE INDEX "cvision_employees_tenantId_branchId_idx" ON "cvision_employees"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "cvision_employees_tenantId_isActive_idx" ON "cvision_employees"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "cvision_employees_userId_idx" ON "cvision_employees"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_employees_tenantId_employeeNo_key" ON "cvision_employees"("tenantId", "employeeNo");

-- CreateIndex
CREATE INDEX "cvision_employee_status_history_tenantId_idx" ON "cvision_employee_status_history"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_employee_status_history_tenantId_employeeId_idx" ON "cvision_employee_status_history"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_employee_status_history_employeeId_idx" ON "cvision_employee_status_history"("employeeId");

-- CreateIndex
CREATE INDEX "cvision_contracts_tenantId_idx" ON "cvision_contracts"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_contracts_tenantId_employeeId_idx" ON "cvision_contracts"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_contracts_tenantId_status_idx" ON "cvision_contracts"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_contracts_employeeId_idx" ON "cvision_contracts"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_contracts_tenantId_contractNo_key" ON "cvision_contracts"("tenantId", "contractNo");

-- CreateIndex
CREATE INDEX "cvision_budgeted_positions_tenantId_idx" ON "cvision_budgeted_positions"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_budgeted_positions_tenantId_departmentId_idx" ON "cvision_budgeted_positions"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "cvision_budgeted_positions_tenantId_isActive_idx" ON "cvision_budgeted_positions"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_budgeted_positions_tenantId_positionCode_key" ON "cvision_budgeted_positions"("tenantId", "positionCode");

-- CreateIndex
CREATE INDEX "cvision_position_slots_tenantId_idx" ON "cvision_position_slots"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_position_slots_tenantId_positionId_idx" ON "cvision_position_slots"("tenantId", "positionId");

-- CreateIndex
CREATE INDEX "cvision_position_slots_tenantId_status_idx" ON "cvision_position_slots"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_position_slots_employeeId_idx" ON "cvision_position_slots"("employeeId");

-- CreateIndex
CREATE INDEX "cvision_employee_documents_tenantId_idx" ON "cvision_employee_documents"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_employee_documents_tenantId_employeeId_idx" ON "cvision_employee_documents"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_employee_documents_employeeId_idx" ON "cvision_employee_documents"("employeeId");

-- CreateIndex
CREATE INDEX "cvision_employee_documents_tenantId_documentType_idx" ON "cvision_employee_documents"("tenantId", "documentType");

-- CreateIndex
CREATE INDEX "cvision_insurance_providers_tenantId_idx" ON "cvision_insurance_providers"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_insurance_providers_tenantId_isActive_idx" ON "cvision_insurance_providers"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "cvision_insurance_policies_tenantId_idx" ON "cvision_insurance_policies"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_insurance_policies_tenantId_providerId_idx" ON "cvision_insurance_policies"("tenantId", "providerId");

-- CreateIndex
CREATE INDEX "cvision_insurance_policies_tenantId_isActive_idx" ON "cvision_insurance_policies"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_insurance_policies_tenantId_policyNumber_key" ON "cvision_insurance_policies"("tenantId", "policyNumber");

-- CreateIndex
CREATE INDEX "cvision_employee_insurances_tenantId_idx" ON "cvision_employee_insurances"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_employee_insurances_tenantId_employeeId_idx" ON "cvision_employee_insurances"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_employee_insurances_tenantId_policyId_idx" ON "cvision_employee_insurances"("tenantId", "policyId");

-- CreateIndex
CREATE INDEX "cvision_employee_insurances_tenantId_status_idx" ON "cvision_employee_insurances"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_insurance_claims_tenantId_idx" ON "cvision_insurance_claims"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_insurance_claims_tenantId_employeeId_idx" ON "cvision_insurance_claims"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_insurance_claims_tenantId_status_idx" ON "cvision_insurance_claims"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_insurance_claims_tenantId_claimNumber_key" ON "cvision_insurance_claims"("tenantId", "claimNumber");

-- CreateIndex
CREATE INDEX "cvision_insurance_requests_tenantId_idx" ON "cvision_insurance_requests"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_insurance_requests_tenantId_employeeId_idx" ON "cvision_insurance_requests"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_insurance_requests_tenantId_status_idx" ON "cvision_insurance_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_travel_requests_tenantId_idx" ON "cvision_travel_requests"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_travel_requests_tenantId_employeeId_idx" ON "cvision_travel_requests"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_travel_requests_tenantId_status_idx" ON "cvision_travel_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_expense_claims_tenantId_idx" ON "cvision_expense_claims"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_expense_claims_tenantId_employeeId_idx" ON "cvision_expense_claims"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_expense_claims_tenantId_travelRequestId_idx" ON "cvision_expense_claims"("tenantId", "travelRequestId");

-- CreateIndex
CREATE INDEX "cvision_expense_claims_tenantId_status_idx" ON "cvision_expense_claims"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_assets_tenantId_idx" ON "cvision_assets"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_assets_tenantId_employeeId_idx" ON "cvision_assets"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_assets_tenantId_category_idx" ON "cvision_assets"("tenantId", "category");

-- CreateIndex
CREATE INDEX "cvision_assets_tenantId_status_idx" ON "cvision_assets"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_assets_tenantId_assetCode_key" ON "cvision_assets"("tenantId", "assetCode");

-- CreateIndex
CREATE INDEX "cvision_transport_routes_tenantId_idx" ON "cvision_transport_routes"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_transport_routes_tenantId_isActive_idx" ON "cvision_transport_routes"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "cvision_transport_vehicles_tenantId_idx" ON "cvision_transport_vehicles"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_transport_vehicles_tenantId_status_idx" ON "cvision_transport_vehicles"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_transport_vehicles_tenantId_routeId_idx" ON "cvision_transport_vehicles"("tenantId", "routeId");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_transport_vehicles_tenantId_plateNumber_key" ON "cvision_transport_vehicles"("tenantId", "plateNumber");

-- CreateIndex
CREATE INDEX "cvision_transport_assignments_tenantId_idx" ON "cvision_transport_assignments"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_transport_assignments_tenantId_employeeId_idx" ON "cvision_transport_assignments"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_transport_assignments_tenantId_routeId_idx" ON "cvision_transport_assignments"("tenantId", "routeId");

-- CreateIndex
CREATE INDEX "cvision_transport_assignments_tenantId_isActive_idx" ON "cvision_transport_assignments"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "cvision_transport_requests_tenantId_idx" ON "cvision_transport_requests"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_transport_requests_tenantId_employeeId_idx" ON "cvision_transport_requests"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_transport_requests_tenantId_status_idx" ON "cvision_transport_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_transport_trips_tenantId_idx" ON "cvision_transport_trips"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_transport_trips_tenantId_vehicleId_idx" ON "cvision_transport_trips"("tenantId", "vehicleId");

-- CreateIndex
CREATE INDEX "cvision_transport_trips_tenantId_date_idx" ON "cvision_transport_trips"("tenantId", "date");

-- CreateIndex
CREATE INDEX "cvision_transport_issues_tenantId_idx" ON "cvision_transport_issues"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_transport_issues_tenantId_vehicleId_idx" ON "cvision_transport_issues"("tenantId", "vehicleId");

-- CreateIndex
CREATE INDEX "cvision_transport_issues_tenantId_status_idx" ON "cvision_transport_issues"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_safety_incidents_tenantId_idx" ON "cvision_safety_incidents"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_safety_incidents_tenantId_reportedBy_idx" ON "cvision_safety_incidents"("tenantId", "reportedBy");

-- CreateIndex
CREATE INDEX "cvision_safety_incidents_tenantId_severity_idx" ON "cvision_safety_incidents"("tenantId", "severity");

-- CreateIndex
CREATE INDEX "cvision_safety_incidents_tenantId_status_idx" ON "cvision_safety_incidents"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_grievances_tenantId_idx" ON "cvision_grievances"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_grievances_tenantId_employeeId_idx" ON "cvision_grievances"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_grievances_tenantId_status_idx" ON "cvision_grievances"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_grievances_tenantId_severity_idx" ON "cvision_grievances"("tenantId", "severity");

-- CreateIndex
CREATE INDEX "cvision_leaves_tenantId_idx" ON "cvision_leaves"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_leaves_tenantId_employeeId_idx" ON "cvision_leaves"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_leaves_tenantId_status_idx" ON "cvision_leaves"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_leaves_tenantId_employeeId_status_idx" ON "cvision_leaves"("tenantId", "employeeId", "status");

-- CreateIndex
CREATE INDEX "cvision_leave_balances_tenantId_idx" ON "cvision_leave_balances"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_leave_balances_tenantId_employeeId_idx" ON "cvision_leave_balances"("tenantId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_leave_balances_tenantId_employeeId_leaveType_year_key" ON "cvision_leave_balances"("tenantId", "employeeId", "leaveType", "year");

-- CreateIndex
CREATE INDEX "cvision_payroll_profiles_tenantId_idx" ON "cvision_payroll_profiles"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_payroll_profiles_tenantId_isActive_idx" ON "cvision_payroll_profiles"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_payroll_profiles_tenantId_employeeId_key" ON "cvision_payroll_profiles"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_payroll_runs_tenantId_idx" ON "cvision_payroll_runs"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_payroll_runs_tenantId_status_idx" ON "cvision_payroll_runs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_payroll_runs_tenantId_period_idx" ON "cvision_payroll_runs"("tenantId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_payroll_runs_tenantId_period_key" ON "cvision_payroll_runs"("tenantId", "period");

-- CreateIndex
CREATE INDEX "cvision_payslips_tenantId_idx" ON "cvision_payslips"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_payslips_tenantId_runId_idx" ON "cvision_payslips"("tenantId", "runId");

-- CreateIndex
CREATE INDEX "cvision_payslips_tenantId_employeeId_idx" ON "cvision_payslips"("tenantId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_payslips_tenantId_runId_employeeId_key" ON "cvision_payslips"("tenantId", "runId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_payroll_exports_tenantId_idx" ON "cvision_payroll_exports"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_payroll_exports_tenantId_runId_idx" ON "cvision_payroll_exports"("tenantId", "runId");

-- CreateIndex
CREATE INDEX "cvision_payroll_dry_runs_tenantId_idx" ON "cvision_payroll_dry_runs"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_payroll_dry_runs_tenantId_period_idx" ON "cvision_payroll_dry_runs"("tenantId", "period");

-- CreateIndex
CREATE INDEX "cvision_loans_tenantId_idx" ON "cvision_loans"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_loans_tenantId_employeeId_idx" ON "cvision_loans"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_loans_tenantId_status_idx" ON "cvision_loans"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_loans_tenantId_loanNumber_key" ON "cvision_loans"("tenantId", "loanNumber");

-- CreateIndex
CREATE INDEX "cvision_loan_policies_tenantId_idx" ON "cvision_loan_policies"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_loan_policies_tenantId_isActive_idx" ON "cvision_loan_policies"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "cvision_salary_structures_tenantId_idx" ON "cvision_salary_structures"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_salary_structures_tenantId_gradeId_idx" ON "cvision_salary_structures"("tenantId", "gradeId");

-- CreateIndex
CREATE INDEX "cvision_salary_structures_tenantId_isActive_idx" ON "cvision_salary_structures"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "cvision_employee_compensations_tenantId_idx" ON "cvision_employee_compensations"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_employee_compensations_tenantId_employeeId_idx" ON "cvision_employee_compensations"("tenantId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_employee_compensations_tenantId_employeeId_effectiv_key" ON "cvision_employee_compensations"("tenantId", "employeeId", "effectiveDate");

-- CreateIndex
CREATE INDEX "cvision_journal_entries_tenantId_idx" ON "cvision_journal_entries"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_journal_entries_tenantId_runId_idx" ON "cvision_journal_entries"("tenantId", "runId");

-- CreateIndex
CREATE INDEX "cvision_journal_entries_tenantId_status_idx" ON "cvision_journal_entries"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_journal_entries_tenantId_entryDate_idx" ON "cvision_journal_entries"("tenantId", "entryDate");

-- CreateIndex
CREATE INDEX "cvision_gl_mappings_tenantId_idx" ON "cvision_gl_mappings"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_gl_mappings_tenantId_isActive_idx" ON "cvision_gl_mappings"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_gl_mappings_tenantId_componentType_key" ON "cvision_gl_mappings"("tenantId", "componentType");

-- CreateIndex
CREATE INDEX "cvision_department_budgets_tenantId_idx" ON "cvision_department_budgets"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_department_budgets_tenantId_departmentId_idx" ON "cvision_department_budgets"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "cvision_department_budgets_tenantId_fiscalYear_idx" ON "cvision_department_budgets"("tenantId", "fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_department_budgets_tenantId_departmentId_fiscalYear_key" ON "cvision_department_budgets"("tenantId", "departmentId", "fiscalYear");

-- CreateIndex
CREATE INDEX "cvision_headcount_budgets_tenantId_idx" ON "cvision_headcount_budgets"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_headcount_budgets_tenantId_departmentId_idx" ON "cvision_headcount_budgets"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "cvision_headcount_budgets_tenantId_fiscalYear_idx" ON "cvision_headcount_budgets"("tenantId", "fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_headcount_budgets_tenantId_departmentId_fiscalYear_key" ON "cvision_headcount_budgets"("tenantId", "departmentId", "fiscalYear");

-- CreateIndex
CREATE INDEX "cvision_performance_reviews_tenantId_idx" ON "cvision_performance_reviews"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_performance_reviews_tenantId_employeeId_idx" ON "cvision_performance_reviews"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_performance_reviews_tenantId_reviewCycleId_idx" ON "cvision_performance_reviews"("tenantId", "reviewCycleId");

-- CreateIndex
CREATE INDEX "cvision_performance_reviews_tenantId_status_idx" ON "cvision_performance_reviews"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_review_cycles_tenantId_idx" ON "cvision_review_cycles"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_review_cycles_tenantId_isActive_idx" ON "cvision_review_cycles"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "cvision_review_cycles_tenantId_status_idx" ON "cvision_review_cycles"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_okrs_tenantId_idx" ON "cvision_okrs"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_okrs_tenantId_employeeId_idx" ON "cvision_okrs"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_okrs_tenantId_departmentId_idx" ON "cvision_okrs"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "cvision_okrs_tenantId_status_idx" ON "cvision_okrs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_okrs_tenantId_period_idx" ON "cvision_okrs"("tenantId", "period");

-- CreateIndex
CREATE INDEX "cvision_kpis_tenantId_idx" ON "cvision_kpis"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_kpis_tenantId_isActive_idx" ON "cvision_kpis"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "cvision_kpis_tenantId_category_idx" ON "cvision_kpis"("tenantId", "category");

-- CreateIndex
CREATE INDEX "cvision_kpis_tenantId_departmentId_idx" ON "cvision_kpis"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "cvision_disciplinary_actions_tenantId_idx" ON "cvision_disciplinary_actions"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_disciplinary_actions_tenantId_employeeId_idx" ON "cvision_disciplinary_actions"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_disciplinary_actions_tenantId_type_idx" ON "cvision_disciplinary_actions"("tenantId", "type");

-- CreateIndex
CREATE INDEX "cvision_disciplinary_actions_tenantId_status_idx" ON "cvision_disciplinary_actions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_promotions_tenantId_idx" ON "cvision_promotions"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_promotions_tenantId_employeeId_idx" ON "cvision_promotions"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_promotions_tenantId_status_idx" ON "cvision_promotions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_training_courses_tenantId_idx" ON "cvision_training_courses"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_training_courses_tenantId_isActive_idx" ON "cvision_training_courses"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "cvision_training_courses_tenantId_category_idx" ON "cvision_training_courses"("tenantId", "category");

-- CreateIndex
CREATE INDEX "cvision_training_enrollments_tenantId_idx" ON "cvision_training_enrollments"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_training_enrollments_tenantId_employeeId_idx" ON "cvision_training_enrollments"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_training_enrollments_tenantId_courseId_idx" ON "cvision_training_enrollments"("tenantId", "courseId");

-- CreateIndex
CREATE INDEX "cvision_training_enrollments_tenantId_status_idx" ON "cvision_training_enrollments"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_training_budgets_tenantId_idx" ON "cvision_training_budgets"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_training_budgets_tenantId_departmentId_idx" ON "cvision_training_budgets"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "cvision_training_budgets_tenantId_fiscalYear_idx" ON "cvision_training_budgets"("tenantId", "fiscalYear");

-- CreateIndex
CREATE INDEX "cvision_succession_plans_tenantId_idx" ON "cvision_succession_plans"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_succession_plans_tenantId_positionId_idx" ON "cvision_succession_plans"("tenantId", "positionId");

-- CreateIndex
CREATE INDEX "cvision_succession_plans_tenantId_status_idx" ON "cvision_succession_plans"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_employee_onboardings_tenantId_idx" ON "cvision_employee_onboardings"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_employee_onboardings_tenantId_employeeId_idx" ON "cvision_employee_onboardings"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_employee_onboardings_tenantId_status_idx" ON "cvision_employee_onboardings"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_onboarding_templates_tenantId_idx" ON "cvision_onboarding_templates"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_onboarding_templates_tenantId_isActive_idx" ON "cvision_onboarding_templates"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "cvision_onboarding_templates_tenantId_departmentId_idx" ON "cvision_onboarding_templates"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "cvision_offboardings_tenantId_idx" ON "cvision_offboardings"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_offboardings_tenantId_employeeId_idx" ON "cvision_offboardings"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cvision_offboardings_tenantId_status_idx" ON "cvision_offboardings"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_employee_profile_sections_tenantId_idx" ON "cvision_employee_profile_sections"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_employee_profile_sections_tenantId_employeeId_idx" ON "cvision_employee_profile_sections"("tenantId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_employee_profile_sections_tenantId_employeeId_secti_key" ON "cvision_employee_profile_sections"("tenantId", "employeeId", "sectionKey");

-- CreateIndex
CREATE INDEX "cv_profile_hist_tenant_idx" ON "cvision_employee_profile_section_history"("tenantId");

-- CreateIndex
CREATE INDEX "cv_profile_hist_tenant_emp_idx" ON "cvision_employee_profile_section_history"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "cv_profile_hist_tenant_emp_sec_idx" ON "cvision_employee_profile_section_history"("tenantId", "employeeId", "sectionKey");

-- CreateIndex
CREATE INDEX "cvision_profile_section_schemas_tenantId_idx" ON "cvision_profile_section_schemas"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_profile_section_schemas_tenantId_sectionKey_idx" ON "cvision_profile_section_schemas"("tenantId", "sectionKey");

-- CreateIndex
CREATE INDEX "cvision_profile_section_schemas_tenantId_isActive_idx" ON "cvision_profile_section_schemas"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_profile_section_schemas_tenantId_sectionKey_version_key" ON "cvision_profile_section_schemas"("tenantId", "sectionKey", "version");

-- CreateIndex
CREATE INDEX "cvision_job_requisitions_tenantId_idx" ON "cvision_job_requisitions"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_job_requisitions_tenantId_status_idx" ON "cvision_job_requisitions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_job_requisitions_tenantId_departmentId_idx" ON "cvision_job_requisitions"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "cvision_job_requisitions_tenantId_positionId_idx" ON "cvision_job_requisitions"("tenantId", "positionId");

-- CreateIndex
CREATE INDEX "cvision_job_requisitions_tenantId_isArchived_idx" ON "cvision_job_requisitions"("tenantId", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "cvision_job_requisitions_tenantId_requisitionNumber_key" ON "cvision_job_requisitions"("tenantId", "requisitionNumber");

-- CreateIndex
CREATE INDEX "cvision_candidates_tenantId_idx" ON "cvision_candidates"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_candidates_tenantId_requisitionId_idx" ON "cvision_candidates"("tenantId", "requisitionId");

-- CreateIndex
CREATE INDEX "cvision_candidates_tenantId_status_idx" ON "cvision_candidates"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_candidates_tenantId_email_idx" ON "cvision_candidates"("tenantId", "email");

-- CreateIndex
CREATE INDEX "cvision_candidates_tenantId_source_idx" ON "cvision_candidates"("tenantId", "source");

-- CreateIndex
CREATE INDEX "cvision_candidates_tenantId_isArchived_idx" ON "cvision_candidates"("tenantId", "isArchived");

-- CreateIndex
CREATE INDEX "cvision_candidates_employeeId_idx" ON "cvision_candidates"("employeeId");

-- CreateIndex
CREATE INDEX "cvision_candidate_documents_tenantId_idx" ON "cvision_candidate_documents"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_candidate_documents_tenantId_candidateId_idx" ON "cvision_candidate_documents"("tenantId", "candidateId");

-- CreateIndex
CREATE INDEX "cvision_candidate_documents_candidateId_idx" ON "cvision_candidate_documents"("candidateId");

-- CreateIndex
CREATE INDEX "cvision_candidate_documents_tenantId_kind_idx" ON "cvision_candidate_documents"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "cvision_interviews_tenantId_idx" ON "cvision_interviews"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_interviews_tenantId_candidateId_idx" ON "cvision_interviews"("tenantId", "candidateId");

-- CreateIndex
CREATE INDEX "cvision_interviews_tenantId_requisitionId_idx" ON "cvision_interviews"("tenantId", "requisitionId");

-- CreateIndex
CREATE INDEX "cvision_interviews_tenantId_status_idx" ON "cvision_interviews"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_interviews_tenantId_scheduledDate_idx" ON "cvision_interviews"("tenantId", "scheduledDate");

-- CreateIndex
CREATE INDEX "cvision_interviews_candidateId_idx" ON "cvision_interviews"("candidateId");

-- CreateIndex
CREATE INDEX "cvision_interview_sessions_tenantId_idx" ON "cvision_interview_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_interview_sessions_tenantId_interviewId_idx" ON "cvision_interview_sessions"("tenantId", "interviewId");

-- CreateIndex
CREATE INDEX "cvision_interview_sessions_interviewId_idx" ON "cvision_interview_sessions"("interviewId");

-- CreateIndex
CREATE INDEX "cvision_job_postings_tenantId_idx" ON "cvision_job_postings"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_job_postings_tenantId_requisitionId_idx" ON "cvision_job_postings"("tenantId", "requisitionId");

-- CreateIndex
CREATE INDEX "cvision_job_postings_tenantId_status_idx" ON "cvision_job_postings"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_job_postings_tenantId_isActive_idx" ON "cvision_job_postings"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "cvision_applications_tenantId_idx" ON "cvision_applications"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_applications_tenantId_postingId_idx" ON "cvision_applications"("tenantId", "postingId");

-- CreateIndex
CREATE INDEX "cvision_applications_tenantId_candidateId_idx" ON "cvision_applications"("tenantId", "candidateId");

-- CreateIndex
CREATE INDEX "cvision_applications_tenantId_status_idx" ON "cvision_applications"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_applications_tenantId_email_idx" ON "cvision_applications"("tenantId", "email");

-- CreateIndex
CREATE INDEX "cvision_cv_parse_jobs_tenantId_idx" ON "cvision_cv_parse_jobs"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_cv_parse_jobs_tenantId_candidateId_idx" ON "cvision_cv_parse_jobs"("tenantId", "candidateId");

-- CreateIndex
CREATE INDEX "cvision_cv_parse_jobs_tenantId_documentId_idx" ON "cvision_cv_parse_jobs"("tenantId", "documentId");

-- CreateIndex
CREATE INDEX "cvision_cv_parse_jobs_tenantId_status_idx" ON "cvision_cv_parse_jobs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_cv_inbox_batches_tenantId_idx" ON "cvision_cv_inbox_batches"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_cv_inbox_batches_tenantId_createdByUserId_idx" ON "cvision_cv_inbox_batches"("tenantId", "createdByUserId");

-- CreateIndex
CREATE INDEX "cvision_cv_inbox_batches_tenantId_isArchived_idx" ON "cvision_cv_inbox_batches"("tenantId", "isArchived");

-- CreateIndex
CREATE INDEX "cvision_cv_inbox_items_tenantId_idx" ON "cvision_cv_inbox_items"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_cv_inbox_items_tenantId_batchId_idx" ON "cvision_cv_inbox_items"("tenantId", "batchId");

-- CreateIndex
CREATE INDEX "cvision_cv_inbox_items_tenantId_status_idx" ON "cvision_cv_inbox_items"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cvision_cv_inbox_items_tenantId_assignedRequisitionId_idx" ON "cvision_cv_inbox_items"("tenantId", "assignedRequisitionId");

-- CreateIndex
CREATE INDEX "cvision_talent_pool_tenantId_idx" ON "cvision_talent_pool"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_talent_pool_tenantId_candidateId_idx" ON "cvision_talent_pool"("tenantId", "candidateId");

-- CreateIndex
CREATE INDEX "cvision_talent_pool_tenantId_category_idx" ON "cvision_talent_pool"("tenantId", "category");

-- CreateIndex
CREATE INDEX "cvision_talent_pool_tenantId_isActive_idx" ON "cvision_talent_pool"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "cvision_killout_questions_tenantId_idx" ON "cvision_killout_questions"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_killout_questions_tenantId_requisitionId_idx" ON "cvision_killout_questions"("tenantId", "requisitionId");

-- CreateIndex
CREATE INDEX "cvision_killout_questions_tenantId_isActive_idx" ON "cvision_killout_questions"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "cvision_candidate_rankings_tenantId_idx" ON "cvision_candidate_rankings"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_candidate_rankings_tenantId_candidateId_idx" ON "cvision_candidate_rankings"("tenantId", "candidateId");

-- CreateIndex
CREATE INDEX "cvision_candidate_rankings_tenantId_requisitionId_idx" ON "cvision_candidate_rankings"("tenantId", "requisitionId");

-- CreateIndex
CREATE INDEX "cvision_candidate_rankings_tenantId_overallScore_idx" ON "cvision_candidate_rankings"("tenantId", "overallScore");

-- CreateIndex
CREATE INDEX "cvision_manpower_plans_tenantId_idx" ON "cvision_manpower_plans"("tenantId");

-- CreateIndex
CREATE INDEX "cvision_manpower_plans_tenantId_departmentId_idx" ON "cvision_manpower_plans"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "cvision_manpower_plans_tenantId_positionId_idx" ON "cvision_manpower_plans"("tenantId", "positionId");

-- CreateIndex
CREATE INDEX "cvision_manpower_plans_tenantId_effectiveFrom_idx" ON "cvision_manpower_plans"("tenantId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "discharge_summary_tenantId_encounterCoreId_idx" ON "discharge_summary"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "discharge_prescriptions_tenantId_encounterId_idx" ON "discharge_prescriptions"("tenantId", "encounterId");

-- CreateIndex
CREATE INDEX "med_reconciliations_tenantId_encounterId_idx" ON "med_reconciliations"("tenantId", "encounterId");

-- CreateIndex
CREATE UNIQUE INDEX "enhanced_discharge_summaries_episodeId_key" ON "enhanced_discharge_summaries"("episodeId");

-- CreateIndex
CREATE INDEX "enhanced_discharge_summaries_tenantId_episodeId_idx" ON "enhanced_discharge_summaries"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "enhanced_discharge_summaries_tenantId_patientMasterId_idx" ON "enhanced_discharge_summaries"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "ehr_patients_tenantId_idx" ON "ehr_patients"("tenantId");

-- CreateIndex
CREATE INDEX "ehr_patients_tenantId_mrn_idx" ON "ehr_patients"("tenantId", "mrn");

-- CreateIndex
CREATE INDEX "ehr_patients_tenantId_isActive_idx" ON "ehr_patients"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "ehr_privileges_tenantId_idx" ON "ehr_privileges"("tenantId");

-- CreateIndex
CREATE INDEX "ehr_privileges_tenantId_userId_idx" ON "ehr_privileges"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "ehr_encounters_tenantId_idx" ON "ehr_encounters"("tenantId");

-- CreateIndex
CREATE INDEX "ehr_encounters_tenantId_status_idx" ON "ehr_encounters"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ehr_orders_tenantId_idx" ON "ehr_orders"("tenantId");

-- CreateIndex
CREATE INDEX "ehr_orders_tenantId_status_idx" ON "ehr_orders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ehr_notes_tenantId_idx" ON "ehr_notes"("tenantId");

-- CreateIndex
CREATE INDEX "ehr_notes_tenantId_patientId_idx" ON "ehr_notes"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "ehr_tasks_tenantId_idx" ON "ehr_tasks"("tenantId");

-- CreateIndex
CREATE INDEX "ehr_tasks_tenantId_status_idx" ON "ehr_tasks"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ehr_audit_logs_tenantId_idx" ON "ehr_audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "ehr_audit_logs_tenantId_userId_idx" ON "ehr_audit_logs"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ehr_users_tenantId_userId_key" ON "ehr_users"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "encounter_core_tenantId_idx" ON "encounter_core"("tenantId");

-- CreateIndex
CREATE INDEX "encounter_core_patientId_idx" ON "encounter_core"("patientId");

-- CreateIndex
CREATE INDEX "encounter_core_encounterType_idx" ON "encounter_core"("encounterType");

-- CreateIndex
CREATE INDEX "encounter_core_status_idx" ON "encounter_core"("status");

-- CreateIndex
CREATE INDEX "encounter_core_tenantId_status_idx" ON "encounter_core"("tenantId", "status");

-- CreateIndex
CREATE INDEX "equipment_tenantId_idx" ON "equipment"("tenantId");

-- CreateIndex
CREATE INDEX "equipment_tenantId_status_idx" ON "equipment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "equipment_tenantId_category_idx" ON "equipment"("tenantId", "category");

-- CreateIndex
CREATE INDEX "equipment_maintenance_tenantId_equipmentId_idx" ON "equipment_maintenance"("tenantId", "equipmentId");

-- CreateIndex
CREATE INDEX "equipment_issues_tenantId_equipmentId_idx" ON "equipment_issues"("tenantId", "equipmentId");

-- CreateIndex
CREATE INDEX "equipment_issues_tenantId_status_idx" ON "equipment_issues"("tenantId", "status");

-- CreateIndex
CREATE INDEX "er_patients_tenantId_idx" ON "er_patients"("tenantId");

-- CreateIndex
CREATE INDEX "er_patients_tenantId_patientMasterId_idx" ON "er_patients"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "er_patients_tenantId_tempMrn_idx" ON "er_patients"("tenantId", "tempMrn");

-- CreateIndex
CREATE UNIQUE INDEX "er_encounters_encounterCoreId_key" ON "er_encounters"("encounterCoreId");

-- CreateIndex
CREATE INDEX "er_encounters_tenantId_idx" ON "er_encounters"("tenantId");

-- CreateIndex
CREATE INDEX "er_encounters_patientId_idx" ON "er_encounters"("patientId");

-- CreateIndex
CREATE INDEX "er_encounters_status_idx" ON "er_encounters"("status");

-- CreateIndex
CREATE INDEX "er_encounters_tenantId_status_idx" ON "er_encounters"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "er_encounters_tenantId_visitNumber_key" ON "er_encounters"("tenantId", "visitNumber");

-- CreateIndex
CREATE UNIQUE INDEX "er_triage_assessments_encounterId_key" ON "er_triage_assessments"("encounterId");

-- CreateIndex
CREATE INDEX "er_triage_assessments_encounterId_idx" ON "er_triage_assessments"("encounterId");

-- CreateIndex
CREATE INDEX "er_beds_tenantId_idx" ON "er_beds"("tenantId");

-- CreateIndex
CREATE INDEX "er_beds_zone_idx" ON "er_beds"("zone");

-- CreateIndex
CREATE UNIQUE INDEX "er_beds_tenantId_zone_bedLabel_key" ON "er_beds"("tenantId", "zone", "bedLabel");

-- CreateIndex
CREATE INDEX "er_bed_assignments_encounterId_idx" ON "er_bed_assignments"("encounterId");

-- CreateIndex
CREATE INDEX "er_bed_assignments_bedId_idx" ON "er_bed_assignments"("bedId");

-- CreateIndex
CREATE INDEX "er_staff_assignments_encounterId_idx" ON "er_staff_assignments"("encounterId");

-- CreateIndex
CREATE INDEX "er_staff_assignments_userId_idx" ON "er_staff_assignments"("userId");

-- CreateIndex
CREATE INDEX "er_notes_encounterId_idx" ON "er_notes"("encounterId");

-- CreateIndex
CREATE INDEX "er_doctor_notes_encounterId_idx" ON "er_doctor_notes"("encounterId");

-- CreateIndex
CREATE INDEX "er_nursing_notes_tenantId_idx" ON "er_nursing_notes"("tenantId");

-- CreateIndex
CREATE INDEX "er_nursing_notes_encounterId_idx" ON "er_nursing_notes"("encounterId");

-- CreateIndex
CREATE INDEX "er_dispositions_tenantId_idx" ON "er_dispositions"("tenantId");

-- CreateIndex
CREATE INDEX "er_dispositions_encounterId_idx" ON "er_dispositions"("encounterId");

-- CreateIndex
CREATE INDEX "er_tasks_tenantId_idx" ON "er_tasks"("tenantId");

-- CreateIndex
CREATE INDEX "er_tasks_encounterId_idx" ON "er_tasks"("encounterId");

-- CreateIndex
CREATE INDEX "er_tasks_status_idx" ON "er_tasks"("status");

-- CreateIndex
CREATE INDEX "er_observations_tenantId_idx" ON "er_observations"("tenantId");

-- CreateIndex
CREATE INDEX "er_observations_encounterId_idx" ON "er_observations"("encounterId");

-- CreateIndex
CREATE INDEX "er_escalations_tenantId_idx" ON "er_escalations"("tenantId");

-- CreateIndex
CREATE INDEX "er_escalations_encounterId_idx" ON "er_escalations"("encounterId");

-- CreateIndex
CREATE INDEX "er_notifications_tenantId_idx" ON "er_notifications"("tenantId");

-- CreateIndex
CREATE INDEX "er_notifications_encounterId_idx" ON "er_notifications"("encounterId");

-- CreateIndex
CREATE INDEX "er_notifications_recipientId_idx" ON "er_notifications"("recipientId");

-- CreateIndex
CREATE INDEX "er_nursing_handovers_tenantId_idx" ON "er_nursing_handovers"("tenantId");

-- CreateIndex
CREATE INDEX "er_nursing_handovers_encounterId_idx" ON "er_nursing_handovers"("encounterId");

-- CreateIndex
CREATE INDEX "admission_handovers_tenantId_idx" ON "admission_handovers"("tenantId");

-- CreateIndex
CREATE INDEX "respiratory_screenings_tenantId_idx" ON "respiratory_screenings"("tenantId");

-- CreateIndex
CREATE INDEX "respiratory_screenings_encounterId_idx" ON "respiratory_screenings"("encounterId");

-- CreateIndex
CREATE INDEX "er_nursing_transfer_requests_encounterId_idx" ON "er_nursing_transfer_requests"("encounterId");

-- CreateIndex
CREATE INDEX "er_nursing_transfer_requests_tenantId_idx" ON "er_nursing_transfer_requests"("tenantId");

-- CreateIndex
CREATE INDEX "er_nursing_transfer_requests_status_idx" ON "er_nursing_transfer_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "er_sequences_tenantId_sequenceKey_key" ON "er_sequences"("tenantId", "sequenceKey");

-- CreateIndex
CREATE INDEX "mci_incidents_tenantId_idx" ON "mci_incidents"("tenantId");

-- CreateIndex
CREATE INDEX "mci_incidents_tenantId_status_idx" ON "mci_incidents"("tenantId", "status");

-- CreateIndex
CREATE INDEX "mci_patients_tenantId_idx" ON "mci_patients"("tenantId");

-- CreateIndex
CREATE INDEX "mci_patients_tenantId_incidentId_idx" ON "mci_patients"("tenantId", "incidentId");

-- CreateIndex
CREATE INDEX "mci_patients_tenantId_triageTag_idx" ON "mci_patients"("tenantId", "triageTag");

-- CreateIndex
CREATE INDEX "er_triage_scores_tenantId_idx" ON "er_triage_scores"("tenantId");

-- CreateIndex
CREATE INDEX "er_triage_scores_tenantId_encounterId_idx" ON "er_triage_scores"("tenantId", "encounterId");

-- CreateIndex
CREATE INDEX "imdad_alert_instances_tenantId_idx" ON "imdad_alert_instances"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_alert_rules_tenantId_idx" ON "imdad_alert_rules"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_alert_rules_tenantId_organizationId_ruleCode_key" ON "imdad_alert_rules"("tenantId", "organizationId", "ruleCode");

-- CreateIndex
CREATE INDEX "imdad_annual_budget_plans_tenantId_idx" ON "imdad_annual_budget_plans"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_annual_budget_plans_tenantId_organizationId_fiscalYea_key" ON "imdad_annual_budget_plans"("tenantId", "organizationId", "fiscalYear", "planCode");

-- CreateIndex
CREATE INDEX "imdad_approval_decisions_tenantId_idx" ON "imdad_approval_decisions"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_approval_delegations_tenantId_idx" ON "imdad_approval_delegations"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_approval_requests_tenantId_idx" ON "imdad_approval_requests"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_approval_steps_tenantId_idx" ON "imdad_approval_steps"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_approval_workflow_rule_steps_tenantId_idx" ON "imdad_approval_workflow_rule_steps"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_approval_workflow_rules_tenantId_idx" ON "imdad_approval_workflow_rules"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_approval_workflow_templates_tenantId_idx" ON "imdad_approval_workflow_templates"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_approval_workflow_templates_tenantId_organizationId_d_key" ON "imdad_approval_workflow_templates"("tenantId", "organizationId", "documentType", "name");

-- CreateIndex
CREATE INDEX "imdad_asset_disposals_tenantId_idx" ON "imdad_asset_disposals"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_asset_disposals_tenantId_organizationId_disposalNumbe_key" ON "imdad_asset_disposals"("tenantId", "organizationId", "disposalNumber");

-- CreateIndex
CREATE INDEX "imdad_asset_transfers_tenantId_idx" ON "imdad_asset_transfers"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_asset_transfers_tenantId_organizationId_transferNumbe_key" ON "imdad_asset_transfers"("tenantId", "organizationId", "transferNumber");

-- CreateIndex
CREATE INDEX "imdad_assets_tenantId_idx" ON "imdad_assets"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_assets_tenantId_organizationId_assetTag_key" ON "imdad_assets"("tenantId", "organizationId", "assetTag");

-- CreateIndex
CREATE INDEX "imdad_attachments_tenantId_idx" ON "imdad_attachments"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_audit_findings_tenantId_idx" ON "imdad_audit_findings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_audit_findings_tenantId_auditId_findingNumber_key" ON "imdad_audit_findings"("tenantId", "auditId", "findingNumber");

-- CreateIndex
CREATE INDEX "imdad_audit_log_partitions_tenantId_idx" ON "imdad_audit_log_partitions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_audit_log_partitions_tenantId_partitionKey_key" ON "imdad_audit_log_partitions"("tenantId", "partitionKey");

-- CreateIndex
CREATE INDEX "imdad_audit_logs_tenantId_idx" ON "imdad_audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_batch_lots_tenantId_idx" ON "imdad_batch_lots"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_batch_lots_tenantId_organizationId_itemId_batchNumber_key" ON "imdad_batch_lots"("tenantId", "organizationId", "itemId", "batchNumber");

-- CreateIndex
CREATE INDEX "imdad_bins_tenantId_idx" ON "imdad_bins"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_bins_tenantId_zoneId_binCode_key" ON "imdad_bins"("tenantId", "zoneId", "binCode");

-- CreateIndex
CREATE INDEX "imdad_budget_benchmarks_tenantId_idx" ON "imdad_budget_benchmarks"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_budget_consumptions_tenantId_idx" ON "imdad_budget_consumptions"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_budget_lines_tenantId_idx" ON "imdad_budget_lines"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_budget_lines_tenantId_budgetId_lineNumber_key" ON "imdad_budget_lines"("tenantId", "budgetId", "lineNumber");

-- CreateIndex
CREATE INDEX "imdad_budget_proposals_tenantId_idx" ON "imdad_budget_proposals"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_budget_proposals_tenantId_organizationId_proposalCode_key" ON "imdad_budget_proposals"("tenantId", "organizationId", "proposalCode");

-- CreateIndex
CREATE INDEX "imdad_budget_transfers_tenantId_idx" ON "imdad_budget_transfers"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_budget_transfers_tenantId_organizationId_transferNumb_key" ON "imdad_budget_transfers"("tenantId", "organizationId", "transferNumber");

-- CreateIndex
CREATE INDEX "imdad_budgets_tenantId_idx" ON "imdad_budgets"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_budgets_tenantId_organizationId_budgetCode_key" ON "imdad_budgets"("tenantId", "organizationId", "budgetCode");

-- CreateIndex
CREATE INDEX "imdad_charge_capture_items_tenantId_idx" ON "imdad_charge_capture_items"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_charge_capture_items_tenantId_chargeCaptureId_lineNum_key" ON "imdad_charge_capture_items"("tenantId", "chargeCaptureId", "lineNumber");

-- CreateIndex
CREATE INDEX "imdad_charge_captures_tenantId_idx" ON "imdad_charge_captures"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_charge_captures_tenantId_organizationId_chargeNumber_key" ON "imdad_charge_captures"("tenantId", "organizationId", "chargeNumber");

-- CreateIndex
CREATE INDEX "imdad_compliance_certificates_tenantId_idx" ON "imdad_compliance_certificates"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_compliance_certificates_tenantId_organizationId_certi_key" ON "imdad_compliance_certificates"("tenantId", "organizationId", "certificateNumber");

-- CreateIndex
CREATE INDEX "imdad_consumption_logs_tenantId_idx" ON "imdad_consumption_logs"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_contract_amendments_tenantId_idx" ON "imdad_contract_amendments"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_contract_lines_tenantId_idx" ON "imdad_contract_lines"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_contracts_tenantId_idx" ON "imdad_contracts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_contracts_tenantId_contractNumber_key" ON "imdad_contracts"("tenantId", "contractNumber");

-- CreateIndex
CREATE INDEX "imdad_cost_centers_tenantId_idx" ON "imdad_cost_centers"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_cost_centers_tenantId_organizationId_code_key" ON "imdad_cost_centers"("tenantId", "organizationId", "code");

-- CreateIndex
CREATE INDEX "imdad_dashboard_configs_tenantId_idx" ON "imdad_dashboard_configs"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_decision_actions_tenantId_idx" ON "imdad_decision_actions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_decision_actions_tenantId_decisionId_actionCode_key" ON "imdad_decision_actions"("tenantId", "decisionId", "actionCode");

-- CreateIndex
CREATE INDEX "imdad_decisions_tenantId_idx" ON "imdad_decisions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_decisions_tenantId_decisionCode_key" ON "imdad_decisions"("tenantId", "decisionCode");

-- CreateIndex
CREATE INDEX "imdad_delegation_chains_tenantId_idx" ON "imdad_delegation_chains"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_department_users_tenantId_idx" ON "imdad_department_users"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_department_users_tenantId_departmentId_userId_key" ON "imdad_department_users"("tenantId", "departmentId", "userId");

-- CreateIndex
CREATE INDEX "imdad_departments_tenantId_idx" ON "imdad_departments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_departments_tenantId_organizationId_code_key" ON "imdad_departments"("tenantId", "organizationId", "code");

-- CreateIndex
CREATE INDEX "imdad_device_replacement_plans_tenantId_idx" ON "imdad_device_replacement_plans"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_dispense_lines_tenantId_idx" ON "imdad_dispense_lines"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_dispense_lines_tenantId_dispenseRequestId_lineNumber_key" ON "imdad_dispense_lines"("tenantId", "dispenseRequestId", "lineNumber");

-- CreateIndex
CREATE INDEX "imdad_dispense_requests_tenantId_idx" ON "imdad_dispense_requests"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_dispense_requests_tenantId_organizationId_dispenseNum_key" ON "imdad_dispense_requests"("tenantId", "organizationId", "dispenseNumber");

-- CreateIndex
CREATE INDEX "imdad_event_bus_messages_tenantId_idx" ON "imdad_event_bus_messages"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_formulary_items_tenantId_idx" ON "imdad_formulary_items"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_formulary_items_tenantId_organizationId_itemId_key" ON "imdad_formulary_items"("tenantId", "organizationId", "itemId");

-- CreateIndex
CREATE INDEX "imdad_goods_receiving_note_lines_tenantId_idx" ON "imdad_goods_receiving_note_lines"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_goods_receiving_notes_tenantId_idx" ON "imdad_goods_receiving_notes"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_goods_receiving_notes_tenantId_grnNumber_key" ON "imdad_goods_receiving_notes"("tenantId", "grnNumber");

-- CreateIndex
CREATE INDEX "imdad_grn_discrepancies_tenantId_idx" ON "imdad_grn_discrepancies"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_inspection_checklists_tenantId_idx" ON "imdad_inspection_checklists"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_inspection_checklists_tenantId_inspectionId_checkNumb_key" ON "imdad_inspection_checklists"("tenantId", "inspectionId", "checkNumber");

-- CreateIndex
CREATE INDEX "imdad_inspection_templates_tenantId_idx" ON "imdad_inspection_templates"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_inspection_templates_tenantId_organizationId_template_key" ON "imdad_inspection_templates"("tenantId", "organizationId", "templateCode");

-- CreateIndex
CREATE INDEX "imdad_inventory_adjustments_tenantId_idx" ON "imdad_inventory_adjustments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_inventory_adjustments_tenantId_adjustmentNumber_key" ON "imdad_inventory_adjustments"("tenantId", "adjustmentNumber");

-- CreateIndex
CREATE INDEX "imdad_inventory_locations_tenantId_idx" ON "imdad_inventory_locations"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_inventory_locations_tenantId_organizationId_code_key" ON "imdad_inventory_locations"("tenantId", "organizationId", "code");

-- CreateIndex
CREATE INDEX "imdad_inventory_transactions_tenantId_idx" ON "imdad_inventory_transactions"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_invoice_lines_tenantId_idx" ON "imdad_invoice_lines"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_invoice_lines_tenantId_invoiceId_lineNumber_key" ON "imdad_invoice_lines"("tenantId", "invoiceId", "lineNumber");

-- CreateIndex
CREATE INDEX "imdad_invoices_tenantId_idx" ON "imdad_invoices"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_invoices_tenantId_organizationId_internalNumber_key" ON "imdad_invoices"("tenantId", "organizationId", "internalNumber");

-- CreateIndex
CREATE INDEX "imdad_item_categories_tenantId_idx" ON "imdad_item_categories"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_item_categories_tenantId_code_key" ON "imdad_item_categories"("tenantId", "code");

-- CreateIndex
CREATE INDEX "imdad_item_locations_tenantId_idx" ON "imdad_item_locations"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_item_locations_tenantId_organizationId_itemId_locatio_key" ON "imdad_item_locations"("tenantId", "organizationId", "itemId", "locationId");

-- CreateIndex
CREATE INDEX "imdad_item_masters_tenantId_idx" ON "imdad_item_masters"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_item_masters_tenantId_code_key" ON "imdad_item_masters"("tenantId", "code");

-- CreateIndex
CREATE INDEX "imdad_item_substitutes_tenantId_idx" ON "imdad_item_substitutes"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_item_substitutes_tenantId_itemId_substituteId_key" ON "imdad_item_substitutes"("tenantId", "itemId", "substituteId");

-- CreateIndex
CREATE INDEX "imdad_job_executions_tenantId_idx" ON "imdad_job_executions"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_kpi_snapshots_tenantId_idx" ON "imdad_kpi_snapshots"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_kpi_snapshots_tenantId_organizationId_kpiCode_periodT_key" ON "imdad_kpi_snapshots"("tenantId", "organizationId", "kpiCode", "periodType", "periodStart", "dimensionType", "dimensionId");

-- CreateIndex
CREATE INDEX "imdad_maintenance_orders_tenantId_idx" ON "imdad_maintenance_orders"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_maintenance_orders_tenantId_organizationId_orderNumbe_key" ON "imdad_maintenance_orders"("tenantId", "organizationId", "orderNumber");

-- CreateIndex
CREATE INDEX "imdad_non_conformance_reports_tenantId_idx" ON "imdad_non_conformance_reports"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_non_conformance_reports_tenantId_organizationId_ncrNu_key" ON "imdad_non_conformance_reports"("tenantId", "organizationId", "ncrNumber");

-- CreateIndex
CREATE INDEX "imdad_notification_preferences_tenantId_idx" ON "imdad_notification_preferences"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_notification_preferences_tenantId_userId_channel_temp_key" ON "imdad_notification_preferences"("tenantId", "userId", "channel", "templateCode");

-- CreateIndex
CREATE INDEX "imdad_notification_templates_tenantId_idx" ON "imdad_notification_templates"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_notification_templates_tenantId_organizationId_templa_key" ON "imdad_notification_templates"("tenantId", "organizationId", "templateCode", "channel");

-- CreateIndex
CREATE INDEX "imdad_notifications_tenantId_idx" ON "imdad_notifications"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_operational_signals_tenantId_idx" ON "imdad_operational_signals"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_organizations_tenantId_idx" ON "imdad_organizations"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_organizations_tenantId_code_key" ON "imdad_organizations"("tenantId", "code");

-- CreateIndex
CREATE INDEX "imdad_patient_charges_tenantId_idx" ON "imdad_patient_charges"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_patient_charges_tenantId_organizationId_chargeNumber_key" ON "imdad_patient_charges"("tenantId", "organizationId", "chargeNumber");

-- CreateIndex
CREATE INDEX "imdad_patient_returns_tenantId_idx" ON "imdad_patient_returns"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_patient_returns_tenantId_organizationId_returnNumber_key" ON "imdad_patient_returns"("tenantId", "organizationId", "returnNumber");

-- CreateIndex
CREATE INDEX "imdad_payment_batches_tenantId_idx" ON "imdad_payment_batches"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_payment_batches_tenantId_organizationId_batchNumber_key" ON "imdad_payment_batches"("tenantId", "organizationId", "batchNumber");

-- CreateIndex
CREATE INDEX "imdad_permissions_tenantId_idx" ON "imdad_permissions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_permissions_tenantId_permissionKey_key" ON "imdad_permissions"("tenantId", "permissionKey");

-- CreateIndex
CREATE INDEX "imdad_phased_investments_tenantId_idx" ON "imdad_phased_investments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_phased_investments_tenantId_organizationId_investment_key" ON "imdad_phased_investments"("tenantId", "organizationId", "investmentCode");

-- CreateIndex
CREATE INDEX "imdad_pick_lines_tenantId_idx" ON "imdad_pick_lines"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_pick_lines_tenantId_pickListId_lineNumber_key" ON "imdad_pick_lines"("tenantId", "pickListId", "lineNumber");

-- CreateIndex
CREATE INDEX "imdad_pick_lists_tenantId_idx" ON "imdad_pick_lists"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_pick_lists_tenantId_organizationId_pickNumber_key" ON "imdad_pick_lists"("tenantId", "organizationId", "pickNumber");

-- CreateIndex
CREATE INDEX "imdad_print_templates_tenantId_idx" ON "imdad_print_templates"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_print_templates_tenantId_organizationId_templateCode_key" ON "imdad_print_templates"("tenantId", "organizationId", "templateCode");

-- CreateIndex
CREATE INDEX "imdad_proposal_line_items_tenantId_idx" ON "imdad_proposal_line_items"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_proposal_line_items_tenantId_proposalId_lineNumber_key" ON "imdad_proposal_line_items"("tenantId", "proposalId", "lineNumber");

-- CreateIndex
CREATE INDEX "imdad_purchase_order_lines_tenantId_idx" ON "imdad_purchase_order_lines"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_purchase_orders_tenantId_idx" ON "imdad_purchase_orders"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_purchase_orders_tenantId_poNumber_key" ON "imdad_purchase_orders"("tenantId", "poNumber");

-- CreateIndex
CREATE INDEX "imdad_purchase_requisition_lines_tenantId_idx" ON "imdad_purchase_requisition_lines"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_purchase_requisitions_tenantId_idx" ON "imdad_purchase_requisitions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_purchase_requisitions_tenantId_prNumber_key" ON "imdad_purchase_requisitions"("tenantId", "prNumber");

-- CreateIndex
CREATE INDEX "imdad_put_away_lines_tenantId_idx" ON "imdad_put_away_lines"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_put_away_lines_tenantId_putAwayTaskId_lineNumber_key" ON "imdad_put_away_lines"("tenantId", "putAwayTaskId", "lineNumber");

-- CreateIndex
CREATE INDEX "imdad_put_away_rules_tenantId_idx" ON "imdad_put_away_rules"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_put_away_tasks_tenantId_idx" ON "imdad_put_away_tasks"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_put_away_tasks_tenantId_organizationId_taskNumber_key" ON "imdad_put_away_tasks"("tenantId", "organizationId", "taskNumber");

-- CreateIndex
CREATE INDEX "imdad_quality_inspections_tenantId_idx" ON "imdad_quality_inspections"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_quality_inspections_tenantId_organizationId_inspectio_key" ON "imdad_quality_inspections"("tenantId", "organizationId", "inspectionNumber");

-- CreateIndex
CREATE INDEX "imdad_recall_actions_tenantId_idx" ON "imdad_recall_actions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_recall_actions_tenantId_recallId_actionNumber_key" ON "imdad_recall_actions"("tenantId", "recallId", "actionNumber");

-- CreateIndex
CREATE INDEX "imdad_recalls_tenantId_idx" ON "imdad_recalls"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_recalls_tenantId_organizationId_recallNumber_key" ON "imdad_recalls"("tenantId", "organizationId", "recallNumber");

-- CreateIndex
CREATE INDEX "imdad_receiving_docks_tenantId_idx" ON "imdad_receiving_docks"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_receiving_docks_tenantId_warehouseId_dockCode_key" ON "imdad_receiving_docks"("tenantId", "warehouseId", "dockCode");

-- CreateIndex
CREATE INDEX "imdad_reorder_rules_tenantId_idx" ON "imdad_reorder_rules"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_reorder_rules_tenantId_organizationId_itemId_location_key" ON "imdad_reorder_rules"("tenantId", "organizationId", "itemId", "locationId");

-- CreateIndex
CREATE INDEX "imdad_replenishment_rules_tenantId_idx" ON "imdad_replenishment_rules"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_replenishment_rules_tenantId_itemId_sourceLocationId__key" ON "imdad_replenishment_rules"("tenantId", "itemId", "sourceLocationId", "destLocationId");

-- CreateIndex
CREATE INDEX "imdad_report_definitions_tenantId_idx" ON "imdad_report_definitions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_report_definitions_tenantId_organizationId_reportCode_key" ON "imdad_report_definitions"("tenantId", "organizationId", "reportCode");

-- CreateIndex
CREATE INDEX "imdad_report_executions_tenantId_idx" ON "imdad_report_executions"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_role_definitions_tenantId_idx" ON "imdad_role_definitions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_role_definitions_tenantId_roleKey_key" ON "imdad_role_definitions"("tenantId", "roleKey");

-- CreateIndex
CREATE INDEX "imdad_sequence_counters_tenantId_idx" ON "imdad_sequence_counters"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_sequence_counters_tenantId_organizationId_sequenceTyp_key" ON "imdad_sequence_counters"("tenantId", "organizationId", "sequenceType", "fiscalYear");

-- CreateIndex
CREATE INDEX "imdad_sfda_integration_logs_tenantId_idx" ON "imdad_sfda_integration_logs"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_stock_count_items_tenantId_idx" ON "imdad_stock_count_items"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_stock_counts_tenantId_idx" ON "imdad_stock_counts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_stock_counts_tenantId_countNumber_key" ON "imdad_stock_counts"("tenantId", "countNumber");

-- CreateIndex
CREATE INDEX "imdad_stock_reservations_tenantId_idx" ON "imdad_stock_reservations"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_stock_transactions_tenantId_idx" ON "imdad_stock_transactions"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_supply_request_approvals_tenantId_idx" ON "imdad_supply_request_approvals"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_supply_request_approvals_tenantId_requestId_stepNumbe_key" ON "imdad_supply_request_approvals"("tenantId", "requestId", "stepNumber");

-- CreateIndex
CREATE INDEX "imdad_supply_request_audit_tenantId_idx" ON "imdad_supply_request_audit"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_supply_request_items_tenantId_idx" ON "imdad_supply_request_items"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_supply_requests_tenantId_idx" ON "imdad_supply_requests"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_supply_requests_tenantId_code_key" ON "imdad_supply_requests"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_supply_requests_tenantId_idempotencyKey_key" ON "imdad_supply_requests"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "imdad_system_configs_tenantId_idx" ON "imdad_system_configs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_system_configs_tenantId_configKey_scope_scopeId_key" ON "imdad_system_configs"("tenantId", "configKey", "scope", "scopeId");

-- CreateIndex
CREATE INDEX "imdad_system_pulses_tenantId_idx" ON "imdad_system_pulses"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_temperature_logs_tenantId_idx" ON "imdad_temperature_logs"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_transfer_lines_tenantId_idx" ON "imdad_transfer_lines"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_transfer_lines_tenantId_transferId_lineNumber_key" ON "imdad_transfer_lines"("tenantId", "transferId", "lineNumber");

-- CreateIndex
CREATE INDEX "imdad_transfer_requests_tenantId_idx" ON "imdad_transfer_requests"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_transfer_requests_tenantId_organizationId_transferNum_key" ON "imdad_transfer_requests"("tenantId", "organizationId", "transferNumber");

-- CreateIndex
CREATE INDEX "imdad_units_of_measure_tenantId_idx" ON "imdad_units_of_measure"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_units_of_measure_tenantId_code_key" ON "imdad_units_of_measure"("tenantId", "code");

-- CreateIndex
CREATE INDEX "imdad_uom_conversions_tenantId_idx" ON "imdad_uom_conversions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_uom_conversions_tenantId_fromUomId_toUomId_itemId_key" ON "imdad_uom_conversions"("tenantId", "fromUomId", "toUomId", "itemId");

-- CreateIndex
CREATE INDEX "imdad_user_roles_tenantId_idx" ON "imdad_user_roles"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_user_roles_tenantId_userId_roleId_key" ON "imdad_user_roles"("tenantId", "userId", "roleId");

-- CreateIndex
CREATE INDEX "imdad_vendor_audits_tenantId_idx" ON "imdad_vendor_audits"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_vendor_audits_tenantId_organizationId_auditNumber_key" ON "imdad_vendor_audits"("tenantId", "organizationId", "auditNumber");

-- CreateIndex
CREATE INDEX "imdad_vendor_contacts_tenantId_idx" ON "imdad_vendor_contacts"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_vendor_documents_tenantId_idx" ON "imdad_vendor_documents"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_vendor_scorecards_tenantId_idx" ON "imdad_vendor_scorecards"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_vendor_scorecards_tenantId_vendorId_period_key" ON "imdad_vendor_scorecards"("tenantId", "vendorId", "period");

-- CreateIndex
CREATE INDEX "imdad_vendors_tenantId_idx" ON "imdad_vendors"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_vendors_tenantId_code_key" ON "imdad_vendors"("tenantId", "code");

-- CreateIndex
CREATE INDEX "imdad_ward_par_levels_tenantId_idx" ON "imdad_ward_par_levels"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_ward_par_levels_tenantId_departmentId_itemId_key" ON "imdad_ward_par_levels"("tenantId", "departmentId", "itemId");

-- CreateIndex
CREATE INDEX "imdad_warehouse_zones_tenantId_idx" ON "imdad_warehouse_zones"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_warehouse_zones_tenantId_warehouseId_zoneCode_key" ON "imdad_warehouse_zones"("tenantId", "warehouseId", "zoneCode");

-- CreateIndex
CREATE INDEX "imdad_warehouses_tenantId_idx" ON "imdad_warehouses"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imdad_warehouses_tenantId_organizationId_warehouseCode_key" ON "imdad_warehouses"("tenantId", "organizationId", "warehouseCode");

-- CreateIndex
CREATE INDEX "imdad_webhook_deliveries_tenantId_idx" ON "imdad_webhook_deliveries"("tenantId");

-- CreateIndex
CREATE INDEX "imdad_webhooks_tenantId_idx" ON "imdad_webhooks"("tenantId");

-- CreateIndex
CREATE INDEX "instruments_tenantId_idx" ON "instruments"("tenantId");

-- CreateIndex
CREATE INDEX "integration_messages_tenantId_idx" ON "integration_messages"("tenantId");

-- CreateIndex
CREATE INDEX "integration_messages_tenantId_status_idx" ON "integration_messages"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "integration_config_tenantId_key_key" ON "integration_config"("tenantId", "key");

-- CreateIndex
CREATE INDEX "integration_adt_events_tenantId_idx" ON "integration_adt_events"("tenantId");

-- CreateIndex
CREATE INDEX "fhir_subscriptions_tenantId_idx" ON "fhir_subscriptions"("tenantId");

-- CreateIndex
CREATE INDEX "fhir_subscription_log_tenantId_idx" ON "fhir_subscription_log"("tenantId");

-- CreateIndex
CREATE INDEX "fhir_subscription_log_tenantId_subscriptionId_idx" ON "fhir_subscription_log"("tenantId", "subscriptionId");

-- CreateIndex
CREATE INDEX "dicom_sources_tenantId_idx" ON "dicom_sources"("tenantId");

-- CreateIndex
CREATE INDEX "ipd_episodes_tenantId_idx" ON "ipd_episodes"("tenantId");

-- CreateIndex
CREATE INDEX "ipd_episodes_tenantId_encounterId_idx" ON "ipd_episodes"("tenantId", "encounterId");

-- CreateIndex
CREATE INDEX "ipd_episodes_tenantId_status_idx" ON "ipd_episodes"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ipd_admissions_tenantId_idx" ON "ipd_admissions"("tenantId");

-- CreateIndex
CREATE INDEX "ipd_admissions_tenantId_episodeId_idx" ON "ipd_admissions"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "ipd_admissions_tenantId_bedId_idx" ON "ipd_admissions"("tenantId", "bedId");

-- CreateIndex
CREATE INDEX "ipd_admissions_tenantId_isActive_idx" ON "ipd_admissions"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "ipd_beds_tenantId_idx" ON "ipd_beds"("tenantId");

-- CreateIndex
CREATE INDEX "ipd_beds_tenantId_departmentId_idx" ON "ipd_beds"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "ipd_vitals_tenantId_episodeId_idx" ON "ipd_vitals"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "ipd_downtime_incidents_tenantId_episodeId_idx" ON "ipd_downtime_incidents"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "ipd_icu_events_tenantId_idx" ON "ipd_icu_events"("tenantId");

-- CreateIndex
CREATE INDEX "ipd_icu_events_tenantId_episodeId_idx" ON "ipd_icu_events"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "ipd_care_plans_tenantId_idx" ON "ipd_care_plans"("tenantId");

-- CreateIndex
CREATE INDEX "ipd_care_plans_tenantId_episodeId_idx" ON "ipd_care_plans"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "ipd_med_order_events_tenantId_idx" ON "ipd_med_order_events"("tenantId");

-- CreateIndex
CREATE INDEX "ipd_med_order_events_tenantId_episodeId_idx" ON "ipd_med_order_events"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "ipd_med_order_events_tenantId_orderId_idx" ON "ipd_med_order_events"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "ipd_mar_events_tenantId_idx" ON "ipd_mar_events"("tenantId");

-- CreateIndex
CREATE INDEX "ipd_mar_events_tenantId_episodeId_idx" ON "ipd_mar_events"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "ipd_mar_events_tenantId_orderId_idx" ON "ipd_mar_events"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "ipd_mar_events_tenantId_episodeId_scheduledFor_idx" ON "ipd_mar_events"("tenantId", "episodeId", "scheduledFor");

-- CreateIndex
CREATE INDEX "ipd_nursing_assessments_tenantId_idx" ON "ipd_nursing_assessments"("tenantId");

-- CreateIndex
CREATE INDEX "ipd_nursing_assessments_tenantId_episodeId_idx" ON "ipd_nursing_assessments"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "ipd_nursing_daily_progress_tenantId_idx" ON "ipd_nursing_daily_progress"("tenantId");

-- CreateIndex
CREATE INDEX "ipd_nursing_daily_progress_tenantId_episodeId_idx" ON "ipd_nursing_daily_progress"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "ipd_nursing_daily_progress_tenantId_episodeId_date_idx" ON "ipd_nursing_daily_progress"("tenantId", "episodeId", "date");

-- CreateIndex
CREATE INDEX "ipd_orders_tenantId_idx" ON "ipd_orders"("tenantId");

-- CreateIndex
CREATE INDEX "ipd_orders_tenantId_episodeId_idx" ON "ipd_orders"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "ipd_orders_tenantId_status_idx" ON "ipd_orders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ventilator_records_tenantId_episodeId_idx" ON "ventilator_records"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "fluid_balance_entries_tenantId_episodeId_idx" ON "fluid_balance_entries"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "fluid_balance_entries_tenantId_episodeId_shiftDate_idx" ON "fluid_balance_entries"("tenantId", "episodeId", "shiftDate");

-- CreateIndex
CREATE INDEX "ipd_admission_intake_tenantId_idx" ON "ipd_admission_intake"("tenantId");

-- CreateIndex
CREATE INDEX "ipd_admission_intake_tenantId_episodeId_idx" ON "ipd_admission_intake"("tenantId", "episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ipd_admission_intake_tenantId_handoffId_key" ON "ipd_admission_intake"("tenantId", "handoffId");

-- CreateIndex
CREATE INDEX "icu_care_plans_tenantId_episodeId_idx" ON "icu_care_plans"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "sofa_scores_tenantId_episodeId_idx" ON "sofa_scores"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "icu_ventilator_checks_tenantId_episodeId_idx" ON "icu_ventilator_checks"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "icu_apache_scores_tenantId_episodeId_idx" ON "icu_apache_scores"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "icu_sedation_assessments_tenantId_episodeId_idx" ON "icu_sedation_assessments"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "icu_sedation_assessments_tenantId_episodeId_assessedAt_idx" ON "icu_sedation_assessments"("tenantId", "episodeId", "assessedAt");

-- CreateIndex
CREATE INDEX "icu_delirium_screens_tenantId_episodeId_idx" ON "icu_delirium_screens"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "icu_delirium_screens_tenantId_episodeId_screenedAt_idx" ON "icu_delirium_screens"("tenantId", "episodeId", "screenedAt");

-- CreateIndex
CREATE INDEX "icu_bundle_compliance_tenantId_episodeId_idx" ON "icu_bundle_compliance"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "icu_bundle_compliance_tenantId_bundleType_idx" ON "icu_bundle_compliance"("tenantId", "bundleType");

-- CreateIndex
CREATE INDEX "icu_bundle_compliance_tenantId_auditDate_idx" ON "icu_bundle_compliance"("tenantId", "auditDate");

-- CreateIndex
CREATE INDEX "icu_code_blues_tenantId_episodeId_idx" ON "icu_code_blues"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "icu_code_blues_tenantId_codeCalledAt_idx" ON "icu_code_blues"("tenantId", "codeCalledAt");

-- CreateIndex
CREATE INDEX "brain_death_protocols_tenantId_idx" ON "brain_death_protocols"("tenantId");

-- CreateIndex
CREATE INDEX "brain_death_protocols_tenantId_episodeId_idx" ON "brain_death_protocols"("tenantId", "episodeId");

-- CreateIndex
CREATE INDEX "brain_death_protocols_tenantId_status_idx" ON "brain_death_protocols"("tenantId", "status");

-- CreateIndex
CREATE INDEX "organ_donations_tenantId_idx" ON "organ_donations"("tenantId");

-- CreateIndex
CREATE INDEX "organ_donations_tenantId_status_idx" ON "organ_donations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "lab_orders_tenantId_idx" ON "lab_orders"("tenantId");

-- CreateIndex
CREATE INDEX "lab_orders_tenantId_status_idx" ON "lab_orders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "lab_orders_tenantId_patientId_idx" ON "lab_orders"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "lab_specimens_tenantId_idx" ON "lab_specimens"("tenantId");

-- CreateIndex
CREATE INDEX "lab_specimens_tenantId_orderId_idx" ON "lab_specimens"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "lab_specimens_tenantId_status_idx" ON "lab_specimens"("tenantId", "status");

-- CreateIndex
CREATE INDEX "lab_critical_alerts_tenantId_idx" ON "lab_critical_alerts"("tenantId");

-- CreateIndex
CREATE INDEX "lab_critical_alerts_tenantId_acknowledgedAt_idx" ON "lab_critical_alerts"("tenantId", "acknowledgedAt");

-- CreateIndex
CREATE INDEX "lab_qc_results_tenantId_idx" ON "lab_qc_results"("tenantId");

-- CreateIndex
CREATE INDEX "lab_qc_results_tenantId_analyteCode_lotNumber_level_idx" ON "lab_qc_results"("tenantId", "analyteCode", "lotNumber", "level");

-- CreateIndex
CREATE INDEX "lab_results_incoming_tenantId_idx" ON "lab_results_incoming"("tenantId");

-- CreateIndex
CREATE INDEX "lab_results_incoming_tenantId_processed_idx" ON "lab_results_incoming"("tenantId", "processed");

-- CreateIndex
CREATE INDEX "lab_micro_cultures_tenantId_idx" ON "lab_micro_cultures"("tenantId");

-- CreateIndex
CREATE INDEX "lab_micro_cultures_tenantId_patientId_idx" ON "lab_micro_cultures"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "lab_micro_cultures_tenantId_status_idx" ON "lab_micro_cultures"("tenantId", "status");

-- CreateIndex
CREATE INDEX "lab_tat_records_tenantId_idx" ON "lab_tat_records"("tenantId");

-- CreateIndex
CREATE INDEX "lab_tat_records_tenantId_testCode_idx" ON "lab_tat_records"("tenantId", "testCode");

-- CreateIndex
CREATE INDEX "lab_tat_records_tenantId_createdAt_idx" ON "lab_tat_records"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "lab_result_amendments_tenantId_idx" ON "lab_result_amendments"("tenantId");

-- CreateIndex
CREATE INDEX "lab_result_amendments_tenantId_resultId_idx" ON "lab_result_amendments"("tenantId", "resultId");

-- CreateIndex
CREATE INDEX "lab_auto_validation_rules_tenantId_idx" ON "lab_auto_validation_rules"("tenantId");

-- CreateIndex
CREATE INDEX "lab_auto_validation_rules_tenantId_testCode_enabled_idx" ON "lab_auto_validation_rules"("tenantId", "testCode", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "lab_auto_validation_rules_tenantId_testCode_ruleName_key" ON "lab_auto_validation_rules"("tenantId", "testCode", "ruleName");

-- CreateIndex
CREATE INDEX "org_nodes_tenantId_idx" ON "org_nodes"("tenantId");

-- CreateIndex
CREATE INDEX "org_nodes_tenantId_parentId_idx" ON "org_nodes"("tenantId", "parentId");

-- CreateIndex
CREATE INDEX "floor_departments_tenantId_idx" ON "floor_departments"("tenantId");

-- CreateIndex
CREATE INDEX "department_entries_tenantId_idx" ON "department_entries"("tenantId");

-- CreateIndex
CREATE INDEX "department_entries_tenantId_encounterCoreId_idx" ON "department_entries"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "nursing_assignments_tenantId_idx" ON "nursing_assignments"("tenantId");

-- CreateIndex
CREATE INDEX "nursing_shift_metrics_tenantId_idx" ON "nursing_shift_metrics"("tenantId");

-- CreateIndex
CREATE INDEX "nursing_shift_metrics_tenantId_date_idx" ON "nursing_shift_metrics"("tenantId", "date");

-- CreateIndex
CREATE INDEX "groups_tenantId_idx" ON "groups"("tenantId");

-- CreateIndex
CREATE INDEX "identity_lookups_tenantId_idx" ON "identity_lookups"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "identity_rate_limits_tenantId_userId_key" ON "identity_rate_limits"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "identity_apply_idempotency_tenantId_userId_requestId_key" ON "identity_apply_idempotency"("tenantId", "userId", "requestId");

-- CreateIndex
CREATE INDEX "absher_verification_logs_tenantId_idx" ON "absher_verification_logs"("tenantId");

-- CreateIndex
CREATE INDEX "nafis_visit_logs_tenantId_idx" ON "nafis_visit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "nafis_statistics_logs_tenantId_idx" ON "nafis_statistics_logs"("tenantId");

-- CreateIndex
CREATE INDEX "nafis_disease_reports_tenantId_idx" ON "nafis_disease_reports"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "dental_charts_tenantId_patientId_key" ON "dental_charts"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "dental_treatments_tenantId_patientId_idx" ON "dental_treatments"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "obgyn_forms_tenantId_patientId_idx" ON "obgyn_forms"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "failed_cancellations_tenantId_idx" ON "failed_cancellations"("tenantId");

-- CreateIndex
CREATE INDEX "patient_experience_tenantId_idx" ON "patient_experience"("tenantId");

-- CreateIndex
CREATE INDEX "px_cases_tenantId_idx" ON "px_cases"("tenantId");

-- CreateIndex
CREATE INDEX "px_cases_tenantId_status_idx" ON "px_cases"("tenantId", "status");

-- CreateIndex
CREATE INDEX "dental_procedures_tenantId_patientId_idx" ON "dental_procedures"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "periodontal_records_tenantId_patientId_idx" ON "periodontal_records"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "newborn_records_tenantId_motherPatientId_idx" ON "newborn_records"("tenantId", "motherPatientId");

-- CreateIndex
CREATE INDEX "newborn_records_tenantId_status_idx" ON "newborn_records"("tenantId", "status");

-- CreateIndex
CREATE INDEX "periodontal_charts_tenantId_idx" ON "periodontal_charts"("tenantId");

-- CreateIndex
CREATE INDEX "periodontal_charts_tenantId_patientId_idx" ON "periodontal_charts"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "orthodontic_cases_tenantId_idx" ON "orthodontic_cases"("tenantId");

-- CreateIndex
CREATE INDEX "orthodontic_cases_tenantId_patientId_idx" ON "orthodontic_cases"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "orthodontic_visits_tenantId_idx" ON "orthodontic_visits"("tenantId");

-- CreateIndex
CREATE INDEX "orthodontic_visits_tenantId_caseId_idx" ON "orthodontic_visits"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "oncology_patients_tenantId_idx" ON "oncology_patients"("tenantId");

-- CreateIndex
CREATE INDEX "oncology_patients_tenantId_patientMasterId_idx" ON "oncology_patients"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "oncology_protocols_tenantId_patientId_idx" ON "oncology_protocols"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "chemo_cycles_tenantId_patientId_idx" ON "chemo_cycles"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "tumor_board_cases_tenantId_idx" ON "tumor_board_cases"("tenantId");

-- CreateIndex
CREATE INDEX "chemo_protocol_templates_tenantId_idx" ON "chemo_protocol_templates"("tenantId");

-- CreateIndex
CREATE INDEX "chemo_protocol_templates_tenantId_cancerType_idx" ON "chemo_protocol_templates"("tenantId", "cancerType");

-- CreateIndex
CREATE INDEX "ctcae_toxicity_records_tenantId_idx" ON "ctcae_toxicity_records"("tenantId");

-- CreateIndex
CREATE INDEX "ctcae_toxicity_records_tenantId_patientMasterId_idx" ON "ctcae_toxicity_records"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "tnm_stagings_tenantId_idx" ON "tnm_stagings"("tenantId");

-- CreateIndex
CREATE INDEX "tnm_stagings_tenantId_patientMasterId_idx" ON "tnm_stagings"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "radiation_therapy_plans_tenantId_idx" ON "radiation_therapy_plans"("tenantId");

-- CreateIndex
CREATE INDEX "radiation_therapy_plans_tenantId_patientMasterId_idx" ON "radiation_therapy_plans"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "radiation_sessions_tenantId_planId_idx" ON "radiation_sessions"("tenantId", "planId");

-- CreateIndex
CREATE UNIQUE INDEX "opd_encounters_encounterCoreId_key" ON "opd_encounters"("encounterCoreId");

-- CreateIndex
CREATE INDEX "opd_encounters_tenantId_idx" ON "opd_encounters"("tenantId");

-- CreateIndex
CREATE INDEX "opd_encounters_patientId_idx" ON "opd_encounters"("patientId");

-- CreateIndex
CREATE INDEX "opd_encounters_status_idx" ON "opd_encounters"("status");

-- CreateIndex
CREATE INDEX "opd_encounters_tenantId_status_idx" ON "opd_encounters"("tenantId", "status");

-- CreateIndex
CREATE INDEX "opd_encounters_tenantId_opdFlowState_idx" ON "opd_encounters"("tenantId", "opdFlowState");

-- CreateIndex
CREATE INDEX "opd_nursing_entries_opdEncounterId_idx" ON "opd_nursing_entries"("opdEncounterId");

-- CreateIndex
CREATE INDEX "opd_doctor_entries_opdEncounterId_idx" ON "opd_doctor_entries"("opdEncounterId");

-- CreateIndex
CREATE INDEX "opd_doctor_addenda_opdEncounterId_idx" ON "opd_doctor_addenda"("opdEncounterId");

-- CreateIndex
CREATE INDEX "opd_results_viewed_opdEncounterId_idx" ON "opd_results_viewed"("opdEncounterId");

-- CreateIndex
CREATE INDEX "opd_bookings_tenantId_idx" ON "opd_bookings"("tenantId");

-- CreateIndex
CREATE INDEX "opd_bookings_patientMasterId_idx" ON "opd_bookings"("patientMasterId");

-- CreateIndex
CREATE INDEX "opd_bookings_patientId_idx" ON "opd_bookings"("patientId");

-- CreateIndex
CREATE INDEX "opd_bookings_encounterCoreId_idx" ON "opd_bookings"("encounterCoreId");

-- CreateIndex
CREATE INDEX "opd_bookings_doctorId_idx" ON "opd_bookings"("doctorId");

-- CreateIndex
CREATE INDEX "opd_bookings_bookingDate_idx" ON "opd_bookings"("bookingDate");

-- CreateIndex
CREATE INDEX "opd_bookings_tenantId_date_idx" ON "opd_bookings"("tenantId", "date");

-- CreateIndex
CREATE INDEX "opd_bookings_tenantId_bookingDate_idx" ON "opd_bookings"("tenantId", "bookingDate");

-- CreateIndex
CREATE INDEX "opd_bookings_tenantId_status_idx" ON "opd_bookings"("tenantId", "status");

-- CreateIndex
CREATE INDEX "opd_orders_tenantId_idx" ON "opd_orders"("tenantId");

-- CreateIndex
CREATE INDEX "opd_orders_encounterCoreId_idx" ON "opd_orders"("encounterCoreId");

-- CreateIndex
CREATE INDEX "opd_orders_patientId_idx" ON "opd_orders"("patientId");

-- CreateIndex
CREATE INDEX "opd_orders_status_idx" ON "opd_orders"("status");

-- CreateIndex
CREATE INDEX "opd_daily_data_tenantId_idx" ON "opd_daily_data"("tenantId");

-- CreateIndex
CREATE INDEX "opd_daily_data_date_idx" ON "opd_daily_data"("date");

-- CreateIndex
CREATE INDEX "opd_daily_data_tenantId_date_idx" ON "opd_daily_data"("tenantId", "date");

-- CreateIndex
CREATE INDEX "opd_census_tenantId_idx" ON "opd_census"("tenantId");

-- CreateIndex
CREATE INDEX "opd_census_date_idx" ON "opd_census"("date");

-- CreateIndex
CREATE INDEX "opd_meeting_reports_tenantId_idx" ON "opd_meeting_reports"("tenantId");

-- CreateIndex
CREATE INDEX "opd_meeting_reports_date_idx" ON "opd_meeting_reports"("date");

-- CreateIndex
CREATE INDEX "opd_recommendations_tenantId_idx" ON "opd_recommendations"("tenantId");

-- CreateIndex
CREATE INDEX "opd_recommendations_tenantId_dismissed_idx" ON "opd_recommendations"("tenantId", "dismissed");

-- CreateIndex
CREATE INDEX "or_cases_tenantId_idx" ON "or_cases"("tenantId");

-- CreateIndex
CREATE INDEX "or_cases_tenantId_encounterCoreId_idx" ON "or_cases"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "or_cases_tenantId_scheduledDate_idx" ON "or_cases"("tenantId", "scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "or_cases_tenantId_orderId_key" ON "or_cases"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "or_case_events_tenantId_caseId_idx" ON "or_case_events"("tenantId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "or_time_outs_caseId_key" ON "or_time_outs"("caseId");

-- CreateIndex
CREATE INDEX "or_time_outs_tenantId_caseId_idx" ON "or_time_outs"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "or_anesthesia_records_tenantId_caseId_idx" ON "or_anesthesia_records"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "or_pacu_records_tenantId_caseId_idx" ON "or_pacu_records"("tenantId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "or_surgical_teams_caseId_key" ON "or_surgical_teams"("caseId");

-- CreateIndex
CREATE INDEX "or_surgical_teams_tenantId_caseId_idx" ON "or_surgical_teams"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "or_implants_tenantId_caseId_idx" ON "or_implants"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "or_surgical_counts_tenantId_caseId_idx" ON "or_surgical_counts"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "or_surgical_counts_tenantId_caseId_phase_idx" ON "or_surgical_counts"("tenantId", "caseId", "phase");

-- CreateIndex
CREATE INDEX "or_specimen_logs_tenantId_caseId_idx" ON "or_specimen_logs"("tenantId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "or_nursing_pre_ops_caseId_key" ON "or_nursing_pre_ops"("caseId");

-- CreateIndex
CREATE INDEX "or_nursing_pre_ops_tenantId_caseId_idx" ON "or_nursing_pre_ops"("tenantId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "or_anesthesia_pre_ops_caseId_key" ON "or_anesthesia_pre_ops"("caseId");

-- CreateIndex
CREATE INDEX "or_anesthesia_pre_ops_tenantId_caseId_idx" ON "or_anesthesia_pre_ops"("tenantId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "or_nursing_docs_caseId_key" ON "or_nursing_docs"("caseId");

-- CreateIndex
CREATE INDEX "or_nursing_docs_tenantId_caseId_idx" ON "or_nursing_docs"("tenantId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "or_operative_notes_caseId_key" ON "or_operative_notes"("caseId");

-- CreateIndex
CREATE INDEX "or_operative_notes_tenantId_caseId_idx" ON "or_operative_notes"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "or_operative_notes_tenantId_surgeonUserId_idx" ON "or_operative_notes"("tenantId", "surgeonUserId");

-- CreateIndex
CREATE UNIQUE INDEX "or_post_op_orders_caseId_key" ON "or_post_op_orders"("caseId");

-- CreateIndex
CREATE INDEX "or_post_op_orders_tenantId_caseId_idx" ON "or_post_op_orders"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "or_preference_cards_tenantId_idx" ON "or_preference_cards"("tenantId");

-- CreateIndex
CREATE INDEX "or_preference_cards_tenantId_surgeonId_idx" ON "or_preference_cards"("tenantId", "surgeonId");

-- CreateIndex
CREATE INDEX "or_preference_cards_tenantId_procedureName_idx" ON "or_preference_cards"("tenantId", "procedureName");

-- CreateIndex
CREATE INDEX "or_utilization_snapshots_tenantId_idx" ON "or_utilization_snapshots"("tenantId");

-- CreateIndex
CREATE INDEX "or_utilization_snapshots_tenantId_snapshotDate_idx" ON "or_utilization_snapshots"("tenantId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "or_utilization_snapshots_tenantId_snapshotDate_roomName_key" ON "or_utilization_snapshots"("tenantId", "snapshotDate", "roomName");

-- CreateIndex
CREATE UNIQUE INDEX "orders_hub_idempotencyKey_key" ON "orders_hub"("idempotencyKey");

-- CreateIndex
CREATE INDEX "orders_hub_tenantId_idx" ON "orders_hub"("tenantId");

-- CreateIndex
CREATE INDEX "orders_hub_tenantId_encounterCoreId_idx" ON "orders_hub"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "orders_hub_tenantId_patientMasterId_idx" ON "orders_hub"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "orders_hub_tenantId_status_idx" ON "orders_hub"("tenantId", "status");

-- CreateIndex
CREATE INDEX "orders_hub_tenantId_kind_idx" ON "orders_hub"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "order_events_tenantId_orderId_idx" ON "order_events"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "order_results_tenantId_orderId_idx" ON "order_results"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "lab_results_tenantId_idx" ON "lab_results"("tenantId");

-- CreateIndex
CREATE INDEX "lab_results_tenantId_orderId_idx" ON "lab_results"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "lab_results_tenantId_patientId_idx" ON "lab_results"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "lab_results_tenantId_encounterId_idx" ON "lab_results"("tenantId", "encounterId");

-- CreateIndex
CREATE INDEX "radiology_reports_tenantId_idx" ON "radiology_reports"("tenantId");

-- CreateIndex
CREATE INDEX "radiology_reports_tenantId_orderId_idx" ON "radiology_reports"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "radiology_reports_tenantId_encounterId_idx" ON "radiology_reports"("tenantId", "encounterId");

-- CreateIndex
CREATE INDEX "radiology_reports_tenantId_patientId_idx" ON "radiology_reports"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "connect_results_tenantId_idx" ON "connect_results"("tenantId");

-- CreateIndex
CREATE INDEX "connect_results_tenantId_patientId_idx" ON "connect_results"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "connect_results_tenantId_orderId_idx" ON "connect_results"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "connect_ingest_events_tenantId_idx" ON "connect_ingest_events"("tenantId");

-- CreateIndex
CREATE INDEX "connect_ingest_events_tenantId_dedupeKey_idx" ON "connect_ingest_events"("tenantId", "dedupeKey");

-- CreateIndex
CREATE INDEX "connect_ingest_events_tenantId_clientRequestId_idx" ON "connect_ingest_events"("tenantId", "clientRequestId");

-- CreateIndex
CREATE INDEX "connect_device_vitals_tenantId_idx" ON "connect_device_vitals"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_idempotencyKey_key" ON "attachments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "attachments_tenantId_idx" ON "attachments"("tenantId");

-- CreateIndex
CREATE INDEX "attachments_tenantId_entityType_entityId_idx" ON "attachments"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "result_acks_tenantId_orderResultId_idx" ON "result_acks"("tenantId", "orderResultId");

-- CreateIndex
CREATE INDEX "result_acks_tenantId_idempotencyKey_idx" ON "result_acks"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "result_acks_tenantId_orderResultId_userId_key" ON "result_acks"("tenantId", "orderResultId", "userId");

-- CreateIndex
CREATE INDEX "order_sets_tenantId_idx" ON "order_sets"("tenantId");

-- CreateIndex
CREATE INDEX "order_sets_tenantId_status_idx" ON "order_sets"("tenantId", "status");

-- CreateIndex
CREATE INDEX "order_sets_tenantId_scope_idx" ON "order_sets"("tenantId", "scope");

-- CreateIndex
CREATE INDEX "order_set_items_tenantId_orderSetId_idx" ON "order_set_items"("tenantId", "orderSetId");

-- CreateIndex
CREATE INDEX "order_set_applications_tenantId_encounterRefKey_idx" ON "order_set_applications"("tenantId", "encounterRefKey");

-- CreateIndex
CREATE UNIQUE INDEX "order_set_applications_tenantId_orderSetId_encounterRefKey_key" ON "order_set_applications"("tenantId", "orderSetId", "encounterRefKey");

-- CreateIndex
CREATE INDEX "order_context_links_tenantId_noteId_idx" ON "order_context_links"("tenantId", "noteId");

-- CreateIndex
CREATE UNIQUE INDEX "order_context_links_tenantId_orderId_key" ON "order_context_links"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "order_result_acks_tenantId_orderId_idx" ON "order_result_acks"("tenantId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "order_result_acks_tenantId_orderId_userId_key" ON "order_result_acks"("tenantId", "orderId", "userId");

-- CreateIndex
CREATE INDEX "pathology_specimens_tenantId_idx" ON "pathology_specimens"("tenantId");

-- CreateIndex
CREATE INDEX "pathology_specimens_tenantId_patientMasterId_idx" ON "pathology_specimens"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "pathology_specimens_tenantId_status_idx" ON "pathology_specimens"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pathology_reports_specimenId_key" ON "pathology_reports"("specimenId");

-- CreateIndex
CREATE INDEX "pathology_reports_tenantId_specimenId_idx" ON "pathology_reports"("tenantId", "specimenId");

-- CreateIndex
CREATE INDEX "patient_master_tenantId_idx" ON "patient_master"("tenantId");

-- CreateIndex
CREATE INDEX "patient_master_nameNormalized_idx" ON "patient_master"("nameNormalized");

-- CreateIndex
CREATE INDEX "patient_master_nationalId_idx" ON "patient_master"("nationalId");

-- CreateIndex
CREATE INDEX "patient_master_tenantId_status_idx" ON "patient_master"("tenantId", "status");

-- CreateIndex
CREATE INDEX "patient_master_tenantId_mrn_idx" ON "patient_master"("tenantId", "mrn");

-- CreateIndex
CREATE INDEX "patient_master_tenantId_mobile_idx" ON "patient_master"("tenantId", "mobile");

-- CreateIndex
CREATE UNIQUE INDEX "patient_master_tenantId_nationalId_key" ON "patient_master"("tenantId", "nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_master_tenantId_mrn_key" ON "patient_master"("tenantId", "mrn");

-- CreateIndex
CREATE INDEX "patient_allergies_tenantId_idx" ON "patient_allergies"("tenantId");

-- CreateIndex
CREATE INDEX "patient_allergies_patientId_idx" ON "patient_allergies"("patientId");

-- CreateIndex
CREATE INDEX "patient_problems_tenantId_idx" ON "patient_problems"("tenantId");

-- CreateIndex
CREATE INDEX "patient_problems_patientId_idx" ON "patient_problems"("patientId");

-- CreateIndex
CREATE INDEX "patient_insurance_tenantId_idx" ON "patient_insurance"("tenantId");

-- CreateIndex
CREATE INDEX "patient_insurance_patientId_idx" ON "patient_insurance"("patientId");

-- CreateIndex
CREATE INDEX "patient_insurance_tenantId_insurerId_idx" ON "patient_insurance"("tenantId", "insurerId");

-- CreateIndex
CREATE INDEX "patient_identity_links_tenantId_idx" ON "patient_identity_links"("tenantId");

-- CreateIndex
CREATE INDEX "patient_identity_links_patientId_idx" ON "patient_identity_links"("patientId");

-- CreateIndex
CREATE INDEX "patient_identity_links_system_sourcePatientId_idx" ON "patient_identity_links"("system", "sourcePatientId");

-- CreateIndex
CREATE INDEX "portal_proxy_access_tenantId_idx" ON "portal_proxy_access"("tenantId");

-- CreateIndex
CREATE INDEX "portal_proxy_access_tenantId_patientId_idx" ON "portal_proxy_access"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "portal_proxy_access_tenantId_proxyUserId_idx" ON "portal_proxy_access"("tenantId", "proxyUserId");

-- CreateIndex
CREATE INDEX "pharmacy_inventory_tenantId_idx" ON "pharmacy_inventory"("tenantId");

-- CreateIndex
CREATE INDEX "pharmacy_inventory_tenantId_medicationName_idx" ON "pharmacy_inventory"("tenantId", "medicationName");

-- CreateIndex
CREATE INDEX "pharmacy_prescriptions_tenantId_status_idx" ON "pharmacy_prescriptions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "pharmacy_prescriptions_tenantId_patientId_idx" ON "pharmacy_prescriptions"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "pharmacy_prescriptions_tenantId_ordersHubId_idx" ON "pharmacy_prescriptions"("tenantId", "ordersHubId");

-- CreateIndex
CREATE INDEX "pharmacy_stock_movements_tenantId_inventoryId_idx" ON "pharmacy_stock_movements"("tenantId", "inventoryId");

-- CreateIndex
CREATE INDEX "pharmacy_unit_doses_tenantId_idx" ON "pharmacy_unit_doses"("tenantId");

-- CreateIndex
CREATE INDEX "pharmacy_unit_doses_tenantId_status_idx" ON "pharmacy_unit_doses"("tenantId", "status");

-- CreateIndex
CREATE INDEX "pharmacy_unit_doses_tenantId_wardUnit_idx" ON "pharmacy_unit_doses"("tenantId", "wardUnit");

-- CreateIndex
CREATE INDEX "pharmacy_unit_doses_tenantId_patientId_idx" ON "pharmacy_unit_doses"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "pharmacy_controlled_substance_logs_tenantId_idx" ON "pharmacy_controlled_substance_logs"("tenantId");

-- CreateIndex
CREATE INDEX "pharmacy_controlled_substance_logs_tenantId_medication_idx" ON "pharmacy_controlled_substance_logs"("tenantId", "medication");

-- CreateIndex
CREATE INDEX "pharmacy_controlled_substance_logs_tenantId_transactionType_idx" ON "pharmacy_controlled_substance_logs"("tenantId", "transactionType");

-- CreateIndex
CREATE INDEX "pharmacy_controlled_substance_logs_tenantId_createdAt_idx" ON "pharmacy_controlled_substance_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "pt_referrals_tenantId_idx" ON "pt_referrals"("tenantId");

-- CreateIndex
CREATE INDEX "pt_referrals_tenantId_patientMasterId_idx" ON "pt_referrals"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "pt_referrals_tenantId_status_idx" ON "pt_referrals"("tenantId", "status");

-- CreateIndex
CREATE INDEX "pt_assessments_tenantId_referralId_idx" ON "pt_assessments"("tenantId", "referralId");

-- CreateIndex
CREATE INDEX "pt_sessions_tenantId_referralId_idx" ON "pt_sessions"("tenantId", "referralId");

-- CreateIndex
CREATE INDEX "patient_portal_users_tenantId_idx" ON "patient_portal_users"("tenantId");

-- CreateIndex
CREATE INDEX "patient_portal_users_tenantId_patientMasterId_idx" ON "patient_portal_users"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "patient_portal_users_tenantId_mobile_idx" ON "patient_portal_users"("tenantId", "mobile");

-- CreateIndex
CREATE INDEX "patient_portal_rate_limits_tenantId_type_key_createdAt_idx" ON "patient_portal_rate_limits"("tenantId", "type", "key", "createdAt");

-- CreateIndex
CREATE INDEX "patient_portal_pending_registrations_tenantId_status_idx" ON "patient_portal_pending_registrations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "patient_portal_pending_registrations_tenantId_expiresAt_idx" ON "patient_portal_pending_registrations"("tenantId", "expiresAt");

-- CreateIndex
CREATE INDEX "patient_conversations_tenantId_patientId_idx" ON "patient_conversations"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "patient_messages_tenantId_conversationId_idx" ON "patient_messages"("tenantId", "conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_clinical_history_tenantId_patientId_key" ON "patient_clinical_history"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "patient_chat_sessions_tenantId_patientId_idx" ON "patient_chat_sessions"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "patient_explain_history_tenantId_patientId_idx" ON "patient_explain_history"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "psychiatric_assessments_tenantId_idx" ON "psychiatric_assessments"("tenantId");

-- CreateIndex
CREATE INDEX "psychiatric_assessments_tenantId_patientMasterId_idx" ON "psychiatric_assessments"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "psych_notes_tenantId_assessmentId_idx" ON "psych_notes"("tenantId", "assessmentId");

-- CreateIndex
CREATE INDEX "psych_medications_tenantId_patientMasterId_idx" ON "psych_medications"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "psych_restraint_logs_tenantId_patientMasterId_idx" ON "psych_restraint_logs"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "psych_restraint_logs_tenantId_status_idx" ON "psych_restraint_logs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "psych_risk_assessments_tenantId_patientMasterId_idx" ON "psych_risk_assessments"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "psych_risk_assessments_tenantId_overallRiskLevel_idx" ON "psych_risk_assessments"("tenantId", "overallRiskLevel");

-- CreateIndex
CREATE INDEX "psych_mental_status_exams_tenantId_patientMasterId_idx" ON "psych_mental_status_exams"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "psych_treatment_plans_tenantId_patientMasterId_idx" ON "psych_treatment_plans"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "psych_treatment_plans_tenantId_status_idx" ON "psych_treatment_plans"("tenantId", "status");

-- CreateIndex
CREATE INDEX "psych_progress_notes_tenantId_patientMasterId_idx" ON "psych_progress_notes"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "psych_progress_notes_tenantId_treatmentPlanId_idx" ON "psych_progress_notes"("tenantId", "treatmentPlanId");

-- CreateIndex
CREATE INDEX "psych_progress_notes_tenantId_noteType_idx" ON "psych_progress_notes"("tenantId", "noteType");

-- CreateIndex
CREATE INDEX "psych_scale_administrations_tenantId_patientMasterId_idx" ON "psych_scale_administrations"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "psych_scale_administrations_tenantId_scaleType_idx" ON "psych_scale_administrations"("tenantId", "scaleType");

-- CreateIndex
CREATE INDEX "psych_involuntary_holds_tenantId_patientMasterId_idx" ON "psych_involuntary_holds"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "psych_involuntary_holds_tenantId_status_idx" ON "psych_involuntary_holds"("tenantId", "status");

-- CreateIndex
CREATE INDEX "psych_group_definitions_tenantId_idx" ON "psych_group_definitions"("tenantId");

-- CreateIndex
CREATE INDEX "psych_group_definitions_tenantId_status_idx" ON "psych_group_definitions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "psych_group_sessions_tenantId_groupId_idx" ON "psych_group_sessions"("tenantId", "groupId");

-- CreateIndex
CREATE INDEX "quality_incidents_tenantId_idx" ON "quality_incidents"("tenantId");

-- CreateIndex
CREATE INDEX "quality_incidents_tenantId_status_idx" ON "quality_incidents"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quality_rca_tenantId_incidentId_key" ON "quality_rca"("tenantId", "incidentId");

-- CreateIndex
CREATE INDEX "rca_analyses_tenantId_idx" ON "rca_analyses"("tenantId");

-- CreateIndex
CREATE INDEX "rca_analyses_tenantId_status_idx" ON "rca_analyses"("tenantId", "status");

-- CreateIndex
CREATE INDEX "fmea_analyses_tenantId_idx" ON "fmea_analyses"("tenantId");

-- CreateIndex
CREATE INDEX "fmea_steps_tenantId_analysisId_idx" ON "fmea_steps"("tenantId", "analysisId");

-- CreateIndex
CREATE INDEX "sentinel_events_tenantId_idx" ON "sentinel_events"("tenantId");

-- CreateIndex
CREATE INDEX "sentinel_events_tenantId_status_idx" ON "sentinel_events"("tenantId", "status");

-- CreateIndex
CREATE INDEX "care_gap_rules_tenantId_idx" ON "care_gap_rules"("tenantId");

-- CreateIndex
CREATE INDEX "care_gap_rules_tenantId_isActive_idx" ON "care_gap_rules"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "care_gap_findings_tenantId_idx" ON "care_gap_findings"("tenantId");

-- CreateIndex
CREATE INDEX "care_gap_findings_tenantId_patientId_idx" ON "care_gap_findings"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "care_gap_findings_tenantId_status_idx" ON "care_gap_findings"("tenantId", "status");

-- CreateIndex
CREATE INDEX "care_gap_findings_tenantId_gapType_idx" ON "care_gap_findings"("tenantId", "gapType");

-- CreateIndex
CREATE INDEX "care_gap_findings_tenantId_severity_idx" ON "care_gap_findings"("tenantId", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "care_gap_findings_tenantId_patientId_ruleId_gapType_key" ON "care_gap_findings"("tenantId", "patientId", "ruleId", "gapType");

-- CreateIndex
CREATE INDEX "readmission_records_tenantId_idx" ON "readmission_records"("tenantId");

-- CreateIndex
CREATE INDEX "readmission_records_tenantId_patientId_idx" ON "readmission_records"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "readmission_records_tenantId_reviewStatus_idx" ON "readmission_records"("tenantId", "reviewStatus");

-- CreateIndex
CREATE INDEX "readmission_records_tenantId_readmitDate_idx" ON "readmission_records"("tenantId", "readmitDate");

-- CreateIndex
CREATE UNIQUE INDEX "readmission_records_tenantId_readmitEncounterId_key" ON "readmission_records"("tenantId", "readmitEncounterId");

-- CreateIndex
CREATE INDEX "cbahi_assessments_tenantId_idx" ON "cbahi_assessments"("tenantId");

-- CreateIndex
CREATE INDEX "cbahi_assessments_tenantId_status_idx" ON "cbahi_assessments"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cbahi_evidence_tenantId_idx" ON "cbahi_evidence"("tenantId");

-- CreateIndex
CREATE INDEX "cbahi_evidence_tenantId_assessmentId_idx" ON "cbahi_evidence"("tenantId", "assessmentId");

-- CreateIndex
CREATE INDEX "cbahi_evidence_tenantId_standardId_idx" ON "cbahi_evidence"("tenantId", "standardId");

-- CreateIndex
CREATE INDEX "cdo_outcome_events_tenantId_idx" ON "cdo_outcome_events"("tenantId");

-- CreateIndex
CREATE INDEX "cdo_outcome_events_tenantId_outcomeType_idx" ON "cdo_outcome_events"("tenantId", "outcomeType");

-- CreateIndex
CREATE INDEX "cdo_outcome_events_tenantId_occurredAt_idx" ON "cdo_outcome_events"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "cdo_response_time_metrics_tenantId_idx" ON "cdo_response_time_metrics"("tenantId");

-- CreateIndex
CREATE INDEX "cdo_response_time_metrics_tenantId_metricType_idx" ON "cdo_response_time_metrics"("tenantId", "metricType");

-- CreateIndex
CREATE INDEX "clinical_decision_prompts_tenantId_idx" ON "clinical_decision_prompts"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_decision_prompts_tenantId_status_idx" ON "clinical_decision_prompts"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ipsg_assessments_tenantId_idx" ON "ipsg_assessments"("tenantId");

-- CreateIndex
CREATE INDEX "ipsg_assessments_tenantId_period_idx" ON "ipsg_assessments"("tenantId", "period");

-- CreateIndex
CREATE INDEX "mortality_reviews_tenantId_idx" ON "mortality_reviews"("tenantId");

-- CreateIndex
CREATE INDEX "mortality_reviews_tenantId_patientMasterId_idx" ON "mortality_reviews"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "mortality_reviews_tenantId_status_idx" ON "mortality_reviews"("tenantId", "status");

-- CreateIndex
CREATE INDEX "mortality_reviews_tenantId_dateOfDeath_idx" ON "mortality_reviews"("tenantId", "dateOfDeath");

-- CreateIndex
CREATE INDEX "referrals_tenantId_idx" ON "referrals"("tenantId");

-- CreateIndex
CREATE INDEX "referrals_tenantId_status_idx" ON "referrals"("tenantId", "status");

-- CreateIndex
CREATE INDEX "mortuary_cases_tenantId_idx" ON "mortuary_cases"("tenantId");

-- CreateIndex
CREATE INDEX "mortuary_cases_tenantId_encounterCoreId_idx" ON "mortuary_cases"("tenantId", "encounterCoreId");

-- CreateIndex
CREATE INDEX "mortuary_cases_tenantId_status_idx" ON "mortuary_cases"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_reminders_responseToken_key" ON "appointment_reminders"("responseToken");

-- CreateIndex
CREATE INDEX "appointment_reminders_tenantId_idx" ON "appointment_reminders"("tenantId");

-- CreateIndex
CREATE INDEX "appointment_reminders_tenantId_status_idx" ON "appointment_reminders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "appointment_reminders_tenantId_bookingId_idx" ON "appointment_reminders"("tenantId", "bookingId");

-- CreateIndex
CREATE INDEX "appointment_reminders_tenantId_scheduledAt_idx" ON "appointment_reminders"("tenantId", "scheduledAt");

-- CreateIndex
CREATE INDEX "appointment_reminders_tenantId_appointmentDate_idx" ON "appointment_reminders"("tenantId", "appointmentDate");

-- CreateIndex
CREATE INDEX "appointment_reminders_responseToken_idx" ON "appointment_reminders"("responseToken");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_settings_tenantId_key" ON "reminder_settings"("tenantId");

-- CreateIndex
CREATE INDEX "policy_documents_tenantId_idx" ON "policy_documents"("tenantId");

-- CreateIndex
CREATE INDEX "policy_documents_tenantId_status_idx" ON "policy_documents"("tenantId", "status");

-- CreateIndex
CREATE INDEX "policy_chunks_tenantId_documentId_idx" ON "policy_chunks"("tenantId", "documentId");

-- CreateIndex
CREATE INDEX "policy_alerts_tenantId_idx" ON "policy_alerts"("tenantId");

-- CreateIndex
CREATE INDEX "practices_tenantId_idx" ON "practices"("tenantId");

-- CreateIndex
CREATE INDEX "risk_runs_tenantId_idx" ON "risk_runs"("tenantId");

-- CreateIndex
CREATE INDEX "policies_tenantId_idx" ON "policies"("tenantId");

-- CreateIndex
CREATE INDEX "integrity_findings_tenantId_idx" ON "integrity_findings"("tenantId");

-- CreateIndex
CREATE INDEX "integrity_findings_tenantId_status_idx" ON "integrity_findings"("tenantId", "status");

-- CreateIndex
CREATE INDEX "integrity_runs_tenantId_idx" ON "integrity_runs"("tenantId");

-- CreateIndex
CREATE INDEX "integrity_runs_tenantId_status_idx" ON "integrity_runs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "integrity_rulesets_tenantId_idx" ON "integrity_rulesets"("tenantId");

-- CreateIndex
CREATE INDEX "document_tasks_tenantId_idx" ON "document_tasks"("tenantId");

-- CreateIndex
CREATE INDEX "document_tasks_tenantId_documentId_idx" ON "document_tasks"("tenantId", "documentId");

-- CreateIndex
CREATE INDEX "draft_documents_tenantId_idx" ON "draft_documents"("tenantId");

-- CreateIndex
CREATE INDEX "policy_lifecycle_events_tenantId_idx" ON "policy_lifecycle_events"("tenantId");

-- CreateIndex
CREATE INDEX "policy_lifecycle_events_tenantId_policyId_idx" ON "policy_lifecycle_events"("tenantId", "policyId");

-- CreateIndex
CREATE INDEX "operation_links_tenantId_idx" ON "operation_links"("tenantId");

-- CreateIndex
CREATE INDEX "operation_links_tenantId_documentId_idx" ON "operation_links"("tenantId", "documentId");

-- CreateIndex
CREATE INDEX "operation_links_tenantId_operationId_idx" ON "operation_links"("tenantId", "operationId");

-- CreateIndex
CREATE INDEX "integrity_activity_tenantId_idx" ON "integrity_activity"("tenantId");

-- CreateIndex
CREATE INDEX "sam_compliance_requirements_tenantId_idx" ON "sam_compliance_requirements"("tenantId");

-- CreateIndex
CREATE INDEX "sam_compliance_requirements_tenantId_status_idx" ON "sam_compliance_requirements"("tenantId", "status");

-- CreateIndex
CREATE INDEX "sam_compliance_requirements_tenantId_standardId_idx" ON "sam_compliance_requirements"("tenantId", "standardId");

-- CreateIndex
CREATE INDEX "sam_compliance_violations_tenantId_idx" ON "sam_compliance_violations"("tenantId");

-- CreateIndex
CREATE INDEX "sam_compliance_violations_tenantId_status_idx" ON "sam_compliance_violations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "sam_corrective_actions_tenantId_idx" ON "sam_corrective_actions"("tenantId");

-- CreateIndex
CREATE INDEX "sam_corrective_actions_tenantId_status_idx" ON "sam_corrective_actions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "sam_risk_assessments_tenantId_idx" ON "sam_risk_assessments"("tenantId");

-- CreateIndex
CREATE INDEX "sam_risk_assessments_tenantId_status_idx" ON "sam_risk_assessments"("tenantId", "status");

-- CreateIndex
CREATE INDEX "sam_risk_assessments_tenantId_riskLevel_idx" ON "sam_risk_assessments"("tenantId", "riskLevel");

-- CreateIndex
CREATE INDEX "sam_risk_mitigations_tenantId_idx" ON "sam_risk_mitigations"("tenantId");

-- CreateIndex
CREATE INDEX "sam_risk_mitigations_tenantId_riskId_idx" ON "sam_risk_mitigations"("tenantId", "riskId");

-- CreateIndex
CREATE INDEX "sam_risk_follow_ups_tenantId_idx" ON "sam_risk_follow_ups"("tenantId");

-- CreateIndex
CREATE INDEX "sam_risk_follow_ups_tenantId_riskId_idx" ON "sam_risk_follow_ups"("tenantId", "riskId");

-- CreateIndex
CREATE INDEX "sam_standards_tenantId_idx" ON "sam_standards"("tenantId");

-- CreateIndex
CREATE INDEX "sam_standards_tenantId_framework_idx" ON "sam_standards"("tenantId", "framework");

-- CreateIndex
CREATE UNIQUE INDEX "sam_standards_tenantId_framework_code_key" ON "sam_standards"("tenantId", "framework", "code");

-- CreateIndex
CREATE INDEX "sam_standard_assessments_tenantId_idx" ON "sam_standard_assessments"("tenantId");

-- CreateIndex
CREATE INDEX "sam_standard_assessments_tenantId_standardId_idx" ON "sam_standard_assessments"("tenantId", "standardId");

-- CreateIndex
CREATE INDEX "sam_standard_evidence_tenantId_idx" ON "sam_standard_evidence"("tenantId");

-- CreateIndex
CREATE INDEX "sam_standard_evidence_tenantId_standardId_idx" ON "sam_standard_evidence"("tenantId", "standardId");

-- CreateIndex
CREATE INDEX "sam_policy_acknowledgments_tenantId_idx" ON "sam_policy_acknowledgments"("tenantId");

-- CreateIndex
CREATE INDEX "sam_policy_acknowledgments_tenantId_policyId_idx" ON "sam_policy_acknowledgments"("tenantId", "policyId");

-- CreateIndex
CREATE UNIQUE INDEX "sam_policy_acknowledgments_tenantId_policyId_userId_key" ON "sam_policy_acknowledgments"("tenantId", "policyId", "userId");

-- CreateIndex
CREATE INDEX "sam_reminders_tenantId_idx" ON "sam_reminders"("tenantId");

-- CreateIndex
CREATE INDEX "sam_reminders_tenantId_status_idx" ON "sam_reminders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "sam_reminders_tenantId_type_idx" ON "sam_reminders"("tenantId", "type");

-- CreateIndex
CREATE INDEX "sam_evidence_tenantId_idx" ON "sam_evidence"("tenantId");

-- CreateIndex
CREATE INDEX "sam_evidence_tenantId_referenceId_referenceType_idx" ON "sam_evidence"("tenantId", "referenceId", "referenceType");

-- CreateIndex
CREATE INDEX "scheduling_resources_tenantId_idx" ON "scheduling_resources"("tenantId");

-- CreateIndex
CREATE INDEX "scheduling_resources_tenantId_resourceType_departmentKey_idx" ON "scheduling_resources"("tenantId", "resourceType", "departmentKey");

-- CreateIndex
CREATE INDEX "scheduling_resources_tenantId_displayName_idx" ON "scheduling_resources"("tenantId", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "scheduling_resources_tenantId_resourceType_departmentKey_di_key" ON "scheduling_resources"("tenantId", "resourceType", "departmentKey", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "scheduling_slots_generationKey_key" ON "scheduling_slots"("generationKey");

-- CreateIndex
CREATE INDEX "scheduling_slots_tenantId_resourceId_date_idx" ON "scheduling_slots"("tenantId", "resourceId", "date");

-- CreateIndex
CREATE INDEX "scheduling_slots_tenantId_date_idx" ON "scheduling_slots"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "scheduling_reservations_idempotencyKey_key" ON "scheduling_reservations"("idempotencyKey");

-- CreateIndex
CREATE INDEX "scheduling_reservations_tenantId_idx" ON "scheduling_reservations"("tenantId");

-- CreateIndex
CREATE INDEX "scheduling_reservations_tenantId_slotId_idx" ON "scheduling_reservations"("tenantId", "slotId");

-- CreateIndex
CREATE INDEX "scheduling_reservations_tenantId_resourceId_createdAt_idx" ON "scheduling_reservations"("tenantId", "resourceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "scheduling_reservations_tenantId_slotId_subjectId_key" ON "scheduling_reservations"("tenantId", "slotId", "subjectId");

-- CreateIndex
CREATE INDEX "scheduling_templates_tenantId_idx" ON "scheduling_templates"("tenantId");

-- CreateIndex
CREATE INDEX "scheduling_templates_tenantId_resourceId_idx" ON "scheduling_templates"("tenantId", "resourceId");

-- CreateIndex
CREATE INDEX "scheduling_templates_tenantId_resourceId_status_idx" ON "scheduling_templates"("tenantId", "resourceId", "status");

-- CreateIndex
CREATE INDEX "scheduling_availability_overrides_tenantId_idx" ON "scheduling_availability_overrides"("tenantId");

-- CreateIndex
CREATE INDEX "scheduling_availability_overrides_tenantId_resourceId_idx" ON "scheduling_availability_overrides"("tenantId", "resourceId");

-- CreateIndex
CREATE INDEX "scheduling_availability_overrides_tenantId_resourceId_date_idx" ON "scheduling_availability_overrides"("tenantId", "resourceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "scheduling_availability_overrides_tenantId_resourceId_date_key" ON "scheduling_availability_overrides"("tenantId", "resourceId", "date");

-- CreateIndex
CREATE INDEX "multi_resource_bookings_tenantId_idx" ON "multi_resource_bookings"("tenantId");

-- CreateIndex
CREATE INDEX "multi_resource_bookings_tenantId_status_idx" ON "multi_resource_bookings"("tenantId", "status");

-- CreateIndex
CREATE INDEX "scheduling_waitlist_tenantId_idx" ON "scheduling_waitlist"("tenantId");

-- CreateIndex
CREATE INDEX "scheduling_waitlist_tenantId_status_idx" ON "scheduling_waitlist"("tenantId", "status");

-- CreateIndex
CREATE INDEX "scheduling_waitlist_tenantId_urgency_idx" ON "scheduling_waitlist"("tenantId", "urgency");

-- CreateIndex
CREATE INDEX "taxonomy_sectors_tenantId_idx" ON "taxonomy_sectors"("tenantId");

-- CreateIndex
CREATE INDEX "taxonomy_scopes_tenantId_idx" ON "taxonomy_scopes"("tenantId");

-- CreateIndex
CREATE INDEX "taxonomy_entity_types_tenantId_idx" ON "taxonomy_entity_types"("tenantId");

-- CreateIndex
CREATE INDEX "taxonomy_functions_tenantId_idx" ON "taxonomy_functions"("tenantId");

-- CreateIndex
CREATE INDEX "taxonomy_operations_tenantId_idx" ON "taxonomy_operations"("tenantId");

-- CreateIndex
CREATE INDEX "taxonomy_risk_domains_tenantId_idx" ON "taxonomy_risk_domains"("tenantId");

-- CreateIndex
CREATE INDEX "tele_consultations_tenantId_idx" ON "tele_consultations"("tenantId");

-- CreateIndex
CREATE INDEX "tele_consultations_tenantId_doctorId_idx" ON "tele_consultations"("tenantId", "doctorId");

-- CreateIndex
CREATE INDEX "tele_consultations_tenantId_patientMasterId_idx" ON "tele_consultations"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "tele_availability_tenantId_doctorId_idx" ON "tele_availability"("tenantId", "doctorId");

-- CreateIndex
CREATE INDEX "tele_visits_tenantId_idx" ON "tele_visits"("tenantId");

-- CreateIndex
CREATE INDEX "tele_visits_tenantId_doctorId_idx" ON "tele_visits"("tenantId", "doctorId");

-- CreateIndex
CREATE INDEX "tele_visits_tenantId_patientId_idx" ON "tele_visits"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "tele_visits_tenantId_status_idx" ON "tele_visits"("tenantId", "status");

-- CreateIndex
CREATE INDEX "tele_prescriptions_tenantId_idx" ON "tele_prescriptions"("tenantId");

-- CreateIndex
CREATE INDEX "tele_prescriptions_tenantId_teleVisitId_idx" ON "tele_prescriptions"("tenantId", "teleVisitId");

-- CreateIndex
CREATE INDEX "rpm_devices_tenantId_idx" ON "rpm_devices"("tenantId");

-- CreateIndex
CREATE INDEX "rpm_devices_tenantId_patientId_idx" ON "rpm_devices"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "rpm_readings_tenantId_idx" ON "rpm_readings"("tenantId");

-- CreateIndex
CREATE INDEX "rpm_readings_tenantId_patientId_idx" ON "rpm_readings"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "rpm_readings_tenantId_patientId_readingType_idx" ON "rpm_readings"("tenantId", "patientId", "readingType");

-- CreateIndex
CREATE INDEX "rpm_readings_tenantId_isAbnormal_idx" ON "rpm_readings"("tenantId", "isAbnormal");

-- CreateIndex
CREATE INDEX "rpm_thresholds_tenantId_idx" ON "rpm_thresholds"("tenantId");

-- CreateIndex
CREATE INDEX "rpm_thresholds_tenantId_patientId_idx" ON "rpm_thresholds"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "transplant_cases_tenantId_idx" ON "transplant_cases"("tenantId");

-- CreateIndex
CREATE INDEX "transplant_cases_tenantId_patientMasterId_idx" ON "transplant_cases"("tenantId", "patientMasterId");

-- CreateIndex
CREATE INDEX "transplant_followups_tenantId_caseId_idx" ON "transplant_followups"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "transplant_rejections_tenantId_caseId_idx" ON "transplant_rejections"("tenantId", "caseId");

-- CreateIndex
CREATE INDEX "transplant_waitlist_entries_tenantId_idx" ON "transplant_waitlist_entries"("tenantId");

-- CreateIndex
CREATE INDEX "transplant_waitlist_entries_tenantId_organType_idx" ON "transplant_waitlist_entries"("tenantId", "organType");

-- CreateIndex
CREATE INDEX "transplant_waitlist_entries_tenantId_medicalStatus_idx" ON "transplant_waitlist_entries"("tenantId", "medicalStatus");

-- CreateIndex
CREATE INDEX "transplant_waitlist_entries_tenantId_urgencyStatus_idx" ON "transplant_waitlist_entries"("tenantId", "urgencyStatus");

-- CreateIndex
CREATE INDEX "workflow_routing_rules_tenantId_idx" ON "workflow_routing_rules"("tenantId");

-- CreateIndex
CREATE INDEX "workflow_escalation_rules_tenantId_idx" ON "workflow_escalation_rules"("tenantId");

-- CreateIndex
CREATE INDEX "workflow_escalation_log_tenantId_idx" ON "workflow_escalation_log"("tenantId");

-- CreateIndex
CREATE INDEX "workflow_escalation_log_tenantId_status_idx" ON "workflow_escalation_log"("tenantId", "status");

-- CreateIndex
CREATE INDEX "clinical_pathways_tenantId_idx" ON "clinical_pathways"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_pathway_instances_tenantId_idx" ON "clinical_pathway_instances"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_pathway_instances_tenantId_pathwayId_idx" ON "clinical_pathway_instances"("tenantId", "pathwayId");

-- AddForeignKey
ALTER TABLE "admission_requests" ADD CONSTRAINT "admission_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_checklists" ADD CONSTRAINT "admission_checklists_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_reservations" ADD CONSTRAINT "bed_reservations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_transfer_requests" ADD CONSTRAINT "ward_transfer_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_order_templates" ADD CONSTRAINT "admission_order_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_config" ADD CONSTRAINT "ai_config_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_audit_log" ADD CONSTRAINT "ai_audit_log_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cds_alerts" ADD CONSTRAINT "cds_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_kpi_definitions" ADD CONSTRAINT "analytics_kpi_definitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_kpi_values" ADD CONSTRAINT "analytics_kpi_values_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "infection_events" ADD CONSTRAINT "infection_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveillance_alerts" ADD CONSTRAINT "surveillance_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_day_records" ADD CONSTRAINT "device_day_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hand_hygiene_audits" ADD CONSTRAINT "hand_hygiene_audits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "antibiotic_usage" ADD CONSTRAINT "antibiotic_usage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stewardship_alerts" ADD CONSTRAINT "stewardship_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_errors" ADD CONSTRAINT "medication_errors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "isolation_precautions" ADD CONSTRAINT "isolation_precautions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbreak_events" ADD CONSTRAINT "outbreak_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_catalog" ADD CONSTRAINT "charge_catalog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_catalog_counters" ADD CONSTRAINT "charge_catalog_counters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_events" ADD CONSTRAINT "charge_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_events" ADD CONSTRAINT "claim_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payers" ADD CONSTRAINT "billing_payers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_plans" ADD CONSTRAINT "billing_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_policy_rules" ADD CONSTRAINT "billing_policy_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_lock" ADD CONSTRAINT "billing_lock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_posting" ADD CONSTRAINT "billing_posting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payer_context" ADD CONSTRAINT "payer_context_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_catalog" ADD CONSTRAINT "medication_catalog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nphies_eligibility_logs" ADD CONSTRAINT "nphies_eligibility_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nphies_claims" ADD CONSTRAINT "nphies_claims_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nphies_prior_auths" ADD CONSTRAINT "nphies_prior_auths_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_credit_notes" ADD CONSTRAINT "billing_credit_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_payment_logs" ADD CONSTRAINT "order_payment_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_catalog" ADD CONSTRAINT "service_catalog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_catalog_counters" ADD CONSTRAINT "service_catalog_counters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_usage_events" ADD CONSTRAINT "service_usage_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplies_catalog" ADD CONSTRAINT "supplies_catalog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_catalog_counters" ADD CONSTRAINT "supply_catalog_counters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_usage_events" ADD CONSTRAINT "supply_usage_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_catalog" ADD CONSTRAINT "diagnosis_catalog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_packages" ADD CONSTRAINT "pricing_packages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_package_counters" ADD CONSTRAINT "pricing_package_counters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_package_applications" ADD CONSTRAINT "pricing_package_applications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_usage_idempotency" ADD CONSTRAINT "catalog_usage_idempotency_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_bank_requests" ADD CONSTRAINT "blood_bank_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_units" ADD CONSTRAINT "blood_units_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfusions" ADD CONSTRAINT "transfusions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "blood_bank_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfusions" ADD CONSTRAINT "transfusions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfusion_reactions" ADD CONSTRAINT "transfusion_reactions_transfusionId_fkey" FOREIGN KEY ("transfusionId") REFERENCES "transfusions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfusion_reactions" ADD CONSTRAINT "transfusion_reactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_gaps" ADD CONSTRAINT "care_gaps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_gap_outreach_logs" ADD CONSTRAINT "care_gap_outreach_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_gap_outreach_logs" ADD CONSTRAINT "care_gap_outreach_logs_careGapId_fkey" FOREIGN KEY ("careGapId") REFERENCES "care_gaps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_care_paths" ADD CONSTRAINT "daily_care_paths_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_care_paths" ADD CONSTRAINT "daily_care_paths_patientMasterId_fkey" FOREIGN KEY ("patientMasterId") REFERENCES "patient_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_path_shifts" ADD CONSTRAINT "care_path_shifts_carePathId_fkey" FOREIGN KEY ("carePathId") REFERENCES "daily_care_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_path_shifts" ADD CONSTRAINT "care_path_shifts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_path_tasks" ADD CONSTRAINT "care_path_tasks_carePathId_fkey" FOREIGN KEY ("carePathId") REFERENCES "daily_care_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_path_tasks" ADD CONSTRAINT "care_path_tasks_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "care_path_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_path_tasks" ADD CONSTRAINT "care_path_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_path_alerts" ADD CONSTRAINT "care_path_alerts_carePathId_fkey" FOREIGN KEY ("carePathId") REFERENCES "daily_care_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_path_alerts" ADD CONSTRAINT "care_path_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_visit_notes" ADD CONSTRAINT "opd_visit_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_exams" ADD CONSTRAINT "physical_exams_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_medications" ADD CONSTRAINT "home_medications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "death_declarations" ADD CONSTRAINT "death_declarations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_tasks" ADD CONSTRAINT "clinical_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_task_events" ADD CONSTRAINT "clinical_task_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_handover" ADD CONSTRAINT "clinical_handover_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_consents" ADD CONSTRAINT "clinical_consents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_events" ADD CONSTRAINT "clinical_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consult_requests" ADD CONSTRAINT "consult_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consult_responses" ADD CONSTRAINT "consult_responses_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "consult_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consult_responses" ADD CONSTRAINT "consult_responses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wound_assessments" ADD CONSTRAINT "wound_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutritional_assessments" ADD CONSTRAINT "nutritional_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_work_assessments" ADD CONSTRAINT "social_work_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_work_notes" ADD CONSTRAINT "social_work_notes_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "social_work_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_work_notes" ADD CONSTRAINT "social_work_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_education_records" ADD CONSTRAINT "patient_education_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "infection_surveillance" ADD CONSTRAINT "infection_surveillance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partograms" ADD CONSTRAINT "partograms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partogram_observations" ADD CONSTRAINT "partogram_observations_partogramId_fkey" FOREIGN KEY ("partogramId") REFERENCES "partograms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partogram_observations" ADD CONSTRAINT "partogram_observations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dietary_orders" ADD CONSTRAINT "dietary_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_services" ADD CONSTRAINT "meal_services_dietaryOrderId_fkey" FOREIGN KEY ("dietaryOrderId") REFERENCES "dietary_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_services" ADD CONSTRAINT "meal_services_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tpn_orders" ADD CONSTRAINT "tpn_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_catalog_items" ADD CONSTRAINT "diet_catalog_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calorie_intake_records" ADD CONSTRAINT "calorie_intake_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_staff" ADD CONSTRAINT "transport_staff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulary_drugs" ADD CONSTRAINT "formulary_drugs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulary_restriction_requests" ADD CONSTRAINT "formulary_restriction_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_gas_analyses" ADD CONSTRAINT "blood_gas_analyses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lis_connection_status" ADD CONSTRAINT "lis_connection_status_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_peer_reviews" ADD CONSTRAINT "radiology_peer_reviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_prior_studies" ADD CONSTRAINT "radiology_prior_studies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_meal_plans" ADD CONSTRAINT "kitchen_meal_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_tray_cards" ADD CONSTRAINT "kitchen_tray_cards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iv_admixture_orders" ADD CONSTRAINT "iv_admixture_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adc_cabinets" ADD CONSTRAINT "adc_cabinets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adc_transactions" ADD CONSTRAINT "adc_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adc_inventory" ADD CONSTRAINT "adc_inventory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctg_recordings" ADD CONSTRAINT "ctg_recordings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speech_recognition_sessions" ADD CONSTRAINT "speech_recognition_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_erasure_requests" ADD CONSTRAINT "data_erasure_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_breach_incidents" ADD CONSTRAINT "data_breach_incidents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_administrations" ADD CONSTRAINT "medication_administrations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_administrations" ADD CONSTRAINT "medication_administrations_encounterCoreId_fkey" FOREIGN KEY ("encounterCoreId") REFERENCES "encounter_core"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_administrations" ADD CONSTRAINT "medication_administrations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursing_assessments" ADD CONSTRAINT "nursing_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursing_assessments" ADD CONSTRAINT "nursing_assessments_encounterCoreId_fkey" FOREIGN KEY ("encounterCoreId") REFERENCES "encounter_core"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursing_assessments" ADD CONSTRAINT "nursing_assessments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_infra_providers" ADD CONSTRAINT "clinical_infra_providers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_infra_clinics" ADD CONSTRAINT "clinical_infra_clinics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_infra_specialties" ADD CONSTRAINT "clinical_infra_specialties_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_infra_provider_profiles" ADD CONSTRAINT "clinical_infra_provider_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_infra_provider_profiles" ADD CONSTRAINT "clinical_infra_provider_profiles_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "clinical_infra_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_infra_provider_assignments" ADD CONSTRAINT "clinical_infra_provider_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_infra_provider_assignments" ADD CONSTRAINT "clinical_infra_provider_assignments_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "clinical_infra_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_infra_facilities" ADD CONSTRAINT "clinical_infra_facilities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_infra_floors" ADD CONSTRAINT "clinical_infra_floors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_infra_units" ADD CONSTRAINT "clinical_infra_units_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_infra_rooms" ADD CONSTRAINT "clinical_infra_rooms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_infra_beds" ADD CONSTRAINT "clinical_infra_beds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_infra_provider_unit_scopes" ADD CONSTRAINT "clinical_infra_provider_unit_scopes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_infra_provider_room_assignments" ADD CONSTRAINT "clinical_infra_provider_room_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_stores" ADD CONSTRAINT "consumable_stores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_store_items" ADD CONSTRAINT "consumable_store_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_stock_movements" ADD CONSTRAINT "consumable_stock_movements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_usage_events" ADD CONSTRAINT "consumable_usage_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_usage_templates" ADD CONSTRAINT "consumable_usage_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_id_counters" ADD CONSTRAINT "public_id_counters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_context_packs" ADD CONSTRAINT "tenant_context_packs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_context_overlays" ADD CONSTRAINT "tenant_context_overlays_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "org_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_definitions" ADD CONSTRAINT "role_definitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_groups" ADD CONSTRAINT "org_groups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "org_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_contracts" ADD CONSTRAINT "subscription_contracts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_portal_sessions" ADD CONSTRAINT "patient_portal_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_quotas" ADD CONSTRAINT "usage_quotas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "break_the_glass_requests" ADD CONSTRAINT "break_the_glass_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_credentials" ADD CONSTRAINT "staff_credentials_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_privileges" ADD CONSTRAINT "clinical_privileges_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_alerts" ADD CONSTRAINT "credential_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_api_keys" ADD CONSTRAINT "integration_api_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cssd_trays" ADD CONSTRAINT "cssd_trays_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cssd_cycles" ADD CONSTRAINT "cssd_cycles_trayId_fkey" FOREIGN KEY ("trayId") REFERENCES "cssd_trays"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cssd_cycles" ADD CONSTRAINT "cssd_cycles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cssd_dispatches" ADD CONSTRAINT "cssd_dispatches_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "cssd_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cssd_dispatches" ADD CONSTRAINT "cssd_dispatches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cssd_recalls" ADD CONSTRAINT "cssd_recalls_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_requests" ADD CONSTRAINT "cvision_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_request_events" ADD CONSTRAINT "cvision_request_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_notifications" ADD CONSTRAINT "cvision_notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_notification_preferences" ADD CONSTRAINT "cvision_notification_preferences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_announcements" ADD CONSTRAINT "cvision_announcements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_letters" ADD CONSTRAINT "cvision_letters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_letter_templates" ADD CONSTRAINT "cvision_letter_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_policies" ADD CONSTRAINT "cvision_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_policy_acknowledgments" ADD CONSTRAINT "cvision_policy_acknowledgments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_workflows" ADD CONSTRAINT "cvision_workflows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_workflow_instances" ADD CONSTRAINT "cvision_workflow_instances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_approval_matrix" ADD CONSTRAINT "cvision_approval_matrix_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_delegations" ADD CONSTRAINT "cvision_delegations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_audit_logs" ADD CONSTRAINT "cvision_audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_auth_events" ADD CONSTRAINT "cvision_auth_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_tenant_settings" ADD CONSTRAINT "cvision_tenant_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_sequences" ADD CONSTRAINT "cvision_sequences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_import_jobs" ADD CONSTRAINT "cvision_import_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_deleted_records" ADD CONSTRAINT "cvision_deleted_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_saved_reports" ADD CONSTRAINT "cvision_saved_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_calendar_events" ADD CONSTRAINT "cvision_calendar_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_surveys" ADD CONSTRAINT "cvision_surveys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_survey_responses" ADD CONSTRAINT "cvision_survey_responses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_recognitions" ADD CONSTRAINT "cvision_recognitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_reward_points" ADD CONSTRAINT "cvision_reward_points_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_org_health_assessments" ADD CONSTRAINT "cvision_org_health_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_org_designs" ADD CONSTRAINT "cvision_org_designs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_change_initiatives" ADD CONSTRAINT "cvision_change_initiatives_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_culture_assessments" ADD CONSTRAINT "cvision_culture_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_strategic_alignment" ADD CONSTRAINT "cvision_strategic_alignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_teams" ADD CONSTRAINT "cvision_teams_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_muqeem_records" ADD CONSTRAINT "cvision_muqeem_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_muqeem_alerts" ADD CONSTRAINT "cvision_muqeem_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_integration_configs" ADD CONSTRAINT "cvision_integration_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_integration_logs" ADD CONSTRAINT "cvision_integration_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_retention_scores" ADD CONSTRAINT "cvision_retention_scores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_retention_alerts" ADD CONSTRAINT "cvision_retention_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_dashboards" ADD CONSTRAINT "cvision_dashboards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_shifts" ADD CONSTRAINT "cvision_shifts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_shift_templates" ADD CONSTRAINT "cvision_shift_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_shift_assignments" ADD CONSTRAINT "cvision_shift_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_attendance" ADD CONSTRAINT "cvision_attendance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_attendance_corrections" ADD CONSTRAINT "cvision_attendance_corrections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_biometric_logs" ADD CONSTRAINT "cvision_biometric_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_schedule_entries" ADD CONSTRAINT "cvision_schedule_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_schedule_approvals" ADD CONSTRAINT "cvision_schedule_approvals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_employee_shift_preferences" ADD CONSTRAINT "cvision_employee_shift_preferences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_department_work_schedules" ADD CONSTRAINT "cvision_department_work_schedules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_geofences" ADD CONSTRAINT "cvision_geofences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_departments" ADD CONSTRAINT "cvision_departments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_units" ADD CONSTRAINT "cvision_units_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_job_titles" ADD CONSTRAINT "cvision_job_titles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_grades" ADD CONSTRAINT "cvision_grades_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_branches" ADD CONSTRAINT "cvision_branches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_employees" ADD CONSTRAINT "cvision_employees_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_employee_status_history" ADD CONSTRAINT "cvision_employee_status_history_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_contracts" ADD CONSTRAINT "cvision_contracts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_budgeted_positions" ADD CONSTRAINT "cvision_budgeted_positions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_position_slots" ADD CONSTRAINT "cvision_position_slots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_employee_documents" ADD CONSTRAINT "cvision_employee_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_insurance_providers" ADD CONSTRAINT "cvision_insurance_providers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_insurance_policies" ADD CONSTRAINT "cvision_insurance_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_employee_insurances" ADD CONSTRAINT "cvision_employee_insurances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_insurance_claims" ADD CONSTRAINT "cvision_insurance_claims_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_insurance_requests" ADD CONSTRAINT "cvision_insurance_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_travel_requests" ADD CONSTRAINT "cvision_travel_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_expense_claims" ADD CONSTRAINT "cvision_expense_claims_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_assets" ADD CONSTRAINT "cvision_assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_transport_routes" ADD CONSTRAINT "cvision_transport_routes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_transport_vehicles" ADD CONSTRAINT "cvision_transport_vehicles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_transport_assignments" ADD CONSTRAINT "cvision_transport_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_transport_requests" ADD CONSTRAINT "cvision_transport_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_transport_trips" ADD CONSTRAINT "cvision_transport_trips_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_transport_issues" ADD CONSTRAINT "cvision_transport_issues_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_safety_incidents" ADD CONSTRAINT "cvision_safety_incidents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_grievances" ADD CONSTRAINT "cvision_grievances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_leaves" ADD CONSTRAINT "cvision_leaves_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_leave_balances" ADD CONSTRAINT "cvision_leave_balances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_payroll_profiles" ADD CONSTRAINT "cvision_payroll_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_payroll_runs" ADD CONSTRAINT "cvision_payroll_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_payslips" ADD CONSTRAINT "cvision_payslips_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_payroll_exports" ADD CONSTRAINT "cvision_payroll_exports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_payroll_dry_runs" ADD CONSTRAINT "cvision_payroll_dry_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_loans" ADD CONSTRAINT "cvision_loans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_loan_policies" ADD CONSTRAINT "cvision_loan_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_salary_structures" ADD CONSTRAINT "cvision_salary_structures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_employee_compensations" ADD CONSTRAINT "cvision_employee_compensations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_journal_entries" ADD CONSTRAINT "cvision_journal_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_gl_mappings" ADD CONSTRAINT "cvision_gl_mappings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_department_budgets" ADD CONSTRAINT "cvision_department_budgets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_headcount_budgets" ADD CONSTRAINT "cvision_headcount_budgets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_performance_reviews" ADD CONSTRAINT "cvision_performance_reviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_review_cycles" ADD CONSTRAINT "cvision_review_cycles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_okrs" ADD CONSTRAINT "cvision_okrs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_kpis" ADD CONSTRAINT "cvision_kpis_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_disciplinary_actions" ADD CONSTRAINT "cvision_disciplinary_actions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_promotions" ADD CONSTRAINT "cvision_promotions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_training_courses" ADD CONSTRAINT "cvision_training_courses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_training_enrollments" ADD CONSTRAINT "cvision_training_enrollments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_training_budgets" ADD CONSTRAINT "cvision_training_budgets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_succession_plans" ADD CONSTRAINT "cvision_succession_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_employee_onboardings" ADD CONSTRAINT "cvision_employee_onboardings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_onboarding_templates" ADD CONSTRAINT "cvision_onboarding_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_offboardings" ADD CONSTRAINT "cvision_offboardings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_employee_profile_sections" ADD CONSTRAINT "cvision_employee_profile_sections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_employee_profile_section_history" ADD CONSTRAINT "cvision_employee_profile_section_history_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_profile_section_schemas" ADD CONSTRAINT "cvision_profile_section_schemas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_job_requisitions" ADD CONSTRAINT "cvision_job_requisitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_candidates" ADD CONSTRAINT "cvision_candidates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_candidate_documents" ADD CONSTRAINT "cvision_candidate_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_interviews" ADD CONSTRAINT "cvision_interviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_interview_sessions" ADD CONSTRAINT "cvision_interview_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_job_postings" ADD CONSTRAINT "cvision_job_postings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_applications" ADD CONSTRAINT "cvision_applications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_cv_parse_jobs" ADD CONSTRAINT "cvision_cv_parse_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_cv_inbox_batches" ADD CONSTRAINT "cvision_cv_inbox_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_cv_inbox_items" ADD CONSTRAINT "cvision_cv_inbox_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_talent_pool" ADD CONSTRAINT "cvision_talent_pool_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_killout_questions" ADD CONSTRAINT "cvision_killout_questions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_candidate_rankings" ADD CONSTRAINT "cvision_candidate_rankings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cvision_manpower_plans" ADD CONSTRAINT "cvision_manpower_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_summary" ADD CONSTRAINT "discharge_summary_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_prescriptions" ADD CONSTRAINT "discharge_prescriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "med_reconciliations" ADD CONSTRAINT "med_reconciliations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enhanced_discharge_summaries" ADD CONSTRAINT "enhanced_discharge_summaries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ehr_patients" ADD CONSTRAINT "ehr_patients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ehr_privileges" ADD CONSTRAINT "ehr_privileges_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ehr_encounters" ADD CONSTRAINT "ehr_encounters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ehr_orders" ADD CONSTRAINT "ehr_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ehr_notes" ADD CONSTRAINT "ehr_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ehr_tasks" ADD CONSTRAINT "ehr_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ehr_audit_logs" ADD CONSTRAINT "ehr_audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ehr_users" ADD CONSTRAINT "ehr_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_core" ADD CONSTRAINT "encounter_core_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_core" ADD CONSTRAINT "encounter_core_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_maintenance" ADD CONSTRAINT "equipment_maintenance_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_maintenance" ADD CONSTRAINT "equipment_maintenance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_issues" ADD CONSTRAINT "equipment_issues_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_issues" ADD CONSTRAINT "equipment_issues_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_patients" ADD CONSTRAINT "er_patients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_encounters" ADD CONSTRAINT "er_encounters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_encounters" ADD CONSTRAINT "er_encounters_encounterCoreId_fkey" FOREIGN KEY ("encounterCoreId") REFERENCES "encounter_core"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_encounters" ADD CONSTRAINT "er_encounters_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_triage_assessments" ADD CONSTRAINT "er_triage_assessments_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "er_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_beds" ADD CONSTRAINT "er_beds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_bed_assignments" ADD CONSTRAINT "er_bed_assignments_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "er_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_bed_assignments" ADD CONSTRAINT "er_bed_assignments_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "er_beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_staff_assignments" ADD CONSTRAINT "er_staff_assignments_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "er_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_notes" ADD CONSTRAINT "er_notes_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "er_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_doctor_notes" ADD CONSTRAINT "er_doctor_notes_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "er_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_nursing_notes" ADD CONSTRAINT "er_nursing_notes_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "er_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_nursing_notes" ADD CONSTRAINT "er_nursing_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_dispositions" ADD CONSTRAINT "er_dispositions_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "er_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_dispositions" ADD CONSTRAINT "er_dispositions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_tasks" ADD CONSTRAINT "er_tasks_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "er_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_tasks" ADD CONSTRAINT "er_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_observations" ADD CONSTRAINT "er_observations_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "er_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_observations" ADD CONSTRAINT "er_observations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_escalations" ADD CONSTRAINT "er_escalations_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "er_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_escalations" ADD CONSTRAINT "er_escalations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_notifications" ADD CONSTRAINT "er_notifications_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "er_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_notifications" ADD CONSTRAINT "er_notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_nursing_handovers" ADD CONSTRAINT "er_nursing_handovers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_handovers" ADD CONSTRAINT "admission_handovers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respiratory_screenings" ADD CONSTRAINT "respiratory_screenings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_nursing_transfer_requests" ADD CONSTRAINT "er_nursing_transfer_requests_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "er_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_nursing_transfer_requests" ADD CONSTRAINT "er_nursing_transfer_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_sequences" ADD CONSTRAINT "er_sequences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mci_incidents" ADD CONSTRAINT "mci_incidents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mci_patients" ADD CONSTRAINT "mci_patients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "er_triage_scores" ADD CONSTRAINT "er_triage_scores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_alert_instances" ADD CONSTRAINT "imdad_alert_instances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_alert_rules" ADD CONSTRAINT "imdad_alert_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_annual_budget_plans" ADD CONSTRAINT "imdad_annual_budget_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_approval_decisions" ADD CONSTRAINT "imdad_approval_decisions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_approval_delegations" ADD CONSTRAINT "imdad_approval_delegations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_approval_requests" ADD CONSTRAINT "imdad_approval_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_approval_steps" ADD CONSTRAINT "imdad_approval_steps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_approval_workflow_rule_steps" ADD CONSTRAINT "imdad_approval_workflow_rule_steps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_approval_workflow_rules" ADD CONSTRAINT "imdad_approval_workflow_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_approval_workflow_templates" ADD CONSTRAINT "imdad_approval_workflow_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_asset_disposals" ADD CONSTRAINT "imdad_asset_disposals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_asset_transfers" ADD CONSTRAINT "imdad_asset_transfers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_assets" ADD CONSTRAINT "imdad_assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_attachments" ADD CONSTRAINT "imdad_attachments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_audit_findings" ADD CONSTRAINT "imdad_audit_findings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_audit_log_partitions" ADD CONSTRAINT "imdad_audit_log_partitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_audit_logs" ADD CONSTRAINT "imdad_audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_batch_lots" ADD CONSTRAINT "imdad_batch_lots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_bins" ADD CONSTRAINT "imdad_bins_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_budget_benchmarks" ADD CONSTRAINT "imdad_budget_benchmarks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_budget_consumptions" ADD CONSTRAINT "imdad_budget_consumptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_budget_lines" ADD CONSTRAINT "imdad_budget_lines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_budget_proposals" ADD CONSTRAINT "imdad_budget_proposals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_budget_transfers" ADD CONSTRAINT "imdad_budget_transfers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_budgets" ADD CONSTRAINT "imdad_budgets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_charge_capture_items" ADD CONSTRAINT "imdad_charge_capture_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_charge_captures" ADD CONSTRAINT "imdad_charge_captures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_compliance_certificates" ADD CONSTRAINT "imdad_compliance_certificates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_consumption_logs" ADD CONSTRAINT "imdad_consumption_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_contract_amendments" ADD CONSTRAINT "imdad_contract_amendments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_contract_lines" ADD CONSTRAINT "imdad_contract_lines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_contracts" ADD CONSTRAINT "imdad_contracts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_cost_centers" ADD CONSTRAINT "imdad_cost_centers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_dashboard_configs" ADD CONSTRAINT "imdad_dashboard_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_decision_actions" ADD CONSTRAINT "imdad_decision_actions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_decisions" ADD CONSTRAINT "imdad_decisions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_delegation_chains" ADD CONSTRAINT "imdad_delegation_chains_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_department_users" ADD CONSTRAINT "imdad_department_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_departments" ADD CONSTRAINT "imdad_departments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_device_replacement_plans" ADD CONSTRAINT "imdad_device_replacement_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_dispense_lines" ADD CONSTRAINT "imdad_dispense_lines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_dispense_requests" ADD CONSTRAINT "imdad_dispense_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_event_bus_messages" ADD CONSTRAINT "imdad_event_bus_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_formulary_items" ADD CONSTRAINT "imdad_formulary_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_goods_receiving_note_lines" ADD CONSTRAINT "imdad_goods_receiving_note_lines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_goods_receiving_notes" ADD CONSTRAINT "imdad_goods_receiving_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_grn_discrepancies" ADD CONSTRAINT "imdad_grn_discrepancies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_inspection_checklists" ADD CONSTRAINT "imdad_inspection_checklists_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_inspection_templates" ADD CONSTRAINT "imdad_inspection_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_inventory_adjustments" ADD CONSTRAINT "imdad_inventory_adjustments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_inventory_locations" ADD CONSTRAINT "imdad_inventory_locations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_inventory_transactions" ADD CONSTRAINT "imdad_inventory_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_invoice_lines" ADD CONSTRAINT "imdad_invoice_lines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_invoices" ADD CONSTRAINT "imdad_invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_item_categories" ADD CONSTRAINT "imdad_item_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_item_locations" ADD CONSTRAINT "imdad_item_locations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_item_masters" ADD CONSTRAINT "imdad_item_masters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_item_substitutes" ADD CONSTRAINT "imdad_item_substitutes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_job_executions" ADD CONSTRAINT "imdad_job_executions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_kpi_snapshots" ADD CONSTRAINT "imdad_kpi_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_maintenance_orders" ADD CONSTRAINT "imdad_maintenance_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_non_conformance_reports" ADD CONSTRAINT "imdad_non_conformance_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_notification_preferences" ADD CONSTRAINT "imdad_notification_preferences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_notification_templates" ADD CONSTRAINT "imdad_notification_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_notifications" ADD CONSTRAINT "imdad_notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_operational_signals" ADD CONSTRAINT "imdad_operational_signals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_organizations" ADD CONSTRAINT "imdad_organizations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_patient_charges" ADD CONSTRAINT "imdad_patient_charges_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_patient_returns" ADD CONSTRAINT "imdad_patient_returns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_payment_batches" ADD CONSTRAINT "imdad_payment_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_permissions" ADD CONSTRAINT "imdad_permissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_phased_investments" ADD CONSTRAINT "imdad_phased_investments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_pick_lines" ADD CONSTRAINT "imdad_pick_lines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_pick_lists" ADD CONSTRAINT "imdad_pick_lists_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_print_templates" ADD CONSTRAINT "imdad_print_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_proposal_line_items" ADD CONSTRAINT "imdad_proposal_line_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_purchase_order_lines" ADD CONSTRAINT "imdad_purchase_order_lines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_purchase_orders" ADD CONSTRAINT "imdad_purchase_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_purchase_requisition_lines" ADD CONSTRAINT "imdad_purchase_requisition_lines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_purchase_requisitions" ADD CONSTRAINT "imdad_purchase_requisitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_put_away_lines" ADD CONSTRAINT "imdad_put_away_lines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_put_away_rules" ADD CONSTRAINT "imdad_put_away_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_put_away_tasks" ADD CONSTRAINT "imdad_put_away_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_quality_inspections" ADD CONSTRAINT "imdad_quality_inspections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_recall_actions" ADD CONSTRAINT "imdad_recall_actions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_recalls" ADD CONSTRAINT "imdad_recalls_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_receiving_docks" ADD CONSTRAINT "imdad_receiving_docks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_reorder_rules" ADD CONSTRAINT "imdad_reorder_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_replenishment_rules" ADD CONSTRAINT "imdad_replenishment_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_report_definitions" ADD CONSTRAINT "imdad_report_definitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_report_executions" ADD CONSTRAINT "imdad_report_executions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_role_definitions" ADD CONSTRAINT "imdad_role_definitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_sequence_counters" ADD CONSTRAINT "imdad_sequence_counters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_sfda_integration_logs" ADD CONSTRAINT "imdad_sfda_integration_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_stock_count_items" ADD CONSTRAINT "imdad_stock_count_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_stock_counts" ADD CONSTRAINT "imdad_stock_counts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_stock_reservations" ADD CONSTRAINT "imdad_stock_reservations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_stock_transactions" ADD CONSTRAINT "imdad_stock_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_supply_request_approvals" ADD CONSTRAINT "imdad_supply_request_approvals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_supply_request_audit" ADD CONSTRAINT "imdad_supply_request_audit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_supply_request_items" ADD CONSTRAINT "imdad_supply_request_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_supply_requests" ADD CONSTRAINT "imdad_supply_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_system_configs" ADD CONSTRAINT "imdad_system_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_system_pulses" ADD CONSTRAINT "imdad_system_pulses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_temperature_logs" ADD CONSTRAINT "imdad_temperature_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_transfer_lines" ADD CONSTRAINT "imdad_transfer_lines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_transfer_requests" ADD CONSTRAINT "imdad_transfer_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_units_of_measure" ADD CONSTRAINT "imdad_units_of_measure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_uom_conversions" ADD CONSTRAINT "imdad_uom_conversions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_user_roles" ADD CONSTRAINT "imdad_user_roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_vendor_audits" ADD CONSTRAINT "imdad_vendor_audits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_vendor_contacts" ADD CONSTRAINT "imdad_vendor_contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_vendor_documents" ADD CONSTRAINT "imdad_vendor_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_vendor_scorecards" ADD CONSTRAINT "imdad_vendor_scorecards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_vendors" ADD CONSTRAINT "imdad_vendors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_ward_par_levels" ADD CONSTRAINT "imdad_ward_par_levels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_warehouse_zones" ADD CONSTRAINT "imdad_warehouse_zones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_warehouses" ADD CONSTRAINT "imdad_warehouses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_webhook_deliveries" ADD CONSTRAINT "imdad_webhook_deliveries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imdad_webhooks" ADD CONSTRAINT "imdad_webhooks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_messages" ADD CONSTRAINT "integration_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_config" ADD CONSTRAINT "integration_config_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_adt_events" ADD CONSTRAINT "integration_adt_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fhir_subscriptions" ADD CONSTRAINT "fhir_subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fhir_subscription_log" ADD CONSTRAINT "fhir_subscription_log_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dicom_sources" ADD CONSTRAINT "dicom_sources_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipd_episodes" ADD CONSTRAINT "ipd_episodes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipd_admissions" ADD CONSTRAINT "ipd_admissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipd_beds" ADD CONSTRAINT "ipd_beds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipd_vitals" ADD CONSTRAINT "ipd_vitals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipd_downtime_incidents" ADD CONSTRAINT "ipd_downtime_incidents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipd_icu_events" ADD CONSTRAINT "ipd_icu_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipd_care_plans" ADD CONSTRAINT "ipd_care_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipd_med_order_events" ADD CONSTRAINT "ipd_med_order_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipd_mar_events" ADD CONSTRAINT "ipd_mar_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipd_nursing_assessments" ADD CONSTRAINT "ipd_nursing_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipd_nursing_daily_progress" ADD CONSTRAINT "ipd_nursing_daily_progress_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipd_orders" ADD CONSTRAINT "ipd_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventilator_records" ADD CONSTRAINT "ventilator_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fluid_balance_entries" ADD CONSTRAINT "fluid_balance_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipd_admission_intake" ADD CONSTRAINT "ipd_admission_intake_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "icu_care_plans" ADD CONSTRAINT "icu_care_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sofa_scores" ADD CONSTRAINT "sofa_scores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "icu_ventilator_checks" ADD CONSTRAINT "icu_ventilator_checks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "icu_apache_scores" ADD CONSTRAINT "icu_apache_scores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "icu_sedation_assessments" ADD CONSTRAINT "icu_sedation_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "icu_delirium_screens" ADD CONSTRAINT "icu_delirium_screens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "icu_bundle_compliance" ADD CONSTRAINT "icu_bundle_compliance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "icu_code_blues" ADD CONSTRAINT "icu_code_blues_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_death_protocols" ADD CONSTRAINT "brain_death_protocols_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organ_donations" ADD CONSTRAINT "organ_donations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_specimens" ADD CONSTRAINT "lab_specimens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_critical_alerts" ADD CONSTRAINT "lab_critical_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_qc_results" ADD CONSTRAINT "lab_qc_results_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results_incoming" ADD CONSTRAINT "lab_results_incoming_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_micro_cultures" ADD CONSTRAINT "lab_micro_cultures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_tat_records" ADD CONSTRAINT "lab_tat_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_result_amendments" ADD CONSTRAINT "lab_result_amendments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_auto_validation_rules" ADD CONSTRAINT "lab_auto_validation_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_nodes" ADD CONSTRAINT "org_nodes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_departments" ADD CONSTRAINT "floor_departments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_entries" ADD CONSTRAINT "department_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursing_assignments" ADD CONSTRAINT "nursing_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursing_shift_metrics" ADD CONSTRAINT "nursing_shift_metrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_lookups" ADD CONSTRAINT "identity_lookups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_rate_limits" ADD CONSTRAINT "identity_rate_limits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_apply_idempotency" ADD CONSTRAINT "identity_apply_idempotency_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absher_verification_logs" ADD CONSTRAINT "absher_verification_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nafis_visit_logs" ADD CONSTRAINT "nafis_visit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nafis_statistics_logs" ADD CONSTRAINT "nafis_statistics_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nafis_disease_reports" ADD CONSTRAINT "nafis_disease_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dental_charts" ADD CONSTRAINT "dental_charts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dental_treatments" ADD CONSTRAINT "dental_treatments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obgyn_forms" ADD CONSTRAINT "obgyn_forms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failed_cancellations" ADD CONSTRAINT "failed_cancellations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_experience" ADD CONSTRAINT "patient_experience_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "px_cases" ADD CONSTRAINT "px_cases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dental_procedures" ADD CONSTRAINT "dental_procedures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodontal_records" ADD CONSTRAINT "periodontal_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newborn_records" ADD CONSTRAINT "newborn_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodontal_charts" ADD CONSTRAINT "periodontal_charts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orthodontic_cases" ADD CONSTRAINT "orthodontic_cases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orthodontic_visits" ADD CONSTRAINT "orthodontic_visits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oncology_patients" ADD CONSTRAINT "oncology_patients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oncology_protocols" ADD CONSTRAINT "oncology_protocols_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "oncology_patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oncology_protocols" ADD CONSTRAINT "oncology_protocols_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chemo_cycles" ADD CONSTRAINT "chemo_cycles_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "oncology_patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chemo_cycles" ADD CONSTRAINT "chemo_cycles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tumor_board_cases" ADD CONSTRAINT "tumor_board_cases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chemo_protocol_templates" ADD CONSTRAINT "chemo_protocol_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctcae_toxicity_records" ADD CONSTRAINT "ctcae_toxicity_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tnm_stagings" ADD CONSTRAINT "tnm_stagings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiation_therapy_plans" ADD CONSTRAINT "radiation_therapy_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiation_sessions" ADD CONSTRAINT "radiation_sessions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "radiation_therapy_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiation_sessions" ADD CONSTRAINT "radiation_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_encounters" ADD CONSTRAINT "opd_encounters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_encounters" ADD CONSTRAINT "opd_encounters_encounterCoreId_fkey" FOREIGN KEY ("encounterCoreId") REFERENCES "encounter_core"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_encounters" ADD CONSTRAINT "opd_encounters_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_nursing_entries" ADD CONSTRAINT "opd_nursing_entries_opdEncounterId_fkey" FOREIGN KEY ("opdEncounterId") REFERENCES "opd_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_doctor_entries" ADD CONSTRAINT "opd_doctor_entries_opdEncounterId_fkey" FOREIGN KEY ("opdEncounterId") REFERENCES "opd_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_doctor_addenda" ADD CONSTRAINT "opd_doctor_addenda_opdEncounterId_fkey" FOREIGN KEY ("opdEncounterId") REFERENCES "opd_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_results_viewed" ADD CONSTRAINT "opd_results_viewed_opdEncounterId_fkey" FOREIGN KEY ("opdEncounterId") REFERENCES "opd_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_bookings" ADD CONSTRAINT "opd_bookings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_orders" ADD CONSTRAINT "opd_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_daily_data" ADD CONSTRAINT "opd_daily_data_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_census" ADD CONSTRAINT "opd_census_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_meeting_reports" ADD CONSTRAINT "opd_meeting_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_recommendations" ADD CONSTRAINT "opd_recommendations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_cases" ADD CONSTRAINT "or_cases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_case_events" ADD CONSTRAINT "or_case_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_time_outs" ADD CONSTRAINT "or_time_outs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_anesthesia_records" ADD CONSTRAINT "or_anesthesia_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_pacu_records" ADD CONSTRAINT "or_pacu_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_surgical_teams" ADD CONSTRAINT "or_surgical_teams_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_implants" ADD CONSTRAINT "or_implants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_surgical_counts" ADD CONSTRAINT "or_surgical_counts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_specimen_logs" ADD CONSTRAINT "or_specimen_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_nursing_pre_ops" ADD CONSTRAINT "or_nursing_pre_ops_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_anesthesia_pre_ops" ADD CONSTRAINT "or_anesthesia_pre_ops_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_nursing_docs" ADD CONSTRAINT "or_nursing_docs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_operative_notes" ADD CONSTRAINT "or_operative_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_post_op_orders" ADD CONSTRAINT "or_post_op_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_preference_cards" ADD CONSTRAINT "or_preference_cards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "or_utilization_snapshots" ADD CONSTRAINT "or_utilization_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_hub" ADD CONSTRAINT "orders_hub_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders_hub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_results" ADD CONSTRAINT "order_results_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_results" ADD CONSTRAINT "order_results_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders_hub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radiology_reports" ADD CONSTRAINT "radiology_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connect_results" ADD CONSTRAINT "connect_results_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connect_ingest_events" ADD CONSTRAINT "connect_ingest_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connect_device_vitals" ADD CONSTRAINT "connect_device_vitals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_acks" ADD CONSTRAINT "result_acks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_sets" ADD CONSTRAINT "order_sets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_set_items" ADD CONSTRAINT "order_set_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_set_applications" ADD CONSTRAINT "order_set_applications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_context_links" ADD CONSTRAINT "order_context_links_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_result_acks" ADD CONSTRAINT "order_result_acks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathology_specimens" ADD CONSTRAINT "pathology_specimens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathology_reports" ADD CONSTRAINT "pathology_reports_specimenId_fkey" FOREIGN KEY ("specimenId") REFERENCES "pathology_specimens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pathology_reports" ADD CONSTRAINT "pathology_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_master" ADD CONSTRAINT "patient_master_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_allergies" ADD CONSTRAINT "patient_allergies_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_allergies" ADD CONSTRAINT "patient_allergies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_problems" ADD CONSTRAINT "patient_problems_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_problems" ADD CONSTRAINT "patient_problems_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_insurance" ADD CONSTRAINT "patient_insurance_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_insurance" ADD CONSTRAINT "patient_insurance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_identity_links" ADD CONSTRAINT "patient_identity_links_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_identity_links" ADD CONSTRAINT "patient_identity_links_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_proxy_access" ADD CONSTRAINT "portal_proxy_access_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_inventory" ADD CONSTRAINT "pharmacy_inventory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_prescriptions" ADD CONSTRAINT "pharmacy_prescriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_stock_movements" ADD CONSTRAINT "pharmacy_stock_movements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_unit_doses" ADD CONSTRAINT "pharmacy_unit_doses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_controlled_substance_logs" ADD CONSTRAINT "pharmacy_controlled_substance_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pt_referrals" ADD CONSTRAINT "pt_referrals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pt_assessments" ADD CONSTRAINT "pt_assessments_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "pt_referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pt_assessments" ADD CONSTRAINT "pt_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pt_sessions" ADD CONSTRAINT "pt_sessions_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "pt_referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pt_sessions" ADD CONSTRAINT "pt_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_portal_users" ADD CONSTRAINT "patient_portal_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_portal_rate_limits" ADD CONSTRAINT "patient_portal_rate_limits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_portal_pending_registrations" ADD CONSTRAINT "patient_portal_pending_registrations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_conversations" ADD CONSTRAINT "patient_conversations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_messages" ADD CONSTRAINT "patient_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_clinical_history" ADD CONSTRAINT "patient_clinical_history_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_chat_sessions" ADD CONSTRAINT "patient_chat_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_explain_history" ADD CONSTRAINT "patient_explain_history_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psychiatric_assessments" ADD CONSTRAINT "psychiatric_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psych_notes" ADD CONSTRAINT "psych_notes_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "psychiatric_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psych_notes" ADD CONSTRAINT "psych_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psych_medications" ADD CONSTRAINT "psych_medications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psych_restraint_logs" ADD CONSTRAINT "psych_restraint_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psych_risk_assessments" ADD CONSTRAINT "psych_risk_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psych_mental_status_exams" ADD CONSTRAINT "psych_mental_status_exams_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psych_treatment_plans" ADD CONSTRAINT "psych_treatment_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psych_progress_notes" ADD CONSTRAINT "psych_progress_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psych_scale_administrations" ADD CONSTRAINT "psych_scale_administrations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psych_involuntary_holds" ADD CONSTRAINT "psych_involuntary_holds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psych_group_definitions" ADD CONSTRAINT "psych_group_definitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psych_group_sessions" ADD CONSTRAINT "psych_group_sessions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "psych_group_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psych_group_sessions" ADD CONSTRAINT "psych_group_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_incidents" ADD CONSTRAINT "quality_incidents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_rca" ADD CONSTRAINT "quality_rca_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rca_analyses" ADD CONSTRAINT "rca_analyses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fmea_analyses" ADD CONSTRAINT "fmea_analyses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fmea_steps" ADD CONSTRAINT "fmea_steps_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "fmea_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fmea_steps" ADD CONSTRAINT "fmea_steps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentinel_events" ADD CONSTRAINT "sentinel_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_gap_rules" ADD CONSTRAINT "care_gap_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_gap_findings" ADD CONSTRAINT "care_gap_findings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "readmission_records" ADD CONSTRAINT "readmission_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbahi_assessments" ADD CONSTRAINT "cbahi_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbahi_evidence" ADD CONSTRAINT "cbahi_evidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdo_outcome_events" ADD CONSTRAINT "cdo_outcome_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdo_response_time_metrics" ADD CONSTRAINT "cdo_response_time_metrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_decision_prompts" ADD CONSTRAINT "clinical_decision_prompts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipsg_assessments" ADD CONSTRAINT "ipsg_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mortality_reviews" ADD CONSTRAINT "mortality_reviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mortuary_cases" ADD CONSTRAINT "mortuary_cases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_settings" ADD CONSTRAINT "reminder_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_documents" ADD CONSTRAINT "policy_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_chunks" ADD CONSTRAINT "policy_chunks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_alerts" ADD CONSTRAINT "policy_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practices" ADD CONSTRAINT "practices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_runs" ADD CONSTRAINT "risk_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrity_findings" ADD CONSTRAINT "integrity_findings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrity_runs" ADD CONSTRAINT "integrity_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrity_rulesets" ADD CONSTRAINT "integrity_rulesets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_tasks" ADD CONSTRAINT "document_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_documents" ADD CONSTRAINT "draft_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_lifecycle_events" ADD CONSTRAINT "policy_lifecycle_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_links" ADD CONSTRAINT "operation_links_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrity_activity" ADD CONSTRAINT "integrity_activity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sam_compliance_requirements" ADD CONSTRAINT "sam_compliance_requirements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sam_compliance_violations" ADD CONSTRAINT "sam_compliance_violations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sam_corrective_actions" ADD CONSTRAINT "sam_corrective_actions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sam_risk_assessments" ADD CONSTRAINT "sam_risk_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sam_risk_mitigations" ADD CONSTRAINT "sam_risk_mitigations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sam_risk_follow_ups" ADD CONSTRAINT "sam_risk_follow_ups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sam_standards" ADD CONSTRAINT "sam_standards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sam_standard_assessments" ADD CONSTRAINT "sam_standard_assessments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sam_standard_evidence" ADD CONSTRAINT "sam_standard_evidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sam_policy_acknowledgments" ADD CONSTRAINT "sam_policy_acknowledgments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sam_reminders" ADD CONSTRAINT "sam_reminders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sam_evidence" ADD CONSTRAINT "sam_evidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_resources" ADD CONSTRAINT "scheduling_resources_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_slots" ADD CONSTRAINT "scheduling_slots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_slots" ADD CONSTRAINT "scheduling_slots_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "scheduling_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_reservations" ADD CONSTRAINT "scheduling_reservations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_reservations" ADD CONSTRAINT "scheduling_reservations_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "scheduling_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_reservations" ADD CONSTRAINT "scheduling_reservations_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "scheduling_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_templates" ADD CONSTRAINT "scheduling_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_availability_overrides" ADD CONSTRAINT "scheduling_availability_overrides_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_availability_overrides" ADD CONSTRAINT "scheduling_availability_overrides_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "scheduling_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multi_resource_bookings" ADD CONSTRAINT "multi_resource_bookings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_waitlist" ADD CONSTRAINT "scheduling_waitlist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxonomy_sectors" ADD CONSTRAINT "taxonomy_sectors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxonomy_scopes" ADD CONSTRAINT "taxonomy_scopes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxonomy_entity_types" ADD CONSTRAINT "taxonomy_entity_types_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxonomy_functions" ADD CONSTRAINT "taxonomy_functions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxonomy_operations" ADD CONSTRAINT "taxonomy_operations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxonomy_risk_domains" ADD CONSTRAINT "taxonomy_risk_domains_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tele_consultations" ADD CONSTRAINT "tele_consultations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tele_availability" ADD CONSTRAINT "tele_availability_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tele_visits" ADD CONSTRAINT "tele_visits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tele_prescriptions" ADD CONSTRAINT "tele_prescriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rpm_devices" ADD CONSTRAINT "rpm_devices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rpm_readings" ADD CONSTRAINT "rpm_readings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rpm_thresholds" ADD CONSTRAINT "rpm_thresholds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transplant_cases" ADD CONSTRAINT "transplant_cases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transplant_followups" ADD CONSTRAINT "transplant_followups_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "transplant_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transplant_followups" ADD CONSTRAINT "transplant_followups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transplant_rejections" ADD CONSTRAINT "transplant_rejections_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "transplant_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transplant_rejections" ADD CONSTRAINT "transplant_rejections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transplant_waitlist_entries" ADD CONSTRAINT "transplant_waitlist_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_routing_rules" ADD CONSTRAINT "workflow_routing_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_escalation_rules" ADD CONSTRAINT "workflow_escalation_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_escalation_log" ADD CONSTRAINT "workflow_escalation_log_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_pathways" ADD CONSTRAINT "clinical_pathways_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_pathway_instances" ADD CONSTRAINT "clinical_pathway_instances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

