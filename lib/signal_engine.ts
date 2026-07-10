import { callLLM } from "./llm_client.ts";
import { 
  TRIAGE_SYSTEM_PROMPT, 
  ACTION_PLAN_SYSTEM_PROMPT, 
  THREAD_SUMMARY_SYSTEM_PROMPT, 
  PATTERN_ANALYSIS_SYSTEM_PROMPT, 
  getTranslationPrompt, 
  SIMPLIFY_SYSTEM_PROMPT 
} from "./llm_prompts.ts";
import { 
  CaseUrgency, 
  CaseCategory, 
  TriageResult, 
  ActionPlanStep, 
  HistoricalCaseContext, 
  ResourceMatch, 
  CaseRecord, 
  PatternAlert 
} from "./types.ts";

export async function triageMessage(messageText: string): Promise<TriageResult> {
  const result = await callLLM(TRIAGE_SYSTEM_PROMPT, messageText, true);
  
  // Validate urgency and category enums, default to medium/other if the LLM hallucinated an invalid enum
  const validUrgencies: CaseUrgency[] = ["critical", "high", "medium", "low"];
  const validCategories: CaseCategory[] = ["housing", "food", "medical", "legal", "safety", "mental_health", "transportation", "other"];
  
  if (!validUrgencies.includes(result.urgency as CaseUrgency)) {
    result.urgency = "medium";
  }
  if (!validCategories.includes(result.category as CaseCategory)) {
    result.category = "other";
  }
  
  return result as TriageResult;
}

export async function generateActionPlan(
  triage: TriageResult, 
  historicalContext: HistoricalCaseContext[], 
  resources: ResourceMatch[]
): Promise<ActionPlanStep[]> {
  const contextMessage = `
    TRIAGE RESULT: ${JSON.stringify(triage)}
    HISTORICAL CONTEXT: ${JSON.stringify(historicalContext)}
    AVAILABLE RESOURCES: ${JSON.stringify(resources)}
  `;
  
  const result = await callLLM(ACTION_PLAN_SYSTEM_PROMPT, contextMessage, true);
  return result as ActionPlanStep[];
}

export async function summarizeThread(messages: Array<{text: string, user: string, ts: string}>): Promise<any> {
  const formattedThread = messages.map(m => `[${m.ts}] User ${m.user}: ${m.text}`).join("\n");
  const result = await callLLM(THREAD_SUMMARY_SYSTEM_PROMPT, formattedThread, true);
  return result;
}

export async function analyzePatterns(
  recentCases: CaseRecord[], 
  externalData: { weatherAlerts: any[], disasters: any[] }
): Promise<PatternAlert | null> {
  // Simplified for hackathon: pass raw data to LLM to find patterns
  const contextMessage = `
    RECENT CASES (last 7 days): ${JSON.stringify(recentCases.map(c => ({ urgency: c.urgency, category: c.category, createdAt: c.createdAt })))}
    EXTERNAL DATA: ${JSON.stringify(externalData)}
  `;
  
  const result = await callLLM(PATTERN_ANALYSIS_SYSTEM_PROMPT, contextMessage, true);
  
  if (result && result.pattern_detected) {
    return {
      id: `PAT-${Date.now()}`,
      alertType: "spike",
      category: "other", // Default, could be extracted from LLM result
      zone: "system-wide",
      severity: result.severity,
      description: result.description,
      currentValue: 0,
      baselineValue: 0,
      changePercent: 0,
      externalCorrelations: [],
      recommendations: result.recommendations,
      createdAt: Math.floor(Date.now() / 1000),
      acknowledgedBy: null
    } as PatternAlert;
  }
  return null;
}

export async function translateText(text: string, targetLanguage: string): Promise<string> {
  const prompt = getTranslationPrompt(targetLanguage);
  return await callLLM(prompt, text, false);
}

export async function simplifyText(text: string): Promise<string> {
  return await callLLM(SIMPLIFY_SYSTEM_PROMPT, text, false);
}
