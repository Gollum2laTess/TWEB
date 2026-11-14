const debug = require('debug')('msg:server');
const { ACTIONS, ERROR_CODES, LIMITS } = require('../common/constants');
const messages = require('../common/messages');
const { encode } = require('../common/framing');

const CLOSE_GRACE_MS = 1000;

// "conn" représente une connexion : { socket, peer, registry, groupRegistry, name, closing }

function send(conn, message) {
    if (conn.socket.destroyed || !conn.socket.writable) return;
    conn.socket.write(encode(message));
}

function sendError(conn, code, text) {
    debug('ERROR %s -> %s', code, conn.name || conn.peer);
    send(conn, messages.serverError(code, text));
}

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

function sendToGroup(groupRegistry, globalRegistry, groupName, message, excludeName = null) {
    let count = 0;
    const group = groupRegistry.get(groupName);
    if (!group) return 0;
    
    for (const memberName of group.getMembers()) {
        if (memberName !== excludeName) {
            const memberConn = globalRegistry.get(memberName);
            if (memberConn) {
                send(memberConn, message);
                count++;
            }
        }
    }
    return count;
}

function closeConnection(conn) {
    if (conn.closing) return;
    conn.closing = true;
    conn.socket.end();
    setTimeout(() => conn.socket.destroy(), CLOSE_GRACE_MS).unref();
}

function leave(conn) {
    const name = conn.name;
    if (name === null) return;
    conn.name = null;
    conn.registry.remove(name, conn);
    sendToOthers(conn, messages.serverUserLeft(name));
    
    // P2: Retirer de tous les groupes
    if (conn.groupRegistry) {
        const leftGroups = conn.groupRegistry.removeUserFromAll(name);
        for (const groupName of leftGroups) {
            sendToGroup(conn.groupRegistry, conn.registry, groupName, messages.serverGroupLeft(groupName, name, 'disconnect'));
        }
    }
    debug('LEFT %s ; connectés : %o', name, conn.registry.names());
}

const isString = (value) => typeof value === 'string';

// --- HANDLERS PARTIE 1 ---
function handleHello(conn, msg) {
    if (conn.name !== null) return sendError(conn, ERROR_CODES.ALREADY_REGISTERED, 'Déjà présenté');
    const name = msg.sender;
    if (!name || (isString(name) && name.trim() === '')) return sendError(conn, ERROR_CODES.NAME_EMPTY, 'Nom vide') && closeConnection(conn);
    if (!isString(name) || name.length > LIMITS.MAX_NAME_LENGTH || name.includes(';')) return sendError(conn, ERROR_CODES.NAME_INVALID, 'Nom invalide') && closeConnection(conn);
    if (conn.registry.has(name)) return sendError(conn, ERROR_CODES.NAME_TAKEN, 'Nom pris') && closeConnection(conn);
    
    conn.registry.add(name, conn);
    conn.name = name;
    send(conn, messages.serverHello(name, 'Bienvenue ' + name));
    sendToOthers(conn, messages.serverUserJoined(name));
}

function handleSend(conn, msg) {
    if (!isString(msg.dest) || !isString(msg.msg)) return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Champs invalides');
    if (msg.dest === conn.name) return sendError(conn, ERROR_CODES.RECIPIENT_IS_SELF, 'Destinataire = soi-même');
    const target = conn.registry.get(msg.dest);
    if (!target) return sendError(conn, ERROR_CODES.RECIPIENT_NOT_FOUND, 'Absent');
    send(target, messages.serverSend(conn.name, msg.dest, msg.msg));
    send(conn, messages.serverSendAck(msg.dest));
}

