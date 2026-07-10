import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

export const CasesDatastore = DefineDatastore({
  name: "cases",
  primary_key: "id",
  primary_key_type: Schema.types.string,
  attributes: {
    id: { type: Schema.types.string },
    status: { type: Schema.types.string },
    urgency: { type: Schema.types.string },
    category: { type: Schema.types.string },
    summary: { type: Schema.types.string },
    reported_by: { type: Schema.types.string },
    assigned_to: { type: Schema.types.string },
    channel_id: { type: Schema.types.string },
    thread_ts: { type: Schema.types.string },
    entities_json: { type: Schema.types.string }, // Serialized ExtractedEntities
    resources_json: { type: Schema.types.string }, // Serialized ResourceMatch array
    action_plan_json: { type: Schema.types.string }, // Serialized ActionPlanStep array
    historical_case_ids_json: { type: Schema.types.string }, // Serialized string array
    created_at: { type: Schema.types.number },
    updated_at: { type: Schema.types.number },
    resolved_at: { type: Schema.types.number },
    resolution_notes: { type: Schema.types.string },
  },
});
