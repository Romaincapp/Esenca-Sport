// Tests du calendrier : chargement des événements (API Google simulée),
// filtres, événements passés, overlay de détails et gestion d'erreur.
const { test, expect, mockCalendar } = require("./fixtures");

const cards = (page) => page.locator(".event-card");

test.describe("Affichage des événements", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("affiche les événements à venir et ignore les annulés", async ({ page }) => {
    await expect(cards(page)).toHaveCount(3);
    await expect(page.locator("#result-count")).toHaveText("3 événements");
    await expect(page.getByText("Tennis")).toHaveCount(0);
  });

  test("découpe le titre en sport et lieu", async ({ page }) => {
    const foot = cards(page).filter({ hasText: "Philippeville" });
    await expect(foot.locator(".card-sport")).toHaveText("Foot");
    await expect(foot.locator(".card-title")).toHaveText("Foot - Philippeville");
    await expect(foot).toContainText("🕐 10h00 – 16h00");
  });

  test("affiche « Journée entière » pour un événement sans horaire", async ({ page }) => {
    await expect(cards(page).filter({ hasText: "Namur" })).toContainText("Journée entière");
  });

  test("ajoute des données structurées pour le référencement", async ({ page }) => {
    await expect(cards(page)).toHaveCount(3);
    const types = await page.$$eval('script[type="application/ld+json"]', (els) =>
      els.map((el) => JSON.parse(el.textContent)).flat().map((d) => d["@type"])
    );
    expect(types).toContain("SportsEvent");
  });
});

test.describe("Filtres", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(cards(page)).toHaveCount(3);
  });

  test("filtre par sport puis réinitialise", async ({ page }) => {
    await page.selectOption("#filter-sport", "Foot");
    await expect(cards(page)).toHaveCount(1);
    await expect(page.locator("#result-count")).toHaveText("1 événement");

    await page.getByRole("button", { name: "Réinitialiser" }).click();
    await expect(cards(page)).toHaveCount(3);
  });

  test("filtre par lieu", async ({ page }) => {
    await page.selectOption("#filter-place", "Charleroi");
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Boccia");
  });

  test("affiche les événements passés à la demande", async ({ page }) => {
    await page.getByText("Voir les événements passés").click();
    await expect(cards(page)).toHaveCount(4);
    await expect(page.locator(".event-card.past")).toHaveCount(1);
  });
});

test.describe("Overlay de détails", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("s'ouvre au clic avec le lien d'inscription et se ferme avec Échap", async ({ page }) => {
    await cards(page).filter({ hasText: "Philippeville" }).click();
    const overlay = page.locator("#overlay");
    await expect(overlay).toBeVisible();
    await expect(page.locator("#ov-title")).toHaveText("Foot - Philippeville");
    await expect(page.locator("#ov-link"))
      .toHaveAttribute("href", "https://example.org/inscription-foot");

    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();
  });

  test("désactive le bouton quand il n'y a pas de lien d'inscription", async ({ page }) => {
    await cards(page).filter({ hasText: "Namur" }).click();
    await expect(page.locator("#ov-link")).toHaveText("Aucun lien d'inscription");
    await expect(page.locator("#ov-link")).toHaveAttribute("aria-disabled", "true");
  });
});

test.describe("Erreurs", () => {
  test("affiche un message si l'API Google ne répond pas", async ({ page }) => {
    await mockCalendar(page, { status: 500 });
    await page.goto("/");
    await expect(page.getByText("Impossible de charger le calendrier")).toBeVisible();
    await expect(page.getByText("Erreur simulée")).toBeVisible();
  });

  test("affiche un message si l'agenda est vide", async ({ page }) => {
    await mockCalendar(page, { items: [] });
    await page.goto("/");
    await expect(page.getByText("Aucun événement trouvé dans l'agenda.")).toBeVisible();
  });
});
