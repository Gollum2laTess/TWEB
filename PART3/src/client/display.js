const kleur = require('kleur');
const { ACTIONS } = require('../common/constants');
const info = (text) => ({ text, level: 'info' });
const error = (text) => ({ text, level: 'error' });

function formatServerMessage(msg) {
    switch (msg.action) {
        case ACTIONS.SERVER_HELLO: return info(kleur.green(String(msg.msg)));
        case ACTIONS.SERVER_SEND: return info(kleur.magenta('[privé] ' + msg.sender) + ' : ' + msg.msg);
        case ACTIONS.SERVER_BROADCAST: return info(kleur.cyan('[tous] ' + msg.sender) + ' : ' + msg.msg);
        case ACTIONS.SERVER_SEND_ACK: return info(kleur.gray('Message envoyé à ' + msg.dest));
        case ACTIONS.SERVER_BROADCAST_ACK: return info(kleur.gray('Message diffusé à ' + msg.count + ' utilisateur(s)'));
        case ACTIONS.SERVER_LIST_CLIENTS: return info('Connectés : ' + kleur.bold(msg.clients.join(', ')));
        case ACTIONS.SERVER_USER_JOINED: return info(kleur.yellow('→ ' + msg.user + ' a rejoint le serveur'));
        case ACTIONS.SERVER_USER_LEFT: return info(kleur.yellow('← ' + msg.user + ' a quitté le serveur'));
        case ACTIONS.SERVER_QUIT: return info(kleur.green(String(msg.msg)));
        case ACTIONS.SERVER_ERROR: return error(kleur.red('Erreur [' + msg.code + '] : ' + msg.msg));
        
        case ACTIONS.SERVER_CGROUPE: return info(kleur.green(`Groupe ${msg.group} créé`));
        case ACTIONS.SERVER_JOIN: return info(kleur.green(`Vous avez rejoint ${msg.group}`));
        case ACTIONS.SERVER_LEAVE: return info(kleur.yellow(`Vous avez quitté ${msg.group}`));
        case ACTIONS.SERVER_MEMBERS: return info(`Membres de ${msg.group} : ` + kleur.bold(msg.members.join(', ')));
        case ACTIONS.SERVER_GROUPS: return info('Groupes : ' + kleur.bold(msg.groups.join(', ')));
        case ACTIONS.SERVER_GBROADCAST: return info(kleur.gray(`Diffusé dans ${msg.group} à ${msg.count} membre(s)`));
        case ACTIONS.SERVER_MSGS: {
            const lines = msg.msgs.map(m => `  ${kleur.blue(m.sender)}: ${m.msg}`).join('\n');
            return info(`Historique ${msg.group} :\n${lines || '  (Aucun)'}`);
        }
        case ACTIONS.SERVER_STATES: {
            const lines = msg.states.map(s => `  - ${s}`).join('\n');
            return info(`Événements ${msg.group} :\n${lines || '  (Aucun)'}`);
        }
        case ACTIONS.SERVER_INVITE: return info(kleur.green(`${msg.dest} invité dans ${msg.group}`));
        case ACTIONS.SERVER_KICK: return info(kleur.yellow(`${msg.dest} exclu de ${msg.group}`));
        case ACTIONS.SERVER_BAN: return info(kleur.red(`${msg.dest} banni de ${msg.group}`));
        case ACTIONS.SERVER_UNBAN: return info(kleur.green(`Bannissement de ${msg.dest} levé dans ${msg.group}`));
        
        case ACTIONS.SERVER_GMESSAGE: return info(kleur.cyan(`[${msg.group}] ${msg.sender}`) + ' : ' + msg.msg);
        case ACTIONS.SERVER_GROUP_JOINED: return info(kleur.yellow(`→ ${msg.user} a rejoint [${msg.group}]`));
        case ACTIONS.SERVER_GROUP_LEFT: return info(kleur.yellow(`← ${msg.user} a quitté [${msg.group}] (${msg.reason})`));
        case ACTIONS.SERVER_INVITED: return info(kleur.green(`Invité dans [${msg.group}] par ${msg.sender}`));
        case ACTIONS.SERVER_KICKED: return error(kleur.red(`Exclu de [${msg.group}] par ${msg.sender} (${msg.reason})`));
        case ACTIONS.SERVER_BANNED: return error(kleur.red(`Banni de [${msg.group}] par ${msg.sender} (${msg.reason})`));
        case ACTIONS.SERVER_UNBANNED: return info(kleur.green(`Bannissement levé dans [${msg.group}] par ${msg.sender}`));
    }
    return info(kleur.gray('Message inattendu : ' + JSON.stringify(msg)));
}
module.exports = { formatServerMessage };
