import React, {useCallback, useEffect, useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {INJIWEB_URL} from '../constants/mockui-constants';
import {Loader} from '../components/common/Loader';
import {Palette, font, spacing} from '../styles/palette';
import {CLIENT_ID_PREFIXES, SPEC_VERSIONS, REQUEST_MODES, RESPONSE_MODES, SIGNING_ALGORITHMS} from '../constants/constants';
import {ScanResult} from '../components/scan/ScanResult';
import Error from '../components/common/Error';
import QrScreenHeader from '../components/qr/QrScreenHeader';
import QrControls from '../components/qr/QrControls';
import PresentationRequestModal from '../components/qr/PresentationRequestModal';
import QrCodeDisplay, {QrCodeCard, QrDataSections} from '../components/qr/QrCodeDisplay';
import {useQrFetch} from '../hooks/useQrFetch';
import {usePresentationRequest} from '../hooks/usePresentationRequest';
import {downloadDebugDetails} from '../utility/debugDetails';
import {isMobileLayout} from '../utility/util';

const getPageStyles = () => {
    const isMobile = isMobileLayout();
    return {
        page: {
            minHeight: '100vh',
            background: Palette.appBackground,
            fontFamily: font.primary,
            color: Palette.headingText,
            minWidth: '100vw',
        },
        content: {
            maxWidth: isMobile ? '100%' : '85%',
            margin: '0 auto',
            padding: isMobile
                ? `${spacing.xl}px ${spacing.lg}px`
                : `${spacing.xxxl}px ${spacing.xxl}px`,
            display: isMobile ? 'flex' : 'grid',
            flexDirection: isMobile ? 'column' : undefined,
            gridTemplateColumns: isMobile ? undefined : '1fr 1fr',
            columnGap: isMobile ? undefined : '2%',
            rowGap: isMobile ? spacing.lg : spacing.xl,
            gap: isMobile ? spacing.lg : spacing.xl,
            boxSizing: 'border-box',
        },
        leftColumn: {
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.xl,
            minWidth: 0,
        },
        errorContent: {
            maxWidth: 1152,
            margin: '0 auto',
            padding: `${spacing.xxxl}px ${spacing.xxl}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.xl,
        },
    };
};

const QrScreen = () => {
    const {state} = useLocation();
    const navigate = useNavigate();
    const [, setLayoutTick] = useState(0);

    // x509_hash exists only in version-1.0 and supports only signed requests, and a request by value is too large for a QR code
    const isX509Hash = state?.name === CLIENT_ID_PREFIXES.X509_HASH;
    const specVersions = isX509Hash ? [SPEC_VERSIONS.V_1_0] : Object.values(SPEC_VERSIONS);
    const [isByValue, setIsByValue] = useState(!isX509Hash);
    const [isByReference, setIsByReference] = useState(isX509Hash);
    const [selectedSpec, setSelectedSpec] = useState(Object.values(SPEC_VERSIONS)[0]);
    const [selectedResponseMode, setSelectedResponseMode] = useState(Object.values(RESPONSE_MODES)[0]);
    const [isRequestSigned, setIsRequestSigned] = useState(isX509Hash);
    const canChooseSigningAlg = state?.name === CLIENT_ID_PREFIXES.PRE_REGISTERED || state?.name === CLIENT_ID_PREFIXES.DID;
    const [selectedSigningAlg, setSelectedSigningAlg] = useState(Object.values(SIGNING_ALGORITHMS)[0]);
    const signingAlgToRequest = canChooseSigningAlg ? selectedSigningAlg : undefined;

    const selectedSpecIsV1_0 = selectedSpec === SPEC_VERSIONS.V_1_0;

    // Determine client_id_prefix based on spec version if prefix is 'did', otherwise keep the provided prefix
    const getClientIdPrefix = (clientIdPrefix, spec) => {
        if (clientIdPrefix === 'did' || clientIdPrefix === 'decentralized_identifier') {
            // If prefix is 'did', determine based on spec version
            if (spec === SPEC_VERSIONS.V_1_0) {
                return 'decentralized_identifier';
            } else {
                return 'did';
            } 
        }
        // Otherwise, keep the provided prefix as-is
        return clientIdPrefix;
    };

    const {
        qrData, qrSize, qrCodeData, inputData, actualAuthorizationRequestObject, errorMessage,
        fetchQrCodeData, resetValues,
    } = useQrFetch();

    const doFetch = useCallback((dcqlQueryOverride, presentationDefinitionOverride) =>
        fetchQrCodeData(
            getClientIdPrefix(state?.name, selectedSpec),
            isByValue ? REQUEST_MODES.BY_VALUE : REQUEST_MODES.BY_REFERENCE,
            selectedSpec,
            isRequestSigned,
            selectedResponseMode,
            dcqlQueryOverride,
            presentationDefinitionOverride,
            signingAlgToRequest,
        ),
    [fetchQrCodeData, state, isByValue, selectedSpec, isRequestSigned, selectedResponseMode, signingAlgToRequest]);

    const presentationRequest = usePresentationRequest({selectedSpecIsV1_0: selectedSpecIsV1_0, onFetch: doFetch});

    useEffect(() => {
        const dcqlQueryOverride = presentationRequest.getDcqlQueryOverride();
        const presentationDefinitionOverride = presentationRequest.getPresentationDefinitionOverride();
        if (dcqlQueryOverride === null) return;
        void doFetch(dcqlQueryOverride, presentationDefinitionOverride);
    }, [state, isByValue, isByReference, selectedSpec, fetchQrCodeData, isRequestSigned, selectedResponseMode, signingAlgToRequest]);

    useEffect(() => {
        document.title = 'Scan';
    }, []);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        const handleResize = () => setLayoutTick((tick) => tick + 1);
        mediaQuery.addEventListener('change', handleResize);
        return () => mediaQuery.removeEventListener('change', handleResize);
    }, []);

    const handleRequestModeChange = async (mode) => {
        if ((mode === REQUEST_MODES.BY_VALUE && isByValue) || (mode === REQUEST_MODES.BY_REFERENCE && isByReference)) return;
        setIsByValue(mode === REQUEST_MODES.BY_VALUE);
        setIsByReference(mode === REQUEST_MODES.BY_REFERENCE);
        resetValues();
        const dcqlQueryOverride = presentationRequest.getDcqlQueryOverride();
        if (dcqlQueryOverride === null) return;
        await fetchQrCodeData(getClientIdPrefix(state?.name, selectedSpec), mode, selectedSpec, isRequestSigned, selectedResponseMode, dcqlQueryOverride, undefined, signingAlgToRequest);
    };

    const handleSpecVersionChange = async (version) => {
        if (version === selectedSpec) return;
        setSelectedSpec(version);
        resetValues();
        const dcqlQueryOverride = (version === SPEC_VERSIONS.V_1_0 && presentationRequest.hasSubmittedDcqlQuery)
            ? presentationRequest.getDcqlQueryOverride()
            : undefined;
        if (dcqlQueryOverride === null) return;
        await fetchQrCodeData(getClientIdPrefix(state?.name, version), isByValue ? REQUEST_MODES.BY_VALUE : REQUEST_MODES.BY_REFERENCE, version, isRequestSigned, selectedResponseMode, dcqlQueryOverride, undefined, signingAlgToRequest);
    };

    const handleResponseModeChange = (mode) => {
        if (mode === selectedResponseMode) return;
        setSelectedResponseMode(mode);
        resetValues();
    };

    const handleSigningAlgChange = (alg) => {
        if (alg === selectedSigningAlg) return;
        setSelectedSigningAlg(alg);
        resetValues();
    };

    const handleOpenInjiWeb = () => {
        const strippedRequest = qrData.split('?')[1] || '';
        window.open(`${INJIWEB_URL}?${strippedRequest}`, '_blank');
    };

    const subtitle = `${getClientIdPrefix(state?.name, selectedSpec) || 'QR Code Image'} · ${selectedSpec}`;
    const styles = getPageStyles();

    const controls = (
        <QrControls
            isByValue={isByValue}
            isByReference={isByReference}
            selectedSpec={selectedSpec}
            selectedResponseMode={selectedResponseMode}
            isRequestSigned={isRequestSigned}
            specVersions={specVersions}
            isSigningOptional={!isX509Hash}
            signingAlgs={canChooseSigningAlg ? Object.values(SIGNING_ALGORITHMS) : []}
            selectedSigningAlg={selectedSigningAlg}
            onRequestModeChange={handleRequestModeChange}
            onSpecVersionChange={handleSpecVersionChange}
            onResponseModeChange={handleResponseModeChange}
            onSigningAlgChange={handleSigningAlgChange}
            onSignedChange={(isChecked) => setIsRequestSigned(isChecked)}
            onOpenPresentationDetails={presentationRequest.openPresentationRequestDetails}
        />
    );

    const presentationRequestModal = (
        <PresentationRequestModal
            isOpen={presentationRequest.showPresentationRequestDetails}
            onClose={presentationRequest.closePresentationRequestDetails}
            onSubmit={presentationRequest.submitPresentationRequestDetails}
            draftDcqlQueryValue={presentationRequest.draftDcqlQueryValue}
            onDcqlQueryChange={presentationRequest.handleDcqlQueryChange}
            draftPresentationDefinitionValue={presentationRequest.draftPresentationDefinitionValue}
            onPresentationDefinitionChange={presentationRequest.handlePresentationDefinitionChange}
            selectedSpecIsV1_0={selectedSpecIsV1_0}
            allowInvalidRequest={presentationRequest.allowInvalidDcqlRequest}
            onAllowInvalidRequestChange={presentationRequest.setAllowInvalidDcqlRequest}
        />
    );

    if (errorMessage) {
        return (
            <div style={styles.page}>
                <QrScreenHeader subtitle={subtitle} onBack={() => navigate('/')}/>
                <div style={styles.errorContent}>
                    {controls}
                    <Error message={errorMessage}/>
                </div>
                {presentationRequestModal}
            </div>
        );
    }

    if (!(qrData && qrCodeData)) {
        return (
            <div style={styles.page}>
                <QrScreenHeader subtitle={subtitle} onBack={() => navigate('/')}/>
                <Loader>Loading...</Loader>
            </div>
        );
    }

    const qrDisplayProps = {
        qrData,
        qrCodeData,
        inputData,
        actualAuthorizationRequestObject,
        isRequestSigned,
        qrSize,

        onDownloadDebugDetails: () => downloadDebugDetails(qrData, qrCodeData, inputData, actualAuthorizationRequestObject),
        onOpenInjiWeb: handleOpenInjiWeb,
    };

    const isMobile = isMobileLayout();

    return (
        <div style={styles.page}>
            <QrScreenHeader subtitle={subtitle} onBack={() => navigate('/')}/>
            <div style={styles.content}>
                <div style={styles.leftColumn}>
                    {controls}
                    {isMobile ? (
                        <QrCodeCard {...qrDisplayProps}/>
                    ) : (
                        <QrCodeDisplay {...qrDisplayProps}/>
                    )}
                </div>
                <ScanResult/>
                {isMobile && (
                    <QrDataSections
                        qrData={qrData}
                        inputData={inputData}
                        actualAuthorizationRequestObject={actualAuthorizationRequestObject}
                    />
                )}
            </div>
            {presentationRequestModal}
        </div>
    );
};

export default QrScreen;
