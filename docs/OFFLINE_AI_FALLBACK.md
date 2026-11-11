# ARA offline AI fallback

ARA can use OpenAI as its primary generation provider and Ollama as an optional local fallback.

## Runtime behavior

1. ARA reserves the tenant's AI-response allowance before retrieval or generation, as it does for the primary provider.
2. It attempts OpenAI generation first.
3. If OpenAI generation fails and `LOCAL_LLM_ENABLED=true`, ARA sends the same grounded prompt to the configured local Ollama model.
4. If OpenAI query embeddings fail, retrieval switches to PostgreSQL full-text search, scoped to the same tenant, knowledge base, category and metadata filters. This avoids an embeddings API call during fallback.
5. ARA validates the local model's JSON, language, status and citations against retrieved tenant evidence using the same validation as OpenAI.
6. If the local model is unavailable or its response fails validation, ARA escalates to a human. Quota reservations are released on unsuccessful answers.

Local model token counts are recorded with provider `ollama`; no OpenAI token price is applied to local inference. Subscription response quotas remain enforced regardless of provider.

## Start Ollama locally

Requires Docker and enough memory for the selected model. A quantized 7B model generally needs a machine with at least 8 GB RAM; more memory improves headroom and concurrency.

```bash
docker compose --profile offline-ai up -d ollama
docker exec -it ara-ollama ollama pull qwen2.5:7b-instruct
```

Set these backend environment variables:

```env
LOCAL_LLM_ENABLED=true
LOCAL_LLM_BASE_URL=http://localhost:11434
LOCAL_LLM_CHAT_MODEL=qwen2.5:7b-instruct
LOCAL_LLM_TIMEOUT_MS=90000
```

If the ARA backend itself runs inside the same Docker Compose network, use `LOCAL_LLM_BASE_URL=http://ollama:11434` instead. Keep the Ollama port bound to localhost or a private network; do not expose the unauthenticated Ollama endpoint publicly.

## Important scope

The live-response fallback is offline after Ollama and its model have been downloaded. Existing knowledge chunks can be retrieved locally using PostgreSQL full-text search when OpenAI embeddings are unavailable. The current document-ingestion pipeline still uses OpenAI embeddings when adding or re-indexing knowledge; a separate local ingestion/re-indexing phase is required for completely offline knowledge administration.

This change does not deploy Ollama to the production host or download a model automatically. The Ollama runtime and model must be provisioned on infrastructure reachable through a private network. Do not enable the fallback in a hosted environment until that connectivity and memory capacity are verified.
