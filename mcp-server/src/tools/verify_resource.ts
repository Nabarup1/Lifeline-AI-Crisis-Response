import { geocodeLocation } from "../utils/geocoder.ts";
import { NwsApiClient } from "../clients/nws_client.ts";

export async function executeVerifyResource(args: any) {
  const { resourceName, location } = args;
  
  const coords = await geocodeLocation(location);
  
  let riskStatus = "Unknown location for impact check.";
  if (coords) {
    const nws = new NwsApiClient();
    const alerts = await nws.getAlertsByPoint(coords.latitude, coords.longitude);
    riskStatus = alerts.length > 0 ? `Resource is in an active alert zone (${alerts.length} alerts)` : "Resource area is clear of weather alerts.";
  }

  return JSON.stringify({
    resourceName,
    verificationStatus: "Unverified in local DB (Hackathon mock)",
    impactRisk: riskStatus,
    timestamp: new Date().toISOString()
  }, null, 2);
}
