const kleur = require('kleur');
const { ACTIONS } = require('../common/constants');

const info = (text) => ({ text, level: 'info' });
const error = (text) => ({ text, level: 'error' });

function formatServerMessage(msg) {
    switch (msg.action) {
        // P1
        case ACTIONS.SERVER_HELLO: return info(kleur.green(String(msg.msg)));
        case ACTIONS.SERVER_SEND: return info(kleur.magenta('[privé] ' + msg.sender) + ' : ' + msg.msg);
        case ACTIONS.SERVER_BROADCAST: return info(kleur.cyan('[tous] ' + msg.sender) + ' : ' + msg.msg);
        case ACTIONS.SERVER_SEND_ACK: return info(kleur.gray('Message envoyé à ' + msg.dest));
        case ACTIONS.SERVER_BROADCAST_ACK: return info(kleur.gray('Message diffusé à ' + msg.count + ' utilisateur(s)'));
        case ACTIONS.SERVER_LIST_CLIENTS: return info('Utilisateurs connectés : ' + kleur.bold(msg.clients.join(', ')));
        case ACTIONS.SERVER_USER_JOINED: return info(kleur.yellow('→ ' + msg.user + ' a rejoint la conversation globale'));
        case ACTIONS.SERVER_USER_LEFT: return info(kleur.yellow('← ' + msg.user + ' a quitté la conversation globale'));
        case ACTIONS.SERVER_QUIT: return info(kleur.green(String(msg.msg)));
        case ACTIONS.SERVER_ERROR: return error(kleur.red('Erreur [' + msg.code + '] : ' + msg.msg));
        
        // P2
        case ACTIONS.SERVER_CGROUPE: return info(kleur.green(`Groupe ${msg.group} créé avec succès`));
        case ACTIONS.SERVER_JOIN: return info(kleur.green(`Vous avez rejoint le groupe ${msg.group}`));
        case ACTIONS.SERVER_LEAVE: return info(kleur.yellow(`Vous avez quitté le groupe ${msg.group}`));
        case ACTIONS.SERVER_MEMBERS: return info(`Membres de ${msg.group} : ` + kleur.bold(msg.members.join(', ')));
        case ACTIONS.SERVER_GROUPS: return info('Groupes existants : ' + kleur.bold(msg.groups.join(', ')));
        case ACTIONS.SERVER_GBROADCAST: return info(kleur.gray(`Message diffusé dans ${msg.group} à ${msg.count} membre(s)`));
        case ACTIONS.SERVER_MSGS: {
            const lines = msg.msgs.map(m => `  ${kleur.blue(m.sender)}: ${m.msg}`).join('\n');
            return info(`Historique des messages de ${msg.group} :\n${lines || '  (Aucun message)'}`);
        }
        case ACTIONS.SERVER_STATES: {
            const lines = msg.states.map(s => `  - ${s}`).join('\n');
            return info(`Historique des événements de ${msg.group} :\n${lines || '  (Aucun événement)'}`);
        }
        case ACTIONS.SERVER_INVITE: return info(kleur.green(`${msg.dest} a été invité dans ${msg.group}`));
        case ACTIONS.SERVER_KICK: return info(kleur.yellow(`${msg.dest} a été exclu de ${msg.group}`));
        case ACTIONS.SERVER_BAN: return info(kleur.red(`${msg.dest} a été banni de ${msg.group}`));
        case ACTIONS.SERVER_UNBAN: return info(kleur.green(`Le bannissement de ${msg.dest} dans ${msg.group} a été levé`));
        
        // Événements de groupe P2
        case ACTIONS.SERVER_GMESSAGE: return info(kleur.cyan(`[${msg.group}] ${msg.sender}`) + ' : ' + msg.msg);
        case ACTIONS.SERVER_GROUP_JOINED: return info(kleur.yellow(`→ ${msg.user} a rejoint le groupe [${msg.group}]`));
        case ACTIONS.SERVER_GROUP_LEFT: return info(kleur.yellow(`← ${msg.user} a quitté le groupe [${msg.group}] (${msg.reason})`));
        case ACTIONS.SERVER_INVITED: return info(kleur.green(`Vous avez été invité dans le groupe [${msg.group}] par ${msg.sender}`));
        case ACTIONS.SERVER_KICKED: return error(kleur.red(`Vous avez été exclu du groupe [${msg.group}] par ${msg.sender} (Raison : ${msg.reason})`));
        case ACTIONS.SERVER_BANNED: return error(kleur.red(`Vous avez été banni du groupe [${msg.group}] par ${msg.sender} (Raison : ${msg.reason})`));
        case ACTIONS.SERVER_UNBANNED: return info(kleur.green(`Votre bannissement du groupe [${msg.group}] a été levé par ${msg.sender}`));
    }
    return info(kleur.gray('Message inattendu : ' + JSON.stringify(msg)));
}

module.exports = { formatServerMessage };
