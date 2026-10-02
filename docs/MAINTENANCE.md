# Modifications courantes

Après chaque modification : `npm test`, puis pull request.

## Ajouter un lien dans un menu existant

Dans `index.html`, copier un bloc `<li>` à l'intérieur du panneau voulu
(`#nav-ressources`, `#nav-contact` ou `#nav-agenda`) :

```html
<li>
  <a class="nav-menu-link" href="https://exemple.be/" target="_blank" rel="noopener">
    <span class="nav-menu-link-title"><span aria-hidden="true">🔗</span> Titre du lien</span>
    <span class="nav-menu-link-desc">Courte description.</span>
  </a>
</li>
```

- Lien externe : garder `target="_blank" rel="noopener"` (vérifié par les tests).
- Lien `mailto:` / `tel:` / `webcal:` : pas de `target`.
- Ajouter une vérification du lien dans `tests/header-nav.spec.js` (« Contenu des menus »).

## Ajouter un nouveau menu

Dupliquer un bloc `<li class="nav-menu-item">…</li>` complet dans
`ul.nav-menu-list` et changer :

1. le texte du bouton ;
2. l'`id` du panneau **et** l'`aria-controls` du bouton (identiques, uniques, ex. `nav-partenaires`).

Aucun JavaScript à écrire. Ajouter le menu à la liste des tests
« les trois menus sont présents » et « le panneau reste entièrement visible ».
Sur mobile, les boutons doivent tenir **sur une seule ligne** (vérifié par les
tests, jusqu'à 360 px de large). Si le libellé est long, prévoir un libellé court :

```html
<span class="nav-menu-label-full">Ajouter l'agenda</span>
<span class="nav-menu-label-short" aria-hidden="true">Agenda</span>
```

Au-delà de quatre menus, la ligne mobile sera trop chargée : envisager alors un
bouton unique « Menu » qui regroupe tout sur mobile.

## Changer une information de contact

Le téléphone et l'e-mail apparaissent à **plusieurs endroits** de `index.html` :

- menu Contact (header) ;
- pied de page ;
- bloc `<noscript>` ;
- données structurées JSON-LD (`"telephone"`, `"email"`) dans le `<head>`.

Rechercher l'ancienne valeur dans tout le projet, puis mettre à jour
`tests/header-nav.spec.js` (le test « le même numéro de téléphone est utilisé
partout » vérifie la cohérence).

Numéro actuel : **081 777 813** (`tel:+3281777813`, JSON-LD `+32 81 77 78 13`).

## Changer de Google Agenda

Voir « Liens Ajouter l'agenda » dans [ARCHITECTURE.md](ARCHITECTURE.md).

## Couleurs

Les couleurs de la charte sont des variables en haut de `style.css`
(`--brand`, `--accent`…). Les modifier là plutôt que dans chaque règle.
