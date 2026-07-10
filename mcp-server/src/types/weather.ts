export interface WeatherAlert {
  id: string;
  type: string;
  severity: "Minor" | "Moderate" | "Severe" | "Extreme";
  headline: string;
  description: string;
  instruction?: string;
  effective: string;
  expires: string;
  affectedZones: string[];
}

export interface WeatherForecast {
  temperature: number;
  unit: "F" | "C";
  shortForecast: string;
  detailedForecast: string;
  isDaytime: boolean;
  windSpeed: string;
  windDirection: string;
}
