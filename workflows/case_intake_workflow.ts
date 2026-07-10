import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { HandleCaseIntakeDefinition } from "../functions/handle_case_intake.ts";

export const CaseIntakeWorkflow = DefineWorkflow({
  callback_id: "case_intake_workflow",
  title: "Case Intake Workflow",
  description: "Orchestrates the Lifeline response to new emergency reports.",
  input_parameters: {
    properties: {
      channel_id: { type: Schema.slack.types.channel_id },
      message_ts: { type: Schema.slack.types.message_ts },
      message_text: { type: Schema.types.string },
      user_id: { type: Schema.slack.types.user_id },
    },
    required: ["channel_id", "message_ts", "message_text", "user_id"],
  },
});

CaseIntakeWorkflow.addStep(HandleCaseIntakeDefinition, {
  channel_id: CaseIntakeWorkflow.inputs.channel_id,
  message_ts: CaseIntakeWorkflow.inputs.message_ts,
  message_text: CaseIntakeWorkflow.inputs.message_text,
  user_id: CaseIntakeWorkflow.inputs.user_id,
});
