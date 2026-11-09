// Fragment pédagogique : ne pas exposer sur Internet.
const net = require('net');
const debug = require('debug')('msg:server');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT, 10) || 8080;

// État du serveur : nom d'utilisateur -> socket de sa connexion
const clients = new Map();

function send(socket, message) {
    socket.write(JSON.stringify(message));
}

function sendError(socket, text) {
    send(socket, { action: 'server-error', msg: text });
}

const server = net.createServer((socket) => {
    const peer = socket.remoteAddress + ':' + socket.remotePort;
    // Nom associé à CETTE connexion (null tant que le client ne s'est pas présenté).
    // L'identité vient de la socket, jamais du champ "sender" des messages suivants.
    let userName = null;
    debug('CONNECTED from %s', peer);

    socket.on('data', function(data) {
        let msg;
        try {
            msg = JSON.parse(data);
        } catch (err) {
            debug('JSON invalide depuis %s : %s', peer, data);
            return sendError(socket, 'JSON invalide');
        }
        debug('DATA received from %s: %s', peer, data);

        // Toute commande autre que la présentation exige d'être présenté
        if (userName === null && msg.action !== 'client-hello') {
            return sendError(socket, "Présentez-vous d'abord avec client-hello");
        }

        switch (msg.action) {
            case 'client-hello': {
                if (userName !== null) {
                    return sendError(socket, 'Déjà présenté sous le nom ' + userName);
                }
                const name = typeof msg.sender === 'string' ? msg.sender.trim() : '';
                if (name === '') {
                    sendError(socket, 'Nom vide');
                    return socket.end();
                }
                if (clients.has(name)) {
                    sendError(socket, 'Nom déjà utilisé : ' + name);
                    return socket.end();
                }
                userName = name;
                clients.set(userName, socket);
                debug('Utilisateurs connectés : %o', [...clients.keys()]);
                send(socket, { sender: userName, action: 'server-hello', msg: 'Bienvenue ' + userName });
                break;
            }
            case 'client-send': {
                // Champs requis : dest et msg, chaînes non vides
                if (typeof msg.dest !== 'string' || msg.dest.trim() === '' ||
                    typeof msg.msg !== 'string' || msg.msg === '') {
                    return sendError(socket, 'client-send exige les champs dest et msg (non vides)');
                }
                const dest = msg.dest.trim();
                if (dest === userName) {
                    return sendError(socket, 'Impossible de s\'envoyer un message à soi-même');
                }
                const destSocket = clients.get(dest);
                if (!destSocket) {
                    return sendError(socket, 'Destinataire absent : ' + dest);
                }
                // Le champ sender est celui de la connexion, pas celui du JSON reçu
                send(destSocket, { sender: userName, dest: dest, msg: msg.msg, action: 'server-send' });
                send(socket, { dest: dest, action: 'server-send-ack' });
                break;
            }
            case 'client-broadcast': {
                if (typeof msg.msg !== 'string' || msg.msg === '') {
                    return sendError(socket, 'client-broadcast exige le champ msg (non vide)');
                }
                // Diffusion à tous les utilisateurs présentés, sauf l'expéditeur
                let count = 0;
                for (const destSocket of clients.values()) {
                    if (destSocket !== socket) {
                        send(destSocket, { sender: userName, msg: msg.msg, action: 'server-broadcast' });
                        count++;
                    }
                }
                send(socket, { count: count, action: 'server-broadcast-ack' });
                break;
            }
            default:
                sendError(socket, 'Action inconnue : ' + msg.action);
        }
    });

    socket.on('error', (err) => debug('Erreur socket %s : %s', peer, err.message));

    // Nettoyage minimal (la gestion complète de la déconnexion est l'objet du TP 08)
    socket.on('close', () => {
        debug('CLOSED %s', peer);
        if (userName !== null && clients.get(userName) === socket) {
            clients.delete(userName);
            debug('Utilisateurs connectés : %o', [...clients.keys()]);
        }
    });
});

server.listen(PORT, HOST, () => {
    console.log('Serveur en écoute sur ' + HOST + ':' + PORT);
});