# Spécification du protocole — Messagerie TCP, partie 1

Conforme à la charte d'interopérabilité (équipe mak-kr/messagerie-tcp). Seule la partie 1 est implémentée.

## 1. Transport et découpage

- TCP, texte UTF-8. **Un objet JSON par ligne**, terminé par `\n` (`\r\n` accepté en réception ; on émet `\n`).
- Une ligne fait **65 536 caractères au maximum** (hors fin de ligne). Au-delà : erreur `message-too-large`, puis fermeture de la connexion. Un flux sans fin de ligne qui dépasse la limite est traité de la même façon (mémoire bornée).
- Le récepteur accumule les données reçues et ne traite que les lignes complètes : un message coupé en plusieurs morceaux est reconstitué, plusieurs messages dans un même envoi sont traités dans l'ordre. Un caractère UTF-8 coupé entre deux morceaux est reconstitué.
- Les lignes vides sont ignorées. Les champs inconnus sont ignorés.

## 2. Identité

- Le client envoie `client-hello` avec `sender` = son nom. Le serveur associe ce nom à la **connexion** (socket).
- Toute requête suivante doit porter `sender` = ce nom, sinon `identity-mismatch` (sans effet). L'identité réelle est celle de la connexion ; `sender` dans les messages transmis aux autres est toujours celui de la connexion.
- Règles du nom : 1 à 20 caractères (un émoji compte pour 1), sans `;`, unique (sensible à la casse). Un nom uniquement composé d'espaces est vide.

## 3. Requêtes (client → serveur) et réponses

| Requête (champs) | Réponse au demandeur | Reçu par les autres |
|---|---|---|
| `client-hello` (`sender`) | `server-hello` (`sender`, `msg`) | `server-user-joined` (`user`) |
| `client-send` (`sender`, `dest`, `msg`) | `server-send-ack` (`dest`) | `server-send` (`sender`, `dest`, `msg`), au destinataire seulement |
| `client-broadcast` (`sender`, `msg`) | `server-broadcast-ack` (`count`) | `server-broadcast` (`sender`, `msg`), à tous sauf l'expéditeur |
| `client-list-clients` (`sender`) | `server-list-clients` (`clients`) | — |
| `client-quit` (`sender`) | `server-quit` (`msg`), puis fermeture | `server-user-left` (`user`) |

- Types : tous les champs sont des chaînes, sauf `count` (nombre : autres utilisateurs atteints) et `clients` (tableau de chaînes : noms dans l'ordre d'arrivée, demandeur compris).
- Une déconnexion inattendue (Ctrl+C, coupure réseau) produit `server-user-left` **une seule fois**, comme `client-quit`.
- Une connexion non présentée ne reçoit aucune diffusion ni événement et n'apparaît pas dans `clients`. Son départ ne produit pas de `server-user-left`.
- `msg` peut être une chaîne vide ; il doit seulement être une chaîne.

## 4. Erreurs

Format : `{"action":"server-error","code":"...","msg":"..."}` (`msg` libre, `code` normatif).

| Code | Cause | Connexion |
|---|---|---|
| `name-empty` | nom absent, vide ou fait d'espaces (à `client-hello`) | fermée |
| `name-invalid` | plus de 20 caractères, contient `;`, ou n'est pas une chaîne | fermée |
| `name-taken` | nom déjà utilisé | fermée |
| `message-too-large` | ligne de plus de 65 536 caractères | fermée |
| `not-registered` | requête (autre que `client-hello`) avant présentation | ouverte |
| `already-registered` | second `client-hello` | ouverte |
| `identity-mismatch` | `sender` absent ou différent du nom présenté | ouverte |
| `invalid-json` | la ligne n'est pas du JSON | ouverte |
| `invalid-message` | pas un objet, `action` absente ou non textuelle, champ requis manquant ou non textuel | ouverte |
| `unknown-action` | `action` inconnue | ouverte |
| `recipient-not-found` | `dest` n'est pas connecté | ouverte |
| `recipient-is-self` | `dest` est le demandeur | ouverte |

## 5. Ordre des contrôles du serveur

1. JSON valide (`invalid-json`) ; objet avec `action` textuelle (`invalid-message`).
2. Connexion non présentée et action ≠ `client-hello` → `not-registered`.
3. Action inconnue → `unknown-action`.
4. Action ≠ `client-hello` et `sender` ≠ nom présenté → `identity-mismatch`.
5. Contrôles propres à l'action (champs, destinataire…).

`client-hello` échappe au contrôle 4 : un second `client-hello` donne `already-registered` quel que soit son `sender`.

## 6. Cycle de vie d'une connexion

Connectée → (présentée par `client-hello`) → fermée par `client-quit`, erreur fatale, ou départ du client. Le nettoyage (retrait de la liste + `server-user-left`) est fait une seule fois, à la première des deux occasions : `client-quit` ou événement `close` de la socket.

## 7. Points non précisés par la charte, choix retenus

Lignes vides ignorées ; noms sensibles à la casse ; `msg` vide accepté ; `sender` absent dans `client-hello` → `name-empty`, `sender` non textuel → `name-invalid` ; `not-registered` prioritaire sur `unknown-action` pour une connexion non présentée ; l'expéditeur d'une diffusion ne reçoit que l'accusé.
