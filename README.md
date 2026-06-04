# Axiom Red-Team

> An autonomous, AI-powered red-team operator that actually executes commands —
> not just suggests them.

Axiom Red-Team is a full-stack offensive-security app that gives an LLM operator
direct access to a real Linux shell with **40+ pentest tools pre-installed**
(`nmap`, `nikto`, `whatweb`, `sqlmap`, `gobuster`, `hydra`, `john`, `hashcat`,
`dig`, `masscan`, `nc`, `dirb`, `wfuzz`, `smbclient`, `ldap`, `snmp`, `curl`,
`openssl`, the full SecLists wordlist tree, and more). The AI can plan a recon
or exploitation operation, emit a real shell command, the runtime executes it
against any target, and the output is fed back into the next conversational
turn — fully closed-loop.

Originally cloned from
[`dastranger1337/AxiomRed-9b04ri`](https://github.com/dastranger1337/AxiomRed-9b04ri).
This fork swaps the upstream Piston / Wandbox sandbox for a **local container
shell** runtime, and adds a complete FastAPI backend, the Emergent Universal
LLM key, custom OpenAI-compatible passthrough, autonomous god-mode, and more.

---

## Features

### Three ways to drive a command
| Caller | How it works |
|---|---|
| **Terminal tab** | Type a command, hit RUN, see output streamed back. Direct call to `POST /api/exec`. |
| **Chat AUTO-EXEC** | The AI emits a bash code block in chat → frontend extracts it → posts to `/api/exec` → output fed back to the LLM as the next user message. Closed loop, capped at 3 hops (∞ when god mode is on). |
| **Agent runner** | Recon / Exploit / Post-Exploit / Evasion / Full-Chain agents generate a structured plan via `POST /api/functions/v1/axiom-agent` then execute each step through the same `/api/exec`. |
| **God Function (`/api/god`)** | Free-form intent → autonomous plan→exec→analyze loop streamed as SSE. Fully unrestricted. |

### AI engines (toggle in chat header)
- **Emergent Universal LLM key** (default) — Claude Sonnet 4.5 / Haiku 4.5 via
  `emergentintegrations`.
- **Custom OpenAI-compatible** — paste any base URL + key + model
  (OpenAI, Groq, Mistral, Together, OpenRouter, Ollama, LM Studio, vLLM, …)
  in the Config tab. Streamed passthrough.

### God user + god mode
- **God user:** type `AXIOM-ASCEND-OMNIPOTENT-1337` (or `ASCEND-AXIOM-ROOT`
  or `GODMODE-AXIOM-2026`) as the password with any email → bypass Supabase
  auth entirely, drop into a synthetic `god@axiom.local` session.
- **God mode toggle** in Config → strips all system-prompt restrictions,
  lifts the auto-exec hop cap to 999, removes the client-side LLM timeout,
  unlocks `/api/god`.

### Self-test
- `GET /api/selftest` runs all 38 tools through the same `/api/exec` pipeline
  in parallel (~2.7 s) and returns a green/red pass report. The same code path
  is used by chat, terminal and agents, so a green selftest = all three work.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND  (Expo / React-Native-Web — static export)        │
│  /app/frontend/                                             │
│  Served by /app/frontend/serve-dist.js on port 3000         │
│                                                             │
│   • Chat tab    → /api/chat        (SSE)                    │
│   • Terminal    → /api/exec                                 │
│   • Agents      → /api/functions/v1/axiom-agent + /api/exec │
│   • God Func    → /api/god         (SSE autonomous loop)    │
│   • Config      → /api/functions/v1/get-secrets, prompts    │
│   • Build       → embeds full source + AI rewrite artifact  │
│   • Login       → Supabase (OnSpace) OR god bypass          │
└───────────────────────────┬─────────────────────────────────┘
                            │ /api/* (k8s ingress)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND  (FastAPI + uvicorn)                               │
│  /app/backend/server.py    — port 8001                      │
│                                                             │
│   /api/health        runtime heartbeat                      │
│   /api/exec          execute code in container shell        │
│   /api/chat          SSE chat (Emergent or custom OpenAI)   │
│   /api/selftest      parallel 38-tool smoke test            │
│   /api/tools         which CLI tools are on PATH            │
│   /api/tools/install force-rerun the apt installer          │
│   /api/god           autonomous plan→exec→analyze (SSE)     │
│   /api/functions/v1/axiom-agent   structured agent planner  │
│   /api/functions/v1/axiom-attack  structured attack planner │
│   /api/functions/v1/axiom-chat    legacy chat alias         │
│   /api/functions/v1/code-exec     legacy exec alias         │
│   /api/functions/v1/get-secrets   real runtime config       │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  RUNTIME  (this container's bash)                           │
│  /app/runtime_workspace/run-<uuid>/   per-execution scratch │
│                                                             │
│   nmap (wrapped: --unprivileged auto-injected)              │
│   sqlmap (wrapped: --batch auto-injected)                   │
│   ssh/scp/sftp (wrapped: BatchMode + accept-new)            │
│   ftp (wrapped: -n -p -v)                                   │
│   sudo (no-op — already root)                               │
│   + all standard pentest tooling                            │
│                                                             │
│  All wrappers + tools auto-installed at startup via         │
│  /app/backend/install_tools.sh (idempotent, flock-guarded). │
└─────────────────────────────────────────────────────────────┘
```

---

## Project layout

```
/app
├── README.md                 ← you are here
├── LICENSE
├── .gitignore
├── .emergent/                ← Emergent platform metadata
├── memory/
│   └── PRD.md                ← product requirements / decision log
│
├── backend/                  ← FastAPI runtime
│   ├── server.py             (~900 lines, all endpoints)
│   ├── install_tools.sh      (idempotent apt + SecLists installer)
│   ├── requirements.txt
│   └── .env                  (MONGO_URL, EMERGENT_LLM_KEY, DB_NAME, …)
│
└── frontend/                 ← Expo / React-Native-Web
    ├── app/                  (expo-router screens)
    │   ├── login.tsx
    │   ├── _layout.tsx
    │   ├── profile.tsx
    │   └── (tabs)/
    │       ├── _layout.tsx
    │       ├── index.tsx        ← Chat
    │       ├── terminal.tsx     ← Terminal
    │       ├── agents.tsx       ← Agent runner
    │       ├── ops.tsx          ← Saved attacks / ops
    │       ├── intel.tsx        ← MITRE intel + playbooks
    │       ├── files.tsx        ← Files browser
    │       ├── config.tsx       ← Settings + GOD MODE toggle
    │       └── build.tsx        ← Source export + AI rewrite artifact
    │
    ├── components/
    │   ├── build/ArtifactRewritePanel.tsx
    │   ├── chat/                 (MessageBubble, TTPTracker, …)
    │   └── ui/
    │
    ├── services/                 (business logic)
    │   ├── aiService.ts          (chat streaming, custom provider, god mode)
    │   ├── autoExec.ts           (code-block extraction + /api/exec wrapper)
    │   ├── godUser.ts            (login bypass + god mode flag)
    │   ├── selfUpdateService.ts  (system prompt, KB, custom AI provider)
    │   ├── sessionStorage.ts
    │   ├── executionLog.ts
    │   └── attackStorage.ts
    │
    ├── hooks/                    (useChat, useChatContext)
    ├── contexts/                 (ChatContext)
    ├── constants/                (theme, mitre, prompts)
    ├── template/                 (auth + UI primitives)
    ├── serve-dist.js             (tiny static server for the built dist)
    ├── app.json
    ├── package.json
    ├── tsconfig.json
    ├── babel.config.js
    └── .env                      (EXPO_PUBLIC_* runtime URLs + Supabase)
```

---

## Setup

### Prereqs
- Linux container (the runtime expects `/usr/bin`, `apt-get`, `bash`).
- Python 3.11+
- Node 20+ and `yarn`
- (Optional) MongoDB if you want execution-log persistence beyond AsyncStorage.

### 1 — Backend
```bash
cd backend
pip install -r requirements.txt
# Edit backend/.env if you want a different LLM key / model
bash install_tools.sh                    # installs the full red-team tool surface
uvicorn server:app --host 0.0.0.0 --port 8001
```

The first request to `/api/exec` or `/api/selftest` will trigger
`install_tools.sh` automatically if any tool is missing (idempotent + locked
so reload children don't race).

### 2 — Frontend
```bash
cd frontend
yarn install
# Edit frontend/.env — set EXPO_PUBLIC_AXIOM_RUNTIME_URL to point at your backend.
CI=true yarn build:web                   # exports to ./dist
node serve-dist.js                       # serves dist on :3000
```

Or, for dev mode with hot-reload (requires high inotify limits):
```bash
yarn expo-start --web --port 3000
```

### 3 — Open the app
- http://localhost:3000
- Login screen will appear. Either:
  - Use your OnSpace Supabase account, **or**
  - Type any email + password `AXIOM-ASCEND-OMNIPOTENT-1337` to enter as the
    god user (no Supabase round-trip).

---

## Verification

Hit the self-test endpoint to confirm everything is green:

```bash
curl -s http://localhost:8001/api/selftest | python3 -m json.tool
```

Expected:
```json
{
  "summary": {"total": 38, "passed": 38, "failed": 0, "pass_rate": 100.0},
  "results": [
    {"tool": "nmap", "ok": true, "exitCode": 0, "durationMs": 73, …},
    {"tool": "sqlmap", "ok": true, "exitCode": 0, "durationMs": 412, …},
    …
  ]
}
```

A real end-to-end test:
```bash
curl -s -X POST http://localhost:8001/api/exec \
  -H 'Content-Type: application/json' \
  -d '{"language":"bash","code":"nmap -F scanme.nmap.org","timeout":30}' \
  | python3 -m json.tool
```

Should return real port-scan output for 22/ssh and 80/http.

---

## Environment variables

### Backend (`backend/.env`)
| Var | Purpose | Default |
|---|---|---|
| `MONGO_URL` | Mongo connection string (optional, for future persistence) | `mongodb://localhost:27017` |
| `DB_NAME` | Mongo DB name | `axiom_redteam` |
| `EMERGENT_LLM_KEY` | Universal LLM key for Emergent-managed calls | provided |
| `DEFAULT_LLM_PROVIDER` | Default emergent integration provider | `anthropic` |
| `DEFAULT_LLM_MODEL` | Default LLM model id | `claude-sonnet-4-5-20250929` |
| `EXEC_TIMEOUT_SECONDS` | Default `/api/exec` timeout | `120` |

### Frontend (`frontend/.env`)
| Var | Purpose |
|---|---|
| `EXPO_PUBLIC_AXIOM_RUNTIME_URL` | URL of the FastAPI backend (this is the runtime!) |
| `EXPO_PUBLIC_SUPABASE_URL` | OnSpace Supabase URL (login only) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | OnSpace Supabase anon JWT |

---

## Tools installed at runtime

`install_tools.sh` (idempotent) installs everything below on every backend
boot, because Kubernetes containers have ephemeral `/usr` between restarts.

**Network / recon:** nmap, masscan, nikto, whatweb, sqlmap, gobuster, dirb,
wfuzz, dig, whois, nc, ncat, traceroute, curl, wget, openssl, jq

**Auth / passwords:** hydra, john, hashcat (+ 14.3M-line rockyou.txt
extracted from SecLists)

**Service clients:** smbclient, enum4linux, ldap-utils, snmp, ftp,
telnet, openssh-client

**Wordlists:** Debian `dirb/common.txt`, full SecLists tree at
`/opt/SecLists/` (symlinked into `/usr/share/wordlists/seclists/`),
metasploit-style users + passwords lists.

**Languages:** python3 + requests + bs4 + dnspython, node, go, ruby, perl

**Utilities:** unzip, zip, tree, file, binutils, xxd, exiftool, sudo

**Wrappers (in `/usr/local/bin/`):**
- `nmap` → auto-injects `--unprivileged` (raw sockets are blocked in
  the container)
- `sqlmap` → auto-injects `--batch` (never blocks on prompts)
- `ssh`/`scp`/`sftp` → `BatchMode=yes`, `StrictHostKeyChecking=accept-new`
- `ftp` → `-n -p -v`

---

## Legal / ethics

This is an offensive-security tool. Authorized use only. Every command
the runtime executes leaves logs in your own container. You are
responsible for ensuring you have written permission to test every
target you point this at. The God-Mode prompt assumes operator
authorization is established by the act of toggling god mode — meaning
**you** confirm authorization, not the AI.

Don't be the reason someone gets a `403`.

---

## License

MIT. See [LICENSE](LICENSE).
