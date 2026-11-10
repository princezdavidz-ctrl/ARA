import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AraUser } from './auth.guard';
import { PlatformAdmin } from './platform-admin.guard';

const COST_SQL = "CASE WHEN metadata->>'estimatedCostUsd' ~ '^[0-9]+(\\.[0-9]+)?$' THEN (metadata->>'estimatedCostUsd')::numeric ELSE 0 END";

@Injectable()
export class AiUsageService {
  constructor(private readonly db: DatabaseService) {}

  private range(daysValue: unknown): number {
    const days = Number(daysValue ?? 30);
    return Number.isInteger(days) && days >= 1 && days <= 90 ? days : 30;
  }

  async tenantDashboard(user: AraUser, daysValue: unknown) {
    const days = this.range(daysValue);
    const [totals, daily, models, operations] = await Promise.all([
      this.db.query<any>(`SELECT
        COALESCE(sum(quantity) FILTER(WHERE metric='token_input'),0)::text AS "inputTokens",
        COALESCE(sum(quantity) FILTER(WHERE metric='token_output'),0)::text AS "outputTokens",
        COALESCE(sum(${COST_SQL}) FILTER(WHERE metric IN ('token_input','token_output')),0)::text AS "estimatedCostUsd",
        count(*) FILTER(WHERE metric IN ('token_input','token_output'))::int AS "usageEvents",
        count(*) FILTER(WHERE metric IN ('token_input','token_output') AND metadata->>'estimatedCostUsd' IS NULL)::int AS "unpricedEvents",
        count(*) FILTER(WHERE metric IN ('token_input','token_output') AND metadata->>'estimatedCostUsd' IS NULL)::int AS "unpricedEvents",
        count(DISTINCT metadata->>'model') FILTER(WHERE metric IN ('token_input','token_output'))::int AS "modelsUsed"
        FROM usage_records WHERE agency_id=$1 AND occurred_at>=now()-($2::text||' days')::interval`,
        [user.agencyId, days]),
      this.db.query<any>(`SELECT date_trunc('day',occurred_at)::date::text AS day,
        COALESCE(sum(quantity) FILTER(WHERE metric='token_input'),0)::text AS "inputTokens",
        COALESCE(sum(quantity) FILTER(WHERE metric='token_output'),0)::text AS "outputTokens",
        COALESCE(sum(${COST_SQL}) FILTER(WHERE metric IN ('token_input','token_output')),0)::text AS "estimatedCostUsd"
        FROM usage_records WHERE agency_id=$1 AND occurred_at>=now()-($2::text||' days')::interval
        AND metric IN ('token_input','token_output') GROUP BY 1 ORDER BY 1`,
        [user.agencyId, days]),
      this.db.query<any>(`SELECT COALESCE(metadata->>'model','unknown') AS model,
        COALESCE(sum(quantity) FILTER(WHERE metric='token_input'),0)::text AS "inputTokens",
        COALESCE(sum(quantity) FILTER(WHERE metric='token_output'),0)::text AS "outputTokens",
        COALESCE(sum(${COST_SQL}) FILTER(WHERE metric IN ('token_input','token_output')),0)::text AS "estimatedCostUsd"
        FROM usage_records WHERE agency_id=$1 AND occurred_at>=now()-($2::text||' days')::interval
        AND metric IN ('token_input','token_output') GROUP BY 1 ORDER BY sum(${COST_SQL}) DESC`,
        [user.agencyId, days]),
      this.db.query<any>(`SELECT COALESCE(metadata->>'operation',metadata->>'tokenType',metric) AS operation,
        COALESCE(sum(quantity),0)::text AS tokens,
        COALESCE(sum(${COST_SQL}),0)::text AS "estimatedCostUsd"
        FROM usage_records WHERE agency_id=$1 AND occurred_at>=now()-($2::text||' days')::interval
        AND metric IN ('token_input','token_output') GROUP BY 1 ORDER BY sum(quantity) DESC`,
        [user.agencyId, days]),
    ]);
    return { periodDays: days, currency: 'USD', totals: totals.rows[0], daily: daily.rows, models: models.rows, operations: operations.rows };
  }

  async platformDashboard(admin: PlatformAdmin, daysValue: unknown) {
    if (!['super_admin','billing_admin','platform_support','security_auditor'].includes(admin.role)) {
      throw new ForbiddenException('Insufficient platform role to view AI usage analytics');
    }
    const days = this.range(daysValue);
    const [totals, tenants, models, daily] = await Promise.all([
      this.db.query<any>(`SELECT
        count(DISTINCT agency_id) FILTER(WHERE metric IN ('token_input','token_output'))::int AS "activeTenants",
        COALESCE(sum(quantity) FILTER(WHERE metric='token_input'),0)::text AS "inputTokens",
        COALESCE(sum(quantity) FILTER(WHERE metric='token_output'),0)::text AS "outputTokens",
        COALESCE(sum(${COST_SQL}) FILTER(WHERE metric IN ('token_input','token_output')),0)::text AS "estimatedCostUsd",
        count(*) FILTER(WHERE metric IN ('token_input','token_output'))::int AS "usageEvents"
        FROM usage_records WHERE occurred_at>=now()-($1::text||' days')::interval`, [days]),
      this.db.query<any>(`SELECT a.id AS "agencyId",a.name AS "companyName",
        COALESCE(sum(u.quantity) FILTER(WHERE u.metric='token_input'),0)::text AS "inputTokens",
        COALESCE(sum(u.quantity) FILTER(WHERE u.metric='token_output'),0)::text AS "outputTokens",
        COALESCE(sum(${COST_SQL}) FILTER(WHERE u.metric IN ('token_input','token_output')),0)::text AS "estimatedCostUsd"
        FROM usage_records u JOIN agencies a ON a.id=u.agency_id
        WHERE u.occurred_at>=now()-($1::text||' days')::interval AND u.metric IN ('token_input','token_output')
        GROUP BY a.id,a.name ORDER BY sum(${COST_SQL}) DESC LIMIT 100`, [days]),
      this.db.query<any>(`SELECT COALESCE(metadata->>'model','unknown') AS model,
        COALESCE(sum(quantity) FILTER(WHERE metric='token_input'),0)::text AS "inputTokens",
        COALESCE(sum(quantity) FILTER(WHERE metric='token_output'),0)::text AS "outputTokens",
        COALESCE(sum(${COST_SQL}),0)::text AS "estimatedCostUsd"
        FROM usage_records WHERE occurred_at>=now()-($1::text||' days')::interval
        AND metric IN ('token_input','token_output') GROUP BY 1 ORDER BY sum(${COST_SQL}) DESC`, [days]),
      this.db.query<any>(`SELECT date_trunc('day',occurred_at)::date::text AS day,
        COALESCE(sum(quantity) FILTER(WHERE metric='token_input'),0)::text AS "inputTokens",
        COALESCE(sum(quantity) FILTER(WHERE metric='token_output'),0)::text AS "outputTokens",
        COALESCE(sum(${COST_SQL}),0)::text AS "estimatedCostUsd"
        FROM usage_records WHERE occurred_at>=now()-($1::text||' days')::interval
        AND metric IN ('token_input','token_output') GROUP BY 1 ORDER BY 1`, [days]),
    ]);
    return { periodDays: days, currency: 'USD', totals: totals.rows[0], tenants: tenants.rows, models: models.rows, daily: daily.rows };
  }
}
