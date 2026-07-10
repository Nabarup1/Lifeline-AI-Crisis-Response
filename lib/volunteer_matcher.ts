export interface TriageResult {
  urgency: string;
  category: string;
  confidence: number;
  summary: string;
  entities: string[];
  detectedLanguage?: string;
  zone?: string;
}

const VOLUNTEER_MAX_DEFAULT_CAPACITY = 3;

/**
 * Fetch available volunteers; score based on weighted criteria (Language 30%, Skills 25%, Zone 20%, Capacity 15%, Experience 10%); 
 * return highest-scoring volunteer and match justification.
 */
export async function findBestVolunteer(client: any, triage: TriageResult) {
  // 1. Fetch available volunteers from Datastore
  const response = await client.apps.datastore.query({
    datastore: "volunteers",
    expression: "#avail = :avail",
    expression_attributes: { "#avail": "availability" },
    expression_values: { ":avail": "available" }
  });

  if (!response.ok) {
    console.error("Failed to query volunteers:", response.error);
    return null;
  }

  const volunteers: any[] = response.items;
  if (volunteers.length === 0) return null;

  let bestMatch: any = null;
  let highestScore = -1;
  let matchJustification = "";

  const requiredLang = triage.detectedLanguage || "English";
  const requiredCategory = triage.category;

  volunteers.forEach(v => {
    let score = 0;
    const reasons: string[] = [];
    
    const languages = JSON.parse(v.languages_json || "[]");
    const skills = JSON.parse(v.skills_json || "[]");
    const zones = JSON.parse(v.zones_json || "[]");

    // Language (30%)
    if (languages.includes(requiredLang) || languages.includes("English")) {
      score += 30;
      reasons.push("Language match");
    }

    // Skills (25%)
    if (skills.includes(requiredCategory)) {
      score += 25;
      reasons.push("Skill match");
    }

    // Zone (20%)
    if (triage.zone && zones.includes(triage.zone)) {
      score += 20;
      reasons.push("Zone match");
    }

    // Capacity (15%) - closer to 0 active cases is better
    const activeCount = v.active_case_count || 0;
    const capacityScore = Math.max(0, 15 - (activeCount * 5));
    score += capacityScore;

    // Experience (10%)
    const resolved = v.total_resolved || 0;
    score += Math.min(10, resolved * 2);

    if (score > highestScore) {
      highestScore = score;
      bestMatch = { ...v, languages, skills, zones };
      matchJustification = reasons.join(", ") + ` (Score: ${score}/100)`;
    }
  });

  if (!bestMatch) return null;

  return {
    volunteer: bestMatch,
    score: highestScore,
    justification: matchJustification
  };
}

export async function registerVolunteer(
  client: any, 
  userId: string, 
  displayName: string, 
  languages: string[], 
  skills: string[], 
  zones: string[]
) {
  const item = {
    user_id: userId,
    display_name: displayName,
    languages_json: JSON.stringify(languages),
    skills_json: JSON.stringify(skills),
    zones_json: JSON.stringify(zones),
    availability: 'available',
    active_case_count: 0,
    max_capacity: VOLUNTEER_MAX_DEFAULT_CAPACITY,
    total_resolved: 0
  };

  const response = await client.apps.datastore.put({
    datastore: "volunteers",
    item
  });

  if (!response.ok) {
    throw new Error(`Failed to register volunteer: ${response.error}`);
  }
  return item;
}

export async function updateVolunteerAvailability(
  client: any, 
  userId: string, 
  availability: 'available' | 'busy' | 'offline'
) {
  const response = await client.apps.datastore.update({
    datastore: "volunteers",
    item: {
      user_id: userId,
      availability
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to update availability: ${response.error}`);
  }
  return response.item;
}

export async function handleCaseAssignment(
  client: any, 
  caseId: string, 
  volunteerId: string,
  threadTs?: string,
  channelId?: string
) {
  // 1. Fetch current volunteer
  const vRes = await client.apps.datastore.get({
    datastore: "volunteers",
    id: volunteerId
  });

  if (!vRes.ok) throw new Error("Volunteer not found");
  const volunteer = vRes.item;

  // 2. Increment active count and check capacity
  const newActiveCount = (volunteer.active_case_count || 0) + 1;
  const newAvailability = newActiveCount >= (volunteer.max_capacity || VOLUNTEER_MAX_DEFAULT_CAPACITY) ? 'busy' : volunteer.availability;

  // 3. Update volunteer datastore
  await client.apps.datastore.update({
    datastore: "volunteers",
    item: {
      user_id: volunteerId,
      active_case_count: newActiveCount,
      availability: newAvailability
    }
  });

  // 4. Update Case datastore
  await client.apps.datastore.update({
    datastore: "cases",
    item: {
      id: caseId,
      status: "Assigned",
      assigned_to: volunteerId,
      updated_at: Date.now()
    }
  });

  // 5. Notify volunteer via DM
  try {
    const dm = await client.conversations.open({ users: volunteerId });
    if (dm.ok && dm.channel?.id) {
      await client.chat.postMessage({
        channel: dm.channel.id,
        text: `You have been assigned to Case *${caseId}*. Please check the dispatch channel for details.`
      });
    }
  } catch(e) {
    console.warn("Could not DM volunteer", e);
  }

  // 6. Post thread confirmation if channel provided
  if (channelId && threadTs) {
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: `✅ Case *${caseId}* successfully assigned to <@${volunteerId}>.`
    });
  }

  return { success: true, volunteerId, caseId, status: "Assigned", newAvailability };
}
