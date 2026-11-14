const net = require('net');
const readline = require('readline');
const yargs = require('yargs/yargs');
const kleur = require('kleur');
const debug = require('debug')('msg:client');
const { LIMITS } = require('../common/constants');
const { encode, createLineReader } = require('../common/framing');
const { createSession } = require('../common/crypto');
const { parseCommand } = require('./commands');
const { formatServerMessage } = require('./display');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT, 10) || 8080;

const argv = yargs(process.argv.slice(2))
    .option('name', { alias: 'n', type: 'string', demandOption: true })
    .strict().help().parse();
const name = argv.name;

const client = new net.Socket();
client.setEncoding('utf8');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.setPrompt('> ');

let session = createSession();
let state = 'ECDH_START'; 

function print(text, isError) {
    if (process.stdout.isTTY) {
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
    }
    (isError ? console.error : console.log)(text);
    if (state === 'CONNECTED') rl.prompt(true);
}

const reader = createLineReader({
    maxLength: LIMITS.CLIENT_MAX_LINE_LENGTH,
    onLine: (line) => {
        const rawMsg = JSON.parse(line);
        
        if (state === 'ECDH_START') {
            if (rawMsg.action === 'ecdh' && rawMsg.publicKey) {
                session.computeSecret(rawMsg.publicKey, true);
                state = 'AUTH_WAIT';
                console.log(kleur.gray('Canal sécurisé AES-256 établi.'));
                
                rl.question('Mot de passe : ', (password) => {
                    const authMsg = session.encrypt({ action: 'auth', name, password });
                    client.write(encode(authMsg));
                });
            } else {
                console.error("Échec ECDH");
                client.destroy();
            }
            return;
        }
        
        try {
            const msg = session.decrypt(rawMsg);
            
            if (state === 'AUTH_WAIT') {
                if (msg.action === 'auth-success') {
                    state = 'CONNECTED';
                    if (msg.history && msg.history.length > 0) {
                        console.log(kleur.gray('--- Historique ---'));
                        msg.history.forEach(h => {
                            const pastMsg = JSON.parse(h.body);
                            const { text } = formatServerMessage(pastMsg);
                            console.log(kleur.gray(h.created_at) + ' ' + text);
                        });
                        console.log(kleur.gray('------------------'));
                    }
                    rl.prompt(true);
                } else if (msg.action === 'auth-error') {
                    console.error(kleur.red('Erreur: ' + msg.msg));
                    client.destroy();
                }
                return;
            }
            
            if (state === 'CONNECTED') {
                const { text, level } = formatServerMessage(msg);
                print(text, level === 'error');
            }
        } catch (err) {
            console.error(kleur.red('Erreur de sécurité : ' + err.message));
            client.destroy();
        }
    },
    onTooLarge: () => {
        console.error(kleur.red('Ligne reçue trop longue : connexion abandonnée'));
        client.destroy();
    }
});

client.connect(PORT, HOST, () => {
    console.log(`Connexion à ${HOST}:${PORT}... Négociation ECDH en cours.`);
    client.write(encode({ action: 'ecdh', publicKey: session.getPublicKey() }));
});

client.on('data', (chunk) => reader.feed(chunk));
client.on('error', (err) => { console.error('Erreur réseau : ' + err.message); process.exit(1); });
client.on('close', () => { console.log('Connexion fermée'); process.exit(0); });

rl.on('line', (line) => {
    if (state !== 'CONNECTED') return;
    const result = parseCommand(line, name);
    switch (result.kind) {
        case 'request':
            client.write(encode(session.encrypt(result.message)));
            break;
        case 'usage':
        case 'unknown':
            console.log(result.text);
            break;
    }
    rl.prompt();
});

rl.on('close', () => client.end());
