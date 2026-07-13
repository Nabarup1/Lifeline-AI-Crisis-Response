import { handleCaseAssignment } from "../lib/volunteer_matcher.ts";
import { CaseRecord } from "../lib/types.ts";

// 1. Assign Volunteer
export async function assignVolunteerHandler({ action, body, client }: any) {
  console.log("Assign Volunteer Interaction:", action.action_id);
  const actionId = action.action_id; 
  // Pattern: lifeline_assign_{caseId}_{volunteerId} OR lifeline_assign_{caseId} if fallback
  const parts = actionId.split('_');
  const caseId = parts[2];
  const volunteerId = parts[3] || body.user.id; // fallback to the user clicking if not specified

  await handleCaseAssignment(client, caseId, volunteerId, body.message?.ts, body.channel?.id);
  return {};
}

// 2. Claim Case (Self Assign)
export async function claimCaseHandler({ action, body, client }: any) {
  console.log("Claim Case Interaction:", action.action_id);
  const caseId = action.action_id.split('_')[2];
  const userId = body.user.id;
  
  await handleCaseAssignment(client, caseId, userId, body.message?.ts, body.channel?.id);
  return {};
}

// 3. Escalate Case
export async function escalateCaseHandler({ action, body, client }: any) {
  const caseId = action.action_id.split('_')[2];
  
  await client.apps.datastore.update({
    datastore: "cases",
    item: {
      id: caseId,
      urgency: "critical",
      updated_at: Date.now()
    }
  });

  if (body.channel?.id) {
    await client.chat.postMessage({
      channel: body.channel.id,
      thread_ts: body.message?.ts,
      text: `🚨 *CRITICAL UPDATE*: Case *${caseId}* has been escalated by <@${body.user.id}>. Immediate attention is required.`
    });
  }
  return {};
}

// 4. Resolve Case Modal Open
export async function resolveCaseModalHandler({ action, body, client, interactivity }: any) {
  const caseId = action.action_id.split('_')[2];
  
  console.log("Resolve Case Body Interactivity:", JSON.stringify({
    interactivity_pointer: interactivity?.interactivity_pointer || arguments[0].interactivity?.interactivity_pointer || body.interactivity_pointer || body.interactivity?.interactivity_pointer,
    trigger_id: body.trigger_id,
  }));

  const viewMethod = body.view ? client.views.push : client.views.open;
  const res = await viewMethod.bind(client.views)({
    interactivity_pointer: arguments[0].interactivity?.interactivity_pointer || body.interactivity_pointer || body.interactivity?.interactivity_pointer,
    trigger_id: body.trigger_id,
    view: {
      type: "modal",
      callback_id: `resolve_case_submit_${caseId}`,
      title: { type: "plain_text", text: "Resolve Case" },
      submit: { type: "plain_text", text: "Resolve" },
      close: { type: "plain_text", text: "Cancel" },
      blocks: [
        {
          type: "input",
          block_id: "resolution_block",
          element: {
            type: "plain_text_input",
            action_id: "resolution_notes",
            multiline: true
          },
          label: { type: "plain_text", text: "Resolution Notes" }
        }
      ]
    }
  });
  console.log("Slack API Response:", JSON.stringify(res, null, 2));
  if (!res.ok) {
    console.error("Failed to open resolve case modal:", JSON.stringify(res, null, 2));
  }
  return {};
}

// 5. Acknowledge Alert
export async function acknowledgeAlertHandler({ action, body, client }: any) {
  const alertId = action.action_id.split('ack_alert_')[1];
  
  await client.apps.datastore.update({
    datastore: "alerts",
    item: {
      id: alertId,
      acknowledgedBy: body.user.id
    }
  });
  return {};
}

