# Provider and Research Boundary

SamQuant is limited to bounded historical research. API models reject unknown
fields and accept only `mode=historical_research`; broker credentials, live-order
instructions, user risk profiles, and personalised-advice inputs are outside the
contract. Expanding that boundary requires legal and security review plus an
explicit code and documentation change.

Yahoo access is production-disabled unless both `SAMQUANT_ENABLE_YAHOO=true` and
`SAMQUANT_DATA_PROVIDER_APPROVED=true` are present. The approval owner must record
the provider terms, permitted users, caching and redistribution limits, attribution,
commercial-use position, review date, and evidence before setting that flag.
