
const net = require('net');
const debug = require('debug')('msg:server');
const { LIMITS } = require('../common/constants');
const { createLineReader } = require('../common/framing');
const { createRegistry } = require('./registry');
const { createGroupRegistry } = require('./groups'); // Ajout P2
const { handleLine, handleTooLarge, leave } = require('./handlers');

function createChatServer() {
    const registry = createRegistry();
    const groupRegistry = createGroupRegistry(); // Ajout P2

    return net.createServer((socket) => {
        const peer = socket.remoteAddress + ':' + socket.remotePort;
        const conn = { socket, peer, registry, groupRegistry, name: null, closing: false };
        debug('CONNECTED from %s', peer);

        socket.setEncoding('utf8');

        const reader = createLineReader({
            maxLength: LIMITS.MAX_LINE_LENGTH,
            onLine: (line) => handleLine(conn, line),
            onTooLarge: () => handleTooLarge(conn)
        });

        socket.on('data', (chunk) => {
            if (!conn.closing) reader.feed(chunk);
        });

        socket.on('end', () => debug('END %s', peer));
        socket.on('error', (err) => debug('ERROR socket %s : %s', peer, err.message));
        socket.on('close', () => {
            debug('CLOSED %s', peer);
            leave(conn);
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
