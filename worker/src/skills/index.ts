import type { SkillKey, SkillSpec } from "./types";
import { toSkillKey } from "./types";
import { fetchMacroDataSkill } from "./fetchMacroData";
import { fetchAssetDataSkill } from "./fetchAssetData";
import { computeBiasSkill } from "./computeBias";
import { qualityChecksSkill } from "./qualityChecks";
import { generateSummarySkill } from "./generateSummary";
import { storeSignalSkill } from "./storeSignal";
import { notifyTelegramSkill } from "./notifyTelegram";
import { deliverWebhooksSkill } from "./deliverWebhooks";

export const skillRegistry: Record<SkillKey, SkillSpec<any, any>> = {
  [toSkillKey(fetchMacroDataSkill.id, fetchMacroDataSkill.version)]: fetchMacroDataSkill,
  [toSkillKey(fetchAssetDataSkill.id, fetchAssetDataSkill.version)]: fetchAssetDataSkill,
  [toSkillKey(computeBiasSkill.id, computeBiasSkill.version)]: computeBiasSkill,
  [toSkillKey(qualityChecksSkill.id, qualityChecksSkill.version)]: qualityChecksSkill,
  [toSkillKey(generateSummarySkill.id, generateSummarySkill.version)]: generateSummarySkill,
  [toSkillKey(storeSignalSkill.id, storeSignalSkill.version)]: storeSignalSkill,
  [toSkillKey(notifyTelegramSkill.id, notifyTelegramSkill.version)]: notifyTelegramSkill,
  [toSkillKey(deliverWebhooksSkill.id, deliverWebhooksSkill.version)]: deliverWebhooksSkill,
};
