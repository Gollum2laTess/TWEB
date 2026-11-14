const messages = require('../common/messages');

const usage = (text) => ({ kind: 'usage', text });

function parseCommand(line, name) {
    const text = line.trim();
    if (text === '') return { kind: 'empty' };

    const parts = text.split(';');
    switch (parts[0]) {
        // --- P1 ---
        case 's': {
            const dest = (parts[1] || '').trim();
            const msg = parts.slice(2).join(';');
            if (dest === '' || msg === '') return usage('Usage : s;dest;msg');
            return { kind: 'request', message: messages.clientSend(name, dest, msg) };
        }
        case 'b': {
            const msg = parts.slice(1).join(';');
            if (msg === '') return usage('Usage : b;msg');
            return { kind: 'request', message: messages.clientBroadcast(name, msg) };
        }
        case 'ls':
            return { kind: 'request', message: messages.clientListClients(name) };
        case 'q':
            return { kind: 'request', message: messages.clientQuit(name) };
            
        // --- P2 ---
        case 'cg': {
            const group = (parts[1] || '').trim();
            if (group === '') return usage('Usage : cg;groupe');
            return { kind: 'request', message: messages.clientCGroup(name, group) };
        }
        case 'j': {
            const group = (parts[1] || '').trim();
            if (group === '') return usage('Usage : j;groupe');
            return { kind: 'request', message: messages.clientJoin(name, group) };
        }
        case 'bg': {
            const group = (parts[1] || '').trim();
            const msg = parts.slice(2).join(';');
            if (group === '' || msg === '') return usage('Usage : bg;groupe;msg');
            return { kind: 'request', message: messages.clientGBroadcast(name, group, msg) };
        }
        case 'members': {
            const group = (parts[1] || '').trim();
            if (group === '') return usage('Usage : members;groupe');
            return { kind: 'request', message: messages.clientMembers(name, group) };
        }
        case 'messages': {
            const group = (parts[1] || '').trim();
            if (group === '') return usage('Usage : messages;groupe');
            return { kind: 'request', message: messages.clientMsgs(name, group) };
        }
        case 'groups':
            return { kind: 'request', message: messages.clientGroups(name) };
        case 'leave': {
            const group = (parts[1] || '').trim();
            if (group === '') return usage('Usage : leave;groupe');
            return { kind: 'request', message: messages.clientLeave(name, group) };
        }
        case 'invite': {
            const group = (parts[1] || '').trim();
            const dest = (parts[2] || '').trim();
            if (group === '' || dest === '') return usage('Usage : invite;groupe;dest');
            return { kind: 'request', message: messages.clientInvite(name, group, dest) };
        }
        case 'kick': {
            const group = (parts[1] || '').trim();
            const dest = (parts[2] || '').trim();
            const reason = parts.slice(3).join(';');
            if (group === '' || dest === '' || reason === '') return usage('Usage : kick;groupe;dest;raison');
            return { kind: 'request', message: messages.clientKick(name, group, dest, reason) };
        }
        case 'ban': {
            const group = (parts[1] || '').trim();
            const dest = (parts[2] || '').trim();
            const reason = parts.slice(3).join(';');
            if (group === '' || dest === '' || reason === '') return usage('Usage : ban;groupe;dest;raison');
            return { kind: 'request', message: messages.clientBan(name, group, dest, reason) };
        }
        case 'unban': {
            const group = (parts[1] || '').trim();
            const dest = (parts[2] || '').trim();
            if (group === '' || dest === '') return usage('Usage : unban;groupe;dest');
            return { kind: 'request', message: messages.clientUnban(name, group, dest) };
        }
        case 'states': {
            const group = (parts[1] || '').trim();
            if (group === '') return usage('Usage : states;groupe');
            return { kind: 'request', message: messages.clientStates(name, group) };
        }
        default:
            return { kind: 'unknown', text: 'Commande inconnue' };
    }
}

module.exports = { parseCommand };
