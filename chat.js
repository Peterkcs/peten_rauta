(function () {
  "use strict";
  var E = window.DemoEngine, cfg = window.PR_CONFIG || {};
  var log = document.getElementById("chatLog"), form = document.getElementById("chatForm");
  var input = document.getElementById("chatInput"), sendBtn = form.querySelector(".send");
  var staff = document.getElementById("staffBody"), modeTag = document.getElementById("modeTag");
  var useApi = !!cfg.apiUrl, data = null, dataError = null, busy = false;

  modeTag.textContent = useApi ? "oma testiympäristö" : "demo-moottori (säännöt, ei tekoäly)";

  var EXAMPLES = [
    "Onko teillä auki sunnuntaina?",
    "Onko teillä ulkokäyttöön jatkojohtoa?",
    "How long does chimney pipe delivery take?",
    "Are you open on 6 December?",
    "Saanko alennusta, jos ostan kaksi akkuporakonetta?",
    "Maali ei peitä, haluan rahat takaisin"
  ];

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") n.className = attrs[k]; else if (k === "text") n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function getText(path) {
    return fetch(path, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(path + " " + r.status); return r.text(); });
  }

  if (!useApi) {
    Promise.all([getText("data/opening-hours.md"), getText("data/stock-list.csv")])
      .then(function (t) { data = E.parseData(t[0], t[1]); })
      .catch(function (e) { dataError = e; });
  }

  function scrollDown() { log.scrollTop = log.scrollHeight; }
  function bubble(kind, text, note) {
    var m = el("div", { class: "msg " + kind, text: text });
    if (note) m.appendChild(el("small", { text: note }));
    log.appendChild(m); scrollDown(); return m;
  }
  function typing() {
    var t = el("div", { class: "typing", "aria-label": "Kirjoittaa" }, [el("i"), el("i"), el("i")]);
    log.appendChild(t); scrollDown(); return t;
  }

  function welcome() {
    log.textContent = "";
    bubble("bot", "Moi! Olen automaattinen avustaja, en ihminen. Autan aukioloissa, hyllytilanteessa ja tilaustuotteiden toimitusajassa. Kaikki muu menee oikealle ihmiselle.\n\nKirjoita viesti ihan niin kuin laittaisit sähköpostia. Jokainen viesti käsitellään erillisenä, joten chat ei muista aiempaa.");
    renderStaff(null);
  }

  function renderStaff(r, err) {
    staff.textContent = "";
    if (err) { staff.appendChild(el("p", { class: "msg err", text: err })); return; }
    if (!r) { staff.appendChild(el("p", { class: "empty", text: "Lähetä viesti, niin näet tässä miten avustaja luokittelee sen ja mitä henkilökunnan pitää tarkistaa." })); return; }
    var badge = el("span", { class: "badge " + r.category, text: r.category });
    var dl = el("dl", {}, []);
    [["Luokka", badge], ["Syy", r.reason || "–"], ["Vastuuhenkilö", r.escalate_to || "none"],
     ["Luonnos", r.category === "ROUTINE" && r.draft && r.draft !== "none" ? r.draft : "ei luonnosta"],
     ["Lähteet", r.sources && r.sources.length ? r.sources.join("; ") : "none"],
     ["Tarkista ennen lähetystä", r.verify && r.verify.length ? r.verify.join("; ") : "none"]
    ].forEach(function (p) { dl.appendChild(el("dt", { text: p[0] })); dl.appendChild(el("dd", {}, [typeof p[1] === "string" ? document.createTextNode(p[1]) : p[1]])); });
    staff.appendChild(dl);
    var block = E.toBlock(r), hint = el("span", { class: "hint", role: "status" });
    var btn = el("button", { type: "button", class: "btn small", text: "Kopioi lohko" });
    btn.addEventListener("click", function () {
      var done = function (ok) { hint.textContent = ok ? "Kopioitu." : "Kopiointi ei onnistunut."; setTimeout(function () { hint.textContent = ""; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(block).then(function () { done(true); }, function () { done(false); }); else done(false);
    });
    staff.appendChild(el("div", { class: "toolbar" }, [btn, hint]));
    staff.appendChild(el("pre", { class: "code", text: block }));
  }

  function cleanDraft(d, name) {
    return d.replace(/\s*\[NAME\]/g, name ? " " + name : "").replace(/\[AGENT\],?\s*/g, "").trim();
  }

  function replyText(r, text) {
    var name = E.findName(text), lang = r.lang || E.detectLang(text.toLowerCase());
    if (r.category === "ROUTINE" && r.draft && r.draft.toLowerCase() !== "none") return cleanDraft(r.draft, name);
    return E.handoff(lang, r.escalate_to, r.flag, name);
  }

  function callApi(text) {
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 30000);
    return fetch(cfg.apiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: "", body: text }), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        if (!j || typeof j.output !== "string") throw new Error("vastauksessa ei ole kenttää output");
        var r = E.parseBlock(j.output);
        if (r.category !== "ROUTINE" && r.category !== "NOT_ROUTINE") throw new Error("CATEGORY puuttuu tai on virheellinen");
        return r;
      })
      .then(function (r) { clearTimeout(timer); return r; }, function (e) { clearTimeout(timer); throw e; });
  }

  function handle(text) {
    text = text.trim();
    if (!text || busy) return;
    busy = true; sendBtn.disabled = true;
    bubble("me", text);
    var t = typing(), started = Date.now();
    var work;
    if (useApi) work = callApi(text);
    else if (dataError) work = Promise.reject(dataError);
    else work = new Promise(function (res, rej) {
      (function wait(n) {
        if (data) return res(E.respond(data, { subject: "", body: text }));
        if (n > 40) return rej(new Error("data ei ehtinyt latautua"));
        setTimeout(function () { wait(n + 1); }, 100);
      })(0);
    });
    work.then(function (r) {
      var delay = Math.max(0, 600 - (Date.now() - started));
      return new Promise(function (res) { setTimeout(function () { res(r); }, delay); });
    }).then(function (r) {
      t.remove();
      bubble("bot", replyText(r, text), r.category === "NOT_ROUTINE" ? "Välitetty: " + r.escalate_to : null);
      renderStaff(r);
    }).catch(function (e) {
      t.remove();
      var msg = useApi ? "Yhteys testiympäristöön ei toiminut (" + e.message + "). Tarkista config.js:n apiUrl ja CORS." : "Demo ei saanut dataa (" + e.message + "). Jos avasit sivun tiedostona, käynnistä paikallinen palvelin: python -m http.server.";
      bubble("err", msg); renderStaff(null, msg);
    }).then(function () { busy = false; sendBtn.disabled = false; input.focus(); });
  }

  var chips = document.getElementById("chatChips");
  EXAMPLES.forEach(function (ex) {
    var b = el("button", { type: "button", class: "chat-chip", text: ex });
    b.addEventListener("click", function () { handle(ex); });
    chips.appendChild(b);
  });

  form.addEventListener("submit", function (e) { e.preventDefault(); var v = input.value; input.value = ""; handle(v); });
  input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true })); } });
  document.getElementById("chatReset").addEventListener("click", function () { if (!busy) { welcome(); input.value = ""; input.focus(); } });
  welcome();
})();
