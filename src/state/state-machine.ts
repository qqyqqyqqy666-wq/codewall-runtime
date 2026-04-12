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
