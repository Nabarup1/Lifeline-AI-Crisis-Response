import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { buildDashboardView, buildSetupView } from "../blocks/dashboard_view.ts";
import { generateCatchUpSummary, buildCatchUpMessage } from "../lib/catchup_engine.ts";
import { checkWeatherAlerts } from "../lib/bridge_engine.ts";
import { startOnboardingHandler, handleOnboardingSubmission } from "./handle_onboarding.ts";
import { 
  viewCaseDetailsHandler, 
  acknowledgeAlertHandler, 
  registerVolunteerModalHandler, 
  searchHistoryModalHandler, 
  settingsModalHandler, 
  handleViewSubmission 
} from "./handle_interactions.ts";

export const RenderDashboardDefinition = DefineFunction({
  callback_id: "render_dashboard",
  title: "Render Dashboard",
  description: "Fetches data and renders the App Home dashboard for a user",
  source_file: "functions/render_dashboard.ts",
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
      user_id: { type: Schema.slack.types.user_id },
    },
    required: ["interactivity", "user_id"],
  },
  output_parameters: {
    properties: {},
    required: [],
  },
});

import { initEnv } from "../lib/constants.ts";
import { initLlmEnv } from "../lib/llm_client.ts";

export default SlackFunction(
  RenderDashboardDefinition,
  async ({ inputs, client, env }) => {
    initEnv(env);
    initLlmEnv(env);
    try {
      // 0. Check Configuration
      const configRes = await client.apps.datastore.get({
        datastore: "org_config",
        key: "setup_complete"
      });
      
      if (!configRes.ok || !configRes.item || configRes.item.value !== "true") {
        await client.views.open({
          interactivity_pointer: inputs.interactivity.interactivity_pointer,
          view: buildSetupView() as any
        });
        return { completed: false };
      }

      // 0.5 Check User Session for Async Catch-Up
      let catchUpBlocks: any[] = [];
      try {
        const sessionRes = await client.apps.datastore.get({
          datastore: "user_sessions",
          user_id: inputs.user_id
        });
        
        const now = Date.now();
        const fourHoursMs = 4 * 60 * 60 * 1000;
        
        // If they have a last active timestamp and it's older than 4 hours
        if (sessionRes.ok && sessionRes.item && sessionRes.item.last_active_ts) {
          const lastActive = sessionRes.item.last_active_ts;
          if (now - lastActive > fourHoursMs) {
             const summaryText = await generateCatchUpSummary(client, inputs.user_id, lastActive);
             if (summaryText && summaryText.length > 0 && !summaryText.includes("all caught up")) {
                catchUpBlocks = buildCatchUpMessage(summaryText);
             }
          }
        }
        
        // Update their session to right now
        await client.apps.datastore.put({
          datastore: "user_sessions",
          item: {
            user_id: inputs.user_id,
            last_active_ts: now
          }
        });
      } catch (e) {
        console.warn("Failed to process user session / catch-up", e);
      }

      // 1. Fetch Active Cases
      const casesRes = await client.apps.datastore.query({
        datastore: "cases"
      });
      
      const allCases = casesRes.ok ? casesRes.items : [];
      const activeCases = allCases.filter((c: any) => c.status !== "Resolved").map((c: any) => ({
        id: c.id,
        summary: c.summary,
        urgency: c.urgency.charAt(0).toUpperCase() + c.urgency.slice(1),
        status: c.status,
        category: c.category,
        zone: c.zone || "Unknown",
        volunteer: c.assigned_to
      }));

      const resolvedCasesCount = allCases.filter((c: any) => c.status === "Resolved").length;

      // 2. Fetch Active Pattern Alerts
      let patternAlerts = [];
      // Assuming we have an alerts store or we can just mock it if not fully populated
      try {
        const alertsRes = await client.apps.datastore.query({
          datastore: "alerts"
        });
        if (alertsRes.ok) {
          patternAlerts = alertsRes.items.filter((a: any) => !a.acknowledgedBy).map((a: any) => ({
            id: a.id,
            severity: a.severity || "Medium",
            description: a.description || "Pattern detected"
          }));
        }
      } catch (e) {
        console.warn("Could not fetch pattern alerts", e);
      }

      // 3. Fetch Weather Alerts (Bridge Engine)
      let weatherAlerts = [];
      try {
        let loc = "Houston, TX";
        const configRes = await client.apps.datastore.get({ datastore: "org_config", key: "operating_location" });
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
        console.warn("Could not fetch weather alerts", e);
      }

      // 4. Compute Metrics
      const metrics = {
        casesResolved: resolvedCasesCount,
        avgResponseHours: 1.2, // Mocked for hackathon
        resourcesMatched: allCases.length * 2, // Mocked 
        volunteerHours: resolvedCasesCount * 4.5 // Mocked
      };

      // 5. Build View
      const dashboardView = buildDashboardView(
        activeCases as any,
        patternAlerts,
        metrics,
        weatherAlerts,
        catchUpBlocks
      );

      // 6. Publish View
      await client.views.open({
        interactivity_pointer: inputs.interactivity.interactivity_pointer,
        view: dashboardView as any
      });

      return { completed: false };
    } catch (error: any) {
      console.error("Failed to render dashboard:", error);
      // Publish an error view if possible
      await client.views.open({
        interactivity_pointer: inputs.interactivity.interactivity_pointer,
        view: {
          type: "modal",
          title: { type: "plain_text", text: "Lifeline Error" },
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `⚠️ *Error loading dashboard:* ${error.message}`
              }
            }
          ]
        }
      });
      return { error: error.message };
    }
  }
)
.addBlockActionsHandler(/view_case_.*/, async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  return viewCaseDetailsHandler(ctx);
})
.addBlockActionsHandler(/ack_alert_.*/, async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  return acknowledgeAlertHandler(ctx);
})
.addBlockActionsHandler("register_volunteer", async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  return registerVolunteerModalHandler(ctx);
})
.addBlockActionsHandler("start_onboarding", async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  return startOnboardingHandler(ctx);
})
.addBlockActionsHandler("dismiss_catchup", async (ctx) => {
  return { outputs: {} };
})
.addBlockActionsHandler("search_history", async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  return searchHistoryModalHandler(ctx);
})
.addBlockActionsHandler("open_settings", async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  return settingsModalHandler(ctx);
})
.addViewSubmissionHandler("register_volunteer_submit", async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  return handleViewSubmission(ctx);
})
.addViewSubmissionHandler("search_history_submit", async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  return handleViewSubmission(ctx);
})
.addViewSubmissionHandler("onboarding_submit", async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  return handleOnboardingSubmission(ctx);
})
.addViewSubmissionHandler("settings_submit", async (ctx) => {
  initEnv(ctx.env); initLlmEnv(ctx.env);
  return handleViewSubmission(ctx);
})
.addBlockActionsHandler("view_all_cases", async (ctx) => {
  return { outputs: {} }; // Mock handler to prevent unhandled action error
})
.addBlockActionsHandler("run_pattern_check", async (ctx) => {
  return { outputs: {} }; // Mock handler to prevent unhandled action error
});
