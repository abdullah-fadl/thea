-- ============================================
-- THEA EHR: Wipe ALL data — Fresh start
-- Run this in Supabase SQL Editor
-- ============================================

DO $$
DECLARE
  tbl TEXT;
  all_tables TEXT[] := ARRAY[
    -- Leaf / audit
    'ai_audit_log','ai_config','cds_alerts',
    'fhir_subscription_log','fhir_subscriptions',
    'integration_messages','integration_config','integration_adt_events',
    'instruments','dicom_sources',
    'audit_logs','notifications','usage_quotas',
    'approved_access_audit_logs','approved_access_tokens',
    'absher_verification_logs','nafis_visit_logs','nafis_statistics_logs','nafis_disease_reports',
    'status_checks','failed_cancellations',
    'identity_lookups','identity_rate_limits','identity_apply_idempotency',
    -- Analytics / Quality / SAM / Workflow
    'analytics_kpi_values','analytics_kpi_definitions',
    'infection_events','surveillance_alerts','antibiotic_usage','stewardship_alerts','medication_errors',
    'quality_incidents','quality_rca',
    'policy_documents','policy_chunks','policy_alerts','practices','risk_runs','policies',
    'integrity_findings','integrity_runs','integrity_rulesets',
    'document_tasks','draft_documents','policy_lifecycle_events','operation_links','integrity_activity',
    'workflow_routing_rules','workflow_escalation_rules','workflow_escalation_log',
    'clinical_pathways','clinical_pathway_instances',
    'taxonomy_sectors','taxonomy_scopes','taxonomy_entity_types','taxonomy_functions','taxonomy_operations','taxonomy_risk_domains',
    -- Portal / Chat
    'patient_portal_sessions','patient_portal_rate_limits','patient_portal_pending_registrations',
    'patient_portal_users','patient_messages','patient_conversations',
    'patient_clinical_history','patient_chat_sessions','patient_explain_history','patient_experience',
    'otp_tokens',
    -- Billing / Pharmacy / Consumables
    'order_payment_logs','billing_posting','billing_lock','billing_payments','billing_invoices',
    'claim_events','claims','charge_events','charge_catalog','charge_catalog_counters',
    'billing_payers','billing_plans','billing_policy_rules',
    'nphies_eligibility_logs','nphies_claims','nphies_prior_auths','payer_context',
    'medication_catalog','promo_codes',
    'service_catalog','service_catalog_counters','service_usage_events',
    'supplies_catalog','supply_catalog_counters','supply_usage_events',
    'diagnosis_catalog','pricing_packages','pricing_package_counters','pricing_package_applications',
    'catalog_usage_idempotency',
    'pharmacy_stock_movements','pharmacy_prescriptions','pharmacy_inventory',
    'consumable_stock_movements','consumable_usage_events','consumable_usage_templates',
    'consumable_store_items','consumable_stores',
    -- Lab / Radiology / Results
    'lab_qc_results','lab_results_incoming','lab_critical_alerts','lab_specimens','lab_orders',
    'lab_results','radiology_reports','connect_results','connect_ingest_events','connect_device_vitals',
    'attachments','result_acks','order_result_acks','order_context_links',
    'order_set_applications','order_set_items','order_sets',
    -- Discharge / Referrals / Care Gaps
    'discharge_prescriptions','discharge_summary','med_reconciliations',
    'referrals','mortuary_cases','care_gap_outreach_logs','care_gaps',
    'dental_charts','dental_treatments','obgyn_forms',
    -- Clinical
    'clinical_events','clinical_consents','clinical_handover','clinical_notes','clinical_tasks',
    'physical_exams','opd_visit_notes','home_medications','death_declarations',
    -- ER
    'er_nursing_transfer_requests','er_nursing_handovers','admission_handovers','respiratory_screenings',
    'er_notifications','er_escalations','er_observations','er_tasks','er_dispositions',
    'er_nursing_notes','er_doctor_notes','er_notes','er_staff_assignments','er_bed_assignments',
    'er_triage_assessments','er_encounters','er_patients','er_beds','er_sequences',
    -- IPD
    'ipd_mar_events','ipd_med_order_events','ipd_nursing_daily_progress','ipd_nursing_assessments',
    'ipd_care_plans','ipd_icu_events','ipd_downtime_incidents','ipd_vitals','ipd_orders',
    'ipd_admission_intake','ipd_admissions','ipd_episodes','ipd_beds',
    -- OR
    'or_case_events','or_cases',
    -- OPD
    'opd_results_viewed','opd_doctor_addenda','opd_doctor_entries','opd_nursing_entries',
    'opd_recommendations','opd_meeting_reports','opd_census','opd_daily_data',
    'opd_orders','opd_bookings','opd_encounters',
    -- Orders
    'order_events','order_results','orders_hub',
    -- Encounters
    'encounter_core',
    -- Patients
    'patient_allergies','patient_problems','patient_insurance','patient_identity_links','patient_master',
    -- Scheduling
    'scheduling_reservations','scheduling_slots','scheduling_availability_overrides',
    'scheduling_templates','scheduling_resources',
    -- EHR Admin
    'ehr_audit_logs','ehr_tasks','ehr_notes','ehr_orders','ehr_encounters','ehr_privileges','ehr_patients','ehr_users',
    -- Clinical Infrastructure
    'clinical_infra_provider_room_assignments','clinical_infra_provider_unit_scopes',
    'clinical_infra_provider_assignments','clinical_infra_provider_profiles',
    'clinical_infra_beds','clinical_infra_rooms','clinical_infra_units','clinical_infra_floors',
    'clinical_infra_facilities','clinical_infra_specialties','clinical_infra_clinics','clinical_infra_providers',
    'departments',
    -- Org / Misc
    'department_entries','floor_departments','org_nodes','org_groups','hospitals',
    'equipment','nursing_assignments','groups','organization_profiles',
    -- Auth / Sessions
    'refresh_tokens','session_states','sessions','login_attempts','tenant_users','role_definitions',
    -- Users
    'users',
    -- Tenant settings
    'tenant_context_overlays','tenant_context_packs','tenant_settings','public_id_counters','subscription_contracts',
    -- Tenants (last)
    'tenants'
  ];
BEGIN
  FOREACH tbl IN ARRAY all_tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('TRUNCATE TABLE public.%I CASCADE', tbl);
      RAISE NOTICE 'Truncated: %', tbl;
    ELSE
      RAISE NOTICE 'Skipped (not found): %', tbl;
    END IF;
  END LOOP;
  RAISE NOTICE '✅ ALL DONE — Database is clean!';
END $$;
