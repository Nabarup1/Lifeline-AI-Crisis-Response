import { SlackAPIClient } from "deno-slack-sdk/types.ts";
import { CaseRecord, CaseStatus, CaseUrgency, VolunteerRecord } from "./types.ts";

// Helper to interact with Datastores via Slack API Client
export async function createCase(client: SlackAPIClient, caseRecord: CaseRecord) {
  const response = await client.apps.datastore.put({
    datastore: "cases",
    item: {
      id: caseRecord.id,
      status: caseRecord.status,
      urgency: caseRecord.urgency,
      category: caseRecord.category,
      summary: caseRecord.summary,
      reported_by: caseRecord.reportedBy,
      assigned_to: caseRecord.assignedTo || "",
      channel_id: caseRecord.channelId,
      thread_ts: caseRecord.threadTs,
      entities_json: JSON.stringify(caseRecord.entities),
      resources_json: JSON.stringify(caseRecord.resourcesMatched),
      action_plan_json: JSON.stringify(caseRecord.actionPlan),
      historical_case_ids_json: JSON.stringify(caseRecord.historicalCaseIds),
      created_at: caseRecord.createdAt,
      updated_at: caseRecord.updatedAt,
      resolved_at: caseRecord.resolvedAt || 0,
      resolution_notes: caseRecord.resolutionNotes || "",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to create case: ${response.error}`);
  }
  return response;
}

export async function getCaseById(client: SlackAPIClient, caseId: string): Promise<CaseRecord | null> {
  const response = await client.apps.datastore.get({
    datastore: "cases",
    id: caseId,
  });
  if (!response.ok || !response.item) {
    return null;
  }
  const item = response.item;
  return {
    id: item.id as string,
    status: item.status as CaseStatus,
    urgency: item.urgency as CaseUrgency,
    category: item.category as any,
    summary: item.summary as string,
    reportedBy: item.reported_by as string,
    assignedTo: item.assigned_to ? (item.assigned_to as string) : null,
    channelId: item.channel_id as string,
    threadTs: item.thread_ts as string,
    entities: JSON.parse(item.entities_json as string),
    resourcesMatched: JSON.parse(item.resources_json as string),
    actionPlan: JSON.parse(item.action_plan_json as string),
    historicalCaseIds: JSON.parse(item.historical_case_ids_json as string),
    createdAt: item.created_at as number,
    updatedAt: item.updated_at as number,
    resolvedAt: item.resolved_at ? (item.resolved_at as number) : null,
    resolutionNotes: item.resolution_notes ? (item.resolution_notes as string) : null,
  };
}

export async function updateCaseStatus(client: SlackAPIClient, caseId: string, newStatus: CaseStatus, notes?: string) {
  const caseRecord = await getCaseById(client, caseId);
  if (!caseRecord) throw new Error("Case not found");

  const item: Record<string, any> = {
    id: caseId,
    status: newStatus,
    updated_at: Math.floor(Date.now() / 1000),
  };
  
  if (notes) {
    item.resolution_notes = notes;
  }
  
  if (newStatus === "resolved" || newStatus === "closed") {
    item.resolved_at = Math.floor(Date.now() / 1000);
  }

  const response = await client.apps.datastore.update({
    datastore: "cases",
    item: item,
  });
  if (!response.ok) {
    throw new Error(`Failed to update case status: ${response.error}`);
  }
}

export async function getActiveCases(client: SlackAPIClient): Promise<CaseRecord[]> {
  const response = await client.apps.datastore.query({
    datastore: "cases",
    expression: "#status IN (:new, :assigned, :in_progress)",
    expression_attributes: { "#status": "status" },
    expression_values: { ":new": "new", ":assigned": "assigned", ":in_progress": "in_progress" },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to query active cases: ${response.error}`);
  }
  
  return Promise.all(response.items.map(item => getCaseById(client, item.id as string) as Promise<CaseRecord>));
}

export async function getCasesByUrgency(client: SlackAPIClient, urgency: CaseUrgency): Promise<CaseRecord[]> {
  const response = await client.apps.datastore.query({
    datastore: "cases",
    expression: "#urgency = :urg",
    expression_attributes: { "#urgency": "urgency" },
    expression_values: { ":urg": urgency },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to query cases by urgency: ${response.error}`);
  }
  
  return Promise.all(response.items.map(item => getCaseById(client, item.id as string) as Promise<CaseRecord>));
}

export async function registerVolunteer(client: SlackAPIClient, volunteer: VolunteerRecord) {
  const response = await client.apps.datastore.put({
    datastore: "volunteers",
    item: {
      user_id: volunteer.userId,
      display_name: volunteer.displayName,
      languages_json: JSON.stringify(volunteer.languages),
      skills_json: JSON.stringify(volunteer.skills),
      zones_json: JSON.stringify(volunteer.zones),
      active_case_count: volunteer.activeCaseCount,
      max_capacity: volunteer.maxCapacity,
      total_resolved: volunteer.totalResolved,
      availability: volunteer.availability,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to register volunteer: ${response.error}`);
  }
  return response;
}

export async function getAvailableVolunteers(client: SlackAPIClient): Promise<VolunteerRecord[]> {
  const response = await client.apps.datastore.query({
    datastore: "volunteers",
    expression: "#avail <> :offline",
    expression_attributes: { "#avail": "availability" },
    expression_values: { ":offline": "offline" },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to query volunteers: ${response.error}`);
  }
  
  return response.items.map(item => ({
    userId: item.user_id as string,
    displayName: item.display_name as string,
    languages: JSON.parse(item.languages_json as string),
    skills: JSON.parse(item.skills_json as string),
    zones: JSON.parse(item.zones_json as string),
    activeCaseCount: item.active_case_count as number,
    maxCapacity: item.max_capacity as number,
    totalResolved: item.total_resolved as number,
    availability: item.availability as "available" | "busy" | "offline",
  }));
}

export async function updateVolunteerCaseCount(client: SlackAPIClient, userId: string, increment: number) {
  const response = await client.apps.datastore.get({
    datastore: "volunteers",
    id: userId,
  });
  
  if (!response.ok || !response.item) {
    throw new Error("Volunteer not found");
  }
  
  const currentCount = response.item.active_case_count as number;
  
  const updateRes = await client.apps.datastore.update({
    datastore: "volunteers",
    item: {
      user_id: userId,
      active_case_count: currentCount + increment,
    },
  });
  
  if (!updateRes.ok) {
    throw new Error(`Failed to update volunteer count: ${updateRes.error}`);
  }
}

export async function getConfig(client: SlackAPIClient, key: string): Promise<any> {
  const response = await client.apps.datastore.get({
    datastore: "org_config",
    id: key,
  });
  
  if (!response.ok || !response.item) {
    return null;
  }
  return JSON.parse(response.item.value as string);
}

export async function setConfig(client: SlackAPIClient, key: string, value: any) {
  const response = await client.apps.datastore.put({
    datastore: "org_config",
    item: {
      key: key,
      value: JSON.stringify(value),
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to set config: ${response.error}`);
  }
}
