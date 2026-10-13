import { useEffect, useRef } from 'react';

let overlaySequence = 0;
const overlayStateKey = '__nihongoOverlayEntry';

export function useBackDismiss(isOpen: boolean, onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!isOpen) return;

    const entryId = `overlay-${++overlaySequence}`;
    const currentState = window.history.state;
    const nextState = currentState && typeof currentState === 'object' ? { ...currentState } : {};
    nextState[overlayStateKey] = entryId;
    window.history.pushState(nextState, '', window.location.href);

    let entryIsActive = true;
    const handlePopState = () => {
      if (!entryIsActive) return;
      entryIsActive = false;
      onDismissRef.current();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (!entryIsActive) return;

      const state = window.history.state;
      if (state && typeof state === 'object' && state[overlayStateKey] === entryId) {
        entryIsActive = false;
        window.history.back();
      }
    };
  }, [isOpen]);
}