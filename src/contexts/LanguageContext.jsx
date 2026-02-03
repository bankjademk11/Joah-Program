import { createContext, useContext, useState, useEffect } from 'react';
import translations from '../translations';

const LanguageContext = createContext();

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return context;
};

export const LanguageProvider = ({ children }) => {
    // Load saved language or default to Lao
    const [language, setLanguage] = useState(() => {
        return localStorage.getItem('app_language') || 'lo';
    });

    // Persist language preference
    useEffect(() => {
        localStorage.setItem('app_language', language);
    }, [language]);

    const toggleLanguage = () => {
        setLanguage(prev => prev === 'lo' ? 'en' : 'lo');
    };

    const t = (key) => {
        const keys = key.split('.');
        let value = translations[language];

        for (const k of keys) {
            value = value?.[k];
            if (!value) break;
        }

        return value || key;
    };

    return (
        <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};
