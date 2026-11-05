/* =========================================================
   SpVgg Pfreimd App – Programmlogik
   Aufbau:  Hilfsfunktionen → Live-Daten (FuPa, BFV, Fotos) → Bausteine →
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
const HERREN = ["m1", "m2", "m3"];
/* Jugend: Spiele und Tabellen live vom BFV (Datenschnittstelle der BFV-Widgets) */
const BFV = "https://widget-prod.bfv.de/api/service/widget/v1/";

const state = { team: "m1", spMode: "spiele", cat: "Alle", group: "herren",
  fupa: {}, bfv: {}, photos: {}, products: [], live: false };

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
const isYouth = t => !HERREN.includes(t);
const youth = t => (S?.jugend || []).find(j => j.id === t);
const teamName = t => TEAM_NAME[t] || youth(t)?.name || t;
const ownName = t => OWN[t] || "Pfreimd";
const teamData = t => isYouth(t) ? state.bfv[t] : state.fupa[t];
/* Spiel-Zeile: [Anstoß, Heim, Gast, Tore Heim, Tore Gast, Status (PRE/POST/OFF), Ergebnis, Wettbewerb, Hinweis] */
const matches = t => (teamData(t)?.sp || []).map(m => ({ k: m[0], d: toDate(m[0]), home: m[1], away: m[2], hg: m[3], ag: m[4], sec: m[5], res: m[6], note: m[7] || "", status: m[8] || "" }));
const isUpcoming = m => m.sec !== "POST" && m.sec !== "OFF" && m.d >= today();
const nextMatch = t => matches(t).filter(isUpcoming).sort((a, b) => a.d - b.d)[0];
const lastMatch = t => matches(t).filter(m => m.sec === "POST").sort((a, b) => b.d - a.d)[0];
const own = (t, name) => name === ownName(t);
const RES = { win: "S", draw: "U", defeat: "N" };
function onImgError(img) { img.removeAttribute("src"); img.hidden = true; }
window.__imgErr = onImgError;
/* Bilder werden erst eingeblendet, wenn sie geladen sind (sie laden sofort, nicht erst beim Scrollen) */
window.__imgOk = img => { img.removeAttribute("data-wait"); };

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
    invalidate(); render();
  } catch (e) { /* kein Netz oder gesperrt: Datenstand bleibt */ }
}

