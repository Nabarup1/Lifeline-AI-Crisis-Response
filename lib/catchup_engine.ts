import { callLLM } from "./llm_client.ts";

export async function generateCatchUpSummary(
  client: any, 
  userId: string, 
  lastActiveTs: number
): Promise<string> {
  const now = Date.now();
  
  // 1. Fetch recently created or updated cases
  let recentCases: any[] = [];
  try {
    const casesRes = await client.apps.datastore.query({ datastore: "cases" });
    if (casesRes.ok && casesRes.items) {
      recentCases = casesRes.items.filter((c: any) => c.updated_at >= lastActiveTs || c.created_at >= lastActiveTs);
    }
  } catch (e) {
    console.warn("Failed to fetch cases for catch-up", e);
  }

  // 2. Fetch recent alerts
  let recentAlerts: any[] = [];
  try {
    const alertsRes = await client.apps.datastore.query({ datastore: "alerts" });
    if (alertsRes.ok && alertsRes.items) {
      // Assuming alerts have createdAt stored as seconds or ms, let's normalize to ms
      recentAlerts = alertsRes.items.filter((a: any) => {
        const alertTs = String(a.createdAt).length <= 10 ? a.createdAt * 1000 : a.createdAt;
        return alertTs >= lastActiveTs && !a.acknowledgedBy;
      });
    }
  } catch (e) {
    console.warn("Failed to fetch alerts for catch-up", e);
  }

  // If nothing happened, we can return early
  if (recentCases.length === 0 && recentAlerts.length === 0) {
    return "You're all caught up! There have been no new cases or alerts since you were last online.";
  }

  // 3. Summarize via LLM
  const prompt = `You are an executive assistant for a disaster relief coordinator. 
The coordinator has been offline. Synthesize a brief, prioritized "Catch-Up Summary" of what happened while they were gone.
Focus ONLY on new critical cases, unacknowledged alerts, and important trends. Do not list everything if there are many items.
Keep it extremely concise, professional, and actionable (under 4 sentences).

Data since they were offline:
RECENT CASES: ${JSON.stringify(recentCases.map(c => ({id: c.id, urgency: c.urgency, status: c.status, summary: c.summary})))}
NEW ALERTS: ${JSON.stringify(recentAlerts.map(a => ({severity: a.severity, desc: a.description})))}
`;

  try {
    const summary = await callLLM(prompt, "Please generate the catch-up summary.", false);
    return summary.trim();
  } catch (e) {
    console.error("LLM failed for catch-up summary", e);
    return `There are ${recentCases.length} updated cases and ${recentAlerts.length} new alerts requiring your attention.`;
  }
}

export function buildCatchUpMessage(summary: string): any[] {
  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "☕ While You Were Away...",
        emoji: true
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: summary
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Critical Cases",
            emoji: true
          },
          style: "primary",
          action_id: "view_all_cases"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Dismiss Summary",
            emoji: true
          },
          action_id: "dismiss_catchup" // Optional handler can be added to refresh dashboard
        }
      ]
    },
    { type: "divider" }
  ];
}
