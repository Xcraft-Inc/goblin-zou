# 📘 goblin-zou

## Aperçu

`goblin-zou` fournit des utilitaires pour récupérer des informations relatives au flux de travail « Zou ». Le module expose un acteur **Goblin** singleton (`zou`) dont les quêtes interrogent un dépôt distant, soit via des commandes `git` spécialisées (mode « bash »), soit via l'outil en ligne de commande `zou` (mode « net »). Il permet notamment d'obtenir le SHA d'un dépôt (`shar`), la dernière version (`vlast`) et la table des versions des modules (`vtable`).

## Sommaire

- [Aperçu](#aperçu)
- [Structure du module](#structure-du-module)
- [Fonctionnement global](#fonctionnement-global)
- [Exemples d'utilisation](#exemples-dutilisation)
- [Interactions avec d'autres modules](#interactions-avec-dautres-modules)
- [Configuration avancée](#configuration-avancée)
- [Détails des sources](#détails-des-sources)
- [Licence](#licence)

## Structure du module

Le module est composé des éléments suivants :

- **`zou.js`** : point d'entrée Xcraft qui exporte `xcraftCommands` et charge `lib/service.js`.
- **`lib/service.js`** : acteur Goblin singleton `zou` qui enregistre les quêtes.
- **`lib/index.js`** : utilitaire `ZouUtils` qui gère le répertoire de cache local.
- **`lib/zou.js`** : classe de base `Zou` (lancement de processus, parsing de la table des versions).
- **`lib/zou-bash.js`** : implémentation `ZouBash` s'appuyant sur des commandes `git` spécialisées.
- **`lib/zou-net.js`** : implémentation `ZouNet` s'appuyant sur l'outil `zou`.

## Fonctionnement global

Le module est chargé dynamiquement par [xcraft-core-server] au démarrage grâce à `exports.xcraftCommands` dans `zou.js`. Les quêtes sont alors exposées sur le bus par [xcraft-core-bus].

Chaque quête instancie une classe de traitement (`ZouBash` ou `ZouNet`) qui hérite de `Zou`. Cette dernière :

1. crée un gestionnaire de processus avec [xcraft-core-process] (parser `git`, réponses routées vers `quest.resp`) ;
2. garantit l'existence du répertoire de cache (`<tempRoot>/zou`) ;
3. fournit `cmdProc()` pour lancer un exécutable avec `NO_COLOR=1` ;
4. fournit `parseVtable()` pour convertir la sortie de `vtable` en objet.

Les quêtes suffixées par `_bash` utilisent `git` ; les autres utilisent `zou`.

```text
Appelant ──► quête zou.xxx ──► ZouNet / ZouBash
                                  │
                                  ├─► processus (zou | git) dans <tempRoot>/zou/<nom-du-dépôt>
                                  │
                                  └─► sortie nettoyée / parsée ──► résultat de la quête
```

Le cache d'un dépôt est un sous-dossier de `<tempRoot>/zou` portant le nom de base (`basename`) de l'URL fournie.

## Exemples d'utilisation

L'acteur `zou` est de type **Goblin** : les quêtes sont appelées via le système de quêtes.

### Synchroniser un dépôt et lire la dernière version

```javascript
// Depuis une quête d'un acteur Goblin
const url = 'https://example.com/git/crm.git';
const sku = 'crm';

yield quest.cmd('zou.sync', {url, sku});
const last = yield quest.cmd('zou.vlast', {url, sku});
```

### Lire la table des versions

```javascript
// La table doit être disponible dans le cache (après un `sync`)
const vtable = yield quest.cmd('zou.vtable', {url, tag: 'v1.2.3'});
// vtable['crm-core'] => {Module, Version, Hash, Dev, Prod}
```

### Depuis un acteur Elf

```javascript
const vtable = await this.quest.cmd('zou.vtable', {url, tag: 'v1.2.3'});
```

## Interactions avec d'autres modules

- [xcraft-core-goblin] : enregistrement des quêtes et configuration de l'acteur singleton.
- [xcraft-core-process] : exécution des commandes `git` et `zou`.
- [xcraft-core-etc] : lecture de la configuration `xcraft` pour obtenir `tempRoot`.
- [xcraft-core-server] / [xcraft-core-bus] : chargement des commandes exposées par `zou.js`.

Le module requiert la présence sur la machine de l'exécutable `zou` (mode net) et/ou de `git` avec les sous-commandes spécialisées `cleanex`, `shar`, `vlast` et `vtable` (mode bash).

## Configuration avancée

Ce module ne possède pas de fichier `config.js`.

### Variables d'environnement

| Variable   | Description                                                            | Exemple | Valeur par défaut |
| ---------- | ---------------------------------------------------------------------- | ------- | ----------------- |
| `NO_COLOR` | Définie à `1` dans l'environnement des processus `git` et `zou` lancés | `1`     | `1` (forcée)      |

Les autres variables d'environnement du processus courant sont transmises telles quelles aux processus enfants.

## Détails des sources

### `zou.js`

Point d'entrée Xcraft. Exporte `xcraftCommands()` qui retourne les définitions de commandes de `lib/service.js`. Ce fichier est découvert automatiquement par [xcraft-core-server].

### `lib/service.js`

Acteur **Goblin** singleton nommé `zou` (nom déduit du fichier `zou.js`). Il ne possède ni état ni handlers de logique (`logicState` et `logicHandlers` sont vides). Il est créé immédiatement via `Goblin.createSingle`.

#### Méthodes publiques

Quêtes basées sur `git` :

- **`cleanex_bash(url)`** — Nettoie le dépôt en cache (`git cleanex -a -r -f`). Ne fait rien si le cache n'existe pas.
- **`shar_bash(url, sku, mode)`** — Retourne le SHA calculé par `git shar` pour le dépôt et le `sku` donnés. `mode` est optionnel et transmis sous la forme `--<mode>`.
- **`vlast_bash(url, sku)`** — Si le cache existe, effectue d'abord un `git pull`, puis retourne la dernière version via `git vlast`.
- **`vtable_bash(url, tag)`** — Retourne la table des versions associée au `tag` sous forme d'objet indexé par nom de module.

Quêtes basées sur `zou` :

- **`sync(url, sku)`** — Clone ou synchronise le dépôt dans le cache (`zou clone`) et retourne la sortie nettoyée.
- **`shar(url, sku, mode)`** — Retourne le SHA du dépôt (`--show-shar`).
- **`vlast(url, sku)`** — Retourne la dernière version (`--show-vlast`).
- **`vtable(url, tag)`** — Retourne la table des versions au format JSON parsée, indexée par module.

### `lib/index.js`

Expose un singleton `ZouUtils`. Il lit la configuration `xcraft` via [xcraft-core-etc] pour construire le chemin du cache.

- **`getCache(url)`** — Retourne le répertoire de cache racine, ou, si `url` est fourni, le sous-dossier correspondant au `basename` de l'URL.

### `lib/zou.js`

Classe de base `Zou`.

- **`Zou.cmdProc(cmd, xProcess)`** — Retourne une fonction (gigawatts) qui lance `cmd` avec les arguments, le répertoire de travail (`cwd`) et le callback `stdout` fournis, avec `NO_COLOR=1`.
- **`getCache(url)`** — Délègue à `ZouUtils`.
- **`parseVtable(vtable)`** — Détecte le format de la sortie : tableau Markdown (commence par `|`) ou JSON (commence par `[`). Retourne un objet `{[module]: {Module, Version, Hash, Dev, Prod}}`. Lève l'erreur `unsupported vtable format` pour tout autre format.

### `lib/zou-bash.js`

Classe `ZouBash` (hérite de `Zou`). Elle utilise `git` avec les options `-v`, `--wrk=<cache>`, `--url=<url>` et `--sku=<sku>`.

- **`cleanex(url)`**, **`pull(cache)`**, **`shar(url, sku, mode)`**, **`vlast(url, sku)`**, **`vtable(url, tag)`** — Pendants des quêtes `_bash`. `shar` ajoute l'option `-a=256`. `vtable` s'exécute dans le cache, qui doit donc déjà exister.

### `lib/zou-net.js`

Classe `ZouNet` (hérite de `Zou`). Elle utilise l'exécutable `zou` et nettoie la sortie (suppression des séquences ANSI via `ansi-regex`, des espaces et des sauts de ligne en début/fin).

- **`sync(url, sku)`**, **`shar(url, sku, mode)`**, **`vlast(url, sku)`**, **`vtable(url, tag)`** — Pendants des quêtes du même nom. `vtable` exécute `zou vtable show -t:json -0 <tag>` dans le cache, qui doit donc avoir été préparé par `sync`.
- **`pull()`** — Sans effet (le clonage gère déjà la mise à jour).

## Licence

Ce module est distribué sous [licence MIT](./LICENSE).

_Ce contenu a été généré par IA_

---

[xcraft-core-goblin]: https://github.com/Xcraft-Inc/xcraft-core-goblin
[xcraft-core-process]: https://github.com/Xcraft-Inc/xcraft-core-process
[xcraft-core-etc]: https://github.com/Xcraft-Inc/xcraft-core-etc
[xcraft-core-server]: https://github.com/Xcraft-Inc/xcraft-core-server
[xcraft-core-bus]: https://github.com/Xcraft-Inc/xcraft-core-bus
