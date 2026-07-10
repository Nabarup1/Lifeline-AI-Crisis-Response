import { SlackAPIClient } from "deno-slack-sdk/types.ts";
import { CaseCategory, ExtractedEntities, HistoricalCaseContext, TriageResult } from "./types.ts";
import { summarizeThread } from "./signal_engine.ts";

export function buildSearchQuery(category: CaseCategory, entities: ExtractedEntities): string {
  const keywords = [category];
  
  if (entities?.location) keywords.push(entities.location);
  if (entities?.specialNeeds && entities.specialNeeds.length > 0) {
    keywords.push(...entities.specialNeeds);
  }
  
  // Basic query joining keywords
  return keywords.filter(Boolean).join(" ");
}

export async function searchByKeyword(
  client: SlackAPIClient, 
  query: string, 
  channelId?: string,
  oldest?: string
): Promise<any[]> {
  let searchQuery = query;
  if (channelId) {
    searchQuery += ` in:${channelId}`;
  }
  
  // Try RTS API via search.messages (requires search scopes)
  const searchResult = await client.search.messages({
    query: searchQuery,
    sort: "timestamp",
    sort_dir: "desc",
    count: 10,
  });

  if (!searchResult.ok) {
    console.warn(`Search API error (fallback required in production): ${searchResult.error}. Using datastore fallback.`);
    // Fallback: Query the cases datastore and filter manually
    const casesRes = await client.apps.datastore.query({ datastore: "cases" });
    if (!casesRes.ok) return [];
    
    const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = casesRes.items.filter((c: any) => {
      const text = `${c.category} ${c.summary} ${c.resolution_notes || ""}`.toLowerCase();
      // Match if ANY keyword is found in the text
      return queryWords.some(w => text.includes(w));
    });
    
    // Sort by most recent
    matches.sort((a: any, b: any) => (b.created_at || 0) - (a.created_at || 0));
    
    // Format them to look like search.messages results for searchSimilarCases
    return matches.map((c: any) => ({
      ts: (c.created_at || 0).toString(),
      text: c.summary,
      permalink: `Case ${c.id}`, // Mock permalink
      isDatastoreFallback: true,
      caseObj: c
    }));
  }

  return searchResult.messages?.matches || [];
}

export async function searchSimilarCases(
  client: SlackAPIClient, 
  triage: TriageResult
): Promise<HistoricalCaseContext[]> {
  const query = buildSearchQuery(triage.category, triage.entities);
  
  try {
    const matches = await searchByKeyword(client, query);
    
    const historicalContexts: HistoricalCaseContext[] = [];
    
    // Process top 3 matches to extract thread summary
    for (const match of matches.slice(0, 3)) {
      if (match.isDatastoreFallback) {
         historicalContexts.push({
            caseId: match.caseObj.id,
            summary: match.caseObj.summary,
            outcome: match.caseObj.resolution_notes || "Resolved",
            resourcesUsed: [],
            threadLink: match.permalink,
            resolvedAt: match.caseObj.resolved_at || match.caseObj.created_at || 0
         });
         continue;
      }

      const channelId = match.channel?.id;
      const ts = match.ts;
      
      if (!channelId || !ts) continue;
      
      // Fetch thread to summarize it
      const threadResult = await client.conversations.replies({
        channel: channelId,
        ts: ts,
        limit: 20
      });
      
      if (threadResult.ok && threadResult.messages) {
        // We only want text and user ID for summarization
        const threadMessages = threadResult.messages.map((m: any) => ({
          text: m.text || "",
          user: m.user || "unknown",
          ts: m.ts || ""
        }));
        
        try {
          const summaryObj = await summarizeThread(threadMessages);
          historicalContexts.push({
            caseId: ts,
            summary: summaryObj.summary || match.text,
            outcome: summaryObj.outcome || "Unknown",
            resourcesUsed: summaryObj.resources_used || [],
            threadLink: match.permalink || "",
            resolvedAt: parseInt(ts.split('.')[0]),
            relevanceScore: 0.8 // Default relevance score for RTS fallback
          });
        } catch (e) {
          console.error("Failed to summarize thread:", e);
        }
      }
    }
    
    return historicalContexts;
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
}
