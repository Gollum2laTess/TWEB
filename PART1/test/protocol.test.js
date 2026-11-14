// Plan d'essais du protocole (partie 1). Chaque test annonce l'attendu AVANT l'observation :
// la ligne "Attendu" décrit le comportement exigé par la charte d'interopérabilité.
// Lancer : npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { createChatServer } = require('../src/server/server');
const { LIMITS } = require('../src/common/constants');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- Outils : un faux client qui lit les messages ligne par ligne ----------
class TestClient {
    constructor(port) {
        this.queue = [];
        this.waiters = [];
        this.buffer = '';
        this.closePromise = new Promise((resolve) => { this.onClosed = resolve; });
        this.socket = net.connect(port, '127.0.0.1');
        this.socket.setEncoding('utf8');
        this.socket.on('data', (chunk) => this.onData(chunk));
        this.socket.on('close', () => this.onClosed());
        this.socket.on('error', () => {});
    }
    onData(chunk) {
        this.buffer += chunk;
        let index;
        while ((index = this.buffer.indexOf('\n')) !== -1) {
            const line = this.buffer.slice(0, index).replace(/\r$/, '');
            this.buffer = this.buffer.slice(index + 1);
            if (line === '') continue;
            const message = JSON.parse(line);
            const waiter = this.waiters.shift();
            if (waiter) waiter(message); else this.queue.push(message);
        }
    }
    send(object) { this.socket.write(JSON.stringify(object) + '\n'); }
    raw(text) { this.socket.write(text); }
    next(ms = 1000) {
        if (this.queue.length) return Promise.resolve(this.queue.shift());
        return new Promise((resolve, reject) => {
            const waiter = (message) => { clearTimeout(timer); resolve(message); };
            const timer = setTimeout(() => {
                this.waiters = this.waiters.filter((w) => w !== waiter);
                reject(new Error('Aucun message reçu dans le délai'));
            }, ms);
            this.waiters.push(waiter);
        });
    }
    async expectNothing(ms = 150) {
        await sleep(ms);
        assert.deepEqual(this.queue, [], 'Message(s) inattendu(s) : ' + JSON.stringify(this.queue));
    }
    async expectClosed(ms = 1500) {
        await Promise.race([
            this.closePromise,
            sleep(ms).then(() => { throw new Error('La connexion devait être fermée'); })
        ]);
    }
    async login(name) {
        this.send({ sender: name, action: 'client-hello' });
        const reply = await this.next();
        assert.equal(reply.action, 'server-hello', 'hello de ' + name + ' : ' + JSON.stringify(reply));
        return reply;
    }
    async list(sender) {
        this.send({ sender, action: 'client-list-clients' });
        const reply = await this.next();
        assert.equal(reply.action, 'server-list-clients');
        return reply.clients;
    }
}

// Chaque scénario démarre un serveur neuf (état vide) et nettoie tout à la fin.
async function scenario(fn) {
    const server = createChatServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const clients = [];
    const ctx = {
        connect() { const c = new TestClient(server.address().port); clients.push(c); return c; },
        async user(name) { const c = ctx.connect(); await c.login(name); return c; }
    };
    try {
        await fn(ctx);
    } finally {
        clients.forEach((c) => c.socket.destroy());
        server.close();
    }
}

function assertError(message, code) {
    assert.equal(message.action, 'server-error', JSON.stringify(message));
    assert.equal(message.code, code, JSON.stringify(message));
    assert.equal(typeof message.msg, 'string');
}

// ---------- Présentation ----------
test('client-hello valide. Attendu : server-hello avec sender = nom et un msg', () => scenario(async ({ connect }) => {
    const a = connect();
    const reply = await a.login('alice');
    assert.equal(reply.sender, 'alice');
    assert.equal(typeof reply.msg, 'string');
}));

test("arrivée d'un client. Attendu : les AUTRES reçoivent server-user-joined, pas le nouveau", () => scenario(async ({ user }) => {
    const a = await user('alice');
    const b = await user('bob');
    assert.deepEqual(await a.next(), { user: 'bob', action: 'server-user-joined' });
    await b.expectNothing();
    await a.expectNothing();
}));

