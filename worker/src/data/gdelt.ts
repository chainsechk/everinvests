/**
 * GDELT (Global Database of Events, Language, and Tone) Integration
 *
 * Fetches geopolitical tension metrics for regime detection.
 * Free API, no auth required. Rate limit: ~1 req/sec.
 *
 * Runs daily at 01:00 UTC, cached for 24 hours.
 */

// Keywords that indicate geopolitical risk
const GDELT_KEYWORDS = [
  "war",
  "military conflict",
  "sanctions",
  "tariffs",
  "trade war",
  "crisis",
  "invasion",
  "nuclear",
  "terrorism",
  "coup",
];

// GDELT DOC 2.0 API
const GDELT_API = "https://api.gdeltproject.org/api/v2/doc/doc";

export interface GdeltArticle {
  title: string;
  url: string;
  domain: string;
  seendate: string;
  tone: number; // -100 to +100, negative = negative tone
}

export interface GdeltHeadline {
  title: string;
  url: string;
}

export interface GdeltResult {
  score: number; // 0-100 aggregated tension score
  trend: "rising" | "stable" | "falling";
  topThreats: string[]; // Top 3 threat categories
  articles: number; // Number of matching articles
  avgTone: number; // Average article tone
  lastUpdated: string;
  // G5 Enhancement fields
  topHeadlines: GdeltHeadline[]; // Top 3 most relevant headlines
  spikeRatio: number; // Current articles vs 7-day avg (1.0 = normal, 2.0 = 2x spike)
}

interface GdeltApiResponse {
  articles?: Array<{
    title: string;
    url: string;
    domain: string;
    seendate: string;
    tone: string;
  }>;
}

/**
 * Fetch geopolitical tension score from GDELT
 *
 * Queries for high-impact geopolitical keywords in the last 24 hours,
 * aggregates article counts and sentiment into a 0-100 tension score.
 *
 * @param previousScore - Previous score for trend calculation
 * @param avg7dArticles - 7-day average article count for spike detection
 */
export async function fetchGdeltScore(
  previousScore?: number,
  avg7dArticles?: number
): Promise<GdeltResult> {
  const now = new Date();
  const lastUpdated = now.toISOString();

  // Default fallback if API fails
  const fallback: GdeltResult = {
    score: previousScore ?? 30, // Use previous or neutral
    trend: "stable",
    topThreats: [],
    articles: 0,
    avgTone: 0,
    lastUpdated,
    topHeadlines: [],
    spikeRatio: 1.0,
  };

  try {
    // Query GDELT for geopolitical keywords in last 24h
    // Format: keyword OR keyword OR ...
    const query = GDELT_KEYWORDS.join(" OR ");
    const params = new URLSearchParams({
      query,
      mode: "artlist",
      maxrecords: "250",
      format: "json",
      timespan: "24h",
      sort: "hybridrel", // Relevance + recency
    });

    const response = await fetch(`${GDELT_API}?${params}`, {
      headers: {
        "User-Agent": "EverInvests/1.0 (geopolitical-monitor)",
      },
    });

    if (!response.ok) {
      console.error(`[GDELT] API error: ${response.status}`);
      return fallback;
    }

    const data = (await response.json()) as GdeltApiResponse;
    const articles = data.articles || [];

    if (articles.length === 0) {
      return {
        score: 20, // Low tension if no articles
        trend: previousScore ? (previousScore > 25 ? "falling" : "stable") : "stable",
        topThreats: [],
        articles: 0,
        avgTone: 0,
        lastUpdated,
        topHeadlines: [],
        spikeRatio: avg7dArticles ? 0 : 1.0,
      };
    }

    // Calculate metrics
    const articleCount = articles.length;
    const tones = articles.map((a) => parseFloat(a.tone) || 0);
    const avgTone = tones.reduce((sum, t) => sum + t, 0) / tones.length;

    // Count keyword occurrences to find top threats
    const keywordCounts: Record<string, number> = {};
    for (const keyword of GDELT_KEYWORDS) {
      const count = articles.filter((a) =>
        a.title.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      if (count > 0) {
        keywordCounts[keyword] = count;
      }
    }

    const topThreats = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([keyword]) => keyword);

    // Extract top 3 headlines (most relevant by hybridrel sort)
    const topHeadlines: GdeltHeadline[] = articles
      .slice(0, 3)
      .map((a) => ({ title: a.title, url: a.url }));

    // Calculate spike ratio vs 7-day baseline
    const spikeRatio = avg7dArticles && avg7dArticles > 0
      ? Math.round((articleCount / avg7dArticles) * 100) / 100
      : 1.0;

    // Calculate tension score (0-100)
    // Based on: article count (0-50 pts) + negative tone (0-30 pts) + threat diversity (0-20 pts)
    // G5: Add spike bonus (0-20 pts) for unusual activity
    const countScore = Math.min(50, (articleCount / 250) * 50);
    const toneScore = avgTone < 0 ? Math.min(30, Math.abs(avgTone) / 10 * 30) : 0;
    const diversityScore = Math.min(20, topThreats.length * 7);
    // Spike bonus: 2x = +10pts, 3x = +20pts
    const spikeBonus = spikeRatio >= 3 ? 20 : spikeRatio >= 2 ? 10 : spikeRatio >= 1.5 ? 5 : 0;

    const score = Math.round(countScore + toneScore + diversityScore + spikeBonus);

    // Determine trend
    let trend: "rising" | "stable" | "falling" = "stable";
    if (previousScore !== undefined) {
      const diff = score - previousScore;
      if (diff > 10) trend = "rising";
      else if (diff < -10) trend = "falling";
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      trend,
      topThreats,
      articles: articleCount,
      avgTone: Math.round(avgTone * 10) / 10,
      lastUpdated,
      topHeadlines,
      spikeRatio,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[GDELT] Fetch error: ${msg}`);
    return fallback;
  }
}

/**
 * Classify GDELT score into regime impact
 */
export function classifyGdeltRegime(result: GdeltResult): {
  regime: "calm" | "elevated" | "high" | "critical";
  signalDampening: number;
  action: "aggressive" | "normal" | "cautious" | "defensive";
} {
  if (result.score >= 70) {
    return {
      regime: "critical",
      signalDampening: 0.4,
      action: "defensive",
    };
  }
  if (result.score >= 50) {
    return {
      regime: "high",
      signalDampening: 0.7,
      action: "cautious",
    };
  }
  if (result.score >= 30) {
    return {
      regime: "elevated",
      signalDampening: 0.9,
      action: "normal",
    };
  }
  return {
    regime: "calm",
    signalDampening: 1.0,
    action: "normal",
  };
}
