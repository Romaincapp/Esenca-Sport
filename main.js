/* ============================================================
   Calendrier Esenca Sport
   Affiche les événements d'un Google Agenda public (fichier iCal),
   avec filtres par sport / par mois et overlay de détails.
   ============================================================ */

// ---- Configuration ---------------------------------------------------------

// URL iCal publique du Google Agenda.
const ICAL_URL =
  "https://calendar.google.com/calendar/ical/17m8o2c4mvte6m5f2t4s9n8eis%40group.calendar.google.com/public/basic.ics";

// Le fichier iCal de Google ne renvoie pas d'en-têtes CORS : une page statique
// ne peut donc pas le charger directement. On passe par un proxy CORS, avec
// plusieurs solutions de repli en cas d'indisponibilité de l'une d'elles.
const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

// Fenêtre d'expansion des événements récurrents (bornée pour éviter les boucles).
const EXPAND_FROM = new Date();
EXPAND_FROM.setMonth(EXPAND_FROM.getMonth() - 1);
const EXPAND_TO = new Date();
EXPAND_TO.setFullYear(EXPAND_TO.getFullYear() + 2);

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const MONTHS_FR_SHORT = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];
const DAYS_FR = [
  "dimanche", "lundi", "mardi", "mercredi",
  "jeudi", "vendredi", "samedi",
];

// ---- État ------------------------------------------------------------------

let allEvents = [];

// ---- Récupération ----------------------------------------------------------

async function fetchICal() {
  let lastError;
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetch(proxy(ICAL_URL), { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.includes("BEGIN:VCALENDAR")) return text;
      throw new Error("Réponse invalide (pas de calendrier)");
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Impossible de récupérer le calendrier");
}

// ---- Analyse iCal ----------------------------------------------------------

// Déplie les lignes repliées (une ligne de continuation commence par un espace
// ou une tabulation).
function unfoldLines(raw) {
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

// Sépare "NAME;PARAM=x:value" en { name, params, value }.
function parseLine(line) {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = left.split(";");
  const name = parts.shift().toUpperCase();
  const params = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq > -1) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  }
  return { name, params, value };
}

// Décode les échappements texte iCal (\n, \, , \; , \\).
function unescapeText(v) {
  return (v || "")
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

// Convertit une valeur de date iCal en objet { date, allDay }.
// Gère VALUE=DATE (journée entière), les heures UTC (suffixe Z) et les heures
// locales / avec TZID (interprétées comme heure "murale" à afficher telle quelle).
function parseICalDate(value, params) {
  const isDate = params.VALUE === "DATE" || /^\d{8}$/.test(value);
  const m = value.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/
  );
  if (!m) return { date: null, allDay: false };
  const [, y, mo, d, hh, mm, ss, z] = m;
  if (isDate || hh === undefined) {
    return { date: new Date(+y, +mo - 1, +d), allDay: true };
  }
  if (z) {
    // Heure UTC → convertie vers l'heure locale du visiteur.
    return {
      date: new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss || 0)),
      allDay: false,
    };
  }
  // Heure locale / TZID : on affiche l'heure telle qu'écrite dans l'agenda.
  return { date: new Date(+y, +mo - 1, +d, +hh, +mm, +ss || 0), allDay: false };
}

// Extrait les blocs VEVENT bruts.
function parseVEvents(raw) {
  const lines = unfoldLines(raw);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = { EXDATE: [] };
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur) events.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    const parsed = parseLine(line);
    if (!parsed) continue;
    const { name, params, value } = parsed;
    if (name === "EXDATE") {
      cur.EXDATE.push(parseICalDate(value.split(",")[0], params).date);
    } else {
      cur[name] = { value, params };
    }
  }
  return events;
}

// ---- Récurrences (RRULE) ---------------------------------------------------

const BYDAY_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseRRule(str) {
  const rule = {};
  for (const part of str.split(";")) {
    const [k, v] = part.split("=");
    rule[k.toUpperCase()] = v;
  }
  return rule;
}

