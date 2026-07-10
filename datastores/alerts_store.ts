import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

export const AlertsDatastore = DefineDatastore({
  name: "pattern_alerts",
  primary_key: "id",
  primary_key_type: Schema.types.string,
  attributes: {
    id: { type: Schema.types.string },
    alert_type: { type: Schema.types.string },
    category: { type: Schema.types.string },
    zone: { type: Schema.types.string },
    severity: { type: Schema.types.string },
    description: { type: Schema.types.string },
    current_value: { type: Schema.types.number },
    baseline_value: { type: Schema.types.number },
    change_percent: { type: Schema.types.number },
    external_correlations_json: { type: Schema.types.string }, // Serialized string array
    recommendations_json: { type: Schema.types.string }, // Serialized string array
    created_at: { type: Schema.types.number },
    acknowledged_by: { type: Schema.types.string },
    acknowledged_at: { type: Schema.types.number },
  },
});
