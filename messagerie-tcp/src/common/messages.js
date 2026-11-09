// Construction des messages du protocole. Chaque fonction renvoie un objet
// JavaScript prêt à être sérialisé ; aucune chaîne d'action n'est écrite en dur ailleurs.
const { ACTIONS } = require('./constants');

// --- Client -> serveur ---
const clientHello = (sender) => ({ sender, action: ACTIONS.CLIENT_HELLO });
const clientSend = (sender, dest, msg) => ({ sender, dest, msg, action: ACTIONS.CLIENT_SEND });
const clientBroadcast = (sender, msg) => ({ sender, msg, action: ACTIONS.CLIENT_BROADCAST });
const clientListClients = (sender) => ({ sender, action: ACTIONS.CLIENT_LIST_CLIENTS });
const clientQuit = (sender) => ({ sender, action: ACTIONS.CLIENT_QUIT });

// --- Serveur -> client ---
const serverHello = (sender, msg) => ({ sender, action: ACTIONS.SERVER_HELLO, msg });
const serverSend = (sender, dest, msg) => ({ sender, dest, msg, action: ACTIONS.SERVER_SEND });
const serverSendAck = (dest) => ({ dest, action: ACTIONS.SERVER_SEND_ACK });
const serverBroadcast = (sender, msg) => ({ sender, msg, action: ACTIONS.SERVER_BROADCAST });
const serverBroadcastAck = (count) => ({ count, action: ACTIONS.SERVER_BROADCAST_ACK });
const serverListClients = (clients) => ({ clients, action: ACTIONS.SERVER_LIST_CLIENTS });
const serverQuit = (msg) => ({ msg, action: ACTIONS.SERVER_QUIT });
const serverUserJoined = (user) => ({ user, action: ACTIONS.SERVER_USER_JOINED });
const serverUserLeft = (user) => ({ user, action: ACTIONS.SERVER_USER_LEFT });
const serverError = (code, msg) => ({ action: ACTIONS.SERVER_ERROR, code, msg });

module.exports = {
    clientHello, clientSend, clientBroadcast, clientListClients, clientQuit,
    serverHello, serverSend, serverSendAck, serverBroadcast, serverBroadcastAck,
    serverListClients, serverQuit, serverUserJoined, serverUserLeft, serverError
};
