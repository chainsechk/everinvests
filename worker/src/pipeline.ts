import type { Env } from "./env";
import type { PipelineState, SharedState, SkillKey, SkillSpec, WorkflowContext } from "./skills/types";
import { toSkillKey } from "./skills/types";

export interface WorkflowStep<TInput = unknown> {
  id: string;
  skill: { id: string; version: string };
  dependsOn?: string[];
  input?: (args: { ctx: WorkflowContext; state: PipelineState; shared: SharedState }) => TInput;
}

export interface WorkflowDefinition {
  id: string;
  steps: WorkflowStep[];
}

export interface PipelineRecorder {
  startWorkflow(args: {
    ctx: WorkflowContext;
    workflow: WorkflowDefinition;
  }): Promise<number | undefined>;

  finishWorkflow(args: {
    workflowRunId?: number;
    status: "success" | "error";
    durationMs: number;
  }): Promise<void>;

  startSkill(args: {
    workflowRunId?: number;
    step: WorkflowStep;
  }): Promise<number | undefined>;

  finishSkill(args: {
    skillRunId?: number;
    status: "success" | "error";
    durationMs: number;
    errorMsg?: string;
  }): Promise<void>;
}

export function createD1Recorder(env: Env): PipelineRecorder {
  return {
    async startWorkflow({ ctx, workflow }) {
      try {
        const row = await env.DB.prepare(
          `INSERT INTO workflow_runs (workflow_id, category, date, time_slot, status, duration_ms)
           VALUES (?, ?, ?, ?, ?, ?)
           RETURNING id`
        )
          .bind(workflow.id, ctx.category, ctx.date, ctx.timeSlot, "running", null)
          .first<{ id: number }>();
        return row?.id;
      } catch (error) {
        console.warn("[pipeline] Failed to start workflow run:", error);
        return undefined;
      }
    },

    async finishWorkflow({ workflowRunId, status, durationMs }) {
      if (!workflowRunId) return;
      try {
        await env.DB.prepare(
          `UPDATE workflow_runs SET status = ?, duration_ms = ? WHERE id = ?`
        )
          .bind(status, durationMs, workflowRunId)
          .run();
      } catch (error) {
        console.warn("[pipeline] Failed to finish workflow run:", error);
      }
    },

    async startSkill({ workflowRunId, step }) {
      if (!workflowRunId) return undefined;
      try {
        const row = await env.DB.prepare(
          `INSERT INTO skill_runs (workflow_run_id, skill_id, skill_version, status, duration_ms, error_msg)
           VALUES (?, ?, ?, ?, ?, ?)
           RETURNING id`
        )
          .bind(workflowRunId, step.skill.id, step.skill.version, "running", null, null)
          .first<{ id: number }>();
        return row?.id;
      } catch (error) {
        console.warn("[pipeline] Failed to start skill run:", error);
        return undefined;
      }
    },

    async finishSkill({ skillRunId, status, durationMs, errorMsg }) {
      if (!skillRunId) return;
      try {
        await env.DB.prepare(
          `UPDATE skill_runs SET status = ?, duration_ms = ?, error_msg = ? WHERE id = ?`
        )
          .bind(status, durationMs, errorMsg ?? null, skillRunId)
          .run();
      } catch (error) {
        console.warn("[pipeline] Failed to finish skill run:", error);
      }
    },
  };
}

function toposortSteps(steps: WorkflowStep[]): WorkflowStep[] {
  const byId = new Map<string, WorkflowStep>();

  for (const step of steps) {
    if (byId.has(step.id)) {
      throw new Error(`Duplicate workflow step id: ${step.id}`);
    }
    byId.set(step.id, step);
  }

  const deps = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();

  for (const step of steps) {
    const list = step.dependsOn ?? [];
    for (const dep of list) {
      if (!byId.has(dep)) {
        throw new Error(`Workflow step ${step.id} depends on missing step ${dep}`);
      }
      deps.set(step.id, (deps.get(step.id) ?? new Set()).add(dep));
      reverse.set(dep, (reverse.get(dep) ?? new Set()).add(step.id));
    }
    deps.set(step.id, deps.get(step.id) ?? new Set());
  }

  const ready = [...deps.entries()]
    .filter(([, set]) => set.size === 0)
    .map(([id]) => id)
    .sort();

  const ordered: WorkflowStep[] = [];

  while (ready.length > 0) {
    const id = ready.shift()!;
    ordered.push(byId.get(id)!);

    for (const dependent of reverse.get(id) ?? []) {
      const set = deps.get(dependent);
      if (!set) continue;
      set.delete(id);
      if (set.size === 0) {
        ready.push(dependent);
        ready.sort();
      }
    }
  }

  if (ordered.length !== steps.length) {
    throw new Error("Workflow contains a dependency cycle");
  }

  return ordered;
}

export async function runWorkflow(args: {
  env: Env;
  ctx: WorkflowContext;
  workflow: WorkflowDefinition;
  skills: Record<SkillKey, SkillSpec<any, any>>;
  shared?: SharedState;
  recorder?: PipelineRecorder;
}): Promise<PipelineState> {
  const { env, ctx, workflow, skills } = args;
  const shared = args.shared ?? {};
  const recorder = args.recorder;

  const state: PipelineState = {};
  const ordered = toposortSteps(workflow.steps);

  const workflowStart = Date.now();
  const workflowRunId = recorder
    ? await recorder.startWorkflow({ ctx, workflow })
    : undefined;

  try {
    for (const step of ordered) {
      const key = toSkillKey(step.skill.id, step.skill.version) as SkillKey;
      const skill = skills[key];
      if (!skill) {
        throw new Error(`Missing skill implementation: ${key}`);
      }

      const input = step.input ? step.input({ ctx, state, shared }) : undefined;

      const skillRunId = recorder
        ? await recorder.startSkill({ workflowRunId, step })
        : undefined;
      const skillStart = Date.now();

      try {
        const output = await skill.run({ env, ctx, state, shared, input });
        state[step.id] = output;
        if (recorder) {
          await recorder.finishSkill({
            skillRunId,
            status: "success",
            durationMs: Date.now() - skillStart,
          });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (recorder) {
          await recorder.finishSkill({
            skillRunId,
            status: "error",
            durationMs: Date.now() - skillStart,
            errorMsg: msg,
          });
        }
        throw error;
      }
    }

    if (recorder) {
      await recorder.finishWorkflow({
        workflowRunId,
        status: "success",
        durationMs: Date.now() - workflowStart,
      });
    }

    return state;
  } catch (error) {
    if (recorder) {
      await recorder.finishWorkflow({
        workflowRunId,
        status: "error",
        durationMs: Date.now() - workflowStart,
      });
    }
    throw error;
  }
}
