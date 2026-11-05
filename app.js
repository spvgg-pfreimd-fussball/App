/* =========================================================
   SpVgg Pfreimd App – Programmlogik
   Aufbau:  Hilfsfunktionen → Live-Daten (FuPa, BFV, Fotos) → Bausteine →
            Ansichten (News, Spiele, Teams, Shop, Mehr) →
            Detailseiten → Steuerung → Start
   ========================================================= */
(() => {
"use strict";
/* Inhalte (News, Ankündigungen, Teams, Stadionzeitung ...) stehen in daten/inhalte.json
   (Ankündigungen heißen dort intern "events") */
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
    const changed = JSON.stringify(next) !== JSON.stringify(state.fupa);
    state.fupa = next; state.live = true;
    stamp();
    if (changed) { invalidate(); render(); }
  } catch (e) { /* kein Netz oder gesperrt: Datenstand bleibt */ }
}

/* ---------- Jugend live vom BFV ---------- */
const deDate = (d, t) => { const [dd, mm, yy] = String(d).split("."); return `${yy}-${mm}-${dd}T${t || "00:00"}`; };
const STATUS = { "Abse.": "abgesetzt", "Ausf.": "ausgefallen", "Annul.": "annulliert", "Verl.": "verlegt", "Abbr.": "abgebrochen" };
async function loadBfvTeam(j) {
  try {
    /* Mannschaften ohne Wertung (F-/G-Junioren) haben nur einen Spielplan, keine Tabelle */
    const [mt, tb] = await Promise.all([
      getJSON(`${BFV}team/${j.bfvTeam}/matches`, 10000),
      j.bfvLiga ? getJSON(`${BFV}competition/${j.bfvLiga}/table`, 10000).catch(() => null) : null
    ]);
    const me = j.bfvTeam;
    const clean = n => String(n || "").replace(/\s*\(\d+\)\s*$/, "").trim();   // „(5)“ = 5er-Mannschaft
    const sp = (mt.data?.matches || []).map(x => {
      const homeOwn = x.homeTeamPermanentId === me;
      const txt = String(x.result || "").trim();
      const sc = /^(\d+)\s*:\s*(\d+)/.exec(txt);
      const kick = deDate(x.kickoffDate, x.kickoffTime);
      let sec = "PRE", res = "", hg = null, ag = null, status = "";
      let home = homeOwn ? "Pfreimd" : clean(x.homeTeamName), away = x.guestTeamPermanentId === me ? "Pfreimd" : clean(x.guestTeamName);
      /* Spielfeste: „Gastgeber (5) - Kinderfestival“ gegen uns → „Kinderfestival“ / „bei Gastgeber“ */
      const fest = /^(.*?)\s*-\s*(Kinderfestival|Spielfest|Festival|Turnier|Spieltag)\s*$/i.exec(x.homeTeamName || "");
      if (fest) {
        const host = clean(fest[1]);
        home = fest[2].replace(/^\w/, c => c.toUpperCase());
        away = /pfreimd/i.test(host) && !/\//.test(host) ? "in Pfreimd (Heimspieltag)" : `bei ${host}`;
      }
      if (sc && !fest) {
        hg = +sc[1]; ag = +sc[2]; sec = "POST";
        const diff = homeOwn ? hg - ag : ag - hg;
        res = diff > 0 ? "win" : diff < 0 ? "defeat" : "draw";
      } else if (txt && !/^[-:\s]*$/.test(txt) && !sc) { sec = "OFF"; status = STATUS[txt] || txt; }
      else if (!j.bfvLiga && toDate(kick) < today()) { sec = "OFF"; status = "gespielt"; }
      const note = /meister/i.test(x.competitionType || "") ? "" : (x.competitionType || "").replace(/spiele$/, "spiel");
      return [kick, home, away, hg, ag, sec, res, note, status];
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
    const liga = tb?.data?.competitionName || mt.data?.team?.competitionName || mt.data?.matches?.[0]?.competitionName || j.liga || "";
    state.bfv[j.id] = { liga, tab, sp, ok: true, noTable: !j.bfvLiga };
  } catch (e) {
    state.bfv[j.id] = { liga: j.liga, tab: [], sp: [], ok: false };
  }
}
async function loadYouth() {
  const before = JSON.stringify(state.bfv);
  await Promise.all(S.jugend.filter(j => j.bfvTeam).map(loadBfvTeam));
  if (JSON.stringify(state.bfv) !== before) { invalidate(); render(); refreshSheet(); }
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
  const ed = isEditor();
  const evs = S.events.map((e, i) => [e, i]).filter(([e]) => toDate(e.d) >= today());
  const events = evs.length || ed ? `<section class="sec"><h2 class="h">Ankündigungen ${ed ? `<a href="#news/red-ank-neu">+ Neue Ankündigung</a>` : ""}</h2><div class="events">${evs.map(([e, i]) => { const d = toDate(e.d);
      return `<a class="card ev" href="#news/ank-${i}"><div class="cal"><i>${MON[d.getMonth()]}</i><b class="tabnum">${d.getDate()}</b></div><span>${esc(e.t)}</span>${e.img ? `<img class="evthumb" src="${esc(abs(e.img))}" alt="" decoding="async" data-wait onload="__imgOk(this)" onerror="__imgErr(this)">` : ""}</a>`; }).join("")}</div></section>` : "";
  const z = S.zeitung[0];
  return `${hero}
    <div class="minis">${minis}</div>
    <section class="sec"><h2 class="h">Letzte Ergebnisse <a href="#spiele">Alle Spiele</a></h2><div class="card rows">${results}</div></section>
    ${youthBlock}
    ${events}
    <section class="sec"><h2 class="h">Stadionzeitung ${ed ? `<a href="#news/red">Bearbeiten</a>` : ""}</h2>
      <a class="card paper" href="${abs(z[2])}" target="_blank" rel="noopener"><span class="ic">PDF</span><span><span class="muted" style="font-size:13px">Ausgabe vom ${z[0]}</span><b>Heimspiel gegen ${esc(z[1])}</b></span><span class="go" aria-hidden="true">↗</span></a>
    </section>
    <section class="sec"><h2 class="h">Neuigkeiten ${ed ? `<a href="#news/red-news-neu">+ Neue News</a>` : ""}</h2><div class="news">
      ${S.news.map((n, i) => n.entwurf && !ed ? "" : `<button class="card nc" data-news="${i}">
        ${n.img ? `<img class="img" src="${esc(abs(n.img))}" alt="" decoding="async" data-wait onload="__imgOk(this)" onerror="__imgErr(this)">` : ""}
        <div class="tx"><span class="date">${esc(n.d)}${n.entwurf ? ` · <b class="draft">Entwurf</b>` : ""}</span><h3>${esc(n.t)}</h3><p>${esc(n.p[0] || "")}</p></div></button>`).join("")}
    </div></section>`;
}

function viewSpiele() {
  const t = state.team, f = teamData(t);
  const all = [...HERREN.map(x => [x, TEAM_NAME[x]]), ...S.jugend.filter(j => j.bfvTeam).map(j => [j.id, j.name])];
  const chips = `<div class="chips teamchips" role="group" aria-label="Mannschaft">${all.map(([id, n], i) =>
    `${i === HERREN.length ? `<span class="chipsep" aria-hidden="true"></span>` : ""}<button class="chip" data-team="${id}" aria-pressed="${id === t}">${esc(n)}</button>`).join("")}</div>`;
  let segM = `<div class="seg" role="group" aria-label="Ansicht"><button data-mode="spiele" aria-pressed="${state.spMode === "spiele"}">Spielplan</button><button data-mode="tabelle" aria-pressed="${state.spMode === "tabelle"}">Tabelle</button></div>`;
  const src = isYouth(t) ? "BFV" : "FuPa";
  if (!f) return `${chips}<p class="note">Spiele und Tabelle werden geladen …</p>`;
  if (f.ok === false) return `${chips}<p class="note">Die Daten vom BFV sind gerade nicht erreichbar. Bitte versuche es später noch einmal.</p>
    <div><a class="btn ghost" href="${SITE}/${youth(t).seite}/" target="_blank" rel="noopener">Seite auf der Homepage ↗</a></div>`;
  let body;
  if (f.noTable) segM = "";
  if (state.spMode === "tabelle" && !f.noTable) body = tableHtml(f);
  else {
    const all = matches(t);
    const up = all.filter(isUpcoming).sort((a, b) => a.d - b.d);
    const done = all.filter(m => !isUpcoming(m)).sort((a, b) => b.d - a.d);
    const tally = done.filter(m => m.sec === "POST").reduce((a, m) => (a[m.res] = (a[m.res] || 0) + 1, a), {});
    body = `${up.length ? `<section class="sec"><h3 class="h">${f.noTable ? "Kommende Spieltage" : "Kommende Spiele"}</h3><div class="card rows">${up.map(m => matchRow(t, m)).join("")}</div></section>` : ""}
      ${done.length ? `<section class="sec"><h3 class="h">${f.noTable ? "Vergangene Spieltage" : `Ergebnisse <span class="muted tabnum" style="font-size:13px">${tally.win || 0} S · ${tally.draw || 0} U · ${tally.defeat || 0} N</span>`}</h3><div class="card rows">${done.map(m => matchRow(t, m)).join("")}</div></section>` : ""}
      ${!up.length && !done.length ? `<p class="note">Noch keine Spiele eingetragen.</p>` : ""}`;
  }
  return `${chips}<div class="liga"><span>${esc(f.liga || teamName(t))} · Saison 2026/27</span><span class="muted">Daten: ${src}</span></div>${segM}${body}`;
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
    <span class="ytx"><b>${esc(j.name)}</b><span>${esc(j.alter)}${f?.liga || j.liga ? ` · ${esc(f?.liga || j.liga)}` : ""}</span></span>
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
      const done = all.filter(m => f.noTable ? !isUpcoming(m) : m.sec === "POST").sort((a, b) => b.d - a.d).slice(0, 3);
      data = `${me ? `<div class="stats tabnum"><div><b>${me[0]}.</b><span>Platz</span></div><div><b>${me[8]}</b><span>Punkte</span></div><div><b>${me[2]}</b><span>Spiele</span></div></div>` : ""}
        ${f.noTable ? `<p class="note">In dieser Altersklasse wird ohne Ergebnisse und Tabelle gespielt. Hier steht der Spielplan.</p>` : ""}
        ${up.length ? `<section class="sec"><h3 class="h">${f.noTable ? "Nächste Spieltage" : "Nächste Spiele"}</h3><div class="card rows">${up.map(m => matchRow(id, m)).join("")}</div></section>`
          : f.noTable ? `<p class="muted">Die nächsten Spieltage sind noch nicht eingetragen.</p>` : ""}
        ${done.length ? `<section class="sec"><h3 class="h">${f.noTable ? "Letzte Spieltage" : "Letzte Ergebnisse"}</h3><div class="card rows">${done.map(m => matchRow(id, m)).join("")}</div></section>` : ""}
        ${f.tab.length ? `<section class="sec"><h3 class="h">Tabelle</h3>${tableHtml(f, true)}</section>` : ""}
        <div><button class="btn" data-go-team="${id}">${f.noTable ? "Ganzer Spielplan" : "Alle Spiele"}</button></div>`;
    }
  }
  return `${ph ? `<img class="hero" src="${esc(ph)}" alt="Mannschaftsfoto ${esc(j.name)}" data-wait onload="__imgOk(this)" onerror="__imgErr(this)">` : ""}
    <div><h2 id="sheet-title">${esc(j.name)}</h2><div class="muted">${esc(j.alter)}${f?.liga || j.liga ? ` · ${esc(f?.liga || j.liga)}` : ""}</div></div>
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
      ${B("Leitbild", "leitbild", "Jugendkonzept und Verhaltensgrundsätze")}
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
    </div></section>
    <section class="sec"><h2 class="h">Redaktion</h2><div class="card list">${isEditor()
      ? `<a class="li" href="#mehr/red"><span>News, Ankündigungen & Stadionzeitung<small>Bearbeiten · du bist angemeldet</small></span><span class="chev" aria-hidden="true">›</span></a>`
      : `<a class="li" href="#mehr/red-login"><span>Anmelden<small>Nur für die Redaktion</small></span><span class="chev" aria-hidden="true">›</span></a>`}</div></section>
    <section class="sec"><h2 class="h">Rechtliches</h2><div class="card list">${L("Impressum", "/impressum/")}${L("Datenschutz", "/datenschutz/")}</div></section>
    <div class="foot"><b>Rot-Weiß ein Leben lang!</b>SpVgg Pfreimd · Abteilung Fußball · Version 1.10</div>`;
}