// 6. Register Volunteer Modal Open
export async function registerVolunteerModalHandler({ body, client }: any) {
  const viewMethod = body.view ? client.views.push : client.views.open;
  await viewMethod.bind(client.views)({
    interactivity_pointer: arguments[0].interactivity?.interactivity_pointer || body.interactivity_pointer || body.interactivity?.interactivity_pointer,
    view: {
      type: "modal",
      callback_id: `register_volunteer_submit`,
      title: { type: "plain_text", text: "Register as Volunteer" },
      submit: { type: "plain_text", text: "Register" },
      close: { type: "plain_text", text: "Cancel" },
      blocks: [
        {
          type: "input",
          block_id: "skills_block",
          element: {
            type: "plain_text_input",
            action_id: "skills",
            placeholder: { type: "plain_text", text: "e.g. Medical, Housing, Translation" }
          },
          label: { type: "plain_text", text: "Skills" }
        },
        {
          type: "input",
          block_id: "zones_block",
          element: {
            type: "plain_text_input",
            action_id: "zones",
            placeholder: { type: "plain_text", text: "e.g. Zone A, Zone B" }
          },
          label: { type: "plain_text", text: "Preferred Zones" }
        },
        {
          type: "input",
          block_id: "langs_block",
          element: {
            type: "plain_text_input",
            action_id: "langs",
            placeholder: { type: "plain_text", text: "e.g. English, Spanish" }
          },
          label: { type: "plain_text", text: "Languages" }
        }
      ]
    }
  });
}

// 7. View Case Details
export async function viewCaseDetailsHandler({ action, body, client }: any) {
  const caseId = action.action_id.split('view_case_')[1];
  
  const res = await client.apps.datastore.get({
    datastore: "cases",
    id: caseId
  });

  const caseData = res.item || { summary: "Not found", status: "Unknown" };

  const viewMethod = body.view ? client.views.push : client.views.open;
  await viewMethod.bind(client.views)({
    interactivity_pointer: arguments[0].interactivity?.interactivity_pointer || body.interactivity_pointer || body.interactivity?.interactivity_pointer,
    view: {
      type: "modal",
      title: { type: "plain_text", text: `Case ${caseId}` },
      close: { type: "plain_text", text: "Close" },
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Status:* ${caseData.status}\n*Urgency:* ${caseData.urgency}\n*Category:* ${caseData.category}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Summary:*\n${caseData.summary}`
          }
        }
      ]
    }
  });
}

// 8. Search History Modal
export async function searchHistoryModalHandler({ body, client }: any) {
  const viewMethod = body.view ? client.views.push : client.views.open;
  await viewMethod.bind(client.views)({
    interactivity_pointer: arguments[0].interactivity?.interactivity_pointer || body.interactivity_pointer || body.interactivity?.interactivity_pointer,
    view: {
      type: "modal",
      callback_id: "search_history_submit",
      title: { type: "plain_text", text: "Search History" },
      submit: { type: "plain_text", text: "Search" },
      blocks: [
        {
          type: "input",
          block_id: "query_block",
          element: {
            type: "plain_text_input",
            action_id: "query"
          },
          label: { type: "plain_text", text: "Search Query" }
        }
      ]
    }
  });
}

// 9. Override Triage
export async function overrideTriageModalHandler({ action, body, client, interactivity }: any) {
  const caseId = action.action_id.split('_')[2];
  console.log("Override Triage Body Interactivity:", JSON.stringify({
    interactivity_pointer: interactivity?.interactivity_pointer || arguments[0].interactivity?.interactivity_pointer || body.interactivity_pointer || body.interactivity?.interactivity_pointer,
    trigger_id: body.trigger_id,
  }));
  const viewMethod = body.view ? client.views.push : client.views.open;
  const res = await viewMethod.bind(client.views)({
    interactivity_pointer: arguments[0].interactivity?.interactivity_pointer || body.interactivity_pointer || body.interactivity?.interactivity_pointer,
    trigger_id: body.trigger_id,
    view: {
      type: "modal",
      callback_id: `override_triage_submit_${caseId}`,
      title: { type: "plain_text", text: "Override Triage" },
      submit: { type: "plain_text", text: "Save" },
      blocks: [
        {
          type: "input",
          block_id: "urgency_block",
          element: {
            type: "plain_text_input",
            action_id: "urgency",
            placeholder: { type: "plain_text", text: "critical, high, medium, low" }
          },
          label: { type: "plain_text", text: "New Urgency" }
        }
      ]
    }
  });
  console.log("Slack API Response:", JSON.stringify(res, null, 2));
  if (!res.ok) {
    console.error("Failed to open override triage modal:", JSON.stringify(res, null, 2));
  }
  return {};
}

// 10. Settings Modal
export async function settingsModalHandler({ body, client }: any) {
  const viewMethod = body.view ? client.views.push : client.views.open;
  await viewMethod.bind(client.views)({
    interactivity_pointer: arguments[0].interactivity?.interactivity_pointer || body.interactivity_pointer || body.interactivity?.interactivity_pointer,
    view: {
      type: "modal",
      callback_id: "settings_submit",
      title: { type: "plain_text", text: "Settings" },
      submit: { type: "plain_text", text: "Save" },
      blocks: [
        {
          type: "input",
          block_id: "alert_channel_block",
          optional: true,
          element: {
            type: "plain_text_input",
            action_id: "channel"
          },
          label: { type: "plain_text", text: "Critical Alert Channel ID" }
        },
        {
          type: "input",
          block_id: "operating_location_block",
          optional: true,
          element: {
            type: "plain_text_input",
            action_id: "location",
            placeholder: { type: "plain_text", text: "e.g. Houston, TX" }
          },
          label: { type: "plain_text", text: "Primary Operating Location" }
        }
      ]
    }
  });
}

// 11. View All Cases
export async function viewAllCasesHandler({ body, client }: any) {
  const casesRes = await client.apps.datastore.query({ datastore: "cases" });
  const cases = casesRes.ok ? casesRes.items : [];
  
  const blocks: any[] = [
    { type: "header", text: { type: "plain_text", text: "Active Cases" } }
  ];

  cases.filter((c: any) => c.status !== "Resolved").forEach((c: any) => {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*${c.id}* - ${c.category}\nStatus: ${c.status}\n${c.summary}` }
    });
    blocks.push({ type: "divider" });
  });

  if (blocks.length === 1) blocks.push({ type: "section", text: { type: "mrkdwn", text: "No active cases found." } });

  const viewMethod = body.view ? client.views.push : client.views.open;
  await viewMethod.bind(client.views)({
    interactivity_pointer: arguments[0].interactivity?.interactivity_pointer || body.interactivity_pointer || body.interactivity?.interactivity_pointer,
    view: {
      type: "modal",
      title: { type: "plain_text", text: "All Cases" },
      close: { type: "plain_text", text: "Close" },
      blocks
    }
  });
}

