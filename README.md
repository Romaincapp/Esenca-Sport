# Calendrier Esenca Sport

Site statique (HTML, CSS, JavaScript sans framework) qui affiche les activités
handisport et sport adapté d'Esenca Sport à partir d'un **Google Agenda public**.

- Filtres par sport, lieu et mois, avec option « voir les événements passés ».
- Au clic sur un événement : overlay de détails avec bouton d'inscription.
- Header avec menus de navigation : **Ressources**, **Contact**, **Ajouter l'agenda**
  (abonnement Google Agenda, Outlook, Apple, lien iCal).
- Données structurées (schema.org) pour le référencement.

## Démarrage rapide

Aucune compilation : les fichiers sont servis tels quels.

```bash
npm install        # uniquement pour les outils de test
npm start          # sert le site sur http://localhost:4173
npm test           # lance tous les tests (ordinateur + mobile)
```

## Structure

| Fichier / dossier | Rôle |
| --- | --- |
| `index.html` | Structure de la page, header et menus, SEO (meta, JSON-LD) |
| `style.css` | Styles (variables de couleurs dans `:root`) |
| `main.js` | Chargement de l'agenda, filtres, overlay, menus de navigation |
| `tests/` | Tests de bout en bout Playwright |
| `docs/` | Documentation détaillée |
| `.github/workflows/tests.yml` | Lance les tests sur chaque PR et chaque push sur `main` |

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) : fonctionnement du site (données, rendu, header, superposition des calques).
- [docs/MAINTENANCE.md](docs/MAINTENANCE.md) : recettes pour les modifications courantes (ajouter un lien ou un menu, changer un contact…).
- [docs/TESTS.md](docs/TESTS.md) : lancer, lire et écrire les tests.
- [CHANGELOG.md](CHANGELOG.md) : historique des évolutions.

## Règle d'or

Toute modification passe par une pull request : les tests tournent
automatiquement dessus. Une nouvelle fonctionnalité arrive **avec ses tests**
et une mise à jour de la documentation.
