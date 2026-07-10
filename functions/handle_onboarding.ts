export const startOnboardingHandler = async (ctx: any) => {
  const { client, body } = ctx;
  const interactivity_pointer = body.interactivity_pointer || body.interactivity?.interactivity_pointer;

  try {
    await client.views.push({
      interactivity_pointer,
      view: {
        type: "modal",
        callback_id: "onboarding_submit",
        title: {
          type: "plain_text",
          text: "Organization Setup"
        },
        submit: {
          type: "plain_text",
          text: "Complete Setup"
        },
        close: {
          type: "plain_text",
          text: "Cancel"
        },
        blocks: [
          {
            type: "input",
            block_id: "region_block",
            label: {
              type: "plain_text",
              text: "Primary Operating Region"
            },
            element: {
              type: "plain_text_input",
              action_id: "region_input",
              placeholder: {
                type: "plain_text",
                text: "e.g., Miami-Dade County"
              }
            }
          },
          {
            type: "input",
            block_id: "intake_channel_block",
            label: {
              type: "plain_text",
              text: "Designated Intake Channel"
            },
            element: {
              type: "channels_select",
              action_id: "channel_select",
              placeholder: {
                type: "plain_text",
                text: "Select a channel for alerts"
              }
            }
          },
          {
            type: "input",
            block_id: "languages_block",
            label: {
              type: "plain_text",
              text: "Supported Languages"
            },
            element: {
              type: "plain_text_input",
              action_id: "languages_input",
              initial_value: "English, Spanish",
              placeholder: {
                type: "plain_text",
                text: "e.g., English, Spanish, Creole"
              }
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error("Error opening onboarding modal", error);
  }
};

export const handleOnboardingSubmission = async (ctx: any) => {
  const { client, body } = ctx;
  const values = body.view.state.values;

  const region = values.region_block.region_input.value;
  const channel = values.intake_channel_block.channel_select.selected_channel;
  const languages = values.languages_block.languages_input.value;

  try {
    // Save to Config Datastore
    await client.apps.datastore.put({
      datastore: "org_config",
      item: { key: "setup_complete", value: "true" }
    });
    await client.apps.datastore.put({
      datastore: "org_config",
      item: { key: "region", value: region }
    });
    await client.apps.datastore.put({
      datastore: "org_config",
      item: { key: "intake_channel", value: channel }
    });
    await client.apps.datastore.put({
      datastore: "org_config",
      item: { key: "languages", value: languages }
    });

    // Broadcast initialization message
    await client.chat.postMessage({
      channel: channel,
      text: `🎉 *Lifeline Initialized!* 🎉\nRegion: ${region}\nSupported Languages: ${languages}\nI am now monitoring this channel for crisis reports. Mention @Lifeline for assistance.`
    });

  } catch (error) {
    console.error("Error saving config", error);
  }
};