test('noms invalides. Attendu : name-empty / name-invalid puis fermeture', () => scenario(async ({ connect }) => {
    const cases = [
        [{ sender: '', action: 'client-hello' }, 'name-empty'],
        [{ sender: '   ', action: 'client-hello' }, 'name-empty'],
        [{ action: 'client-hello' }, 'name-empty'],
        [{ sender: 'a;b', action: 'client-hello' }, 'name-invalid'],
        [{ sender: 'x'.repeat(21), action: 'client-hello' }, 'name-invalid'],
        [{ sender: 42, action: 'client-hello' }, 'name-invalid']
    ];
    for (const [request, code] of cases) {
        const c = connect();
        c.send(request);
        assertError(await c.next(), code);
        await c.expectClosed();
    }
}));

test('limites du nom. Attendu : 20 caractères acceptés (émojis comptés comme 1 caractère)', () => scenario(async ({ connect }) => {
    await connect().login('x'.repeat(20));
    await connect().login('😀'.repeat(20));
}));

test("nom déjà pris. Attendu : name-taken + fermeture ; l'utilisateur d'origine reste en place", () => scenario(async ({ user, connect }) => {
    const a = await user('alice');
    const intruder = connect();
    intruder.send({ sender: 'alice', action: 'client-hello' });
    assertError(await intruder.next(), 'name-taken');
    await intruder.expectClosed();
    assert.deepEqual(await a.list('alice'), ['alice']);
    await a.expectNothing();   // l'intrus n'a jamais été présenté : aucun joined / left
}));

test('requête avant client-hello. Attendu : not-registered, connexion ouverte, rien reçu, absent de la liste', () => scenario(async ({ user, connect }) => {
    const a = await user('alice');
    const ghost = connect();
    ghost.send({ sender: 'ghost', action: 'client-list-clients' });
    assertError(await ghost.next(), 'not-registered');
    assert.deepEqual(await a.list('alice'), ['alice']);
    a.send({ sender: 'alice', msg: 'coucou', action: 'client-broadcast' });
    const ack = await a.next();
    assert.deepEqual(ack, { count: 0, action: 'server-broadcast-ack' });
    await ghost.expectNothing();
    ghost.socket.destroy();            // départ d'une connexion non présentée
    await a.expectNothing(250);        // aucun server-user-left
}));

test('second client-hello. Attendu : already-registered, le nom ne change pas', () => scenario(async ({ user }) => {
    const a = await user('alice');
    a.send({ sender: 'autre', action: 'client-hello' });
    assertError(await a.next(), 'already-registered');
    assert.deepEqual(await a.list('alice'), ['alice']);
}));

// ---------- Identité et validation ----------
test('sender différent du nom présenté. Attendu : identity-mismatch (aussi si sender absent), sans effet', () => scenario(async ({ user }) => {
    const a = await user('alice');
    const b = await user('bob');
    await a.next();   // user-joined bob
    a.send({ sender: 'bob', msg: 'usurpation', action: 'client-broadcast' });
    assertError(await a.next(), 'identity-mismatch');
    a.send({ msg: 'sans sender', action: 'client-broadcast' });
    assertError(await a.next(), 'identity-mismatch');
    await b.expectNothing();
}));

test('messages invalides. Attendu : invalid-json / invalid-message / unknown-action, la connexion reste utilisable', () => scenario(async ({ user }) => {
    const a = await user('alice');
    a.raw('{pas du json\n');
    assertError(await a.next(), 'invalid-json');
    for (const line of ['[1,2]', '42', 'null', '{"foo":1}', '{"action":42}']) {
        a.raw(line + '\n');
        assertError(await a.next(), 'invalid-message');
    }
    for (const action of ['client-dance', '__proto__', 'constructor', 'server-hello']) {
        a.send({ sender: 'alice', action });
        assertError(await a.next(), 'unknown-action');
    }
    a.send({ sender: 'alice', msg: 'x', action: 'client-send' });                  // dest manquant
    assertError(await a.next(), 'invalid-message');
    a.send({ sender: 'alice', dest: 'bob', msg: 42, action: 'client-send' });      // msg non textuel
    assertError(await a.next(), 'invalid-message');
    a.send({ sender: 'alice', action: 'client-broadcast' });                       // msg manquant
    assertError(await a.next(), 'invalid-message');
    assert.deepEqual(await a.list('alice'), ['alice']);
}));

