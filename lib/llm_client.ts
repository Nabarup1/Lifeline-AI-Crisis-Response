import { GEMINI_API_KEY } from "./constants.ts";

// Which model to use for all LLM calls. Change the GEMINI_MODEL value
// in the .env file to swap models without touching code.
// Free tier options:
//   gemini-3.1-flash-lite    fastest, highest daily limits, good for JSON tasks
//   gemma-4-27b-it           Gemma 4 27B, smarter but slightly lower limits
export let GEMINI_MODEL = "gemini-3.1-flash-lite";

export function initLlmEnv(env: Record<string, string>) {
  if (env["GEMINI_MODEL"]) GEMINI_MODEL = env["GEMINI_MODEL"];
}

// Extracts valid JSON from messy LLM output.
// Some models output chain of thought reasoning before the actual JSON,
// often wrapping the JSON inside markdown code blocks. This function
// handles all of those cases reliably.
function extractJSON(text: string): any {
  // Strategy 1: Try to find JSON inside a markdown code block
  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)```/g;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const candidate = match[1].trim();
    try {
      return JSON.parse(candidate);
    } catch {
      // This code block did not contain valid JSON, keep looking
    }
  }

  // Strategy 2: Scan from the end of the text backwards to find the last
  // complete JSON object or array. This avoids matching partial JSON
  // fragments that appear in the reasoning text.
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === '}' || text[i] === ']') {
      const closingChar = text[i];
      const openingChar = closingChar === '}' ? '{' : '[';
      for (let j = 0; j < i; j++) {
        if (text[j] === openingChar) {
          const candidate = text.substring(j, i + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            // Not valid from this start position, try next opening char
          }
        }
      }
    }
  }

  // Strategy 3: Last resort, just try parsing the whole thing
  return JSON.parse(text.trim());
}

export async function callGemini(systemPrompt: string, userMessage: string, jsonMode: boolean = false): Promise<any> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set. " +
      "Make sure your .env file exists in the lifeline/ folder " +
      "and contains a valid key from https://aistudio.google.com/app/apikey"
    );
  }

  // Build the endpoint URL using the configured model name
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  console.log(`Calling Gemini model: ${GEMINI_MODEL}`);

  // Append an explicit JSON only instruction when we need structured output.
  // Some models ignore the responseMimeType config so we reinforce it in the prompt.
  let fullSystemPrompt = systemPrompt;
  if (jsonMode) {
    fullSystemPrompt += "\n\nIMPORTANT: Your ENTIRE response must be ONLY a single valid JSON object or array. Do NOT include any explanation, reasoning, markdown formatting, or code blocks. Output raw JSON only.";
  }

  // Build the request body following the official Gemini REST API format.
  // The API expects snake_case field names.
  const body: any = {
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    system_instruction: { parts: [{ text: fullSystemPrompt }] },
  };

  // When JSON mode is requested, also set the generation config
  // so models that support it will produce cleaner output.
  if (jsonMode) {
    body.generationConfig = {
      responseMimeType: "application/json",
    };
  }

  let retries = 2;
  while (retries >= 0) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Gemini API error response: ${response.status} ${errorBody}`);

        // Retry on rate limits and server errors
        if (response.status === 429 || response.status >= 500) {
          if (retries > 0) {
            retries--;
            const waitTime = (3 - retries) * 2000;
            console.log(`Retrying in ${waitTime}ms...`);
            await new Promise(r => setTimeout(r, waitTime));
            continue;
          }
        }
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}. Body: ${errorBody.substring(0, 200)}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        console.error("Malformed Gemini response:", JSON.stringify(data).substring(0, 500));
        throw new Error("Malformed response from Gemini API: no text in candidates");
      }

      if (jsonMode) {
        return extractJSON(text);
      }
      return text;
    } catch (error) {
      if (retries > 0 && (error instanceof TypeError || (error as Error).message.includes("fetch"))) {
        retries--;
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw error;
    }
  }
}

export async function callLLM(systemPrompt: string, userMessage: string, jsonMode: boolean = false): Promise<any> {
  // Route to the configured provider. Currently we use the Gemini API.
  return callGemini(systemPrompt, userMessage, jsonMode);
}
