import { FemaApiClient } from "../clients/fema_client.ts";
import { ReliefWebClient } from "../clients/reliefweb_client.ts";

export async function executeGetDisasterStatus(args: any) {
  const { state, country } = args;
  
  const fema = new FemaApiClient();
  const reliefWeb = new ReliefWebClient();

  let femaData: any[] = [];
  if (state) {
    femaData = await fema.getActiveDisasters(state);
  }

  let reliefData: any[] = [];
  if (country) {
    reliefData = await reliefWeb.getActiveDisasters(country);
  } else if (!state) {
    // Global fallback
    reliefData = await reliefWeb.getActiveDisasters();
  }

  return JSON.stringify({
    femaDisasters: femaData,
    reliefWebDisasters: reliefData
  }, null, 2);
}