// Étend un événement récurrent en une liste de dates de début, dans la fenêtre.
function expandRecurrence(rule, start) {
  const freq = rule.FREQ;
  const interval = parseInt(rule.INTERVAL || "1", 10) || 1;
  const count = rule.COUNT ? parseInt(rule.COUNT, 10) : null;
  let until = null;
  if (rule.UNTIL) until = parseICalDate(rule.UNTIL, {}).date;
  const byDays = rule.BYDAY
    ? rule.BYDAY.split(",").map((d) => BYDAY_MAP[d.slice(-2)]).filter((n) => n !== undefined)
    : null;

  const results = [];
  const limit = 800; // garde-fou
  let occurrences = 0;

  const pushIfInWindow = (d) => {
    if (until && d > until) return false;
    if (count && occurrences >= count) return false;
    occurrences++;
    if (d >= EXPAND_FROM && d <= EXPAND_TO) results.push(new Date(d));
    return true;
  };

  if (freq === "WEEKLY" && byDays && byDays.length) {
    // Point de départ : début de la semaine contenant `start`.
    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    let week = new Date(weekStart);
    let iterations = 0;
    while (iterations < limit && week <= EXPAND_TO) {
      for (const dow of byDays.slice().sort((a, b) => a - b)) {
        const occ = new Date(week);
        occ.setDate(week.getDate() + dow);
        occ.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
        if (occ < start) continue;
        if (!pushIfInWindow(occ)) return results;
      }
      week.setDate(week.getDate() + 7 * interval);
      iterations++;
    }
    return results;
  }

  // FREQ = DAILY / WEEKLY (sans BYDAY) / MONTHLY / YEARLY
  let occ = new Date(start);
  let iterations = 0;
  while (iterations < limit && occ <= EXPAND_TO) {
    if (!pushIfInWindow(occ)) break;
    const next = new Date(occ);
    switch (freq) {
      case "DAILY": next.setDate(next.getDate() + interval); break;
      case "WEEKLY": next.setDate(next.getDate() + 7 * interval); break;
      case "MONTHLY": next.setMonth(next.getMonth() + interval); break;
      case "YEARLY": next.setFullYear(next.getFullYear() + interval); break;
      default: return results; // FREQ inconnu → occurrence unique déjà ajoutée
    }
    occ = next;
    iterations++;
  }
  return results;
}

// ---- Construction du modèle ------------------------------------------------

// Décompose "E.S. | Foot - Philippeville" → { sport: "Foot", place: "Philippeville" }.
function parseTitle(summary) {
  const raw = (summary || "").trim();
  let rest = raw;
  const pipe = raw.indexOf("|");
  if (pipe > -1) rest = raw.slice(pipe + 1).trim();

  let sport = rest;
  let place = "";
  const dash = rest.indexOf(" - ");
  if (dash > -1) {
    sport = rest.slice(0, dash).trim();
    place = rest.slice(dash + 3).trim();
  }
  return { sport: sport || "Autre", place, title: rest || raw };
}

function buildEvents(raw) {
  const vevents = parseVEvents(raw);
  const events = [];

  for (const ve of vevents) {
    if (!ve.DTSTART) continue;
    const summary = ve.SUMMARY ? unescapeText(ve.SUMMARY.value) : "(Sans titre)";
    const { sport, place, title } = parseTitle(summary);
    const description = ve.DESCRIPTION ? unescapeText(ve.DESCRIPTION.value) : "";
    const location = ve.LOCATION ? unescapeText(ve.LOCATION.value) : "";
    const url = ve.URL ? ve.URL.value.trim() : "";

    const startInfo = parseICalDate(ve.DTSTART.value, ve.DTSTART.params);
    if (!startInfo.date) continue;

    // Durée (pour reporter l'heure de fin sur chaque occurrence).
    let durationMs = 0;
    if (ve.DTEND) {
      const endInfo = parseICalDate(ve.DTEND.value, ve.DTEND.params);
      if (endInfo.date) durationMs = endInfo.date - startInfo.date;
    }

    const exdates = (ve.EXDATE || [])
      .filter(Boolean)
      .map((d) => d.getTime());

    const makeEvent = (start) => ({
      sport,
      place: place || location,
      location,
      title,
      summary,
      description,
      url,
      start,
      end: durationMs ? new Date(start.getTime() + durationMs) : null,
      allDay: startInfo.allDay,
    });

    if (ve.RRULE) {
      const rule = parseRRule(ve.RRULE.value);
      const occurrences = expandRecurrence(rule, startInfo.date);
      for (const occ of occurrences) {
        if (exdates.includes(occ.getTime())) continue;
        events.push(makeEvent(occ));
      }
    } else {
      events.push(makeEvent(startInfo.date));
    }
  }

  events.sort((a, b) => a.start - b.start);
  return events;
}

// ---- Formatage ------------------------------------------------------------

function formatDateLong(d) {
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}
function formatTime(d) {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}h${m}`;
}
function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d) {
  return `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

// ---- Rendu ----------------------------------------------------------------

const eventsEl = document.getElementById("events");
const sportSelect = document.getElementById("filter-sport");
const monthSelect = document.getElementById("filter-month");
const resetBtn = document.getElementById("reset-filters");
const resultCount = document.getElementById("result-count");

function populateFilters() {
  const sports = [...new Set(allEvents.map((e) => e.sport))].sort((a, b) =>
    a.localeCompare(b, "fr")
  );
  for (const s of sports) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sportSelect.appendChild(opt);
  }

  const months = new Map();
  for (const e of allEvents) months.set(monthKey(e.start), e.start);
  const sortedKeys = [...months.keys()].sort();
  for (const key of sortedKeys) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = monthLabel(months.get(key));
    monthSelect.appendChild(opt);
  }
}

function getFiltered() {
  const sport = sportSelect.value;
  const month = monthSelect.value;
  return allEvents.filter((e) => {
    if (sport && e.sport !== sport) return false;
    if (month && monthKey(e.start) !== month) return false;
    return true;
  });
}

