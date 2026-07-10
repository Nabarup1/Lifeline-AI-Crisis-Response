import { Server } from "@modelcontextprotocol/sdk/server/index.ts";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.ts";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.ts";

import { executeSearchResources } from "./tools/search_resources.ts";
import { executeCheckWeatherAlerts } from "./tools/check_weather_alerts.ts";
import { executeGetDisasterStatus } from "./tools/get_disaster_status.ts";
import { executeFindRoute } from "./tools/find_route.ts";
import { executeGetHumanitarianData } from "./tools/get_humanitarian_data.ts";
import { executeVerifyResource } from "./tools/verify_resource.ts";

// Initialize server
const server = new Server({
  name: "lifeline-mcp-server",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {}
  }
});

// Tool Definitions
const searchResourcesTool: Tool = {
  name: "search_resources",
  description: "Search for available community resources (shelters, food banks, medical clinics) near a location",
  inputSchema: {
    type: "object",
    properties: {
      type: { type: "string", description: "Type of resource: shelter, food, medical, legal, financial, or all" },
      location: { type: "string", description: "City, neighborhood, or zip code" },
      radiusMiles: { type: "number", description: "Search radius in miles" }
    },
    required: ["location"]
  }
};

const checkWeatherAlertsTool: Tool = {
  name: "check_weather_alerts",
  description: "Fetch NWS alerts and extreme weather risk for a specific location",
  inputSchema: {
    type: "object",
    properties: {
      location: { type: "string", description: "City or region to check for weather alerts" }
    },
    required: ["location"]
  }
};

const getDisasterStatusTool: Tool = {
  name: "get_disaster_status",
  description: "Get active FEMA and ReliefWeb disaster declarations",
  inputSchema: {
    type: "object",
    properties: {
      state: { type: "string", description: "2-letter US state code" },
      country: { type: "string", description: "Country name (for global disasters)" }
    },
    required: []
  }
};

const findRouteTool: Tool = {
  name: "find_route",
  description: "Estimate distance and travel time between two points",
  inputSchema: {
    type: "object",
    properties: {
      startLocation: { type: "string", description: "Origin address or city" },
      endLocation: { type: "string", description: "Destination address or city" }
    },
    required: ["startLocation", "endLocation"]
  }
};

const getHumanitarianDataTool: Tool = {
  name: "get_humanitarian_data",
  description: "Fetch humanitarian reports from ReliefWeb",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Topic to search (e.g., 'flood', 'earthquake')" },
      limit: { type: "number", description: "Number of reports to fetch" }
    },
    required: ["query"]
  }
};

const verifyResourceTool: Tool = {
  name: "verify_resource",
  description: "Cross-reference a resource's location against weather alerts and existence",
  inputSchema: {
    type: "object",
    properties: {
      resourceName: { type: "string", description: "Name of the resource to verify" },
      location: { type: "string", description: "Location of the resource" }
    },
    required: ["resourceName", "location"]
  }
};

// Register list tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      searchResourcesTool,
      checkWeatherAlertsTool,
      getDisasterStatusTool,
      findRouteTool,
      getHumanitarianDataTool,
      verifyResourceTool
    ]
  };
});

// Register call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    let result = "";
    switch (name) {
      case "search_resources":
        result = await executeSearchResources(args);
        break;
      case "check_weather_alerts":
        result = await executeCheckWeatherAlerts(args);
        break;
      case "get_disaster_status":
        result = await executeGetDisasterStatus(args);
        break;
      case "find_route":
        result = await executeFindRoute(args);
        break;
      case "get_humanitarian_data":
        result = await executeGetHumanitarianData(args);
        break;
      case "verify_resource":
        result = await executeVerifyResource(args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    return {
      content: [{ type: "text", text: result }]
    };
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error executing tool: ${error.message}` }],
      isError: true
    };
  }
});

// Start server
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Lifeline MCP Server running on stdio");
}

run().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
