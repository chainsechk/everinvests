import type { Env } from "../env";

export interface WorkflowContext {
  cron: string;
  category: string;
  date: string;
  timeSlot: string;
}

export type PipelineState = Record<string, unknown>;
export type SharedState = Record<string, unknown>;

export interface SkillSpec<TInput = unknown, TOutput = unknown> {
  id: string;
  version: string;
  run(args: {
    env: Env;
    ctx: WorkflowContext;
    state: PipelineState;
    shared: SharedState;
    input: TInput;
  }): Promise<TOutput>;
}

export type SkillKey = `${string}@${string}`;

export function toSkillKey(skillId: string, skillVersion: string): SkillKey {
  return `${skillId}@${skillVersion}`;
}