test('champs inconnus et lignes vides. Attendu : ignorés', () => scenario(async ({ connect }) => {
    const a = connect();
    a.raw('\n\r\n');
    a.send({ sender: 'alice', action: 'client-hello', couleur: 'bleu', extra: [1, 2] });
    assert.equal((await a.next()).action, 'server-hello');
}));

// ---------- Message privé ----------
test("client-send. Attendu : le destinataire seul reçoit server-send, l'expéditeur reçoit server-send-ack", () => scenario(async ({ user }) => {
    const a = await user('alice');
    const b = await user('bob');
    const c = await user('carol');
    await a.next(); await a.next(); await b.next();   // événements user-joined
    a.send({ sender: 'alice', dest: 'bob', msg: 'salut; ça va ?', action: 'client-send' });
    assert.deepEqual(await a.next(), { dest: 'bob', action: 'server-send-ack' });
    assert.deepEqual(await b.next(), { sender: 'alice', dest: 'bob', msg: 'salut; ça va ?', action: 'server-send' });
    await c.expectNothing();
    await a.expectNothing();
}));

test('client-send invalide. Attendu : recipient-not-found / recipient-is-self', () => scenario(async ({ user }) => {
    const a = await user('alice');
    a.send({ sender: 'alice', dest: 'zoe', msg: 'x', action: 'client-send' });
    assertError(await a.next(), 'recipient-not-found');
    a.send({ sender: 'alice', dest: 'alice', msg: 'x', action: 'client-send' });
    assertError(await a.next(), 'recipient-is-self');
}));

// ---------- Diffusion ----------
test("client-broadcast. Attendu : tous sauf l'expéditeur reçoivent server-broadcast ; ack avec count numérique", () => scenario(async ({ user }) => {
    const a = await user('alice');
    const b = await user('bob');
    const c = await user('carol');
    await a.next(); await a.next(); await b.next();
    a.send({ sender: 'alice', msg: 'à tous', action: 'client-broadcast' });
    assert.deepEqual(await a.next(), { count: 2, action: 'server-broadcast-ack' });
    assert.deepEqual(await b.next(), { sender: 'alice', msg: 'à tous', action: 'server-broadcast' });
    assert.deepEqual(await c.next(), { sender: 'alice', msg: 'à tous', action: 'server-broadcast' });
    await a.expectNothing();
}));

// ---------- Liste ----------
test("client-list-clients. Attendu : noms dans l'ordre d'arrivée, demandeur compris ; mise à jour après arrivée et départ", () => scenario(async ({ user }) => {
    const a = await user('alice');
    assert.deepEqual(await a.list('alice'), ['alice']);
    const b = await user('bob');
    await a.next();
    assert.deepEqual(await b.list('bob'), ['alice', 'bob']);
    const c = await user('carol');
    await a.next(); await b.next();
    assert.deepEqual(await a.list('alice'), ['alice', 'bob', 'carol']);
    c.socket.destroy();
    await a.next(); await b.next();
    assert.deepEqual(await a.list('alice'), ['alice', 'bob']);
}));

// ---------- Départ ----------
test('client-quit. Attendu : server-quit puis fermeture ; les autres reçoivent UN server-user-left ; le nom redevient libre', () => scenario(async ({ user, connect }) => {
    const a = await user('alice');
    const b = await user('bob');
    await a.next();
    b.send({ sender: 'bob', action: 'client-quit' });
    const reply = await b.next();
    assert.equal(reply.action, 'server-quit');
    assert.equal(typeof reply.msg, 'string');
    await b.expectClosed();
    assert.deepEqual(await a.next(), { user: 'bob', action: 'server-user-left' });
    await a.expectNothing(300);
    await connect().login('bob');
}));

