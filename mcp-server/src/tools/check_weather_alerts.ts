import { geocodeLocation } from "../utils/geocoder.ts";
import { NwsApiClient } from "../clients/nws_client.ts";
import { OpenMeteoClient } from "../clients/openmeteo_client.ts";

export async function executeCheckWeatherAlerts(args: any) {
  const { location } = args;
  const coords = await geocodeLocation(location);
  if (!coords) {
    throw new Error(`Could not geocode location: ${location}`);
  }

  const nws = new NwsApiClient();
  const openMeteo = new OpenMeteoClient();

  const alerts = await nws.getAlertsByPoint(coords.latitude, coords.longitude);
  const risk = await openMeteo.getExtremeWeatherRisk(coords.latitude, coords.longitude);

  return JSON.stringify({
    location: coords.formattedAddress,
    coordinates: { lat: coords.latitude, lng: coords.longitude },
    nwsAlerts: alerts,
    extremeRisk: risk
  }, null, 2);
}
