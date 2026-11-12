# Osu!tracker (O!tr)

Une application de bureau qui suit tes sessions osu!, analyse ton jeu et te suggère des maps à ton niveau.

Elle lit la partie en cours grâce à [tosu](https://github.com/tosuapp/tosu), qu'elle télécharge et lance toute seule, et enregistre chaque partie dans une base locale. Ton compte osu! sert à connaître tes top plays et à chercher des maps.

> L'application est en français. Elle est testée sur Linux ; la version Windows se construit et s'installe, mais elle n'a pas encore été testée.

## Fonctionnalités

- **En direct** : la map en cours, le pp en temps réel, le pp si FC et le résultat de chaque partie.
- **Historique** : tes sessions par jour ou dans un calendrier, chaque partie avec sa précision, ses misses, son UR et son timing. Une session se renomme, et s'exporte en JSON d'un clic droit.
- **Maps** : toutes les maps jouées, avec une recherche, des filtres (style, résultat, mods, étoiles) et un tri.
- **Analyse** : tes points faibles par style, étoiles, AR, durée, mods et BPM, comparés à ce que ta difficulté habituelle laisserait attendre. Ta fatigue au fil d'une session et ta progression.
- **Styles de maps** : chaque map est classée (Stream, Aim, Speed…) avec des tags (Deathstream, Bursts, Gros jumps, Rythme 1/3 – 1/6…), calculés à partir de son fichier.
- **Suggestions** : des maps à ton rang, filtrées comme tu veux (étoiles, AR, OD, CS, HP, BPM, durée, style, mods), avec le gain réel en pp qu'elles apporteraient à ton profil. Les maps que tu joues y sont ajoutées automatiquement, et tu peux en importer une par son identifiant.
- **Playlists** : regroupe des maps comme tu veux, d'un clic droit sur n'importe quelle map de l'application.
- **Profil** : tes top plays, avec les étoiles réelles de chaque score selon ses mods.

Les modes osu!, taiko, catch et mania sont suivis. Les styles de maps et les suggestions concernent surtout osu! standard.

## Installation

Télécharge la dernière version dans les [releases](../../releases) :

- **Linux** : `osu-tracker-<version>.AppImage`, à rendre exécutable puis à lancer :
  ```bash
  chmod +x osu-tracker-*.AppImage
  ./osu-tracker-*.AppImage
  ```
- **Windows** : `osu-tracker-<version>-setup.exe`. L'installateur n'est pas signé : Windows affiche un avertissement SmartScreen, à passer avec « Informations complémentaires » puis « Exécuter quand même ».

Au premier lancement, l'application télécharge tosu depuis ses releases officielles et le démarre. Si tu lances déjà tosu de ton côté, elle utilise le tien.

## Connecter ton compte osu!

Le suivi des parties fonctionne sans compte. Le profil, le gain réel en pp et les suggestions demandent de relier ton compte osu!, avec ta propre application OAuth :

1. Va dans les [paramètres de ton compte osu!](https://osu.ppy.sh/home/account/edit#oauth), section **OAuth**, puis **Nouvelle application OAuth**.
2. Donne-lui un nom (par exemple « Osu!tracker ») et cette **URL de rappel** :
   ```
   http://127.0.0.1:7270/callback
   ```
3. Copie le **Client ID** et le **Client Secret** dans la page **Profil** de l'application, puis connecte-toi.

L'application ne demande que les droits de lecture (`public` et `identify`). L'identifiant, le secret et la connexion restent sur ta machine, chiffrés par le trousseau du système.

## Tes données

Tout reste sur ta machine, dans le dossier de données de l'application :

- **Linux** : `~/.config/osu-tracker/`
- **Windows** : `%APPDATA%\osu-tracker\`

On y trouve la base `osu-tracker.sqlite` (sessions, parties, playlists, catalogue des suggestions) et le fichier chiffré du compte. Pour sauvegarder tes données ou les copier sur une autre machine, copie ce dossier, application fermée.

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
pnpm --filter desktop build:linux   # AppImage
pnpm --filter desktop build:win     # installateur Windows, aussi depuis Linux avec Wine
```

Les fichiers sont créés dans le dossier `build/` à la racine.

### Organisation

Un monorepo pnpm : l'application Electron dans `apps/desktop`, et la logique dans des paquets indépendants, testés sans Electron.

| Paquet | Rôle |
|---|---|
| `packages/shared` | Types des données de tosu et des événements de partie |
| `packages/collector` | Client WebSocket de tosu |
| `packages/tracker` | Détection des parties et des sessions à partir du flux de tosu |
| `packages/storage` | Base SQLite (better-sqlite3 et Drizzle), migrations et requêtes |
| `packages/pp` | pp max, analyse par mods et styles de maps, avec le calculateur utilisé par tosu |
| `packages/stats` | Fatigue, objectifs, progression, points faibles, gain réel en pp |
| `packages/osu-api` | Client de l'API osu! v2 |
| `packages/recommender` | Niveau du joueur et classement des suggestions |
| `apps/desktop` | Application Electron, React et Tailwind |

Après une modification du schéma de la base (`packages/storage/src/schema.ts`), `pnpm db:generate` écrit la migration correspondante.

## Feuille de route

- Tester et valider la version Windows.
- Sauvegarde dans le cloud, pour retrouver ses données sur plusieurs machines.

## Remerciements

- [tosu](https://github.com/tosuapp/tosu) (LGPL-3.0), qui lit les données d'osu! ; l'application télécharge ses releases officielles sans les modifier.
- Le calculateur de pp de tosu, [`@tosuapp/lazer-calculator-prebuilt`](https://www.npmjs.com/package/@tosuapp/lazer-calculator-prebuilt).
- L'[API osu! v2](https://osu.ppy.sh/docs/).

Osu!tracker est un projet indépendant, sans lien avec ppy ni avec osu!.
