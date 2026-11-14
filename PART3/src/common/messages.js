const { ACTIONS } = require('./constants');

const clientSend = (sender, dest, msg) => ({ sender, dest, msg, action: ACTIONS.CLIENT_SEND });
const clientBroadcast = (sender, msg) => ({ sender, msg, action: ACTIONS.CLIENT_BROADCAST });
const clientListClients = (sender) => ({ sender, action: ACTIONS.CLIENT_LIST_CLIENTS });
const clientQuit = (sender) => ({ sender, action: ACTIONS.CLIENT_QUIT });

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

const clientCGroup = (sender, group) => ({ sender, group, action: ACTIONS.CLIENT_CGROUPE });
const clientJoin = (sender, group) => ({ sender, group, action: ACTIONS.CLIENT_JOIN });
const clientGBroadcast = (sender, group, msg) => ({ sender, group, msg, action: ACTIONS.CLIENT_GBROADCAST });
const clientMembers = (sender, group) => ({ sender, group, action: ACTIONS.CLIENT_MEMBERS });
const clientMsgs = (sender, group) => ({ sender, group, action: ACTIONS.CLIENT_MSGS });
const clientGroups = (name) => ({ name, action: ACTIONS.CLIENT_GROUPS });
const clientLeave = (sender, group) => ({ sender, group, action: ACTIONS.CLIENT_LEAVE });
const clientInvite = (sender, group, dest) => ({ sender, group, dest, action: ACTIONS.CLIENT_INVITE });
const clientKick = (sender, group, dest, reason) => ({ sender, group, dest, reason, action: ACTIONS.CLIENT_KICK });
const clientBan = (sender, group, dest, reason) => ({ sender, group, dest, reason, action: ACTIONS.CLIENT_BAN });
const clientUnban = (sender, group, dest) => ({ sender, group, dest, action: ACTIONS.CLIENT_UNBAN });
const clientStates = (sender, group) => ({ sender, group, action: ACTIONS.CLIENT_STATES });

const serverCGroup = (group) => ({ group, action: ACTIONS.SERVER_CGROUPE });
const serverJoin = (group) => ({ group, action: ACTIONS.SERVER_JOIN });
const serverLeave = (group) => ({ group, action: ACTIONS.SERVER_LEAVE });
const serverMembers = (group, members) => ({ group, members, action: ACTIONS.SERVER_MEMBERS });
const serverGroups = (groups) => ({ groups, action: ACTIONS.SERVER_GROUPS });
const serverGBroadcastAck = (group, count) => ({ group, count, action: ACTIONS.SERVER_GBROADCAST });
const serverMsgs = (group, msgs) => ({ group, msgs, action: ACTIONS.SERVER_MSGS });
const serverStates = (group, states) => ({ group, states, action: ACTIONS.SERVER_STATES });
const serverInviteAck = (group, dest) => ({ group, dest, action: ACTIONS.SERVER_INVITE });
const serverKickAck = (group, dest) => ({ group, dest, action: ACTIONS.SERVER_KICK });
const serverBanAck = (group, dest) => ({ group, dest, action: ACTIONS.SERVER_BAN });
const serverUnbanAck = (group, dest) => ({ group, dest, action: ACTIONS.SERVER_UNBAN });

const serverGMessage = (group, sender, msg) => ({ group, sender, msg, action: ACTIONS.SERVER_GMESSAGE });
const serverGroupJoined = (group, user) => ({ group, user, action: ACTIONS.SERVER_GROUP_JOINED });
const serverGroupLeft = (group, user, reason) => ({ group, user, reason, action: ACTIONS.SERVER_GROUP_LEFT });
const serverGroupOwner = (group, owner) => ({ group, owner, action: ACTIONS.SERVER_GROUP_OWNER });
const serverInvited = (group, sender) => ({ group, sender, action: ACTIONS.SERVER_INVITED });
const serverKicked = (group, sender, reason) => ({ group, sender, reason, action: ACTIONS.SERVER_KICKED });
const serverBanned = (group, sender, reason) => ({ group, sender, reason, action: ACTIONS.SERVER_BANNED });
const serverUnbanned = (group, sender) => ({ group, sender, action: ACTIONS.SERVER_UNBANNED });

module.exports = {
    clientSend, clientBroadcast, clientListClients, clientQuit,
    serverHello, serverSend, serverSendAck, serverBroadcast, serverBroadcastAck,
    serverListClients, serverQuit, serverUserJoined, serverUserLeft, serverError,
    clientCGroup, clientJoin, clientGBroadcast, clientMembers, clientMsgs, clientGroups,
    clientLeave, clientInvite, clientKick, clientBan, clientUnban, clientStates,
    serverCGroup, serverJoin, serverLeave, serverMembers, serverGroups, serverGBroadcastAck,
    serverMsgs, serverStates, serverInviteAck, serverKickAck, serverBanAck, serverUnbanAck,
    serverGMessage, serverGroupJoined, serverGroupLeft, serverGroupOwner,
    serverInvited, serverKicked, serverBanned, serverUnbanned
};
