# Tests

Tests de bout en bout avec [Playwright](https://playwright.dev) : un vrai
navigateur (Chromium) ouvre le site et vérifie ce que voit l'utilisateur.
Chaque test tourne deux fois : **ordinateur** (1280 px) et **mobile** (Pixel 5).

## Lancer les tests

```bash
npm install
npx playwright install chromium   # la première fois seulement
npm test                          # tous les tests
npx playwright test header-nav    # un seul fichier
npx playwright test -g "Contact"  # tests dont le nom contient « Contact »
npm run test:ui                   # interface visuelle pas à pas
```

Le site est servi automatiquement sur `http://localhost:4173` pendant les tests.
En cas d'échec, une capture d'écran et une trace sont enregistrées dans
`test-results/` (`npx playwright show-trace <fichier trace.zip>`).

Sur GitHub, le workflow `.github/workflows/tests.yml` lance les tests sur chaque
pull request ; en cas d'échec, le rapport est téléchargeable dans l'onglet
*Actions* (artefact `rapport-playwright`).

## API Google simulée

Les tests n'appellent **jamais** la vraie API Google : `tests/fixtures.js`
intercepte la requête et renvoie de faux événements (dates calculées par rapport
à aujourd'hui). Les tests sont donc rapides, fonctionnent hors ligne et ne
dépendent pas du contenu réel de l'agenda.

Événements simulés : Foot (Philippeville, dans 5 jours, avec lien d'inscription),
Natation (Namur, journée entière), Boccia (Charleroi), un Foot passé (Dinant) et
un Tennis annulé (ignoré).

Pour un scénario particulier dans un test :

```js
const { test, expect, mockCalendar } = require("./fixtures");

test("agenda vide", async ({ page }) => {
  await mockCalendar(page, { items: [] });   // ou { status: 500 }
  await page.goto("/");
});
```

## Ce qui est couvert

| Fichier | Couvre |
| --- | --- |
| `tests/header-nav.spec.js` | Menus (ouverture, fermeture, survol, Échap, clic extérieur, un seul ouvert), contenu et liens des menus, copie du lien iCal, cohérence du téléphone, superposition header / filtres |
| `tests/calendar.spec.js` | Affichage des événements, découpage sport/lieu, filtres, événements passés, overlay et lien d'inscription, données structurées, erreurs de l'API |

## Écrire un nouveau test

- Importer `test` et `expect` depuis `./fixtures` (pas depuis `@playwright/test`)
  pour profiter de l'API simulée.
- Cibler les éléments comme un utilisateur : `getByRole("button", { name: "Contact" })`,
  `getByText(...)`, plutôt que par classe CSS quand c'est possible.
- Utiliser `isMobile` pour adapter ou ignorer un test sur mobile
  (`test.skip(isMobile, "raison")`).
- Un bug corrigé = un test qui l'aurait détecté.
