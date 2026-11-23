type Listener = () => void;

const receivedListeners = new Set<Listener>();

/** Lets screens such as the notification inbox refresh when a push arrives. */
export function emitPushReceived(): void {
  receivedListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn('Push received listener failed:', error);
    }
  });
}

export function onPushReceived(listener: Listener): () => void {
  receivedListeners.add(listener);
  return () => receivedListeners.delete(listener);
}
