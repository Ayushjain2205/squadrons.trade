import type { Agent, Strategy } from "@squadrons/shared";

export type RecipeContext = {
  agent: Agent;
  strategy: Strategy;
  walletAddress: string | null;
};