// 12. Run Pattern Check
export async function runPatternCheckHandler({ body, client }: any) {
  const { DetectPatternsDefinition } = await import("./detect_patterns.ts");
  await client.functions.invoke({
    function: DetectPatternsDefinition.id,
    inputs: {}
  });

  const viewMethod = body.view ? client.views.push : client.views.open;
  await viewMethod.bind(client.views)({
    interactivity_pointer: arguments[0].interactivity?.interactivity_pointer || body.interactivity_pointer || body.interactivity?.interactivity_pointer,
    view: {
      type: "modal",
      title: { type: "plain_text", text: "Pattern Check" },
      close: { type: "plain_text", text: "Close" },
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: "✅ Pattern check initiated! If any anomalies are detected, they will be reported to the alert channel." }
        }
      ]
    }
  });
}

// 13. Open Help
export async function openHelpHandler({ body, client }: any) {
  const viewMethod = body.view ? client.views.push : client.views.open;
  await viewMethod.bind(client.views)({
    interactivity_pointer: arguments[0].interactivity?.interactivity_pointer || body.interactivity_pointer || body.interactivity?.interactivity_pointer,
    view: {
      type: "modal",
      title: { type: "plain_text", text: "Lifeline Help" },
      close: { type: "plain_text", text: "Close" },
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: "*Available Dashboard Features:*\n• *Settings:* Configure the primary alert channel.\n• *Search History:* Query resolved cases based on similarities.\n• *View All Cases:* See a list of active cases.\n• *Register Volunteer:* Onboard yourself as a responder." }
        }
      ]
    }
  });
}

