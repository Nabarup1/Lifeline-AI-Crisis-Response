import { describe, it, expect } from "vitest";
import { NwsApiClient } from "../src/clients/nws_client.js";

describe("NwsApiClient", () => {
  it("should fetch active alerts for FL", async () => {
    const client = new NwsApiClient();
    const alerts = await client.getActiveAlerts("FL");
    
    expect(Array.isArray(alerts)).toBe(true);
    
    if (alerts.length > 0) {
      const alert = alerts[0];
      expect(alert).toHaveProperty("id");
      expect(alert).toHaveProperty("type");
      expect(alert).toHaveProperty("severity");
      expect(alert).toHaveProperty("headline");
    }
  }, 10000);
});
