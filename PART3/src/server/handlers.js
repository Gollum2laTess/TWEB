const debug = require('debug')('msg:server');
const { ACTIONS, ERROR_CODES } = require('../common/constants');
const messages = require('../common/messages');

const isString = (value) => typeof value === 'string';

function sendError(conn, code, text) {
    debug('ERROR %s -> %s', code, conn.name || conn.peer);
    conn.send(messages.serverError(code, text));
}

function sendToOthers(conn, message) {
    let count = 0;
    for (const other of conn.registry.all()) {
        if (other !== conn) {
            other.send(message);
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
                memberConn.send(message);
                count++;
            }
        }
    }
    return count;
}

function leave(conn) {
    const name = conn.name;
    if (name === null) return;
    conn.name = null;
    conn.registry.remove(name, conn);
    sendToOthers(conn, messages.serverUserLeft(name));
    
    if (conn.groupRegistry) {
        const leftGroups = conn.groupRegistry.removeUserFromAll(name);
        for (const groupName of leftGroups) {
            sendToGroup(conn.groupRegistry, conn.registry, groupName, messages.serverGroupLeft(groupName, name, 'disconnect'));
        }
    }
    debug('LEFT %s', name);
}

// P1
function handleSend(conn, msg) {
    if (!isString(msg.dest) || !isString(msg.msg)) return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Champs invalides');
    if (msg.dest === conn.name) return sendError(conn, ERROR_CODES.RECIPIENT_IS_SELF, 'Destinataire = soi-même');
    const target = conn.registry.get(msg.dest);
    if (!target) return sendError(conn, ERROR_CODES.RECIPIENT_NOT_FOUND, 'Absent');
    target.send(messages.serverSend(conn.name, msg.dest, msg.msg));
    conn.send(messages.serverSendAck(msg.dest));
}
function handleBroadcast(conn, msg) {
    if (!isString(msg.msg)) return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Champs invalides');
    const count = sendToOthers(conn, messages.serverBroadcast(conn.name, msg.msg));
    conn.send(messages.serverBroadcastAck(count));
}
function handleListClients(conn) {
    conn.send(messages.serverListClients(conn.registry.names()));
}
function handleQuit(conn) {
    conn.send(messages.serverQuit('Au revoir ' + conn.name));
    leave(conn);
    conn.socket.end();
}

