const {
  nonce, state, responseUri, REQUEST_MODES, SPEC_VERSIONS, REQUEST_SIGNING_SUPPORT_MODES, ResponseModes
} = require("../constants");
const {getVerifierMetadata} = require("../VerifierMetadata");
const {dcqlQuery} = require("../presentation-request/DCQLQuery");
const {x509HashClientId} = require("../x509Hash");

const x509HashAuthorizationRequestVersion1 = {
  "client_id": x509HashClientId,
  "response_type": "vp_token",
  "response_mode": "direct_post",
  "dcql_query": dcqlQuery,
  "nonce": nonce,
  "state": state,
  "response_uri": responseUri,
  "client_metadata": getVerifierMetadata(ResponseModes.DIRECT_POST, SPEC_VERSIONS.V_1_0),
}

const x509HashAuthorizationRequestParamsVersion1 = {
  "client_id": x509HashClientId,
  "request_uri_method": "post"
}

const map = {
  [REQUEST_SIGNING_SUPPORT_MODES.SIGNED_REQUEST_SUPPORTED]: true,
  [REQUEST_SIGNING_SUPPORT_MODES.UNSIGNED_REQUEST_SUPPORTED]: false,
  [REQUEST_MODES.BY_REFERENCE]: {
    [SPEC_VERSIONS.V_1_0]: x509HashAuthorizationRequestParamsVersion1,
  },
  [REQUEST_MODES.BY_VALUE]: {
    [SPEC_VERSIONS.V_1_0]: x509HashAuthorizationRequestVersion1,
  },
};

module.exports = {
  map
};
