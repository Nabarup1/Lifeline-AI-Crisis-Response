import { WeatherAlert, WeatherForecast } from "../types/weather.ts";

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "Lifeline-MCP-Server/1.0 (community-resilience-agent)";

export class NwsApiClient {
  private async fetchWithRetry(url: string, retries: number = 2): Promise<any> {
    while (retries >= 0) {
      try {
        const response = await fetch(url, {
          headers: {
            "Accept": "application/geo+json",
            "User-Agent": USER_AGENT
          }
        });

        if (!response.ok) {
          throw new Error(`NWS API error: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        if (retries > 0) {
          retries--;
          // NWS grid point API frequently throws 500s or timeouts, 500ms delay helps it recover
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        console.error(`Error fetching NWS data from ${url}:`, error);
        throw error;
      }
    }
  }

  private mapFeatureToAlert(feature: any): WeatherAlert {
    const props = feature.properties;
    return {
      id: props.id,
      type: props.event,
      severity: props.severity, // Minor, Moderate, Severe, Extreme
      headline: props.headline,
      description: props.description,
      instruction: props.instruction,
      effective: props.effective,
      expires: props.expires,
      affectedZones: props.affectedZones || []
    };
  }

  public async getActiveAlerts(state: string): Promise<WeatherAlert[]> {
    const url = `${NWS_API_BASE}/alerts/active?area=${state.toUpperCase()}`;
    const data = await this.fetchWithRetry(url);
    
    if (!data || !data.features) {
      return [];
    }

    return data.features.map(this.mapFeatureToAlert);
  }

  public async getAlertsByPoint(latitude: number, longitude: number): Promise<WeatherAlert[]> {
    const url = `${NWS_API_BASE}/alerts/active?point=${latitude},${longitude}`;
    try {
      const data = await this.fetchWithRetry(url);
      
      if (!data || !data.features) {
        return [];
      }

      return data.features.map(this.mapFeatureToAlert);
    } catch (e: any) {
      console.error(`NWS alerts unavailable for point ${latitude},${longitude} (likely outside US):`, e.message);
      return [];
    }
  }

  public async getForecast(latitude: number, longitude: number, days: number = 3): Promise<WeatherForecast[]> {
    // Step 1: Get the grid point data
    // The NWS API requires you to map lat/lng to their internal grid first
    const pointUrl = `${NWS_API_BASE}/points/${latitude},${longitude}`;
    const pointData = await this.fetchWithRetry(pointUrl);
    
    if (!pointData || !pointData.properties || !pointData.properties.forecast) {
      throw new Error("Could not find forecast URL for this location");
    }

    // Step 2: Fetch the actual forecast using the provided URL
    const forecastUrl = pointData.properties.forecast;
    const forecastData = await this.fetchWithRetry(forecastUrl);

    if (!forecastData || !forecastData.properties || !forecastData.properties.periods) {
      return [];
    }

    // NWS returns 2 periods per day (Day/Night). Multiply days by 2 to get target periods.
    const targetPeriods = days * 2;
    const periods = forecastData.properties.periods.slice(0, targetPeriods);

    return periods.map((p: any) => ({
      temperature: p.temperature,
      unit: p.temperatureUnit,
      shortForecast: p.shortForecast,
      detailedForecast: p.detailedForecast,
      isDaytime: p.isDaytime,
      windSpeed: p.windSpeed,
      windDirection: p.windDirection
    }));
  }
}
