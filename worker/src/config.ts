export type CTAMode = 'waitlist' | 'live' | 'none';

export interface CTAConfig {
  telegram: string;
  website: {
    title: string;
    subtitle: string;
    cta: string;
    url: string;
    subtext: string | null;
  } | null;
}

export const CTA_CONFIG: Record<CTAMode, CTAConfig> = {
  waitlist: {
    telegram: `
━━━━━━━━━━━━━━━━━━━━━━━━
🚀 EverInvests VIP launching soon
Regime analysis • Confidence scores • Directives
👉 Join waitlist: t.me/EverInvestsBot?start=waitlist`,
    website: {
      title: '🚀 EverInvests VIP Launching Soon',
      subtitle: "We're building professional-grade signals with:",
      cta: 'Join VIP Waitlist →',
      url: 'https://t.me/EverInvestsBot?start=waitlist',
      subtext: 'Be first to know when we launch',
    },
  },
  live: {
    telegram: `
━━━━━━━━━━━━━━━━━━━━━━━━
Want regime + confidence + directives?
👉 Join EverInvests VIP: t.me/EverInvestsVIPBot`,
    website: {
      title: 'Want More Than Just Bias?',
      subtitle: 'Free signals show direction only. EverInvests VIP gives you:',
      cta: 'Join EverInvests VIP →',
      url: 'https://t.me/EverInvestsVIPBot',
      subtext: null,
    },
  },
  none: {
    telegram: '',
    website: null,
  },
};

export function getCTAConfig(mode: string | undefined): CTAConfig {
  const validMode = (mode as CTAMode) || 'waitlist';
  return CTA_CONFIG[validMode] || CTA_CONFIG.waitlist;
}

export function getCTAMode(env: { VIP_CTA_MODE?: string }): CTAMode {
  const mode = env.VIP_CTA_MODE;
  if (mode === 'waitlist' || mode === 'live' || mode === 'none') {
    return mode;
  }
  return 'waitlist';
}
