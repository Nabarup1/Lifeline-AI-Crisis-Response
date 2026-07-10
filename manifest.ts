import { Manifest } from "deno-slack-sdk/mod.ts";
import { CasesDatastore } from "./datastores/cases_store.ts";
import { VolunteersDatastore } from "./datastores/volunteers_store.ts";
import { AlertsDatastore } from "./datastores/alerts_store.ts";
import { ConfigDatastore } from "./datastores/config_store.ts";
import { UserSessionsDatastore } from "./datastores/user_sessions_store.ts";

import { CaseIntakeWorkflow } from "./workflows/case_intake_workflow.ts";
import { DashboardWorkflow } from "./workflows/dashboard_workflow.ts";
import { PatternDetectionWorkflow } from "./workflows/pattern_detection_workflow.ts";
import { SlashCommandWorkflow } from "./workflows/slash_command_workflow.ts";
import { AppMentionWorkflow } from "./workflows/app_mention_workflow.ts";

export default Manifest({
  name: "Lifeline",
  description: "Community Resilience Agent: No one falls through the cracks",
  longDescription:
    "Lifeline transforms community organizations into rapid-response coordination centers with institutional memory, real-world resource awareness, predictive intelligence, and universal accessibility.",
  icon: "assets/default_new_app_icon.png",
  workflows: [CaseIntakeWorkflow, DashboardWorkflow, PatternDetectionWorkflow, SlashCommandWorkflow, AppMentionWorkflow],
  outgoingDomains: [
    "generativelanguage.googleapis.com",
    "maps.googleapis.com",
    "geocoding-api.open-meteo.com",
    "api.open-meteo.com",
    "api.reliefweb.int",
    "api.weather.gov",
    "www.fema.gov"
  ],
  features: {
    appHome: {
      homeTabEnabled: true,
      showUserNamesEnabled: true,
    },
  },
  datastores: [
    CasesDatastore,
    VolunteersDatastore,
    AlertsDatastore,
    ConfigDatastore,
    UserSessionsDatastore,
  ],
  botScopes: [
    "app_mentions:read",
    "channels:history",
    "channels:read",
    "chat:write",
    "commands",
    "groups:history",
    "groups:read",
    "im:history",
    "im:read",
    "im:write",
    "reactions:read",
    "reactions:write",
    "users:read",
    "files:read",
    "datastore:read",
    "datastore:write",
  ],
});
