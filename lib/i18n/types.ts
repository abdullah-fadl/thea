/**
 * Internationalization (i18n) Type Definitions
 */

export type Language = 'ar' | 'en';

export interface Translations {
  // Common
  common: {
    [key: string]: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    update: string;
    search: string;
    filter: string;
    export: string;
    import: string;
    loading: string;
    error: string;
    success: string;
    confirm: string;
    close: string;
    back: string;
    next: string;
    previous: string;
    submit: string;
    reset: string;
    select: string;
    selectAll: string;
    clear: string;
    yes: string;
    no: string;
    ok: string;
    accessDenied: string;
    contactAdmin: string;
    more: string;
    clearAll: string;
    filterDescription: string;
  };

  // Navigation
  nav: {
    [key: string]: string;
    dashboard: string;
    notifications: string;
    opdDashboard: string;
    scheduling: string;
    er: string;
    patientExperience: string;
    ipd: string;
    equipment: string;
    equipmentOPD: string;
    equipmentIPD: string;
    manpowerNursing: string;
    policySystem: string;
    admin: string;
    account: string;
    // OPD Submenu
    overview: string;
    clinicCensus: string;
    performanceComparison: string;
    clinicUtilization: string;
    dailyDataEntry: string;
    // Scheduling Submenu
    schedule: string;
    availability: string;
    // ER Submenu
    patientRegistration: string;
    triage: string;
    disposition: string;
    progressNote: string;
    // Patient Experience Submenu
    analytics: string;
    reports: string;
    allVisits: string;
    cases: string;
    visitWizard: string;
    setup: string;
    seedData: string;
    deleteAllData: string;
    // IPD Submenu
    bedSetup: string;
    liveBeds: string;
    departmentInput: string;
    // Equipment OPD Submenu
    master: string;
    clinicMap: string;
    checklist: string;
    movements: string;
    // Equipment IPD Submenu
    map: string;
    dailyChecklist: string;
    // Manpower Submenu
    manpowerOverview: string;
    manpowerEdit: string;
    weeklyScheduling: string;
    nursingOperations: string;
    // Policy Submenu
    uploadPolicy: string;
    library: string;
    policyConflicts: string;
    policyCreate: string;
    policyAssistant: string;
    newPolicyCreator: string;
    policyHarmonization: string;
    // Admin Submenu
    dataAdmin: string;
    deleteSampleData: string;
    users: string;
  };

  // Header
  header: {
    hospitalOS: string;
    logout: string;
    welcome: string;
  };

  // Auth
  auth: {
    login: string;
    logout: string;
    email: string;
    password: string;
    signIn: string;
    signingIn: string;
    signInToAccess: string;
    defaultCredentials: string;
    welcome: string;
    enterEmailToContinue: string;
    emailPlaceholder: string;
    tryDemoEmails: string;
    checking: string;
    continue: string;
    back: string;
    tenantFound: string;
    continueWithOrganization: string;
    enterPassword: string;
    passwordPlaceholder: string;
    welcomeBackTo: string;
    demoPassword: string;
    noTenantFound: string;
    invalidPassword: string;
    networkError: string;
    advancedEHR: string;
    organizationVerified: string;
    finalStep: string;
    theme: string;
    language: string;
    selectTenant: string;
  };

  // User Management
  users: {
    title: string;
    userManagement: string;
    manageUsersRoles: string;
    addUser: string;
    createUser: string;
    editUser: string;
    editUserPermissions: string;
    firstName: string;
    lastName: string;
    name: string;
    role: string;
    department: string;
    isActive: string;
    permissions: string;
    updateUser: string;
    updating: string;
    creating: string;
    selectAll: string;
    newPassword: string;
    newPasswordOptional: string;
    leaveEmptyToKeep: string;
    allUsers: string;
    viewManageUsers: string;
    status: string;
    actions: string;
    updatePermissions: string;
    deleteUser: string;
    areYouSureDelete: string;
    userCreatedSuccess: string;
    userUpdatedSuccess: string;
    userDeletedSuccess: string;
    addNewUserToSystem: string;
    permissionsCount: string;
    active: string;
    inactive: string;
    staffId: string;
    staffIdPlaceholder: string;
  };

  // Roles
  roles: {
    admin: string;
    supervisor: string;
    staff: string;
    viewer: string;
  };

