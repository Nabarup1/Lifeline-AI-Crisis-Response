export interface CaseRecord {
  id: string;
  summary: string;
  urgency: 'Critical' | 'High' | 'Medium' | 'Low';
  status: string;
  category: string;
  zone?: string;
  volunteer?: string;
}

export interface PatternAlert {
  id: string;
  severity: string;
  description: string;
}

export interface DashboardMetrics {
  casesResolved: number;
  avgResponseHours: number;
  resourcesMatched: number;
  volunteerHours: number;
}

export function buildSetupView() {
  return {
    type: "modal",
    title: {
      type: "plain_text",
      text: "Lifeline Setup Required"
    },
    close: {
      type: "plain_text",
      text: "Close"
    },
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Welcome to Lifeline",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Lifeline transforms your organization into a rapid-response coordination center. However, it looks like your workspace is not yet configured."
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Start Setup",
              emoji: true
            },
            style: "primary",
            action_id: "start_onboarding"
          }
        ]
      }
    ]
  };
}

export function buildDashboardView(
  activeCases: CaseRecord[],
  alerts: PatternAlert[],
  metrics: DashboardMetrics,
  weatherAlerts: any[],
  catchUpBlocks?: any[]
) {
  const blocks: any[] = [];

  // 1. Dashboard Header
  blocks.push(
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "LIFELINE DASHBOARD",
        emoji: true
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "⚙️ Settings",
            emoji: true
          },
          action_id: "open_settings"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "❓ Help",
            emoji: true
          },
          action_id: "open_help"
        }
      ]
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `_Last updated: ${new Date().toLocaleString()}_`
        }
      ]
    },
    { type: "divider" }
  );

  // 1.5. Catch-Up Summary Injection
  if (catchUpBlocks && catchUpBlocks.length > 0) {
    blocks.push(...catchUpBlocks);
  }

  // 2. Active Cases
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "Active Cases",
      emoji: true
    }
  });

  const urgencyOrder = { Critical: 1, High: 2, Medium: 3, Low: 4 };
  const sortedCases = [...activeCases].sort((a, b) => 
    urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
  );

  // Slack allows up to 100 blocks total. The rest of the dashboard uses ~15 blocks.
  // We can safely show around 15-20 cases before paginating.
  const maxCasesToShow = 15;
  const displayedCases = sortedCases.slice(0, maxCasesToShow);

  if (displayedCases.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_No active cases at the moment._"
      }
    });
  } else {
    displayedCases.forEach(c => {
      const urgencyEmoji = c.urgency === 'Critical' ? '🛑' : c.urgency === 'High' ? '🚨' : c.urgency === 'Medium' ? '⚠️' : 'ℹ️';
      blocks.push({
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*${c.id}* ${urgencyEmoji} ${c.urgency}\n_${c.summary}_`
          },
          {
            type: "mrkdwn",
            text: `*Status:* ${c.status}\n*Assigned:* ${c.volunteer ? `<@${c.volunteer}>` : "Unassigned"}`
          },
          {
            type: "mrkdwn",
            text: `*Category:* ${c.category}\n*Zone:* ${c.zone || "Unknown"}`
          }
        ],
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Case",
            emoji: true
          },
          action_id: `view_case_${c.id}`
        }
      });
    });
    
    if (activeCases.length > maxCasesToShow) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_+ ${activeCases.length - maxCasesToShow} more cases. Use 'View All Cases' below._`
          }
        ]
      });
    }
  }
  blocks.push({ type: "divider" });

  // 3. Active Alerts
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "Active Alerts",
      emoji: true
    }
  });

  if (alerts.length === 0 && weatherAlerts.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_No active pattern or weather alerts._"
      }
    });
  }

  alerts.forEach(alert => {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Pattern Alert:* ${alert.severity}\n${alert.description}`
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Acknowledge",
          emoji: true
        },
        action_id: `ack_alert_${alert.id}`
      }
    });
  });

  weatherAlerts.forEach(weather => {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Weather Alert:* ${weather.event || "Unknown"}\n*Severity:* ${weather.severity || "Unknown"} | *Area:* ${weather.areaDesc || "Unknown"}`
      }
    });
  });

  blocks.push({ type: "divider" });

  // 4. Weekly Impact Metrics
  blocks.push(
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "This Week's Impact",
        emoji: true
      }
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Cases Resolved:*\n${metrics.casesResolved}`
        },
        {
          type: "mrkdwn",
          text: `*Avg Response Time:*\n${metrics.avgResponseHours} hrs`
        },
        {
          type: "mrkdwn",
          text: `*Resources Matched:*\n${metrics.resourcesMatched}`
        },
        {
          type: "mrkdwn",
          text: `*Volunteer Hours:*\n${metrics.volunteerHours}`
        }
      ]
    },
    { type: "divider" }
  );

  // 5. Quick Actions
  blocks.push(
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Quick Actions",
        emoji: true
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Register Volunteer",
            emoji: true
          },
          action_id: "register_volunteer"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View All Cases",
            emoji: true
          },
          action_id: "view_all_cases"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Search History",
            emoji: true
          },
          action_id: "search_history"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Run Pattern Check",
            emoji: true
          },
          style: "primary",
          action_id: "run_pattern_check"
        }
      ]
    }
  );

  return {
    type: "modal",
    title: {
      type: "plain_text",
      text: "Lifeline Dashboard"
    },
    close: {
      type: "plain_text",
      text: "Close"
    },
    blocks
  };
}
