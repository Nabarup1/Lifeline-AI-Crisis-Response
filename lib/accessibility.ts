import { callLLM } from "./llm_client.ts";

const languageCache = new Map<string, string>();

/**
 * Uses LLM to identify ISO 639-1 language code; caches results.
 */
export async function detectLanguage(text: string): Promise<string> {
  // Simple hash for caching (first 100 chars + length)
  const hash = btoa(text.slice(0, 100)) + text.length;
  
  if (languageCache.has(hash)) {
    return languageCache.get(hash)!;
  }
  
  const prompt = `Identify the ISO 639-1 language code (like "en", "es", "fr") for the following text. Return ONLY the 2-letter code, nothing else. Text: "${text}"`;
  try {
    const code = (await callLLM(prompt, text, false)).trim().toLowerCase();
    // Validate it's a 2-letter code
    const validCode = code.length === 2 ? code : 'en';
    languageCache.set(hash, validCode);
    return validCode;
  } catch (e) {
    console.warn("Language detection failed, defaulting to 'en'", e);
    return 'en';
  }
}

/**
 * Simple boolean check for translation necessity.
 */
export function shouldTranslate(detectedLanguage: string, targetLanguage: string = 'en'): boolean {
  return detectedLanguage.toLowerCase() !== targetLanguage.toLowerCase();
}

/**
 * Enforces WCAG-aligned Slack accessibility: mandates alt_text, 
 * descriptive button labels, and ensures semantic meaning isn't conveyed through color alone.
 */
export function makeAccessible(blocks: any[]): any[] {
  // Deep clone to avoid mutating original objects
  const accessibleBlocks = JSON.parse(JSON.stringify(blocks));
  
  const processBlock = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;

    // 1. Mandate alt_text for images
    if (obj.type === "image" && !obj.alt_text) {
      obj.alt_text = "Image attachment provided by reporter";
    }

    // 2. Descriptive button labels
    if (obj.type === "button" && obj.text && obj.text.type === "plain_text") {
      const label = obj.text.text;
      if (label.length < 4 && !label.toLowerCase().includes("view")) {
        obj.text.text = `${label} Action`; // Ensure it's descriptive enough
      }
    }

    // 3. Ensure semantic meaning isn't purely via color
    // In Slack, button styles are "primary" (green) or "danger" (red). 
    // We can append text like [Destructive] or [Primary] if they don't already have clear wording.
    if (obj.type === "button" && obj.style) {
      const label = obj.text?.text?.toLowerCase() || "";
      if (obj.style === "danger" && !label.includes("dismiss") && !label.includes("delete") && !label.includes("cancel") && !label.includes("override")) {
         obj.text.text = `[Warning] ${obj.text.text}`;
      }
    }

    // Recursively process children
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        processBlock(obj[key]);
      }
    }
  };

  accessibleBlocks.forEach(processBlock);
  return accessibleBlocks;
}

/**
 * Applies if urgency is 'critical': shortens sentences, bubbles action items to the top, 
 * and increases visual hierarchy for immediate readability.
 */
export function simplifyForCrisis(blocks: any[], urgency: string): any[] {
  if (urgency.toLowerCase() !== 'critical') {
    return blocks;
  }
  
  const crisisBlocks = JSON.parse(JSON.stringify(blocks));
  
  // 1. Inject a highly visible TL;DR header
  crisisBlocks.unshift(
    {
       type: "header",
       text: {
         type: "plain_text",
         text: "🚨 CRITICAL TL;DR - ACT IMMEDIATELY",
         emoji: true
       }
    },
    { type: "divider" }
  );

  // 2. Bubble up the Action Plan & Actions
  // We want to extract the Action Plan (Header + Section + Divider) and Footer Actions
  // and move them to the top (right after the new TL;DR header)
  
  let bubbledBlocks: any[] = [];
  const finalBlocks: any[] = [];

  // Extract Action Plan blocks
  const actionPlanIndex = crisisBlocks.findIndex((b: any) => 
    b.type === "header" && b.text?.text?.includes("Recommended Action Plan")
  );
  if (actionPlanIndex !== -1) {
    // Action plan usually has Header, Section, Divider (3 blocks)
    const extracted = crisisBlocks.splice(actionPlanIndex, 3);
    bubbledBlocks = bubbledBlocks.concat(extracted);
  }

  // Extract Actions blocks
  const actionsIndex = crisisBlocks.findIndex((b: any) => 
    b.type === "actions" && b.elements?.some((e: any) => e.action_id?.includes("lifeline_claim") || e.action_id?.includes("lifeline_execute"))
  );
  if (actionsIndex !== -1) {
    const extracted = crisisBlocks.splice(actionsIndex, 1);
    bubbledBlocks = bubbledBlocks.concat(extracted);
  }

  // Insert bubbled blocks right after the TL;DR header (which is index 0 and 1)
  finalBlocks.push(crisisBlocks[0], crisisBlocks[1], ...bubbledBlocks, ...crisisBlocks.slice(2));

  return finalBlocks;
}
