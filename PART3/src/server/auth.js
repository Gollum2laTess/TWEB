const bcrypt = require('bcrypt');
const { getUserByName, createUser } = require('./database');

const SALT_ROUNDS = 10;

async function authenticateOrCreate(name, plainPassword) {
    const user = await getUserByName(name);
    if (user) {
        const match = await bcrypt.compare(plainPassword, user.password_hash);
        if (!match) throw new Error('Mot de passe incorrect');
        return user.id;
    } else {
        const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
        const id = await createUser(name, hash);
        return id;
    }
}

module.exports = { authenticateOrCreate };