  // Dashboard
  dashboard: {
    home: string;
    loadingData: string;
    forSelectedPeriod: string;
    fromLastPeriod: string;
    stable: string;
    bedsOccupied: string;
    quickActions: string;
    commonTasks: string;
    viewOPDCensus: string;
    dailyClinicActivity: string;
    viewLiveBeds: string;
    currentBedStatus: string;
    viewEquipment: string;
    equipmentManagement: string;
    recentActivity: string;
    latestSystemUpdates: string;
    liveBedStatus: string;
    realTimeOccupancy: string;
    equipmentChecklist: string;
    dailyEquipmentChecks: string;
    systemStatus: string;
    platformHealthConnectivity: string;
    database: string;
    connected: string;
    apiServices: string;
    operational: string;
    aiServices: string;
    ready: string;
    opdDataUpdated: string;
    newEquipmentAdded: string;
    bedOccupancyAlert: string;
    minutesAgo: string;
    hoursAgo: string;
    // KPI Titles
    opdVisits: string;
    erVisits: string;
    bedOccupancy: string;
    orOperations: string;
    lapOperations: string;
    radiology: string;
    kathLap: string;
    endoscopy: string;
    physiotherapy: string;
    deliveries: string;
    deaths: string;
    pharmacyVisits: string;
    // KPI Descriptions
    emergencyRoomVisits: string;
    operatingRoomProcedures: string;
    laparoscopicProcedures: string;
    imagingStudies: string;
    catheterizationProcedures: string;
    endoscopicProcedures: string;
    physicalTherapySessions: string;
    births: string;
    mortalityCount: string;
    pharmacyConsultations: string;
  };

  // Account
  account: {
    accountSettings: string;
    manageAccountPreferences: string;
    profileInformation: string;
    accountDetails: string;
    changePassword: string;
    updatePassword: string;
    currentPassword: string;
    confirmNewPassword: string;
    changing: string;
    passwordChangedSuccess: string;
    passwordsDoNotMatch: string;
    failedToChangePassword: string;
  };

  owner: {
    changePassword: string;
    changePasswordDesc: string;
    clickToChange: string;
    currentPassword: string;
    enterCurrentPassword: string;
    newPassword: string;
    enterNewPassword: string;
    confirmNewPassword: string;
    reenterNewPassword: string;
    enterCurrentAndNew: string;
    passwordMinLength: string;
    passwordsDoNotMatch: string;
    passwordChangedSuccess: string;
    failedToChange: string;
    connectionFailed: string;
    invalidCurrentPassword: string;
  };

  // OPD Dashboard
  opd: {
    opdDashboard: string;
    totalVisits: string;
    activeClinics: string;
    avgUtilization: string;
    clinicCapacityUsage: string;
    dailyCensus: string;
    viewPatientCountsPerClinic: string;
    clinicUtilization: string;
    analyzeClinicCapacityUsage: string;
    doctorsView: string;
    doctorSchedulesWorkload: string;
    outpatientDepartmentOverview: string;
    showFilter: string;
    hideFilter: string;
    newPatients: string;
    firstTimeVisits: string;
    followUpVisits: string;
    returningPatients: string;
  };

  // Patient Experience
  px: {
    title: string;
    subtitle: string;
    setup: {
      title: string;
      subtitle: string;
      addData: string;
      chooseDataType: string;
      floor: string;
      department: string;
      room: string;
      classification: string;
      nursingClassification: string;
      existingFloors: string;
      existingDepartments: string;
      existingRooms: string;
      existingClassifications: string;
      noFloors: string;
      noDepartments: string;
      noRooms: string;
      noClassifications: string;
      addNew: string;
      editItem: string;
      deleteItem: string;
      floorNumber: string;
      floorName: string;
      chooseFloor: string;
      departmentName: string;
      roomNumber: string;
      category: string;
      praise: string;
      complaint: string;
      classificationName: string;
      nursingType: string;
      chooseDepartment: string;
      chooseCategory: string;
      nursingClassificationName: string;
      existingNursingClassifications: string;
      noNursingClassifications: string;
    };
    visit: {
      title: string;
      subtitle: string;
      stepStaff: string;
      stepVisit: string;
      stepPatient: string;
      stepClassification: string;
      stepDetails: string;
      stepSummary: string;
      staffName: string;
      staffId: string;
      floor: string;
      department: string;
      room: string;
      patientName: string;
      patientFileNumber: string;
      domain: string;
      classification: string;
      severity: string;
      details: string;
      complainedStaff: string;
      success: string;
      successMessage: string;
      newRecord: string;
      autoFilledFromAccount: string;
      addStaffIdInUsersPage: string;
      staffNameRequired: string;
      staffIdRequired: string;
    };
    analytics: {
      title: string;
      subtitle: string;
      totalVisits: string;
      avgSatisfaction: string;
      openCases: string;
      avgResolution: string;
      trends: string;
      trendsDescription: string;
      topDepartments: string;
      complaintTypes: string;
      severityMix: string;
      exportData: string;
      exportDataDescription: string;
      exportVisits: string;
      exportCases: string;
      noData: string;
      complaints: string;
      praise: string;
      cases: string;
      overdue: string;
      total: string;
      minutes: string;
      slaBreach: string;
      praiseRatio: string;
    };
    reports: {
      title: string;
      subtitle: string;
      reportType: string;
      reportTypeDescription: string;
      executiveSummary: string;
      slaBreachReport: string;
      topComplaints: string;
      visitsLog: string;
      exportReport: string;
      exportReportDescription: string;
      exportCsv: string;
      exportExcel: string;
      exportPdf: string;
      exportSuccessful: string;
      exportFailed: string;
    };
  };

