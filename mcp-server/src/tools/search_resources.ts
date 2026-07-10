import { geocodeLocation, calculateDistance } from "../utils/geocoder.ts";
import { normalizeResources } from "../utils/normalizer.ts";

export async function executeSearchResources(args: any) {
  const { type, location, radiusMiles = 10 } = args;
  
  const coords = await geocodeLocation(location);
  if (!coords) {
    throw new Error(`Could not geocode location: ${location}`);
  }

  // Mock local resources for hackathon scope
  const mockLocal = [
    { name: "City Hall Shelter", type: "shelter", address: "Downtown", lat: coords.latitude + 0.01, lng: coords.longitude + 0.01, available: 50 },
    { name: "Community Food Bank", type: "food", address: "Uptown", lat: coords.latitude - 0.02, lng: coords.longitude + 0.03, available: 500 }
  ];

  const filteredLocal = mockLocal.filter(r => !type || type === "all" || r.type === type);
  const normalized = normalizeResources([], [], [], filteredLocal, coords.latitude, coords.longitude);
  const withinRadius = normalized.filter(r => calculateDistance(coords.latitude, coords.longitude, r.lat, r.lng) <= radiusMiles);

  return JSON.stringify(withinRadius, null, 2);
}
