// Tests du header : menus de navigation (Ressources, Contact, Ajouter l'agenda)
// et superposition header / carte de filtres.
const { test, expect } = require("./fixtures");

const CAL_ID = "17m8o2c4mvte6m5f2t4s9n8eis%40group.calendar.google.com";
const ICS_URL = `https://calendar.google.com/calendar/ical/${CAL_ID}/public/basic.ics`;

const trigger = (page, name) => page.getByRole("button", { name, exact: true });
const panel = (page, id) => page.locator(`#${id}`);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test.describe("Menus de navigation", () => {
  test("les trois menus sont présents et fermés au chargement", async ({ page }) => {
    for (const [name, id] of [
      ["Ressources", "nav-ressources"],
      ["Contact", "nav-contact"],
      ["Ajouter l'agenda", "nav-agenda"],
    ]) {
      await expect(trigger(page, name)).toBeVisible();
      await expect(trigger(page, name)).toHaveAttribute("aria-expanded", "false");
      await expect(panel(page, id)).toBeHidden();
    }
  });

  test("un clic ouvre le menu, un second clic le referme", async ({ page, isMobile }) => {
    const btn = trigger(page, "Ressources");
    await btn.click();
    await expect(btn).toHaveAttribute("aria-expanded", "true");
    await expect(panel(page, "nav-ressources")).toBeVisible();

    // Sur ordinateur, le survol a déjà ouvert le menu : on quitte d'abord la zone.
    if (!isMobile) await page.mouse.move(5, 5);
    await btn.click();
    await expect(btn).toHaveAttribute("aria-expanded", "false");
    await expect(panel(page, "nav-ressources")).toBeHidden();
  });

  test("un seul menu est ouvert à la fois", async ({ page }) => {
    await trigger(page, "Ressources").click();
    await trigger(page, "Contact").click();
    await expect(panel(page, "nav-contact")).toBeVisible();
    await expect(panel(page, "nav-ressources")).toBeHidden();
  });

  test("Échap referme le menu et rend le focus au bouton", async ({ page }) => {
    const btn = trigger(page, "Contact");
    await btn.click();
    await page.keyboard.press("Escape");
    await expect(panel(page, "nav-contact")).toBeHidden();
    await expect(btn).toBeFocused();
  });

  test("un clic en dehors referme le menu", async ({ page }) => {
    await trigger(page, "Contact").click();
    // Clic sur une zone neutre, loin du menu (bas de la page).
    const { height } = page.viewportSize();
    await page.mouse.click(5, height - 5);
    await expect(panel(page, "nav-contact")).toBeHidden();
  });

  test("ouverture au survol sur ordinateur", async ({ page, isMobile }) => {
    test.skip(isMobile, "Pas de survol sur écran tactile");
    await trigger(page, "Ajouter l'agenda").hover();
    await expect(panel(page, "nav-agenda")).toBeVisible();
    // Un clic juste après le survol ne doit pas refermer le menu.
    await trigger(page, "Ajouter l'agenda").click();
    await expect(panel(page, "nav-agenda")).toBeVisible();
  });

  test("le panneau reste entièrement visible à l'écran", async ({ page }) => {
    const viewport = page.viewportSize();
    for (const [name, id] of [
      ["Ressources", "nav-ressources"],
      ["Contact", "nav-contact"],
      ["Ajouter l'agenda", "nav-agenda"],
    ]) {
      await trigger(page, name).click();
      const box = await panel(page, id).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      await page.keyboard.press("Escape");
    }
  });
});

test.describe("Menu compact sur mobile", () => {
  test("les trois boutons tiennent sur une seule ligne", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Spécifique au mobile");
    const tops = await page.locator(".nav-menu-trigger").evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top))
    );
    expect(new Set(tops).size).toBe(1);
  });

  test("les libellés et flèches ne sont pas coupés sur petit écran (360 px)", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Spécifique au mobile");
    await page.setViewportSize({ width: 360, height: 700 });
    const overflowing = await page.locator(".nav-menu-trigger").evaluateAll((els) =>
      els.filter((el) => el.scrollWidth > el.clientWidth).map((el) => el.textContent.trim())
    );
    expect(overflowing).toEqual([]);
  });

  test("libellé court « Agenda », nom complet conservé pour l'accessibilité", async ({ page, isMobile }) => {
    const btn = trigger(page, "Ajouter l'agenda");
    await expect(btn).toBeVisible();
    if (isMobile) {
      await expect(btn.locator(".nav-menu-label-short")).toBeVisible();
      await expect(btn).toHaveText(/Agenda/);
    } else {
      await expect(btn.locator(".nav-menu-label-short")).toBeHidden();
    }
  });
});

