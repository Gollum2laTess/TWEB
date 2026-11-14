// Mise en forme de ce que reçoit le client. Les couleurs viennent de kleur
// (désactivées automatiquement quand la sortie n'est pas un terminal).
const kleur = require('kleur');
const { ACTIONS } = require('../common/constants');

const info = (text) => ({ text, level: 'info' });
const error = (text) => ({ text, level: 'error' });

// Renvoie { text, level } pour un message du serveur déjà décodé.
// Un message inattendu est affiché brut, sans interrompre le client.
function formatServerMessage(msg) {
    switch (msg.action) {
        case ACTIONS.SERVER_HELLO:
            return info(kleur.green(String(msg.msg)));
        case ACTIONS.SERVER_SEND:
            return info(kleur.magenta('[privé] ' + msg.sender) + ' : ' + msg.msg);
        case ACTIONS.SERVER_BROADCAST:
            return info(kleur.cyan('[tous] ' + msg.sender) + ' : ' + msg.msg);
        case ACTIONS.SERVER_SEND_ACK:
            return info(kleur.gray('Message envoyé à ' + msg.dest));
        case ACTIONS.SERVER_BROADCAST_ACK:
            return info(kleur.gray('Message diffusé à ' + msg.count + ' utilisateur(s)'));
        case ACTIONS.SERVER_LIST_CLIENTS:
            if (Array.isArray(msg.clients)) {
                return info('Utilisateurs connectés (' + msg.clients.length + ') : ' + kleur.bold(msg.clients.join(', ')));
            }
            break;
        case ACTIONS.SERVER_USER_JOINED:
            return info(kleur.yellow('→ ' + msg.user + ' a rejoint la conversation'));
        case ACTIONS.SERVER_USER_LEFT:
            return info(kleur.yellow('← ' + msg.user + ' a quitté la conversation'));
        case ACTIONS.SERVER_QUIT:
            return info(kleur.green(String(msg.msg)));
        case ACTIONS.SERVER_ERROR:
            return error(kleur.red('Erreur [' + msg.code + '] : ' + msg.msg));
    }
    return info(kleur.gray('Message inattendu : ' + JSON.stringify(msg)));
}

module.exports = { formatServerMessage };
