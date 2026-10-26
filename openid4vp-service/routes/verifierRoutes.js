const QRCode = require('qrcode');
const { createRequestObjectJWT } = require('../jwt');
const defaultPresentationDefinition = require('../presentation-request/presentationDefinitionMock.json');
const { dcqlQuery: defaultDcqlQuery } = require('../presentation-request/DCQLQuery');
const {
    CLIENT_ID_PREFIXES,
    ContentTypes,
    REQUEST_MODES,
    REQUEST_SIGNING_SUPPORT_MODES,
    SIGNING_ALGORITHMS,
    SPEC_VERSIONS,
    ResponseModes,
    baseUrl,
    didDocumentUrl,
    es256Did,
} = require('../constants');
const { finalAuthRequestMap } = require('../inputData');
const { getVerifierMetadata } = require('../VerifierMetadata');
const { resolveOverrides, applyDraftOverrides } = require('../services/verifierFlow');

function createUrlWithParams(params) {
    const baseUrl = 'openid4vp://authorize';
    const paramStrings = [];

    for (const [key, value] of Object.entries(params)) {
        const encodedKey = encodeURIComponent(key);
        const valueToEncode = typeof value === 'object' ? JSON.stringify(value) : value.toString();
        const encodedValue = encodeURIComponent(valueToEncode);
        paramStrings.push(`${encodedKey}=${encodedValue}`);
    }

    return `${baseUrl}?${paramStrings.join('&')}`;
}

function buildRequestUri(baseUrl, clientIdPrefix, specVersion, responseMode, sessionId, signingAlg) {
    const requestUri = new URL(`${baseUrl}/verifier/get-auth-request-obj/${sessionId}/${clientIdPrefix}`);
    requestUri.searchParams.set('spec', specVersion);
    requestUri.searchParams.set('response_mode', responseMode);
    if (signingAlg !== SIGNING_ALGORITHMS.EDDSA) {
        requestUri.searchParams.set('signing_alg', signingAlg);
    }
    return requestUri.toString();
}

function isSupportedSigningAlg(signingAlg) {
    return Object.values(SIGNING_ALGORITHMS).includes(signingAlg);
}

function withEs256Did(inputData, clientIdPrefix, signingAlg) {
    if (clientIdPrefix !== CLIENT_ID_PREFIXES.DECENTRALIZED_IDENTIFIER || signingAlg !== SIGNING_ALGORITHMS.ES256) {
        return inputData;
    }
    return { ...inputData, client_id: inputData.client_id.replace(didDocumentUrl, es256Did) };
}

function isSupportedSpecVersion(specVersion) {
    return Object.values(SPEC_VERSIONS).includes(specVersion);
}

// Normalize client_id_prefix input and validate spec version compatibility
function normalizeClientIdPrefix(clientIdPrefixInput, currentSpecVersion) {
    let normalizedPrefix = clientIdPrefixInput;
    let specVersion = currentSpecVersion ?? SPEC_VERSIONS.V_1_0;

    if (clientIdPrefixInput === "did") {
        // "did" MUST be with draft-23 spec version
        normalizedPrefix = "decentralized_identifier";
        if (specVersion !== SPEC_VERSIONS.DRAFT_23) {
            throw new Error(`Bad Request: client_id_prefix "did" is only compatible with spec version "${SPEC_VERSIONS.DRAFT_23}", but "${specVersion}" was provided`);
        }
    } else if (clientIdPrefixInput === "decentralized_identifier") {
        // "decentralized_identifier" MUST be with version-1.0 spec version
        if (specVersion !== SPEC_VERSIONS.V_1_0) {
            throw new Error(`Bad Request: client_id_prefix "decentralized_identifier" is only compatible with spec version "${SPEC_VERSIONS.V_1_0}", but "${specVersion}" was provided`);
        }
    }

    return { normalizedPrefix, specVersion };
}

function updateVpRequest(inputData, responseMode, specVersion, byReferenceMode = false) {
    const updatedData = JSON.parse(JSON.stringify(inputData));

    updatedData.response_mode = responseMode;

    const verifierMetadata = getVerifierMetadata(responseMode, specVersion);

    if (byReferenceMode) {
        updatedData.client_metadata = verifierMetadata;
    } else {
        updatedData.client_metadata = JSON.stringify(verifierMetadata);
    }

    return updatedData;
}

async function generateQrCodeResponse(QRCode, inputData, res) {
    try {
        const qrData = createUrlWithParams(inputData);
        const qrDataBytes = Buffer.byteLength(qrData, 'utf8');
        console.info(`QR payload size: ${qrDataBytes} bytes`);
        const qrCodeData = await QRCode.toDataURL(qrData);
        res.json({ qrCodeData, qrData, inputData, qrSize: qrDataBytes });
    } catch (error) {
        if (typeof error?.message === 'string' && error.message.includes('amount of data is too big')) {
            res.status(400).send(
                'Bad Request: Authorization request is too large to fit in a QR code. ' +
                'Use request_mode=by_reference or reduce request size.'
            );
            return;
        }

        console.error('Error generating QR code:', error);
        res.status(500).send('Internal Server Error');
    }
}

