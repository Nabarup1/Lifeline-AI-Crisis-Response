import { describe, it, expect } from "vitest";
import { ReliefWebClient } from "../src/clients/reliefweb_client.js";

describe("ReliefWebClient", () => {
  it("should return reports (live or fallback) for 'flood'", async () => {
    const client = new ReliefWebClient();
    const reports = await client.searchReports("flood", 3);
    
    // Should always return results, either live or fallback
    expect(Array.isArray(reports)).toBe(true);
    expect(reports.length).toBeGreaterThan(0);
    
    const report = reports[0];
    expect(report).toHaveProperty("id");
    expect(report).toHaveProperty("title");
    expect(report).toHaveProperty("summary");
    
    // Verify truncation for live data, or verify fallback shape
    expect(report.summary.length).toBeLessThanOrEqual(203);
  }, 10000);

  it("should return disasters (live or fallback)", async () => {
    const client = new ReliefWebClient();
    const disasters = await client.getActiveDisasters();
    
    expect(Array.isArray(disasters)).toBe(true);
    expect(disasters.length).toBeGreaterThan(0);
    
    const d = disasters[0];
    expect(d).toHaveProperty("id");
    expect(d).toHaveProperty("name");
    expect(d).toHaveProperty("status");
  }, 10000);
});