/* ---------- Jugend live vom BFV ---------- */
const deDate = (d, t) => { const [dd, mm, yy] = String(d).split("."); return `${yy}-${mm}-${dd}T${t || "00:00"}`; };
const STATUS = { "Abse.": "abgesetzt", "Ausf.": "ausgefallen", "Annul.": "annulliert", "Verl.": "verlegt", "Abbr.": "abgebrochen" };
async function loadBfvTeam(j) {
  try {
    const [mt, tb] = await Promise.all([
      getJSON(`${BFV}team/${j.bfvTeam}/matches`, 10000),
      getJSON(`${BFV}competition/${j.bfvLiga}/table`, 10000).catch(() => null)
    ]);
    const me = j.bfvTeam;
    const sp = (mt.data?.matches || []).map(x => {
      const homeOwn = x.homeTeamPermanentId === me;
      const txt = String(x.result || "").trim();
      const sc = /^(\d+)\s*:\s*(\d+)/.exec(txt);
      let sec = "PRE", res = "", hg = null, ag = null, status = "";
      if (sc) {
        hg = +sc[1]; ag = +sc[2]; sec = "POST";
        const diff = homeOwn ? hg - ag : ag - hg;
        res = diff > 0 ? "win" : diff < 0 ? "defeat" : "draw";
      } else if (txt && !/^[-:\s]*$/.test(txt)) { sec = "OFF"; status = STATUS[txt] || txt; }
      const note = /meister/i.test(x.competitionType || "") ? "" : (x.competitionType || "").replace(/spiele$/, "spiel");
      return [deDate(x.kickoffDate, x.kickoffTime),
        homeOwn ? "Pfreimd" : x.homeTeamName, x.guestTeamPermanentId === me ? "Pfreimd" : x.guestTeamName,
        hg, ag, sec, res, note, status];
    });
    let tab = [];
    const t = tb?.data?.table;
    if (t?.length) {
      const c = tb.data.configuration || {}, n = t.length;
      const up1 = c.promotionTeamCount || 0, up2 = up1 + (c.promotionPlayoffTeamCount || 0);
      const dn1 = n - (c.relegationTeamCount || 0), dn2 = dn1 - (c.relegationPlayoffTeamCount || 0);
      tab = t.map(r => {
        const pos = r.position, mine = r.team?.permanentId === me;
        const mark = pos <= up1 ? "up1" : pos <= up2 ? "up2" : pos > dn1 ? "down1" : pos > dn2 ? "down2" : "";
        return [pos, mine ? "Pfreimd" : r.team?.name, r.matches, r.matchesWon, r.matchesDrawn, r.matchesLost, "", r.goalsDiff, r.points, mark, mine ? 1 : 0];
      });
    }
    state.bfv[j.id] = { liga: tb?.data?.competitionName || mt.data?.team?.competitionName || j.liga, tab, sp, ok: true };
  } catch (e) {
    state.bfv[j.id] = { liga: j.liga, tab: [], sp: [], ok: false };
  }
}
async function loadYouth() {
  await Promise.all(S.jugend.filter(j => j.bfvTeam).map(loadBfvTeam));
  invalidate(); render(); refreshSheet();
}
/* Mannschaftsfotos der Jugend: erstes großes Bild der jeweiligen Homepage-Seite */
async function loadPhotos() {
  try { Object.assign(state.photos, JSON.parse(localStorage.getItem("spvgg-fotos") || "{}")); } catch (e) {}
  const ids = S.jugend.map(j => j.page).filter(Boolean);
  try {
    const pages = await getJSON(`${SITE}/wp-json/wp/v2/pages?include=${ids.join(",")}&per_page=50&_fields=id,content`, 12000);
    for (const pg of pages) {
      const imgs = [...String(pg.content?.rendered || "").matchAll(/<img[^>]*>/gi)].map(m => m[0]);
      const big = imgs.find(tag => +(/width="(\d+)"/.exec(tag)?.[1] || 0) >= 500);
      const src = big && /src="([^"]+)"/.exec(big)?.[1];
      if (src) state.photos[pg.id] = src; else delete state.photos[pg.id];
    }
    try { localStorage.setItem("spvgg-fotos", JSON.stringify(state.photos)); } catch (e) {}
  } catch (e) { /* ohne Fotos geht es auch */ }
  if (panes.teams) panes.teams.dirty = true;
  if (current() === "teams") render();
  refreshSheet();
}

