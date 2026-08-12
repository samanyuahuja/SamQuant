# Security Operations

## Deployment controls

- Set the same random `SAMQUANT_INTERNAL_API_KEY` on the Next.js and FastAPI
  deployments. Never use a `NEXT_PUBLIC_` variable for it.
- Set `ENVIRONMENT=production` and `SAMQUANT_RESEARCH_ONLY=true` on FastAPI.
- Keep `SAMQUANT_ENABLE_YAHOO` and `SAMQUANT_DATA_PROVIDER_APPROVED` unset until
  provider terms and the intended production use have written approval.
- Apply Cloudflare or Vercel rate limits to `/api/backtests`; application limits
  are a second layer, not a distributed edge control.
- Alert on 401, 429, and 5xx spikes, latency, request volume, and compute spend.
  Configure platform spending limits and automatic notifications.

## Incident and restore

Contain at the edge, rotate the internal key, stop the affected deployment,
preserve non-sensitive logs, and redeploy the latest known-good commit. Quarterly,
restore into a clean environment and verify direct FastAPI calls fail, the web
proxy succeeds, rate limits return 429, Yahoo remains disabled, and rollback
completes within the documented recovery objective.

No code change can enable GitHub push protection, protected branches, Vercel
budgets, or Cloudflare distributed rules. Repository and platform administrators
must enable and test those controls in their respective dashboards.
