export interface QualityFlags {
  missing_assets?: string[];
  macro_fallback?: boolean;
}

export function computeQualityFlags(args: {
  missingTickers: string[];
  macroFallback: boolean;
}): QualityFlags {
  const flags: QualityFlags = {};

  if (args.missingTickers.length > 0) {
    flags.missing_assets = args.missingTickers;
  }

  if (args.macroFallback) {
    flags.macro_fallback = true;
  }

  return flags;
}