/* ---------- Bausteine ---------- */
function matchRow(t, m, showTeam) {
  const played = m.sec === "POST", upcoming = isUpcoming(m);
  const badge = played ? `<span class="badge b-${m.res}" title="${m.res === "win" ? "Sieg" : m.res === "draw" ? "Unentschieden" : "Niederlage"}">${RES[m.res] || "–"}</span>` : `<span class="badge b-pre" aria-hidden="true">–</span>`;
  const right = played ? `<div class="score tabnum">${m.hg}:${m.ag}</div>`
    : upcoming ? `<div class="score time tabnum">${fTime(m.d)}</div>`
    : `<div class="score state">${esc(m.status || "offen")}</div>`;
  return `<div class="row">${badge}
    <div class="teams">${showTeam ? `<div class="tagline">${esc(teamName(t))}</div>` : ""}
      <div class="meta">${fDay(m.d)} · ${fTime(m.d)} Uhr${m.note ? ` · ${esc(m.note)}` : ""}</div>
      <div class="${own(t, m.home) ? "own" : ""}">${esc(m.home)}</div>
      <div class="${own(t, m.away) ? "own" : ""}">${esc(m.away)}</div></div>
    ${right}
  </div>`;
}
function tableHtml(f, compact) {
  if (!f.tab?.length) return `<p class="note">Für diese Mannschaft gibt es keine Tabelle.</p>`;
  const opt = compact ? "opt-x" : "opt";
  return `<div class="card tblwrap"><table class="tabnum"><thead><tr><th>#</th><th>Mannschaft</th><th>Sp</th><th class="${opt}">S</th><th class="${opt}">U</th><th class="${opt}">N</th>${f.tab[0][6] ? `<th class="${opt}">Tore</th>` : ""}<th>Diff</th><th>Pkt</th></tr></thead><tbody>
    ${f.tab.map(r => `<tr class="${r[9]} ${r[10] ? "me" : ""}"><td class="rk">${r[0]}</td><td>${esc(r[1])}</td><td>${r[2]}</td><td class="${opt}">${r[3]}</td><td class="${opt}">${r[4]}</td><td class="${opt}">${r[5]}</td>${f.tab[0][6] ? `<td class="${opt}">${r[6]}</td>` : ""}<td>${r[7] > 0 ? "+" + r[7] : r[7]}</td><td>${r[8]}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="legend"><span><i style="background:var(--win)"></i>Aufstieg / Relegation</span><span><i style="background:var(--loss)"></i>Abstieg / Relegation</span></div>`;
}

/* ---------- Ansichten ---------- */
function viewNews() {
  const n1 = nextMatch("m1");
  const hero = n1 ? `<section class="next" aria-label="Nächstes Spiel">
      <div class="lbl"><span>Nächstes Spiel</span><span>${own("m1", n1.home) ? "Heim" : "Auswärts"}</span></div>
      <div class="vs"><div class="tm">${esc(n1.home)}</div><div class="mid tabnum">${fTime(n1.d)}<small>Uhr</small></div><div class="tm">${esc(n1.away)}</div></div>
      <div class="when"><b>1. Mannschaft · ${fDay(n1.d)}</b><br>${esc(state.fupa.m1.liga)}${inDays(n1.d) ? `<span class="pill">${inDays(n1.d)}</span>` : ""}</div>
    </section>` : "";
  const minis = ["m2", "m3"].map(t => { const n = nextMatch(t); if (!n) return ""; const opp = own(t, n.home) ? n.away : n.home;
    return `<button class="card mini" data-go-team="${t}"><span class="t">${TEAM_NAME[t]}</span><span class="o">${own(t, n.home) ? "vs." : "bei"} ${esc(opp)}</span><span class="d">${fDay(n.d)} · ${fTime(n.d)} Uhr</span></button>`; }).join("");
  const results = ["m1", "m2", "m3"].map(t => { const m = lastMatch(t); return m ? matchRow(t, m, true) : ""; }).join("");
  /* Jugend: Spiele der nächsten 7 Tage, sonst Ergebnisse der letzten 7 Tage */
  const yt = S.jugend.filter(j => j.bfvTeam).map(j => j.id);
  const day = 864e5, now = today();
  const ySoon = yt.flatMap(t => matches(t).filter(m => isUpcoming(m) && m.d - now < 8 * day).map(m => [t, m])).sort((a, b) => a[1].d - b[1].d);
  const yPast = yt.flatMap(t => matches(t).filter(m => m.sec === "POST" && now - m.d < 8 * day).map(m => [t, m])).sort((a, b) => b[1].d - a[1].d);
  const yList = ySoon.length ? ySoon : yPast;
  const youthBlock = yList.length ? `<section class="sec"><h2 class="h">${ySoon.length ? "Jugend diese Woche" : "Jugend: letzte Ergebnisse"} <a href="#teams" data-group="jugend">Alle Teams</a></h2>
    <div class="card rows">${yList.slice(0, 8).map(([t, m]) => matchRow(t, m, true)).join("")}</div></section>` : "";
  const evs = S.events.filter(e => toDate(e.d) >= today());
  const events = evs.length ? `<section class="sec"><h2 class="h">Termine</h2><div class="events">${evs.map(e => { const d = toDate(e.d);
      return `<div class="card ev"><div class="cal"><i>${MON[d.getMonth()]}</i><b class="tabnum">${d.getDate()}</b></div><span>${esc(e.t)}</span></div>`; }).join("")}</div></section>` : "";
  const z = S.zeitung[0];
  return `${hero}
    <div class="minis">${minis}</div>
    <section class="sec"><h2 class="h">Letzte Ergebnisse <a href="#spiele">Alle Spiele</a></h2><div class="card rows">${results}</div></section>
    ${youthBlock}
    ${events}
    <section class="sec"><h2 class="h">Stadionzeitung</h2>
      <a class="card paper" href="${abs(z[2])}" target="_blank" rel="noopener"><span class="ic">PDF</span><span><span class="muted" style="font-size:13px">Ausgabe vom ${z[0]}</span><b>Heimspiel gegen ${esc(z[1])}</b></span><span class="go" aria-hidden="true">↗</span></a>
    </section>
    <section class="sec"><h2 class="h">Neuigkeiten</h2><div class="news">
      ${S.news.map((n, i) => `<button class="card nc" data-news="${i}">
        <img class="img" src="${abs(n.img)}" alt="" decoding="async" data-wait onload="__imgOk(this)" onerror="__imgErr(this)">
        <div class="tx"><span class="date">${esc(n.d)}</span><h3>${esc(n.t)}</h3><p>${esc(n.p[0])}</p></div></button>`).join("")}
    </div></section>`;
}

function viewSpiele() {
  const t = state.team, f = teamData(t);
  const all = [...HERREN.map(x => [x, TEAM_NAME[x]]), ...S.jugend.filter(j => j.bfvTeam).map(j => [j.id, j.name])];
  const chips = `<div class="chips teamchips" role="group" aria-label="Mannschaft">${all.map(([id, n], i) =>
    `${i === HERREN.length ? `<span class="chipsep" aria-hidden="true"></span>` : ""}<button class="chip" data-team="${id}" aria-pressed="${id === t}">${esc(n)}</button>`).join("")}</div>`;
  const segM = `<div class="seg" role="group" aria-label="Ansicht"><button data-mode="spiele" aria-pressed="${state.spMode === "spiele"}">Spielplan</button><button data-mode="tabelle" aria-pressed="${state.spMode === "tabelle"}">Tabelle</button></div>`;
  const src = isYouth(t) ? "BFV" : "FuPa";
  if (!f) return `${chips}<p class="note">Spiele und Tabelle werden geladen …</p>`;
  if (f.ok === false) return `${chips}<p class="note">Die Daten vom BFV sind gerade nicht erreichbar. Bitte versuche es später noch einmal.</p>
    <div><a class="btn ghost" href="${SITE}/${youth(t).seite}/" target="_blank" rel="noopener">Seite auf der Homepage ↗</a></div>`;
  let body;
  if (state.spMode === "tabelle") body = tableHtml(f);
  else {
    const all = matches(t);
    const up = all.filter(isUpcoming).sort((a, b) => a.d - b.d);
    const done = all.filter(m => !isUpcoming(m)).sort((a, b) => b.d - a.d);
    const tally = done.filter(m => m.sec === "POST").reduce((a, m) => (a[m.res] = (a[m.res] || 0) + 1, a), {});
    body = `${up.length ? `<section class="sec"><h3 class="h">Kommende Spiele</h3><div class="card rows">${up.map(m => matchRow(t, m)).join("")}</div></section>` : ""}
      ${done.length ? `<section class="sec"><h3 class="h">Ergebnisse <span class="muted tabnum" style="font-size:13px">${tally.win || 0} S · ${tally.draw || 0} U · ${tally.defeat || 0} N</span></h3><div class="card rows">${done.map(m => matchRow(t, m)).join("")}</div></section>` : ""}
      ${!up.length && !done.length ? `<p class="note">Noch keine Spiele eingetragen.</p>` : ""}`;
  }
  return `${chips}<div class="liga"><span>${esc(f.liga)} · Saison 2026/27</span><span class="muted">Daten: ${src}</span></div>${segM}${body}`;
}

function viewTeams() {
  const seg = `<div class="seg" role="group" aria-label="Bereich"><button data-group="herren" aria-pressed="${state.group === "herren"}">Herren</button><button data-group="jugend" aria-pressed="${state.group === "jugend"}">Jugend</button></div>`;
  if (state.group === "jugend") return seg + `<div class="ylist">${S.jugend.map(youthCard).join("")}</div>`;
  return seg + S.teams.map(tm => {
    const f = state.fupa[tm.id]; const me = f?.tab.find(r => r[10]);
    const stats = me ? `<div class="stats tabnum"><div><b>${me[0]}.</b><span>Platz</span></div><div><b>${me[8]}</b><span>Punkte</span></div><div><b>${me[6]}</b><span>Tore</span></div></div>` : "";
    const staff = tm.staff.length ? `<dl class="staff">${tm.staff.map(s => `<dt>${esc(s[0])}</dt><dd>${esc(s[1])}</dd>`).join("")}</dl>` : "";
    const label = tm.id === "ah" ? "AH" : tm.id.slice(1) + ".";
    return `<article class="card team">
      <div class="ph"><span>${label}</span><img src="${abs(tm.img)}" alt="Mannschaftsfoto ${esc(tm.name)}" decoding="async" data-wait onload="__imgOk(this)" onerror="__imgErr(this)"></div>
      <div class="bd"><div><h3>${esc(tm.name)}</h3><div class="muted" style="font-size:14.5px">${esc(f?.liga || tm.liga)}</div></div>
        ${stats}${staff}
        ${f ? `<div><button class="btn" data-go-team="${tm.id}">Spielplan & Tabelle</button></div>` : ""}
      </div></article>`;
  }).join("");
}
function youthPhoto(j) { return state.photos[j.page] || ""; }
function youthCard(j) {
  const f = state.bfv[j.id], me = f?.tab?.find(r => r[10]);
  const ph = youthPhoto(j);
  return `<a class="card yt" href="#teams/${j.id}">
    <span class="yph">${ph ? `<img src="${esc(ph)}" alt="" decoding="async" data-wait onload="__imgOk(this)" onerror="__imgErr(this)">` : ""}<b>${esc(j.id.toUpperCase())}</b></span>
    <span class="ytx"><b>${esc(j.name)}</b><span>${esc(j.alter)}${j.bfvTeam ? ` · ${esc(f?.liga || j.liga)}` : ""}</span></span>
    ${me ? `<span class="ypos tabnum"><b>${me[0]}.</b><small>Platz</small></span>` : `<span class="chev" aria-hidden="true">›</span>`}
  </a>`;
}
/* Mannschaftsseite einer Jugend (#teams/b) */
function youthSheet(id) {
  const j = youth(id), f = state.bfv[id], ph = youthPhoto(j);
  let data = "";
  if (j.bfvTeam) {
    if (!f) data = `<p class="note">Spiele und Tabelle werden geladen …</p>`;
    else if (!f.ok) data = `<p class="note">Die Daten vom BFV sind gerade nicht erreichbar.</p>`;
    else {
      const me = f.tab.find(r => r[10]);
      const all = matches(id);
      const up = all.filter(isUpcoming).sort((a, b) => a.d - b.d).slice(0, 2);
      const done = all.filter(m => m.sec === "POST").sort((a, b) => b.d - a.d).slice(0, 3);
      data = `${me ? `<div class="stats tabnum"><div><b>${me[0]}.</b><span>Platz</span></div><div><b>${me[8]}</b><span>Punkte</span></div><div><b>${me[2]}</b><span>Spiele</span></div></div>` : ""}
        ${up.length ? `<section class="sec"><h3 class="h">Nächste Spiele</h3><div class="card rows">${up.map(m => matchRow(id, m)).join("")}</div></section>` : ""}
        ${done.length ? `<section class="sec"><h3 class="h">Letzte Ergebnisse</h3><div class="card rows">${done.map(m => matchRow(id, m)).join("")}</div></section>` : ""}
        ${f.tab.length ? `<section class="sec"><h3 class="h">Tabelle</h3>${tableHtml(f, true)}</section>` : ""}
        <div><button class="btn" data-go-team="${id}">Alle Spiele</button></div>`;
    }
  }
  return `${ph ? `<img class="hero" src="${esc(ph)}" alt="Mannschaftsfoto ${esc(j.name)}" data-wait onload="__imgOk(this)" onerror="__imgErr(this)">` : ""}
    <div><h2 id="sheet-title">${esc(j.name)}</h2><div class="muted">${esc(j.alter)}${j.bfvTeam ? ` · ${esc(f?.liga || j.liga)}` : ""}</div></div>
    ${data}
    ${j.trainer?.length ? `<section class="sec"><h3 class="h">Trainerteam</h3><div class="card kv">${j.trainer.map(n => `<div>${esc(n)}</div>`).join("")}</div></section>` : ""}
    <div><a class="btn ghost" href="${SITE}/${j.seite}/" target="_blank" rel="noopener">Seite auf der Homepage ↗</a></div>`;
}

function viewShop() {
  const cats = ["Alle", "Freizeitbekleidung", "Sportausrüstung", "Accessoires", "Geschenke"];
  const items = state.products.filter(p => state.cat === "Alle" || p[1] === state.cat);
  return `<div class="note">Stöbern in der App, bestellen und bezahlen im Vereinsshop. Ein Tipp auf einen Artikel öffnet ihn dort.</div>
    <div class="chips" role="group" aria-label="Kategorie">${cats.map(c => `<button class="chip" data-cat="${c}" aria-pressed="${c === state.cat}">${c}</button>`).join("")}</div>
    <div class="grid">${items.map(p => `<a class="card prod" href="${abs(p[4])}" target="_blank" rel="noopener">
      <div class="pi"><img class="ph" src="${WAPPEN}" alt=""><img class="real" src="${abs(p[5])}" alt="${esc(p[0])}" decoding="async" data-wait onload="__imgOk(this)" onerror="__imgErr(this)"></div>
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
    <div class="foot"><b>Rot-Weiß ein Leben lang!</b>SpVgg Pfreimd · Abteilung Fußball · Version 1.6</div>`;
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
  if (document.getElementById("sheet").hidden) lastFocus = document.activeElement;
  document.getElementById("sheet-body").innerHTML = html;
  const s = document.getElementById("sheet"); s.hidden = false; s.scrollTop = 0;
  document.body.style.overflow = "hidden";
  document.getElementById("back").focus();
}
function closeSheet() {
  const s = document.getElementById("sheet");
  if (s.hidden) return;
  s.hidden = true; document.body.style.overflow = "";
  lastFocus?.focus?.({ preventScroll: true });
}
function openNews(i) {
  const n = S.news[i];
  openSheet(`<span class="date">${esc(n.d)}</span><h2 id="sheet-title">${esc(n.t)}</h2>
    <img class="hero" src="${abs(n.img)}" alt="" data-wait onload="__imgOk(this)" onerror="__imgErr(this)">
    ${n.p.map(p => `<p>${esc(p)}</p>`).join("")}`);
}

/* ---------- Navigation ----------
   Jeder Schritt ist ein eigener Eintrag im Verlauf des Handys:
     #mehr          → Bereich „Mehr“
     #mehr/sparte   → Detailseite „Spartenbesetzung“
     #news/2        → News-Artikel Nr. 2 (gezählt ab 0)
   Dadurch geht „Zurück“ am Handy immer genau einen Schritt zurück.
   Jeder Bereich bleibt im Hintergrund erhalten, samt Scroll-Position. */
const VIEWS = { news: viewNews, spiele: viewSpiele, teams: viewTeams, shop: viewShop, mehr: viewMehr };
const route = () => {
  const [v, d] = location.hash.slice(1).split("/");
  return { view: VIEWS[v] ? v : "news", detail: d ? decodeURIComponent(d) : null };
};
const current = () => route().view;
const panes = {};          // je Bereich ein eigener Container
const scrollPos = {};      // gemerkte Scroll-Position je Bereich
let shownView = null;      // gerade sichtbarer Bereich
let freshNav = false;      // true = neuer Schritt per Tipp (dann oben beginnen)
let steps = 0;             // Schritte innerhalb der App (für den Zurück-Knopf)

function paneFor(v) {
  if (!panes[v]) {
    const el = document.createElement("div");
    el.className = "pane"; el.dataset.v = v;
    document.getElementById("view").append(el);
    panes[v] = { el, dirty: true };
  }
  return panes[v];
}
function showPane(v) {
  for (const k in panes) panes[k].el.hidden = k !== v;
  document.querySelectorAll(".tabs a").forEach(a => { if (a.dataset.tab === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  shownView = v;
}
/* Aktuellen Bereich neu zeichnen (z. B. nach Umschalten oder neuen Daten) */
function render() {
  const v = current(), p = paneFor(v);
  p.el.innerHTML = VIEWS[v](); p.dirty = false;
  showPane(v);
  const chip = p.el.querySelector(".teamchips [aria-pressed=true]");
  if (chip) chip.parentElement.scrollLeft = chip.offsetLeft - 24;
}
/* Alle Bereiche beim nächsten Anzeigen neu zeichnen (neue Daten) */
function invalidate() { for (const k in panes) panes[k].dirty = true; }

function applyRoute() {
  const { view, detail } = route();
  if (view !== shownView) {
    const p = paneFor(view);
    if (p.dirty) { p.el.innerHTML = VIEWS[view](); p.dirty = false; }
    showPane(view);
    window.scrollTo(0, freshNav ? 0 : (scrollPos[view] || 0));
  }
  freshNav = false;
  if (detail !== null && view === "news" && S.news[+detail]) openNews(+detail);
  else if (detail !== null && view === "teams" && youth(detail)) openSheet(youthSheet(detail));
  else if (detail !== null && SHEETS[detail]) openSheet(SHEETS[detail]());
  else closeSheet();
}
const go = hash => { freshNav = true; location.hash = hash; };
/* Offene Mannschaftsseite aktualisieren, wenn neue Daten oder Fotos ankommen */
function refreshSheet() {
  const { view, detail } = route(), s = document.getElementById("sheet");
  if (s.hidden || view !== "teams" || !youth(detail)) return;
  const y = s.scrollTop;
  document.getElementById("sheet-body").innerHTML = youthSheet(detail);
  s.scrollTop = y;
}
function goBack() {
  if (steps > 0) history.back();
  else location.replace("#" + current());   // direkt per Link geöffnet: zum Bereich, ohne die App zu verlassen
}

window.addEventListener("hashchange", () => { steps++; applyRoute(); });
window.addEventListener("scroll", () => {
  if (shownView && document.getElementById("sheet").hidden) scrollPos[shownView] = window.scrollY;
}, { passive: true });

document.addEventListener("click", e => {
  const link = e.target.closest('a[href^="#"]');
  if (link) {
    freshNav = true;
    if (link.dataset.group) { state.group = link.dataset.group; if (panes.teams) panes.teams.dirty = true; }
    if (link.getAttribute("href") === "#" + current() && !route().detail) { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    return;
  }
  const b = e.target.closest("[data-team],[data-mode],[data-cat],[data-group],[data-news],[data-sheet],[data-go-team],[data-copy]");
  if (!b) return;
  const d = b.dataset;
  if (d.team) { state.team = d.team; render(); }
  else if (d.mode) { state.spMode = d.mode; render(); }
  else if (d.cat) { state.cat = d.cat; render(); }
  else if (d.group) { state.group = d.group; render(); }
  else if (d.news) go("news/" + d.news);
  else if (d.sheet) go(current() + "/" + d.sheet);
  else if (d.goTeam) {
    state.team = d.goTeam; state.spMode = "spiele";
    if (panes.spiele) panes.spiele.dirty = true;
    if (current() === "spiele") render(); else go("spiele");
  }
  else if (d.copy) {
    const txt = document.getElementById(d.copy).textContent;
    const done = () => { b.textContent = "Kopiert"; setTimeout(() => b.textContent = "Kopieren", 1600); };
    try { navigator.clipboard.writeText(txt).then(done, () => selectText(d.copy)); } catch { selectText(d.copy); }
  }
});
function selectText(id) { const r = document.createRange(); r.selectNodeContents(document.getElementById(id)); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
document.getElementById("back").addEventListener("click", goBack);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !document.getElementById("sheet").hidden) goBack(); });

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
    if (panes.shop) panes.shop.dirty = true;
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
  applyRoute();
  loadLive();
  loadShop();
  loadYouth();
  loadPhotos();
}
start();

/* Offline-Fähigkeit und Installierbarkeit */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
})();