/* ---------- Detailseiten ---------- */
const SHEETS = {
  leitbild: () => wpSheet("leitbild"),
  sparte: () => `<h2 id="sheet-title">Spartenbesetzung</h2><p class="muted">Unsere ehrenamtlichen Verantwortlichen der Sparte Fußball.</p>
    ${S.sparte.map(([g, rows]) => `<section class="sec"><h3 class="h">${esc(g)}</h3><div class="card kv">${rows.map(r => `<div><span>${esc(r[0])}</span>${esc(r[1])}</div>`).join("")}</div></section>`).join("")}`,
  historie: () => `<h2 id="sheet-title">Historie</h2><ol class="tl" reversed>${[...S.historie].reverse().map(h => `<li><span class="when">${esc(h[0])}</span><b>${esc(h[1])}</b>${h[2] ? `<p>${esc(h[2])}</p>` : ""}</li>`).join("")}</ol>`,
  hymne: () => `<h2 id="sheet-title">Vereinshymne</h2><p><b>„Die Rot-Weißen“</b></p><p class="muted">Text: Christian Modl & die Ultras · Musik: Christian Modl · Arrangement: Marc Hohl · © 2015</p>
    <div><a class="btn" href="${SITE}/vereinshymne/" target="_blank" rel="noopener">Hymne anhören ↗</a></div>`,
  zeitung: () => `<h2 id="sheet-title">Stadionzeitung</h2><div class="card list">${S.zeitung.map(z => `<a class="li" href="${abs(z[2])}" target="_blank" rel="noopener"><span>${esc(z[1])}<small class="tabnum">${z[0]}</small></span><span class="ext" aria-hidden="true">PDF ↗</span></a>`).join("")}</div>`,
  anfahrt: () => `<h2 id="sheet-title">Anfahrt</h2><div class="card kv"><div><span>Anschrift</span>Fußball Pfreimd<br>Stadtgraben 15, 92536 Pfreimd</div></div>
    <div><a class="btn" href="https://www.google.com/maps/search/?api=1&amp;query=Stadtgraben%2015%2C%2092536%20Pfreimd" target="_blank" rel="noopener">In Google Maps öffnen ↗</a></div>`,
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
const linkify = t => esc(t).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
function openEvent(i) {
  const e = S.events[i], d = toDate(e.d), txt = e.p || [];
  openSheet(`<span class="date">${WD[d.getDay()]}, ${longDate(d)}</span><h2 id="sheet-title">${esc(e.t)}</h2>
    ${e.img ? `<a href="${esc(abs(e.img))}" target="_blank" rel="noopener" aria-label="Flyer groß öffnen"><img class="hero" src="${esc(abs(e.img))}" alt="Flyer: ${esc(e.t)}" data-wait onload="__imgOk(this)" onerror="__imgErr(this)"></a>` : ""}
    ${txt.map(x => `<p class="pre">${linkify(x)}</p>`).join("")}
    ${isEditor() ? `<div><a class="btn ghost" href="#news/red-ank-${i}">Diese Ankündigung bearbeiten</a></div>` : ""}`);
}
function openNews(i) {
  const n = S.news[i];
  if (n.entwurf && !isEditor()) return closeSheet();
  openSheet(`<span class="date">${esc(n.d)}${n.entwurf ? ` · <b class="draft">Entwurf</b>` : ""}</span><h2 id="sheet-title">${esc(n.t)}</h2>
    ${n.img ? `<img class="hero" src="${esc(abs(n.img))}" alt="" data-wait onload="__imgOk(this)" onerror="__imgErr(this)">` : ""}
    ${n.p.map(p => `<p class="pre">${linkify(p)}</p>`).join("")}
    ${isEditor() ? `<div><a class="btn ghost" href="#news/red-news-${i}">Diese News bearbeiten</a></div>` : ""}`);
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
  if (detail !== null && detail.startsWith("red")) {
    Object.assign(red, { img: null, imgRemoved: false, pdf: null });
    openSheet(redSheet(detail));
  }
  else if (detail !== null && /^ank-\d+$/.test(detail) && S.events[+detail.slice(4)]) openEvent(+detail.slice(4));
  else if (detail !== null && view === "news" && S.news[+detail]) openNews(+detail);
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
  const rb = e.target.closest("[data-red]");
  if (rb) { redAction(rb); return; }
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

/* ---------- Redaktion: News, Ankündigungen und Stadionzeitung am Handy bearbeiten ----------
   Gespeichert wird direkt im GitHub-Repository (daten/inhalte.json, Fotos in img/news/,
   Stadionzeitungen in zeitung/). Jede Änderung ist ein eigener Eintrag in der
   Versionsgeschichte und lässt sich dort zurücknehmen.
   Anmeldung: persönlicher GitHub-Zugangsschlüssel, der nur dieses Repository ändern darf.
   Er wird nur auf dem eigenen Handy gespeichert. */
const GH = { owner: "spvgg-pfreimd-fussball", repo: "App", branch: "main", file: "daten/inhalte.json" };
const GH_API = `https://api.github.com/repos/${GH.owner}/${GH.repo}`;
const TOKEN_KEY = "spvgg-redaktion";
const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } };
const isEditor = () => !!getToken();
const red = { img: null, imgRemoved: false, pdf: null, busy: false };

