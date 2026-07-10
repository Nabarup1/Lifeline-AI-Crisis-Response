import { ReliefWebClient } from "../clients/reliefweb_client.ts";

export async function executeGetHumanitarianData(args: any) {
  const { query, limit = 5 } = args;
  
  const reliefWeb = new ReliefWebClient();
  const reports = await reliefWeb.searchReports(query, limit);

  return JSON.stringify({
    query,
    reports
  }, null, 2);
}
