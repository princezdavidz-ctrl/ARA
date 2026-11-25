const { Pool } = require('pg');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to apply ARA migrations.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('ara:migration:021_email_otp_auth'))");
    await client.query('CREATE TABLE IF NOT EXISTS ara_schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    for (const migrationName of ['021_email_otp_auth.sql', '022_company_branding.sql', '023_supervised_message_approval.sql', '024_company_registration_details.sql', '025_staff_human_support.sql', '026_agency_team_presence.sql', '027_conversation_insights.sql', '028_agency_api_keys.sql', '029_company_password_reset.sql', '030_company_workspace_preferences.sql', '031_reconcile_escalations.sql', '032_africas_talking_sms.sql']) {
      const applied = await client.query('SELECT 1 FROM ara_schema_migrations WHERE name=$1', [migrationName]);
      if (!applied.rowCount) {
        const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', migrationName), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO ara_schema_migrations(name) VALUES($1)', [migrationName]);
        process.stdout.write('Applied ' + migrationName + '\\n');
      } else {
        process.stdout.write(migrationName + ' already applied\\n');
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  process.stderr.write('ARA migration failed: ' + (error && error.message ? error.message : String(error)) + '\\n');
  process.exitCode = 1;
});
