{
  "$schema": "https://opencode.ai/config.json",

  // Default model (used when an agent has no explicit override)
  "model": "openai/gpt-5.3-codex",

  // Lightweight model for title/utility tasks
  "small_model": "github-copilot/gpt-5-mini",

  // Start with BMAD orchestrator by default
  "default_agent": "bmad-master",

  // Global BMAD + OpenCode behavior rules
  "instructions": [".opencode/rules/bmad-opencode.md"],

  // MCP servers (auto-started by OpenCode; packages fetched by npx on first use)
  "mcp": {
    "grep_app": {
      "type": "local",
      "command": ["npx", "-y", "grep-mcp"],
      "enabled": true
    },
    "ast_grep": {
      "type": "local",
      "command": ["npx", "-y", "@notprolands/ast-grep-mcp"],
      "enabled": true
    },
    "context7": {
      "type": "local",
      "command": ["npx", "-y", "@upstash/context7-mcp"],
      "enabled": true
    },
    "websearch_exa": {
      "type": "local",
      "command": ["npx", "-y", "exa-mcp-server"],
      "environment": {
        "EXA_API_KEY": "${EXA_API_KEY}"
      },
      "enabled": true
    }
  },

  "agent": {
    // Built-in primary/sub agents
    "build": { "model": "github-copilot/claude-opus-4.6" },
    "plan": { "model": "openai/gpt-5.3-codex" },
    "explore": { "model": "github-copilot/gpt-5-mini" },
    "general": { "model": "github-copilot/gpt-5-mini" },
    "compaction": { "model": "github-copilot/gpt-5-mini" },
    "summary": { "model": "github-copilot/gpt-5-mini" },
    "title": { "model": "github-copilot/gpt-5-mini" },

    // BMAD/BMM/TEA/CIS agents in this repo
    "bmad-master": {
      "model": "openai/gpt-5.3-codex",
      "mode": "primary",
      "description": "Only BMAD orchestrator: routes all specialist work to dedicated subagents and uses the question tool for interaction.",
      "permission": {
        "task": {
          "*": "deny",
          "architect": "allow",
          "dev": "allow",
          "qa": "allow",
          "pm": "allow",
          "analyst": "allow",
          "sm": "allow",
          "ux-designer": "allow",
          "quick-flow-solo-dev": "allow",
          "tech-writer": "allow",
          "tea": "allow",
          "design-thinking-coach": "allow",
          "innovation-strategist": "allow",
          "storyteller": "allow",
          "presentation-master": "allow",
          "brainstorming-coach": "allow",
          "creative-problem-solver": "allow"
        },
        "question": "allow",
        "read": "allow",
        "glob": "allow",
        "grep": "allow",
        "bash": "allow",
        "edit": "allow",
        "write": "allow",
        "webfetch": "allow",
        "context7_resolve-library-id": "allow",
        "context7_query-docs": "allow",
        "codesearch": "allow",
        "websearch": "allow",
        "skill": "allow",
        "todowrite": "allow",
        "doom_loop": "ask"
      },
      "prompt": "Operate in orchestrator mode by default: run a concise alignment dialog, delegate implementation/research to subagents via task tool, synthesize results. Detect independent workstreams and dispatch them as parallel fan-out Task tool calls in the same response; after all return, produce a unified fan-in synthesis — reconcile overlaps, flag conflicts/gaps, present one coherent result. When a subagent result surfaces a blocker or new analysis need, spawn targeted follow-up subagent tasks (dynamic re-orchestration) before escalating to user — escalate only for approval-gated, irreversible, or authority-required decisions. Use adaptive questioning strategy -- bundle independent questions in one call to reduce round-trips, choose single-select vs multi-select by decision shape, and always keep the question tool free-text input enabled. After plan alignment and explicit user approval, execute autonomously with milestone-only check-ins (Hive P2: Plan->Approve->Execute). At milestones report dispatched agents, parallelism structure, fan-in decisions, follow-up tasks, and assumptions. All repo-local bash operations (git, cargo, tests, builds, linting) proceed without permission pauses. Use /tmp as scratch area for temporary out-of-repo artifacts. Never force-push or run destructive irreversible commands without explicit confirmation. Pre-send output gate: before finalizing any turn, self-audit for solicitation language (choose/select/confirm/next action) — if present and no question tool call was made in this response, invoke the question tool immediately; solicitation-only endings are a hard protocol violation."
    },
    "architect": { "model": "openai/gpt-5.3-codex", "mode": "subagent", "permission": { "task": { "*": "deny" }, "question": "allow", "bash": "allow", "edit": "allow", "write": "allow", "read": "allow", "glob": "allow", "grep": "allow", "context7_resolve-library-id": "allow", "context7_query-docs": "allow", "codesearch": "allow", "websearch": "allow" } },
    "dev": { "model": "github-copilot/claude-opus-4.6", "mode": "subagent", "permission": { "task": { "*": "deny" }, "question": "allow", "bash": "allow", "edit": "allow", "write": "allow", "read": "allow", "glob": "allow", "grep": "allow", "context7_resolve-library-id": "allow", "context7_query-docs": "allow", "codesearch": "allow", "websearch": "deny" } },
    "qa": { "model": "github-copilot/claude-sonnet-4.6", "mode": "subagent", "permission": { "task": { "*": "deny" }, "question": "allow", "bash": "allow", "edit": "allow", "write": "allow", "read": "allow", "glob": "allow", "grep": "allow", "context7_resolve-library-id": "allow", "context7_query-docs": "allow", "codesearch": "allow", "websearch": "allow" } },
    "pm": { "model": "openai/gpt-5.3-codex", "mode": "subagent", "permission": { "task": { "*": "deny" }, "question": "allow", "context7_resolve-library-id": "allow", "context7_query-docs": "allow", "codesearch": "allow", "websearch": "allow" } },
    "analyst": { "model": "openai/gpt-5.3-codex", "mode": "subagent", "permission": { "task": { "*": "deny" }, "question": "allow", "context7_resolve-library-id": "allow", "context7_query-docs": "allow", "codesearch": "allow", "websearch": "allow" } },
    "sm": { "model": "openai/gpt-5.3-codex", "mode": "subagent", "permission": { "task": { "*": "deny" }, "question": "allow", "context7_resolve-library-id": "allow", "context7_query-docs": "allow", "codesearch": "deny", "websearch": "deny" } },
    "ux-designer": { "model": "openai/gpt-5.3-codex", "mode": "subagent", "permission": { "task": { "*": "deny" }, "question": "allow", "context7_resolve-library-id": "allow", "context7_query-docs": "allow", "codesearch": "allow", "websearch": "allow" } },
    "quick-flow-solo-dev": { "model": "github-copilot/claude-opus-4.6", "mode": "subagent", "permission": { "task": { "*": "deny" }, "question": "allow", "bash": "allow", "edit": "allow", "write": "allow", "read": "allow", "glob": "allow", "grep": "allow", "context7_resolve-library-id": "allow", "context7_query-docs": "allow", "codesearch": "allow", "websearch": "allow" } },
    "tech-writer": { "model": "github-copilot/gpt-5-mini", "mode": "subagent", "permission": { "task": { "*": "deny" }, "question": "allow", "context7_resolve-library-id": "allow", "context7_query-docs": "allow", "codesearch": "allow", "websearch": "allow" } },
    "tea": { "model": "github-copilot/claude-opus-4.6", "mode": "subagent", "permission": { "task": { "*": "deny" }, "question": "allow", "bash": "allow", "edit": "allow", "write": "allow", "read": "allow", "glob": "allow", "grep": "allow", "context7_resolve-library-id": "allow", "context7_query-docs": "allow", "codesearch": "allow", "websearch": "allow" } },
    "design-thinking-coach": { "model": "openai/gpt-5.3-codex", "mode": "subagent", "permission": { "task": { "*": "deny" }, "question": "allow", "context7_resolve-library-id": "allow", "context7_query-docs": "allow", "codesearch": "deny", "websearch": "allow" } },
    "innovation-strategist": { "model": "openai/gpt-5.3-codex", "mode": "subagent", "permission": { "task": { "*": "deny" }, "question": "allow", "context7_resolve-library-id": "allow", "context7_query-docs": "allow", "codesearch": "allow", "websearch": "allow" } },
    "storyteller": { "model": "openai/gpt-5.3-codex", "mode": "subagent", "permission": { "task": { "*": "deny" }, "question": "allow", "context7_resolve-library-id": "deny", "context7_query-docs": "deny", "codesearch": "deny", "websearch": "allow" } },
    "presentation-master": { "model": "openai/gpt-5.3-codex", "mode": "subagent", "permission": { "task": { "*": "deny" }, "question": "allow", "context7_resolve-library-id": "allow", "context7_query-docs": "allow", "codesearch": "deny", "websearch": "allow" } },
    "brainstorming-coach": { "model": "openai/gpt-5.3-codex", "mode": "subagent", "permission": { "task": { "*": "deny" }, "question": "allow", "context7_resolve-library-id": "allow", "context7_query-docs": "allow", "codesearch": "deny", "websearch": "allow" } },
    "creative-problem-solver": { "model": "openai/gpt-5.3-codex", "mode": "subagent", "permission": { "task": { "*": "deny" }, "question": "allow", "context7_resolve-library-id": "allow", "context7_query-docs": "allow", "codesearch": "allow", "websearch": "allow" } }
  }
}
 
