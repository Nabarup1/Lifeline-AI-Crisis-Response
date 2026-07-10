import { DefineWorkflow } from "deno-slack-sdk/mod.ts";
import { DetectPatternsDefinition } from "../functions/detect_patterns.ts";

export const PatternDetectionWorkflow = DefineWorkflow({
  callback_id: "pattern_detection_workflow",
  title: "Pattern Detection Workflow",
  description: "Periodically scans case data for emerging community crises",
  input_parameters: {
    properties: {},
    required: [],
  },
});

PatternDetectionWorkflow.addStep(DetectPatternsDefinition, {});
