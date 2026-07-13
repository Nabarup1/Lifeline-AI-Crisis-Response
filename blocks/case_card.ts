// This file re exports the canonical interfaces from types.ts so that
// every module uses the same shape. The card builder function converts
// the structured entities object into a human readable string for display.

import type {
  TriageResult,
  ActionPlanStep,
  HistoricalCaseContext,
  ResourceMatch,
} from "../lib/types.ts";

// The volunteer record used inside the card builder only needs
// a subset of fields, so we define a lightweight local interface.
export interface CardVolunteerRecord {
  id: string;
  name: string;
  skills: string[];
  matchReason: string;
}

// Helper that turns the structured entities object from the LLM
// into a flat, readable string for the Slack card display.
function formatEntities(entities: any): string {
  if (!entities) return "None detected";

  // If the LLM returned a plain array of strings, just join them
  if (Array.isArray(entities)) {
    return entities.length > 0 ? entities.join(", ") : "None detected";
  }

  // If it is a string already, return it directly
  if (typeof entities === "string") {
    return entities || "None detected";
  }

  // Otherwise it is the structured ExtractedEntities object from types.ts
  // Pull out the useful fields and format them
  const parts: string[] = [];
  if (entities.location) parts.push(`Location: ${entities.location}`);
  if (entities.familySize) parts.push(`Family size: ${entities.familySize}`);
  if (entities.childrenCount) parts.push(`Children: ${entities.childrenCount}`);
  if (entities.specialNeeds && Array.isArray(entities.specialNeeds) && entities.specialNeeds.length > 0) {
    parts.push(`Special needs: ${entities.specialNeeds.join(", ")}`);
  }
  if (entities.timeConstraint) parts.push(`Time constraint: ${entities.timeConstraint}`);
  if (entities.primaryLanguage && entities.primaryLanguage !== "en") {
    parts.push(`Language: ${entities.primaryLanguage}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "None detected";
}

// Helper that safely converts skills into a displayable string.
// Handles cases where skills might be undefined, a string, or an array.
function formatSkills(skills: any): string {
  if (!skills) return "General";
  if (typeof skills === "string") return skills;
  if (Array.isArray(skills)) return skills.join(", ") || "General";
  return "General";
}

export function buildCaseIntakeCard(
  triage: TriageResult,
  historicalContext: Array<{id: string; summary: string; resolution: string; url: string}>,
  resources: Array<{id?: string; title?: string; name?: string; category?: string; type?: string; distance?: string; available?: number | string; address?: string}>,
  actionPlan: Array<{step?: number; stepNumber?: number; description?: string; action?: string}>,
  volunteer: CardVolunteerRecord | null,
  caseId: string,
  reporter: string = "Unknown Reporter",
  source: string = "Slack Channel"
) {

  // Safely access urgency with a fallback
  const urgency = (triage.urgency || "medium").toLowerCase();
  const urgencyEmoji = urgency === "critical" ? "[CRITICAL]" : urgency === "high" ? "[HIGH]" : urgency === "medium" ? "[MEDIUM]" : "[LOW]";

  const blocks: any[] = [];

  // 1. Header
  blocks.push(
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `New Case Detected | ID: ${caseId}`,
        emoji: true
      }
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*Source:* ${source}  |  *Reporter:* <@${reporter}>  |  *Time:* ${new Date().toLocaleString()}`
        }
      ]
    }
  );

  // 2. Triage Assessment
  const confidence = typeof triage.confidence === "number" ? triage.confidence : 0;
  // Display confidence as a percentage. If the LLM returned a decimal
  // like 0.95 instead of 95, multiply by 100 first.
  const displayConfidence = confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);

  blocks.push({
    type: "section",
    fields: [
      {
        type: "mrkdwn",
        text: `*Urgency:*\n${urgencyEmoji} ${urgency.toUpperCase()}`
      },
      {
        type: "mrkdwn",
        text: `*Category:*\n${triage.category || "other"}`
      },
      {
        type: "mrkdwn",
        text: `*Confidence:*\n${displayConfidence}%`
      }
    ]
  });

  // 3. Case Summary
  blocks.push(
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Summary:*\n${triage.summary || "No summary available"}\n\n*Key Entities:* ${formatEntities(triage.entities)}`
      }
    },
    { type: "divider" }
  );

  // 4. Historical Context
  if (historicalContext && historicalContext.length > 0) {
    blocks.push({
      type: "header",
      text: {
        type: "plain_text",
        text: "Similar Past Cases",
        emoji: true
      }
    });

    historicalContext.slice(0, 3).forEach(history => {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Case ${history.id}*\n*Summary:* ${history.summary}\n*Resolution:* ${history.resolution}`
        },
        accessory: (history.url && history.url.startsWith("http")) ? {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Thread",
            emoji: true
          },
          url: history.url,
          action_id: `view_thread_${history.id}`
        } : undefined
      });
    });
    blocks.push({ type: "divider" });
  }

  // 5. Available Resources
  if (resources && resources.length > 0) {
    blocks.push({
      type: "header",
      text: {
        type: "plain_text",
        text: "Available Resources",
        emoji: true
      }
    });

    resources.slice(0, 3).forEach(res => {
      const resTitle = res.title || res.name || "Resource";
      const resCategory = res.category || res.type || "General";
      blocks.push({
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*${resTitle}* (${resCategory})\n${res.address || "Location unknown"}`
          },
          {
            type: "mrkdwn",
            text: `*Distance:* ${res.distance || "N/A"}\n*Available:* ${res.available || "Unknown"}`
          }
        ]
      });
    });
    blocks.push({ type: "divider" });
  }

  // 6. Recommended Action Plan
  if (actionPlan && actionPlan.length > 0) {
    blocks.push(
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Recommended Action Plan",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          // Handle both shapes the LLM might return
          text: actionPlan.map((a, i) => {
            const stepNum = a.step || a.stepNumber || (i + 1);
            const desc = a.description || a.action || JSON.stringify(a);
            return `*${stepNum}.* ${desc}`;
          }).join("\n")
        }
      },
      { type: "divider" }
    );
  }

  // 7. Volunteer Match
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "Volunteer Match",
      emoji: true
    }
  });

  if (volunteer) {
    blocks.push(
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Matched:* <@${volunteer.id}> (${volunteer.name})\n*Skills:* ${formatSkills(volunteer.skills)}\n*Reason:* ${volunteer.matchReason}`
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Assign to Case",
              emoji: true
            },
            style: "primary",
            action_id: `lifeline_assign_${caseId}`
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Find Alternative",
              emoji: true
            },
            action_id: `lifeline_reassign_${caseId}`
          }
        ]
      }
    );
  } else {
    blocks.push(
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "_No immediate volunteers found for these requirements._"
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Broadcast for Volunteers",
              emoji: true
            },
            action_id: `lifeline_broadcast_${caseId}`
          }
        ]
      }
    );
  }
  blocks.push({ type: "divider" });

  // 8. Actions Footer
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Claim Case",
          emoji: true
        },
        style: "primary",
        action_id: `lifeline_claim_${caseId}`
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Resolve Case",
          emoji: true
        },
        action_id: `lifeline_resolve_${caseId}`
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Escalate",
          emoji: true
        },
        action_id: `lifeline_escalate_${caseId}`
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Override Triage",
          emoji: true
        },
        action_id: `lifeline_override_${caseId}`
      }
    ]
  });

  return blocks;
}
