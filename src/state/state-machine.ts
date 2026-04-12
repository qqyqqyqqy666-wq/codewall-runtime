/**
 * Provides a minimal lifecycle state container for the runtime while richer flow logic is deferred.
 */
export class StateMachine<TState extends string> {
  constructor(private currentState: TState) {}

  get value(): TState {
    return this.currentState;
  }

  matches(state: TState): boolean {
    return this.currentState === state;
  }

  transition(nextState: TState): void {
    this.currentState = nextState;
  }
}

export type RuntimeMode =
  | 'IDLE'
  | 'HAND_ACTIVE'
  | 'ATTRACT'
  | 'REPEL'
  | 'VORTEX'
  | 'TYPEFLOW';

const RUNTIME_MODE_TRANSITIONS: Readonly<Record<RuntimeMode, readonly RuntimeMode[]>> = {
  IDLE: ['HAND_ACTIVE', 'TYPEFLOW'],
  HAND_ACTIVE: ['IDLE', 'ATTRACT', 'REPEL', 'VORTEX', 'TYPEFLOW'],
  ATTRACT: ['HAND_ACTIVE', 'REPEL', 'VORTEX'],
  REPEL: ['HAND_ACTIVE', 'ATTRACT', 'VORTEX'],
  VORTEX: ['HAND_ACTIVE', 'ATTRACT', 'REPEL'],
  TYPEFLOW: ['IDLE', 'HAND_ACTIVE'],
};

export class RuntimeModeState {
  constructor(private currentMode: RuntimeMode = 'IDLE') {}

  get value(): RuntimeMode {
    return this.currentMode;
  }

  canTransition(nextMode: RuntimeMode): boolean {
    return this.currentMode === nextMode || RUNTIME_MODE_TRANSITIONS[this.currentMode].includes(nextMode);
  }

  transition(nextMode: RuntimeMode): boolean {
    if (!this.canTransition(nextMode)) {
      return false;
    }

    this.currentMode = nextMode;
    return true;
  }
}

export const runtimeModeTransitions = RUNTIME_MODE_TRANSITIONS;
