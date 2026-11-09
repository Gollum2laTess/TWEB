// Constantes partagées par le client et le serveur : une seule définition
// de chaque action, de chaque code d'erreur et de chaque limite.

const ACTIONS = Object.freeze({
    // Requêtes client -> serveur
    CLIENT_HELLO: 'client-hello',
    CLIENT_SEND: 'client-send',
    CLIENT_BROADCAST: 'client-broadcast',
    CLIENT_LIST_CLIENTS: 'client-list-clients',
    CLIENT_QUIT: 'client-quit',
    // Réponses serveur -> demandeur
    SERVER_HELLO: 'server-hello',
    SERVER_SEND_ACK: 'server-send-ack',
    SERVER_BROADCAST_ACK: 'server-broadcast-ack',
    SERVER_LIST_CLIENTS: 'server-list-clients',
    SERVER_QUIT: 'server-quit',
    SERVER_ERROR: 'server-error',
    // Événements serveur -> autres utilisateurs
    SERVER_SEND: 'server-send',
    SERVER_BROADCAST: 'server-broadcast',
    SERVER_USER_JOINED: 'server-user-joined',
    SERVER_USER_LEFT: 'server-user-left'
});

const ERROR_CODES = Object.freeze({
    NAME_EMPTY: 'name-empty',
    NAME_INVALID: 'name-invalid',
    NAME_TAKEN: 'name-taken',
    NOT_REGISTERED: 'not-registered',
    ALREADY_REGISTERED: 'already-registered',
    IDENTITY_MISMATCH: 'identity-mismatch',
    INVALID_JSON: 'invalid-json',
    INVALID_MESSAGE: 'invalid-message',
    UNKNOWN_ACTION: 'unknown-action',
    RECIPIENT_NOT_FOUND: 'recipient-not-found',
    RECIPIENT_IS_SELF: 'recipient-is-self',
    MESSAGE_TOO_LARGE: 'message-too-large'
});

const LIMITS = Object.freeze({
    MAX_LINE_LENGTH: 65536,          // caractères par ligne (charte d'interopérabilité)
    MAX_NAME_LENGTH: 20,             // caractères par nom d'utilisateur
    CLIENT_MAX_LINE_LENGTH: 1048576  // tolérance côté client pour les lignes reçues
});

module.exports = { ACTIONS, ERROR_CODES, LIMITS };
