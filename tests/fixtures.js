// Outils partagés par les tests.
//
// Le site interroge l'API Google Calendar. Pour des tests rapides, stables et
// hors ligne, on intercepte cet appel et on renvoie de faux événements
// (dates calculées par rapport à aujourd'hui pour ne jamais « périmer »).
const base = require("@playwright/test");

const CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars/**";

// Date au format AAAA-MM-JJ, décalée de `days` jours par rapport à aujourd'hui.
function dayOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Faux événements au format de l'API Google Calendar v3.
function sampleEvents() {
  return [
    {
      id: "foot",
      status: "confirmed",
      summary: "E.S. | Foot - Philippeville",
      description: "Tournoi amical. Inscriptions : https://example.org/inscription-foot",
      start: { dateTime: `${dayOffset(5)}T10:00:00+02:00` },
      end: { dateTime: `${dayOffset(5)}T16:00:00+02:00` },
    },
    {
      id: "natation",
      status: "confirmed",
      summary: "E.S. | Natation - Namur",
      start: { date: dayOffset(12) },
      end: { date: dayOffset(13) },
    },
    {
      id: "boccia",
      status: "confirmed",
      summary: "E.S. | Boccia - Charleroi",
      start: { dateTime: `${dayOffset(20)}T14:00:00+02:00` },
      end: { dateTime: `${dayOffset(20)}T17:00:00+02:00` },
    },
    {
      id: "passe",
      status: "confirmed",
      summary: "E.S. | Foot - Dinant",
      start: { dateTime: `${dayOffset(-30)}T10:00:00+02:00` },
      end: { dateTime: `${dayOffset(-30)}T12:00:00+02:00` },
    },
    {
      id: "annule",
      status: "cancelled",
      summary: "E.S. | Tennis - Liège",
      start: { dateTime: `${dayOffset(8)}T10:00:00+02:00` },
    },
  ];
}

// Fixture `page` étendue : l'API Google est simulée par défaut.
// Un test peut la remplacer avec `mockCalendar(page, { status, items })`.
async function mockCalendar(page, { status = 200, items = sampleEvents() } = {}) {
  await page.unroute(CALENDAR_API).catch(() => {});
  await page.route(CALENDAR_API, (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(
        status === 200 ? { items } : { error: { message: "Erreur simulée" } }
      ),
    })
  );
}

const test = base.test.extend({
  page: async ({ page }, use) => {
    await mockCalendar(page);
    await use(page);
  },
});

module.exports = { test, expect: base.expect, mockCalendar, sampleEvents, dayOffset };
