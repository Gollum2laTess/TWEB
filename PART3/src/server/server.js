const net = require('net');
const debug = require('debug')('msg:server');
const { LIMITS, ERROR_CODES } = require('../common/constants');
const { encode, createLineReader } = require('../common/framing');
const { createSession } = require('../common/crypto');
const { authenticateOrCreate } = require('./auth');
const { saveMessage, getHistory } = require('./database');
const { createRegistry } = require('./registry');
const { createGroupRegistry } = require('./groups');
const { handleMessage, leave } = require('./handlers');
const messages = require('../common/messages');

function createChatServer() {
    const registry = createRegistry();
    const groupRegistry = createGroupRegistry();

    return net.createServer((socket) => {
        const peer = socket.remoteAddress + ':' + socket.remotePort;
        const conn = { socket, peer, registry, groupRegistry, name: null, userId: null, closing: false };
        conn.session = createSession();
        conn.state = 'ECDH_WAIT';
        
        conn.send = (msg) => {
            if (conn.closing || socket.destroyed || !socket.writable) return;
            
            // Historisation (Sauf les erreurs)
            if (conn.userId && msg.action !== ERROR_CODES.SERVER_ERROR) {
                saveMessage(conn.userId, msg.action, JSON.stringify(msg)).catch(e => debug("Erreur BD:", e));
            }
            
            if (conn.state === 'CONNECTED') {
                socket.write(encode(conn.session.encrypt(msg)));
            } else {
                socket.write(encode(msg));
            }
        };

        debug('CONNECTED from %s', peer);
        socket.setEncoding('utf8');

        const reader = createLineReader({
            maxLength: LIMITS.MAX_LINE_LENGTH,
            onLine: async (line) => {
                try {
                    const rawMsg = JSON.parse(line);
                    
                    if (conn.state === 'ECDH_WAIT') {
                        if (rawMsg.action === 'ecdh' && rawMsg.publicKey) {
                            conn.session.computeSecret(rawMsg.publicKey, false);
                            socket.write(encode({ action: 'ecdh', publicKey: conn.session.getPublicKey() }));
                            conn.state = 'AUTH_WAIT';
                        } else {
                            socket.destroy();
                        }
                        return;
                    }
                    
                    const decrypted = conn.session.decrypt(rawMsg);
                    
                    if (conn.state === 'AUTH_WAIT') {
                        if (decrypted.action === 'auth') {
                            try {
                                const userId = await authenticateOrCreate(decrypted.name, decrypted.password);
                                if (registry.has(decrypted.name)) {
                                    throw new Error("L'utilisateur est déjà connecté ailleurs.");
                                }
                                conn.userId = userId;
                                conn.name = decrypted.name;
                                conn.state = 'CONNECTED';
                                
                                const history = await getHistory(userId);
                                conn.send({ action: 'auth-success', history });
                                
                                registry.add(conn.name, conn);
                                conn.send(messages.serverHello(conn.name, 'Bienvenue ' + conn.name));
                                
                                for (const other of registry.all()) {
                                    if (other !== conn) other.send(messages.serverUserJoined(conn.name));
                                }
                            } catch (err) {
                                const response = conn.session.encrypt({ action: 'auth-error', msg: err.message });
                                socket.write(encode(response));
                                socket.destroy();
                            }
                        }
                        return;
                    }
                    
                    if (conn.state === 'CONNECTED') {
                        handleMessage(conn, decrypted);
                    }
                } catch (err) {
                    debug('Erreur: %s', err.message);
                    socket.destroy();
                }
            },
            onTooLarge: () => {
                socket.destroy();
            }
        });

        socket.on('data', (chunk) => {
            if (!conn.closing) reader.feed(chunk);
        });

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
    server.listen(PORT, HOST, () => {
        console.log('Serveur chiffré en écoute sur ' + HOST + ':' + PORT);
    });
}
