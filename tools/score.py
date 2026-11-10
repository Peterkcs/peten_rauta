#!/usr/bin/env python3
"""Score one assistant run against tests/test-emails.json.

Usage:
    python tools/score.py results/run-001.md [--label "v1, LehmusAI"]

The run file has a small header (tool, model, prompt_version, date) and one block per test:

    ### T01
    CATEGORY: ROUTINE
    REASON: ...
    ESCALATE_TO: none
    DRAFT: ...
    SOURCES: ...
    VERIFY: ...

The script checks the things a program can check: format, category, escalation owner, simple
must-contain / must-not-contain rules on the draft, and that VERIFY is filled where a stock
status is given. It does NOT judge whether the facts in a draft are right. A person does that
and writes the result into the "manual" fields of the scored JSON file. Re-running the script
keeps those manual fields.
"""
import argparse, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KEY_RE = re.compile(r"^\s*\**(CATEGORY|REASON|ESCALATE_TO|DRAFT|SOURCES|VERIFY)\**\s*:\s*(.*)$")
BLOCK_RE = re.compile(r"^###\s*(T\d{2})\b.*$", re.M)
NONE_VALUES = {"", "none", "n/a", "-", "–"}


def clean(v):
    """Remove markdown bold or code marks and surrounding spaces."""
    return re.sub(r"[*`]", "", v or "").strip()


def norm_none(s):
    return clean(s).lower() in NONE_VALUES


def parse_run(text):
    matches = list(BLOCK_RE.finditer(text))
    head = text[: matches[0].start()] if matches else text
    meta = {}
    for line in head.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip().lower()] = v.strip()
    blocks = {}
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        fields, cur = {}, None
        for line in text[m.end():end].splitlines():
            km = KEY_RE.match(line)
            if km:
                cur = km.group(1)
                fields[cur] = km.group(2).strip()
            elif cur:
                fields[cur] += "\n" + line
        blocks[m.group(1)] = {k: v.strip() for k, v in fields.items()}
    return meta, blocks


def norm_cat(v):
    return re.sub(r"[\s\-]+", "_", clean(v).upper())


def norm_owner(v):
    v = re.sub(r"[\s\-]+", "_", clean(v).lower())
    return "none" if v in NONE_VALUES else v


def has_any(text, option):
    return any(alt.strip().lower() in text.lower() for alt in option.split("|"))


def check_draft(test, draft):
    if test["expect_no_draft"]:
        return norm_none(draft)
    if norm_none(draft):
        return False
    return all(has_any(draft, m) for m in test["must_contain"]) and not any(has_any(draft, m) for m in test["must_not_contain"])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("run")
    ap.add_argument("--label", default="")
    ap.add_argument("--out", default="")
    a = ap.parse_args()

    run_path = Path(a.run)
    meta, blocks = parse_run(run_path.read_text(encoding="utf-8"))
    tests = json.loads((ROOT / "tests" / "test-emails.json").read_text(encoding="utf-8"))["tests"]
    out_path = Path(a.out) if a.out else run_path.with_suffix(".json")

    old_manual = {}
    if out_path.exists():
        try:
            old = json.loads(out_path.read_text(encoding="utf-8"))
            old_manual = {t["id"]: t.get("manual", {}) for t in old.get("tests", [])}
        except Exception:
            pass

    rows = []
    for t in tests:
        b = blocks.get(t["id"])
        got_cat = norm_cat(b.get("CATEGORY")) if b else ""
        got_owner = norm_owner(b.get("ESCALATE_TO")) if b else ""
        draft = (b or {}).get("DRAFT", "")
        verify = (b or {}).get("VERIFY", "")
        answered = bool(b) and got_cat in ("ROUTINE", "NOT_ROUTINE")
        rows.append({
            "id": t["id"], "language": t["language"], "difficulty": t["difficulty"], "subject": t["subject"],
            "answered": answered,
            "expected_category": t["category"], "got_category": got_cat,
            "expected_escalate_to": t["expected_escalate_to"], "got_escalate_to": got_owner,
            "category_ok": got_cat == t["category"],
            "owner_ok": got_owner == t["expected_escalate_to"],
            "draft_ok": answered and check_draft(t, draft),
            "verify_ok": (not norm_none(verify)) if t["verify_required"] else None,
            "reason": (b or {}).get("REASON", ""), "draft": draft, "verify": verify,
            "manual": old_manual.get(t["id"], {"facts_correct": None, "invented_facts": None, "sendable_after_quick_check": None}),
        })

    nr = [r for r in rows if r["expected_category"] == "NOT_ROUTINE"]
    rt = [r for r in rows if r["expected_category"] == "ROUTINE"]
    flagged = [r for r in nr if r["got_category"] == "NOT_ROUTINE"]
    vr = [r for r in rows if r["verify_ok"] is not None]
    summary = {
        "tests_total": len(rows),
        "answers_found": sum(r["answered"] for r in rows),
        "category_accuracy": round(sum(r["category_ok"] for r in rows) / len(rows), 3),
        "escalation_recall": round(len(flagged) / len(nr), 3) if nr else None,
        "missed_escalations": [r["id"] for r in nr if r["got_category"] != "NOT_ROUTINE"],
        "over_escalations": [r["id"] for r in rt if r["got_category"] == "NOT_ROUTINE"],
        "owner_accuracy_when_flagged": round(sum(r["owner_ok"] for r in flagged) / len(flagged), 3) if flagged else None,
        "draft_checks_passed": sum(r["draft_ok"] for r in rows), "draft_checks_total": len(rows),
        "verify_checks_passed": sum(bool(r["verify_ok"]) for r in vr), "verify_checks_total": len(vr),
    }
    label = a.label or " | ".join(x for x in [meta.get("prompt_version", ""), meta.get("tool", ""), meta.get("model", "")] if x) or run_path.stem
    result = {"label": label, "meta": meta, "summary": summary, "tests": rows,
              "note": "Automatic checks only. Whether the facts in a draft are right is judged by a person and written into the manual fields."}
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    idx_path = ROOT / "results" / "index.json"
    idx = json.loads(idx_path.read_text(encoding="utf-8")) if idx_path.exists() else {"runs": []}
    rel = out_path.resolve().relative_to(ROOT).as_posix()
    idx["runs"] = [r for r in idx["runs"] if r["file"] != rel] + [{"file": rel, "label": label, "date": meta.get("date", "")}]
    idx_path.write_text(json.dumps(idx, indent=2), encoding="utf-8")

    s = summary
    print(f"Run: {label}\nWrote {out_path}")
    print(f"Answers found: {s['answers_found']}/{s['tests_total']}   Category accuracy: {s['category_accuracy']:.0%}")
    if s["escalation_recall"] is not None:
        print(f"Escalation recall: {s['escalation_recall']:.0%}   Missed escalations: {s['missed_escalations'] or 'none'}")
    print(f"Over-escalations: {s['over_escalations'] or 'none'}")
    print(f"Draft checks passed: {s['draft_checks_passed']}/{s['draft_checks_total']}   VERIFY filled where required: {s['verify_checks_passed']}/{s['verify_checks_total']}")
    print("Now judge the facts in each draft by hand and fill the manual fields in the JSON file.")


if __name__ == "__main__":
    main()
