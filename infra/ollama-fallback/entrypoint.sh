#!/bin/sh
set -eu

# Keep the API available while the small fallback model is checked/downloaded.
/bin/ollama serve &
OLLAMA_PID=$!

shutdown() {
  kill "$OLLAMA_PID" 2>/dev/null || true
  wait "$OLLAMA_PID" 2>/dev/null || true
}
trap shutdown INT TERM

until /bin/ollama list >/dev/null 2>&1; do
  if ! kill -0 "$OLLAMA_PID" 2>/dev/null; then
    wait "$OLLAMA_PID"
    exit 1
  fi
  sleep 2
done

if ! /bin/ollama list | grep -q '^qwen2.5:0.5b'; then
  echo "Fallback model qwen2.5:0.5b is missing; downloading it to the persistent model volume."
  if ! /bin/ollama pull qwen2.5:0.5b; then
    echo "ERROR: fallback model download failed; Ollama remains online but cannot answer until the model is available."
  fi
fi

wait "$OLLAMA_PID"
