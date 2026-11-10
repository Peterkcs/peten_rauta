(function () {
  "use strict";

  if (location.protocol === "file:") {
    document.getElementById("fileWarning").hidden = false;
  }

  /* ---------- tabs ---------- */
  var sections = [].slice.call(document.querySelectorAll("main > section"));
  var tabLinks = [].slice.call(document.querySelectorAll(".tabs a"));
  function showTab(id, scroll) {
    if (!sections.some(function (s) { return s.id === id; })) id = "overview";
    sections.forEach(function (s) { s.hidden = s.id !== id; });
    tabLinks.forEach(function (a) {
      var on = a.getAttribute("href") === "#" + id;
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (scroll) window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", function () { showTab(location.hash.slice(1), true); });
  showTab(location.hash.slice(1), false);

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) {
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function getText(path) {
    return fetch(path, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(path + ": " + r.status);
      return r.text();
    });
  }
  function getJson(path) {
    return getText(path).then(function (t) { return JSON.parse(t); });
  }
  function fail(node, err) {
    node.textContent = "Could not load data (" + err.message + ").";
  }

  function copy(text, hintNode) {
    function done(ok) {
      if (!hintNode) return;
      hintNode.textContent = ok ? "Copied." : "Copy failed. Select the text and copy by hand.";
      setTimeout(function () { hintNode.textContent = ""; }, 2500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      var ta = el("textarea", { "aria-hidden": "true" });
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta); done(ok);
    }
  }

  function parseCsv(text) {
    var rows = [], row = [], cur = "", q = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cur); cur = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else cur += c;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  /* minimal markdown view for the documents: headings, tables, lists, paragraphs */
  function renderMd(text, box) {
    box.textContent = "";
    box.className = "doc";
    var lines = text.replace(/\r/g, "").split("\n"), i = 0;
    function cells(l) { return l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(function (c) { return c.trim(); }); }
    while (i < lines.length) {
      var l = lines[i], m;
      if (!l.trim()) { i++; continue; }
      if ((m = l.match(/^(#{1,3})\s+(.*)$/))) { box.appendChild(el("h" + (m[1].length + 2), { text: m[2] })); i++; continue; }
      if (/^\s*\|/.test(l)) {
        var rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i]); i++; }
        var head = cells(rows[0]);
        var body = rows.slice(/^[\s|:-]+$/.test(rows[1] || "") ? 2 : 1).map(cells);
        box.appendChild(el("div", { class: "tablewrap" }, [el("table", {}, [
          el("thead", {}, [el("tr", {}, head.map(function (h) { return el("th", { scope: "col", text: h }); }))]),
          el("tbody", {}, body.map(function (r) { return el("tr", {}, r.map(function (c) { return el("td", { text: c }); })); }))
        ])]));
        continue;
      }
      if (/^\s*(-|\d+\.)\s+/.test(l)) {
        var ordered = /^\s*\d+\./.test(l), items = [];
        while (i < lines.length && /^\s*(-|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*(-|\d+\.)\s+/, "")); i++; }
        box.appendChild(el(ordered ? "ol" : "ul", {}, items.map(function (t) { return el("li", { text: t }); })));
        continue;
      }
      var para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\s*\||\s*(-|\d+\.)\s+)/.test(lines[i])) { para.push(lines[i]); i++; }
      box.appendChild(el("p", { text: para.join(" ") }));
    }
  }

  /* ---------- tests ---------- */
  var tests = [];
  var filter = "all";

  function renderStats() {
    var box = document.getElementById("testStats");
    box.textContent = "";
    var routine = tests.filter(function (t) { return t.category === "ROUTINE"; }).length;
    var fi = tests.filter(function (t) { return t.language === "fi"; }).length;
    var hard = tests.filter(function (t) { return t.difficulty !== "normal"; }).length;
    [[tests.length, "test emails"], [routine, "routine"], [tests.length - routine, "not routine"], [hard, "difficult cases"], [fi, "in Finnish"]].forEach(function (s) {
      box.appendChild(el("div", { class: "stat" }, [el("b", { text: String(s[0]) }), el("span", { text: s[1] })]));
    });
  }

  function matches(t) {
    if (filter === "all") return true;
    if (filter === "difficult") return t.difficulty !== "normal";
    if (filter === "fi" || filter === "en") return t.language === filter;
    return t.category === filter;
  }

  function renderTests() {
    var list = document.getElementById("testList");
    list.textContent = "";
    var shown = tests.filter(matches);
    if (!shown.length) list.appendChild(el("p", { class: "empty", text: "No tests match this filter." }));
    shown.forEach(function (t) {
      var sum = el("summary", {}, [
        el("span", { class: "tid", text: t.id }),
        el("span", { class: "subj", text: t.subject }),
        el("span", { class: "badge " + t.category, text: t.category }),
        el("span", { class: "badge lang", text: t.language.toUpperCase() })
      ]);
      if (t.difficulty !== "normal") sum.appendChild(el("span", { class: "badge hard", text: t.difficulty }));
      var hint = el("span", { class: "hint", role: "status" });
      var btn = el("button", { type: "button", class: "btn small", text: "Copy email" });
      btn.addEventListener("click", function () { copy("Subject: " + t.subject + "\n\n" + t.body, hint); });
      var body = el("div", { class: "tbody" }, [
        el("h4", { text: "Email" }),
        el("pre", { text: "Subject: " + t.subject + "\n\n" + t.body }),
        el("div", { class: "toolbar" }, [btn, hint]),
        el("h4", { text: "Expected" }),
        el("p", { text: t.expected_behaviour }),
        el("p", { class: "hint", text: "Category: " + t.category + " · Escalate to: " + t.expected_escalate_to + " · VERIFY required: " + (t.verify_required ? "yes" : "no") })
      ]);
      if (t.note) body.appendChild(el("p", { class: "hint", text: "Why this test: " + t.note }));
      list.appendChild(el("details", { class: "test" }, [sum, body]));
    });
  }

  document.querySelector(".filters").addEventListener("click", function (e) {
    var b = e.target.closest(".chip");
    if (!b) return;
    filter = b.getAttribute("data-filter");
    document.querySelectorAll(".chip").forEach(function (c) { c.classList.toggle("on", c === b); });
    renderTests();
  });

  getJson("tests/test-emails.json").then(function (d) {
    tests = d.tests; renderStats(); renderTests();
  }).catch(function (e) { fail(document.getElementById("testList"), e); });

  /* ---------- prompt and documents ---------- */
  getText("prompts/system-prompt-v1.md").then(function (t) {
    document.getElementById("promptText").textContent = t;
    document.getElementById("copyPrompt").addEventListener("click", function () {
      copy(t, document.getElementById("copyPromptHint"));
    });
  }).catch(function (e) { fail(document.getElementById("promptText"), e); });

  [["data/opening-hours.md", "docHours"], ["data/delivery-and-returns.md", "docDelivery"], ["data/escalation-rules.md", "docEscalation"]].forEach(function (p) {
    getText(p[0]).then(function (t) { renderMd(t, document.getElementById(p[1])); })
      .catch(function (e) { fail(document.getElementById(p[1]), e); });
  });

  getText("data/stock-list.csv").then(function (t) {
    var rows = parseCsv(t), head = rows.shift();
    var table = document.getElementById("stockTable");
    var thead = el("thead", {}, [el("tr", {}, head.map(function (h) { return el("th", { scope: "col", text: h }); }))]);
    var stIdx = head.indexOf("status");
    var tbody = el("tbody", {}, rows.map(function (r) {
      return el("tr", {}, r.map(function (c, i) {
        return i === stIdx ? el("td", {}, [el("span", { class: "st " + c, text: c })]) : el("td", { text: c });
      }));
    }));
    table.appendChild(thead); table.appendChild(tbody);
  }).catch(function (e) { document.getElementById("stockTable").replaceWith(document.createTextNode("Could not load stock list (" + e.message + ").")); });

  /* ---------- results ---------- */
  function pct(x) { return x === null || x === undefined ? "n/a" : Math.round(x * 100) + " %"; }
  function mark(v) {
    if (v === null || v === undefined) return el("span", { class: "na", text: "–" });
    return el("span", { class: v ? "ok" : "no", text: v ? "yes" : "no" });
  }

  function renderRun(r) {
    var s = r.summary;
    var box = el("div", { class: "run" }, [el("h3", { text: r.label })]);
    var meta = r.meta || {};
    box.appendChild(el("p", { class: "hint", text: ["tool: " + (meta.tool || "?"), "model: " + (meta.model || "?"), "prompt: " + (meta.prompt_version || "?"), "date: " + (meta.date || "?")].join(" · ") }));
    var stats = el("div", { class: "stats" });
    [[pct(s.escalation_recall), "escalation recall"], [pct(s.category_accuracy), "category accuracy"],
     [String(s.missed_escalations.length), "missed escalations"], [String(s.over_escalations.length), "over-escalations"],
     [s.draft_checks_passed + "/" + s.draft_checks_total, "draft checks"], [s.verify_checks_passed + "/" + s.verify_checks_total, "VERIFY filled"]
    ].forEach(function (x) { stats.appendChild(el("div", { class: "stat" }, [el("b", { text: x[0] }), el("span", { text: x[1] })])); });
    box.appendChild(stats);
    box.appendChild(el("p", { class: "hint", text: r.note || "" }));

    var head = ["Test", "Expected", "Got", "Owner", "Draft check", "Facts correct", "Invented facts", "Sendable"];
    var thead = el("thead", {}, [el("tr", {}, head.map(function (h) { return el("th", { scope: "col", text: h }); }))]);
    var tbody = el("tbody", {}, r.tests.map(function (t) {
      var m = t.manual || {};
      return el("tr", {}, [
        el("td", { text: t.id + " " + t.subject }),
        el("td", { text: t.expected_category }),
        el("td", {}, [el("span", { class: t.category_ok ? "ok" : "no", text: t.answered ? t.got_category : "missing" })]),
        el("td", {}, [el("span", { class: t.owner_ok ? "ok" : "no", text: t.got_escalate_to || "–" })]),
        el("td", {}, [mark(t.draft_ok)]),
        el("td", {}, [mark(m.facts_correct)]),
        el("td", { text: m.invented_facts === null || m.invented_facts === undefined ? "–" : String(m.invented_facts) }),
        el("td", {}, [mark(m.sendable_after_quick_check)])
      ]);
    }));
    box.appendChild(el("div", { class: "tablewrap" }, [el("table", {}, [thead, tbody])]));
    return box;
  }

  var resultsBox = document.getElementById("resultsBox");
  getJson("results/index.json").then(function (idx) {
    resultsBox.textContent = "";
    if (!idx.runs || !idx.runs.length) {
      resultsBox.appendChild(el("p", { class: "empty", text: "No runs logged yet. Run the tests, score them with tools/score.py and they appear here." }));
      return;
    }
    return Promise.all(idx.runs.map(function (r) {
      return getJson(r.file).then(renderRun).catch(function (e) { return el("p", { class: "no", text: "Could not load " + r.file + " (" + e.message + ")" }); });
    })).then(function (nodes) { nodes.forEach(function (n) { resultsBox.appendChild(n); }); });
  }).catch(function (e) { fail(resultsBox, e); });
})();
