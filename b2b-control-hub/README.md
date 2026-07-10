# B2B Control Hub

A local-first system for controlling B2B contractor billing: registries of
contracts, annexes and invoices, **automated compliance checks**, **AI document
reading** (PDF / scans), and a **legal-risk analysis** of contracts. All data
stays on the machine it runs on — the database is a single SQLite file.

Built as a real, runnable application (not a click-through mock): every button
calls a real API backed by a real database.

> UI and code comments are in Polish (built for the Polish SMB / insurance
> market). This README is the English overview. Install guide: [INSTALL.md](INSTALL.md).

## The problem it solves

When a company works with many B2B contractors, someone has to check every
incoming invoice against the current contract — including all its annexes:
right rate? within the hour limit? correct bank account? within the contract
period? amount = hours × rate? This is slow, manual and error-prone. The Hub
does the checking and routes each invoice to a human decision **with an audit
trail** — it never pays anything by itself.

## Features

- **Registries** — contractors, contracts, annexes, invoices (persistent).
- **Consolidated contract view** — each annex builds a new "single text";
  the engine always evaluates against the terms in force on the invoice date.
- **Compliance engine (7 rules)** — link to contract, period, rate-after-annexes,
  hour limit, net amount, bank account, approver → verdict: OK / needs review /
  **held (non-compliant)**, with the exact reasons.
- **AI document reading** — upload a contract or invoice (**PDF incl. scans**,
  .docx, .txt); AI fills the form; the human verifies and saves. Missing fields
  are flagged ("not read: …") instead of guessed. Never auto-saves.
- **Legal analysis** — checks a B2B contract for *signs of an employment
  relationship* (Polish Labour Code art. 22): 10 criteria, a risk score, and a
  literal quote from the contract for each finding. Stored for later review.
- **Decision log** — every approval/rejection is recorded with who, when, why.
- **Packaging** — one command builds a clean, installable package for a client.

## Architecture

```
browser (public/index.html)      ← UI: renders + calls the API
        │  fetch /api/...
server  (server.mjs)             ← logic: validation, control engine, AI calls
        │
database (db.mjs → data/hub.db)  ← SQLite, one file on disk
```

- **Swappable AI layer** — `extract/`, `extract-umowa/`, `analiza-etat/` each
  expose providers (`claude` / `demo`; invoices also `azure`) behind one factory,
  selected by config. API key / provider live in `config.json`; environment
  variables take precedence.
- **Shared control engine** — one deterministic source of truth
  (`extract/control-engine.mjs`), reused across the app.

## Tech stack

Node.js (ESM), built-in `node:sqlite` and `node:http` (zero-dependency backend),
Anthropic API (structured outputs / JSON schema) for extraction and analysis,
`mammoth` for .docx. No web framework — deliberately, to keep it transparent and
easy to hand over to a client's IT.

## Run it

```bash
# Requires Node.js 22.5+ (built-in SQLite). No API key needed for demo mode.
cp config.example.json config.json     # set "provider": "demo" to run without AI
node b2b-hub/server.mjs                 # → http://localhost:5180
```

With an Anthropic API key in `config.json` (`"provider": "claude"`), the
document-reading and legal-analysis features are enabled. Build a client
package: `node b2b-hub/zbuduj-paczke.mjs` → `dist/b2b-control-hub/`.

## What this project demonstrates

- Turning a prototype into a **working 3-tier application** (UI / API / DB).
- **LLM integration** with structured outputs, a **swappable provider**
  architecture, and a human-in-the-loop design (AI assists, never decides).
- Real **domain modelling** (contracts → annexes → effective terms → invoice
  control) and a deterministic rules engine kept separate from the AI.
- Packaging software for **on-premise, privacy-sensitive deployment**.

---

*All sample data in this repository is fictional. Built by Krzysztof Pełka as
part of a career move into AI automation for business — [UlepszFirme.pl](https://ulepszfirme.pl).*
