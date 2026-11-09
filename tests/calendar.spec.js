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

  test("regroupe les « Groupe N » sous un seul sport", async ({ page }) => {
    await mockCalendar(page, {
      items: [1, 2].map((n) => ({
        id: `bowling${n}`,
        status: "confirmed",
        summary: `E.S. | Bowling Groupe ${n} - Namur`,
        start: { date: "2099-01-0" + n },
        end: { date: "2099-01-0" + (n + 1) },
      })),
    });
    await page.goto("/");
    await expect(cards(page)).toHaveCount(2);
    const options = await page.locator("#filter-sport option").allTextContents();
    expect(options).toEqual(["Tous les sports", "Bowling"]);
    await page.selectOption("#filter-sport", "Bowling");
    await expect(cards(page)).toHaveCount(2);
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

  test("affiche l'adresse complète avec un lien vers la carte", async ({ page }) => {
    const adresse = "Rue de la Science 1, 6000 Charleroi, Belgique";
    await expect(cards(page).filter({ hasText: "Boccia" })).toContainText("📍 " + adresse);
    await cards(page).filter({ hasText: "Boccia" }).click();
    const link = page.locator("#ov-place a");
    await expect(link).toHaveText(adresse);
    await expect(link).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(adresse)
    );
  });

  test("sans adresse, affiche le lieu tiré du titre", async ({ page }) => {
    await cards(page).filter({ hasText: "Namur" }).click();
    await expect(page.locator("#ov-place")).toHaveText("Namur");
    await expect(page.locator("#ov-place a")).toHaveCount(0);
  });

  test("interprète une description HTML (liens, retours à la ligne) sans afficher les balises", async ({ page }) => {
    await mockCalendar(page, {
      items: [{
        id: "minifoot",
        status: "confirmed",
        summary: "E.S. | Minifoot - Aiseau-Presles",
        description:
          'Inscriptions :<br><a href="https://forms.gle/abc123">https://forms.gle/abc123</a>' +
          '<br><b>Gratuit</b><img src="x" onerror="window.__xss = true">',
        start: { date: "2099-01-05" },
        end: { date: "2099-01-06" },
      }],
    });
    await page.goto("/");
    await cards(page).first().click();
    const desc = page.locator("#ov-desc");
    await expect(desc).not.toContainText("<a");
    await expect(desc).not.toContainText("href");
    await expect(desc).toHaveText("Inscriptions :\nhttps://forms.gle/abc123\nGratuit");
    await expect(desc.locator("a")).toHaveAttribute("href", "https://forms.gle/abc123");
    await expect(desc.locator("a")).toHaveAttribute("target", "_blank");
    await expect(desc.locator("b")).toHaveText("Gratuit");
    await expect(desc.locator("img")).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    await expect(page.locator("#ov-link")).toHaveAttribute("href", "https://forms.gle/abc123");
  });

  test("rend cliquables les liens d'une description en texte brut", async ({ page }) => {
    await cards(page).filter({ hasText: "Philippeville" }).click();
    await expect(page.locator("#ov-desc")).toHaveText(
      "Tournoi amical. Inscriptions : https://example.org/inscription-foot"
    );
    await expect(page.locator("#ov-desc a"))
      .toHaveAttribute("href", "https://example.org/inscription-foot");
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
