// Modélisation de l'état des groupes pour la Partie 2
const { LIMITS } = require('../common/constants');

function createGroup(name, owner) {
    const members = new Set([owner]); // Le créateur est automatiquement membre
    const invited = new Set();
    const banned = new Map(); // dest -> reason
    
    // Historiques
    const msgs = [];
    const states = [];

    function addState(eventStr) {
        states.push(eventStr);
        if (states.length > LIMITS.MAX_GROUP_HISTORY) {
            states.shift();
        }
    }

    function addMsg(sender, msg) {
        msgs.push({ sender, msg });
        if (msgs.length > LIMITS.MAX_GROUP_HISTORY) {
            msgs.shift();
        }
    }
    
    // État initial (Création = premier événement)
    addState(`Création par ${owner}`);

    return {
        name,
        owner,
        
        hasMember: (user) => members.has(user),
        getMembers: () => Array.from(members),
        
        isInvited: (user) => invited.has(user),
        isBanned: (user) => banned.has(user),
        
        addMember: (user) => {
            members.add(user);
            invited.delete(user); // Rejoindre consomme l'invitation
            addState(`${user} a rejoint le groupe`);
        },
        removeMember: (user, reason) => {
            members.delete(user);
            addState(`${user} a quitté le groupe (${reason})`);
        },
        
        invite: (user) => {
            invited.add(user);
            addState(`${user} a été invité`);
        },
        ban: (user, reason) => {
            banned.set(user, reason);
            invited.delete(user);
            addState(`${user} a été banni (${reason})`);
        },
        unban: (user) => {
            banned.delete(user);
            addState(`Le bannissement de ${user} a été levé`);
        },
        
        addMsg,
        getMsgs: () => [...msgs],
        getStates: () => [...states]
    };
}

function createGroupRegistry() {
    const groups = new Map(); // nom du groupe -> objet groupe
    
    return {
        has: (name) => groups.has(name),
        get: (name) => groups.get(name),
        add: (name, owner) => {
            const group = createGroup(name, owner);
            groups.set(name, group);
            return group;
        },
        names: () => Array.from(groups.keys()),
        
        // Utile pour la déconnexion globale d'un utilisateur
        removeUserFromAll: (user) => {
            const leftGroups = [];
            for (const [groupName, group] of groups.entries()) {
                if (group.hasMember(user)) {
                    group.removeMember(user, 'disconnect');
                    leftGroups.push(groupName);
                }
            }
            return leftGroups;
        }
    };
}

module.exports = { createGroupRegistry };
