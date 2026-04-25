const BASE_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000

export interface EventStreamHandle {
  close: () => void
}

export function createEventStream(
  onMessage: (payload: unknown) => void,
  onError?: (reconnecting: boolean) => void,
): EventStreamHandle {
  let stream: EventSource | null = null
  let retryCount = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let closed = false

  function connect() {
    if (closed) return
    stream = new EventSource("/api/events", { withCredentials: true })

    stream.onmessage = (event) => {
      retryCount = 0 // reset backoff on successful message
      try {
        onMessage(JSON.parse(event.data))
      } catch {
        // Ignore malformed payloads.
      }
    }

    stream.onerror = () => {
      if (closed) return
      stream?.close()
      stream = null

      const delay = Math.min(BASE_DELAY_MS * 2 ** retryCount, MAX_DELAY_MS)
      retryCount++
      onError?.(true)

      retryTimer = setTimeout(() => {
        if (!closed) connect()
      }, delay)
    }
  }

  connect()

  return {
    close() {
      closed = true
      if (retryTimer != null) clearTimeout(retryTimer)
      stream?.close()
      stream = null
    },
  }
}