export const CASE_ID_PREFIX = "CASE";
export const MAX_HISTORICAL_RESULTS = 5;
export const TOP_HISTORICAL_TO_DISPLAY = 3;
export const PATTERN_DETECTION_INTERVAL_HOURS = 6;
export const PATTERN_SPIKE_THRESHOLD_PERCENT = 200;
export const VOLUNTEER_MAX_DEFAULT_CAPACITY = 5;

// Environment variable fallbacks
export const MCP_SERVER_URL = Deno.env.get("MCP_SERVER_URL") || "http://localhost:3001";
export const LLM_PROVIDER = Deno.env.get("LLM_PROVIDER") || "gemini";
export const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

export const URGENCY_COLORS: Record<string, string> = {
  critical: "#FF0000",
  high: "#FF6600",
  medium: "#FFAA00",
  low: "#00AA00",
};

export const CATEGORY_LABELS: Record<string, string> = {
  housing: "Housing and Shelter",
  food: "Food and Nutrition",
  medical: "Medical and Health",
  legal: "Legal Assistance",
  safety: "Safety and Protection",
  mental_health: "Mental Health",
  transportation: "Transportation",
  other: "Other",
};

export const URGENCY_EMOJI: Record<string, string> = {
  critical: "[CRITICAL]",
  high: "[HIGH]",
  medium: "[MEDIUM]",
  low: "[LOW]",
};
