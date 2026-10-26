import React, {useState} from 'react';
import PropTypes from 'prop-types';
import Dropdown from '../common/Dropdown';
import Toggle from '../common/Toggle';
import Button from '../common/Button';
import {REQUEST_MODES, RESPONSE_MODES, SPEC_VERSIONS} from '../../constants/constants';
import {Palette, font, spacing, cardStyles} from '../../styles/palette';

const fieldLabelStyle = {
    display: 'block',
    fontSize: '12px',
    color: Palette.tertiaryText,
    marginBottom: spacing.xs + 2,
    fontFamily: font.primary,
};

export default function QrControls({
    isByValue,
    isByReference,
    selectedSpec,
    selectedResponseMode,
    isRequestSigned,
    specVersions = Object.values(SPEC_VERSIONS),
    isSigningOptional = true,
    onRequestModeChange,
    onSpecVersionChange,
    onResponseModeChange,
    onSignedChange,
    onOpenPresentationDetails,
}) {
    const [configOpen, setConfigOpen] = useState(true);

    const requestModeOptions = [
        {name: 'By Value', selected: isByValue, onChange: () => onRequestModeChange(REQUEST_MODES.BY_VALUE)},
        {name: 'By Reference', selected: isByReference, onChange: () => onRequestModeChange(REQUEST_MODES.BY_REFERENCE)},
    ];

    const specOptions = specVersions.map((v) => ({
        name: v,
        selected: selectedSpec === v,
        onChange: () => onSpecVersionChange(v),
    }));

    const responseModeOptions = Object.values(RESPONSE_MODES).map((m) => ({
        name: m,
        selected: selectedResponseMode === m,
        onChange: () => onResponseModeChange(m),
    }));

    return (
        <div style={cardStyles.base}>
            <button
                type="button"
                onClick={() => setConfigOpen(!configOpen)}
                style={{
                    ...cardStyles.accordionHeader,
                    padding: `${spacing.md + 2}px ${spacing.xl}px`,
                }}
            >
                <span style={cardStyles.sectionTitle}>Configuration</span>
                <span style={{
                    color: Palette.tertiaryText,
                    transform: configOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    fontSize: '14px',
                }}>
                    ▶
                </span>
            </button>

            {configOpen && (
                <div style={{
                    padding: `0 ${spacing.xl}px ${spacing.xl}px`,
                    borderTop: `1px solid ${Palette.borderLight}`,
                    paddingTop: spacing.lg,
                }}>
                    <div style={{marginBottom: spacing.lg}}>
                        <label style={fieldLabelStyle}>Request Mode</label>
                        <Toggle options={requestModeOptions}/>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: spacing.lg,
                        marginBottom: spacing.lg,
                    }}>
                        <div>
                            <label style={fieldLabelStyle}>OpenID4VP Spec Version</label>
                            <Dropdown options={specOptions} fullWidth/>
                        </div>
                        <div>
                            <label style={fieldLabelStyle}>Response Mode</label>
                            <Dropdown options={responseModeOptions} fullWidth light/>
                        </div>
                    </div>

                    {isByValue && isSigningOptional && (
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: spacing.sm + 2,
                            cursor: 'pointer',
                            marginBottom: spacing.lg,
                            userSelect: 'none',
                        }}>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={isRequestSigned}
                                onClick={() => onSignedChange(!isRequestSigned)}
                                style={{
                                    width: 40,
                                    height: 20,
                                    borderRadius: 10,
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    background: isRequestSigned ? Palette.surfaceDark : Palette.disabledText,
                                    position: 'relative',
                                    flexShrink: 0,
                                    transition: 'background 0.2s',
                                }}
                            >
                                <span style={{
                                    position: 'absolute',
                                    top: 2,
                                    left: isRequestSigned ? 20 : 2,
                                    width: 16,
                                    height: 16,
                                    borderRadius: '50%',
                                    background: Palette.surface,
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                    transition: 'left 0.2s',
                                }}/>
                            </button>
                            <span style={{fontSize: '12px', color: Palette.headingText, fontFamily: font.primary}}>
                                Sign the request
                            </span>
                        </label>
                    )}

                    <Button onClick={onOpenPresentationDetails} variant={'tertiary'} style={{marginTop: 10}}>
                        Edit Presentation Request Details
                    </Button>
                </div>
            )}
        </div>
    );
}

QrControls.propTypes = {
    isByValue: PropTypes.bool.isRequired,
    isByReference: PropTypes.bool.isRequired,
    selectedSpec: PropTypes.string.isRequired,
    selectedResponseMode: PropTypes.string.isRequired,
    isRequestSigned: PropTypes.bool.isRequired,
    specVersions: PropTypes.arrayOf(PropTypes.string),
    isSigningOptional: PropTypes.bool,
    onRequestModeChange: PropTypes.func.isRequired,
    onSpecVersionChange: PropTypes.func.isRequired,
    onResponseModeChange: PropTypes.func.isRequired,
    onSignedChange: PropTypes.func.isRequired,
    onOpenPresentationDetails: PropTypes.func.isRequired,
};
