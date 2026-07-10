import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

export const VolunteersDatastore = DefineDatastore({
  name: "volunteers",
  primary_key: "user_id",
  primary_key_type: Schema.types.string,
  attributes: {
    user_id: { type: Schema.types.string },
    display_name: { type: Schema.types.string },
    languages_json: { type: Schema.types.string }, // Serialized string array
    skills_json: { type: Schema.types.string }, // Serialized CaseCategory array
    zones_json: { type: Schema.types.string }, // Serialized string array
    active_case_count: { type: Schema.types.number },
    max_capacity: { type: Schema.types.number },
    total_resolved: { type: Schema.types.number },
    availability: { type: Schema.types.string },
  },
});