  // CVision
  cvision: {
    nav: { [key: string]: string };
    modules: { [key: string]: string };
    employee: { [key: string]: string };
    attendance: { [key: string]: string };
    payroll: { [key: string]: string };
    leaves: { [key: string]: string };
    headcount: { [key: string]: string };
    integrations: { [key: string]: string };
    reports: { [key: string]: string };
    notifications: { [key: string]: string };
    common: { [key: string]: string };
  };

  // Policy System
  policies: {
    library: {
      title: string;
      subtitle: string;
      uploadPolicies: string;
      uploading: string;
      policies: string;
      listDescription: string;
      filename: string;
      policyId: string;
      status: string;
      pages: string;
      progress: string;
      indexedAt: string;
      actions: string;
      loadingPolicies: string;
      noPoliciesFound: string;
      uploadFirstPolicy: string;
      uploadingFiles: string;
      processingIndexing: string;
      policyPreview: string;
      previewAvailableOnly: string;
      policyNotReady: string;
      stillProcessing: string;
      policyNotFound: string;
      mayHaveBeenDeleted: string;
      reRunOcr: string;
      reIndexAllChunks: string;
      processing: string;
      reIndex: string;
      scannedPdfNotIndexed: string;
      ocrRequired: string;
      indexed: string;
      notIndexed: string;
      page: string;
      of: string;
      areYouSureDelete: string;
      fileAlreadyExists: string;
      followingFilesExist: string;
      preview: string;
      uploadPolicy: string;
      viewPdf: string;
      selectAtLeastOne: string;
    };
    conflicts: {
      title: string;
      scanPolicies: string;
      selectPolicyA: string;
      selectPolicyB: string;
      selectPolicies: string;
      comparePolicies: string;
      strictness: string;
      strict: string;
      balanced: string;
      limitPolicies: string;
      scan: string;
      scanning: string;
      issuesFound: string;
      issueType: string;
      severity: string;
      summary: string;
      recommendation: string;
      viewDetails: string;
      noIssuesFound: string;
      selectPolicyToRewrite: string;
      rewritePolicy: string;
      rewriteAll: string;
      rewriteAgain: string;
      downloadPolicy: string;
      downloadAsText: string;
      downloadAsPdf: string;
      copied: string;
      recommendationCopied: string;
      accreditation: string;
      selectAccreditations: string;
      customAccreditation: string;
      enterCustomAccreditation: string;
      aiReview: string;
      aiIssues: string;
      aiRewrite: string;
      findConflictsGapsRisks: string;
      generateAnswer: string;
      generating: string;
    };
    assistant: {
      title: string;
      subtitle: string;
      askQuestion: string;
      searchPolicies: string;
      selectHospital: string;
      selectCategory: string;
      generateAnswer: string;
      generating: string;
      questionPlaceholder: string;
    };
    newPolicy: {
      title: string;
      subtitle: string;
      policyDetails: string;
      fillInDetails: string;
      policyTitle: string;
      domain: string;
      detailLevel: string;
      brief: string;
      standard: string;
      detailed: string;
      accreditationFocus: string;
      riskLevel: string;
      selectRiskLevelOptional: string;
      low: string;
      medium: string;
      high: string;
      critical: string;
      purpose: string;
      scope: string;
      keyRules: string;
      monitoring: string;
      notes: string;
      generatePolicy: string;
      generating: string;
      downloadPolicy: string;
      downloadAsText: string;
      downloadAsPdf: string;
      generatedPolicy: string;
      aiGeneratedPolicyDocument: string;
      generatedPolicyWillAppear: string;
      fillFormAndClick: string;
      pleaseEnterPolicyTitle: string;
    };
    harmonization: {
      title: string;
      subtitle: string;
      selectDocuments: string;
      chooseHospitalsCategoryMethod: string;
      hospital: string;
      category: string;
      categoryFilter: string;
      compareMethod: string;
      allHospitals: string;
      topicQuery: string;
      autoPickNPolicies: string;
      manualSelection: string;
      allPolicies: string;
      allPoliciesWarning: string;
      topicQueryPlaceholder: string;
      step1Summarize: string;
      step2Harmonize: string;
      summarizing: string;
      harmonizing: string;
      availableDocuments: string;
      selectDocumentsToCompare: string;
      summaries: string;
      documentsSummarized: string;
      generateHarmonization: string;
      generating: string;
      selectAtLeastTwo: string;
      enterTopicQuery: string;
      harmonizationResult: string;
      analysisOfDocuments: string;
      harmonizationCompleted: string;
      atLeastTwoRequired: string;
      confirmHarmonizeMany: string;
    };
  };
}
