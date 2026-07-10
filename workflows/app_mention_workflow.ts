import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { HandleAppMentionDefinition } from "../functions/handle_app_mention.ts";

export const AppMentionWorkflow = DefineWorkflow({
  callback_id: "app_mention_workflow",
  title: "App Mention Handler",
  description: "Handles @Lifeline mentions",
  input_parameters: {
    properties: {
      channel_id: { type: Schema.slack.types.channel_id },
      user_id: { type: Schema.slack.types.user_id },
      message_ts: { type: Schema.slack.types.message_ts },
      message_text: { type: Schema.types.string },
    },
    required: ["channel_id", "user_id", "message_ts", "message_text"],
  },
});

AppMentionWorkflow.addStep(HandleAppMentionDefinition, {
  channel_id: AppMentionWorkflow.inputs.channel_id,
  user_id: AppMentionWorkflow.inputs.user_id,
  message_ts: AppMentionWorkflow.inputs.message_ts,
  message_text: AppMentionWorkflow.inputs.message_text,
});