// VIEW SUBMISSIONS
export async function handleViewSubmission({ view, body, client }: any) {
  const cbId = view.callback_id;

  if (cbId.startsWith("resolve_case_submit_")) {
    const caseId = cbId.replace("resolve_case_submit_", "");
    const notes = view.state.values.resolution_block.resolution_notes.value;
    
    // Fetch the case first to know who it was assigned to
    const caseRes = await client.apps.datastore.get({
      datastore: "cases",
      id: caseId
    });

    if (caseRes.ok && caseRes.item) {
      const assignedTo = caseRes.item.assigned_to;
      
      // Update case status
      await client.apps.datastore.update({
        datastore: "cases",
        item: {
          id: caseId,
          status: "Resolved",
          resolution_notes: notes,
          resolved_at: Date.now()
        }
      });

      // Update volunteer stats if it was assigned to someone
      if (assignedTo && assignedTo.startsWith("U")) {
        const volRes = await client.apps.datastore.get({
          datastore: "volunteers",
          id: assignedTo
        });
        
        if (volRes.ok && volRes.item) {
          const v = volRes.item;
          await client.apps.datastore.update({
            datastore: "volunteers",
            item: {
              user_id: assignedTo,
              active_case_count: Math.max(0, (v.active_case_count || 1) - 1),
              total_resolved: (v.total_resolved || 0) + 1
            }
          });
        }
      }
    }

  } else if (cbId === "register_volunteer_submit") {
    const skills = view.state.values.skills_block.skills.value.split(',').map((s: string) => s.trim());
    const zones = view.state.values.zones_block.zones.value.split(',').map((s: string) => s.trim());
    const langs = view.state.values.langs_block.langs.value.split(',').map((s: string) => s.trim());
    
    await client.apps.datastore.put({
      datastore: "volunteers",
      item: {
        user_id: body.user.id,
        display_name: body.user.name || body.user.username,
        skills_json: JSON.stringify(skills),
        zones_json: JSON.stringify(zones),
        languages_json: JSON.stringify(langs),
        availability: "available",
        active_case_count: 0,
        max_capacity: 3,
        total_resolved: 0
      }
    });
    const dm = await client.conversations.open({ users: body.user.id });
    if (dm.ok) {
      await client.chat.postMessage({
        channel: dm.channel.id,
        text: `🎉 *Welcome to the Lifeline Responder Team!*\n\nYou have been successfully registered with the following skills: *${skills.join(', ')}*.\nYou will now receive assignments based on your availability and expertise.`
      });
    }

    return {
      response_action: "update",
      view: {
        type: "modal",
        title: { type: "plain_text", text: "Success" },
        close: { type: "plain_text", text: "Close" },
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: `🎉 *Welcome to the Lifeline Responder Team!*\n\nYou have been successfully registered with the following skills: *${skills.join(', ')}*.\nYou will now receive assignments based on your availability and expertise.\n\n_We have also sent you a direct message confirming this._` }
          }
        ]
      }
    };

  } else if (cbId.startsWith("override_triage_submit_")) {
    const caseId = cbId.replace("override_triage_submit_", "");
    const urgency = view.state.values.urgency_block.urgency.value.toLowerCase();
    
    await client.apps.datastore.update({
      datastore: "cases",
      item: {
        id: caseId,
        urgency: urgency
      }
    });
  } else if (cbId === "settings_submit") {
    const channel = view.state.values.alert_channel_block?.channel?.value;
    const location = view.state.values.operating_location_block?.location?.value;
    
    if (channel) {
      await client.apps.datastore.put({
        datastore: "config",
        item: { key: "alert_channel", value: channel }
      });
    }
    
    if (location) {
      await client.apps.datastore.put({
        datastore: "config",
        item: { key: "operating_location", value: location }
      });
    }
  } else if (cbId === "search_history_submit") {
    const query = view.state.values.query_block.query.value;
    const { searchSimilarCases } = await import("../lib/memory_engine.ts");
    const results = await searchSimilarCases(client, { summary: query, category: "Search" } as any);
    
    const blocks: any[] = [{ type: "header", text: { type: "plain_text", text: `Results for "${query}"` } }];
    if (!results || results.length === 0) {
      blocks.push({ type: "section", text: { type: "mrkdwn", text: "No cases found." } });
    } else {
      results.forEach((r: any) => {
        blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: `*${r.caseId}*\nOutcome: ${r.outcome}\n${r.summary}` }
        });
      });
    }
    
    return {
      response_action: "update",
      view: {
        type: "modal",
        title: { type: "plain_text", text: "Search Results" },
        close: { type: "plain_text", text: "Close" },
        blocks
      }
    };
  }

  return { response_action: "clear" };
}
