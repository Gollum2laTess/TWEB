// Client de messagerie en ligne de commande.
//   node src/client/client.js --name david
const net = require('net');
const readline = require('readline');
const yargs = require('yargs/yargs');
const kleur = require('kleur');
const debug = require('debug')('msg:client');
const { ACTIONS, LIMITS } = require('../common/constants');
const { encode, createLineReader } = require('../common/framing');
const messages = require('../common/messages');
const { parseCommand } = require('./commands');
const { formatServerMessage } = require('./display');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT, 10) || 8080;

const argv = yargs(process.argv.slice(2))
    .option('name', { alias: 'n', type: 'string', demandOption: true, describe: "Nom de l'utilisateur" })
    .strict()
    .help()
    .parse();
const name = argv.name;
debug('Nom choisi : %s', name);

const client = new net.Socket();
client.setEncoding('utf8');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.setPrompt('> ');

let welcomed = false;   // true une fois server-hello reçu

// Affiche un texte sans casser la ligne en cours de saisie, puis réaffiche l'invite
function print(text, isError) {
    if (process.stdout.isTTY) {
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
    }
    (isError ? console.error : console.log)(text);
    rl.prompt(true);
}

function sendRequest(message) {
    debug('SEND %o', message);
    client.write(encode(message));
}

const reader = createLineReader({
    maxLength: LIMITS.CLIENT_MAX_LINE_LENGTH,
    onLine: (line) => {
        debug('LINE %s', line);
        let msg;
        try {
            msg = JSON.parse(line);
        } catch (err) {
            return print(kleur.gray('Message illisible : ' + line));
        }
        if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) {
            return print(kleur.gray('Message inattendu : ' + line));
        }
        if (msg.action === ACTIONS.SERVER_HELLO) welcomed = true;
        const { text, level } = formatServerMessage(msg);
        print(text, level === 'error');
    },
    onTooLarge: () => {
        console.error(kleur.red('Ligne reçue trop longue : connexion abandonnée'));
        client.destroy();
    }
});

client.connect(PORT, HOST, () => {
    console.log('Connecté à ' + HOST + ':' + PORT);
    sendRequest(messages.clientHello(name));   // présentation, dès la connexion
});

client.on('data', (chunk) => reader.feed(chunk));

client.on('error', (err) => {
    console.error('Erreur réseau : ' + err.message);
    process.exit(1);
});

client.on('close', () => {
    console.log('Connexion fermée');
    process.exit(welcomed ? 0 : 1);
});

rl.on('line', (line) => {
    const result = parseCommand(line, name);
    switch (result.kind) {
        case 'request':
            sendRequest(result.message);
            break;
        case 'usage':
        case 'unknown':
            console.log(result.text);
            break;
    }
    rl.prompt();
});

// Ctrl+C, Ctrl+D ou fin de l'entrée : on ferme proprement notre côté de la connexion
rl.on('close', () => client.end());
