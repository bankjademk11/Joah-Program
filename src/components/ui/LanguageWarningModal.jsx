import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Keyboard, Globe } from 'lucide-react';

const LanguageWarningModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const overlay = (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 999999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                backgroundColor: 'rgba(15,23,42,0.7)',
                backdropFilter: 'blur(8px)',
            }}
        >
            <div
                style={{
                    backgroundColor: 'white',
                    width: '100%',
                    maxWidth: '440px',
                    borderRadius: '2rem',
                    boxShadow: '0 30px 70px -10px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                    border: '2.5px solid rgba(239,68,68,0.6)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Red Header */}
                <div style={{
                    height: '8rem',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626, #b91c1c)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                }}>
                    <div style={{
                        backgroundColor: 'rgba(255,255,255,0.25)',
                        padding: '1rem',
                        borderRadius: '50%',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                    }}>
                        <Keyboard size={48} color="white" strokeWidth={1.5} />
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'white' }}>
                    {/* Badge */}
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.375rem 0.875rem',
                        borderRadius: '9999px',
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        marginBottom: '1rem',
                    }}>
                        <AlertTriangle size={15} />
                        ກວດພົບຂໍ້ຜິດພາດ / Error Detected
                    </div>

                    <h2 style={{
                        fontSize: '1.5rem',
                        fontWeight: 900,
                        color: '#1e293b',
                        marginBottom: '0.75rem',
                        lineHeight: 1.3,
                    }}>
                        ກະລຸນາປ່ຽນພາສາແປ້ນພິມ!
                    </h2>

                    <p style={{
                        color: '#64748b',
                        fontSize: '0.9rem',
                        lineHeight: 1.8,
                        marginBottom: '2rem',
                    }}>
                        ລະບົບກວດພົບການສະແກນບາໂຄດ<br/>
                        ເປັນ <strong style={{ color: '#ef4444' }}>ພາສາລາວ ຫຼື ພາສາໄທ</strong>.<br/>
                        ກະລຸນາ <strong style={{ color: '#ef4444' }}>ປ່ຽນເປັນພາສາອັງກິດ (EN)</strong><br/>
                        ກ່ອນທຳການສະແກນບາໂຄດອີກຄັ້ງ.
                    </p>

                    <button
                        onClick={onClose}
                        autoFocus
                        style={{
                            width: '100%',
                            padding: '1rem 1.5rem',
                            borderRadius: '1rem',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '1.05rem',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 8px 25px -5px rgba(239,68,68,0.5)',
                        }}
                    >
                        <Globe size={20} />
                        ຮັບຊາບ — ປ່ຽນພາສາ &amp; ສະແກນໃໝ່
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(overlay, document.body);
};

export default LanguageWarningModal;
