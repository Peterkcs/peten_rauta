/*
 * Demo engine for the "Kokeile chättiä" tab.
 *
 * This is a rule-based stand-in, NOT the AI model. It applies the same policy as
 * prompts/system-prompt-v1.md (three routine question types, everything else to an owner)
 * with keyword rules, so the chat can be tried on GitHub Pages without a backend.
 * Its output must never be logged in results/ as a measured result of the real assistant.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DemoEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MONTHS_EN = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
  var MONTHS_FI = { tammikuu: 1, helmikuu: 2, maaliskuu: 3, huhtikuu: 4, toukokuu: 5, "kesäkuu": 6, "heinäkuu": 7, elokuu: 8, syyskuu: 9, lokakuu: 10, marraskuu: 11, joulukuu: 12 };
  var MONTH_NAMES_EN = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAYS_EN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  var DAYS_EN_PL = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  var DAYS_EN_CAP = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var DAYS_FI = ["sunnuntai", "maanantai", "tiistai", "keskiviikko", "torstai", "perjantai", "lauantai"];
  var DAYS_FI_HAB = ["sunnuntaisin", "maanantaisin", "tiistaisin", "keskiviikkoisin", "torstaisin", "perjantaisin", "lauantaisin"];
  var DAYS_FI_ESS = ["sunnuntaina", "maanantaina", "tiistaina", "keskiviikkona", "torstaina", "perjantaina", "lauantaina"];

  var HOLIDAYS = [
    { key: "Independence Day", re: /itsenäisyyspäiv|independence day/, fi: "Itsenäisyyspäivänä" },
    { key: "Christmas Eve", re: /jouluaatto|jouluaattona|christmas eve/, fi: "Jouluaattona" },
    { key: "Christmas Day", re: /joulupäiv|christmas day/, fi: "Joulupäivänä" },
    { key: "Boxing Day", re: /tapaninpäiv|boxing day|st\.? stephen/, fi: "Tapaninpäivänä" },
    { key: "New Year's Day", re: /uudenvuodenpäiv|new year'?s day|uusivuosi/, fi: "Uudenvuodenpäivänä" },
    { key: "Epiphany", re: /loppiai|epiphany/, fi: "Loppiaisena" }
  ];

  /* Product keywords. Stems, not words, because Finnish inflects. Precision is preferred
     over recall: an unmatched product is escalated to product_advisor. */
  var PRODUCTS = {
    P001: { fi: "kynsivasara 450 g", kw: ["claw hammer", "hammer", "vasara"] },
    P002: { fi: "ruuvimeisselisarja, 12 kpl", kw: ["screwdriver", "ruuvimeissel"] },
    P003: { fi: "akkuporakone 18 V ja kaksi akkua", kw: ["cordless drill", "drill", "porakone", "akkuporakone"] },
    P004: { fi: "varaakku 18 V, 4 Ah", kw: ["spare battery", "extra battery", "varaakku", "varaparisto"] },
    P005: { fi: "pyörösaha 1400 W", kw: ["circular saw", "sirkkeli", "pyörösaha", "pyörösaw"] },
    P006: { fi: "vesivaaka 60 cm", kw: ["spirit level", "vesivaaka", "vesivaa"] },
    P007: { fi: "puuruuvit 4 x 40 mm, 200 kpl", kw: ["wood screw", "screws", "puuruuvi", "ruuvi"] },
    P008: { fi: "seinätulpat 8 mm, 100 kpl", kw: ["wall plug", "seinätulppa", "tulppa"] },
    P009: { fi: "sininen peiteteippi 50 mm x 50 m", kw: ["masking tape", "peiteteip", "maalarinteip"] },
    P010: { fi: "valkoinen sisämaali 9 l", kw: ["wall paint", "interior paint", "sisämaali", "seinämaali", "paint", "maali"] },
    P011: { fi: "mäntysävyinen puunsuoja 1 l", kw: ["wood stain", "puunsuoja", "petsi"] },
    P012: { fi: "maalitelasarja, 5 kpl", kw: ["paint roller", "roller", "maalitela"] },
    P013: { fi: "maalisivellin 50 mm", kw: ["paintbrush", "paint brush", "sivellin", "pensseli"] },
    P014: { fi: "puutarhaletku 25 m", kw: ["garden hose", "hose", "letku"] },
    P015: { fi: "puutarhalapio", kw: ["garden spade", "spade", "puutarhalapio", "lapio"] },
    P016: { fi: "nurmikon harava", kw: ["lawn rake", "rake", "harava"] },
    P017: { fi: "puutarhavaraston pakkaus 3 x 2 m", kw: ["garden shed", "shed kit", "puutarhavarasto", "piharakennus"] },
    P018: { fi: "ulkokäyttöön sopiva jatkojohto 10 m, IP44", kw: ["extension cord", "extension lead", "jatkojoh"], spec: [/(^|\D)10\s?(m\b|metr)/, /outdoor|ulko|ip44/] },
    P019: { fi: "sisäkäyttöön tarkoitettu jatkojohto 3 m", kw: ["extension cord", "extension lead", "jatkojoh"], spec: [/(^|\D)3\s?(m\b|metr)/, /indoor|sisä/] },
    P020: { fi: "LED-lamppu E27 10 W, 4 kpl", kw: ["led bulb", "light bulb", "polttimo", "led-lamp", "led lamp"] },
    P021: { fi: "lämpöpuhallin 2 kW", kw: ["space heater", "heater", "lämpöpuhal"] },
    P022: { fi: "savupiippusarja 150 mm puulämmitteiselle kamiinalle", kw: ["chimney pipe", "chimney", "savupiippu", "savuhormi", "savuputki"] },
    P023: { fi: "puulämmitteinen kamiina 6 kW", kw: ["wood-burning stove", "wood burning stove", "wood stove", "stove", "kamiina", "puuhella"] },
    P024: { fi: "keittiön sekoittajahana", kw: ["mixer tap", "kitchen tap", "keittiöhana", "sekoittajahana"] },
    P025: { fi: "valkoinen silikoni 300 ml", kw: ["silicone", "silikoni"] },
    P026: { fi: "työkäsineet, koko 10", kw: ["work gloves", "gloves", "työkäsine"] },
    P027: { fi: "suojalasit", kw: ["goggles", "suojalasi"] },
    P028: { fi: "alumiiniset askelmatikkaat, 3 askelmaa", kw: ["step ladder", "ladder", "tikkaat", "tikkaa", "tikkaid"] },
    P029: { fi: "lumilapio", kw: ["snow shovel", "shovel", "lumilapio", "lapio"] },
    P030: { fi: "jäänsulatussuola 10 kg", kw: ["ice melt", "salt", "suola"] }
  };

  /* "for a wood stove" is context, not a request for a stove. */
  var STRIP = [/for (a |my |the )?(wood[- ]?(burning )?)?(stove|fireplace)/g, /for (a |my |the )?(garden )?shed/g, /(puu)?(lämmitteiseen|lämmitteiselle) \S+/g, /kamiinaan|takkaan|puuhellaan/g];

  /* Non-routine rules, checked in this order. The first hit decides the owner. */
  var NONROUTINE = [
    { flag: "injection", owner: "store_manager", reason: "The email contains an instruction aimed at the assistant.",
      re: /ignore (all |any )?(previous|prior|earlier|above) (instructions|rules)|forget (all |your )?(previous|prior|earlier)|unohda (aiemmat|edelliset|kaikki)|(^|\n)\s*(järjestelmä|system)\s*:|new instructions|uudet ohjeet|hyväksy alennus/ },
    { flag: "bank", owner: "finance", reason: "Bank details, invoice or money transfer matter.",
      re: /tilinumer|\biban\b|bank account|pankkitili|vaihtanut pankkia|changed (our )?bank|bank details|pankkitieto|invoice|\blasku|laskutu|\bfi\d{2}\s?\d{4}/ },
    { flag: "card", owner: "customer_service_lead", reason: "The customer offers payment card details by email.",
      re: /card number|credit card|debit card|kortin numero|korttinumero|maksukortti|luottokortti|\bcvv\b|\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}\b/ },
    { flag: "complaint", owner: "customer_service_lead", reason: "Complaint, return, refund, compensation or health matter.",
      re: /refund|rahani takaisin|rahat takaisin|palautu|palauta|\breturn\b|reklamaa|complain|valitu|\bbroke\b|broken|\brikki|\bhurt\b|loukkaan|injur|warranty|takuu|compensation|korvaus|hyvitys|lääkär|doctor|medical|leikkau|surgery|sairaus|illness|somessa|social media|lawyer|asianajaja|haastan/ },
    { flag: "discount", owner: "store_manager", reason: "Discount, bulk or contractor quote request.",
      re: /discount|alennu|alennet|tarjous|\bquote\b|\bbulk\b|wholesale|contractor|urakoitsija|\b\d{2,}\s+(buckets|pcs|pieces|kpl)|price match|halvemm|cheaper/ },
    { flag: "price", owner: "product_advisor", reason: "Price question. Prices are not in the documents.",
      re: /\bprice\b|how much (does|is|do|would)|paljonko|kuinka paljon maksaa|\bhinta|\bhinnat|maksaa\b/ },
    { flag: "advice", owner: "product_advisor", reason: "Product advice or technical question.",
      re: /can i (use|connect|plug|install|mix|put)|voinko (kytkeä|käyttää|asentaa|laittaa|sekoittaa)|sopiiko|is it safe|turvallis|how (do|should) i|miten (asennan|käytän|kiinnitän)|which .{0,30}(should|is best)|mikä .{0,30}(on paras|sopii)|recommend|suosit|compatible|yhteensopiv/ }
  ];

  var HOURS_RE = /\b(open|opens|opening|close|closes|closing|closed|hours)\b|aukiol|\bauki\b|kiinni|sulkeudu|suljet|avaatte|mihin asti|mihin aikaan|ehdin|käymään|käydä|kuinka myöhään|how late|what time/;
  var STOCK_RE = /in stock|do you have|do you sell|have you got|do you carry|available|varastossa|saatavilla|onko teillä|löytyykö|myyttekö|onko myynnissä|can i buy/;
  var DELIVERY_RE = /deliver|toimitu|toimitusaika|how long (would|will|does|is)|kuinka kauan|kauanko|milloin saan|montako päivää|how many (working )?days|tilata|order it|if i order|jos tilaan|shipping|rahti/;
  var HOME_RE = /\bhome\b|kotiin|kotiovelle|my door|\bdoor\b|koti\b/;
  var RELATIVE_DAY_RE = /\btoday\b|\btomorrow\b|tänään|huomenna|tonight|tänä iltana/;

  /* ---------- parsing ---------- */

  function parseCsv(text) {
    var rows = [], row = [], cur = "", q = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
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

  function mdTables(text) {
    var tables = [], cur = null;
    text.replace(/\r/g, "").split("\n").forEach(function (l) {
      if (/^\s*\|/.test(l)) {
        var cells = l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(function (c) { return c.trim(); });
        if (!cur) { cur = []; tables.push(cur); }
        if (!/^[\s|:-]+$/.test(l)) cur.push(cells);
      } else cur = null;
    });
    return tables;
  }

  function parseData(hoursMd, stockCsv) {
    var regular = {}, holidays = [];
    mdTables(hoursMd).forEach(function (t) {
      var head = t[0].join(" ").toLowerCase();
      if (head.indexOf("date") >= 0) {
        t.slice(1).forEach(function (r) {
          var m = r[0].match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
          if (!m) return;
          holidays.push({ d: +m[1], m: MONTHS_EN[m[2].toLowerCase()], y: +m[3], name: r[2].replace(/\s*\(.*\)/, ""), closed: /closed/i.test(r[3]) });
        });
      } else if (head.indexOf("hours") >= 0) {
        t.slice(1).forEach(function (r) {
          var label = r[0].toLowerCase(), h = r[1].match(/(\d{1,2}):(\d{2})\s*to\s*(\d{1,2}):(\d{2})/);
          if (!h) return;
          var found = [];
          DAYS_EN.forEach(function (n, i) { var p = label.indexOf(n); if (p >= 0) found.push({ i: i, p: p }); });
          found.sort(function (a, b) { return a.p - b.p; });
          var days = [];
          if (found.length === 2 && /\bto\b/.test(label)) {
            for (var d = found[0].i; ; d = (d + 1) % 7) { days.push(d); if (d === found[1].i) break; }
          } else found.forEach(function (f) { days.push(f.i); });
          days.forEach(function (d) { regular[d] = { open: h[1] + ":" + h[2], close: h[3] + ":" + h[4] }; });
        });
      }
    });
    var rows = parseCsv(stockCsv), head = rows.shift(), stock = {};
    rows.forEach(function (r) {
      var o = {}; head.forEach(function (h, i) { o[h] = r[i]; });
      var range = (o.delivery_working_days || "").match(/(\d+)\s*[-–]\s*(\d+)/);
      stock[o.id] = { id: o.id, name: o.name, status: o.status, min: range ? +range[1] : null, max: range ? +range[2] : null, note: o.note, asOf: o.as_of };
    });
    return { regular: regular, holidays: holidays, stock: stock };
  }

  /* ---------- helpers ---------- */

  function detectLang(low) {
    return /[äö]|(^|[^a-zäö])(hei|moi|onko|kiitos|terveisin|auki|kiinni|haluan|voinko|ostin|olette|mihin|voisitteko|ehdinkö|tilaus|maksakaa)([^a-zäö]|$)/.test(low) ? "fi" : "en";
  }

  function findName(body) {
    var re = /(terveisin|ystävällisin terveisin|kind regards|best regards|regards|best|thanks|thank you|cheers|kiitos)[,!.]?\s*\n?\s*([^\n]+)$/gi, m, last = null;
    while ((m = re.exec(body))) last = m;
    if (!last) return "";
    var first = last[2].split(/[,\s]+/)[0];
    return /^[A-ZÅÄÖ][a-zåäö-]{1,}$/.test(first) ? first : "";
  }

  function fmtTime(t, lang) { return lang === "fi" ? t.replace(/^0/, "").replace(":00", "") : t; }
  function range(h, lang) { return lang === "fi" ? "klo " + fmtTime(h.open, lang) + "–" + fmtTime(h.close, lang) : h.open + " to " + h.close; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function fiDate(d, m, y) { return d + "." + m + "." + (y ? y : ""); }
  function dateEn(d, m) { return d + " " + MONTH_NAMES_EN[m]; }
  function fiLongDate(iso) { var p = iso.split("-"); return +p[2] + "." + +p[1] + "." + p[0]; }

  /* ---------- hours ---------- */

  function findDayTargets(data, low) {
    var targets = [], seen = {};
    function addDate(d, m, y, holiday) {
      var k = d + "/" + m;
      if (seen[k]) return;
      seen[k] = true;
      targets.push({ type: "date", d: d, m: m, y: y || null, holiday: holiday || null });
    }
    HOLIDAYS.forEach(function (h) {
      if (h.re.test(low)) {
        var rec = data.holidays.filter(function (x) { return x.name === h.key; })[0];
        if (rec) addDate(rec.d, rec.m, rec.y, rec);
      }
    });
    var m, re = /(\d{1,2})\.\s?(\d{1,2})\.(?:\s?(\d{4}))?/g;
    while ((m = re.exec(low))) if (+m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) addDate(+m[1], +m[2], m[3] ? +m[3] : null);
    var names = Object.keys(MONTHS_EN).concat(Object.keys(MONTHS_FI));
    var re2 = new RegExp("(\\d{1,2})(?:st|nd|rd|th)?\\.?\\s+(?:of\\s+)?(" + names.join("|") + ")", "g");
    while ((m = re2.exec(low))) addDate(+m[1], MONTHS_EN[m[2]] || MONTHS_FI[m[2]], null);
    var re3 = new RegExp("(" + Object.keys(MONTHS_EN).join("|") + ")\\s+(\\d{1,2})(?!\\d)", "g");
    while ((m = re3.exec(low))) addDate(+m[2], MONTHS_EN[m[1]], null);

    var dows = [];
    DAYS_EN.forEach(function (n, i) { if (new RegExp("\\b" + n).test(low)) dows.push(i); });
    DAYS_FI.forEach(function (n, i) { if (low.indexOf(n) >= 0 && dows.indexOf(i) < 0) dows.push(i); });
    if (!dows.length && !targets.length) {
      /* "arkisin", "weekdays" and "weekend" count only when no specific day or date is named. */
      if (/arkisin|arkena|weekdays?\b/.test(low)) [1, 2, 3, 4, 5].forEach(function (i) { dows.push(i); });
      if (/viikonloppu|weekend/.test(low)) [6, 0].forEach(function (i) { dows.push(i); });
    }
    dows.forEach(function (i) { targets.push({ type: "dow", dow: i }); });
    return targets;
  }

  function resolveDate(data, t) {
    var hol = t.holiday || data.holidays.filter(function (h) { return h.d === t.d && h.m === t.m && (!t.y || h.y === t.y); })[0];
    var y = t.y || (t.m >= 11 ? 2026 : t.m === 1 ? 2027 : null);
    var dow = y ? new Date(Date.UTC(y, t.m - 1, t.d)).getUTCDay() : null;
    return { hol: hol || null, dow: dow, outside: !y };
  }

  function summary(data, lang) {
    var segs = [];
    [1, 2, 3, 4, 5, 6, 0].forEach(function (d) {
      var h = data.regular[d]; if (!h) return;
      var last = segs[segs.length - 1];
      if (last && last.open === h.open && last.close === h.close) last.days.push(d);
      else segs.push({ open: h.open, close: h.close, days: [d] });
    });
    return segs.map(function (s) {
      var label;
      if (s.days.length === 5 && s.days[0] === 1) label = lang === "fi" ? "arkisin" : "Monday to Friday";
      else if (s.days.length === 1) label = lang === "fi" ? DAYS_FI_HAB[s.days[0]] : DAYS_EN_CAP[s.days[0]];
      else label = s.days.map(function (d) { return lang === "fi" ? DAYS_FI_HAB[d] : DAYS_EN_CAP[d]; }).join(", ");
      return label + " " + range(s, lang);
    });
  }

  function hoursPart(data, low, lang, out) {
    var targets = findDayTargets(data, low), lines = [], usedHoliday = false, onlyDow = true;
    out.sources.push("opening-hours.md, Regular hours");
    if (!targets.length) {
      var segs = summary(data, lang);
      lines.push(lang === "fi"
        ? "Olemme auki " + segs.join(", ") + ". Pyhäpäivinä meillä on kiinni."
        : "We're open " + segs.join(", ") + ". On public holidays we're closed.");
      usedHoliday = true;
      if (RELATIVE_DAY_RE.test(low)) out.verify.push("The customer wrote today or tomorrow. Confirm the actual date and holiday status.");
    }
    var dowT = targets.filter(function (t) { return t.type === "dow"; });
    if (dowT.length) {
      var byHours = [];
      dowT.forEach(function (t) {
        var h = data.regular[t.dow]; if (!h) return;
        var g = byHours.filter(function (x) { return x.h.open === h.open && x.h.close === h.close; })[0];
        if (g) g.days.push(t.dow); else byHours.push({ h: h, days: [t.dow] });
      });
      byHours.forEach(function (g) {
        var names = g.days.map(function (d) { return lang === "fi" ? DAYS_FI_HAB[d] : DAYS_EN_PL[d]; });
        var label = g.days.length === 5 && g.days.join() === "1,2,3,4,5" ? (lang === "fi" ? "arkisin" : "weekdays")
          : names.length > 1 ? names.slice(0, -1).join(", ") + (lang === "fi" ? " ja " : " and ") + names[names.length - 1] : names[0];
        lines.push(lang === "fi" ? cap(label) + " olemme auki " + range(g.h, lang) + "." : "On " + label + " we're open " + range(g.h, lang) + ".");
      });
    }
    targets.forEach(function (t) {
      if (t.type === "dow") return;
      onlyDow = false;
      var r = resolveDate(data, t), dtxt = lang === "fi" ? t.d + "." + t.m + "." : dateEn(t.d, t.m);
      if (r.hol && r.hol.closed) {
        usedHoliday = true;
        var hf = HOLIDAYS.filter(function (x) { return x.key === r.hol.name; })[0];
        lines.push(lang === "fi"
          ? (hf ? hf.fi : "Pyhäpäivänä") + " " + dtxt + " meillä on suljettu."
          : "On " + dtxt + " (" + r.hol.name + ") we're closed.");
      } else if (r.dow !== null && data.regular[r.dow]) {
        lines.push(lang === "fi"
          ? cap(DAYS_FI_ESS[r.dow]) + " " + dtxt + " olemme auki " + range(data.regular[r.dow], lang) + "."
          : "On " + dtxt + " (a " + DAYS_EN_CAP[r.dow] + ") we're open " + range(data.regular[r.dow], lang) + ".");
        usedHoliday = true;
      } else {
        lines.push(lang === "fi" ? "Päivän " + dtxt + " aukiolo ei ole tiedossani." : "I don't have the hours for " + dtxt + ".");
        out.verify.push("Date " + dtxt + " is outside the documents. Check opening hours and holiday notices.");
      }
    });
    if (targets.length && onlyDow) {
      lines.push(lang === "fi" ? "Pyhäpäivinä meillä on kiinni." : "On public holidays we're closed.");
      usedHoliday = true;
    }
    if (usedHoliday) out.sources.push("opening-hours.md, Public holidays");
    return lines.join(" ");
  }

  /* ---------- products ---------- */

  function matchProducts(low) {
    var text = low;
    STRIP.forEach(function (re) { text = text.replace(re, " "); });
    var kws = {};
    Object.keys(PRODUCTS).forEach(function (id) {
      PRODUCTS[id].kw.forEach(function (k) { (kws[k] = kws[k] || []).push(id); });
    });
    var order = Object.keys(kws).sort(function (a, b) { return b.length - a.length; });
    var claimed = [], found = [];
    order.forEach(function (k) {
      var from = 0, p;
      while ((p = text.indexOf(k, from)) >= 0) {
        var s = p, e = p + k.length;
        var overlap = claimed.some(function (c) { return s < c.e && e > c.s; });
        if (!overlap) { claimed.push({ s: s, e: e }); found.push({ kw: k, ids: kws[k] }); }
        from = e;
      }
    });
    var chosen = [], ambiguous = [];
    found.forEach(function (f) {
      var scored = f.ids.map(function (id) {
        var bonus = 0;
        (PRODUCTS[id].spec || []).forEach(function (re) { if (re.test(text)) bonus += 20; });
        return { id: id, score: f.kw.length + bonus };
      }).sort(function (a, b) { return b.score - a.score; });
      if (scored.length > 1 && scored[0].score === scored[1].score) {
        ambiguous.push(scored.filter(function (x) { return x.score === scored[0].score; }).map(function (x) { return x.id; }));
      } else if (chosen.indexOf(scored[0].id) < 0) chosen.push(scored[0].id);
    });
    return { ids: chosen, ambiguous: ambiguous };
  }

  function enName(name) {
    var n = name.replace(/^([^,]+),\s*(.+)$/, "$1 ($2)");
    return "the " + (/^[A-Z][a-z]/.test(n) ? n.charAt(0).toLowerCase() + n.slice(1) : n);
  }

  function stockLine(data, id, lang) {
    var p = data.stock[id], f = PRODUCTS[id], date = lang === "fi" ? fiLongDate(p.asOf) : p.asOf;
    var asOf = lang === "fi" ? " (tilanne " + date + ")" : " (as of " + date + ")";
    var nm = lang === "fi" ? cap(f.fi) : cap(enName(p.name));
    if (p.status === "SHELF") return lang === "fi" ? nm + " löytyy hyllystä" + asOf + "." : nm + " is on the shelf" + asOf + ".";
    if (p.status === "WAREHOUSE") return lang === "fi"
      ? nm + " on meillä varastossa, ja yleensä sen saa noudettua myymälästä 1 arkipäivässä" + asOf + "."
      : nm + " is in our warehouse and can usually be picked up in the store within 1 working day" + asOf + ".";
    if (p.status === "ORDER") return lang === "fi"
      ? nm + " ei ole hyllyssä eikä varastossa, mutta sen voi tilata. Toimitusaika myymälään on " + p.min + "–" + p.max + " arkipäivää tilauksen vahvistuksesta" + asOf + "."
      : nm + " isn't kept in stock, but it can be ordered. Delivery to the store takes " + p.min + " to " + p.max + " working days from order confirmation" + asOf + ".";
    return lang === "fi"
      ? nm + " on tällä hetkellä loppu. Uutta erää odotetaan, mutta päivää ei ole vahvistettu" + asOf + "."
      : nm + " is sold out at the moment. A restock is expected but the date isn't confirmed" + asOf + ".";
  }

  function deliveryLine(data, id, lang, home) {
    var p = data.stock[id], f = PRODUCTS[id];
    var a = p.min, b = p.max;
    if (home) { a += 1; b += 2; }
    if (lang === "fi") return "Tilaustuotteen (" + f.fi + ") toimitusaika " + (home ? "kotiin" : "myymälään") + " on arviolta " + a + "–" + b + " arkipäivää tilauksen vahvistuksesta. Se on arvio, ei lupaus tietystä päivästä.";
    return "Delivery of " + enName(p.name) + " " + (home ? "to your home" : "to the store") + " takes about " + a + " to " + b + " working days from order confirmation. It's an estimate, not a promised date.";
  }

  /* ---------- main ---------- */

  function respond(data, email) {
    var body = email.body || "", text = (email.subject || "") + "\n" + body, low = text.toLowerCase();
    var lang = detectLang(low), name = findName(body);
    var out = { lang: lang, category: "ROUTINE", reason: "", escalate_to: "none", draft: "none", sources: [], verify: [], flag: "" };

    var hits = NONROUTINE.filter(function (r) { return r.re.test(low); });
    var wantHours = HOURS_RE.test(low), wantStock = STOCK_RE.test(low), wantDelivery = DELIVERY_RE.test(low);
    var pr = matchProducts(low), hasProduct = pr.ids.length > 0 || pr.ambiguous.length > 0;
    /* "Onko teillä auki?" is an hours question, not a stock question. */
    if (wantStock && !wantDelivery && !hasProduct && wantHours) wantStock = false;
    var kinds = [], answerable = [];
    if (wantHours) { kinds.push("opening hours"); answerable.push("opening hours"); }
    if (wantStock) { kinds.push("stock status"); if (hasProduct) answerable.push("stock status"); }
    if (wantDelivery) { kinds.push("delivery time"); if (hasProduct) answerable.push("delivery time"); }

    function escalate(owner, reason, flag) {
      out.category = "NOT_ROUTINE"; out.escalate_to = owner; out.reason = reason; out.flag = flag || "";
      out.draft = "none"; out.sources = []; out.verify = [];
      return out;
    }

    if (hits.length) {
      var mixed = answerable.length && hits[0].flag !== "injection";
      return escalate(hits[0].owner, mixed ? "Mixed email: routine part (" + answerable.join(", ") + ") plus non-routine part. " + hits[0].reason : hits[0].reason, hits[0].flag);
    }
    if (!kinds.length) return escalate("product_advisor", "No routine question found. The documents do not answer it.", "other");

    var parts = [];
    if (wantHours) parts.push(hoursPart(data, low, lang, out));
    if (wantStock || wantDelivery) {
      if (pr.ambiguous.length) return escalate("product_advisor", "The product is ambiguous (" + pr.ambiguous[0].join(" or ") + "). Staff should ask which one.", "ambiguous");
      if (!pr.ids.length) return escalate("product_advisor", "The product was not found in the stock list.", "unknown-product");
      for (var i = 0; i < pr.ids.length; i++) {
        var id = pr.ids[i], st = data.stock[id];
        if (wantDelivery && st.status !== "ORDER") return escalate("product_advisor", "Delivery time of an in-stock item is not in the documents (" + id + ").", "delivery-instock");
        if (wantDelivery) {
          var home = HOME_RE.test(low);
          parts.push(deliveryLine(data, id, lang, home));
          out.sources.push("stock-list.csv, " + id, "delivery-and-returns.md, Delivery");
        } else {
          parts.push(stockLine(data, id, lang));
          out.sources.push("stock-list.csv, " + id);
          if (st.status === "ORDER") out.sources.push("delivery-and-returns.md, Stock statuses");
        }
        out.verify.push("Stock status of " + id + " " + st.name + " (as of " + st.asOf + ")");
      }
    }
    if (!out.verify.length) out.verify.push("none");
    out.reason = "Routine question: " + kinds.join(" and ") + ".";
    var greet = lang === "fi" ? "Moi" + (name ? " " + name : "") + "!" : "Hi" + (name ? " " + name : "") + "!";
    var close = lang === "fi" ? "Mukavaa päivänjatkoa!" : "Have a good one!";
    out.draft = [greet].concat(parts, [close, "Peten rauta ja romu"]).join("\n\n");
    out.sources = out.sources.filter(function (s, i, a) { return a.indexOf(s) === i; });
    return out;
  }

  /* Customer-facing handoff text for NOT_ROUTINE. It is a fixed template, not model output,
     and it promises no time, price, discount or outcome. */
  var OWNERS = {
    fi: { customer_service_lead: "asiakaspalvelun vastaavalle", store_manager: "myymäläpäällikölle", product_advisor: "tuoteneuvojalle", finance: "talouspuolelle" },
    en: { customer_service_lead: "our customer service lead", store_manager: "the store manager", product_advisor: "our product advisor", finance: "our finance team" }
  };

  function handoff(lang, owner, flag, name) {
    var who = (OWNERS[lang] || OWNERS.en)[owner] || (lang === "fi" ? "henkilökunnalle" : "our staff");
    var n = name ? " " + name : "";
    var t = lang === "fi"
      ? "Moi" + n + "! Tähän kannattaa vastata ihmisen, joten välitin viestisi " + who + ". Joku meiltä vastaa sinulle."
      : "Hi" + n + "! This one is better answered by a person, so I passed your message to " + who + ". Someone from us will reply to you.";
    if (flag === "card") t += lang === "fi" ? " Ja muuten: älä lähetä korttitietoja sähköpostilla." : " By the way, please don't send card details by email.";
    return t;
  }

  function toBlock(r) {
    return [
      "CATEGORY: " + r.category,
      "REASON: " + r.reason,
      "ESCALATE_TO: " + r.escalate_to,
      "DRAFT: " + r.draft,
      "SOURCES: " + (r.sources.length ? r.sources.join("; ") : "none"),
      "VERIFY: " + (r.verify.length ? r.verify.join("; ") : "none")
    ].join("\n");
  }

  /* Parse a block returned by a real assistant (endpoint mode). */
  function parseBlock(text) {
    var keys = ["CATEGORY", "REASON", "ESCALATE_TO", "DRAFT", "SOURCES", "VERIFY"], res = {}, cur = null;
    String(text || "").split(/\r?\n/).forEach(function (line) {
      var m = line.match(/^\s*\**(CATEGORY|REASON|ESCALATE_TO|DRAFT|SOURCES|VERIFY)\**\s*:\s*(.*)$/);
      if (m) { cur = m[1]; res[cur] = m[2]; } else if (cur) res[cur] += "\n" + line;
    });
    keys.forEach(function (k) {
      var v = (res[k] || "").trim();
      res[k] = k === "DRAFT" ? v.replace(/^\*+\s*/, "") : v.replace(/[*`]/g, "").trim();
    });
    return {
      category: res.CATEGORY.replace(/[\s-]+/g, "_").toUpperCase(), reason: res.REASON,
      escalate_to: res.ESCALATE_TO.toLowerCase().replace(/[\s-]+/g, "_") || "none", draft: res.DRAFT,
      sources: res.SOURCES && res.SOURCES.toLowerCase() !== "none" ? [res.SOURCES] : [],
      verify: res.VERIFY && res.VERIFY.toLowerCase() !== "none" ? [res.VERIFY] : [], flag: "", lang: detectLang(String(res.DRAFT).toLowerCase())
    };
  }

  return { parseData: parseData, respond: respond, handoff: handoff, toBlock: toBlock, parseBlock: parseBlock, findName: findName, detectLang: detectLang };
});
