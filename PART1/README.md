# Messagerie TCP — partie 1 (Node.js)

Serveur et clients de messagerie en ligne de commande, protocole JSON sur TCP. Le protocole est décrit dans `SPEC.md`.

## Installation et lancement

```bash
npm install
npm run server                              # serveur (127.0.0.1:8080)
node src/client/client.js --name alice      # un client (plusieurs terminaux)
npm test                                    # plan d'essais automatisé
```

Variables d'environnement : `HOST`, `PORT` (serveur et client), `DEBUG=msg:*` (traces : `msg:server`, `msg:client`).
Sous PowerShell : `$env:DEBUG="msg:*"`.

## Commandes du client

| Commande | Effet |
|---|---|
| `s;dest;msg` | message privé (le message peut contenir des `;`) |
| `b;msg` | diffusion à tous les autres |
| `ls;` | liste des utilisateurs connectés |
| `q;` | quitter proprement |

## Organisation du code

```
src/common/constants.js   actions, codes d'erreur, limites
src/common/messages.js    construction de tous les messages
src/common/framing.js     un JSON par ligne : encodage et lecteur de lignes
src/server/server.js      serveur TCP (cycle de vie des connexions)
src/server/handlers.js    contrôles + une fonction par action
src/server/registry.js    utilisateurs présentés (nom -> connexion)
src/client/client.js      client (réseau + saisie)
src/client/commands.js    commandes saisies -> requêtes
src/client/display.js     mise en forme (couleurs) des messages reçus
test/protocol.test.js     plan d'essais (22 scénarios)
```

## Choix et observations

- **Déconnexions (TP 08)** : `end` signale que le client a fini d'écrire, `error` une erreur réseau, `close` est émis une seule fois à la toute fin. Le nettoyage est fait sur `close` (et sur `client-quit`), via une fonction idempotente : l'utilisateur n'est retiré et annoncé qu'une fois.
- **Découpage (TP 12)** : TCP est un flux d'octets, pas de messages. Un JSON par ligne, tampon par connexion, limite de 65 536 caractères, décodage UTF-8 par la socket (`setEncoding`).
- **Interface (TP 11)** : couleurs avec `kleur` 4.1.5, choisi car il fonctionne avec `require` (CommonJS, comme le reste du projet), sans dépendance, et se désactive tout seul hors terminal. `chalk` 5 est réservé aux modules ES. Les messages reçus ne cassent plus la ligne en cours de saisie.
