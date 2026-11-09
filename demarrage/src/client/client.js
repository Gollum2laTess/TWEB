// Fragment pédagogique : le protocole et la gestion des erreurs sont à compléter.
const net = require('net');
const readline = require('readline');
const yargs = require('yargs/yargs');
const debug = require('debug')('msg:client');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT, 10) || 8080;

// Lecture du nom : node src/client/client.js --name david
const argv = yargs(process.argv.slice(2))
    .option('name', { alias: 'n', type: 'string', demandOption: true, describe: "Nom de l'utilisateur" })
    .strict()
    .help()
    .parse();
const name = argv.name;
debug('Nom choisi : %s', name);

const client = new net.Socket();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.setPrompt('> ');

client.connect(PORT, HOST, function() {
    console.log('Connecté à ' + HOST + ':' + PORT);
    // Présentation : premier message applicatif après la connexion
    client.write(JSON.stringify({ sender: name, action: 'client-hello' }));
});

client.on('data', function(data) {
    debug('DATA brute : %s', data);
    let msg;
    try {
        msg = JSON.parse(data);
    } catch (err) {
        console.log('Message illisible : ' + data);
        return rl.prompt();
    }
    switch (msg.action) {
        case 'server-hello':
            console.log(msg.msg);
            break;
        case 'server-send':
            console.log('[privé] ' + msg.sender + ' : ' + msg.msg);
            break;
        case 'server-broadcast':
            console.log('[tous] ' + msg.sender + ' : ' + msg.msg);
            break;
        case 'server-broadcast-ack':
            console.log('Message diffusé à ' + msg.count + ' utilisateur(s)');
            break;
        case 'server-send-ack':
            console.log('Message envoyé à ' + msg.dest);
            break;
        case 'server-error':
            console.error('Erreur : ' + msg.msg);
            break;
        default:
            console.log('Reçu : ' + data);
    }
    rl.prompt();
});

client.on('error', (err) => {
    console.error('Erreur réseau : ' + err.message);
    process.exit(1);
});

client.on('close', () => {
    console.log('Connexion fermée');
    process.exit(0);
});

// Interprète une commande utilisateur et envoie la requête JSON correspondante
function handleCommand(command) {
    const parts = command.split(';');
    switch (parts[0]) {
        case 's': {
            // s;dest;msg  (le message peut lui-même contenir des ';')
            const dest = (parts[1] || '').trim();
            const text = parts.slice(2).join(';');
            if (dest === '' || text === '') {
                console.log('Usage : s;destinataire;message');
                return;
            }
            client.write(JSON.stringify({ sender: name, dest: dest, msg: text, action: 'client-send' }));
            break;
        }
        case 'b': {
            // b;msg  (le message peut lui-même contenir des ';')
            const text = parts.slice(1).join(';');
            if (text === '') {
                console.log('Usage : b;message');
                return;
            }
            client.write(JSON.stringify({ sender: name, msg: text, action: 'client-broadcast' }));
            break;
        }
        default:
            console.log('Commande inconnue : ' + command);
    }
}

rl.on('line', (line) => {
    const command = line.trim();
    if (command !== '') {
        handleCommand(command);
    }
    rl.prompt();
});

rl.on('close', () => client.end());