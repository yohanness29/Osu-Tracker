# Changelog

Toutes les évolutions d’Osu!tracker, de la plus récente à la plus ancienne.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et les numéros de version suivent le [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

## [1.1.0-beta.3] - 2026-11-25

### Ajouté
- Tournois → Configuration → **Joueurs** : la liste des joueurs, en lice ou éliminés, d’où on peut corriger un statut à la main (un forfait, un tournoi sans Challonge). Un choix à la main passe avant le bracket et les matchs importés, et s’oublie d’un clic.
- Tournois : avec un bracket Challonge lié, les joueurs encore en lice (et ton placement) viennent du bracket lui-même : les forfaits et les matchs pas importés sont pris en compte. Le bouton Actualiser de l’onglet Bracket met tout à jour.
- Tournois : une recherche dans la liste des tournois, et ton placement à côté de chacun : DNQ, En lice, 32-17, 16-9, 8-5, 4-3, 2 ou 1.
- Tournois : un onglet **Bracket** affiche le bracket Challonge du tournoi aux couleurs de l’app, ton pseudo mis en avant. On s’y déplace en cliquant et en faisant glisser. Le lien se colle une fois dans la Configuration.
- Paramètres → Interface : un thème clair, en plus du thème sombre. « Système » suit le thème de ton ordinateur.
- Tournois : le format des matchs et le nombre de bans se règlent round par round (par exemple FT5 jusqu’au RO16, puis FT6 en quarts de finale). Un nouveau pool reprend le format et les bans du round précédent, et les réglages déjà faits pour le tournoi sont recopiés sur ses rounds.

### Modifié
- Le contour qui montre l’élément sélectionné au clavier prend la couleur de l’app, au lieu de celle du système.
- Tournois : la création d’un tournoi se fait dans une fenêtre à part, ouverte par le bouton « Créer un suivi de tournoi ».
- Les derniers menus déroulants du système (format des rounds, type d’objectif) prennent le style de l’app, comme tous les autres.
- Tournois : la page est réorganisée en six onglets, avec moins d’informations affichées à la fois.
  - **Configuration** : le format et les bans de chaque round, le nombre de qualifiés, le loser bracket, le prochain match (pool et adversaire) et la suppression du tournoi, réunis au même endroit.
  - **Pools** : chaque map montre seulement son état et ton meilleur score. Le détail apparaît au survol.
  - **Scouting** : n’importe quel joueur se compare à toi sans devenir ton prochain adversaire, et le meilleur des deux est en gras. La dernière colonne montre l’écart de score entre vous (−19 %, +3 %…).
  - **Stratégie** : le résumé du prochain match, puis le pool en un coup d’œil (chaque map marquée avantage, équilibré ou désavantage face à l’adversaire), puis tes bans, tes picks et ses picks probables avec vos chiffres côte à côte.
  - **Résultats** : les matchs importés, avec l’import et le filtre par joueur sur une seule ligne.
  - **Bracket** : le bracket Challonge du tournoi (voir plus haut).

### Supprimé
- Tournois : les conseils d’échauffement de l’onglet Stratégie.

## [1.1.0-beta.2] - 2026-11-22

### Modifié
- Paramètres : les versions bêta s’activent avec un interrupteur, au lieu d’une case à cocher.

## [1.1.0-beta.1] - 2026-11-22

### Ajouté
- Paramètres → Données : la case « Recevoir les versions bêta », pour avoir les nouveautés avant leur sortie en version stable. Quand tu es sur une bêta, un badge « Bêta » l’indique à côté de la version.
- Clic droit sur une map, partout dans l’app : « Télécharger avec osu!direct ». Sans compte supporter, la page de la map s’ouvre sur le site osu!.
- Tournois, onglet Pools : un bouton pour copier l’ID de chaque map.

### Modifié
- Tournois, onglet Préparation : le format du match se choisit dans une liste (Best of 9 · premier à 5 (FT5)…), au lieu d’un nombre à saisir.

## [1.0.1] - 2026-11-15

### Corrigé
- Connexion au compte osu! :
  - cliquer plusieurs fois sur « Se connecter » ne bloque plus la connexion ;
  - elle fonctionne maintenant quand le pare-feu demande une autorisation.
- Un message clair s’affiche quand le site osu! bloque l’accès à son API, au lieu d’une erreur 403.

## [1.0.0] - 2026-11-14

Première version publique.

### Ajouté
- Suivi en direct des parties et des sessions avec tosu, qui s’installe et démarre tout seul.
- Historique des parties, liste des maps jouées et fiche de chaque map.
- Analyse : pp, fatigue, objectifs, progression, et points faibles par mods et par style de map.
- Suggestions de maps à farmer selon ton niveau, et playlists.
- Connexion au compte osu! et page de profil.
- Mode tournoi :
  - import des pools et des matchs ;
  - matchs rangés par round ;
  - seeds calculés à partir des qualifs ;
  - joueurs encore en lice, avec loser bracket ;
  - préparation de chaque map et comparaison avec un adversaire.
- Paramètres, barre de navigation repliable et mises à jour automatiques depuis GitHub.
- Installateurs pour Windows (.exe) et pour Linux (AppImage, .rpm et .deb).
