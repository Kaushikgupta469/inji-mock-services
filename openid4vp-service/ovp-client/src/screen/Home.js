import React, {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {CLIENT_ID_PREFIXES, SPEC_VERSIONS} from "../constants/constants";
import {INJIWEB_URL} from "../constants/mockui-constants";
import Button from "../components/common/Button";
import {backgroundStyle, Palette, font} from "../styles/palette";

const getResponsiveStyles = () => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    return {
        container: {
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? 8 : 3,
            alignItems: 'center',
            padding: isMobile ? 10 : 20,
            textAlign: 'start',
            background: backgroundStyle.primaryGradient,
            color: Palette.primaryText,
            font: font.primary,
            fontSize: isMobile ? '1rem' : 'large',
        },
        title: {
            fontSize: isMobile ? '2rem' : 'xxx-large',
            marginBottom: isMobile ? 0 : -10,
        },
        subtitle: {
            fontSize: isMobile ? '1.5rem' : 'xxx-large',
        },
        info: {
            justifyContent: 'start',
            maxWidth: isMobile ? '100%' : '800px',
            margin: isMobile ? '0 4px' : '0 20px',
        },
        paragraph: {
            maxWidth: isMobile ? '100%' : '600px',
        },
        ol: {
            marginTop: '10px',
            color: Palette.secondaryText,
            paddingLeft: '25px',
            fontSize: isMobile ? '1rem' : 'large',
        },
        buttonGrid: {
            display: isMobile ? 'flex' : 'grid',
            flexDirection: isMobile ? 'column' : undefined,
            margin: '10px',
            gap: isMobile ? '12px' : '18px',
            alignItems: isMobile ? 'stretch' : 'baseline',
            justifyContent: isMobile ? 'center' : 'stretch',
        },
        button: {
            fontSize: isMobile ? '1rem' : 'large',
            padding: isMobile ? '10px 0' : '12px 84px',
            width: isMobile ? '100%' : 400,
        },
        emoji: {
            cursor: 'pointer',
            marginRight: '10px',
            fontSize: isMobile ? '20px' : '24px',
        }
    };
};

const Home = () => {
    const navigate = useNavigate();
    const styles = getResponsiveStyles();
    useEffect(() => {
        document.title = 'Home';
    }, []);

    const endpoints = [
        {name: CLIENT_ID_PREFIXES.PRE_REGISTERED},
        {name: CLIENT_ID_PREFIXES.REDIRECT_URI},
        {name: CLIENT_ID_PREFIXES.DID},
        {name: CLIENT_ID_PREFIXES.X509_HASH}
    ];

    const handleClientIdPrefixClick = (endpointObj) => {
        // Default  V1
        navigate('/qr', {
            state: {
                name: endpointObj.name,
                specVersion: SPEC_VERSIONS.V_1_0,
                title: `${endpointObj.name} - ${SPEC_VERSIONS.V_1_0}`
            }
        });
    };

    const handleOpenInjiWeb = () => {
        const qrData = endpoints.map(e => e.name).join(',');
        window.open(`${INJIWEB_URL}?qrData=${qrData}`, '_blank');
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>Inji Mock Services</h1>
            <h1 style={styles.subtitle}>Mock OpenID4VP Verifier</h1>
            <div style={styles.info}>
                <p style={styles.paragraph}>
                    This is a mock verifier service for demonstration purposes.
                </p>
                <p style={{marginBottom: '15px'}}>
                    <span style={{color: Palette.primaryText, fontWeight: 'bold', fontSize: 'large'}}>
                        Supported Device flows:
                    </span>
                    <ol style={styles.ol}>
                        <li style={{marginBottom: '8px'}}>
                            <span style={{color: Palette.primaryText}}>Same device flow</span> - Click the QR code to
                            simulate same device flow
                        </li>
                        <li>
                            <span style={{color: Palette.primaryText}}>Cross device flow</span> - Scan the rendered QR
                            code from your Wallet application
                        </li>
                    </ol>
                </p>
            </div>
            <div>
                <p>Please select a Client ID Prefix / Client ID Scheme to generate an Authorization Request QR code:</p>
                <div style={styles.buttonGrid}>
                    {endpoints.map(e => (
                        <div key={e.name} style={{ display: 'flex', alignItems: 'baseline'}}>
                            <span role="img" aria-label="emoji" style={styles.emoji}>
                                {e.name === CLIENT_ID_PREFIXES.PRE_REGISTERED ? '🔐' :
                                    e.name === CLIENT_ID_PREFIXES.REDIRECT_URI ? '🔄' :
                                        e.name === CLIENT_ID_PREFIXES.X509_HASH ? '📜' : '🆔'}
                            </span>
                            <Button
                                onClick={() => handleClientIdPrefixClick(e)}
                                variant={"secondary"}
                                style={styles.button}
                            >
                                {e.name === CLIENT_ID_PREFIXES.DID ? "Decentralized Identifier / Did" : e.name}
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Home;