async function gh(path, opts = {}, token = getToken()) {
  const headers = { Accept: "application/vnd.github+json", Authorization: "Bearer " + token };
  if (opts.body) headers["Content-Type"] = "application/json";
  const r = await fetch(GH_API + path, { ...opts, headers, cache: "no-store" });
  if (!r.ok) { const e = new Error("GitHub " + r.status); e.status = r.status; throw e; }
  return r.json();
}
const toB64 = bytes => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
const b64ToText = b => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, "")), c => c.charCodeAt(0)));

/* inhalte.json immer im selben, gut lesbaren Format schreiben (ein Eintrag pro Zeile) */
function formatData(d) {
  const J = x => Array.isArray(x) ? "[" + x.map(J).join(", ") + "]"
    : x && typeof x === "object" ? "{" + Object.entries(x).map(([k, v]) => JSON.stringify(k) + ": " + J(v)).join(", ") + "}"
    : JSON.stringify(x);
  const lst = a => "[\n" + a.map(i => "    " + J(i)).join(",\n") + "\n  ]";
  const news = n => {
    const { p = [], ...head } = n;
    const h = Object.entries(head).map(([k, v]) => JSON.stringify(k) + ": " + J(v)).join(", ");
    return `    {${h},\n      "p": [\n${p.map(x => "        " + J(x)).join(",\n")}\n      ]}`;
  };
  const fmt = {
    news: v => "[\n" + v.map(news).join(",\n") + "\n  ]",
    fupa: v => "{\n" + Object.entries(v).map(([t, x]) => `    ${J(t)}: {"liga": ${J(x.liga)},\n      "tab": [\n${x.tab.map(r => "        " + J(r)).join(",\n")}\n      ],\n      "sp": [\n${x.sp.map(r => "        " + J(r)).join(",\n")}\n      ]}`).join(",\n") + "\n  }",
    sparte: v => "[\n" + v.map(([g, rows]) => `    [${J(g)}, [\n${rows.map(r => "      " + J(r)).join(",\n")}\n    ]]`).join(",\n") + "\n  ]"
  };
  const order = ["news", "events", "zeitung", "teams", "jugend", "sparte", "historie", "products", "fupa"];
  const keys = [...order.filter(k => k in d), ...Object.keys(d).filter(k => k !== "stand" && !order.includes(k))];
  return "{\n" + `  "stand": ${J(d.stand)},\n` + keys.map(k => `  ${J(k)}: ${(fmt[k] || (Array.isArray(d[k]) ? lst : J))(d[k])}`).join(",\n\n") + "\n}\n";
}

