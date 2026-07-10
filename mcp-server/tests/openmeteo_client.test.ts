import { describe, it, expect } from "vitest";
import { OpenMeteoClient } from "../src/clients/openmeteo_client.js";

describe("OpenMeteoClient", () => {
  it("should fetch current weather for Los Angeles (34.05, -118.24)", async () => {
    const client = new OpenMeteoClient();
    const weather = await client.getCurrentWeather(34.05, -118.24);
    
    expect(weather).not.toBeNull();
    if (weather) {
      expect(weather).toHaveProperty("temperature");
      expect(weather).toHaveProperty("description");
      expect(typeof weather.description).toBe("string");
    }
  });

  it("should evaluate extreme weather risk", async () => {
    const client = new OpenMeteoClient();
    const risk = await client.getExtremeWeatherRisk(34.05, -118.24);
    
    expect(risk).toHaveProperty("hasRisk");
    expect(Array.isArray(risk.risks)).toBe(true);
  });
});
