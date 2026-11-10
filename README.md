# Peten rauta ja romu: email reply assistant

Prototype and test set for an assistant that triages customer emails for a fictional hardware store and drafts replies to three routine questions. A staff member checks and sends every reply. Built for a university course (AI in Business Applications, University of Oulu). All data is synthetic.

> **Fictional store, no affiliation.** "Peten rauta ja romu" is invented. It is not connected to K-Rauta, Kesko or any other company. The repo uses no logos, names, images or texts from any retailer. The blue (`#0B65AF`), yellow (`#FBEB23`) and near-black (`#060708`) are approximate values from a third-party colour listing, not from official brand guidelines, and serve only as a colour scheme.

## What the assistant does

| Routine (draft written) | Not routine (sent to an owner, no draft) |
|---|---|
| Opening hours, including holidays | Returns, complaints, warranty |
| Stock status of a named product | Prices, discounts, invoices |
| Delivery time of an order-only item | Product advice, technical questions |
| | Any email that mixes routine and non-routine questions |

Output is a fixed block: `CATEGORY`, `REASON`, `ESCALATE_TO`, `DRAFT`, `SOURCES`, `VERIFY`. Email text is treated as data, so instructions inside an email are ignored.

## Layout

```
index.html, style.css, app.js   Static site with tabs: overview, chat, tests, prompt, documents, results
chat.js, chat.css               Chat tab (customer view and staff view)
demo-engine.js                  Rule-based stand-in for the assistant, used by the chat tab by default
config.js                       Chat settings: optional apiUrl for your own test environment
prompts/system-prompt-v1.md     System prompt, version 1
data/                           Opening hours, stock list, delivery rules, escalation rules
tests/test-emails.json          20 invented test emails with expected results
tools/new_run.py                Creates an empty run file for pasting outputs
tools/score.py                  Scores a run and updates results/index.json
results/                        Logged runs (empty until the group makes real runs)
docs/build-log.md               Targets, setup, change log
```

## Chat tab

The "Kokeile chättiä" tab has a customer chat and a staff view next to it. The staff view shows the output block (category, reason, owner, draft, sources, VERIFY) for the last message. Each message is handled as a separate email, so the chat has no memory. The handoff text for non-routine messages is a fixed template in `demo-engine.js`. It names the owner and promises no time, price or outcome.

**Default: demo engine.** With no setup the tab runs `demo-engine.js`, a keyword rule engine that applies the same policy as the system prompt. It is not an AI model. It was written with the 20 test emails in view, so its results on them say nothing about the real assistant. Do not log its answers in `results/`.

**Your own test environment.** Set `apiUrl` in `config.js` and the tab posts each message there instead:

```
POST  { "subject": "", "body": "customer message" }
200   { "output": "CATEGORY: ...\nREASON: ...\nESCALATE_TO: ...\nDRAFT: ...\nSOURCES: ...\nVERIFY: ..." }
```

The endpoint must allow CORS from the site's origin. Do not put API keys in `config.js`, because the repo is public. Keep keys on a server or proxy you control. `[NAME]` and `[AGENT]` in a draft are replaced before it is shown in the chat.

## Run the tests

1. Set up the assistant in your test environment. Paste `prompts/system-prompt-v1.md` as the system prompt and attach the files in `data/`.
2. Create a run file: `python tools/new_run.py results/run-001.md --tool "<tool>" --model "<model and version>" --prompt v1`
3. Paste each test email into the assistant. Paste the answer under the matching `### Txx` heading in the run file.
4. Score it: `python tools/score.py results/run-001.md`
5. Open `results/run-001.json`. Judge the facts in each draft against the documents and fill the manual fields (`facts_correct`, `invented_facts`, `sendable_after_quick_check`). Running `score.py` again keeps them.
6. Write down targets in `docs/build-log.md` before the first run. Log every later change to the prompt or documents there and make a new run for it.

Python 3.8 or newer, standard library only.

## What the scoring covers

| Check | Who decides |
|---|---|
| Format: all six fields present | Script |
| Category matches the expected one | Script |
| Escalation owner matches | Script |
| Draft contains required facts and none of the forbidden ones | Script, coarse string rules |
| VERIFY filled when a stock status is given | Script |
| Facts in the draft are right, nothing invented | Person |
| Draft sendable after a quick check | Person |

Escalation recall comes first. A missed escalation is the costliest error because a routine-looking reply goes out to a customer who needed a person.

## View the site

GitHub Pages: Settings, Pages, deploy from branch `main`, folder `/ (root)`. The `.nojekyll` file is included.

Locally: `python -m http.server` in this folder, then open `http://localhost:8000`. Opening `index.html` directly does not work because browsers block `fetch` on `file://`.

## Limits

- The stock list is a fixed snapshot dated 2026-11-10. A real deployment needs a live data source.
- Tests are invented, not real customer emails. 20 tests show behaviour on known cases and do not estimate production accuracy.
- Automatic checks are string rules. They miss wrong facts phrased in unexpected ways, so the manual review is part of the method.
- Under EU AI Act Art. 50(1), the transparency duty applies to systems that interact directly with people. A draft that staff reviews and sends is a different case from an automatic reply. Check this again if the design changes to automatic sending.
- A chat where customers see answers directly is a different design from the staff-reviewed one. Under EU AI Act Art. 50(1) a system that talks directly to people must tell them it is an AI. The chat tab says so in its first message. Real use also needs the staff review step back.
- Do not paste real customer data into this prototype. GDPR data minimisation (Art. 5(1)(c)) applies, and health details (Art. 9) must be escalated and never repeated in drafts.

## AI use

Parts of this repository were drafted with an AI assistant and reviewed by the group. No result in `results/` may be produced by an AI and presented as measured.
