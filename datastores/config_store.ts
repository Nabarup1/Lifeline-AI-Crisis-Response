import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

export const ConfigDatastore = DefineDatastore({
  name: "org_config",
  primary_key: "key",
  primary_key_type: Schema.types.string,
  attributes: {
    key: { type: Schema.types.string },
    value: { type: Schema.types.string }, // JSON serialized value
  },
});
