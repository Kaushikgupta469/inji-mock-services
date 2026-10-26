import {useCallback, useState} from 'react';
import axios from 'axios';
import {BACKEND_URL} from '../constants/mockui-constants';
import {REQUEST_MODES} from '../constants/constants';

export const useQrFetch = () => {
    const [qrData, setQrData] = useState(null);
    const [inputData, setInputData] = useState(null);
    const [qrCodeData, setQrCodeData] = useState(null);
    const [actualAuthorizationRequestObject, setActualAuthorizationRequestObject] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [qrSize, setQrSize] = useState(null);

    const resetValues = useCallback(() => {
        setErrorMessage(null);
        setQrData(null);
        setQrCodeData(null);
        setActualAuthorizationRequestObject(null);
    }, []);

    const fetchQrCodeData = useCallback(async (
        clientIdPrefix,
        requestMode,
        specVersion,
        isRequestSigned = false,
        responseMode = 'direct_post',
        dcqlQueryOverride,
        presentationDefinitionOverride,
        signingAlg,
    ) => {
        try {
            const qrRequestBody = {
                signed: isRequestSigned,
                response_mode: responseMode,
            };

            if (signingAlg !== undefined) {
                qrRequestBody.signing_alg = signingAlg;
            }

            if (dcqlQueryOverride !== undefined) {
                qrRequestBody.dcql_query = dcqlQueryOverride;
            }

            if (presentationDefinitionOverride !== undefined) {
                qrRequestBody.presentation_definition = presentationDefinitionOverride;
            }

            // spec is intentionally kept as query param for backend compatibility
            const qrResponse = await axios.post(
                `${BACKEND_URL}/verifier/${clientIdPrefix}/${requestMode}?spec=${specVersion}`,
                qrRequestBody,
                {headers: {'ngrok-skip-browser-warning': 'true'}},
            );

            if (qrResponse.status !== 200) {
                setErrorMessage('Error fetching QR code data');
            }

            setQrCodeData(qrResponse.data.qrCodeData);
            setQrData(qrResponse.data.qrData);
            setQrSize(qrResponse.data.qrSize);
            const inputDataValue = qrResponse.data.inputData;
            setInputData(inputDataValue);

            if (requestMode === REQUEST_MODES.BY_REFERENCE) {
                const requestUri = inputDataValue?.request_uri;
                const requestUriMethod = inputDataValue?.request_uri_method ?? 'get';
                const uriResponse = await axios({
                    method: requestUriMethod,
                    url: requestUri,
                    data: (dcqlQueryOverride !== undefined || presentationDefinitionOverride !== undefined)
                        ? {
                            ...(dcqlQueryOverride !== undefined ? {dcql_query: dcqlQueryOverride} : {}),
                            ...(presentationDefinitionOverride !== undefined ? {presentation_definition: presentationDefinitionOverride} : {}),
                        }
                        : undefined,
                    headers: {'ngrok-skip-browser-warning': 'true'},
                });
                setActualAuthorizationRequestObject(uriResponse.data);
            }

            setErrorMessage(null);
        } catch (error) {
            setQrData(null);
            setQrCodeData(null);
            setActualAuthorizationRequestObject(null);
            console.error('Error fetching QR code data:', error);
            if (error?.response?.data) {
                setErrorMessage(error.response.data);
            } else {
                setErrorMessage(error?.message ?? 'Error fetching QR code data');
            }
        }
    }, []);

    return {
        qrData,
        qrSize,
        qrCodeData,
        inputData,
        actualAuthorizationRequestObject,
        errorMessage,
        fetchQrCodeData,
        resetValues,
    };
};
