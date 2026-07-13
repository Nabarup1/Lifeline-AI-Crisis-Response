import { cacheGet, cacheSet } from "./cache.ts";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export async function geocodeLocation(locationString: string): Promise<GeocodeResult | null> {
  const cacheKey = `geocode_${locationString.toLowerCase()}`;
  const cached = cacheGet<GeocodeResult>(cacheKey);
  if (cached) return cached;

  let apiKey = "";
  try {
    // @ts-ignore
    apiKey = process?.env?.GOOGLE_MAPS_API_KEY || "";
  } catch (e) {
    // Ignore Deno sandbox errors
  }
  
  // Primary: Google Maps API (If Key is Provided)
  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationString)}&key=${apiKey}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const result = {
            latitude: data.results[0].geometry.location.lat,
            longitude: data.results[0].geometry.location.lng,
            formattedAddress: data.results[0].formatted_address
          };
          cacheSet(cacheKey, result, 86400); // Cache locations heavily (24 hrs)
          return result;
        }
      }
    } catch (e) {
      console.warn("Google Geocoding failed, falling back to Open-Meteo...", e);
    }
  }

  // Fallback: Open-Meteo free Geocoding API
  try {
    const fetchOpenMeteo = async (query: string) => {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
      const response = await fetch(url);
      if (response.ok) {
        const data: any = await response.json();
        if (data.results && data.results.length > 0) {
          return data.results[0];
        }
      }
      return null;
    };

    // Try full string first
    let item = await fetchOpenMeteo(locationString);
    
    // If it fails, Open-Meteo often chokes on commas (e.g. "Los Angeles, CA"). Try stripping everything after comma.
    if (!item && locationString.includes(",")) {
      const cityOnly = locationString.split(",")[0].trim();
      item = await fetchOpenMeteo(cityOnly);
    }

    if (item) {
      const result = {
        latitude: item.latitude,
        longitude: item.longitude,
        formattedAddress: `${item.name}${item.admin1 ? ', ' + item.admin1 : ''}${item.country ? ', ' + item.country : ''}`
      };
      cacheSet(cacheKey, result, 86400);
      return result;
    }
  } catch (e) {
    console.error("Open-Meteo geocoding failed", e);
  }

  return null;
}

// Haversine formula to calculate great-circle distance between two points in miles
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}
