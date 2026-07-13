import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { searchSimilarCases } from "../lib/memory_engine.ts";
import { findResources } from "../lib/bridge_engine.ts";

export const HandleAppMentionDefinition = DefineFunction({
  callback_id: "handle_app_mention",
  title: "Handle App Mention",
  description: "Processes @Lifeline mentions as commands",
  source_file: "functions/handle_app_mention.ts",
  input_parameters: {
    properties: {
      channel_id: { type: Schema.slack.types.channel_id },
      user_id: { type: Schema.slack.types.user_id },
      message_ts: { type: Schema.slack.types.message_ts },
      message_text: { type: Schema.types.string },
    },
    required: ["channel_id", "user_id", "message_ts", "message_text"],
  },
  output_parameters: {
    properties: {},
    required: [],
  },
});

import { initEnv } from "../lib/constants.ts";
import { initLlmEnv } from "../lib/llm_client.ts";

export default SlackFunction(
  HandleAppMentionDefinition,
  async ({ inputs, client, env }) => {
    initEnv(env);
    initLlmEnv(env);
    const { user_id, channel_id, message_text, message_ts } = inputs;
    // Strip the bot mention
    const text = message_text.replace(/<@[A-Z0-9]+>/g, '').trim().toLowerCase();
    const args = text.split(/\s+/);
    const subcommand = args[0] || "help";

    // Helper for threaded responses
    const postReply = async (message: string, blocks?: any[]) => {
      await client.chat.postMessage({
        channel: channel_id,
        thread_ts: message_ts,
        text: message,
        blocks,
      });
    };

    try {
      // 1. Check Configuration (Unless they are running setup)
      const configRes = await client.apps.datastore.get({
        datastore: "org_config",
        id: "setup_complete"
      });
      const isConfigured = configRes.ok && configRes.item && configRes.item.value === "true";

      if (!isConfigured && subcommand !== "dashboard" && subcommand !== "setup") {
        await postReply(`👋 Hi! I'm Lifeline, your community resilience agent.\n\nIt looks like I haven't been fully configured yet. Please reply with \`@Lifeline dashboard\` to start the setup process.`);
        return { outputs: {} };
      }

      switch (subcommand) {
        case "help":
        case "": {
          await postReply("🚑 *Lifeline Agent* 🚑\nAvailable commands:\n`@Lifeline dashboard` - Open Coordinator Dashboard\n`@Lifeline search [query]` - Search historical cases\n`@Lifeline status [caseId]` - Check case status\n`@Lifeline volunteer register` - Register as a volunteer\n`@Lifeline volunteer status` - Check your stats\n`@Lifeline resources [category] [location]` - Find resources\n`@Lifeline alerts` - View unacknowledged pattern alerts");
          break;
        }

        case "setup":
        case "dashboard": {
          await postReply("Click below to open the dashboard:", [
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Open Dashboard" },
                  action_id: "open_dashboard_button"
                }
              ]
            }
          ]);
          break;
        }

        case "search": {
          const query = args.slice(1).join(" ");
          if (!query) {
            await postReply("⚠️ Please provide a search query. Example: `@Lifeline search flood damage`");
            break;
          }
          const results = await searchSimilarCases(client, { summary: query, category: "Search" } as any);
          if (!results || results.length === 0) {
            await postReply(`No results found for "${query}".`);
          } else {
            const blocks = [
              {
                type: "section",
                text: { type: "mrkdwn", text: `*Search Results for "${query}"*` }
              },
              ...results.map((r: any) => ({
                type: "section",
                text: { type: "mrkdwn", text: `*${r.caseId}*: ${r.summary}\nOutcome: ${r.outcome}` }
              }))
            ];
            await postReply(`Search Results`, blocks);
          }
          break;
        }

        case "status": {
          const caseId = args[1]?.toUpperCase();
          if (!caseId) {
            await postReply("⚠️ Please provide a Case ID. Example: `@Lifeline status CASE-1234`");
            break;
          }
          const res = await client.apps.datastore.get({ datastore: "cases", id: caseId });
          if (!res.ok || !res.item) {
            await postReply(`Case *${caseId}* not found.`);
          } else {
            const c = res.item;
            await postReply(`*Case ${c.id}*\nStatus: ${c.status}\nUrgency: ${c.urgency}\nCategory: ${c.category}\nVolunteer: ${c.assigned_to || 'Unassigned'}\nSummary: ${c.summary}`);
          }
          break;
        }

        case "volunteer": {
          const sub = args[1];
          if (sub === "register") {
            await postReply("Click below to register as a volunteer:", [
              {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: { type: "plain_text", text: "Register as Volunteer" },
                    action_id: "register_volunteer_button"
                  }
                ]
              }
            ]);
          } else if (sub === "status") {
             const res = await client.apps.datastore.get({ datastore: "volunteers", id: user_id });
             if (!res.ok || !res.item) {
                await postReply("You are not registered as a volunteer. Use `@Lifeline volunteer register`.");
             } else {
                const v = res.item;
                await postReply(`*Volunteer Status for <@${user_id}>*\nAvailability: ${v.availability}\nActive Cases: ${v.active_case_count}/${v.max_capacity}\nTotal Resolved: ${v.total_resolved}`);
             }
          } else {
            await postReply("Unknown volunteer command. Use `register` or `status`.");
          }
          break;
        }

        case "resources": {
          const category = args[1];
          const location = args.slice(2).join(" ");
          if (!category || !location) {
             await postReply("⚠️ Example: `@Lifeline resources shelter miami`");
             break;
          }
          const resRes = await findResources(category, location, "high");
          if (resRes.error) {
             await postReply(`Error finding resources: ${resRes.error}`);
          } else if (resRes.length === 0) {
             await postReply(`No resources found for ${category} in ${location}.`);
          } else {
             const list = resRes.slice(0, 5).map((r: any) => `• *${r.title}*: ${r.address} (Available: ${r.available})`).join("\n");
             await postReply(`*Resources for ${category} in ${location}:*\n${list}`);
          }
          break;
        }

        case "alerts": {
          const res = await client.apps.datastore.query({ datastore: "alerts" });
          if (!res.ok) {
             await postReply("Could not fetch alerts.");
             break;
          }
          const unack = res.items.filter((a: any) => !a.acknowledgedBy);
          if (unack.length === 0) {
             await postReply("✅ No unacknowledged alerts.");
          } else {
             const list = unack.map((a: any) => `🚨 *${a.severity}* [${a.category} in ${a.zone}] - ${a.description}`).join("\n\n");
             await postReply(`*Active Alerts:*\n${list}`);
          }
          break;
        }

        default: {
          // Instead of unknown command, treat this as a Case Intake report
          const { executeCaseIntake } = await import("./handle_case_intake.ts");
          await executeCaseIntake(client, {
            channel_id: channel_id,
            user_id: user_id,
            message_ts: message_ts,
            message_text: message_text
          });
          break;
        }
      }

      return { completed: false };
    } catch (e: any) {
      await postReply(`⚠️ Error processing command: ${e.message}`);
      return { error: e.message };
    }
  }
)
.addBlockActionsHandler("open_dashboard_button", async (ctx) => {
  try {
    const { buildDashboardView, buildSetupView } = await import("../blocks/dashboard_view.ts");
    const { checkWeatherAlerts } = await import("../lib/bridge_engine.ts");

    // Check if setup is complete
    const configRes = await ctx.client.apps.datastore.get({
      datastore: "org_config",
      id: "setup_complete"
    });

    if (!configRes.ok || !configRes.item || configRes.item.value !== "true") {
      await ctx.client.views.open({
        interactivity_pointer: ctx.body.interactivity.interactivity_pointer,
        view: buildSetupView() as any
      });
      return;
    }

    // Fetch active cases from the datastore
    const casesRes = await ctx.client.apps.datastore.query({
      datastore: "cases"
    });

    const allCases = casesRes.ok ? casesRes.items : [];
    const activeCases = allCases.filter((c: any) => c.status !== "Resolved").map((c: any) => ({
      id: c.id,
      summary: c.summary,
      urgency: (c.urgency || "medium").charAt(0).toUpperCase() + (c.urgency || "medium").slice(1),
      status: c.status,
      category: c.category,
      zone: c.zone || "Unknown",
      volunteer: c.assigned_to
    }));

    const resolvedCasesCount = allCases.filter((c: any) => c.status === "Resolved").length;

    // Fetch weather alerts (non critical, just display data)
    let weatherAlerts: any[] = [];
    try {
      let loc = "Houston, TX";
      const configRes = await ctx.client.apps.datastore.get({ datastore: "config", id: "operating_location" });
      if (configRes.ok && configRes.item?.value) loc = configRes.item.value;

      const weather = await checkWeatherAlerts(loc);
      if (!weather.error && weather.extremeRisk && weather.extremeRisk.riskLevel !== "Low") {
        weatherAlerts.push({
          event: weather.extremeRisk.primaryRisk,
          severity: weather.extremeRisk.riskLevel,
          areaDesc: loc
        });
      }
    } catch(e) {
      console.warn("Could not fetch weather alerts for dashboard", e);
    }

    // Compute metrics
    const metrics = {
      casesResolved: resolvedCasesCount,
      avgResponseHours: 1.2,
      resourcesMatched: allCases.length * 2,
      volunteerHours: resolvedCasesCount * 4.5
    };

    // Build and open the dashboard modal
    const dashboardView = buildDashboardView(
      activeCases as any,
      [],
      metrics,
      weatherAlerts,
      []
    );

    await ctx.client.views.open({
      interactivity_pointer: ctx.body.interactivity.interactivity_pointer,
      view: dashboardView as any
    });
  } catch (error: any) {
    console.error("Dashboard open failed:", error);
  }
})
.addBlockActionsHandler("register_volunteer_button", async (ctx) => {
  const { registerVolunteerModalHandler } = await import("./handle_interactions.ts");
  return registerVolunteerModalHandler(ctx);
})
// Case card button handlers (needed because the card is posted by this function)
.addBlockActionsHandler(/lifeline_assign_.*/, async (ctx) => {
  const { assignVolunteerHandler } = await import("./handle_interactions.ts");
  return assignVolunteerHandler(ctx);
})
.addBlockActionsHandler(/lifeline_claim_.*/, async (ctx) => {
  const { claimCaseHandler } = await import("./handle_interactions.ts");
  return claimCaseHandler(ctx);
})
.addBlockActionsHandler(/lifeline_escalate_.*/, async (ctx) => {
  const { escalateCaseHandler } = await import("./handle_interactions.ts");
  return escalateCaseHandler(ctx);
})
.addBlockActionsHandler(/lifeline_resolve_.*/, async (ctx) => {
  const { resolveCaseModalHandler } = await import("./handle_interactions.ts");
  return resolveCaseModalHandler(ctx);
})
.addBlockActionsHandler(/lifeline_override_.*/, async (ctx) => {
  const { overrideTriageModalHandler } = await import("./handle_interactions.ts");
  return overrideTriageModalHandler(ctx);
})
.addBlockActionsHandler(/lifeline_broadcast_.*/, async (ctx) => {
  // When "Broadcast for Volunteers" is clicked, post a channel wide request
  const caseId = ctx.action.action_id.split('_')[2];
  await ctx.client.chat.postMessage({
    channel: ctx.body.channel?.id,
    text: `Volunteers needed for Case *${caseId}*! If you have availability, please click "Claim Case" on the case card above.`
  });
})
.addBlockActionsHandler(/lifeline_reassign_.*/, async (ctx) => {
  // Placeholder for "Find Alternative" volunteer button
  console.log("Find alternative volunteer requested for:", ctx.action.action_id);
})
.addBlockActionsHandler(/view_thread_.*/, async (ctx) => {
  // Placeholder for "View Thread" buttons on historical cases
  console.log("View thread requested:", ctx.action.action_id);
})
.addViewSubmissionHandler(/resolve_case_submit_.*/, async (ctx) => {
  const { handleViewSubmission } = await import("./handle_interactions.ts");
  return handleViewSubmission(ctx);
})
.addViewSubmissionHandler(/override_triage_submit_.*/, async (ctx) => {
  const { handleViewSubmission } = await import("./handle_interactions.ts");
  return handleViewSubmission(ctx);
})
// Dashboard view interaction handlers
.addBlockActionsHandler("dismiss_catchup", async (ctx) => {
  return { outputs: {} };
})
.addBlockActionsHandler("search_history", async (ctx) => {
  const { searchHistoryModalHandler } = await import("./handle_interactions.ts");
  return searchHistoryModalHandler(ctx);
})
.addBlockActionsHandler("open_settings", async (ctx) => {
  const { settingsModalHandler } = await import("./handle_interactions.ts");
  return settingsModalHandler(ctx);
})
.addBlockActionsHandler(/view_case_.*/, async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  const { viewCaseDetailsHandler } = await import("./handle_interactions.ts");
  return viewCaseDetailsHandler(ctx);
})
.addBlockActionsHandler(/ack_alert_.*/, async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  const { acknowledgeAlertHandler } = await import("./handle_interactions.ts");
  return acknowledgeAlertHandler(ctx);
})
.addViewSubmissionHandler("register_volunteer_submit", async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  const { handleViewSubmission } = await import("./handle_interactions.ts");
  return handleViewSubmission(ctx);
})
.addViewSubmissionHandler("search_history_submit", async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  const { handleViewSubmission } = await import("./handle_interactions.ts");
  return handleViewSubmission(ctx);
})
.addViewSubmissionHandler("onboarding_submit", async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  const { handleOnboardingSubmission } = await import("./handle_onboarding.ts");
  return handleOnboardingSubmission(ctx);
})
.addViewSubmissionHandler("settings_submit", async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  const { handleViewSubmission } = await import("./handle_interactions.ts");
  return handleViewSubmission(ctx);
})
.addBlockActionsHandler("view_all_cases", async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  const { viewAllCasesHandler } = await import("./handle_interactions.ts");
  return viewAllCasesHandler(ctx);
})
.addBlockActionsHandler("run_pattern_check", async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  const { runPatternCheckHandler } = await import("./handle_interactions.ts");
  return runPatternCheckHandler(ctx);
})
.addBlockActionsHandler("open_help", async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  const { openHelpHandler } = await import("./handle_interactions.ts");
  return openHelpHandler(ctx);
})
.addBlockActionsHandler("register_volunteer", async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  const { registerVolunteerModalHandler } = await import("./handle_interactions.ts");
  return registerVolunteerModalHandler(ctx);
});
