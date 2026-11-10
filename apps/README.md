# ARA Frontend Applications

ARA now has two separate static frontend applications that share the same NestJS API and tenant-aware authorization model.

## Company CRM
- Path: `apps/company-crm`
- Sign-in: company slug, user email and password via `POST /platform/login`
- Workspace: overview, inbox, channel connections, industry-neutral knowledge, subscription billing and team management
- Company users are scoped by the agency claim in their authenticated API session.
- Billing and team administration controls are shown only to company owners/admins; manager access is read-only where supported.

## Super Admin
- Path: `apps/super-admin`
- Sign-in: platform administrator credentials via `POST /admin/auth/login`
- Workspace: platform overview, company lifecycle, subscription plans, subscription assignment and invoices
- Platform roles are enforced again by the API. Hiding a control in the browser is not an authorization boundary.
- Platform tokens expire after 15 minutes; sign in again when expired.

## Deploy as separate Vercel projects
Create two separate Vercel projects from the same GitHub repository:

| Vercel project | Root directory | Build command | Output directory |
|---|---|---|---|
| ARA Company CRM | `apps/company-crm` | None (static) | `.` |
| ARA Super Admin | `apps/super-admin` | None (static) | `.` |

Each app's `config.js` contains the API base URL. Set it to the deployed HTTPS ARA API origin before deploying. Do not put API secrets, provider access tokens, encryption keys, payment secrets or database credentials in either frontend.

On the API host, set:
- `ARA_CRM_ORIGIN=https://<your-company-crm-domain>`
- `ARA_ADMIN_ORIGIN=https://<your-super-admin-domain>`

The API keeps `DASHBOARD_ORIGIN` as a compatibility allow-list for the earlier dashboard. Multiple comma-separated origins are supported. Deploy the API first, then both frontends, then verify sign-in and authenticated API calls from each origin.

## Security notes
- Access and refresh tokens are held in browser `sessionStorage` and cleared on sign-out.
- Company CRM calls use company endpoints only; the agency ID is never supplied by the browser for tenant-scoped billing or knowledge access.
- Super Admin endpoints require the separate platform token and server-side role checks.
- Payment callbacks are server-to-server signed events; payment secrets and provider credentials never belong in frontend code.
- Use HTTPS for both frontend domains and the API. Configure the API CORS origins exactly; do not use wildcard origins with bearer tokens.
