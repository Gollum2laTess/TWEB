// Découpage du flux TCP en messages : un objet JSON par ligne, terminé par \n
// (\r\n accepté). TCP ne garantit pas qu'un événement "data" contienne un message
// complet : un message peut être coupé, ou plusieurs peuvent arriver ensemble.

function encode(message) {
    return JSON.stringify(message) + '\n';
}

// Crée un lecteur de lignes. Les données reçues doivent être du texte :
// utiliser socket.setEncoding('utf8') pour qu'un caractère multi-octets coupé
// entre deux événements soit reconstitué correctement.
//  - onLine(ligne)  : appelé pour chaque ligne complète non vide (sans \r ni \n)
//  - onTooLarge()   : appelé une seule fois si une ligne dépasse maxLength ;
//                     le lecteur ignore ensuite toute donnée.
function createLineReader({ maxLength, onLine, onTooLarge }) {
    let buffer = '';
    let stopped = false;

    function fail() {
        stopped = true;
        buffer = '';
        onTooLarge();
    }

    return {
        feed(chunk) {
            if (stopped) return;
            buffer += chunk;
            let index;
            while ((index = buffer.indexOf('\n')) !== -1) {
                let line = buffer.slice(0, index);
                buffer = buffer.slice(index + 1);
                if (line.endsWith('\r')) line = line.slice(0, -1);
                if (line.length > maxLength) return fail();
                if (line !== '') onLine(line);   // les lignes vides sont ignorées
            }
            // Ligne incomplète : on borne la mémoire (+1 pour un \r en attente de \n)
            if (buffer.length > maxLength + 1) fail();
        }
    };
}

module.exports = { encode, createLineReader };
