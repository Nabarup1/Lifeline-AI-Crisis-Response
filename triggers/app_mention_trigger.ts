import { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import { AppMentionWorkflow } from "../workflows/app_mention_workflow.ts";

const appMentionTrigger: Trigger<typeof AppMentionWorkflow.definition> = {
  type: TriggerTypes.Event,
  name: "App Mention Trigger",
  description: "Triggers on @Lifeline mentions",
  workflow: `#/workflows/${AppMentionWorkflow.definition.callback_id}`,
  event: {
    event_type: "slack#/events/app_mentioned",
    channel_ids: ["C0BEEM6912A"], // Required by Slack for event triggers
  },
  inputs: {
    channel_id: {
      value: TriggerContextData.Event.AppMentioned.channel_id,
    },
    user_id: {
      value: TriggerContextData.Event.AppMentioned.user_id,
    },
    message_ts: {
      value: TriggerContextData.Event.AppMentioned.message_ts,
    },
    message_text: {
      value: TriggerContextData.Event.AppMentioned.text,
    },
  },
};

export default appMentionTrigger;
