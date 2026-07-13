import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { analyzePatterns } from "../lib/signal_engine.ts";
import { checkWeatherAlerts, getDisasterStatus } from "../lib/bridge_engine.ts";

// Configurable thresholds
const PATTERN_SPIKE_THRESHOLD_PERCENT = 50;
const DEFAULT_ALERT_CHANNEL = "C0BELDEDPD2"; // Replace with your actual alert channel

export const DetectPatternsDefinition = DefineFunction({
  callback_id: "detect_patterns",
  title: "Detect Patterns",
  description: "Scans recent case data for emerging community crises using statistical and LLM analysis",
  source_file: "functions/detect_patterns.ts",
  input_parameters: {
    properties: {},
    required: [],
  },
  output_parameters: {
    properties: {
      alerts_generated: { type: Schema.types.number },
    },
    required: [],
  },
});

import { initEnv } from "../lib/constants.ts";
import { initLlmEnv } from "../lib/llm_client.ts";

export default SlackFunction(
  DetectPatternsDefinition,
  async ({ client, env }) => {
    initEnv(env);
    initLlmEnv(env);
    try {
      console.log("[PatternDetection] Starting scheduled scan...");

      // 1. Data Gathering: Retrieve cases from the past 30 days
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const casesRes = await client.apps.datastore.query({
        datastore: "cases",
      });

      if (!casesRes.ok) {
        console.error("[PatternDetection] Failed to query cases:", casesRes.error);
        return { outputs: { alerts_generated: 0 } };
      }

      const allCases = casesRes.items.filter((c: any) => (c.created_at || 0) >= thirtyDaysAgo);
      console.log(`[PatternDetection] Found ${allCases.length} cases in last 30 days`);

      if (allCases.length < 3) {
        console.log("[PatternDetection] Not enough case data to detect patterns. Skipping.");
        return { outputs: { alerts_generated: 0 } };
      }

      // 2. Statistical Analysis: Aggregate by category and zone
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
      const twentyOneDaysAgo = Date.now() - (21 * 24 * 60 * 60 * 1000);

      const recentCases = allCases.filter((c: any) => (c.created_at || 0) >= sevenDaysAgo);
      const previousWeekCases = allCases.filter((c: any) => {
        const t = c.created_at || 0;
        return t >= fourteenDaysAgo && t < sevenDaysAgo;
      });
      const twoWeeksAgoCases = allCases.filter((c: any) => {
        const t = c.created_at || 0;
        return t >= twentyOneDaysAgo && t < fourteenDaysAgo;
      });

      // Count by category and zone for recent week
      const countByCatZone = (cases: any[]) => {
        const counts: Record<string, number> = {};
        cases.forEach((c: any) => {
          const key = `${c.category || "unknown"}::${c.zone || "unknown"}`;
          counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
      };

      const recentCounts = countByCatZone(recentCases);
      const previousCounts = countByCatZone(previousWeekCases);
      const twoWeeksAgoCounts = countByCatZone(twoWeeksAgoCases);

      // Find spikes and trends
      const spikes: Array<{
        category: string;
        zone: string;
        current: number;
        baseline: number;
        changePercent: number;
        isUpwardTrend: boolean;
      }> = [];

      for (const key of Object.keys(recentCounts)) {
        const [category, zone] = key.split("::");
        const current = recentCounts[key];
        const baseline = previousCounts[key] || 0;

        // Calculate percentage change
        let changePercent = 0;
        if (baseline > 0) {
          changePercent = ((current - baseline) / baseline) * 100;
        } else if (current > 0) {
          changePercent = 100; // New category that did not exist before
        }

        // Check for 3 week upward trend
        const twoWeeksAgoCount = twoWeeksAgoCounts[key] || 0;
        const isUpwardTrend = twoWeeksAgoCount < baseline && baseline < current;

        if (changePercent >= PATTERN_SPIKE_THRESHOLD_PERCENT || isUpwardTrend) {
          spikes.push({ category, zone, current, baseline, changePercent, isUpwardTrend });
        }
      }

      console.log(`[PatternDetection] Found ${spikes.length} statistical spikes`);

      if (spikes.length === 0) {
        return { outputs: { alerts_generated: 0 } };
      }

      // 3. External Signals: Fetch weather and disaster data
      let weatherAlerts: any[] = [];
      let disasters: any[] = [];
      try {
        let loc = "Houston, TX";
        const configRes = await client.apps.datastore.get({ datastore: "org_config", id: "operating_location" });
        if (configRes.ok && configRes.item?.value) loc = configRes.item.value;

        const [weatherRes, disasterRes] = await Promise.allSettled([
          checkWeatherAlerts(loc),
          getDisasterStatus()
        ]);

        if (weatherRes.status === "fulfilled" && !weatherRes.value.error) {
          weatherAlerts = weatherRes.value.alerts || [];
        }
        if (disasterRes.status === "fulfilled" && !disasterRes.value.error) {
          disasters = disasterRes.value.disasters || [];
        }
      } catch (e) {
        console.warn("[PatternDetection] External signal fetch failed:", e);
      }

      // 4. LLM enrichment: Pass statistical spikes and external data to the signal engine
      let alertsGenerated = 0;

      try {
        const enrichedResult = await analyzePatterns(
          recentCases.map((c: any) => ({
            urgency: c.urgency,
            category: c.category,
            createdAt: c.created_at
          })),
          { weatherAlerts, disasters }
        );

        // 5. Alerting: If confirmed, persist and broadcast
        if (enrichedResult) {
          for (const spike of spikes) {
            const alertId = `PAT-${Date.now()}-${spike.category}`;

            // Persist to datastore
            await client.apps.datastore.put({
              datastore: "pattern_alerts",
              item: {
                id: alertId,
                alert_type: spike.isUpwardTrend ? "trend" : "spike",
                category: spike.category,
                zone: spike.zone,
                severity: spike.changePercent >= 100 ? "Critical" : "High",
                description: enrichedResult.description ||
                  `${spike.category} cases in ${spike.zone} increased by ${Math.round(spike.changePercent)}% (${spike.baseline} to ${spike.current})`,
                current_value: spike.current,
                baseline_value: spike.baseline,
                change_percent: Math.round(spike.changePercent),
                external_correlations_json: JSON.stringify(weatherAlerts.map((a: any) => a.event || "weather")),
                recommendations_json: JSON.stringify(enrichedResult.recommendations || []),
                created_at: Date.now(),
                acknowledged_by: "",
                acknowledged_at: 0,
              }
            });

            // Broadcast to alert channel
            const alertChannelRes = await client.apps.datastore.get({
              datastore: "org_config",
              id: "alert_channel"
            });
            const alertChannel = alertChannelRes.ok && alertChannelRes.item?.value
              ? alertChannelRes.item.value
              : DEFAULT_ALERT_CHANNEL;

            await client.chat.postMessage({
              channel: alertChannel,
              text: `🚨 *PATTERN ALERT: ${spike.category.toUpperCase()} in ${spike.zone}*\n` +
                `Volume increased *${Math.round(spike.changePercent)}%* (${spike.baseline} to ${spike.current} cases this week).\n` +
                `${spike.isUpwardTrend ? "⬆️ *3-week upward trend detected.*\n" : ""}` +
                `_${enrichedResult.description || "Review recommended."}_`
            });

            alertsGenerated++;
          }
        }
      } catch (e) {
        console.error("[PatternDetection] LLM enrichment failed:", e);

        // Fallback: still persist raw statistical alerts without LLM enrichment
        for (const spike of spikes) {
          const alertId = `PAT-${Date.now()}-${spike.category}`;
          await client.apps.datastore.put({
            datastore: "pattern_alerts",
            item: {
              id: alertId,
              alert_type: spike.isUpwardTrend ? "trend" : "spike",
              category: spike.category,
              zone: spike.zone,
              severity: spike.changePercent >= 100 ? "Critical" : "High",
              description: `${spike.category} cases in ${spike.zone} increased by ${Math.round(spike.changePercent)}%`,
              current_value: spike.current,
              baseline_value: spike.baseline,
              change_percent: Math.round(spike.changePercent),
              external_correlations_json: "[]",
              recommendations_json: "[]",
              created_at: Date.now(),
              acknowledged_by: "",
              acknowledged_at: 0,
            }
          });
          alertsGenerated++;
        }
      }

      console.log(`[PatternDetection] Scan complete. Generated ${alertsGenerated} alerts.`);
      return { outputs: { alerts_generated: alertsGenerated } };

    } catch (error: any) {
      console.error("[PatternDetection] Fatal error:", error);
      return { error: error.message };
    }
  }
);
