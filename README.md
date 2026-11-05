# ARA — Autonomous Respond Agent

NestJS + TypeScript backend for a Kenyan real-estate agency. Phase 1 provides tenant-scoped RAG; Phase 2 adds agency accounts, team access, conversations and human escalations.

## Setup
1. Copy `.env.example` to `.env`; set OpenAI key and unique 32+ character ingestion key and JWT secret.
2. Start PostgreSQL: `docker compose up -d db`.
3. Apply migrations in order: `psql "$DATABASE_URL" -f migrations/001_init.sql`, `002_platform.sql`, then `003_tenant_rag.sql`.
4. Install and run: `npm ci`, `npm run build`, `npm test`, `npm run start:dev`.

## API
- `POST /platform/register`: `{agencyName,fullName,email,password}`; password minimum 12 characters. Returns agency slug and access token.
- `POST /platform/login`: `{agencySlug,email,password}`; returns 15-minute access token and 30-day refresh token.
- `POST /platform/refresh`: rotates refresh token; `POST /platform/logout` revokes it.
- Bearer-authenticated `POST /knowledge`: upserts a document under the caller's agency. Body: `{title,category,language,content,sourceRef?,metadata?}`.
- Bearer-authenticated `POST /answer`: RAG search is restricted to the caller's agency. Body: `{message,preferredLanguage?,filters?}`.
- Bearer-authenticated team, conversation and escalation endpoints are under `/platform`.

All knowledge writes, updates, deactivations and retrievals are scoped by agency ID from the verified access token. Existing pre-tenant knowledge documents have NULL agency IDs and are intentionally not returned to any tenant; migrate/assign them deliberately before serving customers.

## Platform limitations
Outbound messages are stored as queued but no WhatsApp, Messenger, Instagram, Telegram, email or webchat delivery provider is connected. Automatic inbound AI processing/worker is not yet connected. Run migrations and CI/build/tests before deployment. Use HTTPS, rate limiting, secret management, backups and production monitoring.
