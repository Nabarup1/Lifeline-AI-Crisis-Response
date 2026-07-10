import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { RenderDashboardDefinition } from "../functions/render_dashboard.ts";

export const SlashCommandWorkflow = DefineWorkflow({
  callback_id: "slash_command_workflow",
  title: "Lifeline Command Workflow",
  description: "Processes legacy /lifeline shortcut",
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
      channel_id: { type: Schema.slack.types.channel_id },
      user_id: { type: Schema.slack.types.user_id },
      command: { type: Schema.types.string },
    },
    required: ["interactivity"],
  },
});

// Directly open the dashboard when the legacy shortcut is clicked
SlashCommandWorkflow.addStep(RenderDashboardDefinition, {
  interactivity: SlashCommandWorkflow.inputs.interactivity,
  user_id: SlashCommandWorkflow.inputs.interactivity.interactor.id,
});