function renderEvents() {
  const list = getFiltered();
  eventsEl.innerHTML = "";

  resultCount.textContent =
    list.length === 0
      ? "Aucun événement"
      : `${list.length} événement${list.length > 1 ? "s" : ""}`;

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "state";
    empty.innerHTML = "<p>Aucun événement ne correspond à ces filtres.</p>";
    eventsEl.appendChild(empty);
    return;
  }

  for (const ev of list) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "event-card";

    const dow = ev.allDay ? "" : DAYS_FR[ev.start.getDay()];
    const timeLine = ev.allDay
      ? "Journée entière"
      : `${formatTime(ev.start)}${ev.end ? " – " + formatTime(ev.end) : ""}`;
    const place = ev.place || "";

    card.innerHTML = `
      <div class="card-date">
        <span class="day">${ev.start.getDate()}</span>
        <span class="mon">${MONTHS_FR_SHORT[ev.start.getMonth()]}</span>
        <span class="dow">${dow}</span>
      </div>
      <span class="card-sport"></span>
      <h3 class="card-title"></h3>
      <div class="card-info">
        <span class="js-time"></span>
        ${place ? '<span class="js-place"></span>' : ""}
      </div>
    `;
    card.querySelector(".card-sport").textContent = ev.sport;
    card.querySelector(".card-title").textContent = ev.title;
    card.querySelector(".js-time").textContent = "🕐 " + timeLine;
    if (place) card.querySelector(".js-place").textContent = "📍 " + place;

    card.addEventListener("click", () => openOverlay(ev));
    eventsEl.appendChild(card);
  }
}

// ---- Overlay --------------------------------------------------------------

const overlay = document.getElementById("overlay");
const ovSport = document.getElementById("ov-sport");
const ovTitle = document.getElementById("ov-title");
const ovDate = document.getElementById("ov-date");
const ovTimeRow = document.getElementById("ov-time-row");
const ovTime = document.getElementById("ov-time");
const ovPlaceRow = document.getElementById("ov-place-row");
const ovPlace = document.getElementById("ov-place");
const ovDesc = document.getElementById("ov-desc");
const ovLink = document.getElementById("ov-link");

// Transforme une description texte en HTML sûr, avec liens cliquables.
function descToHtml(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener">$1</a>'
  );
}

function openOverlay(ev) {
  ovSport.textContent = ev.sport;
  ovTitle.textContent = ev.title;
  ovDate.textContent = formatDateLong(ev.start);

  if (ev.allDay) {
    ovTimeRow.style.display = "none";
  } else {
    ovTimeRow.style.display = "";
    ovTime.textContent =
      formatTime(ev.start) + (ev.end ? " – " + formatTime(ev.end) : "");
  }

  const place = ev.place || ev.location;
  if (place) {
    ovPlaceRow.style.display = "";
    ovPlace.textContent = place;
  } else {
    ovPlaceRow.style.display = "none";
  }

  ovDesc.innerHTML = ev.description ? descToHtml(ev.description) : "";

  if (ev.url) {
    ovLink.href = ev.url;
    ovLink.classList.remove("disabled");
    ovLink.textContent = "S'inscrire à l'événement";
    ovLink.removeAttribute("aria-disabled");
  } else {
    ovLink.href = "#";
    ovLink.classList.add("disabled");
    ovLink.textContent = "Aucun lien d'inscription";
    ovLink.setAttribute("aria-disabled", "true");
  }

  overlay.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeOverlay() {
  overlay.hidden = true;
  document.body.style.overflow = "";
}

overlay.addEventListener("click", (e) => {
  if (e.target.hasAttribute("data-close")) closeOverlay();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !overlay.hidden) closeOverlay();
});

// ---- Initialisation --------------------------------------------------------

function showError(message) {
  eventsEl.innerHTML = "";
  const el = document.createElement("div");
  el.className = "state error";
  el.innerHTML = `
    <p><strong>Impossible de charger le calendrier.</strong></p>
    <p>${message}</p>
    <p style="margin-top:1rem"><button type="button" class="btn-reset" onclick="location.reload()">Réessayer</button></p>
  `;
  eventsEl.appendChild(el);
}

sportSelect.addEventListener("change", renderEvents);
monthSelect.addEventListener("change", renderEvents);
resetBtn.addEventListener("click", () => {
  sportSelect.value = "";
  monthSelect.value = "";
  renderEvents();
});

async function init() {
  try {
    const raw = await fetchICal();
    allEvents = buildEvents(raw);
    if (allEvents.length === 0) {
      showError("Aucun événement trouvé dans l'agenda.");
      return;
    }
    populateFilters();
    renderEvents();
  } catch (err) {
    console.error(err);
    showError(
      "Vérifiez votre connexion. Le calendrier est chargé via un proxy public qui peut être temporairement indisponible."
    );
  }
}

init();