function resolveWalletNonce(req) {
    if (req.body?.wallet_nonce) {
        return req.body.wallet_nonce;
    }

    if (typeof req.query?.wallet_nonce === 'string' && req.query.wallet_nonce.length > 0) {
        return req.query.wallet_nonce;
    }

    return null;
}

function registerVerifierRoutes(app, deps) {
    const {
        generateSessionId,
        storeVPRequestInSession,
        getVPRequestFromSession,
    } = deps;

    const providedCombinationIsNotSupported = 'Bad Request: Provided combination is not supported';

    const createRequestUriResponse = async (
        req,
        res,
        walletNonce = null,
        providedDcqlQuery = undefined,
        providedPresentationDefinition = undefined,
        sessionId = null
    ) => {
        try {
            // Normalize client_id_prefix and validate spec version compatibility
            const { normalizedPrefix, specVersion: normalizedSpecVersion } = normalizeClientIdPrefix(req.params.client_id_prefix, req.query.spec);
            
            let client_id_prefix = normalizedPrefix;
            let specVersion = normalizedSpecVersion;
            const responseMode = req.query.response_mode || 'direct_post';
            const signingAlg = req.query.signing_alg || SIGNING_ALGORITHMS.EDDSA;
            if (!isSupportedSigningAlg(signingAlg)) {
                res.status(400).send(`Bad Request: Unsupported signing_alg ${signingAlg}`);
                return;
            }
            const resolvedOverrides = resolveOverrides(req, providedDcqlQuery, providedPresentationDefinition);
            if (resolvedOverrides.errorMessage) {
                res.status(400).send(resolvedOverrides.errorMessage);
                return;
            }
            const dcqlOverride = resolvedOverrides.dcqlOverride;
            const presentationDefinitionOverride = resolvedOverrides.presentationDefinitionOverride;

            if (!isSupportedSpecVersion(specVersion)) {
                res.status(400).send(`Bad Request: Unsupported spec version ${specVersion}`);
                return;
            }

            const finalAuthRequestMapElement = finalAuthRequestMap[client_id_prefix];

            if (!finalAuthRequestMapElement?.[REQUEST_SIGNING_SUPPORT_MODES.SIGNED_REQUEST_SUPPORTED]) {
                res.status(400).send(`Bad Request: ${client_id_prefix} does not support signed request, so by_reference mode is not possible`);
                return;
            }

            const selectedTemplate = finalAuthRequestMapElement?.[REQUEST_MODES.BY_VALUE]?.[specVersion];
            if (!selectedTemplate) {
                console.error('Error generating JWT:', 'Provided combination is not supported - ', { client_id_prefix, specVersion });
                res.status(400).send(providedCombinationIsNotSupported);
                return;
            }
            let inputData = updateVpRequest(selectedTemplate, responseMode, specVersion, true);

            inputData = applyDraftOverrides({
                inputData,
                specVersion,
                dcqlOverride,
                presentationDefinitionOverride,
                defaultDcqlQuery,
                defaultPresentationDefinition,
                baseUrl,
                sessionId,
            });

            if (!inputData) {
                console.error('Error generating JWT:', 'Provided combination is not supported - ', {
                    client_id_prefix,
                    specVersion,
                });
                res.status(400).send(providedCombinationIsNotSupported);
                return;
            }

            inputData = withEs256Did(inputData, client_id_prefix, signingAlg);

            const jwt = walletNonce
                ? await createRequestObjectJWT(client_id_prefix, { ...inputData, wallet_nonce: walletNonce }, signingAlg)
                : await createRequestObjectJWT(client_id_prefix, inputData, signingAlg);
            res.contentType(ContentTypes.JWT);
            res.send(jwt);
        } catch (error) {
            console.error('Error generating JWT :', error);
            if (error.message === providedCombinationIsNotSupported) {
                res.status(400).send(error.message);
                return;
            }
            res.status(500).send('Internal Server Error');
        }
    };

    const generateQrCode = async (req, res) => {
        const { client_id_prefix: pathClientIdPrefix, request_mode: pathRequestMode } = req.params;
        const bodyClientIdPrefix = req.body?.client_id_prefix;
        const bodyRequestMode = req.body?.request_mode;
        let client_id_prefix = pathClientIdPrefix || bodyClientIdPrefix;
        let originalClientIdPrefix = client_id_prefix
        const request_mode = pathRequestMode || bodyRequestMode;

        const { normalizedPrefix, specVersion: normalizedSpecVersion } = normalizeClientIdPrefix(client_id_prefix, req.query.spec);

        client_id_prefix = normalizedPrefix;
        let specVersion = normalizedSpecVersion;
        const signedValue = req.method === 'POST' ? req.body?.signed : req.query.signed;
        const signed = signedValue === true || signedValue === 'true';
        const responseMode = (req.method === 'POST' ? req.body?.response_mode : req.query.response_mode) || 'direct_post';
        const signingAlg = (req.method === 'POST' ? req.body?.signing_alg : req.query.signing_alg) || SIGNING_ALGORITHMS.EDDSA;
        if (!isSupportedSigningAlg(signingAlg)) {
            res.status(400).send(`Bad Request: Unsupported signing_alg ${signingAlg}`);
            return;
        }

        const resolvedOverrides = resolveOverrides(req);
        if (resolvedOverrides.errorMessage) {
            res.status(400).send(resolvedOverrides.errorMessage);
            return;
        }

        const dcqlQueryOverride = resolvedOverrides.dcqlOverride;
        const presentationDefinitionOverride = resolvedOverrides.presentationDefinitionOverride;

        if (!specVersion) {
            specVersion = SPEC_VERSIONS.V_1_0;
        }

        if (!isSupportedSpecVersion(specVersion)) {
            res.status(400).send(`Bad Request: Unsupported spec version ${specVersion}`);
            return;
        }

        if (!client_id_prefix || !request_mode) {
            res.status(400).send('Bad Request: client_id_prefix and request_mode are required');
            return;
        }

        const sessionId = generateSessionId();

        try {
            await storeVPRequestInSession(sessionId, dcqlQueryOverride, presentationDefinitionOverride);
        } catch (error) {
            // Do not fail QR generation if transient session-store write fails.
            // Downstream URI endpoints will fallback to default values when override is missing.
            console.warn('Failed to persist VP request session data, continuing without stored overrides:', error.message);
        }

        const finalAuthRequestMapElement = finalAuthRequestMap[client_id_prefix];

        if (!finalAuthRequestMapElement) {
            console.error('Error generating QR code:', `Unsupported client_id_prefix ${client_id_prefix}`);
            res.status(400).send(`Bad Request: Unsupported client_id_prefix ${client_id_prefix}`);
            return;
        }

        if (request_mode === REQUEST_MODES.BY_REFERENCE) {
            if (!finalAuthRequestMapElement[REQUEST_SIGNING_SUPPORT_MODES.SIGNED_REQUEST_SUPPORTED]) {
                const errorMessage = `Bad Request: ${client_id_prefix} does not support signed request, so by_reference mode is not possible`;
                console.error('Error generating QR code:', errorMessage);
                res.status(400).send(errorMessage);
                return;
            }

            const inputData = finalAuthRequestMapElement?.[request_mode]?.[specVersion];
            if (!inputData) {
                console.error('Error generating QR code:', 'Provided combination is not supported - ', {
                    client_id_prefix: client_id_prefix,
                    request_mode,
                    specVersion,
                });
                res.status(400).send(providedCombinationIsNotSupported);
                return;
            }

            const updatedData = {
                ...withEs256Did(inputData, client_id_prefix, signingAlg),
                request_uri: buildRequestUri(baseUrl, originalClientIdPrefix, specVersion, responseMode, sessionId, signingAlg),
            };

            await generateQrCodeResponse(QRCode, updatedData, res);
            return;
        }

        let inputData = finalAuthRequestMapElement?.[request_mode]?.[specVersion];
        if (!inputData) {
            console.error('Error generating QR code:', 'Provided combination is not supported - ', {
                client_id_prefix: client_id_prefix,
                request_mode,
                specVersion,
            });

            res.status(400).send(providedCombinationIsNotSupported);
            return;
        }

        inputData = applyDraftOverrides({
            inputData,
            specVersion,
            dcqlOverride: dcqlQueryOverride,
            presentationDefinitionOverride,
            defaultDcqlQuery,
            defaultPresentationDefinition,
            baseUrl,
            sessionId,
        });

        if (signed) {
            if (!finalAuthRequestMapElement[REQUEST_SIGNING_SUPPORT_MODES.SIGNED_REQUEST_SUPPORTED]) {
                console.error('Error generating QR code:', `${client_id_prefix} does not support signed request`);

                res.status(400).send(`Bad Request: ${client_id_prefix} does not support ${request_mode} mode with signed request\nAction: try switching to unsigned request`);
                return;
            }

            inputData = withEs256Did(updateVpRequest(inputData, responseMode, specVersion), client_id_prefix, signingAlg);

            const clientId = inputData.client_id;
            const request = await createRequestObjectJWT(client_id_prefix, inputData, signingAlg);

            inputData = { client_id: clientId, request };
        } else if (!finalAuthRequestMapElement[REQUEST_SIGNING_SUPPORT_MODES.UNSIGNED_REQUEST_SUPPORTED]) {
            console.error('Error generating QR code:', `${client_id_prefix} does not support unsigned request`);

            res.status(400).send(`Bad Request: ${client_id_prefix} does not support unsigned request in ${request_mode} mode\nAction: try switching to signed request`);
            return;
        } else {
            inputData = updateVpRequest(inputData, responseMode, specVersion);
        }

        await generateQrCodeResponse(QRCode, inputData, res);
    };

    const handleSessionRequestUri = async (req, res) => {
        const { sessionId } = req.params;
        console.info("Recieved request to /request-uri with request body as ", JSON.stringify(req.body, null, 2))
        const walletNonce = resolveWalletNonce(req);

        const vpRequest = await getVPRequestFromSession(sessionId);
        const dcqlOverride = vpRequest?.dcqlQuery;
        const pdOverride = vpRequest?.presentationDefinition;

        await createRequestUriResponse(req, res, walletNonce, dcqlOverride, pdOverride, sessionId);
    };

    // API: /verifier/presentation-definition-uri/:sessionId
    // Returns presentation definition from session-scoped overrides when available.
    app.get('/verifier/presentation-definition-uri/:sessionId', async (req, res) => {
        const { sessionId } = req.params;

        const vpRequest = await getVPRequestFromSession(sessionId);
        const pdOverride = vpRequest?.presentationDefinition;

        res.json(pdOverride || defaultPresentationDefinition);
    });

    // Legacy API: /verifier/presentation_definition_uri
    // Backward-compatible endpoint that serves default presentation definition.
    app.get('/verifier/presentation_definition_uri', async (_req, res) => {
        res.json(defaultPresentationDefinition);
    });

    // API for actual authorization request object
    // client_id_prefix: pre-registered | redirect_uri | did (requires draft-23) | decentralized_identifier (requires version-1.0) | x509_hash (requires version-1.0)
    // API: /verifier/get-auth-request-obj/:sessionId/:client_id_prefix
    
    // Uses sessionId created during /verifier/:client_id_prefix/:request_mode request creation.
    // Resolves session-scoped overrides and returns a signed/processed request object.
    app.get('/verifier/get-auth-request-obj/:sessionId/:client_id_prefix', handleSessionRequestUri);
    app.post('/verifier/get-auth-request-obj/:sessionId/:client_id_prefix', handleSessionRequestUri);

    // API to generate QR codes for different client_id prefixes and request modes
    // API: /verifier/:client_id_prefix/:request_mode?spec=<spec_version>&signed=true|false&response_mode=<response_mode>&signing_alg=<signing_alg>
    // client_id_prefix: pre-registered | redirect_uri | did (requires draft-23) | decentralized_identifier (requires version-1.0) | x509_hash (requires version-1.0)
    // request_mode: by_value | by_reference
    // response_mode: direct_post | direct_post.jwt
    // signing_alg: EdDSA (default) | ES256, for pre-registered and did (the DID is then a did:jwk); x509_hash always signs with ES256
    app.get('/verifier/:client_id_prefix/:request_mode', async (req, res) => {
        await generateQrCode(req, res);
    });

    // API: POST /verifier/:client_id_prefix/:request_mode
    // Responsibility:
    // - Builds an authorization request for the selected verifier mode and returns QR response payload.
    // - Applies optional request overrides (dcql_query / presentation_definition) and signing options.
    // - Returns `{ qrCodeData, qrData, inputData }` on success, or a 4xx/5xx error message on failure.
    // Request params:
    // - path.client_id_prefix: pre-registered | redirect_uri | did (requires draft-23) | decentralized_identifier (requires version-1.0) | x509_hash (requires version-1.0)
    // - path.request_mode: by_value | by_reference
    // - query.spec: spec version (optional; if not provided, defaults to version-1.0
    // Request body (optional):
    // - signed: true | false
    // - response_mode: direct_post | direct_post.jwt
    // - signing_alg: EdDSA (default) | ES256
    // - dcql_query: object (spec version-1.0)
    // - presentation_definition: object (non-version-1.0 drafts)
    // Response:
    // - 200 application/json:
    //   {
    //     qrCodeData: string (data URL for rendered QR image),
    //     qrData: string (raw openid4vp://authorize URL payload),
    //     inputData: object (final verifier request used to generate qrData)
    //   }
    // - 400 text/plain for invalid combinations/unsupported params/oversized QR payload.
    // - 500 text/plain for unexpected server errors.
    app.post('/verifier/:client_id_prefix/:request_mode', async (req, res) => {
        await generateQrCode(req, res);
    });
}

module.exports = { registerVerifierRoutes };
