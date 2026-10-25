# Execution records and cross-instance handoffs

Read [the plan](../PLAN.md) and [the execution index](../LEDGER.md) before starting work. This ledger preserves observable agent execution history across model instances. It does not store hidden reasoning or replace runtime logs automatically.

## Runs and ownership

- Application run IDs use `phase-XX-YYYYMMDD-NN`, with the date in America/Los_Angeles and a monotonically increasing daily attempt number. Planning-only records use `planning-YYYYMMDD-NN`.
- Create the run directory only when the corresponding work is authorized. A directory name is not authorization.
- Each actual run contains `orchestrator.md`, uniquely named worker records such as `worker-shell.md`, `reviewer.md` for the first review and separate records such as `reviewer-02.md` for additional sessions, and `artifacts/` for sanitized evidence. Do not overwrite earlier reviewer records or create fictitious/blank records that imply a session occurred.
- Each agent owns its own record. The orchestrator owns `plan/LEDGER.md`, shared integration files, and the run's integration summary. Assign artifact names/paths per agent to avoid write collisions.
- Save exact task prompts and authorization text as artifacts or quote them verbatim in the agent record. Record instantiated worker/reviewer prompts, not just a template name. Do not copy internal system/developer instructions into the ledger.
- Preserve prior run directories and findings. On resume, start a linked new run or append a dated continuation to the current agent record. Never delete a failed attempt to make the latest result appear clean.

## Required agent record

Use this structure for each actual agent, filling facts as work proceeds:

```markdown
# <role>: <task>

## Identity and authorization
- Run / phase:
- Agent / parent agent / model identity if exposed:
- Role and authorized task:
- Exact prompt and authorization reference:
- Started at (timezone included):
- Baseline commit, branch, dirty state:
- Owned files and permitted shared interfaces:
- Dependencies and prior handoff:

## Execution events
Append dated entries containing the action, affected paths, command/check,
observed outcome, and evidence link. Record failures and corrective work.
Group routine commands when exact commands and outcomes remain reconstructable.

## Decisions and blockers
Record implementation choices within scope, user-approved changes, missing
hardware/evidence, failed checks, and the concrete next action.

## Handoff
- Completion state and timestamp:
- Changed paths and result commit, or explicit uncommitted state:
- Checks run and results; checks not run and why:
- Artifacts and integration assumptions:
- Remaining work, risks, and next owner:
```

Record command exit codes and concise relevant outcomes. Link retained test output, reports, metrics, and package checksums. A successful build is not a successful real-hardware test. Label evidence `automated`, `replay`, `manual hardware`, or `not run`.

Append corrections with timestamps and refer to the earlier entry. Do not erase prior events. Closing handoffs are snapshots; later continuations append a new handoff.

## Review and status

Use `pending`, `running`, `blocked`, or `complete` in the index. A blocked run identifies exactly what failed or what external evidence is missing. A completed phase requires its mandatory evidence and reviewer disposition. Authorization for the next phase must be separate.

When the user explicitly approves a checkpoint, record that decision in a separate **User approval** field and retain the exact instruction. Approval and empirical verification are distinct: preserve failed/unrun checks and the reviewer disposition instead of relabelling them as passed. The verification-status field keeps the states above.

Before launching any reviewer, check every prior attempt and review for that phase. The [user-approved standing policy](../PLAN.md#reviewer-sessions-and-continuations) permits additional or replacement sessions for phases01–06 on continuation, prior-reviewer unavailability/interruption, or materially changed work needing renewed review. No new per-launch permission question is required within this policy. Prefer the existing session for routine repairs/rechecks when practical.

For every additional session, record its reason, exact assignment, identity/parent, full baseline/change inventory, prior findings/dispositions, evidence, and handoff. Use a unique reviewer record and link it in the index. Interrupted reviews remain in history. A resumed run or new reviewer cannot erase failed checks, replace unresolved findings with an unrelated pass, loosen mandatory criteria, or authorize another application phase. New artifact changes still require affected checks, updated checksums and documented review. [Exact amendment authorization](planning-20261024-03/artifacts/request.md).

The reviewer records inspected changes, findings with affected paths and severity, fixes, checks, unresolved issues, and `pass` or `blocked`. If a runtime cannot expose an agent/model identifier, state `not exposed`; never invent one.

## Privacy and durability

- Store assigned task prompts, observable actions, concise evidence, and handoffs; never hidden reasoning.
- Do not store credentials, raw camera frames, microphone recordings, or unnecessary personal data. Use synthetic landmarks and scripted text for reproducible fixtures.
- Do not persist full voice transcripts or raw tool transcripts by default. Retain only sanitized output needed to support claims. User-provided recordings would require a separate explicit data-handling decision.
- Reference external build artifacts by location and checksum when too large for the repository. Do not commit model binaries, build products, or logs solely for ledger completeness.
- Write a checkpoint before ending a session. If interrupted, the next orchestrator inspects repository state and reconciles it against the last recorded event rather than assuming the handoff was completed.
