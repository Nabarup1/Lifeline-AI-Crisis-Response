import { describe, it, expect } from "vitest";
import { FemaApiClient } from "../src/clients/fema_client.js";

describe("FemaApiClient", () => {
  it("should fetch active disasters for CA", async () => {
    const client = new FemaApiClient();
    const disasters = await client.getActiveDisasters("CA");
    
    expect(Array.isArray(disasters)).toBe(true);
    
    // We can't guarantee CA has an active disaster right at this exact second in history, 
    // but if it does, it should match our strongly typed interface.
    if (disasters.length > 0) {
      const d = disasters[0];
      expect(d).toHaveProperty("id");
      expect(d).toHaveProperty("title");
      expect(d).toHaveProperty("state", "CA");
      expect(d).toHaveProperty("incidentType");
      expect(Array.isArray(d.designatedAreas)).toBe(true);
    }
  }, 15000); // 15 second timeout to allow for real network requests and retries
});
