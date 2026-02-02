import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, Plus, Minus, Send, RotateCw, CheckCircle, Clock, ShoppingCart } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useToast } from './ToastProvider';

const StoreRequest = ({ onBack, currentUser }) => {
    const [barcode, setBarcode] = useState('');
    const [product, setProduct] = useState(null);
    const [qty, setQty] = useState(1);
    const [recentRequests, setRecentRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);

    // Stats
    const [requestStats, setRequestStats] = useState({ pending: 0, accepted: 0 });

    const toast = useToast();
    const barcodeInputRef = useRef(null);

    useEffect(() => {
        fetchRecentRequests();
        const interval = setInterval(fetchRecentRequests, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    // Focus barcode input on mount
    useEffect(() => {
        if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
        }
    }, [product]);



    const handleSearch = async (e) => {
        e.preventDefault();
        if (!barcode.trim()) return;

        setIsLoading(true);
        try {
            // Find in location inventory (using barcode_no)
            const { data, error } = await supabase
                .from('location_inventory')
                .select('*')
                .eq('barcode_no', barcode.trim())
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setProduct({
                    barcode: data.barcode_no,
                    item_name: data.item_name,
                    product_name_la: data.item_name // Fallback to item_name as there might not be product_name_la in location_inventory
                });
                setQty(1);
                toast.success('ພົບຂໍ້ມູນສິນຄ້າ!');
            } else {
                setProduct(null);
                toast.error('ບໍ່ພົບສິນຄ້ານີ້ໃນລະບົບ');
            }
        } catch (err) {
            toast.error('ເກີດຂໍ້ຜິດພາດ: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendRequest = async () => {
        if (!product) return;

        setIsSending(true);
        try {
            const { error } = await supabase
                .from('store_requests')
                .insert([{
                    barcode: product.barcode,
                    product_name: product.item_name, // Use item_name directly
                    qty: qty,
                    status: 'pending',
                    request_by: currentUser?.name || 'Store Staff'
                }]);

            if (error) throw error;

            toast.success(`✅ ສົ່ງຄຳຂໍ ${product.item_name} ຈຳນວນ ${qty} ສຳເລັດ!`);

            // Convert text to speech notification if supported
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance('Request sent');
                window.speechSynthesis.speak(utterance);
            }

            // Reset form
            setProduct(null);
            setBarcode('');
            setQty(1);
            fetchRecentRequests();

            // Refocus for next scan
            if (barcodeInputRef.current) {
                barcodeInputRef.current.focus();
            }

        } catch (err) {
            toast.error('ສົ່ງຄຳຂໍບໍ່ສຳເລັດ: ' + err.message);
        } finally {
            setIsSending(false);
        }
    };

    // Recent Request Filter
    const [filter, setFilter] = useState('all');

    // Date Filter
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);

    // Fetch with Date Filter
    const fetchRecentRequests = async () => {
        try {
            let query = supabase
                .from('store_requests')
                .select('*')
                .order('created_at', { ascending: false });

            // Apply Date Filter
            if (startDate && endDate) {
                query = query
                    .gte('created_at', `${startDate}T00:00:00`)
                    .lte('created_at', `${endDate}T23:59:59`);
            } else {
                query = query.limit(50);
            }

            const { data, error } = await query;

            if (error) throw error;
            setRecentRequests(data || []);

            // Calculate stats
            const pending = data.filter(r => r.status === 'pending').length;
            const accepted = data.filter(r => r.status === 'accepted').length;
            setRequestStats({ pending, accepted });

        } catch (err) {
            console.error('Error fetching requests:', err);
        }
    };

    // Refresh when dates change
    useEffect(() => {
        fetchRecentRequests();
    }, [startDate, endDate]);

    const filteredRequests = recentRequests.filter(req => {
        if (filter === 'all') return true;
        return req.status === filter;
    });

    const handleQtyChange = (e) => {
        const val = parseInt(e.target.value);
        if (!isNaN(val) && val > 0) {
            setQty(val);
        } else if (e.target.value === '') {
            setQty('');
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto p-4 md:p-6 animate-fade-in-up flex flex-col md:flex-row gap-6 h-[calc(100vh-100px)]">

            {/* Left Column: Request Form */}
            <div className="flex-1 flex flex-col gap-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 shadow-sm border border-slate-100 dark:border-slate-700"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Store Request</h1>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">ລະບົບຂໍສິນຄ້າໜ້າຮ້ານ</p>
                    </div>
                </div>

                {/* Scan Section */}
                <div className="glass-card p-8 rounded-[2rem] flex flex-col gap-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                        <ShoppingCart size={200} />
                    </div>

                    <form onSubmit={handleSearch} className="relative z-10">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Scan Barcode / SKU</label>
                        <div className="flex gap-2">
                            <input
                                ref={barcodeInputRef}
                                type="text"
                                value={barcode}
                                onChange={(e) => setBarcode(e.target.value)}
                                placeholder="ຍິງບາໂຄດບ່ອນນີ້..."
                                className="w-full text-2xl font-bold bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:text-slate-300"
                                autoFocus
                            />
                            <button
                                type="submit"
                                className="px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-500/30 transition-all"
                            >
                                <Search size={24} />
                            </button>
                        </div>
                    </form>

                    {product && (
                        <div className="animate-scale-in bg-white dark:bg-slate-800/50 rounded-3xl p-6 border-2 border-blue-100 dark:border-blue-500/30 relative z-10">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1 line-clamp-1">{product.product_name_la || 'No Name'}</h3>
                            <p className="text-sm font-medium text-slate-500 mb-6">{product.item_name}</p>

                            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-2xl p-2 mb-6">
                                <button
                                    onClick={() => setQty(Math.max(1, (qty || 0) - 1))}
                                    className="w-12 h-12 flex items-center justify-center bg-white dark:bg-slate-800 rounded-xl shadow-sm text-slate-600 hover:text-blue-600 active:scale-90 transition-all"
                                >
                                    <Minus size={20} />
                                </button>
                                <div className="text-center flex-1">
                                    <span className="text-xs font-bold text-slate-400 uppercase mb-1 block">QTY</span>
                                    <input
                                        type="number"
                                        value={qty}
                                        onChange={handleQtyChange}
                                        className="w-full text-center text-3xl font-black text-blue-600 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                                        min="1"
                                    />
                                </div>
                                <button
                                    onClick={() => setQty((qty || 0) + 1)}
                                    className="w-12 h-12 flex items-center justify-center bg-blue-600 text-white rounded-xl shadow-blue-500/30 active:scale-90 transition-all"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>

                            <button
                                onClick={handleSendRequest}
                                disabled={isSending || !qty || qty < 1}
                                className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-black text-lg tracking-wide shadow-xl shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSending ? <RotateCw className="animate-spin" /> : <Send />}
                                <span>ສົ່ງຄຳຂໍເບີກສິນຄ້າ</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Recent Requests */}
            <div className="w-full md:w-96 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => setFilter('pending')}
                        className={`glass-card p-4 rounded-3xl flex flex-col items-center justify-center border transition-all ${filter === 'pending' ? 'bg-orange-100 border-orange-300 ring-2 ring-orange-500/20' : 'bg-orange-50/50 border-orange-100 hover:bg-orange-100/50'}`}
                    >
                        <div className="text-3xl font-black text-orange-500">{requestStats.pending}</div>
                        <div className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Pending</div>
                    </button>
                    <button
                        onClick={() => setFilter('accepted')}
                        className={`glass-card p-4 rounded-3xl flex flex-col items-center justify-center border transition-all ${filter === 'accepted' ? 'bg-emerald-100 border-emerald-300 ring-2 ring-emerald-500/20' : 'bg-emerald-50/50 border-emerald-100 hover:bg-emerald-100/50'}`}
                    >
                        <div className="text-3xl font-black text-emerald-500">{requestStats.accepted}</div>
                        <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Accepted</div>
                    </button>
                </div>

                <div className="glass-card rounded-[2.5rem] flex-1 flex flex-col overflow-hidden min-h-[400px]">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <h3 className="font-bold text-slate-800 dark:text-white">Recent Requests</h3>
                                {filter !== 'all' && (
                                    <button
                                        onClick={() => setFilter('all')}
                                        className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full uppercase hover:bg-slate-200 transition-colors"
                                    >
                                        Clear Filter
                                    </button>
                                )}
                            </div>
                            <button onClick={fetchRecentRequests} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <RotateCw size={16} className="text-slate-400" />
                            </button>
                        </div>

                        {/* Date Filter Inputs */}
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-1/2 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-1/2 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {filteredRequests.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                                <Clock size={40} />
                                <span className="text-sm font-medium">No requests yet</span>
                            </div>
                        ) : (
                            filteredRequests.map((req) => (
                                <div key={req.id} className="bg-white dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex flex-col gap-2">
                                    <div className="flex justify-between items-start">
                                        <span className="font-bold text-slate-700 dark:text-slate-200 line-clamp-2 text-sm">{req.product_name}</span>
                                        <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${req.status === 'accepted'
                                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                                            : 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
                                            }`}>
                                            {req.status}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-slate-500">
                                        <span>x {req.qty}</span>
                                        <span>{new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    {req.status === 'accepted' && (
                                        <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold mt-1 animate-pulse">
                                            <CheckCircle size={12} />
                                            <span>Staff accepted!</span>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StoreRequest;