test.describe("Contenu des menus", () => {
  test("Ressources : classements, règlements et site de Sportéa", async ({ page }) => {
    await trigger(page, "Ressources").click();
    const menu = panel(page, "nav-ressources");
    // Deux entrées distinctes pour la lisibilité, même dossier Google Drive.
    const drive = /drive\.google\.com\/drive\/folders\//;
    await expect(menu.getByRole("link", { name: /Classements/ })).toHaveAttribute("href", drive);
    await expect(menu.getByRole("link", { name: /Règlements/ })).toHaveAttribute("href", drive);
    await expect(menu.getByRole("link", { name: /Site de Sportéa/ }))
      .toHaveAttribute("href", "https://sportea.be/");
  });

  test("Contact : e-mail et téléphone", async ({ page }) => {
    await trigger(page, "Contact").click();
    const menu = panel(page, "nav-contact");
    await expect(menu.getByRole("link", { name: /Par e-mail/ }))
      .toHaveAttribute("href", "mailto:esenca.sport@solidaris.be");
    await expect(menu.getByRole("link", { name: /Par téléphone/ }))
      .toHaveAttribute("href", "tel:+3281777813");
    await expect(menu).toContainText("081 777 813");
  });

  test("le même numéro de téléphone est utilisé partout", async ({ page }) => {
    const telLinks = page.locator('a[href^="tel:"]');
    for (const link of await telLinks.all()) {
      await expect(link).toHaveAttribute("href", "tel:+3281777813");
    }
    await expect(page.locator(".site-footer")).toContainText("081 777 813");
  });

  test("Ajouter l'agenda : liens d'abonnement", async ({ page }) => {
    await trigger(page, "Ajouter l'agenda").click();
    const menu = panel(page, "nav-agenda");
    const encodedIcs = encodeURIComponent(ICS_URL);

    await expect(menu.getByRole("link", { name: /Google Agenda/ }))
      .toHaveAttribute("href", `https://calendar.google.com/calendar/render?cid=${CAL_ID}`);
    await expect(menu.getByRole("link", { name: /Outlook\.com/ }))
      .toHaveAttribute("href", `https://outlook.live.com/calendar/0/addfromweb?url=${encodedIcs}&name=Esenca%20Sport`);
    await expect(menu.getByRole("link", { name: /Outlook 365/ }))
      .toHaveAttribute("href", `https://outlook.office.com/calendar/0/addfromweb?url=${encodedIcs}&name=Esenca%20Sport`);
    await expect(menu.getByRole("link", { name: /Apple Calendrier/ }))
      .toHaveAttribute("href", ICS_URL.replace("https://", "webcal://"));
  });

  test("les liens externes s'ouvrent dans un nouvel onglet en sécurité", async ({ page }) => {
    const external = page.locator('.nav-menu a[href^="http"]:not([data-copy])');
    expect(await external.count()).toBeGreaterThan(0);
    for (const link of await external.all()) {
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
    }
  });

  test("« Copier le lien iCal » copie l'URL dans le presse-papiers", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await trigger(page, "Ajouter l'agenda").click();
    const link = panel(page, "nav-agenda").getByRole("link", { name: /Copier le lien iCal/ });
    await link.click();
    await expect(link).toContainText("Lien copié");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(ICS_URL);
    // Pas de navigation : on reste sur la page.
    await expect(page).toHaveURL(/localhost/);
  });
});

test.describe("Superposition header / filtres", () => {
  // Renvoie l'élément visible au point (x, y) de la page.
  const elementAt = (page, x, y) =>
    page.evaluate(([px, py]) => {
      const el = document.elementFromPoint(px, py);
      return el ? { id: el.closest("[id]")?.id, cls: el.className } : null;
    }, [x, y]);

  test("la carte de filtres passe au-dessus du fond bleu", async ({ page }) => {
    const card = await page.locator("#filters").boundingBox();
    const header = await page.locator(".site-header").boundingBox();
    // La carte chevauche bien le bas du header…
    expect(card.y).toBeLessThan(header.y + header.height);
    // …et c'est elle qu'on voit dans la zone de chevauchement.
    const hit = await elementAt(page, card.x + card.width / 2, card.y + 4);
    expect(hit.id).toBe("filters");
  });

  test("un menu ouvert passe au-dessus de la carte de filtres", async ({ page }) => {
    await trigger(page, "Ajouter l'agenda").click();
    const lastLink = panel(page, "nav-agenda").locator(".nav-menu-link").last();
    const box = await lastLink.boundingBox();
    const card = await page.locator("#filters").boundingBox();
    // Le dernier lien du menu tombe bien sur la carte de filtres…
    expect(box.y + box.height / 2).toBeGreaterThan(card.y);
    // …et il reste cliquable (au-dessus).
    const hit = await elementAt(page, box.x + box.width / 2, box.y + box.height / 2);
    expect(hit.id).toBe("nav-agenda");
  });
});
