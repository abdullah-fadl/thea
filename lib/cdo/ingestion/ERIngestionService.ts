/**
 * ER Ingestion Service
 * 
 * Ingests ER data (triage, vitals, notes, timestamps) for CDO analysis.
 * This is a read-only ingestion layer that processes ER data and prepares it for analysis.
 * 
 * Section 2: Ingestion layer reads from clinical system data.
 * Currently supports: ER only (er_registrations, er_triage, er_progress_notes)
 */

import { ERRepository, ERRegistration, ERTriage, ERProgressNote, ERDisposition } from '../repositories/ERRepository';

export interface IngestedERVisit {
  erVisitId: string;
  registrationId: string;
  
  // Registration data
  registration: ERRegistration;
  
  // Triage data (if available)
  triage: ERTriage | null;
  
  // Progress notes (if available)
  progressNotes: ERProgressNote[];
  
  // Disposition (if available)
  disposition: ERDisposition | null;
  
  // Computed timestamps for analysis
  timestamps: {
    registration: Date;
    triage?: Date;
    firstProgressNote?: Date;
    latestProgressNote?: Date;
    disposition?: Date;
  };
  
  // Computed age group (for context awareness - Section 3C)
  ageGroup?: 'NEONATAL' | 'PEDIATRIC' | 'ADULT' | 'GERIATRIC' | 'OB_GYNE';
  
  // Computed care setting (always 'ED' for ER data)
  careSetting: 'ED';
}

export class ERIngestionService {
  /**
   * Ingest a single ER visit by erVisitId
   */
  static async ingestVisit(erVisitId: string): Promise<IngestedERVisit | null> {
    const visitData = await ERRepository.getCompleteVisitData(erVisitId);
    
    if (!visitData.registration) {
      return null;
    }

    // Compute age group from registration data
    const ageGroup = this.computeAgeGroup(
      visitData.registration.dateOfBirth,
      visitData.registration.gender,
      visitData.triage?.pregnancyStatus
    );

    // Extract timestamps
    const timestamps = {
      registration: visitData.registration.registrationDate,
      triage: visitData.triage?.triageDate,
      firstProgressNote: visitData.progressNotes.length > 0 
        ? visitData.progressNotes[visitData.progressNotes.length - 1]?.noteDate 
        : undefined,
      latestProgressNote: visitData.progressNotes.length > 0 
        ? visitData.progressNotes[0]?.noteDate 
        : undefined,
      disposition: visitData.disposition?.dispositionDate,
    };

    return {
      erVisitId,
      registrationId: visitData.registration.id,
      registration: visitData.registration,
      triage: visitData.triage,
      progressNotes: visitData.progressNotes,
      disposition: visitData.disposition,
      timestamps,
      ageGroup,
      careSetting: 'ED',
    };
  }

  /**
   * Ingest multiple ER visits by date range
   */
  static async ingestVisitsByDateRange(
    startDate: Date,
    endDate: Date,
    limit?: number
  ): Promise<IngestedERVisit[]> {
    const registrations = await ERRepository.getRegistrationsByDateRange(startDate, endDate, limit);
    
    // Fetch triage and notes in parallel
    const registrationIds = registrations.map(r => r.id);
    const [triageMap, progressNotesMap, dispositionsMap] = await Promise.all([
      this.fetchTriageMap(registrationIds),
      this.fetchProgressNotesMap(registrations.map(r => r.erVisitId)),
      this.fetchDispositionsMap(registrations.map(r => r.erVisitId)),
    ]);

    // Combine data
    const ingestedVisits: IngestedERVisit[] = [];
    
    for (const registration of registrations) {
      const triage = triageMap.get(registration.id) || null;
      const progressNotes = progressNotesMap.get(registration.erVisitId) || [];
      const disposition = dispositionsMap.get(registration.erVisitId) || null;

      const ageGroup = this.computeAgeGroup(
        registration.dateOfBirth,
        registration.gender,
        triage?.pregnancyStatus
      );

      const timestamps = {
        registration: registration.registrationDate,
        triage: triage?.triageDate,
        firstProgressNote: progressNotes.length > 0 
          ? progressNotes[progressNotes.length - 1]?.noteDate 
          : undefined,
        latestProgressNote: progressNotes.length > 0 
          ? progressNotes[0]?.noteDate 
          : undefined,
        disposition: disposition?.dispositionDate,
      };

      ingestedVisits.push({
        erVisitId: registration.erVisitId,
        registrationId: registration.id,
        registration,
        triage,
        progressNotes,
        disposition,
        timestamps,
        ageGroup,
        careSetting: 'ED',
      });
    }

    return ingestedVisits;
  }

