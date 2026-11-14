const ACTIONS = Object.freeze({
    CLIENT_SEND: 'client-send',
    CLIENT_BROADCAST: 'client-broadcast',
    CLIENT_LIST_CLIENTS: 'client-list-clients',
    CLIENT_QUIT: 'client-quit',
    SERVER_HELLO: 'server-hello',
    SERVER_SEND_ACK: 'server-send-ack',
    SERVER_BROADCAST_ACK: 'server-broadcast-ack',
    SERVER_LIST_CLIENTS: 'server-list-clients',
    SERVER_QUIT: 'server-quit',
    SERVER_ERROR: 'server-error',
    SERVER_SEND: 'server-send',
    SERVER_BROADCAST: 'server-broadcast',
    SERVER_USER_JOINED: 'server-user-joined',
    SERVER_USER_LEFT: 'server-user-left',

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
    
    GROUP_NOT_FOUND: 'group-not-found',
    NOT_MEMBER: 'not-member',
    NOT_OWNER: 'not-owner',
    BANNED: 'banned',
    NOT_INVITED: 'not-invited',
    ALREADY_MEMBER: 'already-member',
    TARGET_NOT_MEMBER: 'target-not-member',
    GROUP_ALREADY_EXISTS: 'group-already-exists',
    CANNOT_BAN_OWNER: 'cannot-ban-owner',
    INVALID_GROUP_NAME: 'invalid-group-name'
});

const LIMITS = Object.freeze({
    MAX_LINE_LENGTH: 65536,          
    MAX_NAME_LENGTH: 20,             
    CLIENT_MAX_LINE_LENGTH: 1048576,
    MAX_GROUP_HISTORY: 50
});

module.exports = { ACTIONS, ERROR_CODES, LIMITS };
