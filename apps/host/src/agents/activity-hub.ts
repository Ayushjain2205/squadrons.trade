import type { ActivityEvent, ActivitySource } from "@squadrons/shared";
import type { ActivityStore, NewActivityEvent } from "./activity.js";

type Listener = (event: ActivityEvent) => void;

/**
 * Persist activity and fan out to live SSE subscribers for that agent.
 */
export class ActivityHub {
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(private readonly store: ActivityStore) {}

  list(
    agentId: string,
    options: {
      limit?: number;
      beforeCreatedAt?: number;
      beforeId?: string;
      sources?: ActivitySource[];
    } = {},
  ): { events: ActivityEvent[]; hasMore: boolean } {
    return this.store.listByAgent(agentId, options);
  }

  publish(input: NewActivityEvent): ActivityEvent {
    const event = this.store.append(input);
    const set = this.listeners.get(event.agentId);
    if (set) {
      for (const listener of set) {
        try {
          listener(event);
        } catch (error) {
          console.error("[activity] listener error", error);
        }
      }
    }
    return event;
  }

  subscribe(agentId: string, listener: Listener): () => void {
    let set = this.listeners.get(agentId);
    if (!set) {
      set = new Set();
      this.listeners.set(agentId, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) this.listeners.delete(agentId);
    };
  }
}
