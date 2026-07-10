import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

export const UserSessionsDatastore = DefineDatastore({
  name: "user_sessions",
  primary_key: "user_id",
  primary_key_type: Schema.slack.types.user_id,
  attributes: {
    user_id: { type: Schema.slack.types.user_id },
    last_active_ts: { type: Schema.types.number },
  },
});
