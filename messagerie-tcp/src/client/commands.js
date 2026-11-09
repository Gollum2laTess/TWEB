// Commandes saisies par l'utilisateur -> requêtes du protocole.
//   s;dest;msg   message privé        b;msg   diffusion
//   ls;          liste des connectés  q;      quitter
const messages = require('../common/messages');

const usage = (text) => ({ kind: 'usage', text });

// Renvoie { kind: 'empty' }, { kind: 'usage', text }, { kind: 'unknown', text }
// ou { kind: 'request', message }.
function parseCommand(line, name) {
    const text = line.trim();
    if (text === '') return { kind: 'empty' };

    const parts = text.split(';');
    switch (parts[0]) {
        case 's': {
            // Le message peut lui-même contenir des ';'
            const dest = (parts[1] || '').trim();
            const msg = parts.slice(2).join(';');
            if (dest === '' || msg === '') return usage('Usage : s;destinataire;message');
            return { kind: 'request', message: messages.clientSend(name, dest, msg) };
        }
        case 'b': {
            const msg = parts.slice(1).join(';');
            if (msg === '') return usage('Usage : b;message');
            return { kind: 'request', message: messages.clientBroadcast(name, msg) };
        }
        case 'ls':
            return { kind: 'request', message: messages.clientListClients(name) };
        case 'q':
            return { kind: 'request', message: messages.clientQuit(name) };
        default:
            return { kind: 'unknown', text: 'Commande inconnue : ' + text + '  (s;dest;msg  b;msg  ls;  q;)' };
    }
}

module.exports = { parseCommand };
