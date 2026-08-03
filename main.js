/* ============================================================
   Calendrier Esenca Sport
   Affiche les événements d'un Google Agenda public via l'API
   Google Calendar v3 (fetch direct, sans proxy).
   Filtres par sport / par mois + overlay de détails.
   ============================================================ */

// ---- Configuration ---------------------------------------------------------

// Identifiant du Google Agenda public.
const CALENDAR_ID = "17m8o2c4mvte6m5f2t4s9n8eis@group.calendar.google.com";

// Clé API Google (API "Google Calendar API").
// ⚠️ Dans une page statique la clé est visible : sécurise-la dans Google Cloud
//    → Restriction par référent HTTP (ton/tes domaines)
//    → Restriction d'API : "Google Calendar API" uniquement
//    Ainsi une clé copiée ailleurs est rejetée par Google.
const API_KEY = "REMPLACE_PAR_TA_CLE_API";

// On récupère les événements à partir d'il y a 1 mois.
const TIME_MIN = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString();
})();

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

// ---- Récupération (API Calendar v3) ---------------------------------------

// L'endpoint JSON de l'API v3 renvoie les en-têtes CORS : un fetch direct
// fonctionne, sans proxy. singleEvents=true déplie les événements récurrents.
async function fetchEvents() {
  const base =
    `https://www.googleapis.com/calendar/v3/calendars/` +
    `${encodeURIComponent(CALENDAR_ID)}/events`;

  const items = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      key: API_KEY,
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: TIME_MIN,
      maxResults: "2500",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${base}?${params.toString()}`);
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j.error && j.error.message) detail = j.error.message;
      } catch (_) {}
      throw new Error(detail);
    }
    const data = await res.json();
    if (Array.isArray(data.items)) items.push(...data.items);
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return items;
}

// ---- Construction du modèle ------------------------------------------------

// Décompose "E.S. | Foot - Philippeville" → { sport, place, title }.
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

// Extrait le lien d'inscription d'un événement (par ordre de préférence).
function extractLink(item) {
  if (item.source && item.source.url) return item.source.url;
  const desc = item.description || "";
  const m = desc.match(/https?:\/\/[^\s"'<>]+/);
  if (m) return m[0];
  if (item.htmlLink) return item.htmlLink;
  return "";
}

function buildEvents(items) {
  const events = [];

  for (const item of items) {
    if (item.status === "cancelled") continue;
    if (!item.start) continue;

    const allDay = !!item.start.date;
    const start = allDay
      ? new Date(item.start.date + "T00:00:00")
      : new Date(item.start.dateTime);
    if (isNaN(start)) continue;

    let end = null;
    if (item.end) {
      end = allDay
        ? (item.end.date ? new Date(item.end.date + "T00:00:00") : null)
        : new Date(item.end.dateTime);
      if (end && isNaN(end)) end = null;
    }

    const summary = item.summary || "(Sans titre)";
    const { sport, place, title } = parseTitle(summary);

    events.push({
      sport,
      place: place || item.location || "",
      location: item.location || "",
      title,
      summary,
      description: item.description || "",
      url: extractLink(item),
      start,
      end,
      allDay,
    });
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
  if (!API_KEY || API_KEY === "REMPLACE_PAR_TA_CLE_API") {
    showError("Clé API manquante : renseigne API_KEY dans main.js.");
    return;
  }
  try {
    const items = await fetchEvents();
    allEvents = buildEvents(items);
    if (allEvents.length === 0) {
      showError("Aucun événement trouvé dans l'agenda.");
      return;
    }
    populateFilters();
    renderEvents();
  } catch (err) {
    console.error(err);
    showError(err.message || "Erreur inattendue.");
  }
}

init();
