// Output validation for LLM-generated summaries
// Enforces length, tone, and content quality standards

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

// Validation configuration
const VALIDATION_CONFIG = {
  // Length constraints
  minLength: 30, // Minimum characters for a useful summary
  maxLength: 300, // Maximum characters (1-2 sentences)
  minWords: 5, // Minimum word count
  maxWords: 60, // Maximum word count

  // Forbidden patterns (case insensitive)
  forbiddenPatterns: [
    /\bfibonacci\b/i, // Invented indicator
    /\bmacd\s*crossover\b/i, // Not provided in data
    /\belliot\s*wave\b/i, // Not provided in data
    /\bichimoku\b/i, // Not provided in data
    /\bbolling[ea]r\b/i, // Not provided in data
    /\bhead\s+and\s+shoulders\b/i, // Chart pattern not in data
    /\bdouble\s+(top|bottom)\b/i, // Chart pattern not in data
    /\bthis\s+is\s+not\s+financial\s+advice\b/i, // Disclaimer
    /\bdisclaimer\b/i, // Disclaimer
    /\bdo\s+your\s+own\s+research\b/i, // DYOR warning
    /\bnfa\b/i, // NFA abbreviation
    /\bdyor\b/i, // DYOR abbreviation
  ],

  // Emoji detection (summaries should be plain text)
  // Comprehensive emoji regex covering all major Unicode emoji blocks
  emojiPattern: /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu,

  // Markdown detection (summaries should be plain text)
  markdownPatterns: [
    /\*\*[^*]+\*\*/, // Bold
    /\*[^*]+\*/, // Italic
    /^#+\s/, // Headers
    /\[.+\]\(.+\)/, // Links
    /^[-*]\s/m, // Bullet points
    /^>\s/m, // Block quotes
    /`[^`]+`/, // Code
  ],

  // Tone check - avoid overly promotional or sensational language
  sensationalPatterns: [
    /\b(guaranteed|100%|certain|definitely|absolutely)\b/i,
    /\b(moon|mooning|lambo|rekt)\b/i,
    /\b(explosive|skyrocket|crash|plummet)\b/i,
    /\b(must\s+buy|must\s+sell|buy\s+now|sell\s+now)\b/i,
  ],
};

// Validate LLM summary output
export function validateSummary(summary: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  const trimmed = summary.trim();

  // Length checks
  if (trimmed.length < VALIDATION_CONFIG.minLength) {
    issues.push({
      code: "TOO_SHORT",
      message: `Summary is too short (${trimmed.length} chars, minimum ${VALIDATION_CONFIG.minLength})`,
      severity: "error",
    });
  }

  if (trimmed.length > VALIDATION_CONFIG.maxLength) {
    issues.push({
      code: "TOO_LONG",
      message: `Summary is too long (${trimmed.length} chars, maximum ${VALIDATION_CONFIG.maxLength})`,
      severity: "warning",
    });
  }

  // Word count checks
  const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < VALIDATION_CONFIG.minWords) {
    issues.push({
      code: "TOO_FEW_WORDS",
      message: `Summary has too few words (${wordCount}, minimum ${VALIDATION_CONFIG.minWords})`,
      severity: "error",
    });
  }

  if (wordCount > VALIDATION_CONFIG.maxWords) {
    issues.push({
      code: "TOO_MANY_WORDS",
      message: `Summary has too many words (${wordCount}, maximum ${VALIDATION_CONFIG.maxWords})`,
      severity: "warning",
    });
  }

  // Forbidden patterns check
  for (const pattern of VALIDATION_CONFIG.forbiddenPatterns) {
    if (pattern.test(trimmed)) {
      issues.push({
        code: "FORBIDDEN_PATTERN",
        message: `Summary contains forbidden pattern: ${pattern.source}`,
        severity: "error",
      });
    }
  }

  // Emoji check
  if (VALIDATION_CONFIG.emojiPattern.test(trimmed)) {
    issues.push({
      code: "CONTAINS_EMOJI",
      message: "Summary contains emojis (plain text required)",
      severity: "error",
    });
  }

  // Markdown check
  for (const pattern of VALIDATION_CONFIG.markdownPatterns) {
    if (pattern.test(trimmed)) {
      issues.push({
        code: "CONTAINS_MARKDOWN",
        message: `Summary contains markdown formatting`,
        severity: "error",
      });
      break; // Only report once
    }
  }

  // Sensational language check
  for (const pattern of VALIDATION_CONFIG.sensationalPatterns) {
    if (pattern.test(trimmed)) {
      issues.push({
        code: "SENSATIONAL_LANGUAGE",
        message: `Summary contains sensational language: ${pattern.source}`,
        severity: "warning",
      });
    }
  }

  // Empty check
  if (!trimmed) {
    issues.push({
      code: "EMPTY",
      message: "Summary is empty",
      severity: "error",
    });
  }

  // Determine overall validity (any errors = invalid)
  const valid = !issues.some(i => i.severity === "error");

  return { valid, issues };
}

// Sanitize summary by removing problematic patterns
export function sanitizeSummary(summary: string): string {
  let result = summary.trim();

  // Remove emojis
  result = result.replace(VALIDATION_CONFIG.emojiPattern, "");

  // Remove markdown formatting
  result = result.replace(/\*\*([^*]+)\*\*/g, "$1"); // Bold
  result = result.replace(/\*([^*]+)\*/g, "$1"); // Italic
  result = result.replace(/`([^`]+)`/g, "$1"); // Code

  // Clean up extra whitespace
  result = result.replace(/\s+/g, " ").trim();

  return result;
}

// Check if summary passes minimum quality threshold
export function meetsMinimumQuality(summary: string): boolean {
  const validation = validateSummary(summary);
  return validation.valid;
}
