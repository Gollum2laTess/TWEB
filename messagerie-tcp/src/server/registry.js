// État du serveur : utilisateurs présentés, associés à leur connexion.
// Seules les connexions présentées (client-hello accepté) sont enregistrées :
// une connexion non présentée ne reçoit rien et n'apparaît dans aucune liste.
// La Map conserve l'ordre d'insertion, donc l'ordre d'arrivée.

function createRegistry() {
    const byName = new Map();
    return {
        has: (name) => byName.has(name),
        get: (name) => byName.get(name),
        add: (name, conn) => { byName.set(name, conn); },
        // Ne retire que si le nom appartient bien à cette connexion
        remove: (name, conn) => {
            if (byName.get(name) === conn) {
                byName.delete(name);
                return true;
            }
            return false;
        },
        names: () => [...byName.keys()],
        all: () => [...byName.values()]
    };
}

module.exports = { createRegistry };
