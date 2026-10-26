const crypto = require('crypto');

const ed25519PublicKey = "IKXhA7W1HD1sAl+OfG59VKAqciWrrOL1Rw5F+PGLhi4="
const ed25519PrivateKey = "7JGq310it2uq1_KZ3kARpoUB36KaVO2Ki5VeqQ_856A"
const publicKeyId = "did:web:inji.github.io:inji-mock-services:openid4vp-service:docs#key-0"
const es256PublicKey = {
    "kty": "EC",
    "crv": "P-256",
    "x": "Ggc0F4H9c4UR2ZImwYvaj-Q4tXhF-ItI5A1wPHwLaho",
    "y": "Jutz8VIfbO1RXDmViXgxj6dL1UvUimxihMG_SYP_Nsk"
}
const es256PrivateKey = {...es256PublicKey, "d": "-1RXz4yqr7vxj56iY_3NelAtKujO5_Mp1nvbrQ5p5zo"}
const es256Did = `did:jwk:${Buffer.from(JSON.stringify(es256PublicKey)).toString('base64url')}`
const es256PublicKeyId = `${es256Did}#0`
const jwkSet = {
    keys: [
        {
            "kty": "OKP",
            "crv": "Ed25519",
            "x": "-Fy3lMapzR3wpaYNCFq29GDEn_NoR3pBsc511q1Cxqw",
            "alg": "EdDSA",
            "kid": publicKeyId,
            "use": "sig"
        },
        {
            ...es256PublicKey,
            "alg": "ES256",
            "kid": es256PublicKeyId,
            "use": "sig"
        }
    ]
}
//update this baseurl with the localtunnel url (or set BASE_URL env var)
const baseUrl = process.env.BASE_URL || "http://localhost:3000"
const requestUri = `${baseUrl}/verifier/get-auth-request-obj`
const responseUri = `${baseUrl}/verifier/vp-response`
const presentationDefinitionUri  = `${baseUrl}/verifier/presentation_definition_uri`
const didDocumentUrl = "did:web:inji.github.io:inji-mock-services:openid4vp-service:docs"
const clientId  = "http://mock-verifier"
const nonce = crypto.randomBytes(16).toString('base64url');
const state = crypto.randomBytes(16).toString('base64');

const ContentTypes = {
    JWT: 'application/oauth-authz-req+jwt',
};


// enum for client_id_prefixes
const CLIENT_ID_PREFIXES = {
    PRE_REGISTERED: "pre-registered",
    REDIRECT_URI: "redirect_uri",
    DECENTRALIZED_IDENTIFIER: "decentralized_identifier",
    X509_HASH: "x509_hash"
}

// enum for the algorithm a request object is signed with
const SIGNING_ALGORITHMS = {
    EDDSA: "EdDSA",
    ES256: "ES256"
}

// enum for Spec versions
const SPEC_VERSIONS = {
    DRAFT_21: "draft-21",
    DRAFT_23: "draft-23",
    V_1_0: "version-1.0"
}

// enum for request modes
const REQUEST_MODES = {
    BY_VALUE: "by_value",
    BY_REFERENCE: "by_reference"
}

const ResponseModes = {
    DIRECT_POST: "direct_post",
    DIRECT_POST_JWT: "direct_post.jwt"
}

// enum for supporting signed request or not
const REQUEST_SIGNING_SUPPORT_MODES = {
    SIGNED_REQUEST_SUPPORTED : 'signed_request_supported',
    UNSIGNED_REQUEST_SUPPORTED : 'unsigned_request_supported',
}

module.exports = {
    baseUrl,
    nonce,
    state,
    ed25519PublicKey,
    ed25519PrivateKey,
    es256PrivateKey,
    requestUri,
    responseUri,
    didDocumentUrl,
    publicKeyId,
    es256Did,
    es256PublicKeyId,
    clientId,
    presentationDefinitionUri,
    ContentTypes,
    jwkSet,

    REQUEST_MODES,
    ResponseModes,
    CLIENT_ID_PREFIXES,
    SIGNING_ALGORITHMS,
    SPEC_VERSIONS,
    REQUEST_SIGNING_SUPPORT_MODES
};
