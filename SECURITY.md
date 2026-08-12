# Security Policy

Report vulnerabilities privately through GitHub's security advisory feature.
Do not place secrets, provider credentials, or working exploit details in an
issue. The supported surface is the current production deployment.

Production requires a strong `SAMQUANT_INTERNAL_API_KEY` shared only by the
Next.js server and FastAPI service, plus `SAMQUANT_RESEARCH_ONLY=true`. The
FastAPI service must sit behind platform access controls and must not be treated
as a public browser API.
