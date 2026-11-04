/* =========================================================
   SpVgg Pfreimd App – Programmlogik
   Aufbau:  Hilfsfunktionen → Live-Daten → Bausteine →
            Ansichten (News, Spiele, Teams, Shop, Mehr) →
            Detailseiten → Steuerung → Start
   ========================================================= */
(() => {
"use strict";
/* Inhalte (News, Termine, Teams, Stadionzeitung ...) stehen in daten/inhalte.json */
let S = null;
const SITE = "https://fussball.spvgg-pfreimd.de";
const WAPPEN = "img/wappen.webp";
const FUPA_SLUG = { m1: "spvgg-pfreimd-m1", m2: "spvgg-pfreimd-m2", m3: "spvgg-pfreimd-m3-2" };
const OWN = { m1: "Pfreimd", m2: "Pfreimd II", m3: "Pfreimd III" };
const TEAM_NAME = { m1: "1. Mannschaft", m2: "2. Mannschaft", m3: "3. Mannschaft" };

const state = { team: "m1", spMode: "spiele", cat: "Alle", fupa: {}, products: [], live: false };

/* ---------- Hilfsfunktionen ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const abs = p => p && p.startsWith("/") ? SITE + p : p;
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MON = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const toDate = k => { const [d, t = "00:00"] = k.split("T"); const [y, m, dd] = d.split("-").map(Number); const [h, mi] = t.split(":").map(Number); return new Date(y, m - 1, dd, h, mi); };
const two = n => String(n).padStart(2, "0");
const fDay = d => `${WD[d.getDay()]}, ${two(d.getDate())}.${two(d.getMonth() + 1)}.`;
const fTime = d => `${two(d.getHours())}:${two(d.getMinutes())}`;
const euro = n => n.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €";
const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
function inDays(d) {
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - today()) / 864e5);
  return diff === 0 ? "heute" : diff === 1 ? "morgen" : diff > 1 ? `in ${diff} Tagen` : "";
}
const matches = t => (state.fupa[t]?.sp || []).map(m => ({ k: m[0], d: toDate(m[0]), home: m[1], away: m[2], hg: m[3], ag: m[4], sec: m[5], res: m[6] }));
const nextMatch = t => matches(t).filter(m => m.sec !== "POST" && m.d >= today()).sort((a, b) => a.d - b.d)[0];
const lastMatch = t => matches(t).filter(m => m.sec === "POST").sort((a, b) => b.d - a.d)[0];
const own = (t, name) => name === OWN[t];
const RES = { win: "S", draw: "U", defeat: "N" };
function onImgError(img) { img.removeAttribute("src"); img.hidden = true; }
window.__imgErr = onImgError;
window.__imgOk = img => { img.hidden = false; };

/* ---------- Live-Daten von FuPa und aus dem Vereinsshop ----------
   Klappt der Abruf nicht (z. B. kein Netz), bleibt der Datenstand aus inhalte.json stehen. */
async function getJSON(url, ms = 6000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, { signal: ac.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
async function loadLive() {
  const isOwn = team => (team?.slug || "").includes("spvgg-pfreimd");
  try {
    const next = {};
    for (const t of Object.keys(FUPA_SLUG)) {
      const slug = FUPA_SLUG[t];
      const [st, mt] = await Promise.all([
        getJSON(`https://api.fupa.net/v1/widget/teams/${slug}/standings`),
        getJSON(`https://api.fupa.net/v2/widget/teams/${slug}/matches?categories=league`)
      ]);
      next[t] = {
        liga: st.competition?.name || S.fupa[t].liga,
        tab: st.standings.map(x => [x.rank, x.isRequestedTeam ? OWN[t] : x.team.name.middle, x.matches, x.wins, x.draws, x.defeats, x.ownGoals + ":" + x.againstGoals, x.goalDifference, x.points, x.mark || "", x.isRequestedTeam ? 1 : 0]),
        sp: mt.flatMap(mo => mo.matches).map(x => [x.kickoff.slice(0, 16),
          isOwn(x.homeTeam) ? OWN[t] : (x.homeTeam?.name?.middle || x.homeTeamName),
          isOwn(x.awayTeam) ? OWN[t] : (x.awayTeam?.name?.middle || x.awayTeamName),
          x.homeGoal, x.awayGoal, x.section, x.resultForTeam || ""])
      };
    }
    state.fupa = next; state.live = true;
    document.getElementById("src").textContent = "Live · FuPa";
    render();
  } catch (e) { /* kein Netz oder gesperrt: Datenstand bleibt */ }
}

/* ---------- Bausteine ---------- */
function matchRow(t, m, showTeam) {
  const pre = m.sec !== "POST";
  const badge = pre ? `<span class="badge b-pre" aria-hidden="true">–</span>` : `<span class="badge b-${m.res}" title="${m.res === "win" ? "Sieg" : m.res === "draw" ? "Unentschieden" : "Niederlage"}">${RES[m.res] || "–"}</span>`;
  return `<div class="row">${badge}
    <div class="teams">${showTeam ? `<div class="tagline">${TEAM_NAME[t]}</div>` : ""}
      <div class="meta">${fDay(m.d)} · ${fTime(m.d)} Uhr</div>
      <div class="${own(t, m.home) ? "own" : ""}">${esc(m.home)}</div>
      <div class="${own(t, m.away) ? "own" : ""}">${esc(m.away)}</div></div>
    ${pre ? `<div class="score time tabnum">${fTime(m.d)}</div>` : `<div class="score tabnum">${m.hg}:${m.ag}</div>`}
  </div>`;
}

/* ---------- Ansichten ---------- */
function viewNews() {
  const n1 = nextMatch("m1");
  const hero = n1 ? `<section class="next" aria-label="Nächstes Spiel">
      <div class="lbl"><span>Nächstes Spiel</span><span>${own("m1", n1.home) ? "Heim" : "Auswärts"}</span></div>
      <div class="vs"><div class="tm">${esc(n1.home)}</div><div class="mid tabnum">${fTime(n1.d)}<small>UHR</small></div><div class="tm">${esc(n1.away)}</div></div>
      <div class="when"><b>1. Mannschaft · ${fDay(n1.d)}</b><br>${esc(state.fupa.m1.liga)}${inDays(n1.d) ? `<span class="pill">${inDays(n1.d)}</span>` : ""}</div>
    </section>` : "";
  const minis = ["m2", "m3"].map(t => { const n = nextMatch(t); if (!n) return ""; const opp = own(t, n.home) ? n.away : n.home;
    return `<button class="card mini" data-go-team="${t}"><span class="t">${TEAM_NAME[t]}</span><span class="o">${own(t, n.home) ? "vs." : "bei"} ${esc(opp)}</span><span class="d">${fDay(n.d)} · ${fTime(n.d)} Uhr</span></button>`; }).join("");
  const results = ["m1", "m2", "m3"].map(t => { const m = lastMatch(t); return m ? matchRow(t, m, true) : ""; }).join("");
  const evs = S.events.filter(e => toDate(e.d) >= today());
  const events = evs.length ? `<section class="sec"><h2 class="h">Termine</h2><div class="events">${evs.map(e => { const d = toDate(e.d);
      return `<div class="card ev"><div class="cal"><i>${MON[d.getMonth()]}</i><b class="tabnum">${d.getDate()}</b></div><span>${esc(e.t)}</span></div>`; }).join("")}</div></section>` : "";
  const z = S.zeitung[0];
  return `${hero}
    <div class="minis">${minis}</div>
    <section class="sec"><h2 class="h">Letzte Ergebnisse <a href="#spiele">Alle Spiele</a></h2><div class="card rows">${results}</div></section>
    ${events}
    <section class="sec"><h2 class="h">Stadionzeitung</h2>
      <a class="card paper" href="${abs(z[2])}" target="_blank" rel="noopener"><span class="ic">PDF</span><span><span class="muted" style="font-size:13px">Ausgabe vom ${z[0]}</span><b>Heimspiel gegen ${esc(z[1])}</b></span><span class="go" aria-hidden="true">↗</span></a>
    </section>
    <section class="sec"><h2 class="h">Neuigkeiten</h2><div class="news">
      ${S.news.map((n, i) => `<button class="card nc" data-news="${i}">
        <img class="img" src="${abs(n.img)}" alt="" loading="lazy" hidden onload="__imgOk(this)" onerror="__imgErr(this)">
        <div class="tx"><span class="date">${esc(n.d)}</span><h3>${esc(n.t)}</h3><p>${esc(n.p[0])}</p></div></button>`).join("")}
    </div></section>`;
}

function viewSpiele() {
  const t = state.team, f = state.fupa[t];
  const segT = `<div class="seg red" role="group" aria-label="Mannschaft">${["m1", "m2", "m3"].map(x => `<button data-team="${x}" aria-pressed="${x === t}">${x.slice(1)}. Mannschaft</button>`).join("")}</div>`;
  const segM = `<div class="seg" role="group" aria-label="Ansicht"><button data-mode="spiele" aria-pressed="${state.spMode === "spiele"}">Spielplan</button><button data-mode="tabelle" aria-pressed="${state.spMode === "tabelle"}">Tabelle</button></div>`;
  let body;
  if (state.spMode === "tabelle") {
    body = `<div class="card tblwrap"><table class="tabnum"><thead><tr><th>#</th><th>Mannschaft</th><th>Sp</th><th class="opt">S</th><th class="opt">U</th><th class="opt">N</th><th class="opt">Tore</th><th>Diff</th><th>Pkt</th></tr></thead><tbody>
      ${f.tab.map(r => `<tr class="${r[9]} ${r[10] ? "me" : ""}"><td class="rk">${r[0]}</td><td>${esc(r[1])}</td><td>${r[2]}</td><td class="opt">${r[3]}</td><td class="opt">${r[4]}</td><td class="opt">${r[5]}</td><td class="opt">${r[6]}</td><td>${r[7] > 0 ? "+" + r[7] : r[7]}</td><td>${r[8]}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="legend"><span><i style="background:var(--up)"></i>Aufstieg / Relegation</span><span><i style="background:var(--down)"></i>Abstieg / Relegation</span></div>`;
  } else {
    const all = matches(t);
    const up = all.filter(m => m.sec !== "POST").sort((a, b) => a.d - b.d);
    const done = all.filter(m => m.sec === "POST").sort((a, b) => b.d - a.d);
    const tally = done.reduce((a, m) => (a[m.res] = (a[m.res] || 0) + 1, a), {});
    body = `${up.length ? `<section class="sec"><h3 class="h">Kommende Spiele</h3><div class="card rows">${up.map(m => matchRow(t, m)).join("")}</div></section>` : ""}
      <section class="sec"><h3 class="h">Ergebnisse <span class="muted tabnum" style="font-size:13px;letter-spacing:.04em">${tally.win || 0} S · ${tally.draw || 0} U · ${tally.defeat || 0} N</span></h3><div class="card rows">${done.map(m => matchRow(t, m)).join("")}</div></section>`;
  }
  return `${segT}<div class="liga"><span>${esc(f.liga)} · Saison 2026/27</span><span class="muted">Daten: FuPa</span></div>${segM}${body}`;
}

function viewTeams() {
  return S.teams.map(tm => {
    const f = state.fupa[tm.id]; const me = f?.tab.find(r => r[10]);
    const stats = me ? `<div class="stats tabnum"><div><b>${me[0]}.</b><span>Platz</span></div><div><b>${me[8]}</b><span>Punkte</span></div><div><b>${me[6]}</b><span>Tore</span></div></div>` : "";
    const staff = tm.staff.length ? `<dl class="staff">${tm.staff.map(s => `<dt>${esc(s[0])}</dt><dd>${esc(s[1])}</dd>`).join("")}</dl>` : "";
    const label = tm.id === "ah" ? "AH" : tm.id.slice(1) + ".";
    return `<article class="card team">
      <div class="ph"><span>${label}</span><img src="${abs(tm.img)}" alt="Mannschaftsfoto ${esc(tm.name)}" loading="lazy" hidden onload="__imgOk(this)" onerror="__imgErr(this)"></div>
      <div class="bd"><div><h3>${esc(tm.name)}</h3><div class="muted" style="font-size:14.5px">${esc(f?.liga || tm.liga)}</div></div>
        ${stats}${staff}
        ${f ? `<div><button class="btn" data-go-team="${tm.id}">Spielplan & Tabelle</button></div>` : ""}
      </div></article>`;
  }).join("");
}

function viewShop() {
  const cats = ["Alle", "Freizeitbekleidung", "Sportausrüstung", "Accessoires", "Geschenke"];
  const items = state.products.filter(p => state.cat === "Alle" || p[1] === state.cat);
  return `<div class="note">Stöbern in der App, bestellen und bezahlen im Vereinsshop. Ein Tipp auf einen Artikel öffnet ihn dort.</div>
    <div class="chips" role="group" aria-label="Kategorie">${cats.map(c => `<button class="chip" data-cat="${c}" aria-pressed="${c === state.cat}">${c}</button>`).join("")}</div>
    <div class="grid">${items.map(p => `<a class="card prod" href="${abs(p[4])}" target="_blank" rel="noopener">
      <div class="pi"><img class="ph" src="${WAPPEN}" alt=""><img class="real" src="${abs(p[5])}" alt="${esc(p[0])}" loading="lazy" hidden onload="__imgOk(this)" onerror="__imgErr(this)"></div>
      <div class="pb"><b>${esc(p[0])}</b>${p[3] ? `<span class="var">${esc(p[3])}</span>` : ""}<span class="pr tabnum">${p[6] ? "ab " : ""}${euro(p[2])}</span></div></a>`).join("")}</div>`;
}

function viewMehr() {
  const L = (label, href, sub) => `<a class="li" href="${abs(href)}" target="_blank" rel="noopener"><span>${label}${sub ? `<small>${sub}</small>` : ""}</span><span class="ext" aria-hidden="true">↗</span></a>`;
  const B = (label, key, sub) => `<button class="li" data-sheet="${key}"><span>${label}${sub ? `<small>${sub}</small>` : ""}</span><span class="chev" aria-hidden="true">›</span></button>`;
  return `<section class="sec"><h2 class="h">Verein</h2><div class="card list">
      ${B("Spartenbesetzung", "sparte", "Spartenleitung, Trainer und Betreuer")}
      ${B("Historie", "historie", "Erfolge seit 2013")}
      ${B("Vereinshymne", "hymne", "„Die Rot-Weißen“")}
      ${L("Sponsoren", "/sponsoren/", "Unsere Partner auf der Homepage")}
      ${L("Satzung", "/wp-content/uploads/2026/06/Satzung.pdf", "PDF")}
    </div></section>
    <section class="sec"><h2 class="h">Stadionzeitung</h2><div class="card list">${B("Archiv", "zeitung", `${S.zeitung.length} Ausgaben seit März 2026`)}</div></section>
    <section class="sec"><h2 class="h">Service</h2><div class="card list">
      ${B("Anfahrt", "anfahrt", "Vereinsheim und Trainingsgelände")}
      ${B("Kontakt", "kontakt", "E-Mail und Kontaktformular")}
      ${L("Unfallmeldung", "/unfallmeldung/", "Formular auf der Homepage")}
      ${L("Mitglied werden", "https://www.spvgg-pfreimd.de/beitritt1.pdf", "Beitrittserklärung als PDF")}
      ${L("Jugendfußball", "https://jugendfussball.spvgg-pfreimd.de/", "Homepage der Jugend")}
    </div></section>
    <section class="sec"><h2 class="h">Rechtliches</h2><div class="card list">${L("Impressum", "/impressum/")}${L("Datenschutz", "/datenschutz/")}</div></section>
    <div class="foot"><b>Rot-Weiß ein Leben lang!</b>SpVgg Pfreimd · Abteilung Fußball · Prototyp 0.1</div>`;
}

/* ---------- Detailseiten ---------- */
const SHEETS = {
  sparte: () => `<h2 id="sheet-title">Spartenbesetzung</h2><p class="muted">Unsere ehrenamtlichen Verantwortlichen der Sparte Fußball.</p>
    ${S.sparte.map(([g, rows]) => `<section class="sec"><h3 class="h">${esc(g)}</h3><div class="card kv">${rows.map(r => `<div><span>${esc(r[0])}</span>${esc(r[1])}</div>`).join("")}</div></section>`).join("")}`,
  historie: () => `<h2 id="sheet-title">Historie</h2><ol class="tl" reversed>${[...S.historie].reverse().map(h => `<li><span class="when">${esc(h[0])}</span><b>${esc(h[1])}</b>${h[2] ? `<p>${esc(h[2])}</p>` : ""}</li>`).join("")}</ol>`,
  hymne: () => `<h2 id="sheet-title">Vereinshymne</h2><p><b>„Die Rot-Weißen“</b></p><p class="muted">Text: Christian Modl & die Ultras · Musik: Christian Modl · Arrangement: Marc Hohl · © 2015</p>
    <div><a class="btn" href="${SITE}/vereinshymne/" target="_blank" rel="noopener">Hymne anhören ↗</a></div>`,
  zeitung: () => `<h2 id="sheet-title">Stadionzeitung</h2><div class="card list">${S.zeitung.map(z => `<a class="li" href="${abs(z[2])}" target="_blank" rel="noopener"><span>${esc(z[1])}<small class="tabnum">${z[0]}</small></span><span class="ext" aria-hidden="true">PDF ↗</span></a>`).join("")}</div>`,
  anfahrt: () => `<h2 id="sheet-title">Anfahrt</h2><div class="card kv"><div><span>Anschrift</span>Fußball Pfreimd<br>Stadtgraben 15, 92536 Pfreimd</div></div>
    <div><a class="btn" href="https://www.google.com/maps/place/SpVgg+Pfreimd+e.V.+-+Abteilung+Fu%C3%9Fball/@49.4955602,12.1798444,17z" target="_blank" rel="noopener">In Google Maps öffnen ↗</a></div>`,
  kontakt: () => `<h2 id="sheet-title">Kontakt</h2><p>Schreib uns direkt per E-Mail oder nutze das Formular auf der Homepage.</p>
    <div class="copy"><code id="mail">info@fussball.spvgg-pfreimd.de</code><button class="btn ghost" data-copy="mail" type="button">Kopieren</button></div>
    <div><a class="btn" href="${SITE}/kontakt/" target="_blank" rel="noopener">Kontaktformular öffnen ↗</a></div>`
};
let lastFocus = null;
function openSheet(html) {
  lastFocus = document.activeElement;
  document.getElementById("sheet-body").innerHTML = html;
  const s = document.getElementById("sheet"); s.hidden = false; s.scrollTop = 0;
  document.body.style.overflow = "hidden";
  document.getElementById("back").focus();
}
function closeSheet() {
  document.getElementById("sheet").hidden = true; document.body.style.overflow = "";
  lastFocus?.focus?.();
}
function openNews(i) {
  const n = S.news[i];
  openSheet(`<span class="date">${esc(n.d)}</span><h2 id="sheet-title">${esc(n.t)}</h2>
    <img class="hero" src="${abs(n.img)}" alt="" hidden onload="__imgOk(this)" onerror="__imgErr(this)">
    ${n.p.map(p => `<p>${esc(p)}</p>`).join("")}`);
}

/* ---------- Steuerung ---------- */
const VIEWS = { news: viewNews, spiele: viewSpiele, teams: viewTeams, shop: viewShop, mehr: viewMehr };
const current = () => { const h = location.hash.slice(1); return VIEWS[h] ? h : "news"; };
function render() {
  const v = current(); const el = document.getElementById("view");
  el.innerHTML = VIEWS[v]();
  document.querySelectorAll(".tabs a").forEach(a => { if (a.dataset.tab === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
}
window.addEventListener("hashchange", () => { closeSheet(); render(); window.scrollTo(0, 0); });
document.addEventListener("click", e => {
  const b = e.target.closest("[data-team],[data-mode],[data-cat],[data-news],[data-sheet],[data-go-team],[data-copy]");
  if (!b) return;
  const d = b.dataset;
  if (d.team) { state.team = d.team; render(); }
  else if (d.mode) { state.spMode = d.mode; render(); }
  else if (d.cat) { state.cat = d.cat; render(); }
  else if (d.news) openNews(+d.news);
  else if (d.sheet) openSheet(SHEETS[d.sheet]());
  else if (d.goTeam) { state.team = d.goTeam; state.spMode = "spiele"; if (current() === "spiele") render(); else location.hash = "spiele"; }
  else if (d.copy) {
    const txt = document.getElementById(d.copy).textContent;
    const done = () => { b.textContent = "Kopiert"; setTimeout(() => b.textContent = "Kopieren", 1600); };
    try { navigator.clipboard.writeText(txt).then(done, () => selectText(d.copy)); } catch { selectText(d.copy); }
  }
});
function selectText(id) { const r = document.createRange(); r.selectNodeContents(document.getElementById(id)); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
document.getElementById("back").addEventListener("click", closeSheet);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !document.getElementById("sheet").hidden) closeSheet(); });

/* ---------- Shop live aus WooCommerce ---------- */
function variantText(attrs) {
  const parts = [];
  for (const a of attrs || []) {
    const t = a.terms.map(x => x.name);
    if (!t.length) continue;
    if (/farbe/i.test(a.name)) parts.push(`${t.length} Farben`);
    else if (/schnitt/i.test(a.name)) parts.push(t.length > 1 ? t.slice(0, -1).join(", ") + " & " + t.at(-1) : t[0]);
    else if (/größe/i.test(a.name) && !attrs.some(b => /schnitt/i.test(b.name))) parts.push(t.length > 2 ? `${t[0]}–${t.at(-1)}` : t.join(" / "));
    else if (/betrag/i.test(a.name)) parts.push(t.join(" / "));
  }
  return parts.join(" · ");
}
async function loadShop() {
  try {
    const list = await getJSON(`${SITE}/wp-json/wc/store/v1/products?per_page=100`);
    const dec = s => { const t = document.createElement("textarea"); t.innerHTML = s; return t.value; };
    state.products = list.map(p => {
      const div = 10 ** (p.prices.currency_minor_unit ?? 2);
      const range = p.prices.price_range;
      return [dec(p.name), p.categories[0]?.name || "Sportausrüstung", (range ? +range.min_amount : +p.prices.price) / div,
        variantText(p.attributes), p.permalink, p.images?.[0]?.src || "", range && range.min_amount !== range.max_amount ? 1 : 0];
    });
    if (current() === "shop") render();
  } catch (e) { /* Datenstand aus inhalte.json bleibt */ }
}

/* ---------- Start ---------- */
async function start() {
  try {
    S = await getJSON("daten/inhalte.json?v=" + Date.now().toString(36).slice(0, -3), 8000);
  } catch (e) {
    document.getElementById("view").innerHTML = `<p class="note">Die Inhalte konnten nicht geladen werden. Bitte prüfe deine Internetverbindung und lade die Seite neu.</p>`;
    return;
  }
  state.fupa = { ...S.fupa };
  state.products = S.products;
  const [, m, d] = S.stand.split("-");
  document.getElementById("src").textContent = `Stand ${d}.${m}.`;
  render();
  loadLive();
  loadShop();
}
start();

/* Offline-Fähigkeit und Installierbarkeit */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
})();
