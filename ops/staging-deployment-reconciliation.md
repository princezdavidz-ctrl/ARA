# Render staging deployment reconciliation

The Render staging services are configured to auto-deploy commits from `main`, but their recorded deployments remained pinned to commit `3de7d25` after subsequent fixes were merged. This operations note creates a new `main` push event so the configured Render auto-deploy integration can reconcile to the current branch head.

After deployment, verify the API starts with the current migration runner and that the tenant-scoped `escalations` table is available. Verify the Company CRM and Super Admin staging static sites also deploy from the same current `main` head. Do not enable live telecom traffic as part of this staging reconciliation.