function handleBroadcast(conn, msg) {
    if (!isString(msg.msg)) return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Champs invalides');
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

// --- HANDLERS PARTIE 2 (Groupes) ---
function getValidGroup(conn, groupName) {
    if (!isString(groupName)) {
        sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Le nom du groupe doit être une chaîne');
        return null;
    }
    const group = conn.groupRegistry.get(groupName);
    if (!group) {
        sendError(conn, ERROR_CODES.GROUP_NOT_FOUND, 'Groupe introuvable : ' + groupName);
        return null;
    }
    return group;
}

function handleCGroup(conn, msg) {
    if (!isString(msg.group)) return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Nom de groupe invalide');
    if (conn.groupRegistry.has(msg.group)) return sendError(conn, ERROR_CODES.GROUP_ALREADY_EXISTS, 'Le groupe existe déjà');
    if (msg.group.trim() === '' || msg.group.includes(';')) return sendError(conn, ERROR_CODES.INVALID_GROUP_NAME, 'Nom de groupe invalide');
    
    conn.groupRegistry.add(msg.group, conn.name);
    send(conn, messages.serverCGroup(msg.group));
    debug('Group created: %s by %s', msg.group, conn.name);
}

function handleJoin(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    
    if (group.hasMember(conn.name)) return sendError(conn, ERROR_CODES.ALREADY_MEMBER, 'Vous êtes déjà membre');
    if (group.isBanned(conn.name)) return sendError(conn, ERROR_CODES.BANNED, 'Vous êtes banni de ce groupe');
    if (!group.isInvited(conn.name)) return sendError(conn, ERROR_CODES.NOT_INVITED, 'Vous n\'avez pas été invité');
    
    group.addMember(conn.name);
    send(conn, messages.serverJoin(msg.group));
    sendToGroup(conn.groupRegistry, conn.registry, msg.group, messages.serverGroupJoined(msg.group, conn.name), conn.name);
}

function handleGBroadcast(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (!isString(msg.msg)) return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Message invalide');
    if (!group.hasMember(conn.name)) return sendError(conn, ERROR_CODES.NOT_MEMBER, 'Vous n\'êtes pas membre');

    group.addMsg(conn.name, msg.msg);
    const count = sendToGroup(conn.groupRegistry, conn.registry, msg.group, messages.serverGMessage(msg.group, conn.name, msg.msg), conn.name);
    send(conn, messages.serverGBroadcastAck(msg.group, count));
}

function handleMembers(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (!group.hasMember(conn.name)) return sendError(conn, ERROR_CODES.NOT_MEMBER, 'Vous n\'êtes pas membre');
    send(conn, messages.serverMembers(msg.group, group.getMembers()));
}

function handleMsgs(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (!group.hasMember(conn.name)) return sendError(conn, ERROR_CODES.NOT_MEMBER, 'Vous n\'êtes pas membre');
    send(conn, messages.serverMsgs(msg.group, group.getMsgs()));
}

function handleGroups(conn, msg) {
    send(conn, messages.serverGroups(conn.groupRegistry.names()));
}

function handleLeave(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (!group.hasMember(conn.name)) return sendError(conn, ERROR_CODES.NOT_MEMBER, 'Vous n\'êtes pas membre');
    
    group.removeMember(conn.name, 'leave');
    send(conn, messages.serverLeave(msg.group));
    sendToGroup(conn.groupRegistry, conn.registry, msg.group, messages.serverGroupLeft(msg.group, conn.name, 'leave'));
}

function handleInvite(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (group.owner !== conn.name) return sendError(conn, ERROR_CODES.NOT_OWNER, 'Seul le propriétaire peut inviter');
    if (!isString(msg.dest)) return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Destinataire invalide');
    
    const targetConn = conn.registry.get(msg.dest);
    if (!targetConn) return sendError(conn, ERROR_CODES.RECIPIENT_NOT_FOUND, 'Utilisateur introuvable');
    if (group.hasMember(msg.dest)) return sendError(conn, ERROR_CODES.ALREADY_MEMBER, 'L\'utilisateur est déjà membre');
    
    group.invite(msg.dest);
    send(targetConn, messages.serverInvited(msg.group, conn.name));
    send(conn, messages.serverInviteAck(msg.group, msg.dest));
}

function handleKick(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (group.owner !== conn.name) return sendError(conn, ERROR_CODES.NOT_OWNER, 'Seul le propriétaire peut exclure');
    if (!isString(msg.dest) || !isString(msg.reason)) return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Paramètres invalides');
    if (!group.hasMember(msg.dest)) return sendError(conn, ERROR_CODES.TARGET_NOT_MEMBER, 'L\'utilisateur n\'est pas membre');
    if (msg.dest === group.owner) return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Impossible d\'exclure le propriétaire');

    group.removeMember(msg.dest, 'kick');
    
    const targetConn = conn.registry.get(msg.dest);
    if (targetConn) send(targetConn, messages.serverKicked(msg.group, conn.name, msg.reason));
    
    sendToGroup(conn.groupRegistry, conn.registry, msg.group, messages.serverGroupLeft(msg.group, msg.dest, 'kick'));
    send(conn, messages.serverKickAck(msg.group, msg.dest));
}

