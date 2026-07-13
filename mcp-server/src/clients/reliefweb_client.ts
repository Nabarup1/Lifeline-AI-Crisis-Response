import { ReliefWebReport, ReliefWebDisaster, ReliefWebCountry } from "../types/reliefweb.ts";

const RELIEFWEB_API_BASE = "https://api.reliefweb.int/v2";

// ReliefWeb now requires a pre-approved appname (since Nov 2025).
// Set your approved appname in the RELIEFWEB_APPNAME env var.
// If unavailable, the client returns curated fallback data so the rest of the system keeps working.
let APP_NAME = "";
try {
  // @ts-ignore
  APP_NAME = process?.env?.RELIEFWEB_APPNAME || "";
} catch (e) {
  // Safely fallback to empty in strictly sandboxed environments like Deno Slack SDK
}

export class ReliefWebClient {
  private async tryFetch(url: string, options?: RequestInit): Promise<Response | null> {
    if (!APP_NAME) return null;
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      console.warn(`ReliefWeb API returned ${response.status} for ${url}`);
      return null;
    } catch (error) {
      console.warn("ReliefWeb API unreachable:", error);
      return null;
    }
  }

  public async searchReports(query: string, limit: number = 5): Promise<ReliefWebReport[]> {
    const url = `${RELIEFWEB_API_BASE}/reports?appname=${APP_NAME}`;
    
    const body = {
      query: { value: query },
      limit: limit,
      fields: {
        include: ["id", "title", "date.created", "url", "body", "source.name"]
      },
      sort: ["date:desc"]
    };

    const response = await this.tryFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response) return this.getFallbackReports(query);

    const data: any = await response.json();
    if (!data.data) return [];

    return data.data.map((item: any) => {
      const fields = item.fields || {};
      const fullBody = fields.body || "";
      // Truncate body to 200 chars for the summary so we don't blow up the LLM context window
      const summary = fullBody.length > 200 ? fullBody.substring(0, 200) + "..." : fullBody;
      const sources = fields.source ? fields.source.map((s: any) => s.name) : [];
      
      return {
        id: item.id,
        title: fields.title,
        date: fields.date?.created || "",
        url: fields.url,
        summary: summary,
        source: sources
      };
    });
  }

  public async getActiveDisasters(country?: string): Promise<ReliefWebDisaster[]> {
    const url = `${RELIEFWEB_API_BASE}/disasters?appname=${APP_NAME}&limit=100`;
    
    // ReliefWeb Advanced search syntax using POST
    const body: any = {
      filter: {
        conditions: [
          { field: "status", value: "ongoing" }
        ]
      },
      fields: {
        include: ["id", "name", "status", "type.name", "url"]
      },
      sort: ["date:desc"]
    };

    if (country) {
      body.filter.operator = "AND";
      body.filter.conditions.push({ field: "country", value: country });
    }

    const response = await this.tryFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response) return this.getFallbackDisasters();

    const data: any = await response.json();
    if (!data.data) return [];

    return data.data.map((item: any) => {
      const fields = item.fields || {};
      return {
        id: item.id,
        name: fields.name,
        status: fields.status,
        type: fields.type?.[0]?.name || "Unknown",
        url: fields.url
      };
    });
  }

  public async getCountryProfile(countryName: string): Promise<ReliefWebCountry | null> {
    const url = `${RELIEFWEB_API_BASE}/countries?appname=${APP_NAME}`;
    
    const body = {
      query: { value: countryName },
      limit: 1,
      fields: {
        include: ["id", "name", "shortname", "url"]
      }
    };

    const response = await this.tryFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response) return null;

    const data: any = await response.json();
    if (!data.data || data.data.length === 0) return null;

    const fields = data.data[0].fields || {};
    return {
      id: data.data[0].id,
      name: fields.name,
      shortname: fields.shortname || "",
      url: fields.url
    };
  }

  // Curated fallback data so the agent still has useful context even without API access
  private getFallbackReports(query: string): ReliefWebReport[] {
    return [
      {
        id: "fallback-1",
        title: `Humanitarian situation report related to: ${query}`,
        date: new Date().toISOString(),
        url: "https://reliefweb.int",
        summary: "ReliefWeb API requires an approved appname. Visit https://apidoc.reliefweb.int to register. Fallback data is being used.",
        source: ["ReliefWeb (fallback)"]
      }
    ];
  }

  private getFallbackDisasters(): ReliefWebDisaster[] {
    return [
      {
        id: "fallback-disaster-1",
        name: "Ongoing global humanitarian crises (fallback data)",
        status: "ongoing",
        type: "Complex Emergency",
        url: "https://reliefweb.int/disasters"
      }
    ];
  }
}
