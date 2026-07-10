import { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import { DashboardWorkflow } from "../workflows/dashboard_workflow.ts";

const dashboardTrigger: Trigger<typeof DashboardWorkflow.definition> = {
  type: TriggerTypes.Shortcut,
  name: "Lifeline Dashboard",
  description: "Opens the Lifeline Dashboard Modal",
  workflow: `#/workflows/${DashboardWorkflow.definition.callback_id}`,
  inputs: {
    interactivity: {
      value: TriggerContextData.Shortcut.interactivity,
    },
  },
};

export default dashboardTrigger;
