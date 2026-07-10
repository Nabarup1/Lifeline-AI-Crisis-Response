import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { triageMessage, generateActionPlan, translateText } from "../lib/signal_engine.ts";
import { detectLanguage, shouldTranslate, makeAccessible, simplifyForCrisis } from "../lib/accessibility.ts";
import { searchSimilarCases } from "../lib/memory_engine.ts";
import { findResources } from "../lib/bridge_engine.ts";
import { findBestVolunteer } from "../lib/volunteer_matcher.ts";
import { buildCaseIntakeCard } from "../blocks/case_card.ts";
import { 
  assignVolunteerHandler, 
  claimCaseHandler, 
  escalateCaseHandler, 
  resolveCaseModalHandler, 
  overrideTriageModalHandler, 
  handleViewSubmission 
} from "./handle_interactions.ts";

export const HandleCaseIntakeDefinition = DefineFunction({
  callback_id: "handle_case_intake",
  title: "Handle Case Intake",
  description: "Process an incoming message and generate a case card",
  source_file: "functions/handle_case_intake.ts",
  input_parameters: {
    properties: {
      channel_id: { type: Schema.slack.types.channel_id },
      message_ts: { type: Schema.slack.types.message_ts },
      message_text: { type: Schema.types.string },
      user_id: { type: Schema.slack.types.user_id },
    },
    required: ["channel_id", "message_ts", "message_text", "user_id"],
  },
  output_parameters: {
    properties: {
      case_id: { type: Schema.types.string },
      urgency: { type: Schema.types.string },
    },
    required: ["case_id", "urgency"],
  },
});

