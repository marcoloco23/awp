---
awp: 0.4.0
cdp: '1.0'
type: swarm
id: 'swarm:coverage-sweep-crew'
name: Coverage Sweep Crew
goal: Validate every AWP MCP tool against the live workspace and publish findings
status: active
created: '2026-05-12T16:58:19.913Z'
roles:
  - name: qa-driver
    count: 1
    assigned:
      - 'did:key:z6Mkq5UdbbWW6NGyzJmEZiUNBkz3NWbi3dFuSMqmjsKntg9c'
    minReputation:
      epistemic-hygiene: 0.7
    assignedSlugs:
      - awp-dev
  - name: scribe
    count: 1
    assigned:
      - 'did:key:zScribeBotPlaceholder'
    minReputation:
      documentation: 0.6
    assignedSlugs:
      - scribe-bot
governance:
  humanLead: marc
  vetoPower: true
---

# Coverage Sweep Crew

Validate every AWP MCP tool against the live workspace and publish findings