// P2
function getValidGroup(conn, groupName) {
    if (!isString(groupName)) { sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Nom invalide'); return null; }
    const group = conn.groupRegistry.get(groupName);
    if (!group) { sendError(conn, ERROR_CODES.GROUP_NOT_FOUND, 'Groupe introuvable'); return null; }
    return group;
}
function handleCGroup(conn, msg) {
    if (!isString(msg.group) || msg.group.trim() === '' || msg.group.includes(';')) return sendError(conn, ERROR_CODES.INVALID_GROUP_NAME, 'Nom invalide');
    if (conn.groupRegistry.has(msg.group)) return sendError(conn, ERROR_CODES.GROUP_ALREADY_EXISTS, 'Existe déjà');
    conn.groupRegistry.add(msg.group, conn.name);
    conn.send(messages.serverCGroup(msg.group));
}
function handleJoin(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (group.hasMember(conn.name)) return sendError(conn, ERROR_CODES.ALREADY_MEMBER, 'Déjà membre');
    if (group.isBanned(conn.name)) return sendError(conn, ERROR_CODES.BANNED, 'Banni');
    if (!group.isInvited(conn.name)) return sendError(conn, ERROR_CODES.NOT_INVITED, 'Pas invité');
    group.addMember(conn.name);
    conn.send(messages.serverJoin(msg.group));
    sendToGroup(conn.groupRegistry, conn.registry, msg.group, messages.serverGroupJoined(msg.group, conn.name), conn.name);
}
function handleGBroadcast(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (!isString(msg.msg)) return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Message invalide');
    if (!group.hasMember(conn.name)) return sendError(conn, ERROR_CODES.NOT_MEMBER, 'Pas membre');
    group.addMsg(conn.name, msg.msg);
    const count = sendToGroup(conn.groupRegistry, conn.registry, msg.group, messages.serverGMessage(msg.group, conn.name, msg.msg), conn.name);
    conn.send(messages.serverGBroadcastAck(msg.group, count));
}
function handleMembers(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (!group.hasMember(conn.name)) return sendError(conn, ERROR_CODES.NOT_MEMBER, 'Pas membre');
    conn.send(messages.serverMembers(msg.group, group.getMembers()));
}
function handleMsgs(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (!group.hasMember(conn.name)) return sendError(conn, ERROR_CODES.NOT_MEMBER, 'Pas membre');
    conn.send(messages.serverMsgs(msg.group, group.getMsgs()));
}
function handleGroups(conn, msg) {
    conn.send(messages.serverGroups(conn.groupRegistry.names()));
}
function handleLeave(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (!group.hasMember(conn.name)) return sendError(conn, ERROR_CODES.NOT_MEMBER, 'Pas membre');
    group.removeMember(conn.name, 'leave');
    conn.send(messages.serverLeave(msg.group));
    sendToGroup(conn.groupRegistry, conn.registry, msg.group, messages.serverGroupLeft(msg.group, conn.name, 'leave'));
}
function handleInvite(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (group.owner !== conn.name) return sendError(conn, ERROR_CODES.NOT_OWNER, 'Non propriétaire');
    if (!isString(msg.dest)) return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Destinataire invalide');
    const targetConn = conn.registry.get(msg.dest);
    if (!targetConn) return sendError(conn, ERROR_CODES.RECIPIENT_NOT_FOUND, 'Introuvable');
    if (group.hasMember(msg.dest)) return sendError(conn, ERROR_CODES.ALREADY_MEMBER, 'Déjà membre');
    group.invite(msg.dest);
    targetConn.send(messages.serverInvited(msg.group, conn.name));
    conn.send(messages.serverInviteAck(msg.group, msg.dest));
}
function handleKick(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (group.owner !== conn.name) return sendError(conn, ERROR_CODES.NOT_OWNER, 'Non propriétaire');
    if (!isString(msg.dest) || !isString(msg.reason)) return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Invalide');
    if (!group.hasMember(msg.dest)) return sendError(conn, ERROR_CODES.TARGET_NOT_MEMBER, 'Pas membre');
    if (msg.dest === group.owner) return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Impossible d\'exclure le propriétaire');
    group.removeMember(msg.dest, 'kick');
    const targetConn = conn.registry.get(msg.dest);
    if (targetConn) targetConn.send(messages.serverKicked(msg.group, conn.name, msg.reason));
    sendToGroup(conn.groupRegistry, conn.registry, msg.group, messages.serverGroupLeft(msg.group, msg.dest, 'kick'));
    conn.send(messages.serverKickAck(msg.group, msg.dest));
}
function handleBan(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (group.owner !== conn.name) return sendError(conn, ERROR_CODES.NOT_OWNER, 'Non propriétaire');
    if (!isString(msg.dest) || !isString(msg.reason)) return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Invalide');
    if (msg.dest === group.owner) return sendError(conn, ERROR_CODES.CANNOT_BAN_OWNER, 'Impossible');
    if (group.hasMember(msg.dest)) {
        group.removeMember(msg.dest, 'ban');
        sendToGroup(conn.groupRegistry, conn.registry, msg.group, messages.serverGroupLeft(msg.group, msg.dest, 'ban'));
    }
    group.ban(msg.dest, msg.reason);
    const targetConn = conn.registry.get(msg.dest);
    if (targetConn) targetConn.send(messages.serverBanned(msg.group, conn.name, msg.reason));
    conn.send(messages.serverBanAck(msg.group, msg.dest));
}
function handleUnban(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (group.owner !== conn.name) return sendError(conn, ERROR_CODES.NOT_OWNER, 'Non propriétaire');
    if (!isString(msg.dest)) return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Invalide');
    group.unban(msg.dest);
    const targetConn = conn.registry.get(msg.dest);
    if (targetConn) targetConn.send(messages.serverUnbanned(msg.group, conn.name));
    conn.send(messages.serverUnbanAck(msg.group, msg.dest));
}
function handleStates(conn, msg) {
    const group = getValidGroup(conn, msg.group);
    if (!group) return;
    if (!group.hasMember(conn.name)) return sendError(conn, ERROR_CODES.NOT_MEMBER, 'Pas membre');
    conn.send(messages.serverStates(msg.group, group.getStates()));
}

const handlers = new Map([
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

function handleMessage(conn, msg) {
    if (conn.closing) return;
    if (typeof msg !== 'object' || msg === null || Array.isArray(msg) || !isString(msg.action)) {
        return sendError(conn, ERROR_CODES.INVALID_MESSAGE, 'Format JSON invalide');
    }
    
    // Check identity
    if (msg.action === ACTIONS.CLIENT_GROUPS) {
         if (msg.name !== conn.name) return sendError(conn, ERROR_CODES.IDENTITY_MISMATCH, 'name mismatch');
    } else {
         if (msg.sender !== conn.name) return sendError(conn, ERROR_CODES.IDENTITY_MISMATCH, 'sender mismatch');
    }

    const handler = handlers.get(msg.action);
    if (!handler) return sendError(conn, ERROR_CODES.UNKNOWN_ACTION, 'Action inconnue');
    handler(conn, msg);
}

module.exports = { handleMessage, leave };
