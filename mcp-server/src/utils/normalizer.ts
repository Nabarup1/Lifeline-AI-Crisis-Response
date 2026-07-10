import { Resource } from "../types/resource.ts";
import { calculateDistance } from "./geocoder.ts";

export function formatPhoneNumber(phone: string): string {
  // Strip all non-digits
  const cleaned = ('' + phone).replace(/\D/g, '');
  // Format as (XXX) XXX-XXXX if standard US format
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return '(' + match[1] + ') ' + match[2] + '-' + match[3];
  }
  return phone;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  // Find the last space before maxLength to avoid cutting words in half
  const lastSpace = text.lastIndexOf(' ', maxLength);
  if (lastSpace > 0) {
    return text.substring(0, lastSpace) + '...';
  }
  
  // Fallback hard cut if no spaces exist
  return text.substring(0, maxLength) + '...';
}

export function normalizeResources(
  femaData: any[],
  nwsAlerts: any[],
  reliefwebData: any[],
  localResources: any[],
  targetLat?: number,
  targetLon?: number
): Resource[] {
  const unified: Resource[] = [];
  
  // Normalize Local Database Objects
  for (const item of localResources) {
    unified.push({
      id: item.id || `res-${Date.now()}-${Math.random()}`,
      name: item.name || item.title || "Unknown Resource",
      type: item.type || "shelter",
      address: item.address || item.location || "Unknown Location",
      lat: item.lat || item.latitude || 0,
      lng: item.lng || item.longitude || 0,
      capacity: item.capacity,
      available: item.available,
      contactPhone: item.contactPhone ? formatPhoneNumber(item.contactPhone) : undefined,
      contactEmail: item.contactEmail,
      operatingHours: item.operatingHours,
      eligibilityCriteria: item.eligibilityCriteria,
      lastUpdated: item.lastUpdated || new Date().toISOString()
    });
  }
  
  // Future implementation: Map specific FEMA staging sites or ReliefWeb operational sites 
  // into the physical Resource[] array using similar translation logic.

  // Basic deduplication based on exact name or exact location
  const deduplicated: Resource[] = [];
  const seen = new Set<string>();
  
  for (const res of unified) {
    const key = `${res.name.toLowerCase()}-${res.lat.toFixed(4)}-${res.lng.toFixed(4)}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(res);
    }
  }

  // Sort by geographical distance if target coordinates were provided
  if (targetLat !== undefined && targetLon !== undefined) {
    deduplicated.sort((a, b) => {
      const distA = calculateDistance(targetLat, targetLon, a.lat, a.lng);
      const distB = calculateDistance(targetLat, targetLon, b.lat, b.lng);
      return distA - distB;
    });
  }

  return deduplicated;
}
