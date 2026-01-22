# Financial News Aggregators & Regime Detection Research

> Research conducted 2026-01-22 for EverInvests Free tier enhancement

## Executive Summary

This research evaluates open-source tools for detecting market regime changes through news and event monitoring. The goal is to enhance EverInvests Free's current price-based indicators (Fear & Greed Index, VIX, yield curve) with news-driven signals that can detect regime transitions BEFORE they appear in price.

---

## 1. Situation Monitor Analysis

### Repository Details
| Attribute | Value |
|-----------|-------|
| GitHub | [hipcityreg/situation-monitor](https://github.com/hipcityreg/situation-monitor) |
| Stars | 915 |
| Stack | Svelte (35.6%), TypeScript (63%), Tailwind, Vite |
| Deployment | Vercel |
| Live Demo | situation-monitor-rose.vercel.app |

### What It Does
Real-time dashboard that aggregates:
- Global news feeds
- Market data streams
- Geopolitical event tracking

### Relevance for EverInvests
**Moderate fit.** Designed for human monitoring rather than automated signal generation. Would require significant adaptation to integrate with Cloudflare Worker cron system. Different stack (Svelte vs Astro).

---

## 2. Alternatives Comparison

| Tool | Purpose | Data Sources | Self-Host | API | Best For |
|------|---------|--------------|-----------|-----|----------|
| **[OpenBB](https://github.com/OpenBB-finance/OpenBB)** | Financial data platform | 100+ providers | Yes | REST/Python | Full data infrastructure |
| **[AINewsTracker](https://github.com/AlgoETS/AINewsTracker)** | News sentiment | 60+ sources | Docker | FastAPI | Backtesting news impact |
| **[Stocksight](https://github.com/shirosaidev/stocksight)** | Twitter + news | Twitter, RSS | Docker | Elasticsearch | Real-time sentiment |
| **[GDELT](https://gdelt.github.io/)** | Geopolitical events | Global news | Cloud API | REST | Geopolitical risk |
| **[FedTools](https://github.com/David-Woroniuk/FedTools)** | Fed data | Federal Reserve | Yes | Python | Central bank policy |
| **[wsbtickerbot](https://github.com/RyanElliott10/wsbtickerbot)** | Reddit sentiment | r/wallstreetbets | Yes | Python | Retail crowding |

### Key Insight
Most tools are either:
1. **Too heavy** (OpenBB - Python server, AGPLv3)
2. **Too dated** (Stocksight - Twitter API changes broke it)
3. **Not API-first** (Situation Monitor - dashboard only)

**GDELT** stands out for geopolitical detection - massive scale, free API, 15-minute updates.

---

## 3. First Principles: Regime Change Triggers

### What Actually Causes Regime Changes?

| Trigger Type | Examples | Detection Method | Lead Time |
|--------------|----------|------------------|-----------|
| **Liquidity Crisis** | Repo stress, credit freeze | SOFR-IORB spread, credit spreads | Hours-Days |
| **Shock Event** | War, natural disaster | GDELT alerts, news velocity | Minutes-Hours |
| **Sentiment Shift** | Fear/greed extremes | Social volume, F&G reversal | Days |
| **Macro Transition** | Inflation/growth regime | Fed minutes NLP, yield curve | Weeks |
| **Correlation Breakdown** | Assets move together | Cross-asset correlation | Real-time |

### What News Adds That Price Misses

1. **Lead time** - News breaks before price reacts
2. **Context** - Price shows "what" not "why"
3. **Narrative shifts** - Regime changes start with narrative changes
4. **Black swan detection** - Unprecedented events have no price history

### The Key Insight
> You don't need to predict the future; you need to recognize faster that the present has changed.

---

## 4. Minimal Viable Integration for Free Tier

Given EverInvests constraints:
- Workers CPU: 10ms max
- Alpha Vantage: 25 req/day (already used)
- No external databases (D1 only)

### Recommended Phased Approach

#### Phase 1: Economic Calendar (Zero API Cost) ⭐ START HERE

```javascript
// Static calendar - no API needed
const HIGH_IMPACT_EVENTS = {
  FOMC: { window_hours: 24, dampen: 0.5 },  // Dampen signals during event window
  CPI: { window_hours: 4, dampen: 0.3 },
  NFP: { window_hours: 4, dampen: 0.3 }
};

function getEventRegime(now) {
  for (const [event, config] of Object.entries(HIGH_IMPACT_EVENTS)) {
    if (isWithinWindow(now, config)) {
      return { regime: 'EVENT', event, dampen: config.dampen };
    }
  }
  return { regime: 'NORMAL', dampen: 1.0 };
}
```

**Value:** Markets behave differently around scheduled events. Signal dampening during event windows reduces false signals.

#### Phase 2: F&G Extreme Regime (Already Have Data)

```javascript
function getFearGreedRegime(value) {
  if (value <= 20) return { regime: 'EXTREME_FEAR', contrarian: 'bullish' };
  if (value >= 80) return { regime: 'EXTREME_GREED', contrarian: 'bearish' };
  return { regime: 'NORMAL', contrarian: null };
}
```

**Value:** Already fetching F&G - use it for regime classification, not just display.

#### Phase 3: VIX Regime Thresholds

```javascript
function getVixRegime(vix) {
  if (vix > 30) return { regime: 'CRISIS', action: 'defensive' };
  if (vix > 20) return { regime: 'STRESSED', action: 'cautious' };
  if (vix < 12) return { regime: 'COMPLACENT', action: 'contrarian_caution' };
  return { regime: 'NORMAL', action: 'proceed' };
}
```

#### Phase 4: GDELT Geopolitical Score (Future)

```javascript
// One API call per day
async function fetchGdeltTensionScore() {
  // Query GDELT for: "war", "crisis", "sanctions", etc.
  // Aggregate into single 0-100 tension score
  // Store in D1 for use by signal generator
}
```

**Free GDELT API client:** [alex9smith/gdelt-doc-api](https://github.com/alex9smith/gdelt-doc-api)

---

## 5. Architecture: News Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    REGIME DETECTION LAYER                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   CURRENT   │    │    ADD      │    │   FUTURE    │     │
│  │  (Price)    │    │  (Events)   │    │  (News NLP) │     │
│  ├─────────────┤    ├─────────────┤    ├─────────────┤     │
│  │ VIX Level   │    │ FOMC Dates  │    │ GDELT Score │     │
│  │ F&G Index   │    │ CPI/NFP     │    │ Sentiment   │     │
│  │ Yield Curve │    │ Fed Speeches│    │ Velocity    │     │
│  │ DXY vs MA   │    │ Econ Impact │    │ Narrative   │     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            ▼                                │
│              ┌─────────────────────────┐                    │
│              │    REGIME CLASSIFIER    │                    │
│              │  Normal/Stressed/Event  │                    │
│              └─────────────────────────┘                    │
│                            │                                │
│                            ▼                                │
│              ┌─────────────────────────┐                    │
│              │   SIGNAL WEIGHT ADJUST  │                    │
│              │  (dampen during events) │                    │
│              └─────────────────────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Connection to Premium Layers

### How Free Regime Detection Feeds Premium

| Free Layer | Premium Extension |
|------------|-------------------|
| Event calendar regime | Regime-conditional weights (Phase 2 Premium) |
| F&G extreme detection | Crowding analysis (Phase 1 Premium) |
| VIX stress levels | Adversarial analysis triggers (Phase 3 Premium) |
| GDELT geopolitical | Black swan probability models |

### Shared Data Philosophy
Free tier provides **regime classification** (Normal/Stressed/Event).
Premium tier uses this to **adjust signal weights** dynamically.

---

## 7. Recommendations Summary

### For EverInvests Free (Immediate)

| Priority | Enhancement | Effort | API Cost | Value |
|----------|-------------|--------|----------|-------|
| 1 | Economic calendar event windows | Low | Zero | High |
| 2 | F&G extreme regime detection | Low | Zero | Medium |
| 3 | VIX regime thresholds | Low | Zero | Medium |
| 4 | Display upcoming events on site | Low | Zero | High |

### For EverInvests Premium (Future)

| Priority | Enhancement | Notes |
|----------|-------------|-------|
| 1 | GDELT geopolitical score | Daily aggregation, 1 API call |
| 2 | Fed/ECB speech NLP | Requires Python worker |
| 3 | Reddit/Twitter sentiment | API costs, noise filtering |
| 4 | Credit spread monitoring | Need data source |

### Tools NOT Recommended

| Tool | Reason |
|------|--------|
| Situation Monitor | Dashboard only, different stack |
| Stocksight | Dated, Twitter API changes |
| OpenBB | Overkill, AGPLv3 license |
| Real-time news APIs | Too expensive, wrong latency |

### Tools to Watch

| Tool | Why |
|------|-----|
| [OFR Financial Stress Index](https://www.financialresearch.gov/financial-stress-index/) | Free, authoritative, daily |
| GDELT | Unmatched scale for geopolitical |
| [FedTools](https://github.com/David-Woroniuk/FedTools) | Simple Fed data extraction |

---

## 8. Answering Research Questions

### Q1: What can news/event monitoring add that price-based indicators miss?

**Context and lead time.** Price tells you WHAT is happening; news tells you WHY. Geopolitical events hit news before price. Fed rhetoric shifts before yield curve moves.

### Q2: Can we detect regime changes BEFORE they show up in price?

**Sometimes:**
- Scheduled events (FOMC, CPI): 100% predictable
- Geopolitical shocks: GDELT provides 15-30 min lead
- Sentiment shifts: Social media leads by minutes-hours
- Liquidity crises: Credit spreads lead equity by days

### Q3: What's the minimal viable news integration?

**Economic calendar + event windows.** Zero API cost, high value. Display upcoming events, flag "event windows" where signals should be dampened.

### Q4: How do we avoid information overload?

1. **Filter by impact:** Only high-impact events (FOMC, CPI, NFP)
2. **Aggregate don't stream:** Daily scores, not real-time feeds
3. **Use for context, not signals:** News informs interpretation
4. **Threshold-based alerts:** Only surface extremes

---

## Sources

### Primary Research
- [hipcityreg/situation-monitor](https://github.com/hipcityreg/situation-monitor)
- [OpenBB-finance/OpenBB](https://github.com/OpenBB-finance/OpenBB)
- [GDELT Project](https://www.gdeltproject.org/)
- [David-Woroniuk/FedTools](https://github.com/David-Woroniuk/FedTools)

### Regime Detection Methods
- [LSEG Market Regime Detection](https://github.com/LSEG-API-Samples/Article.RD.Python.MarketRegimeDetectionUsingStatisticalAndMLBasedApproaches)
- [theo-dim/regime_detection_ml](https://github.com/theo-dim/regime_detection_ml)

### Sentiment Analysis
- [AlgoETS/AINewsTracker](https://github.com/AlgoETS/AINewsTracker)
- [shirosaidev/stocksight](https://github.com/shirosaidev/stocksight)

### Economic Calendar
- [lcsrodriguez/ecocal](https://github.com/lcsrodriguez/ecocal)
- [andrevlima/economic-calendar-api](https://github.com/andrevlima/economic-calendar-api)

### Financial Stress
- [OFR Financial Stress Index](https://www.financialresearch.gov/financial-stress-index/)
