#!/bin/sh
set -eu

# Railway may inject PORT dynamically; default to Ollama's native 11434.
PORT_VALUE="${PORT:-11434}"
MODEL="${OLLAMA_MODEL:-llama3.1:8b}"
SKIP_PULL="${OLLAMA_SKIP_PULL:-false}"

export OLLAMA_HOST="0.0.0.0:${PORT_VALUE}"

echo "Starting Ollama on ${OLLAMA_HOST}"
ollama serve &
OLLAMA_PID=$!

echo "Waiting for Ollama API to come online..."
READY_URL="http://127.0.0.1:${PORT_VALUE}/api/tags"
MAX_WAIT=90
COUNT=0
until curl -sf "${READY_URL}" > /dev/null 2>&1; do
  COUNT=$((COUNT + 1))
  if [ "${COUNT}" -ge "${MAX_WAIT}" ]; then
    echo "Ollama API did not become ready within ${MAX_WAIT}s"
    break
  fi
  sleep 1
done

if [ "${SKIP_PULL}" != "true" ]; then
  echo "Pulling model: ${MODEL}"
  ollama pull "${MODEL}" || echo "Model pull failed. Service will still start; pull later via API if needed."
else
  echo "Skipping model pull because OLLAMA_SKIP_PULL=true"
fi

wait "${OLLAMA_PID}"