async function ghReadData() {
  const f = await gh(`/contents/${GH.file}?ref=${GH.branch}`);
  return { data: JSON.parse(b64ToText(f.content)), sha: f.sha };
}
/* Liest den aktuellen Stand, wendet die Änderung an und speichert (bei gleichzeitiger Änderung: ein zweiter Versuch) */
async function saveData(change, message) {
  for (let attempt = 0; ; attempt++) {
    const { data, sha } = await ghReadData();
    change(data);
    try {
      await gh(`/contents/${GH.file}`, { method: "PUT", body: JSON.stringify({ message: message + " (über die App)", content: toB64(new TextEncoder().encode(formatData(data))), sha, branch: GH.branch }) });
      S = data; invalidate(); render();
      return;
    } catch (e) { if (attempt || (e.status !== 409 && e.status !== 422)) throw e; }
  }
}
async function ghUpload(path, bytes, message) {
  let sha;
  try { sha = (await gh(`/contents/${path}?ref=${GH.branch}`)).sha; } catch (e) { /* neue Datei */ }
  await gh(`/contents/${path}`, { method: "PUT", body: JSON.stringify({ message: message + " (über die App)", content: toB64(bytes), branch: GH.branch, ...(sha ? { sha } : {}) }) });
  return path;
}
async function shrinkImage(file, max = 1400) {
  let src;
  try { src = await createImageBitmap(file); }
  catch (e) { src = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = URL.createObjectURL(file); }); }
  const w = src.width, h = src.height, sc = Math.min(1, max / Math.max(w, h));
  const c = document.createElement("canvas"); c.width = Math.round(w * sc); c.height = Math.round(h * sc);
  c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.82));
  return new Uint8Array(await blob.arrayBuffer());
}
const slug = s => String(s).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "eintrag";
const isoDate = d => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const longDate = d => `${d.getDate()}. ${MONATE[d.getMonth()]} ${d.getFullYear()}`;
const deToIso = s => { const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s || ""); return m ? `${m[3]}-${two(m[2])}-${two(m[1])}` : ""; };
const isoToDe = s => { const [y, m, d] = (s || "").split("-"); return y ? `${d}.${m}.${y}` : ""; };
function errText(e) {
  if (e.status === 401) return "Der Zugangsschlüssel ist ungültig oder abgelaufen. Bitte unter Mehr → Redaktion abmelden und neu anmelden.";
  if (e.status === 403 || e.status === 404) return "Der Zugangsschlüssel darf das Repository nicht ändern. Bei GitHub muss unter „Contents“ „Read and write“ ausgewählt sein.";
  if (e.status === 409 || e.status === 422) return "Die Daten wurden gerade woanders geändert. Bitte noch einmal speichern.";
  if (e.name === "TypeError") return "Keine Verbindung zu GitHub. Bitte Internetverbindung prüfen und noch einmal speichern.";
  return e.message || "Speichern hat nicht geklappt.";
}
function toast(text) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = text; t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 4500);
}
/* Eintrag im frisch geladenen Stand wiederfinden (falls sich die Reihenfolge geändert hat) */
function findIdx(arr, orig, idx, key) {
  let i = arr.findIndex(x => key(x) === key(orig));
  if (i < 0 && arr[+idx] && key(arr[+idx]) === key(orig)) i = +idx;
  if (i < 0) throw new Error("Der Eintrag wurde inzwischen geändert. Bitte zurückgehen und neu öffnen.");
  return i;
}
const newsKey = n => n.t + "|" + n.d, evKey = e => e.d + "|" + e.t, zKey = z => z[0] + "|" + z[1];

