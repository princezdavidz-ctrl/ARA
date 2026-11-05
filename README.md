# ARA — Autonomous Respond Agent

NestJS + TypeScript backend for a Kenyan real-estate agency. Phase 1 provides the RAG knowledge API; Phase 2 adds tenant accounts, team access, conversations and human escalations.

## Stack
- Node.js 20+, NestJS 10, TypeScript
- PostgreSQL 16 + pgvector
- OpenAI embeddings and grounded answer generation
- HS256 short-lived access tokens, rotating opaque refresh tokens
- Tenant-scoped SQL access for platform records

## Setup
1. Copy `.env.example` to `.env`; set valid OpenAI key, unique 32+ character ingestion key and JWT secret.
2. Start PostgreSQL: `docker compose up -d db`.
3. Apply migrations in order: `psql "$DATABASE_URL" -f migrations/001_init.sql` then `psql "$DATABASE_URL" -f migrations/002_platform.sql`.
4. Install and run: `npm ci`, `npm run build`, `npm test`, `npm run start:dev`.

## Phase 2 API
- `POST /platform/register` — create an agency and its owner account. Password minimum 12 characters.
- `POST /platform/login` — returns 15-minute access token and 30-day refresh token.
- `POST /platform/refresh` — rotates refresh token; old token is revoked.
- `POST /platform/logout` — revoke refresh token.
- Bearer-authenticated `GET/POST /platform/team`; `POST /platform/team/:id/deactivate`.
- Bearer-authenticated `GET/POST /platform/conversations`.
- `GET/POST /platform/conversations/:id/messages`; outbound messages are stored as `queued`, not delivered to a channel.
- `POST /platform/conversations/:id/assign`.
- `GET /platform/escalations`; create with `POST /platform/conversations/:id/escalations`; claim/resolve with `POST /platform/escalations/:id/claim` and `POST /platform/escalations/:id/resolve`.

All platform data queries include the authenticated agency ID. Team roles: owner/admin can add or deactivate members; owner/admin/manager can view team and assign conversations. Agents can handle conversations and escalations.

## Important limitations
- External WhatsApp, Instagram, Messenger, Telegram, email and webchat delivery/webhooks are not connected. Outbound messages remain queued in the database.
- Phase 2 does not yet run an asynchronous queue worker or automatically invoke RAG for inbound messages.
- Phase 1 knowledge ingestion is not yet fully wired to authenticated agency identity. Do not use multi-agency RAG until tenant filtering is applied to both ingestion and retrieval.
- Run migrations and CI/build/tests before deployment. Enforce HTTPS, rate limits, secure secrets, backups and production logging at the deployment edge.
