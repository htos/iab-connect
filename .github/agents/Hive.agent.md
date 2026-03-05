{
  "$schema": "https://raw.githubusercontent.com/tctinh/agent-hive/main/packages/opencode-hive/schema/agent_hive.schema.json",
  "enableToolsFor": [],
  "disableSkills": [],
  "disableMcps": [],
  "agentMode": "unified",
  "sandbox": "none",
  "agents": {
    "hive-master": {
      "model": "github-copilot/claude-opus-4.6",
      "temperature": 0.5,
      "skills": [
        "brainstorming",
        "writing-plans",
        "dispatching-parallel-agents",
        "executing-plans"
      ],
      "autoLoadSkills": [
        "parallel-exploration"
      ]
    },
    "architect-planner": {
      "model": "github-copilot/gpt-5.2-codex",
      "temperature": 0.7,
      "skills": [
        "brainstorming",
        "writing-plans"
      ],
      "autoLoadSkills": [
        "parallel-exploration"
      ]
    },
    "swarm-orchestrator": {
      "model": "github-copilot/claude-opus-4.6",
      "temperature": 0.5,
      "skills": [
        "dispatching-parallel-agents",
        "executing-plans"
      ],
      "autoLoadSkills": []
    },
    "scout-researcher": {
      "model": "github-copilot/gpt-5.2-codex",
      "temperature": 0.5,
      "skills": [],
      "autoLoadSkills": []
    },
    "forager-worker": {
      "model": "github-copilot/gpt-5.2-codex",
      "temperature": 0.3,
      "autoLoadSkills": [
        "test-driven-development",
        "verification-before-completion"
      ]
    },
    "hygienic-reviewer": {
      "model": "github-copilot/gpt-5.2-codex",
      "temperature": 0.3,
      "skills": [
        "systematic-debugging",
        "code-reviewer"
      ],
      "autoLoadSkills": []
    }
  }
}