/* --- Ansichten der Redaktion --- */
function redSheet(key) {
  if (key === "red-login" || !isEditor()) return redLogin();
  const [, kind, idx] = key.split("-");
  if (!kind) return redHome();
  if (kind === "news") return redNewsForm(idx);
  if (kind === "ank") return redAnkForm(idx);
  if (kind === "zeitung") return redZeitungForm(idx);
  return redHome();
}
function redLogin() {
  return `<h2 id="sheet-title">Redaktion</h2>
    <p>Hier meldest du dich einmalig mit deinem GitHub-Zugangsschlüssel an. Danach kannst du News, Ankündigungen und die Stadionzeitung direkt am Handy bearbeiten.</p>
    <form id="loginform" class="form" autocomplete="off">
      <label for="tok">Zugangsschlüssel<input id="tok" type="password" required spellcheck="false" autocapitalize="off" placeholder="github_pat_…"></label>
      <div class="formbtns"><button class="btn" type="submit">Anmelden</button></div>
      <p id="f-msg" class="formmsg" role="alert"></p>
    </form>
    <p class="muted" style="font-size:14px">Der Schlüssel bleibt nur auf diesem Gerät gespeichert. Einen neuen Schlüssel legst du bei GitHub unter <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener">Einstellungen → Personal access tokens</a> an.</p>`;
}
function redHome() {
  const base = current();
  const L = (href, title, sub) => `<a class="li" href="#${base}/${href}"><span>${esc(title)}<small>${esc(sub)}</small></span><span class="chev" aria-hidden="true">›</span></a>`;
  return `<h2 id="sheet-title">Redaktion</h2>
    <p class="muted">Änderungen sind nach etwa ein bis zwei Minuten für alle sichtbar. Jede Änderung wird als eigene Version gespeichert.</p>
    <section class="sec"><h3 class="h">News <a href="#${base}/red-news-neu">+ Neue News</a></h3>
      <div class="card list">${S.news.map((n, i) => L(`red-news-${i}`, n.t, n.d + (n.entwurf ? " · Entwurf" : ""))).join("") || `<p class="li muted">Noch keine News.</p>`}</div></section>
    <section class="sec"><h3 class="h">Ankündigungen <a href="#${base}/red-ank-neu">+ Neue Ankündigung</a></h3>
      <div class="card list">${S.events.map((e, i) => L(`red-ank-${i}`, e.t, isoToDe(e.d) + (e.img ? " · mit Bild" : "") + (toDate(e.d) < today() ? " · vorbei" : ""))).join("") || `<p class="li muted">Noch keine Ankündigungen.</p>`}</div></section>
    <section class="sec"><h3 class="h">Stadionzeitung <a href="#${base}/red-zeitung-neu">+ Neue Ausgabe</a></h3>
      <div class="card list">${S.zeitung.map((z, i) => L(`red-zeitung-${i}`, z[1], z[0] + (i === 0 ? " · aktuelle Ausgabe" : ""))).join("")}</div></section>
    <div><button class="btn ghost" type="button" data-red="logout">Abmelden</button></div>`;
}
function delBtns(isNew, extra = "") {
  return isNew ? "" : `<div class="formbtns">${extra}<button class="btn danger" type="button" data-red="delete">Löschen</button></div>`;
}
function imgField(img, label) {
  return `<div class="field"><span class="flabel">${label}</span>
        <img id="f-prev" class="prev" src="${esc(img)}" alt="" ${img ? "" : "hidden"}>
        <div class="formbtns">
          <label class="btn ghost filebtn">${img ? "Anderes Bild" : "Bild wählen"}<input id="f-img" class="vh" type="file" accept="image/*"></label>
          <button class="btn ghost" type="button" data-red="img-remove" ${img ? "" : "hidden"}>Bild entfernen</button>
        </div></div>`;
}
function redNewsForm(idx) {
  const n = idx === "neu" ? null : S.news[+idx];
  if (idx !== "neu" && !n) return redHome();
  const img = n?.img ? abs(n.img) : "";
  return `<h2 id="sheet-title">${n ? "News bearbeiten" : "Neue News"}</h2>
    <form id="redform" class="form" data-kind="news" data-idx="${esc(idx)}">
      <label for="f-t">Überschrift<input id="f-t" required value="${esc(n?.t || "")}"></label>
      <label for="f-d">Datum<input id="f-d" required value="${esc(n?.d || longDate(new Date()))}"><small class="hint">So erscheint es in der App, z. B. „${longDate(new Date())}“ oder „Mai 2026“.</small></label>
      <label for="f-p">Text<textarea id="f-p" rows="10">${esc((n?.p || []).join("\n\n"))}</textarea><small class="hint">Eine Leerzeile beginnt einen neuen Absatz.</small></label>
      ${imgField(img, "Foto")}
      <label class="check"><input id="f-draft" type="checkbox" ${n?.entwurf ? "checked" : ""}> Als Entwurf speichern (nur für dich sichtbar)</label>
      <div class="formbtns"><button class="btn" type="submit">Speichern</button></div>
      <p id="f-msg" class="formmsg" role="alert"></p>
      ${delBtns(!n, `<button class="btn ghost" type="button" data-red="up" ${+idx === 0 ? "disabled" : ""}>Nach oben</button><button class="btn ghost" type="button" data-red="down" ${+idx === S.news.length - 1 ? "disabled" : ""}>Nach unten</button>`)}
    </form>`;
}
function redAnkForm(idx) {
  const e = idx === "neu" ? null : S.events[+idx];
  if (idx !== "neu" && !e) return redHome();
  const img = e?.img ? abs(e.img) : "";
  return `<h2 id="sheet-title">${e ? "Ankündigung bearbeiten" : "Neue Ankündigung"}</h2>
    <form id="redform" class="form" data-kind="ank" data-idx="${esc(idx)}">
      <label for="f-date">Datum<input id="f-date" type="date" required value="${esc(e?.d || "")}"></label>
      <label for="f-t">Bezeichnung<input id="f-t" required value="${esc(e?.t || "")}" placeholder="z. B. Christbaumversteigerung"></label>
      <label for="f-p">Text (optional)<textarea id="f-p" rows="6" placeholder="z. B. Uhrzeit, Ort, Programm">${esc((e?.p || []).join("\n\n"))}</textarea><small class="hint">Eine Leerzeile beginnt einen neuen Absatz.</small></label>
      ${imgField(img, "Flyer oder Bild (optional)")}
      <p class="hint">Auf der Startseite erscheint eine kleine Vorschau, ein Tipp darauf zeigt das Bild groß. Vergangene Ankündigungen blendet die App automatisch aus.</p>
      <div class="formbtns"><button class="btn" type="submit">Speichern</button></div>
      <p id="f-msg" class="formmsg" role="alert"></p>
      ${delBtns(!e)}
    </form>`;
}
function redZeitungForm(idx) {
  const z = idx === "neu" ? null : S.zeitung[+idx];
  if (idx !== "neu" && !z) return redHome();
  return `<h2 id="sheet-title">${z ? "Ausgabe bearbeiten" : "Neue Stadionzeitung"}</h2>
    <form id="redform" class="form" data-kind="zeitung" data-idx="${esc(idx)}">
      <label for="f-date">Datum des Heimspiels<input id="f-date" type="date" required value="${esc(deToIso(z?.[0]))}"></label>
      <label for="f-t">Gegner<input id="f-t" required value="${esc(z?.[1] || "")}" placeholder="z. B. Hahnbach"></label>
      <div class="field"><span class="flabel">PDF</span>
        ${z ? `<a class="hint" href="${abs(z[2])}" target="_blank" rel="noopener">Aktuelle Datei öffnen ↗</a>` : ""}
        <div class="formbtns"><label class="btn ghost filebtn">PDF hochladen<input id="f-pdf" class="vh" type="file" accept="application/pdf"></label></div>
        <span id="f-pdfname" class="hint"></span>
      </div>
      <label for="f-link">… oder Link zur Datei<input id="f-link" type="url" inputmode="url" value="${z && /^https?:/.test(z[2]) ? esc(z[2]) : ""}" placeholder="https://fussball.spvgg-pfreimd.de/…pdf"><small class="hint">Zum Beispiel, wenn die Ausgabe schon auf der Homepage liegt.</small></label>
      <div class="formbtns"><button class="btn" type="submit">Speichern</button></div>
      <p id="f-msg" class="formmsg" role="alert"></p>
      ${delBtns(!z)}
    </form>`;
}