test('déconnexion brutale. Attendu : UN seul server-user-left, liste à jour', () => scenario(async ({ user }) => {
    const a = await user('alice');
    const b = await user('bob');
    await a.next();
    b.socket.destroy();
    assert.deepEqual(await a.next(), { user: 'bob', action: 'server-user-left' });
    await a.expectNothing(300);
    assert.deepEqual(await a.list('alice'), ['alice']);
}));

// ---------- Découpage du flux TCP ----------
test('message coupé en morceaux (même au milieu d\'un caractère UTF-8). Attendu : une seule réponse correcte', () => scenario(async ({ connect }) => {
    const a = connect();
    const bytes = Buffer.from(JSON.stringify({ sender: 'Zoé', action: 'client-hello' }) + '\n', 'utf8');
    const cut = bytes.indexOf(0xC3) + 1;   // entre les deux octets de "é"
    a.socket.write(bytes.subarray(0, 5));
    await sleep(30);
    a.socket.write(bytes.subarray(5, cut));
    await sleep(30);
    a.socket.write(bytes.subarray(cut));
    const reply = await a.next();
    assert.equal(reply.action, 'server-hello');
    assert.equal(reply.sender, 'Zoé');
    await a.expectNothing();
}));

test("messages regroupés dans un seul envoi (dont un incomplet). Attendu : une réponse par message, dans l'ordre", () => scenario(async ({ connect }) => {
    const a = connect();
    await a.login('alice');
    const l1 = JSON.stringify({ sender: 'alice', action: 'client-list-clients' });
    const l2 = JSON.stringify({ sender: 'alice', msg: 'x', action: 'client-broadcast' });
    const l3 = JSON.stringify({ sender: 'alice', dest: 'zoe', msg: 'x', action: 'client-send' });
    a.raw(l1 + '\n' + l2 + '\n' + l3.slice(0, 10));
    assert.equal((await a.next()).action, 'server-list-clients');
    assert.equal((await a.next()).action, 'server-broadcast-ack');
    await a.expectNothing();
    a.raw(l3.slice(10) + '\n');
    assertError(await a.next(), 'recipient-not-found');
}));

test('fin de ligne \\r\\n. Attendu : acceptée', () => scenario(async ({ connect }) => {
    const a = connect();
    a.raw(JSON.stringify({ sender: 'alice', action: 'client-hello' }) + '\r\n');
    assert.equal((await a.next()).action, 'server-hello');
}));

test('ligne de 65 536 caractères exactement (\\r puis \\n en retard). Attendu : acceptée', () => scenario(async ({ user }) => {
    const a = await user('alice');
    const base = JSON.stringify({ sender: 'alice', msg: '', action: 'client-broadcast' }).length;
    const line = JSON.stringify({ sender: 'alice', msg: 'x'.repeat(LIMITS.MAX_LINE_LENGTH - base), action: 'client-broadcast' });
    assert.equal(line.length, LIMITS.MAX_LINE_LENGTH);
    a.raw(line + '\r');
    await sleep(30);
    a.raw('\n');
    assert.deepEqual(await a.next(), { count: 0, action: 'server-broadcast-ack' });
}));

test('ligne de 65 537 caractères terminée par \\n. Attendu : message-too-large puis fermeture', () => scenario(async ({ user }) => {
    const a = await user('alice');
    const base = JSON.stringify({ sender: 'alice', msg: '', action: 'client-broadcast' }).length;
    const line = JSON.stringify({ sender: 'alice', msg: 'x'.repeat(LIMITS.MAX_LINE_LENGTH + 1 - base), action: 'client-broadcast' });
    assert.equal(line.length, LIMITS.MAX_LINE_LENGTH + 1);
    a.raw(line + '\n');
    assertError(await a.next(), 'message-too-large');
    await a.expectClosed();
}));

test('flux sans fin de ligne dépassant la limite. Attendu : message-too-large puis fermeture (mémoire bornée)', () => scenario(async ({ connect }) => {
    const a = connect();
    a.raw('x'.repeat(LIMITS.MAX_LINE_LENGTH + 10));
    assertError(await a.next(), 'message-too-large');
    await a.expectClosed();
}));
