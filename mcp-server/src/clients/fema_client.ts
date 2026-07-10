import { DisasterDeclaration } from "../types/disaster.ts";

const FEMA_API_BASE = "https://www.fema.gov/api/open/v2";

export class FemaApiClient {
  private async fetchWithRetry(url: string, retries: number = 1): Promise<any> {
    while (retries >= 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`FEMA API error: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        if (retries > 0) {
          retries--;
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        console.error(`Error fetching FEMA data from ${url}:`, error);
        throw error;
      }
    }
  }

  public async getActiveDisasters(state?: string): Promise<DisasterDeclaration[]> {
    // Look back ~1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const dateStr = oneYearAgo.toISOString();

    let filter = `declarationDate ge '${dateStr}'`;
    if (state) {
      filter += ` and state eq '${state.toUpperCase()}'`;
    }

    const url = `${FEMA_API_BASE}/DisasterDeclarationsSummaries?$filter=${encodeURIComponent(filter)}&$orderby=declarationDate desc`;
    
    const data = await this.fetchWithRetry(url);
    
    if (!data || !data.DisasterDeclarationsSummaries) {
      return [];
    }

    // Group designated areas by disaster number since the API returns a row per county
    const disasterMap = new Map<string, DisasterDeclaration>();

    for (const raw of data.DisasterDeclarationsSummaries) {
      if (!disasterMap.has(raw.femaDeclarationString)) {
        disasterMap.set(raw.femaDeclarationString, {
          id: raw.id,
          declarationDate: raw.declarationDate,
          title: raw.declarationTitle,
          incidentType: raw.incidentType,
          state: raw.state,
          designatedAreas: [],
          femaDeclarationString: raw.femaDeclarationString,
          url: `https://www.fema.gov/disaster/${raw.disasterNumber}`
        });
      }
      
      if (raw.designatedArea) {
        const entry = disasterMap.get(raw.femaDeclarationString)!;
        if (!entry.designatedAreas.includes(raw.designatedArea)) {
          entry.designatedAreas.push(raw.designatedArea);
        }
      }
    }

    return Array.from(disasterMap.values());
  }

  public async getDisasterDetails(disasterNumber: number): Promise<DisasterDeclaration | null> {
    const filter = `disasterNumber eq ${disasterNumber}`;
    const url = `${FEMA_API_BASE}/DisasterDeclarationsSummaries?$filter=${encodeURIComponent(filter)}`;
    
    const data = await this.fetchWithRetry(url);
    
    if (!data || !data.DisasterDeclarationsSummaries || data.DisasterDeclarationsSummaries.length === 0) {
      return null;
    }

    // Group areas
    const areas: string[] = [];
    for (const raw of data.DisasterDeclarationsSummaries) {
      if (raw.designatedArea && !areas.includes(raw.designatedArea)) {
        areas.push(raw.designatedArea);
      }
    }

    const first = data.DisasterDeclarationsSummaries[0];
    return {
      id: first.id,
      declarationDate: first.declarationDate,
      title: first.declarationTitle,
      incidentType: first.incidentType,
      state: first.state,
      designatedAreas: areas,
      femaDeclarationString: first.femaDeclarationString,
      url: `https://www.fema.gov/disaster/${first.disasterNumber}`
    };
  }
}