/* --- Speichern --- */
async function saveForm(form) {
  if (red.busy) return;
  const kind = form.dataset.kind, idx = form.dataset.idx, isNew = idx === "neu";
  const msg = form.querySelector("#f-msg"), btn = form.querySelector("[type=submit]");
  const v = id => (form.querySelector("#" + id)?.value || "").trim();
  red.busy = true; btn.disabled = true; btn.textContent = "Wird gespeichert …"; msg.textContent = "";
  try {
    if (kind === "news") {
      const orig = isNew ? null : S.news[+idx];
      const item = { d: v("f-d"), t: v("f-t"), img: red.imgRemoved ? "" : (orig?.img || ""),
        p: v("f-p").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean) };
      if (form.querySelector("#f-draft").checked) item.entwurf = true;
      if (red.img) item.img = await ghUpload(`img/news/${isoDate(new Date())}-${slug(item.t)}-${Date.now().toString(36)}.jpg`, red.img, `Foto für News „${item.t}“`);
      await saveData(d => { if (isNew) d.news.unshift(item); else d.news[findIdx(d.news, orig, idx, newsKey)] = item; },
        `${isNew ? "Neue News" : "News geändert"}: ${item.t}`);
    } else if (kind === "ank") {
      const orig = isNew ? null : S.events[+idx];
      const item = { d: v("f-date"), t: v("f-t") };
      const paras = v("f-p").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
      let img = red.imgRemoved ? "" : (orig?.img || "");
      if (red.img) img = await ghUpload(`img/ankuendigungen/${item.d}-${slug(item.t)}-${Date.now().toString(36)}.jpg`, red.img, `Bild für Ankündigung „${item.t}“`);
      if (img) item.img = img;
      if (paras.length) item.p = paras;
      await saveData(d => {
        if (isNew) d.events.push(item); else d.events[findIdx(d.events, orig, idx, evKey)] = item;
        d.events.sort((a, b) => a.d.localeCompare(b.d));
      }, `${isNew ? "Neue Ankündigung" : "Ankündigung geändert"}: ${item.t}`);
    } else if (kind === "zeitung") {
      const orig = isNew ? null : S.zeitung[+idx];
      const iso = v("f-date"), gegner = v("f-t");
      let url = v("f-link") || orig?.[2] || "";
      if (red.pdf) url = await ghUpload(`zeitung/${iso}-${slug(gegner)}.pdf`, red.pdf, `Stadionzeitung ${gegner}`);
      if (!url) throw new Error("Bitte ein PDF hochladen oder einen Link angeben.");
      const item = [isoToDe(iso), gegner, url];
      await saveData(d => {
        if (isNew) d.zeitung.unshift(item); else d.zeitung[findIdx(d.zeitung, orig, idx, zKey)] = item;
        d.zeitung.sort((a, b) => deToIso(b[0]).localeCompare(deToIso(a[0])));
      }, `${isNew ? "Neue Stadionzeitung" : "Stadionzeitung geändert"}: ${gegner}`);
    }
    goBack();
    toast("Gespeichert. In ein bis zwei Minuten für alle sichtbar.");
  } catch (e) {
    msg.textContent = errText(e); btn.disabled = false; btn.textContent = "Speichern";
  } finally { red.busy = false; }
}
async function redAction(b) {
  const a = b.dataset.red, form = b.closest("form");
  if (a === "logout") {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
    invalidate(); render(); goBack(); toast("Abgemeldet."); return;
  }
  if (a === "img-remove") {
    red.img = null; red.imgRemoved = true;
    const prev = document.getElementById("f-prev"); prev.hidden = true; prev.removeAttribute("src");
    b.hidden = true; return;
  }
  if (!form || red.busy) return;
  const kind = form.dataset.kind, idx = form.dataset.idx, msg = form.querySelector("#f-msg");
  const list = { news: "news", ank: "events", zeitung: "zeitung" }[kind];
  const key = { news: newsKey, ank: evKey, zeitung: zKey }[kind];
  const orig = S[list][+idx];
  if (a === "delete" && !b.dataset.armed) {
    b.dataset.armed = "1"; b.textContent = "Wirklich löschen? Nochmal tippen";
    setTimeout(() => { delete b.dataset.armed; b.textContent = "Löschen"; }, 4000); return;
  }
  red.busy = true; b.disabled = true; msg.textContent = "Wird gespeichert …";
  try {
    const label = kind === "zeitung" ? orig[1] : orig.t;
    if (a === "delete") await saveData(d => d[list].splice(findIdx(d[list], orig, idx, key), 1), `Gelöscht: ${label}`);
    else {
      const dir = a === "up" ? -1 : 1;
      await saveData(d => { const i = findIdx(d[list], orig, idx, key), j = i + dir;
        if (j < 0 || j >= d[list].length) return; [d[list][i], d[list][j]] = [d[list][j], d[list][i]]; }, `Verschoben: ${label}`);
    }
    goBack();
    toast(a === "delete" ? "Gelöscht. In ein bis zwei Minuten für alle sichtbar." : "Verschoben. In ein bis zwei Minuten für alle sichtbar.");
  } catch (e) { msg.textContent = errText(e); b.disabled = false; }
  finally { red.busy = false; }
}
document.addEventListener("submit", async e => {
  if (e.target.id === "redform") { e.preventDefault(); saveForm(e.target); }
  if (e.target.id === "loginform") {
    e.preventDefault();
    const tok = e.target.querySelector("#tok").value.trim(), msg = e.target.querySelector("#f-msg"), btn = e.target.querySelector("[type=submit]");
    btn.disabled = true; btn.textContent = "Wird geprüft …"; msg.textContent = "";
    try {
      await gh("", {}, tok);
      try { localStorage.setItem(TOKEN_KEY, tok); } catch (err) { throw new Error("Der Schlüssel konnte auf diesem Gerät nicht gespeichert werden (privater Modus?)."); }
      S = (await ghReadData()).data; invalidate(); render();
      location.replace("#" + current() + "/red");
      toast("Angemeldet.");
    } catch (err) {
      msg.textContent = err.status === 401 ? "Dieser Schlüssel ist ungültig oder abgelaufen." : err.status === 404 ? "Der Schlüssel hat keinen Zugriff auf das Repository „App“." : errText(err);
      btn.disabled = false; btn.textContent = "Anmelden";
    }
  }
});
document.addEventListener("change", async e => {
  if (e.target.id === "f-img" && e.target.files[0]) {
    const msg = document.getElementById("f-msg");
    try {
      const flyer = document.getElementById("redform")?.dataset.kind === "ank";
      red.img = await shrinkImage(e.target.files[0], flyer ? 1800 : 1400); red.imgRemoved = false;
      const prev = document.getElementById("f-prev");
      prev.src = URL.createObjectURL(new Blob([red.img], { type: "image/jpeg" })); prev.hidden = false; prev.removeAttribute("data-wait");
      document.querySelector('[data-red="img-remove"]').hidden = false;
    } catch (err) { msg.textContent = "Dieses Foto konnte nicht gelesen werden. Bitte ein anderes wählen."; }
  }
  if (e.target.id === "f-pdf" && e.target.files[0]) {
    const f = e.target.files[0];
    if (f.size > 40 * 1024 * 1024) { document.getElementById("f-msg").textContent = "Die Datei ist größer als 40 MB. Bitte verkleinern oder als Link angeben."; return; }
    red.pdf = new Uint8Array(await f.arrayBuffer());
    document.getElementById("f-pdfname").textContent = `${f.name} (${(f.size / 1048576).toFixed(1)} MB) wird beim Speichern hochgeladen.`;
  }
});

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
    const before = JSON.stringify(state.products);
    state.products = list.map(p => {
      const div = 10 ** (p.prices.currency_minor_unit ?? 2);
      const range = p.prices.price_range;
      return [dec(p.name), p.categories[0]?.name || "Sportausrüstung", (range ? +range.min_amount : +p.prices.price) / div,
        variantText(p.attributes), p.permalink, p.images?.[0]?.src || "", range && range.min_amount !== range.max_amount ? 1 : 0];
    });
    if (JSON.stringify(state.products) === before) return;
    if (panes.shop) panes.shop.dirty = true;
    if (current() === "shop") render();
  } catch (e) { /* Datenstand aus inhalte.json bleibt */ }
}

