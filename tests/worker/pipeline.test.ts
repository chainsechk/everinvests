import { describe, expect, it } from "vitest";

import { runWorkflow } from "../../worker/src/pipeline";
import { toSkillKey, type SkillSpec } from "../../worker/src/skills/types";

function makeSkill(id: string, calls: string[]): SkillSpec<any, any> {
  return {
    id,
    version: "1",
    async run() {
      calls.push(id);
      return { ok: true };
    },
  };
}

describe("pipeline", () => {
  it("executes steps in dependency order", async () => {
    const calls: string[] = [];

    const skills = {
      [toSkillKey("a", "1")]: makeSkill("a", calls),
      [toSkillKey("b", "1")]: makeSkill("b", calls),
      [toSkillKey("c", "1")]: makeSkill("c", calls),
    };

    const workflow = {
      id: "test",
      steps: [
        { id: "A", skill: { id: "a", version: "1" }, dependsOn: ["B"] },
        { id: "C", skill: { id: "c", version: "1" }, dependsOn: ["A"] },
        { id: "B", skill: { id: "b", version: "1" } },
      ],
    };

    await runWorkflow({
      env: { DB: {} as any, AI: {} as any } as any,
      ctx: { cron: "test", category: "crypto", date: "2026-01-01", timeSlot: "00:00" },
      workflow,
      skills: skills as any,
    });

    expect(calls).toEqual(["b", "a", "c"]);
  });

  it("fails on dependency cycles", async () => {
    const calls: string[] = [];

    const skills = {
      [toSkillKey("a", "1")]: makeSkill("a", calls),
      [toSkillKey("b", "1")]: makeSkill("b", calls),
    };

    const workflow = {
      id: "cycle",
      steps: [
        { id: "A", skill: { id: "a", version: "1" }, dependsOn: ["B"] },
        { id: "B", skill: { id: "b", version: "1" }, dependsOn: ["A"] },
      ],
    };

    await expect(
      runWorkflow({
        env: { DB: {} as any, AI: {} as any } as any,
        ctx: { cron: "test", category: "crypto", date: "2026-01-01", timeSlot: "00:00" },
        workflow,
        skills: skills as any,
      })
    ).rejects.toThrow(/cycle/i);
  });
});
