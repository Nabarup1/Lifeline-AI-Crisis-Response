import { geocodeLocation, calculateDistance } from "../utils/geocoder.ts";

export async function executeFindRoute(args: any) {
  const { startLocation, endLocation } = args;
  
  const start = await geocodeLocation(startLocation);
  const end = await geocodeLocation(endLocation);

  if (!start || !end) {
    throw new Error("Could not geocode one or both locations.");
  }

  const distance = calculateDistance(start.latitude, start.longitude, end.latitude, end.longitude);
  
  // Basic estimation (assuming 30mph drive, 3mph walk)
  return JSON.stringify({
    startAddress: start.formattedAddress,
    endAddress: end.formattedAddress,
    distanceMiles: distance.toFixed(2),
    estimatedDriveTimeHours: (distance / 30).toFixed(1),
    estimatedWalkTimeHours: (distance / 3).toFixed(1)
  }, null, 2);
}
