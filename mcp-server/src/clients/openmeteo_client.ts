// Uses Node 22 native fetch

const OPENMETEO_API_BASE = "https://api.open-meteo.com/v1";

// WMO Weather interpretation codes (https://open-meteo.com/en/docs)
export function getWmoDescription(code: number): string {
  if (code === 0) return "Clear sky";
  if (code === 1 || code === 2 || code === 3) return "Mainly clear, partly cloudy, or overcast";
  if (code === 45 || code === 48) return "Fog or depositing rime fog";
  if (code === 51 || code === 53 || code === 55) return "Drizzle (Light, moderate, or dense)";
  if (code === 56 || code === 57) return "Freezing Drizzle";
  if (code === 61 || code === 63 || code === 65) return "Rain (Slight, moderate, or heavy)";
  if (code === 66 || code === 67) return "Freezing Rain";
  if (code === 71 || code === 73 || code === 75) return "Snow fall (Slight, moderate, or heavy)";
  if (code === 77) return "Snow grains";
  if (code === 80 || code === 81 || code === 82) return "Rain showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if (code === 96 || code === 99) return "Thunderstorm with slight or heavy hail";
  return "Unknown";
}

export interface CurrentWeather {
  temperature: number;
  windspeed: number;
  winddirection: number;
  weathercode: number;
  description: string;
  time: string;
}

export interface DailyForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  windGustMax: number;
  weathercode: number;
  description: string;
}

export interface ExtremeWeatherRisk {
  hasRisk: boolean;
  risks: string[];
}

export class OpenMeteoClient {
  public async getCurrentWeather(latitude: number, longitude: number): Promise<CurrentWeather | null> {
    const url = `${OPENMETEO_API_BASE}/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.current_weather) return null;

    return {
      temperature: data.current_weather.temperature,
      windspeed: data.current_weather.windspeed,
      winddirection: data.current_weather.winddirection,
      weathercode: data.current_weather.weathercode,
      description: getWmoDescription(data.current_weather.weathercode),
      time: data.current_weather.time
    };
  }

  public async getDailyForecast(latitude: number, longitude: number, days: number = 7): Promise<DailyForecast[]> {
    const url = `${OPENMETEO_API_BASE}/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max,weathercode&timezone=auto&forecast_days=${days}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.daily) return [];

    const forecasts: DailyForecast[] = [];
    // Open-Meteo returns parallel arrays for each requested variable
    const timeArr = data.daily.time || [];
    const maxTempArr = data.daily.temperature_2m_max || [];
    const minTempArr = data.daily.temperature_2m_min || [];
    const precipArr = data.daily.precipitation_sum || [];
    const gustArr = data.daily.wind_gusts_10m_max || [];
    const codeArr = data.daily.weathercode || [];

    for (let i = 0; i < timeArr.length; i++) {
      forecasts.push({
        date: timeArr[i],
        tempMax: maxTempArr[i],
        tempMin: minTempArr[i],
        precipitationSum: precipArr[i],
        windGustMax: gustArr[i],
        weathercode: codeArr[i],
        description: getWmoDescription(codeArr[i])
      });
    }

    return forecasts;
  }

  public async getExtremeWeatherRisk(latitude: number, longitude: number): Promise<ExtremeWeatherRisk> {
    // Analyze the 7-day forecast for dangerous conditions
    const forecast = await this.getDailyForecast(latitude, longitude, 7);
    const risks: string[] = [];

    for (const day of forecast) {
      if (day.tempMax > 40) {
        risks.push(`Extreme Heat: ${day.tempMax}°C on ${day.date}`);
      }
      if (day.tempMin < -10) {
        risks.push(`Extreme Cold: ${day.tempMin}°C on ${day.date}`);
      }
      if (day.precipitationSum > 50) {
        risks.push(`Heavy Precipitation Risk: ${day.precipitationSum}mm on ${day.date}`);
      }
      if (day.windGustMax > 80) { // Approx 50 mph
        risks.push(`Severe Wind Risk: gusts up to ${day.windGustMax}km/h on ${day.date}`);
      }
    }

    return {
      hasRisk: risks.length > 0,
      risks: risks
    };
  }
}