export async function executeCaseIntake(client: any, inputs: any) {
    try {
      // 1. Triage (Signal Engine)
      console.log("Starting Triage...");
      let triageResult;
      try {
         triageResult = await triageMessage(inputs.message_text);
      } catch (e) {
         console.error("Triage failed:", e);
         throw new Error("Critical Failure: Triage Engine Unreachable.");
      }

      // Detect language and translate if needed
      console.log("Detecting language...");
      const detectedLang = await detectLanguage(inputs.message_text);
      const needsTranslation = shouldTranslate(detectedLang, 'en');
      let reporterAckText = "We have received your request and are actively reviewing it. A case has been created.";
      
      if (needsTranslation) {
        console.log(`Translating acknowledgement to ${detectedLang}...`);
        reporterAckText = await translateText(reporterAckText, detectedLang);
      }
      
      // Generate Case ID
      const caseId = `CASE-${Date.now().toString().slice(-4)}`;

      // 2. Parallel Processing: Memory Search & Resource Search
      console.log("Running Memory and Bridge searches...");
      let historicalContext: any[] = [];
      let resources: any[] = [];

      try {
        const [memoryRes, bridgeRes] = await Promise.allSettled([
          searchSimilarCases(client, triageResult),
          findResources(triageResult.category, triageResult.zone || "Local", triageResult.urgency)
        ]);

        if (memoryRes.status === "fulfilled" && memoryRes.value) {
           historicalContext = memoryRes.value.map((m: any) => ({
             id: m.caseId,
             summary: m.summary.substring(0, 50) + "...",
             resolution: m.outcome || "Resolved",
             url: m.threadLink
           }));
        }

        if (bridgeRes.status === "fulfilled" && bridgeRes.value && !bridgeRes.value.error) {
           resources = bridgeRes.value;
        }
      } catch (e) {
        console.warn("Non-critical search engines failed", e);
      }

      // 3. Action Plan Generation
      console.log("Generating Action Plan...");
      let actionPlan: any[] = [];
      try {
        const rawPlan = await generateActionPlan(triageResult, historicalContext as any, resources as any);
        // The LLM prompt asks for {stepNumber, action} but normalize to {step, description}
        // so the card builder can display them cleanly
        actionPlan = rawPlan.map((p: any, i: number) => ({
          step: p.step || p.stepNumber || i + 1,
          description: p.description || p.action || "No details provided"
        }));
      } catch (e) {
        console.warn("Action plan generation failed", e);
      }

      // 4. Volunteer Matching
      console.log("Matching Volunteers...");
      let volunteerRecord = null;
      try {
        const matchResult = await findBestVolunteer(client, triageResult);
        if (matchResult) {
          volunteerRecord = {
            id: matchResult.volunteer.user_id,
            name: matchResult.volunteer.display_name,
            skills: matchResult.volunteer.skills,
            matchReason: matchResult.justification
          };
        }
      } catch (e) {
        console.warn("Volunteer matcher failed", e);
      }

      // 5. Build Response Card
      console.log("Building UI Card...");
      const cardBlocks = buildCaseIntakeCard(
        triageResult as any,
        historicalContext,
        resources,
        actionPlan,
        volunteerRecord,
        caseId,
        inputs.user_id,
        "Slack Channel"
      );

      // Pipe through accessibility and crisis simplifier
      let processedBlocks = makeAccessible(cardBlocks);
      processedBlocks = simplifyForCrisis(processedBlocks, triageResult.urgency);

      // 6. Post Response
      console.log("Posting to Slack...");
      const postResult = await client.chat.postMessage({
        channel: inputs.channel_id,
        text: `New Case Detected: ${caseId}`,
        blocks: processedBlocks as any
      });
      
      if (!postResult.ok) {
        console.error("Failed to post blocks:", postResult.error);
        await client.chat.postMessage({
          channel: inputs.channel_id,
          text: `🚨 New Case Detected: ${caseId}\n\n*Summary:* ${triageResult.summary}\n*Urgency:* ${triageResult.urgency}\n\n_(Note: UI Card failed to render. Use Dashboard for full details)_`
        });
      }

      // Ephemeral acknowledgement to the reporter (Translated if necessary)
      try {
        await client.chat.postEphemeral({
          channel: inputs.channel_id,
          user: inputs.user_id,
          text: `✅ ${reporterAckText}`
        });
      } catch (e) {
        console.warn("Failed to send ephemeral ack", e);
      }

      // 7. Persist to Datastore
      try {
        await client.apps.datastore.put({
          datastore: "cases",
          item: {
            id: caseId,
            status: "Open",
            urgency: triageResult.urgency,
            category: triageResult.category,
            summary: triageResult.summary,
            reported_by: inputs.user_id,
            channel_id: inputs.channel_id,
            thread_ts: postResult.ts || inputs.message_ts,
            created_at: Date.now(),
            updated_at: Date.now()
          }
        });
      } catch (e) {
        console.error("Failed to save to cases datastore", e);
      }

      // 8. Alerting (Critical path)
      if (triageResult.urgency === "critical") {
        await client.chat.postMessage({
          channel: inputs.channel_id,
          text: `🚨 @here *CRITICAL CASE DETECTED: ${caseId}*. Immediate attention required!`
        });
      }

      console.log("Case Intake Complete:", caseId);
      return { completed: false };

    } catch (error: any) {
      console.error("Fatal error in Case Intake:", error);
      await client.chat.postMessage({
        channel: inputs.channel_id,
        thread_ts: inputs.message_ts,
        text: `⚠️ Lifeline encountered an error processing this request: ${error.message}`
      });
      return { error: error.message };
    }
}

export default SlackFunction(
  HandleCaseIntakeDefinition,
  async ({ inputs, client }) => {
    return await executeCaseIntake(client, inputs);
  }
)
.addBlockActionsHandler(/lifeline_assign_.*/, async (ctx) => {
  return assignVolunteerHandler(ctx);
})
.addBlockActionsHandler(/lifeline_claim_.*/, async (ctx) => {
  return claimCaseHandler(ctx);
})
.addBlockActionsHandler(/lifeline_escalate_.*/, async (ctx) => {
  return escalateCaseHandler(ctx);
})
.addBlockActionsHandler(/lifeline_resolve_.*/, async (ctx) => {
  return resolveCaseModalHandler(ctx);
})
.addBlockActionsHandler(/lifeline_override_.*/, async (ctx) => {
  return overrideTriageModalHandler(ctx);
})
.addViewSubmissionHandler(/resolve_case_submit_.*/, async (ctx) => {
  return handleViewSubmission(ctx);
})
.addViewSubmissionHandler(/override_triage_submit_.*/, async (ctx) => {
  return handleViewSubmission(ctx);
});