function handleBan(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (group.owner !== conn.name) return sendError(conn, ERROR_CODES.NOT_OWNER, 'Seul le propriétaire peut bannir');
    if (!isString(msg.dest) || !isString(msg.reason)) return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Paramètres invalides');
    if (msg.dest === group.owner) return sendError(conn, ERROR_CODES.CANNOT_BAN_OWNER, 'Impossible de bannir le propriétaire');

    if (group.hasMember(msg.dest)) {
        group.removeMember(msg.dest, 'ban');
        sendToGroup(conn.groupRegistry, conn.registry, msg.group, messages.serverGroupLeft(msg.group, msg.dest, 'ban'));
    }
    
    group.ban(msg.dest, msg.reason);
    
    const targetConn = conn.registry.get(msg.dest);
    if (targetConn) send(targetConn, messages.serverBanned(msg.group, conn.name, msg.reason));
    
    send(conn, messages.serverBanAck(msg.group, msg.dest));
}

function handleUnban(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (group.owner !== conn.name) return sendError(conn, ERROR_CODES.NOT_OWNER, 'Seul le propriétaire peut débannir');
    if (!isString(msg.dest)) return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Destinataire invalide');
    
    group.unban(msg.dest);
    
    const targetConn = conn.registry.get(msg.dest);
    if (targetConn) send(targetConn, messages.serverUnbanned(msg.group, conn.name));
    
    send(conn, messages.serverUnbanAck(msg.group, msg.dest));
}

function handleStates(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (!group.hasMember(conn.name)) return sendError(conn, ERROR_CODES.NOT_MEMBER, 'Vous n\'êtes pas membre');
    send(conn, messages.serverStates(msg.group, group.getStates()));
}


const handlers = new Map([
    [ACTIONS.CLIENT_HELLO, handleHello],
    [ACTIONS.CLIENT_SEND, handleSend],
    [ACTIONS.CLIENT_BROADCAST, handleBroadcast],
    [ACTIONS.CLIENT_LIST_CLIENTS, handleListClients],
    [ACTIONS.CLIENT_QUIT, handleQuit],
    [ACTIONS.CLIENT_CGROUPE, handleCGroup],
    [ACTIONS.CLIENT_JOIN, handleJoin],
    [ACTIONS.CLIENT_GBROADCAST, handleGBroadcast],
    [ACTIONS.CLIENT_MEMBERS, handleMembers],
    [ACTIONS.CLIENT_MSGS, handleMsgs],
    [ACTIONS.CLIENT_GROUPS, handleGroups],
    [ACTIONS.CLIENT_LEAVE, handleLeave],
    [ACTIONS.CLIENT_INVITE, handleInvite],
    [ACTIONS.CLIENT_KICK, handleKick],
    [ACTIONS.CLIENT_BAN, handleBan],
    [ACTIONS.CLIENT_UNBAN, handleUnban],
    [ACTIONS.CLIENT_STATES, handleStates]
]);

function handleLine(conn, line) {
    if (conn.closing) return;

    let msg;
    try {
        msg = JSON.parse(line);
    } catch (err) {
        return sendError(conn, ERROR_CODES.INVALID_JSON, "JSON invalide");
    }
    if (typeof msg !== 'object' || msg === null || Array.isArray(msg) || !isString(msg.action)) {
        return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Format JSON invalide');
    }

    if (conn.name === null && msg.action !== ACTIONS.CLIENT_HELLO) {
        return sendError(conn, ERROR_CODES.NOT_REGISTERED, "Présentez-vous d'abord");
    }
    const handler = handlers.get(msg.action);
    if (!handler) {
        return sendError(conn, ERROR_CODES.UNKNOWN_ACTION, 'Action inconnue : ' + msg.action);
    }
    
    // Exception d'identité pour "groups" (utilise "name" au lieu de "sender")
    if (msg.action !== ACTIONS.CLIENT_HELLO) {
        if (msg.action === ACTIONS.CLIENT_GROUPS) {
             if (msg.name !== conn.name) return sendError(conn, ERROR_CODES.IDENTITY_MISMATCH, 'name doit être ' + conn.name);
        } else {
             if (msg.sender !== conn.name) return sendError(conn, ERROR_CODES.IDENTITY_MISMATCH, 'sender doit être ' + conn.name);
        }
    }
    handler(conn, msg);
}

function handleTooLarge(conn) {
    sendError(conn, ERROR_CODES.MESSAGE_TOO_LARGE, 'Ligne trop longue');
    closeConnection(conn);
}

module.exports = { handleLine, handleTooLarge, leave };
