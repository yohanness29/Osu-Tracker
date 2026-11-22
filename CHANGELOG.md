# Changelog

Toutes les évolutions d’Osu!tracker, de la plus récente à la plus ancienne.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et les numéros de version suivent le [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

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