/* ---------- Automatisch aktualisieren ----------
   - beim Start
   - wenn die App nach mehr als 5 Minuten wieder in den Vordergrund kommt
   - solange sie offen ist: alle 2 Minuten, wenn heute eine unserer Mannschaften spielt,
     sonst alle 15 Minuten
   Neu gezeichnet wird nur, wenn sich tatsächlich etwas geändert hat. */
let lastLoad = 0, refreshing = false;
function stamp() { document.getElementById("src").textContent = "Aktualisiert " + fTime(new Date()); }
function matchToday() {
  const n = new Date().toDateString();
  return [...HERREN, ...S.jugend.filter(j => j.bfvTeam).map(j => j.id)].some(t => matches(t).some(m => m.d.toDateString() === n));
}
async function reloadContent() {
  try {
    const fresh = isEditor() ? (await ghReadData()).data : await getJSON("daten/inhalte.json?v=" + Date.now().toString(36), 8000);
    if (JSON.stringify(fresh) === JSON.stringify(S)) return;
    S = fresh; invalidate(); render();
  } catch (e) { /* alter Stand bleibt */ }
}
async function refreshAll() {
  if (refreshing || !S) return;
  refreshing = true; lastLoad = Date.now();
  const { detail } = route();
  const editing = !document.getElementById("sheet").hidden && detail && detail.startsWith("red");
  await Promise.allSettled([loadLive(), loadYouth(), loadShop(), editing ? null : reloadContent()]);
  refreshing = false;
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Date.now() - lastLoad > 5 * 60e3) refreshAll();
});
setInterval(() => {
  if (!S || document.visibilityState !== "visible") return;
  const every = matchToday() ? 2 * 60e3 : 15 * 60e3;
  if (Date.now() - lastLoad >= every) refreshAll();
}, 30e3);

