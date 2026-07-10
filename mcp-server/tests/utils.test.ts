import { describe, it, expect } from "vitest";
import { geocodeLocation, calculateDistance } from "../src/utils/geocoder.js";
import { formatPhoneNumber, truncateText } from "../src/utils/normalizer.js";
import { cacheSet, cacheGet, cacheClear } from "../src/utils/cache.js";

describe("Utils: Geocoder", () => {
  it("should geocode Los Angeles via Open-Meteo fallback", async () => {
    const coords = await geocodeLocation("Los Angeles, CA");
    expect(coords).not.toBeNull();
    if (coords) {
      expect(coords.latitude).toBeCloseTo(34.05, 0); 
      expect(coords.longitude).toBeCloseTo(-118.24, 0); 
    }
  });

  it("should calculate distance correctly (LA to SF)", () => {
    const dist = calculateDistance(34.05, -118.24, 37.77, -122.41);
    // Should be around 347 miles
    expect(dist).toBeGreaterThan(340);
    expect(dist).toBeLessThan(360);
  });
});

describe("Utils: Normalizer", () => {
  it("should format phone numbers", () => {
    expect(formatPhoneNumber("8005551234")).toBe("(800) 555-1234");
  });

  it("should truncate text safely on word boundaries", () => {
    const text = "This is a very long string that needs to be truncated";
    const truncated = truncateText(text, 20);
    expect(truncated).toBe("This is a very long...");
  });
});

describe("Utils: Cache", () => {
  it("should set and get values", () => {
    cacheClear();
    cacheSet("key1", "value1", 60);
    expect(cacheGet("key1")).toBe("value1");
  });

  it("should expire values immediately if TTL is negative", async () => {
    cacheClear();
    cacheSet("key2", "value2", -1); 
    expect(cacheGet("key2")).toBeNull();
  });
});
