export function createEventStream(onMessage: (payload: unknown) => void, onError?: () => void) {
  const stream = new EventSource("/api/events", { withCredentials: true });

  stream.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      // Ignore malformed event payloads.
    }
  };

  stream.onerror = () => {
    onError?.();
    // Keep the stream open so EventSource can perform built-in reconnects.
    // Closing here turns transient upstream disconnects into permanent outages.
  };

  return stream;
}