/* ---------- Seiten der Homepage live übernehmen (z. B. Leitbild) ----------
   Der Inhalt kommt direkt aus WordPress und wird für die App bereinigt:
   nur Text, Überschriften, Listen, Links und Bilder bleiben, alles andere fällt weg.
   Abschnitte („Timeline“-Blöcke) werden zu aufklappbaren Karten. */
const WP_PAGES = { leitbild: { id: 2126, slug: "leitbild", title: "Leitbild", intro: "Jugendkonzept der SpVgg Pfreimd, Abteilung Fußball." } };
const wpLoaded = {};
const KEEP = { P: "p", BR: "br", STRONG: "strong", B: "strong", EM: "em", I: "em", U: "u", A: "a", UL: "ul", OL: "ol", LI: "li",
  H1: "h3", H2: "h3", H3: "h3", H4: "h4", H5: "h4", H6: "h4", BLOCKQUOTE: "blockquote", FIGURE: "figure", FIGCAPTION: "figcaption", IMG: "img", HR: "hr" };
function cleanNode(node) {
  let s = "";
  for (const c of node.childNodes) {
    if (c.nodeType === 3) { s += esc(c.textContent); continue; }
    if (c.nodeType !== 1) continue;
    const tag = KEEP[c.tagName];
    if (!tag) { s += cleanNode(c); continue; }
    if (tag === "img") {
      const src = c.getAttribute("src") || "";
      if (/^https:\/\//.test(src)) s += `<img src="${esc(src)}" alt="${esc(c.getAttribute("alt") || "")}" decoding="async" data-wait onload="__imgOk(this)" onerror="__imgErr(this)">`;
      continue;
    }
    if (tag === "br" || tag === "hr") { s += `<${tag}>`; continue; }
    if (tag === "a") {
      const h = c.getAttribute("href") || "";
      s += /^(https?:|mailto:)/i.test(h) ? `<a href="${esc(h)}" target="_blank" rel="noopener">${cleanNode(c)}</a>` : cleanNode(c);
      continue;
    }
    if (tag === "p") {
      const txt = c.textContent.replace(/\u00a0/g, " ").trim();
      if (!txt && !c.querySelector("img")) continue;
      if (/^[_\-–—\s]{3,}$/.test(txt)) { s += "<hr>"; continue; }
      const strong = c.querySelector("strong,b");
      if (strong && strong.textContent.replace(/\u00a0/g, " ").trim() === txt) { s += `<h4>${esc(txt)}</h4>`; continue; }
    }
    s += `<${tag}>${cleanNode(c)}</${tag}>`;
  }
  return s;
}
function cleanWp(raw) {
  const doc = new DOMParser().parseFromString(raw, "text/html");
  doc.querySelectorAll("style,script,noscript,iframe,form,svg,input,button,select,textarea").forEach(x => x.remove());
  const out = []; let first = true;
  for (const c of doc.body.children) {
    const items = c.querySelectorAll(".wp-block-cp-timeline-content-timeline-child");
    if (!items.length) { out.push(cleanNode(c)); continue; }
    for (const it of items) {
      /* „Verhaltens-<br>grundsätze“ → „Verhaltensgrundsätze“ (ohne fremdes HTML auszuführen) */
      const timeHtml = (it.querySelector(".story-time")?.innerHTML || "").replace(/-((?:\s*<\/[a-z]+>)*)\s*<br\s*\/?>/gi, "$1").replace(/<br\s*\/?>/gi, " ");
      const title = new DOMParser().parseFromString(timeHtml, "text/html").body.textContent.replace(/\s+/g, " ").trim() || "Abschnitt";
      out.push(`<details class="card wpsec"${first ? " open" : ""}><summary>${esc(title)}</summary><div class="wpbody">${cleanNode(it.querySelector(".story-content") || it)}</div></details>`);
      first = false;
    }
  }
  return out.join("");
}
function wpSheet(key) {
  const pg = WP_PAGES[key];
  let html = "";
  try { html = localStorage.getItem("spvgg-seite-" + pg.id) || ""; } catch (e) {}
  if (!wpLoaded[pg.id]) setTimeout(() => loadWpPage(pg), 0);
  return `<h2 id="sheet-title">${esc(pg.title)}</h2>${pg.intro ? `<p class="muted">${esc(pg.intro)}</p>` : ""}
    <div id="wp-${pg.id}" class="wpc">${html || `<p class="note">Wird geladen …</p>`}</div>
    <div><a class="btn ghost" href="${SITE}/${pg.slug}/" target="_blank" rel="noopener">Auf der Homepage ansehen ↗</a></div>`;
}
async function loadWpPage(pg) {
  const el = () => document.getElementById("wp-" + pg.id);
  try {
    const j = await getJSON(`${SITE}/wp-json/wp/v2/pages/${pg.id}?_fields=content`, 10000);
    const html = cleanWp(j.content.rendered);
    wpLoaded[pg.id] = true;
    try { localStorage.setItem("spvgg-seite-" + pg.id, html); } catch (e) {}
    const box = el();
    if (box && box.innerHTML !== html) {
      const open = [...box.querySelectorAll("details")].map(d => d.open);
      box.innerHTML = html;
      if (open.length) box.querySelectorAll("details").forEach((d, i) => { if (i < open.length) d.open = open[i]; });
    }
  } catch (e) {
    const box = el();
    if (box && box.querySelector(".note")) box.innerHTML = `<p class="note">Die Seite konnte gerade nicht geladen werden. Bitte später noch einmal versuchen oder auf der Homepage ansehen.</p>`;
  }
}

/* ---------- Start ---------- */
async function start() {
  try {
    if (isEditor()) { try { S = (await ghReadData()).data; } catch (e) { S = null; } }
    if (!S) S = await getJSON("daten/inhalte.json?v=" + Date.now().toString(36).slice(0, -3), 8000);
  } catch (e) {
    document.getElementById("view").innerHTML = `<p class="note">Die Inhalte konnten nicht geladen werden. Bitte prüfe deine Internetverbindung und lade die Seite neu.</p>`;
    return;
  }
  state.fupa = { ...S.fupa };
  state.products = S.products;
  const [, m, d] = S.stand.split("-");
  document.getElementById("src").textContent = `Stand ${d}.${m}.`;
  applyRoute();
  lastLoad = Date.now();
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
