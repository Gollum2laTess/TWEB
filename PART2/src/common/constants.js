// Constantes partagées par le client et le serveur : une seule définition
// de chaque action, de chaque code d'erreur et de chaque limite.

const ACTIONS = Object.freeze({
    // --- PARTIE 1 ---
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
    SERVER_USER_LEFT: 'server-user-left',

    // --- PARTIE 2 ---
    // Requêtes client -> serveur (Groupes)
    CLIENT_CGROUPE: 'cgroupe',
    CLIENT_JOIN: 'join',
    CLIENT_GBROADCAST: 'gbroadcast',
    CLIENT_MEMBERS: 'members',
    CLIENT_MSGS: 'msgs',
    CLIENT_GROUPS: 'groups',
    CLIENT_LEAVE: 'leave',
    CLIENT_INVITE: 'invite',
    CLIENT_KICK: 'kick',
    CLIENT_BAN: 'ban',
    CLIENT_UNBAN: 'unban',
    CLIENT_STATES: 'states',
    
    // Réponses serveur -> demandeur (Groupes)
    SERVER_CGROUPE: 'server-cgroupe',
    SERVER_JOIN: 'server-join',
    SERVER_LEAVE: 'server-leave',
    SERVER_MEMBERS: 'server-members',
    SERVER_GROUPS: 'server-groups',
    SERVER_GBROADCAST: 'server-gbroadcast',
    SERVER_MSGS: 'server-msgs',
    SERVER_STATES: 'server-states',
    SERVER_INVITE: 'server-invite',
    SERVER_KICK: 'server-kick',
    SERVER_BAN: 'server-ban',
    SERVER_UNBAN: 'server-unban',

    // Événements serveur -> membres du groupe
    SERVER_GMESSAGE: 'server-gmessage',
    SERVER_GROUP_JOINED: 'server-group-joined',
    SERVER_GROUP_LEFT: 'server-group-left',
    SERVER_GROUP_OWNER: 'server-group-owner',
    SERVER_INVITED: 'server-invited',
    SERVER_UNBANNED: 'server-unbanned',
    SERVER_KICKED: 'server-kicked',
    SERVER_BANNED: 'server-banned'
});

const ERROR_CODES = Object.freeze({
    // Erreurs Partie 1
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
    MESSAGE_TOO_LARGE: 'message-too-large',
    
    // Erreurs Partie 2
    GROUP_NOT_FOUND: 'group-not-found',
    NOT_MEMBER: 'not-member',
    NOT_OWNER: 'not-owner',
    BANNED: 'banned',
    NOT_INVITED: 'not-invited',
    ALREADY_MEMBER: 'already-member',
    TARGET_NOT_MEMBER: 'target-not-member',
    GROUP_ALREADY_EXISTS: 'group-already-exists', // Ajout logique
    CANNOT_BAN_OWNER: 'cannot-ban-owner', // Ajout logique
    INVALID_GROUP_NAME: 'invalid-group-name' // Ajout logique
});

const LIMITS = Object.freeze({
    MAX_LINE_LENGTH: 65536,          
    MAX_NAME_LENGTH: 20,             
    CLIENT_MAX_LINE_LENGTH: 1048576,
    MAX_GROUP_HISTORY: 50            // Limite des messages d'historique par groupe
});

module.exports = { ACTIONS, ERROR_CODES, LIMITS };
