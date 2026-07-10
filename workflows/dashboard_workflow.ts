import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { RenderDashboardDefinition } from "../functions/render_dashboard.ts";

export const DashboardWorkflow = DefineWorkflow({
  callback_id: "dashboard_workflow",
  title: "Dashboard Workflow",
  description: "Renders the Lifeline App Home Dashboard",
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
    },
    required: ["interactivity"],
  },
});

DashboardWorkflow.addStep(RenderDashboardDefinition, {
  interactivity: DashboardWorkflow.inputs.interactivity,
  user_id: DashboardWorkflow.inputs.interactivity.interactor.id,
});
