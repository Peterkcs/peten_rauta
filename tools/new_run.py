#!/usr/bin/env python3
"""Create an empty run file for pasting the assistant's outputs.

Usage:
    python tools/new_run.py results/run-001.md --tool "LehmusAI" --model "model name and version" --prompt v1
"""
import argparse, json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("out")
    ap.add_argument("--tool", default="")
    ap.add_argument("--model", default="")
    ap.add_argument("--prompt", default="v1")
    a = ap.parse_args()
    out = Path(a.out)
    if out.exists():
        raise SystemExit(f"{out} exists. Choose a new name so a finished run is never overwritten.")
    tests = json.loads((ROOT / "tests" / "test-emails.json").read_text(encoding="utf-8"))["tests"]
    lines = [f"tool: {a.tool}", f"model: {a.model}", f"prompt_version: {a.prompt}", f"date: {date.today().isoformat()}", ""]
    for t in tests:
        lines += [f"### {t['id']}", "CATEGORY:", "REASON:", "ESCALATE_TO:", "DRAFT:", "SOURCES:", "VERIFY:", ""]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Created {out}. Paste the assistant's answer for each test under its heading, replacing the empty lines.")

if __name__ == "__main__":
    main()
