const { CLIENT_ID_PREFIXES } = require("./constants");
const preRegistered = require("./requestData/preRegistered");
const redirectUri = require("./requestData/redirectUri");
const did = require("./requestData/did");
const x509Hash = require("./requestData/x509Hash");

// Final map of all combinations
const finalAuthRequestMap = {
    [CLIENT_ID_PREFIXES.PRE_REGISTERED]: preRegistered.map,
    [CLIENT_ID_PREFIXES.REDIRECT_URI]: redirectUri.map,
    [CLIENT_ID_PREFIXES.DECENTRALIZED_IDENTIFIER]: did.map,
    [CLIENT_ID_PREFIXES.X509_HASH]: x509Hash.map,
}

module.exports = {
    preRegisteredAuthorizationRequest: preRegistered.preRegisteredAuthorizationRequestDraft23,
    didAuthorizationRequest: did.didAuthorizationRequestDraft23,
    redirectAuthorizationRequest: redirectUri.redirectAuthorizationRequestDraft23,
    authorizationRequestParams: did.didAuthorizationRequestParamsDraft23,

    finalAuthRequestMap
}




