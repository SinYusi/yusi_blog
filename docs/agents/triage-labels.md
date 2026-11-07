# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

이 저장소에서는 `/triage`로 이슈를 분류할 때만 이 라벨을 붙인다. 범위가 정해진 채로 만드는 이슈(CLAUDE.md Workflow)에는 붙이지 않고, 기존 라벨(`enhancement`, `bug`, `documentation` 등)과 마일스톤을 그대로 쓴다. `ready-for-agent`는 질문 없이 Claude(또는 시험 중인 Codex 위임)에게 바로 맡길 수 있을 만큼 구체화됐다는 뜻이다.

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the "Label in our tracker" column to match whatever vocabulary you actually use.
