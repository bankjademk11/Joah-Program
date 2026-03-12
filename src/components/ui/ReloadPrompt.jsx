import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, Sparkles } from 'lucide-react';

/**
 * ReloadPrompt Component
 * แสดงแบนเนอร์แจ้งเตือนเมื่อมีเวอร์ชันใหม่ของแอปพลิเคชัน
 * พนักงานจะเห็น popup นี้โดยอัตโนมัติหลังจาก admin push code ใหม่ขึ้น Cloudflare
 */
const ReloadPrompt = () => {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('✅ Service Worker registered:', r);
            // ตรวจอัปเดตทุก 60 วินาทีในขณะที่เปิดหน้าต่างเว็บ
            if (r) {
                setInterval(() => {
                    r.update();
                }, 60 * 1000);
            }
        },
        onRegisterError(error) {
            console.warn('⚠️ Service Worker registration failed:', error);
        },
    });

    const handleReload = () => {
        updateServiceWorker(true);
    };

    const handleDismiss = () => {
        setNeedRefresh(false);
    };

    if (!needRefresh) return null;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm px-4 animate-slide-up">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-orange-200 dark:border-orange-500/30 overflow-hidden">
                {/* Orange top bar */}
                <div className="h-1 bg-gradient-to-r from-orange-400 via-amber-500 to-orange-400" />
                
                <div className="p-4 flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
                        <Sparkles size={20} className="text-orange-500 animate-pulse" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-800 dark:text-white text-sm">
                            ມີເວີຊັ່ນໃໝ່ອັບເດດ!
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            ກົດປຸ່ມ "ໂຫຼດໃໝ່" ເພື່ອໃຊ້ລະບົບລ່າສຸດ
                        </p>

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={handleReload}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-black shadow-md hover:shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                <RefreshCw size={12} />
                                ໂຫຼດໃໝ່ (Reload)
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                ພາຍຫຼັງ
                            </button>
                        </div>
                    </div>

                    {/* Close */}
                    <button
                        onClick={handleDismiss}
                        className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReloadPrompt;
