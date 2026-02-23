import { useLanguage } from '../../contexts/LanguageContext';

const Footer = () => {
    const { t } = useLanguage();
    const currentYear = new Date().getFullYear();

    return (
        <footer className="py-5 px-6 mt-auto border-t border-slate-200 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl relative overflow-hidden">
            {/* Subtle decorative mesh */}
            <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,transparent)] dark:bg-grid-slate-700/25 pointer-events-none opacity-20"></div>

            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
                {/* Left: Brand */}
                <div className="flex items-center gap-2.5 opacity-70 hover:opacity-100 transition-opacity">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-joah-orange to-orange-600 flex items-center justify-center shadow-sm shadow-orange-500/20">
                        <span className="text-white font-black text-[9px] italic">JV</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-700 dark:text-white tracking-[0.15em] uppercase">Joah Validator</span>
                </div>

                {/* Center: Credits */}
                <div className="flex flex-col items-center md:items-start gap-0.5">
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center md:text-left">
                        Developed by <span className="text-slate-600 dark:text-slate-300 font-black">JOAH ❤️ Santisouk Laxayphone</span>
                    </p>
                </div>

                {/* Right: Status & Copy */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">System OK</span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-300 dark:text-slate-700">|</span>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                        &copy; {currentYear}
                    </span>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
