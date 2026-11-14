const crypto = require('crypto');

function createSession() {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    
    let encryptKey, encryptMacKey;
    let decryptKey, decryptMacKey;
    let txSeq = 0;
    let rxSeq = 0;

    return {
        getPublicKey: () => ecdh.getPublicKey('base64'),
        computeSecret: (otherPubKeyBase64, isClient) => {
            const otherPubKey = Buffer.from(otherPubKeyBase64, 'base64');
            const sharedSecret = ecdh.computeSecret(otherPubKey);
            
            // HKDF pour dériver des clés indépendantes (128 octets au total)
            const derived = crypto.hkdfSync('sha256', sharedSecret, Buffer.alloc(0), 'messagerie-tcp', 128);
            
            // On sépare Rx et Tx pour empêcher la réflexion
            if (isClient) {
                encryptKey = derived.subarray(0, 32);
                encryptMacKey = derived.subarray(32, 64);
                decryptKey = derived.subarray(64, 96);
                decryptMacKey = derived.subarray(96, 128);
            } else {
                decryptKey = derived.subarray(0, 32);
                decryptMacKey = derived.subarray(32, 64);
                encryptKey = derived.subarray(64, 96);
                encryptMacKey = derived.subarray(96, 128);
            }
        },
        encrypt: (payloadObj) => {
            txSeq++;
            // On inclut le compteur de séquence dans le clair pour empêcher le rejeu
            const payload = JSON.stringify({ seq: txSeq, data: payloadObj });
            const iv = crypto.randomBytes(16);
            
            const cipher = crypto.createCipheriv('aes-256-cbc', encryptKey, iv);
            let encrypted = cipher.update(payload, 'utf8', 'base64');
            encrypted += cipher.final('base64');
            
            // HMAC sur IV + Cipher (Encrypt-then-MAC) pour l'intégrité
            const hmac = crypto.createHmac('sha256', encryptMacKey);
            hmac.update(iv.toString('base64') + encrypted);
            const mac = hmac.digest('base64');
            
            return { iv: iv.toString('base64'), cipher: encrypted, mac };
        },
        decrypt: (secureObj) => {
            const { iv, cipher, mac } = secureObj;
            
            // Vérification de l'intégrité
            const hmac = crypto.createHmac('sha256', decryptMacKey);
            hmac.update(iv + cipher);
            const computedMac = hmac.digest('base64');
            
            if (!crypto.timingSafeEqual(Buffer.from(mac, 'base64'), Buffer.from(computedMac, 'base64'))) {
                throw new Error("Intégrité compromise (MAC invalide)");
            }
            
            // Déchiffrement
            const decipher = crypto.createDecipheriv('aes-256-cbc', decryptKey, Buffer.from(iv, 'base64'));
            let decrypted = decipher.update(cipher, 'base64', 'utf8');
            decrypted += decipher.final('utf8');
            
            const parsed = JSON.parse(decrypted);
            
            // Vérification anti-rejeu
            if (parsed.seq <= rxSeq) {
                throw new Error("Attaque par rejeu détectée");
            }
            rxSeq = parsed.seq;
            
            return parsed.data;
        }
    };
}

module.exports = { createSession };
