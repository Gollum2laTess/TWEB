function encode(message) {
    return JSON.stringify(message) + '\n';
}

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
                if (line !== '') onLine(line);
            }
            if (buffer.length > maxLength + 1) fail();
        }
    };
}
module.exports = { encode, createLineReader };
