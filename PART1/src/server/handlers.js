// Commandes du serveur : validation d'une ligne reçue, puis une fonction par action.
const debug = require('debug')('msg:server');
const { ACTIONS, ERROR_CODES, LIMITS } = require('../common/constants');
const messages = require('../common/messages');
const { encode } = require('../common/framing');

const CLOSE_GRACE_MS = 1000;

// "conn" représente une connexion : { socket, peer, registry, name, closing }
// name vaut null tant que le client ne s'est pas présenté.

function send(conn, message) {
    if (conn.socket.destroyed || !conn.socket.writable) return;
    conn.socket.write(encode(message));
}

function sendError(conn, code, text) {
    debug('ERROR %s -> %s', code, conn.name || conn.peer);
    send(conn, messages.serverError(code, text));
}

// Envoie à tous les utilisateurs présentés sauf conn ; renvoie le nombre de destinataires
function sendToOthers(conn, message) {
    let count = 0;
    for (const other of conn.registry.all()) {
        if (other !== conn) {
            send(other, message);
            count++;
        }
    }
    return count;
}

// Ferme la connexion après l'envoi des données en attente.
function closeConnection(conn) {
    if (conn.closing) return;
    conn.closing = true;
    conn.socket.end();
    // Si le client ne ferme pas de son côté, on force la fermeture
    setTimeout(() => conn.socket.destroy(), CLOSE_GRACE_MS).unref();
}

// Retire l'utilisateur et prévient les autres. Idempotent : peut être appelé
// depuis "client-quit" puis depuis l'événement "close" sans notifier deux fois.
function leave(conn) {
    const name = conn.name;
    if (name === null) return;
    conn.name = null;
    conn.registry.remove(name, conn);
    sendToOthers(conn, messages.serverUserLeft(name));
    debug('LEFT %s ; connectés : %o', name, conn.registry.names());
}

const isString = (value) => typeof value === 'string';

function handleHello(conn, msg) {
    if (conn.name !== null) {
        return sendError(conn, ERROR_CODES.ALREADY_REGISTERED, 'Déjà présenté sous le nom ' + conn.name);
    }
    const name = msg.sender;
    if (name === undefined || name === null || (isString(name) && name.trim() === '')) {
        sendError(conn, ERROR_CODES.NAME_EMPTY, "Le nom d'utilisateur est vide");
        return closeConnection(conn);
    }
    if (!isString(name) || Array.from(name).length > LIMITS.MAX_NAME_LENGTH || name.includes(';')) {
        sendError(conn, ERROR_CODES.NAME_INVALID,
            "Nom invalide : 1 à " + LIMITS.MAX_NAME_LENGTH + " caractères, sans ';'");
        return closeConnection(conn);
    }
    if (conn.registry.has(name)) {
        sendError(conn, ERROR_CODES.NAME_TAKEN, 'Nom déjà utilisé : ' + name);
        return closeConnection(conn);
    }
    conn.registry.add(name, conn);
    conn.name = name;
    debug('JOINED %s ; connectés : %o', name, conn.registry.names());
    send(conn, messages.serverHello(name, 'Bienvenue ' + name));
    sendToOthers(conn, messages.serverUserJoined(name));
}

function handleSend(conn, msg) {
    if (!isString(msg.dest) || !isString(msg.msg)) {
        return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'client-send exige les champs dest et msg (chaînes)');
    }
    if (msg.dest === conn.name) {
        return sendError(conn, ERROR_CODES.RECIPIENT_IS_SELF, "Impossible de s'envoyer un message à soi-même");
    }
    const target = conn.registry.get(msg.dest);
    if (!target) {
        return sendError(conn, ERROR_CODES.RECIPIENT_NOT_FOUND, 'Destinataire absent : ' + msg.dest);
    }
    // sender vient de la connexion, pas du JSON reçu (déjà vérifié identique)
    send(target, messages.serverSend(conn.name, msg.dest, msg.msg));
    send(conn, messages.serverSendAck(msg.dest));
}

function handleBroadcast(conn, msg) {
    if (!isString(msg.msg)) {
        return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'client-broadcast exige le champ msg (chaîne)');
    }
    const count = sendToOthers(conn, messages.serverBroadcast(conn.name, msg.msg));
    send(conn, messages.serverBroadcastAck(count));
}

function handleListClients(conn) {
    send(conn, messages.serverListClients(conn.registry.names()));
}

function handleQuit(conn) {
    send(conn, messages.serverQuit('Au revoir ' + conn.name));
    leave(conn);
    closeConnection(conn);
}

const handlers = new Map([
    [ACTIONS.CLIENT_HELLO, handleHello],
    [ACTIONS.CLIENT_SEND, handleSend],
    [ACTIONS.CLIENT_BROADCAST, handleBroadcast],
    [ACTIONS.CLIENT_LIST_CLIENTS, handleListClients],
    [ACTIONS.CLIENT_QUIT, handleQuit]
]);

// Traite une ligne complète. Ordre des contrôles :
// JSON -> forme du message -> présentation -> action connue -> identité -> champs.
function handleLine(conn, line) {
    if (conn.closing) return;

    let msg;
    try {
        msg = JSON.parse(line);
    } catch (err) {
        return sendError(conn, ERROR_CODES.INVALID_JSON, "Le message n'est pas du JSON valide");
    }
    if (typeof msg !== 'object' || msg === null || Array.isArray(msg) || !isString(msg.action)) {
        return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Le message doit être un objet JSON avec un champ action (chaîne)');
    }
    debug('DATA from %s: %s', conn.name || conn.peer, line.length > 300 ? line.slice(0, 300) + '…' : line);

    if (conn.name === null && msg.action !== ACTIONS.CLIENT_HELLO) {
        return sendError(conn, ERROR_CODES.NOT_REGISTERED, "Présentez-vous d'abord avec client-hello");
    }
    const handler = handlers.get(msg.action);
    if (!handler) {
        return sendError(conn, ERROR_CODES.UNKNOWN_ACTION, 'Action inconnue : ' + msg.action);
    }
    // Un nom dans le JSON n'est pas une preuve : il doit correspondre à la connexion
    if (msg.action !== ACTIONS.CLIENT_HELLO && msg.sender !== conn.name) {
        return sendError(conn, ERROR_CODES.IDENTITY_MISMATCH, 'sender doit être ' + conn.name);
    }
    handler(conn, msg);
}

function handleTooLarge(conn) {
    sendError(conn, ERROR_CODES.MESSAGE_TOO_LARGE, 'Ligne trop longue (maximum ' + LIMITS.MAX_LINE_LENGTH + ' caractères)');
    closeConnection(conn);
}

module.exports = { handleLine, handleTooLarge, leave };
