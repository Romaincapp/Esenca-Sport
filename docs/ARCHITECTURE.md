# Architecture

Le site est volontairement simple : trois fichiers servis tels quels, sans
framework ni étape de compilation. `package.json` ne sert qu'aux tests.

## Flux des données

1. `main.js` appelle l'API **Google Calendar v3** (`fetchEvents`) avec
   `CALENDAR_ID` et `API_KEY` (définis en haut du fichier). Les événements des
   24 derniers mois sont récupérés, pages suivantes comprises.
2. `buildEvents` transforme chaque événement Google en objet interne :
   - les événements `cancelled` sont ignorés ;
   - le titre est découpé par `parseTitle` : `"E.S. | Foot - Philippeville"`
     devient sport `Foot`, lieu `Philippeville` ;
   - le lien d'inscription (`extractLink`) est, dans l'ordre : la première URL
     de la description, sinon `source.url`, sinon le lien Google Agenda.
3. `refreshFilters` remplit les listes Sport / Lieu / Mois ; `renderEvents`
   affiche les cartes groupées par mois.
4. `injectStructuredData` ajoute un JSON-LD `SportsEvent` par événement (SEO).

> **Convention de nommage dans Google Agenda** : `E.S. | <Sport> - <Lieu>`.
> Un titre qui ne la respecte pas s'affiche quand même, mais filtre moins bien.

## Clé API

La clé est visible dans la page (site statique). Elle doit rester restreinte
dans Google Cloud : référents HTTP (domaines du site) + API « Google Calendar »
uniquement.

## Header et menus de navigation

Le header contient un menu inspiré du composant *Navigation Menu* de shadcn/ui,
réécrit en HTML/CSS/JS natif (shadcn/ui nécessite React).

- **HTML** (`index.html`) : `nav.nav-menu > ul.nav-menu-list > li.nav-menu-item`,
  chaque item contient un `button.nav-menu-trigger` (avec `aria-controls`) et un
  panneau `div.nav-menu-content[hidden]` contenant des `a.nav-menu-link`.
- **JS** (`initNavMenu` dans `main.js`) : générique, il gère tous les items
  présents dans la page.
  - clic : ouvre/ferme ; un seul menu ouvert à la fois ;
  - survol (appareils avec souris) : ouvre ; un clic juste après ne referme pas ;
  - Échap : ferme et rend le focus au bouton ; clic extérieur ou perte de focus : ferme ;
  - lien avec l'attribut `data-copy` : copie son `href` dans le presse-papiers
    au lieu de l'ouvrir (utilisé pour « Copier le lien iCal »).
- **CSS** (`style.css`, section « Navigation menu ») : sur mobile (≤ 560 px) les
  panneaux prennent toute la largeur de la barre de navigation.

### Liens « Ajouter l'agenda »

Tous dérivent de l'identifiant de l'agenda (`CALENDAR_ID`, encodé `%40` pour `@`) :

| Service | Forme du lien |
| --- | --- |
| Google Agenda | `https://calendar.google.com/calendar/render?cid=<ID>` |
| Flux iCal public | `https://calendar.google.com/calendar/ical/<ID>/public/basic.ics` |
| Outlook.com | `https://outlook.live.com/calendar/0/addfromweb?url=<iCal encodé>&name=Esenca%20Sport` |
| Outlook 365 | `https://outlook.office.com/calendar/0/addfromweb?url=<iCal encodé>&name=Esenca%20Sport` |
| Apple | le flux iCal avec `webcal://` à la place de `https://` |

Si l'agenda change, il faut mettre à jour `CALENDAR_ID` **et** ces liens (et les tests).

## Superposition des calques (important)

La carte de filtres remonte sur le bas du bandeau bleu (`margin-top` négatif).
Pour que la carte reste **au-dessus** du bleu, et que les menus ouverts restent
**au-dessus** de la carte :

| Calque | z-index |
| --- | --- |
| Fond bleu découpé (`.site-header::before`) | 0 |
| Carte de filtres (`.filters`) | 2 |
| Contenu du header, menus compris (`.header-inner`) | 3 |

Ne pas mettre de `z-index` ni de `clip-path` directement sur `.site-header` :
cela regrouperait tout le header dans un seul calque et la carte repasserait
dessous (bug déjà rencontré, couvert par les tests « Superposition »).
