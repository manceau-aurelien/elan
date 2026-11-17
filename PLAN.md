# Élan — plan

> Un coach, pas un CV. Élan montre le temps qui reste, jamais un score.

Appli web installable (PWA) pour Android, hébergée sur GitHub Pages, données stockées sur le téléphone.

## Principe

Trois échelles de temps qui s'emboîtent, avec un seul langage visuel : **le disque qui se vide**.

| Échelle | Rôle | Ce qu'on voit |
|---|---|---|
| **Heure** | le *maintenant* : je m'y mets | un disque qui se vide et se détériore |
| **Jour** | le *quoi* : où je dois arriver aujourd'hui | une ligne de 24 h, des destinations, la ligne « maintenant » |
| **Semaine** | le *pourquoi* : l'objectif qui compte | aujourd'hui + 6 jours, un objectif à date fixe qui se rapproche |

**Une tâche est un point d'arrivée**, pas un créneau de travail : « à 15 h, ce truc est fait ».
Un objectif de la semaine est la même chose, à l'échelle des jours : « jeudi, j'y suis arrivé ».

## Écran Heure (V1)

- Disque qui se vide (style minuteur mécanique). Toucher le centre : **pourcentage ⇄ temps réel**.
- Réglage : **tourner le disque au doigt** (1 tour = 60 min, de 1 min à 3 h) + boutons **5 / 15 / 30 min**.
- Depuis une tâche du Jour : le timer se lance **jusqu'à l'heure d'arrivée** (plafonné à 3 h).
- **L'écran reste allumé** pendant que le timer tourne (Wake Lock API).
- **Détérioration** au fil du temps :
  - couleur : vif → ambre → rouille terne ;
  - bord qui s'effrite (turbulence SVG de plus en plus forte) ;
  - fissures qui apparaissent ;
  - grain qui monte ;
  - pulsation dans les 2 dernières minutes.
- **Son (désactivé par défaut)**, interrupteur haut-parleur sur l'écran :
  - bourdon grave continu, dont le filtre s'ouvre avec la tension ;
  - battement de cœur de 40 → 120 bpm à l'approche de la fin ;
  - tout est synthétisé (Web Audio), sans fichier son.
- Fin : vibration courte (désactivable). Si le timer venait d'une tâche, on propose « Arrivé ✓ » ou « Repousser ↷ ».
- Le timer survit à un rechargement de l'appli.

## Écran Jour (V1)

- Ligne de temps de **24 h**, défilement automatique à l'heure actuelle, heures passées grisées, ligne « maintenant ».
- Les tâches sont des **drapeaux** posés à leur heure d'arrivée, avec « dans 1 h 20 ».
- Choix du jour : aujourd'hui + 6 jours.
- Actions sur une tâche :
  - ✓ Arrivé ;
  - ↷ Repousser (+15 min, +30 min, +1 h, demain, heure au choix) ;
  - ⏱ Lancer le timer ;
  - modifier / supprimer.
- **Repousser est marqué** (↷, ↷2…, avec l'heure prévue au départ) : ce n'est pas un échec, c'est « je continue ».

## Écran Semaine (V1)

- Aujourd'hui + les **6 jours qui viennent**, en agenda : objectifs 🎯 et tâches de chaque jour.
- **Objectifs** avec une date-butoir : carte en haut avec un mini-disque qui se vide (de la création à l'échéance) et « J-3 · 3 j 14 h ».
- Toucher un jour : ouvre le Jour correspondant. « + » sur un jour : objectif à cette date.

## Ce qu'Élan ne fait pas

- Pas de statistiques, pas de séries, pas de score.
- Pas de son ni de notification non sollicités.

## Technique

- HTML / CSS / JavaScript simple, **sans outil de compilation** : on modifie et on publie.
- `localStorage` sur le téléphone. **Export / import** JSON dans les réglages pour sauvegarder.
- Service worker : fonctionne **hors ligne**.
- Chemins relatifs : fonctionne sous `https://<utilisateur>.github.io/<dépôt>/`.
- Limite connue : une appli web ne peut pas notifier de façon fiable quand elle est fermée.

## Plus tard (V2+)

- **Synchro Google Agenda**, avec un interrupteur on/off dans les réglages : tâches et objectifs → événements. Demande un identifiant OAuth Google (gratuit).
- Notifications quand c'est possible.
- Phrases du coach, éventuellement.
- Mémoire légère « objectifs atteints », sans chiffres.

## Installer sur le téléphone

1. Pousser le dossier sur un dépôt GitHub, puis activer **Settings → Pages → branche `main` / racine**.
2. Sur Android, ouvrir l'adresse GitHub Pages dans **Chrome**, puis menu ⋮ → **Ajouter à l'écran d'accueil / Installer l'appli**.
