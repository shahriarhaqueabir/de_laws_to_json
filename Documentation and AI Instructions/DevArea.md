

1. System health (is the organism alive?)

This should be visible at a glance, no scrolling.

Backend status
Icon: 🟢 / 🔴
API reachable, database connected, storage responding

AI service status
Icon: 🦙 heartbeat / pulse
Model responding, fallback active, degraded mode flagged

Connection state
Icon: 🔌 plug
Client ↔ backend ↔ AI connectivity

Dependency health
Icon: 🧩
Vector DB, search index, cache, auth service

If any of these go red, everything else is trivia.

2. AI quality & truth signals (is it behaving?)

This is where legal apps live or die.

Hallucination rate (estimated)
% of answers with missing or unverifiable citations

Citation coverage
% of responses that include valid law references (e.g., BGB, StGB, GG)

Fallback frequency
How often the AI says “I’m not sure” or escalates

Confidence vs correctness delta
High confidence + low verification = danger zone

User correction events
How often users flag “this seems wrong”

These are anti-vanity metrics. They protect you from lawsuits and self-delusion.

3. Performance & latency (is it fast enough to feel smart?)

Users forgive uncertainty faster than slowness.

AI response time
p50 / p95 latency

Search vs generation split
Time spent finding law vs explaining it

Cold start frequency
Especially relevant if models scale down

Timeout rate
Silent killers of trust

If legal answers feel slow, users assume incompetence—even if you’re correct.

4. Usage & behavioral signals (how humans actually use it)

Not marketing metrics. Reality metrics.

Query types
Natural language vs law browsing vs follow-ups

Repeat reformulation rate
High = AI didn’t understand the first time

Session depth
Are users drilling deeper or bouncing?

Most viewed laws
Reveals real-world anxiety, not curriculum design

Drop-off points
Where users stop reading or exit

This tells you whether your visual explanations actually work.

5. Failure & edge-case tracking (where reality bites)

You want these visible, not buried in logs.

Connection errors by layer
Client → API → DB → AI

Missing-law errors
AI asked for law text that doesn’t exist or isn’t indexed

Jurisdiction mismatch warnings
User in Bavaria, law from NRW

Stale law warnings
Answer used outdated statute version

Rate-limit events
AI throttling or external service caps

Every one of these is a future bug report waiting to happen.

6. Developer UX extras (quietly powerful)

These don’t show up on product roadmaps but save lives at 3 a.m.

Live request inspector
Prompt → retrieved law → AI output → final response

Explainability trace
Why this law was chosen

Kill switch
Instantly disable AI generation, leave search alive

Degraded mode indicator
“AI explanations disabled — browsing only”

Version pinning visibility
Model version, law dataset version, prompt version

One iron rule for dev dashboards

If a metric doesn’t help you answer “Is the AI lying, slow, or broken?”, it doesn’t belong on the main dev view.