  /**
   * Ingest active ER visits (currently in ED)
   */
  static async ingestActiveVisits(limit?: number): Promise<IngestedERVisit[]> {
    const activeRegistrations = await ERRepository.getActiveVisits(limit);
    
    const registrationIds = activeRegistrations.map(r => r.id);
    const erVisitIds = activeRegistrations.map(r => r.erVisitId);
    
    const [triageMap, progressNotesMap, dispositionsMap] = await Promise.all([
      this.fetchTriageMap(registrationIds),
      this.fetchProgressNotesMap(erVisitIds),
      this.fetchDispositionsMap(erVisitIds),
    ]);

    const ingestedVisits: IngestedERVisit[] = [];
    
    for (const registration of activeRegistrations) {
      const triage = triageMap.get(registration.id) || null;
      const progressNotes = progressNotesMap.get(registration.erVisitId) || [];
      const disposition = dispositionsMap.get(registration.erVisitId) || null;

      const ageGroup = this.computeAgeGroup(
        registration.dateOfBirth,
        registration.gender,
        triage?.pregnancyStatus
      );

      const timestamps = {
        registration: registration.registrationDate,
        triage: triage?.triageDate,
        firstProgressNote: progressNotes.length > 0 
          ? progressNotes[progressNotes.length - 1]?.noteDate 
          : undefined,
        latestProgressNote: progressNotes.length > 0 
          ? progressNotes[0]?.noteDate 
          : undefined,
        disposition: disposition?.dispositionDate,
      };

      ingestedVisits.push({
        erVisitId: registration.erVisitId,
        registrationId: registration.id,
        registration,
        triage,
        progressNotes,
        disposition,
        timestamps,
        ageGroup,
        careSetting: 'ED',
      });
    }

    return ingestedVisits;
  }

  /**
   * Compute age group from date of birth, gender, and pregnancy status
   * Section 3C: Context Awareness (Adult vs Pediatric vs Neonatal vs OB-Gyne)
   */
  private static computeAgeGroup(
    dateOfBirth: Date,
    gender: string,
    pregnancyStatus?: string
  ): 'NEONATAL' | 'PEDIATRIC' | 'ADULT' | 'GERIATRIC' | 'OB_GYNE' {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    
    // Calculate age in days
    const daysDiff = Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate age in years
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Neonatal: 0-28 days
    if (daysDiff <= 28) {
      return 'NEONATAL';
    }
    
    // Pediatric: < 14 years
    if (age < 14) {
      return 'PEDIATRIC';
    }
    
    // OB-Gyne: Female and pregnant
    if (gender === 'Female' && pregnancyStatus === 'pregnant') {
      return 'OB_GYNE';
    }
    
    // Geriatric: > 60 years
    if (age > 60) {
      return 'GERIATRIC';
    }
    
    // Adult: default
    return 'ADULT';
  }

  /**
   * Helper: Fetch triage data and create a map by registrationId
   */
  private static async fetchTriageMap(registrationIds: string[]): Promise<Map<string, ERTriage>> {
    if (registrationIds.length === 0) return new Map();
    
    const triages = await ERRepository.getTriageByRegistrationIds(registrationIds);
    const map = new Map<string, ERTriage>();
    for (const triage of triages) {
      map.set(triage.registrationId, triage);
    }
    return map;
  }

  /**
   * Helper: Fetch progress notes and create a map by erVisitId
   */
  private static async fetchProgressNotesMap(erVisitIds: string[]): Promise<Map<string, ERProgressNote[]>> {
    if (erVisitIds.length === 0) return new Map();
    
    const map = new Map<string, ERProgressNote[]>();
    
    // Fetch notes for each visit (could be optimized with aggregation)
    for (const erVisitId of erVisitIds) {
      const notes = await ERRepository.getProgressNotesByVisitId(erVisitId);
      if (notes.length > 0) {
        map.set(erVisitId, notes);
      }
    }
    
    return map;
  }

  /**
   * Helper: Fetch dispositions and create a map by erVisitId
   */
  private static async fetchDispositionsMap(erVisitIds: string[]): Promise<Map<string, ERDisposition>> {
    if (erVisitIds.length === 0) return new Map();
    
    const map = new Map<string, ERDisposition>();
    
    for (const erVisitId of erVisitIds) {
      const disposition = await ERRepository.getDispositionByVisitId(erVisitId);
      if (disposition) {
        map.set(erVisitId, disposition);
      }
    }
    
    return map;
  }
}

