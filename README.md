# Osu!tracker (O!tr)

Une application de bureau qui suit tes sessions osu!, analyse ton jeu et te suggère des maps à ton niveau.

Elle lit la partie en cours grâce à [tosu](https://github.com/tosuapp/tosu), qu'elle télécharge et lance toute seule, et enregistre chaque partie dans une base locale. Ton compte osu! sert à connaître tes top plays et à chercher des maps.

> L'application est en français. Elle fonctionne sous Linux et sous Windows.

## Fonctionnalités

- **En direct** : la map en cours, le pp en temps réel, le pp si FC et le résultat de chaque partie.
- **Historique** : tes sessions par jour ou dans un calendrier, chaque partie avec sa précision, ses misses, son UR et son timing. Une session se renomme, et s'exporte en JSON d'un clic droit.
- **Maps** : toutes les maps jouées, avec une recherche, des filtres (style, résultat, mods, étoiles) et un tri.
- **Analyse** : tes points faibles par style, étoiles, AR, durée, mods et BPM, comparés à ce que ta difficulté habituelle laisserait attendre. Ta fatigue au fil d'une session et ta progression.
- **Styles de maps** : chaque map est classée (Stream, Aim, Speed…) avec des tags (Deathstream, Bursts, Gros jumps, Rythme 1/3 – 1/6…), calculés à partir de son fichier.
- **Suggestions** : des maps à ton rang, filtrées comme tu veux (étoiles, AR, OD, CS, HP, BPM, durée, style, mods), avec le gain réel en pp qu'elles apporteraient à ton profil. Les maps que tu joues y sont ajoutées automatiquement, et tu peux en importer une par son identifiant.
- **Playlists** : regroupe des maps comme tu veux, d'un clic droit sur n'importe quelle map de l'application.
- **Profil** : tes top plays, avec les étoiles réelles de chaque score selon ses mods.
- **Tournois** : prépare un tournoi, quel que soit le mode. Chaque tournoi est un suivi, créé d'un bouton, et la liste montre ton placement dans chacun (DNQ, En lice, 16-9, 2, 1…).
  - **Configuration** : le format et les bans de chaque round, le nombre de qualifiés, le loser bracket, ton prochain match, et les joueurs encore en lice. Ils viennent du bracket Challonge quand il est lié, et se corrigent à la main, pour un forfait par exemple.
  - **Pools** : importe les pools, round par round. Chaque map est classée prête, fragile, à travailler ou pas encore jouée, d'après tes parties dessus.
  - **Scouting** : compare-toi à n'importe quel joueur du tournoi, mod par mod et map par map, à partir des matchs importés. Les seeds sont calculés à partir des qualifs.
  - **Stratégie** : le pool en un coup d'œil face à ton prochain adversaire, puis tes bans, tes picks et les siens.
  - **Résultats** : importe les matchs depuis leur lien osu!. Ils sont rangés par round, du plus récent au plus ancien, et filtrables par joueur.
  - **Bracket** : le bracket Challonge du tournoi, aux couleurs de l'application, ton pseudo mis en avant.
- **Paramètres** : ton compte osu!, l'état de tosu, le thème clair ou sombre, le dossier des données et les mises à jour. On y accède d'un clic sur ta carte de profil, en bas de la barre de navigation, qui se replie.

Les modes osu!, taiko, catch et mania sont suivis. Les styles de maps et les suggestions concernent surtout osu! standard.

D'un clic droit sur n'importe quelle map de l'application, tu peux l'ouvrir, copier son ID, la télécharger avec osu!direct ou l'ajouter à une playlist.

## Installation

Télécharge la dernière version dans les [releases](../../releases) :

- **Linux** :
  - `osu-tracker-<version>.x86_64.rpm` pour Fedora ou Nobara, et `osu-tracker_<version>_amd64.deb` pour Ubuntu, Mint ou Debian. Ils s'installent d'un double clic.
  - `osu-tracker-<version>.AppImage` pour toutes les distributions. Il faut le rendre exécutable, puis le lancer :
    ```bash
    chmod +x osu-tracker-*.AppImage
    ./osu-tracker-*.AppImage
    ```
- **Windows** : `osu-tracker-<version>-setup.exe`. L'installateur n'est pas signé : Windows affiche un avertissement SmartScreen, à passer avec « Informations complémentaires » puis « Exécuter quand même ».

### Versions stables et bêtas

- Les **versions stables** (`1.1.0`) sont celles à installer par défaut. Le lien des [releases](../../releases/latest) mène à la dernière.
- Les **versions bêta** (`1.1.0-beta.2`) apportent les nouveautés plus tôt, mais elles peuvent avoir des bugs. Sur GitHub, elles sont marquées **Pre-release**.

L'application se met à jour toute seule. Par défaut, elle ne propose que les versions stables. Pour recevoir aussi les bêtas, active **Paramètres → Données → Recevoir les versions bêta**. Si tu désactives l'option pendant que tu es sur une bêta, l'application ne revient pas en arrière : tu gardes ta bêta jusqu'à la prochaine version stable.

La mise à jour automatique fonctionne avec toutes les versions : l'installateur Windows, l'AppImage, le `.rpm` et le `.deb`. Avec le `.rpm` et le `.deb`, le système demande ton mot de passe administrateur au moment d'installer, car l'application passe par `dnf` ou `apt`. En revanche, `sudo dnf update` et `sudo apt upgrade` ne voient pas les mises à jour d'Osu!tracker : le paquet ne vient pas d'un dépôt.

Au premier lancement, l'application télécharge tosu depuis ses releases officielles et le démarre. Si tu lances déjà tosu de ton côté, elle utilise le tien.

## Connecter ton compte osu!

Le suivi des parties fonctionne sans compte. Le profil, le gain réel en pp et les suggestions demandent de relier ton compte osu!, avec ta propre application OAuth :

1. Va dans les [paramètres de ton compte osu!](https://osu.ppy.sh/home/account/edit#oauth), section **OAuth**, puis **Nouvelle application OAuth**.
2. Donne-lui un nom (par exemple « Osu!tracker ») et cette **URL de rappel** :
   ```
   http://127.0.0.1:7270/callback
   ```
3. Copie le **Client ID** et le **Client Secret** dans la page **Profil** de l'application, puis connecte-toi. Tu peux ensuite te déconnecter ou retirer l'application osu! depuis les **Paramètres**.

L'application ne demande que les droits de lecture (`public` et `identify`). L'identifiant, le secret et la connexion restent sur ta machine, chiffrés par le trousseau du système.

## Tes données

Tout reste sur ta machine, dans le dossier de données de l'application :

- **Linux** : `~/.config/osu-tracker/`
- **Windows** : `%APPDATA%\osu-tracker\`

On y trouve la base `osu-tracker.sqlite` (sessions, parties, playlists, tournois, catalogue des suggestions), le fichier chiffré du compte et le réglage des mises à jour. Le bouton **Ouvrir** des Paramètres ouvre ce dossier. Pour sauvegarder tes données ou les copier sur une autre machine, copie ce dossier, application fermée.

## Développement

Il faut [Node.js](https://nodejs.org) 22 et [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm app          # lance l'application en mode développement (Linux)
pnpm dev          # même chose, sous Windows
pnpm test         # tests
pnpm typecheck    # vérification des types
pnpm --filter desktop lint
```

`pnpm app` retire la variable `ELECTRON_RUN_AS_NODE`, définie par le terminal de VS Code et qui empêcherait Electron de s'ouvrir.

### Construire les installateurs

```bash
pnpm --filter desktop build:linux   # AppImage, .rpm et .deb
pnpm --filter desktop build:win     # installateur Windows, aussi depuis Linux avec Wine
```

Les fichiers sont créés dans le dossier `build/` à la racine, avec les fichiers `latest.yml` et `latest-linux.yml` qui servent aux mises à jour.

Sous Fedora et Nobara, construire le `.rpm` et le `.deb` demande le paquet `libxcrypt-compat`.

### Branches et versions

| Branche | Contenu |
|---|---|
| `main` | Uniquement ce qui est publié en version stable. On n'y commite jamais directement. |
| `dev` | La branche de travail : les nouvelles fonctionnalités y arrivent, et les bêtas en sont publiées. |
| `feat/…` | Facultative, pour une grosse fonctionnalité : créée depuis `dev`, puis fusionnée dans `dev`. |
| `fix/…` | Pour un correctif urgent sur la version stable : créée depuis `main`, fusionnée dans `main` puis dans `dev`. |

Les numéros de version suivent le [versionnage sémantique](https://semver.org/lang/fr/) : `1.1.0` pour une version stable, `1.1.0-beta.1`, `1.1.0-beta.2`… pour ses bêtas. Une bêta est toujours considérée comme plus ancienne que la version stable du même numéro, qui la remplace.

Chaque changement visible est noté dans le [CHANGELOG](CHANGELOG.md), sous **Non publié**. À la publication, cette section prend le numéro de la version et sa date, et sert de notes à la release.

#### Publier une bêta

Depuis `dev` :

1. Passer la version à `1.1.0-beta.N` dans `apps/desktop/package.json`, puis dater la section du changelog.
2. Commiter et pousser `dev`.
3. Vider `build/`, puis construire les installateurs (Linux et Windows).
4. Publier en **pre-release**, avec le tag créé sur `dev` :
   ```bash
   gh release create v1.1.0-beta.N --prerelease --target dev \
     --title 'Osu!tracker 1.1.0-beta.N' --notes-file notes.md \
     build/osu-tracker-1.1.0-beta.N-setup.exe build/osu-tracker-1.1.0-beta.N-setup.exe.blockmap \
     build/osu-tracker-1.1.0-beta.N.AppImage build/osu-tracker-1.1.0-beta.N.x86_64.rpm \
     build/osu-tracker_1.1.0-beta.N_amd64.deb build/latest.yml build/latest-linux.yml
   ```

#### Publier une version stable

1. Fusionner `dev` dans `main` :
   ```bash
   git switch main
   git merge dev
   ```
2. Passer la version à `1.1.0`, regrouper les sections des bêtas du changelog dans `[1.1.0]`, puis commiter et pousser `main`.
3. Vider `build/`, puis construire les installateurs.
4. Publier, sans `--prerelease` ni `--target`, avec les mêmes fichiers.
5. Revenir sur `dev` et y fusionner `main`, pour que les deux branches repartent du même point.

Quelques points à ne pas oublier :

- Les fichiers `latest.yml` et `latest-linux.yml` doivent toujours être joints à la release, bêta comprise. Sans eux, l'application installée ne voit pas la mise à jour.
- Le titre et les messages qui contiennent un `!` (« Osu!tracker », « osu!direct ») se mettent entre guillemets simples : entre guillemets doubles, bash interprète le `!`.

### Organisation

Un monorepo pnpm : l'application Electron dans `apps/desktop`, et la logique dans des paquets indépendants, testés sans Electron.

| Paquet | Rôle |
|---|---|
| `packages/shared` | Types des données de tosu et des événements de partie |
| `packages/collector` | Client WebSocket de tosu |
| `packages/tracker` | Détection des parties et des sessions à partir du flux de tosu |
| `packages/storage` | Base SQLite (better-sqlite3 et Drizzle), migrations et requêtes |
| `packages/pp` | pp max, analyse par mods et styles de maps, avec le calculateur utilisé par tosu |
| `packages/stats` | Fatigue, objectifs, progression, points faibles, gain réel en pp, seeds et classement des tournois |
| `packages/osu-api` | Client de l'API osu! v2 |
| `packages/recommender` | Niveau du joueur, classement des suggestions et préparation des matchs de tournoi |
| `apps/desktop` | Application Electron, React et Tailwind |

Après une modification du schéma de la base (`packages/storage/src/schema.ts`), `pnpm db:generate` écrit la migration correspondante.

## Feuille de route

- Signer l'installateur Windows, pour éviter l'avertissement SmartScreen.
- Sauvegarde dans le cloud, pour retrouver ses données sur plusieurs machines.

## Remerciements

- [tosu](https://github.com/tosuapp/tosu) (LGPL-3.0), qui lit les données d'osu! ; l'application télécharge ses releases officielles sans les modifier.
- Le calculateur de pp de tosu, [`@tosuapp/lazer-calculator-prebuilt`](https://www.npmjs.com/package/@tosuapp/lazer-calculator-prebuilt).
- L'[API osu! v2](https://osu.ppy.sh/docs/).

Osu!tracker est un projet indépendant, sans lien avec ppy ni avec osu!.
