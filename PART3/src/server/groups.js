const { LIMITS } = require('../common/constants');

function createGroup(name, owner) {
    const members = new Set([owner]); 
    const invited = new Set();
    const banned = new Map();
    const msgs = [];
    const states = [];

    function addState(eventStr) {
        states.push(eventStr);
        if (states.length > LIMITS.MAX_GROUP_HISTORY) states.shift();
    }
    function addMsg(sender, msg) {
        msgs.push({ sender, msg });
        if (msgs.length > LIMITS.MAX_GROUP_HISTORY) msgs.shift();
    }
    
    addState(`Création par ${owner}`);

    return {
        name, owner,
        hasMember: (u) => members.has(u),
        getMembers: () => Array.from(members),
        isInvited: (u) => invited.has(u),
        isBanned: (u) => banned.has(u),
        addMember: (u) => { members.add(u); invited.delete(u); addState(`${u} a rejoint`); },
        removeMember: (u, r) => { members.delete(u); addState(`${u} a quitté (${r})`); },
        invite: (u) => { invited.add(u); addState(`${u} invité`); },
        ban: (u, r) => { banned.set(u, r); invited.delete(u); addState(`${u} banni (${r})`); },
        unban: (u) => { banned.delete(u); addState(`Bannissement de ${u} levé`); },
        addMsg,
        getMsgs: () => [...msgs],
        getStates: () => [...states]
    };
}

function createGroupRegistry() {
    const groups = new Map();
    return {
        has: (n) => groups.has(n),
        get: (n) => groups.get(n),
        add: (n, o) => { const g = createGroup(n, o); groups.set(n, g); return g; },
        names: () => Array.from(groups.keys()),
        removeUserFromAll: (u) => {
            const left = [];
            for (const [n, g] of groups.entries()) {
                if (g.hasMember(u)) { g.removeMember(u, 'disconnect'); left.push(n); }
            }
            return left;
        }
    };
}
module.exports = { createGroupRegistry };
