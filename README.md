# ARA — Phase 1 RAG backend

NestJS/TypeScript retrieval-augmented generation for a Kenyan real-estate agency. Supports English (`en`) and Kiswahili (`sw`) knowledge, property listings, FAQs and agency information.

## Stack
- PostgreSQL 16 + pgvector (1536-dimensional OpenAI embeddings)
- OpenAI `text-embedding-3-small` and configurable chat model
- NestJS REST API, Zod request validation, Helmet security headers

## Run
1. Install Node.js 20+ and Docker.
2. Copy `.env.example` to `.env`; set `OPENAI_API_KEY`, a long random `INGESTION_API_KEY`, and `DATABASE_URL` matching the database credentials.
3. Start PostgreSQL: `docker compose up -d db`. The initial migration is mounted into the Postgres entrypoint and runs on first volume initialization.
4. `npm install && npm run build && npm start` (or `npm run start:dev`).

## API
`GET /health` — database-backed health check.

`POST /knowledge` — upsert an agency knowledge document. Send `x-ingestion-key` header. Body: `{title,category,language,content,sourceRef?,metadata?}`. Categories: `property_listing`, `faq`, `business_information`; language: `en`, `sw`, `both`. Use `sourceRef` as a stable external listing/document ID to update existing material. Metadata can include `location`, `propertyType`, `purpose` (`rent`/`sale`), `bedrooms`, and numeric `price`.

`POST /answer` — body: `{message,preferredLanguage:'auto'|'en'|'sw',filters:{category?,location?,propertyType?,purpose?,bedrooms?,maxPrice?}}`. Returns answer, language, status, confidence, citations and escalation reason.

## Grounding rules
ARA must answer only from retrieved agency records. Missing or weak evidence results in `needs_human`; it must not invent prices, listing availability, title/ownership verification, amenities, viewing appointments, fees or legal requirements. Legal/title questions are referred to a qualified Kenyan professional or official verification. Keep listing metadata current and deactivate withdrawn listings through the ingestion service.

## Notes
Run migrations in a managed database explicitly if Docker entrypoint initialization is not applicable. Protect `/knowledge` with a secret of at least 32 characters and rotate it if exposed. `/answer` is currently an internal service endpoint: place it behind your trusted application gateway before exposing it publicly. This Phase 1 implementation does not include WhatsApp/social integrations, agent dashboard, user authentication, tenant isolation or deployment automation.
