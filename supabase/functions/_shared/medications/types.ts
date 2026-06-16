export type MedicationProviderId = 'local' | 'anvisa' | 'openfda' | 'bulário' | 'whitebook';

export type MedicationInteractionSeverity = 'grave' | 'moderada' | 'leve';

export type MedicationDosagePopulation = 'adultos' | 'pediatrico' | 'idosos' | 'gestantes';

export interface MedicationDosage {
  population: MedicationDosagePopulation;
  usualDose: string;
  frequency: string;
  maxDose: string;
  notes?: string;
}

export interface MedicationContraindication {
  absolute: string[];
  relative: string[];
  warnings: string[];
}

export interface MedicationInteraction {
  id: string;
  medicationAId: string;
  medicationBId: string;
  medicationAName: string;
  medicationBName: string;
  severity: MedicationInteractionSeverity;
  description: string;
  clinicalManagement?: string;
}

export interface MedicationSearchResult {
  id: string;
  name: string;
  activeIngredient: string;
  commercialNames?: string[];
  therapeuticClass?: string;
  category?: string;
  source: MedicationProviderId;
  externalId?: string;
}

export interface Medication {
  id: string;
  name: string;
  activeIngredient: string;
  commercialNames: string[];
  therapeuticClass: string;
  category: string;
  presentations: string[];
  manufacturers?: string[];
  summary: string;
  dosages: MedicationDosage[];
  contraindications: MedicationContraindication;
  interactions: MedicationInteraction[];
  source: MedicationProviderId;
  externalId?: string;
  bulaPatientUrl?: string;
  bulaProfessionalUrl?: string;
}

export interface MedicationLibrarySearchRequest {
  query?: string;
  providers?: MedicationProviderId[];
  limit?: number;
}

export interface MedicationLibraryGetRequest {
  id?: string;
}

export interface MedicationLibraryInteractionsRequest {
  medicationIds?: string[];
}

export interface MedicationLibraryResponse<T> {
  data: T;
  warnings?: string[];
  providersUsed?: MedicationProviderId[];
}

export interface MedicationProvider {
  id: MedicationProviderId;
  isConfigured(): boolean;
  search(query: string, limit: number): Promise<MedicationSearchResult[]>;
  getById(externalId: string): Promise<Medication | null>;
}
