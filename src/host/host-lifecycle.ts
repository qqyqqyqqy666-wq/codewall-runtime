export type HostLifecycleSignal = 'pause' | 'resume' | 'hidden' | 'visible';

const HOST_LIFECYCLE_EVENT = 'codewall:host-lifecycle';

type HostLifecycleEventDetail = {
  signal: HostLifecycleSignal;
};

declare global {
  interface Window {
    __codewallHostLifecycle?: (signal: HostLifecycleSignal) => void;
  }
}

let installed = false;

export function installHostLifecycleBridge(): void {
  if (installed) {
    return;
  }

  installed = true;

  window.__codewallHostLifecycle = (signal: HostLifecycleSignal) => {
    window.dispatchEvent(new CustomEvent<HostLifecycleEventDetail>(HOST_LIFECYCLE_EVENT, {
      detail: { signal },
    }));
  };
}

export function onHostLifecycleSignal(
  listener: (signal: HostLifecycleSignal) => void,
): () => void {
  const handleEvent = (event: Event): void => {
    const lifecycleEvent = event as CustomEvent<HostLifecycleEventDetail>;
    listener(lifecycleEvent.detail.signal);
  };

  window.addEventListener(HOST_LIFECYCLE_EVENT, handleEvent);

  return () => {
    window.removeEventListener(HOST_LIFECYCLE_EVENT, handleEvent);
  };
}
