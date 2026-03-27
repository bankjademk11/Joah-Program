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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-2xl px-6 animate-slide-up">
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl border-2 border-orange-200 dark:border-orange-500/30 overflow-hidden">
                {/* Orange top bar */}
                <div className="h-2 bg-gradient-to-r from-orange-400 via-amber-500 to-orange-400" />
                
                <div className="p-8 flex items-start gap-6">
                    {/* Icon */}
                    <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
                        <Sparkles size={40} className="text-orange-500 animate-pulse" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-800 dark:text-white text-2xl tracking-wide">
                            ມີເວີຊັ່ນໃໝ່ອັບເດດ!
                        </p>
                        <p className="text-lg text-slate-500 dark:text-slate-400 mt-2 font-medium">
                            ກົດປຸ່ມ "ໂຫຼດໃໝ່" ເພື່ອໃຊ້ລະບົບລ່າສຸດ
                        </p>

                        {/* Action Buttons */}
                        <div className="flex gap-4 mt-6">
                            <button
                                onClick={handleReload}
                                className="flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-lg font-black shadow-lg hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                <RefreshCw size={24} strokeWidth={2.5} />
                                ໂຫຼດໃໝ່ (Reload)
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="py-4 px-6 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shadow-sm"
                            >
                                ພາຍຫຼັງ
                            </button>
                        </div>
                    </div>

                    {/* Close */}
                    <button
                        onClick={handleDismiss}
                        className="flex-shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <X size={28} strokeWidth={2.5} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReloadPrompt;
