export type CaseUrgency = "critical" | "high" | "medium" | "low";
export type CaseCategory = "housing" | "food" | "medical" | "legal" | "safety" | "mental_health" | "transportation" | "other";
export type CaseStatus = "new" | "assigned" | "in_progress" | "resolved" | "closed";

export interface ExtractedEntities {
  location: string | null;
  familySize: number | null;
  childrenCount: number | null;
  childrenAges: number[] | null;
  specialNeeds: string[];
  timeConstraint: string | null;
  primaryLanguage: string;
}

export interface TriageResult {
  urgency: CaseUrgency;
  category: CaseCategory;
  confidence: number;
  summary: string;
  language: string;
  entities: ExtractedEntities;
}

export interface ResourceMatch {
  name: string;
  type: string;
  address: string;
  distance: string;
  availability: string;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
}

export interface ActionPlanStep {
  stepNumber: number;
  action: string;
  resource: string | null;
  contact: string | null;
  priority: "immediate" | "soon" | "follow_up";
}

export interface CaseRecord {
  id: string;
  status: CaseStatus;
  urgency: CaseUrgency;
  category: CaseCategory;
  summary: string;
  reportedBy: string;
  assignedTo: string | null;
  channelId: string;
  threadTs: string;
  entities: ExtractedEntities;
  resourcesMatched: ResourceMatch[];
  actionPlan: string[];
  historicalCaseIds: string[];
  createdAt: number;
  updatedAt: number;
  resolvedAt: number | null;
  resolutionNotes: string | null;
}

export interface VolunteerRecord {
  userId: string;
  displayName: string;
  languages: string[];
  skills: CaseCategory[];
  zones: string[];
  activeCaseCount: number;
  maxCapacity: number;
  totalResolved: number;
  availability: "available" | "busy" | "offline";
}

export interface PatternAlert {
  id: string;
  alertType: "spike" | "trend" | "anomaly";
  category: CaseCategory;
  zone: string;
  severity: "warning" | "critical";
  description: string;
  currentValue: number;
  baselineValue: number;
  changePercent: number;
  externalCorrelations: string[];
  recommendations: string[];
  createdAt: number;
  acknowledgedBy: string | null;
}

export interface HistoricalCaseContext {
  caseId: string;
  summary: string;
  outcome: string;
  resourcesUsed: string[];
  threadLink: string;
  resolvedAt: number;
  relevanceScore: number;
}
