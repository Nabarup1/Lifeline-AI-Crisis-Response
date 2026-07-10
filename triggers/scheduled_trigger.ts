import { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerTypes } from "deno-slack-api/mod.ts";
import { PatternDetectionWorkflow } from "../workflows/pattern_detection_workflow.ts";

// Run every 6 hours to scan for emerging patterns
const PATTERN_DETECTION_INTERVAL_HOURS = 6;

const scheduledPatternTrigger: Trigger<typeof PatternDetectionWorkflow.definition> = {
  type: TriggerTypes.Scheduled,
  name: "Scheduled Pattern Detection",
  description: `Runs the pattern detection scan every ${PATTERN_DETECTION_INTERVAL_HOURS} hours`,
  workflow: `#/workflows/${PatternDetectionWorkflow.definition.callback_id}`,
  schedule: {
    // Start one minute from now (will be overwritten on deployment)
    start_time: new Date(Date.now() + 60_000).toISOString(),
    frequency: {
      type: "hourly",
      repeats_every: PATTERN_DETECTION_INTERVAL_HOURS,
    },
  },
  inputs: {},
};

export default scheduledPatternTrigger;
