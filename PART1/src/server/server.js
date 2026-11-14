// Fragment pédagogique : ne pas exposer sur Internet.
const net = require('net');
const debug = require('debug')('msg:server');
const { LIMITS } = require('../common/constants');
const { createLineReader } = require('../common/framing');
const { createRegistry } = require('./registry');
const { handleLine, handleTooLarge, leave } = require('./handlers');

// Crée un serveur de messagerie (chaque serveur a son propre état : utile pour les tests).
function createChatServer() {
    const registry = createRegistry();

    return net.createServer((socket) => {
        const peer = socket.remoteAddress + ':' + socket.remotePort;
        const conn = { socket, peer, registry, name: null, closing: false };
        debug('CONNECTED from %s', peer);

        // Texte UTF-8 : un caractère multi-octets coupé entre deux "data" est reconstitué
        socket.setEncoding('utf8');

        const reader = createLineReader({
            maxLength: LIMITS.MAX_LINE_LENGTH,
            onLine: (line) => handleLine(conn, line),
            onTooLarge: () => handleTooLarge(conn)
        });

        socket.on('data', (chunk) => {
            if (!conn.closing) reader.feed(chunk);
        });

        // "end" : le client a fini d'écrire. "error" : erreur réseau (suivie de "close").
        // "close" : toujours émis une seule fois à la fin ; c'est là qu'on nettoie.
        socket.on('end', () => debug('END %s', peer));
        socket.on('error', (err) => debug('ERROR socket %s : %s', peer, err.message));
        socket.on('close', () => {
            debug('CLOSED %s', peer);
            leave(conn);   // idempotent : sans effet si client-quit a déjà retiré l'utilisateur
        });
    });
}

module.exports = { createChatServer };

if (require.main === module) {
    const HOST = process.env.HOST || '127.0.0.1';
    const PORT = parseInt(process.env.PORT, 10) || 8080;
    const server = createChatServer();
    server.on('error', (err) => {
        console.error('Erreur serveur : ' + err.message);
        process.exit(1);
    });
    server.listen(PORT, HOST, () => {
        console.log('Serveur en écoute sur ' + HOST + ':' + PORT);
    });
}
