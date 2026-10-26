const ed = require('@noble/ed25519');
const forge = require('node-forge');
const {CompactSign, importJWK} = require('jose');

const {ed25519PrivateKey, publicKeyId, es256PrivateKey, es256PublicKeyId, CLIENT_ID_PREFIXES, SIGNING_ALGORITHMS} = require("./constants");
const {createX509HashJWT} = require("./x509Hash");

const jwtHeader =   {
    "typ": "oauth-authz-req+jwt",
    "alg": "EdDSA",
    "kid": publicKeyId
}

const es256JwtHeader = {
    "typ": "oauth-authz-req+jwt",
    "alg": "ES256",
    "kid": es256PublicKeyId
}

function replaceCharactersInB64(encodedB64) {
    return encodedB64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeB64(str) {
    const encodedB64 = forge.util.encode64(str);
    return replaceCharactersInB64(encodedB64);
}

async function createSignatureED(privateKey, prehash) {
    const messageBytes = new TextEncoder().encode(prehash);
    const privateKeyUint8 = Uint8Array.from(privateKey);
    const sign = await ed.sign(messageBytes, privateKeyUint8);
    return replaceCharactersInB64(Buffer.from(sign).toString('base64'));
}


async function createJWT(payload) {

    const header64 = encodeB64(JSON.stringify(jwtHeader));
    const payLoad64 = encodeB64(JSON.stringify(payload));
    const preHash = header64 + '.' + payLoad64;
    const privateKey = Uint8Array.from(Buffer.from(ed25519PrivateKey, 'base64'));
    const signature64 = await createSignatureED(privateKey, preHash)
    return header64 + '.' + payLoad64 + '.' + signature64;

}

async function createES256JWT(payload) {
    return new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
        .setProtectedHeader(es256JwtHeader)
        .sign(await importJWK(es256PrivateKey, 'ES256'));
}

async function createRequestObjectJWT(clientIdPrefix, payload, signingAlg = SIGNING_ALGORITHMS.EDDSA) {
    if (clientIdPrefix === CLIENT_ID_PREFIXES.X509_HASH) {
        return createX509HashJWT(payload);
    }
    if (signingAlg === SIGNING_ALGORITHMS.ES256) {
        return createES256JWT(payload);
    }
    return createJWT(payload);
}

module.exports = {
    createJWT,
    createRequestObjectJWT
};
