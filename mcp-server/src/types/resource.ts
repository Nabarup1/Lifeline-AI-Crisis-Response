export interface Resource {
  id: string;
  name: string;
  type: "shelter" | "food" | "medical" | "legal" | "financial";
  address: string;
  lat: number;
  lng: number;
  capacity?: number;
  available?: number;
  contactPhone?: string;
  contactEmail?: string;
  operatingHours?: string;
  eligibilityCriteria?: string;
  lastUpdated: string;
}

export interface ResourceSearchResult {
  resource: Resource;
  distanceMiles: number;
}
