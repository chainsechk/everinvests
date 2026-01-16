import type { Category } from "../types";
import type { WorkflowDefinition } from "../pipeline";
import { cryptoWorkflow } from "./crypto";
import { forexWorkflow } from "./forex";
import { stocksWorkflow } from "./stocks";

export function getWorkflow(category: Category): WorkflowDefinition {
  switch (category) {
    case "crypto":
      return cryptoWorkflow;
    case "forex":
      return forexWorkflow;
    case "stocks":
      return stocksWorkflow;
    default: {
      const exhaustive: never = category;
      throw new Error(`Unknown category: ${exhaustive}`);
    }
  }
}
