import React from 'react';
import elephantMascot from '../../assets/elephant_perfect_transparent_v2 (1).gif';

const LoadingOverlay = ({
    message = 'ກຳລັງເຂົ້າສູ່ລະບົບ',
    subtitle = 'JOAH Warehouse System',
    isVisible = false,
    progress = null,
    showProgressBar = true
}) => {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center mascot-overlay transition-all duration-500">
            {/* Backdrop blur layer — Dark Glassmorphism */}
            <div className="absolute inset-0 backdrop-blur-3xl bg-slate-950/60" style={{ backdropFilter: 'blur(40px) saturate(150%)' }} />

            {/* Decorative background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-orange-200/30 dark:bg-orange-500/10 blur-[80px] animate-pulse-slow" />
                <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-blue-200/30 dark:bg-blue-500/10 blur-[60px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-orange-100/20 dark:bg-orange-900/10 blur-[100px]" />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center gap-6 animate-fade-in-up">
                {/* Elephant GIF with glow */}
                <div className="mascot-bounce mascot-glow">
                    <img
                        src={elephantMascot}
                        alt="Loading Mascot"
                        className="w-44 h-44 md:w-56 md:h-56 object-contain"
                    />
                </div>

                {/* Loading Text */}ก้
                <div className="text-center space-y-2">
                    <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">
                        {message}
                        <span className="loading-dots inline-flex ml-1">
                            <span className="text-joah-orange text-3xl leading-none">.</span>
                            <span className="text-joah-orange text-3xl leading-none">.</span>
                            <span className="text-joah-orange text-3xl leading-none">.</span>
                        </span>
                    </h3>
                    <p className="text-sm text-slate-400 font-bold uppercase tracking-wider">
                        {subtitle}
                    </p>
                </div>

                {/* Progress Bar or Wave */}
                {showProgressBar && (
                    <div className="w-64 space-y-2">
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative border border-slate-700">
                            {progress !== null ? (
                                <div
                                    className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-300 ease-out rounded-full shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                                    style={{ width: `${progress}%` }}
                                />
                            ) : (
                                <div className="h-full w-full rounded-full progress-wave" />
                            )}
                        </div>
                        {progress !== null && (
                            <p className="text-right text-xs font-mono text-joah-orange font-bold animate-pulse">
                                {Math.round(progress)}%
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoadingOverlay;
