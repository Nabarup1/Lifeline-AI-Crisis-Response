import { executeSearchResources } from "../mcp-server/src/tools/search_resources.ts";
import { executeCheckWeatherAlerts } from "../mcp-server/src/tools/check_weather_alerts.ts";
import { executeGetDisasterStatus } from "../mcp-server/src/tools/get_disaster_status.ts";
import { executeFindRoute } from "../mcp-server/src/tools/find_route.ts";
import { executeGetHumanitarianData } from "../mcp-server/src/tools/get_humanitarian_data.ts";
import { executeVerifyResource } from "../mcp-server/src/tools/verify_resource.ts";

/**
 * Bridge Engine acts as the MCP Client inside the Deno Slack Agent.
 * For hackathon speed, we use direct import of the tool handlers instead of 
 * spinning up a full stdio subprocess transport, which is complex in Deno Deploy.
 */
export async function callMCPTool(toolName: string, args: Record<string, any>): Promise<any> {
  console.log(`[Bridge Engine] Calling MCP Tool: ${toolName} with args:`, args);
  try {
    let resultJson = "";
    switch (toolName) {
      case "search_resources":
        resultJson = await executeSearchResources(args);
        break;
      case "check_weather_alerts":
        resultJson = await executeCheckWeatherAlerts(args);
        break;
      case "get_disaster_status":
        resultJson = await executeGetDisasterStatus(args);
        break;
      case "find_route":
        resultJson = await executeFindRoute(args);
        break;
      case "get_humanitarian_data":
        resultJson = await executeGetHumanitarianData(args);
        break;
      case "verify_resource":
        resultJson = await executeVerifyResource(args);
        break;
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
    
    // Parse the JSON string returned by the MCP tools back into a rich object
    return JSON.parse(resultJson);
  } catch (error: any) {
    console.error(`[Bridge Engine] Error calling MCP tool ${toolName}:`, error);
    return {
      error: true,
      message: `MCP Server unreachable or tool failed: ${error.message}`
    };
  }
}

// Wrapper Functions mapped to the Slack Agent's specific needs

export async function findResources(type: string, location: string, urgency?: string) {
  const radiusMiles = urgency === 'immediate' ? 5 : 20;
  const response = await callMCPTool("search_resources", { type, location, radiusMiles });
  
  if (response.error) return response;

  // Maps response to ResourceMatch objects
  return response.map((res: any) => ({
    id: res.id,
    title: res.name,
    category: res.type,
    distance: "Calculated", // placeholder
    available: res.available,
    address: res.address
  }));
}

export async function checkWeatherAlerts(location: string, forecastDays: number = 3) {
  return await callMCPTool("check_weather_alerts", { location, forecastDays });
}

export async function getDisasterStatus(state?: string, country?: string) {
  return await callMCPTool("get_disaster_status", { state, country });
}

export async function findTransportation(startLocation: string, endLocation: string) {
  return await callMCPTool("find_route", { startLocation, endLocation });
}

export async function getHumanitarianData(query: string, limit: number = 5) {
  return await callMCPTool("get_humanitarian_data", { query, limit });
}
