function createRegistry() {
    const byName = new Map();
    return {
        has: (name) => byName.has(name),
        get: (name) => byName.get(name),
        add: (name, conn) => { byName.set(name, conn); },
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
