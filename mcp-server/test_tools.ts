import { executeSearchResources } from "./src/tools/search_resources.js";
import { executeCheckWeatherAlerts } from "./src/tools/check_weather_alerts.js";
import { executeGetDisasterStatus } from "./src/tools/get_disaster_status.js";
import { executeFindRoute } from "./src/tools/find_route.js";
import { executeGetHumanitarianData } from "./src/tools/get_humanitarian_data.js";
import { executeVerifyResource } from "./src/tools/verify_resource.js";

async function test() {
  try {
    console.log("--- Testing search_resources ---");
    console.log(await executeSearchResources({ location: "Los Angeles", radiusMiles: 50 }));

    console.log("\n--- Testing check_weather_alerts ---");
    console.log(await executeCheckWeatherAlerts({ location: "Miami, FL" }));

    console.log("\n--- Testing get_disaster_status ---");
    console.log(await executeGetDisasterStatus({ state: "TX", country: "United States" }));

    console.log("\n--- Testing find_route ---");
    console.log(await executeFindRoute({ startLocation: "Seattle", endLocation: "Portland" }));

    console.log("\n--- Testing get_humanitarian_data ---");
    console.log(await executeGetHumanitarianData({ query: "flood", limit: 2 }));

    console.log("\n--- Testing verify_resource ---");
    console.log(await executeVerifyResource({ resourceName: "City Hall Shelter", location: "New York" }));

    console.log("\nAll tests passed successfully!");
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
