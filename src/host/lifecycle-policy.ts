import type { HostLifecycleSignal } from './host-lifecycle';

export type RuntimeLifecycleState = 'active' | 'background-throttled' | 'background-paused';

type RuntimeLifecycleListener = (state: RuntimeLifecycleState) => void;

export class RuntimeLifecyclePolicy {
  private readonly listeners = new Set<RuntimeLifecycleListener>();

  constructor(private currentState: RuntimeLifecycleState = 'active') {}

  get state(): RuntimeLifecycleState {
    return this.currentState;
  }

  handleHostSignal(signal: HostLifecycleSignal): RuntimeLifecycleState {
    const nextState = resolveLifecycleState(this.currentState, signal);

    if (nextState === this.currentState) {
      return this.currentState;
    }

    this.currentState = nextState;
    this.listeners.forEach((listener) => listener(this.currentState));
    return this.currentState;
  }

  subscribe(listener: RuntimeLifecycleListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);

    return () => {
      this.listeners.delete(listener);
    };
  }
}

function resolveLifecycleState(
  currentState: RuntimeLifecycleState,
  signal: HostLifecycleSignal,
): RuntimeLifecycleState {
  if (signal === 'hidden') {
    return 'background-paused';
  }

  if (signal === 'pause') {
    return currentState === 'background-paused' ? currentState : 'background-throttled';
  }

  if (signal === 'visible') {
    return currentState === 'background-paused' ? 'background-throttled' : currentState;
  }

  if (signal === 'resume') {
    return 'active';
  }

  return currentState;
}
