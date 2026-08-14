import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import {
    MapPin,
    Search,
    ScanLine,
    Package,
    Plus,
    Minus,
    Trash2,
    Send,
    CheckCircle2,
    AlertCircle,
    ShoppingBag,
    Layers,
    ArrowLeft,
    Clock,
    RefreshCw,
    Filter,
    Sparkles,
    Check,
    X,
    Loader2,
    Barcode,
    Building2,
    Camera
} from 'lucide-react';
import { useToast } from '../../ui/ToastProvider';
import BarcodeScannerModal from '../../ui/BarcodeScannerModal';
import sfxOK from '../../../assets/RequestOK.mp3';
import sfxError from '../../../assets/RequestEror.mp3';

export default function StoreRequestByRack({ onBack, currentUser, activeBranch }) {
    const toast = useToast();
    const userBranch = activeBranch || currentUser?.branch_id || 'ຕະຫຼາດລາວ';

    // ─── States ────────────────────────────────────────────────────────
    const [rackLocationInput, setRackLocationInput] = useState('');
    const [activeRack, setActiveRack] = useState('');
    const [rackProducts, setRackProducts] = useState([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'out_of_stock' | 'low_stock'
    const [searchTerm, setSearchTerm] = useState('');

    // Cart / Request List State
    const [cart, setCart] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Mobile View Tab State: 'rack' | 'cart'
    const [mobileTab, setMobileTab] = useState('rack');

    // Camera Scanner Modal State
    const [showScanner, setShowScanner] = useState(false);

    // Quantity Input Modal State
    const [qtyModalProduct, setQtyModalProduct] = useState(null);
    const [qtyModalInput, setQtyModalInput] = useState(1);

    // Recent Scanned Racks (History)
    const [recentRacks, setRecentRacks] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(`recent_racks_${userBranch}`) || '[]');
        } catch (e) {
            return [];
        }
    });

    const locationInputRef = useRef(null);
    const scanBufferRef = useRef('');
    const scanTimeoutRef = useRef(null);

    // Auto-focus location input on mount
    useEffect(() => {
        if (locationInputRef.current) {
            locationInputRef.current.focus();
        }
    }, []);

    // Save recent racks to localStorage
    const saveRecentRack = (rackName) => {
        if (!rackName) return;
        const updated = [rackName, ...recentRacks.filter(r => r !== rackName)].slice(0, 8);
        setRecentRacks(updated);
        localStorage.setItem(`recent_racks_${userBranch}`, JSON.stringify(updated));
    };

    // ─── Fetch Products in Specified Rack ──────────────────────────────
    const fetchProductsInRack = useCallback(async (locationName) => {
        const cleanRack = locationName.trim();
        if (!cleanRack) return;

        setIsLoadingProducts(true);
        setActiveRack(cleanRack);
        saveRecentRack(cleanRack);

        try {
            let query = supabase
                .from('store_inventory')
                .select('barcode_no, item_name, store_qty, shelf_location, product_tag, max_qty, sales_qty, category_1_actual, category_2_actual')
                .ilike('shelf_location', `%${cleanRack}%`);

            if (userBranch) {
                query = query.eq('branch_id', userBranch);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                setRackProducts([]);
                toast.warning(`ບໍ່ພົບສິນຄ້າຢູ່ Location/Rack: "${cleanRack}"`);
                new Audio(sfxError).play().catch(() => { });
            } else {
                const groupedMap = new Map();
                data.forEach(item => {
                    const key = item.barcode_no || item.item_name;
                    const itemQty = Number(item.store_qty) || 0;
                    const itemLocation = item.shelf_location || '';
                    if (groupedMap.has(key)) {
                        const existing = groupedMap.get(key);
                        existing.qty += itemQty;
                        if (itemLocation && !existing.rack_location.includes(itemLocation)) {
                            existing.rack_location += `, ${itemLocation}`;
                        }
                    } else {
                        groupedMap.set(key, {
                            ...item,
                            qty: itemQty,
                            rack_location: itemLocation,
                            max_qty: Number(item.max_qty) || 0
                        });
                    }
                });

                const groupedList = Array.from(groupedMap.values());
                const barcodeList = groupedList.map(g => g.barcode_no).filter(Boolean);

                // Fetch Warehouse stock from location_inventory
                let warehouseStockMap = new Map();
                if (barcodeList.length > 0) {
                    let whQuery = supabase
                        .from('location_inventory')
                        .select('barcode_no, qty')
                        .in('barcode_no', barcodeList);

                    if (userBranch) {
                        whQuery = whQuery.eq('branch_id', userBranch);
                    }

                    const { data: whData } = await whQuery;
                    (whData || []).forEach(w => {
                        const code = w.barcode_no;
                        const currentWhQty = warehouseStockMap.get(code) || 0;
                        warehouseStockMap.set(code, currentWhQty + (Number(w.qty) || 0));
                    });
                }

                // Merge warehouse_qty
                groupedList.forEach(item => {
                    item.warehouse_qty = warehouseStockMap.get(item.barcode_no) ?? 0;
                });

                // Sort: Out of stock (0) -> Low stock (1-5) -> Normal (>5)
                groupedList.sort((a, b) => a.qty - b.qty);

                setRackProducts(groupedList);
                toast.success(`ພົບສິນຄ້າ ${groupedList.length} ລາຍການ ຢູ່ Rack: ${cleanRack}`);
                new Audio(sfxOK).play().catch(() => { });
            }
        } catch (err) {
            console.error('Error fetching products by rack:', err);
            toast.error(`ເກີດຂໍ້ຜິດພາດ: ${err.message}`);
            new Audio(sfxError).play().catch(() => { });
        } finally {
            setIsLoadingProducts(false);
        }
    }, [userBranch]);

    // ─── Hardware Barcode Scanner Listener ────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (document.activeElement === locationInputRef.current) return;

            if (e.key === 'Enter') {
                const buf = scanBufferRef.current.trim();
                if (buf) {
                    setRackLocationInput(buf);
                    fetchProductsInRack(buf);
                    scanBufferRef.current = '';
                }
                if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
            } else if (e.key.length === 1) {
                scanBufferRef.current += e.key;
                if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
                scanTimeoutRef.current = setTimeout(() => {
                    scanBufferRef.current = '';
                }, 300);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [fetchProductsInRack]);

    const handleRackSubmit = (e) => {
        e.preventDefault();
        if (rackLocationInput.trim()) {
            fetchProductsInRack(rackLocationInput.trim());
        }
    };

    // ─── Qty Modal Handlers ───────────────────────────────────────────
    const openQtyModal = (product) => {
        const existingItem = cart.find(item => item.barcode === product.barcode_no);
        if (!existingItem && cart.length >= 5) {
            new Audio(sfxError).play().catch(() => { });
            toast.warning('ກະຕ່າຄຳຂໍເຕັມແລ້ວ! ສາມາດຂໍໄດ້ສູງສຸດ 5 ລາຍການ (SKU) ຕໍ່ 1 ຄັ້ງ');
            return;
        }
        setQtyModalProduct(product);
        setQtyModalInput(existingItem ? existingItem.qty : 1);
    };

    const confirmQtyModal = () => {
        if (!qtyModalProduct) return;
        const existingIndex = cart.findIndex(item => item.barcode === qtyModalProduct.barcode_no);

        if (existingIndex === -1 && cart.length >= 5) {
            new Audio(sfxError).play().catch(() => { });
            toast.warning('ກະຕ່າຄຳຂໍເຕັມແລ້ວ! ສາມາດຂໍໄດ້ສູງສຸດ 5 ລາຍການ (SKU) ຕໍ່ 1 ຄັ້ງ');
            setQtyModalProduct(null);
            return;
        }

        const validQty = Math.max(1, Number(qtyModalInput) || 1);

        setCart(prevCart => {
            if (existingIndex > -1) {
                const updated = [...prevCart];
                updated[existingIndex].qty = validQty;
                return updated;
            } else {
                return [
                    ...prevCart,
                    {
                        barcode: qtyModalProduct.barcode_no,
                        product_name: qtyModalProduct.item_name,
                        product_name_la: qtyModalProduct.item_name,
                        qty: validQty,
                        rack_location: qtyModalProduct.rack_location,
                        stock_at_request: qtyModalProduct.qty,
                        branch_id: userBranch
                    }
                ];
            }
        });

        toast.success(`ເພີ່ມ "${qtyModalProduct.item_name?.slice(0, 20)}..." ຈຳນວນ ${validQty} ເຂົ້າກະຕ່າແລ້ວ`);
        setQtyModalProduct(null);
    };

    const updateCartQty = (barcode, delta) => {
        setCart(prev =>
            prev.map(item => {
                if (item.barcode === barcode) {
                    const newQty = Math.max(1, item.qty + delta);
                    return { ...item, qty: newQty };
                }
                return item;
            })
        );
    };

    const removeFromCart = (barcode) => {
        setCart(prev => prev.filter(item => item.barcode !== barcode));
    };

    // ─── Submit Request to Supabase ────────────────────────────────────
    const handleSubmitRequest = async () => {
        if (cart.length === 0) return;
        setIsSubmitting(true);

        const now = Date.now();
        const batchId = `REQ-${now}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const userName = currentUser?.name || currentUser?.employee_id || 'Store Staff';
        const requestByStr = `${userName} (${currentUser?.id || 'N/A'}) [Rack: ${activeRack || 'N/A'}]`;

        const requestRows = cart.map(item => ({
            barcode: item.barcode,
            product_name: item.product_name,
            qty: item.qty,
            status: 'pending',
            request_by: requestByStr,
            branch_id: userBranch,
            batch_id: batchId,
            stock_at_request: item.stock_at_request,
            created_at: new Date().toISOString()
        }));

        try {
            const { error } = await supabase.from('store_requests').insert(requestRows);
            if (error) throw error;

            new Audio(sfxOK).play().catch(() => { });
            toast.success(`ສົ່ງຄຳຂໍສິນຄ້າ ${cart.length} ລາຍການ (Batch: ${batchId}) ສຳເລັດ! 🎉`);
            setCart([]);
            setMobileTab('rack');
        } catch (err) {
            console.error('Error submitting store request:', err);
            new Audio(sfxError).play().catch(() => { });
            toast.error(`ບໍ່ສາມາດສົ່ງຄຳຂໍໄດ້: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ─── Filtered and Sorted Products ─────────────────────────────────
    const filteredProducts = useMemo(() => {
        let result = rackProducts;

        if (filterStatus === 'out_of_stock') {
            result = result.filter(p => p.qty === 0);
        } else if (filterStatus === 'low_stock') {
            result = result.filter(p => p.qty > 0 && p.qty <= 5);
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(p =>
                p.barcode_no?.toLowerCase().includes(term) ||
                p.item_name?.toLowerCase().includes(term)
            );
        }

        return result;
    }, [rackProducts, filterStatus, searchTerm]);

    const rackStats = useMemo(() => {
        const total = rackProducts.length;
        const outOfStock = rackProducts.filter(p => p.qty === 0).length;
        const lowStock = rackProducts.filter(p => p.qty > 0 && p.qty <= 5).length;
        const normalStock = rackProducts.filter(p => p.qty > 5).length;
        return { total, outOfStock, lowStock, normalStock };
    }, [rackProducts]);

    // ─── RACK SEARCH & PRODUCTS PANEL JSX ─────────────────────────────
    const rackProductsPanelJSX = (
        <div className="space-y-5">
            {/* Location Search Card */}
            <div className="bg-slate-800/90 backdrop-blur-md rounded-3xl p-4 md:p-6 border border-slate-700/80 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-xs md:text-sm font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <ScanLine size={18} className="text-orange-400" />
                        <span>ສະແກນ ຫຼື ພິມ ໂລເຄຊັ້ນ / ແຣັກ (Rack Location)</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">ຕົວຢ່າງ: G01-L1-1, MFA01-1</span>
                </div>

                <form onSubmit={handleRackSubmit} className="flex gap-2">
                    <div className="relative flex-1">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400" size={20} />
                        <input
                            ref={locationInputRef}
                            type="text"
                            placeholder="ຍິງບາໂຄ້ດ ຫຼື ພິມຊື່ Rack Location..."
                            value={rackLocationInput}
                            onChange={(e) => setRackLocationInput(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-950/90 border border-slate-700 text-white font-bold placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-sm md:text-base transition-all"
                        />
                        {rackLocationInput && (
                            <button
                                type="button"
                                onClick={() => setRackLocationInput('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isLoadingProducts || !rackLocationInput.trim()}
                        className="px-5 md:px-6 py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-orange-500/20 cursor-pointer shrink-0"
                    >
                        {isLoadingProducts ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                        <span className="hidden sm:inline">ຄົ້ນຫາແຣັກ</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        className="px-4 py-3.5 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 flex items-center justify-center transition-all cursor-pointer shrink-0"
                        title="ສະແກນດ້ວຍກ້ອງມືຖື"
                    >
                        <Camera size={20} />
                    </button>
                </form>

                {/* Recent Scanned Racks Chips */}
                {recentRacks.length > 0 && (
                    <div className="pt-2 border-t border-slate-700/50">
                        <p className="text-xs text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
                            <Clock size={12} />
                            <span>ແຣັກທີ່ຄົ້ນຫາຫຼ້າສຸດ:</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {recentRacks.map(r => (
                                <button
                                    key={r}
                                    onClick={() => {
                                        setRackLocationInput(r);
                                        fetchProductsInRack(r);
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${activeRack === r
                                            ? 'bg-orange-500 text-white border-orange-400 shadow-md shadow-orange-500/20'
                                            : 'bg-slate-900/60 hover:bg-slate-700 text-slate-300 border-slate-700'
                                        }`}
                                >
                                    📍 {r}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Active Rack Products Container */}
            {activeRack && (
                <div className="bg-slate-800/90 backdrop-blur-md rounded-3xl p-4 md:p-6 border border-slate-700/80 shadow-xl space-y-4">
                    {/* Header & Filter Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/70 pb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 rounded-lg bg-orange-500/20 text-orange-400 font-mono font-black text-sm border border-orange-500/30">
                                    {activeRack}
                                </span>
                                <h2 className="text-base md:text-lg font-black text-white">ລາຍການສິນຄ້າໃນ Rack ນີ້</h2>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                ຈັດລຽງ: ສິນຄ້າໝົດ/ສະຕັອກໜ້ອຍ ຂຶ້ນກ່ອນ เพื่อให้ตัดสินใจขอเติมสินค้าได้ง่าย
                            </p>
                        </div>

                        {/* Status Filters */}
                        <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-700 gap-1 shrink-0 overflow-x-auto">
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${filterStatus === 'all'
                                        ? 'bg-orange-500 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                ທັງໝົດ ({rackStats.total})
                            </button>
                            <button
                                onClick={() => setFilterStatus('out_of_stock')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${filterStatus === 'out_of_stock'
                                        ? 'bg-red-500 text-white shadow-sm'
                                        : 'text-red-400 hover:bg-red-500/10'
                                    }`}
                            >
                                🔴 ໝົດ ({rackStats.outOfStock})
                            </button>
                            <button
                                onClick={() => setFilterStatus('low_stock')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${filterStatus === 'low_stock'
                                        ? 'bg-amber-500 text-white shadow-sm'
                                        : 'text-amber-400 hover:bg-amber-500/10'
                                    }`}
                            >
                                🟡 ໜ້ອຍ ({rackStats.lowStock})
                            </button>
                        </div>
                    </div>

                    {/* Search Input inside Rack */}
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="ຄົ້ນຫາຊື່ ຫຼື ບາໂຄ້ດໃນ Rack ນີ້..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-200 text-xs font-medium placeholder-slate-500 focus:outline-none focus:border-orange-500"
                        />
                    </div>

                    {/* Products Cards List */}
                    {isLoadingProducts ? (
                        <div className="py-16 text-center space-y-3">
                            <Loader2 size={36} className="text-orange-500 animate-spin mx-auto" />
                            <p className="text-sm font-bold text-slate-400">ກຳລັງໂຫຼດລາຍການສິນຄ້າໃນ Rack {activeRack}...</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="py-12 text-center bg-slate-950/40 rounded-2xl border border-dashed border-slate-700 p-6 space-y-2">
                            <Package size={36} className="text-slate-600 mx-auto" />
                            <p className="text-sm font-bold text-slate-300">ບໍ່ພົບລາຍການສິນຄ້າທີ່ກົງກັບຟິວເຕີ</p>
                            <p className="text-xs text-slate-500">ລອງປ່ຽນຟິວເຕີ ຫຼື ຄົ້ນຫາແຣັກອື່ນ</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                            {filteredProducts.map((product, idx) => {
                                const isOutOfStock = product.qty === 0;
                                const isLowStock = product.qty > 0 && product.qty <= 5;
                                const inCartItem = cart.find(c => c.barcode === product.barcode_no);

                                return (
                                    <div
                                        key={product.barcode_no || idx}
                                        className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${isOutOfStock
                                                ? 'bg-red-950/20 border-red-500/40 hover:border-red-500/70'
                                                : isLowStock
                                                    ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-500/70'
                                                    : 'bg-slate-950/60 border-slate-700/80 hover:border-slate-600'
                                            }`}
                                    >
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {isOutOfStock ? (
                                                    <span className="px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500/40 text-red-400 font-bold text-[10px] uppercase">
                                                        🔴 ສິນຄ້າໝົດ (0)
                                                    </span>
                                                ) : isLowStock ? (
                                                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold text-[10px] uppercase">
                                                        🟡 ສະຕັອກໜ້ອຍ ({product.qty})
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold text-[10px] uppercase">
                                                        🟢 ປົກກະຕິ ({product.qty})
                                                    </span>
                                                )}

                                                <span className="font-mono text-xs text-slate-400 font-semibold bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                                                    {product.barcode_no || 'N/A'}
                                                </span>
                                                {product.product_tag && (
                                                    <span className="text-[10px] bg-purple-500/20 border border-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded font-bold">
                                                        {product.product_tag}
                                                    </span>
                                                )}
                                            </div>

                                            <h3 className="text-sm md:text-base font-bold text-white leading-snug line-clamp-2">
                                                {product.item_name}
                                            </h3>

                                            <div className="flex items-center gap-3 text-xs text-slate-300 pt-0.5 flex-wrap">
                                                <span className="bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-700/80">
                                                    ໜ້າຮ້ານ: <strong className={isOutOfStock ? 'text-red-400 font-black' : isLowStock ? 'text-amber-400 font-black' : 'text-emerald-400 font-black'}>{product.qty}</strong>
                                                </span>

                                                <span className={`px-2.5 py-1 rounded-lg font-bold border ${product.warehouse_qty > 0
                                                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                                                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                                    }`}>
                                                    ຢູ່ສາງ: <strong className="text-white font-black">{product.warehouse_qty}</strong> {product.warehouse_qty > 0 ? '✓ ມີຂອງ' : '✕ ໝົດ'}
                                                </span>

                                                {product.max_qty > 0 && <span className="text-slate-500 text-[11px]">(Max: {product.max_qty})</span>}
                                            </div>
                                        </div>

                                        {/* Action Button */}
                                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                            {inCartItem ? (
                                                <button
                                                    onClick={() => openQtyModal(product)}
                                                    className="flex items-center gap-2 bg-orange-500/20 border border-orange-500/40 hover:bg-orange-500/30 px-3 py-2 rounded-xl transition-all cursor-pointer"
                                                    title="ກົດເພື່ອແກ້ໄຂຈຳນວນ"
                                                >
                                                    <span className="text-xs font-bold text-orange-300">
                                                        ຂໍແລ້ວ: <strong className="text-white text-sm">{inCartItem.qty}</strong> ຫຼັກ
                                                    </span>
                                                    <Plus size={14} className="text-orange-400" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => openQtyModal(product)}
                                                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer ${isOutOfStock
                                                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
                                                            : isLowStock
                                                                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                                                                : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
                                                        }`}
                                                >
                                                    <Plus size={16} />
                                                    <span>+ ຂໍສິນຄ້ານີ້</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    // ─── CART PANEL JSX ───────────────────────────────────────────────
    const cartPanelJSX = (
        <div className="bg-slate-800/90 backdrop-blur-md rounded-3xl p-4 md:p-6 border border-slate-700/80 shadow-xl space-y-4 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                    <ShoppingBag size={20} className="text-orange-400" />
                    <h2 className="text-base md:text-lg font-black text-white">ກະຕ່າຄຳຂໍ (Request Cart)</h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 text-xs font-bold">
                    {cart.length} ລາຍການ
                </span>
            </div>

            {cart.length === 0 ? (
                <div className="my-auto py-12 text-center space-y-3 bg-slate-950/40 rounded-2xl border border-dashed border-slate-700/70 p-4">
                    <ShoppingBag size={40} className="text-slate-600 mx-auto" />
                    <p className="text-sm font-bold text-slate-400">ຍັງບໍ່ມີລາຍການຄຳຂໍສິນຄ້າ</p>
                    <p className="text-xs text-slate-500">ເລືອກສິນຄ້າຈາກ Rack ດ້ານຊ້າຍ ກົດ "+ ຂໍສິນຄ້ານີ້"</p>
                </div>
            ) : (
                <div className="flex-1 flex flex-col justify-between space-y-4 min-h-0">
                    <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
                        {cart.map(item => (
                            <div key={item.barcode} className="p-3 rounded-2xl bg-slate-950/80 border border-slate-700 space-y-2">
                                <div className="flex justify-between items-start gap-2">
                                    <h4 className="text-xs font-bold text-white leading-tight line-clamp-2">
                                        {item.product_name}
                                    </h4>
                                    <button
                                        onClick={() => removeFromCart(item.barcode)}
                                        className="text-slate-500 hover:text-red-400 p-1 shrink-0"
                                        title="ລົບລາຍການ"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                    <span className="font-mono text-[10px] text-slate-400">{item.barcode}</span>
                                    <div className="flex items-center gap-2 bg-slate-800 rounded-xl p-1 border border-slate-700">
                                        <button
                                            onClick={() => updateCartQty(item.barcode, -1)}
                                            className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white font-bold"
                                        >
                                            <Minus size={12} />
                                        </button>
                                        <span className="w-8 text-center font-black text-xs text-white">
                                            {item.qty}
                                        </span>
                                        <button
                                            onClick={() => updateCartQty(item.barcode, 1)}
                                            className="w-6 h-6 rounded-lg bg-orange-500 hover:bg-orange-600 flex items-center justify-center text-white font-bold"
                                        >
                                            <Plus size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-3 border-t border-slate-700 space-y-3 shrink-0">
                        <div className="flex justify-between items-center text-sm font-bold">
                            <span className="text-slate-400">ຈຳນວນລວມທັງໝົດ:</span>
                            <span className="text-orange-400 text-lg font-black">{cart.reduce((s, i) => s + i.qty, 0)} ຫຼັກ/ໜ່ວຍ</span>
                        </div>

                        <button
                            onClick={handleSubmitRequest}
                            disabled={isSubmitting}
                            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 disabled:opacity-50 text-white font-black text-base shadow-xl shadow-orange-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    <span>ກຳລັງສົ່ງຄຳຂໍໄປຫາສາງ...</span>
                                </>
                            ) : (
                                <>
                                    <Send size={20} />
                                    <span>ສົ່ງຄຳຂໍໄປຫາສາງ (Submit)</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div
            className="min-h-screen bg-slate-900 text-slate-100 pb-24 relative overflow-x-hidden"
            style={{ fontFamily: "'Noto Sans Lao', 'Noto Sans', sans-serif" }}
        >
            {/* Google Font Noto Sans Lao */}
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wdth,wght@100..900,100..900&display=swap" rel="stylesheet" />

            {/* Header Navbar */}
            <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800 px-4 md:px-8 py-3.5 shadow-lg">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all active:scale-95 cursor-pointer"
                                title="ກັບຄືນ"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                    <MapPin size={18} />
                                </span>
                                <h1 className="text-lg md:text-2xl font-black tracking-tight text-white">
                                    ຂໍສິນຄ້າຕາມ Rack Location
                                </h1>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                                <Building2 size={12} className="text-orange-400" />
                                <span>ສາຂາ: <strong className="text-white">{userBranch}</strong></span>
                                <span className="opacity-40">•</span>
                                <span>ຜູ້ຂໍ: <strong className="text-slate-300">{currentUser?.name || 'Staff'}</strong></span>
                            </p>
                        </div>
                    </div>

                    {/* Cart Summary Header Badge */}
                    <div className="flex items-center gap-2">
                        {cart.length > 0 && (
                            <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/40 text-orange-300 text-xs font-bold animate-pulse">
                                <ShoppingBag size={15} />
                                <span>ກະຕ່າຄຳຂໍ: <strong>{cart.reduce((s, i) => s + i.qty, 0)} ຫຼັກ</strong> ({cart.length})</span>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main responsive Container */}
            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4">

                {/* MOBILE TAB NAVIGATOR (Visible on Mobile only) */}
                <div className="md:hidden flex bg-slate-800 p-1 rounded-2xl border border-slate-700 mb-4">
                    <button
                        onClick={() => setMobileTab('rack')}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${mobileTab === 'rack'
                                ? 'bg-orange-500 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <MapPin size={14} />
                        <span>ຄົ້ນຫາ Rack</span>
                    </button>
                    <button
                        onClick={() => setMobileTab('cart')}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${mobileTab === 'cart'
                                ? 'bg-orange-500 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <ShoppingBag size={14} />
                        <span>ກະຕ່າ ({cart.length})</span>
                    </button>
                </div>

                {/* MOBILE LAYOUT SWITCHER */}
                <div className="md:hidden">
                    {mobileTab === 'rack' && rackProductsPanelJSX}
                    {mobileTab === 'cart' && <div className="min-h-[70vh]">{cartPanelJSX}</div>}
                </div>

                {/* DESKTOP 2-COLUMN LAYOUT (Visible on Desktop only) */}
                <div className="hidden md:grid grid-cols-12 gap-6 items-start">
                    <div className="col-span-7 lg:col-span-8">
                        {rackProductsPanelJSX}
                    </div>
                    <div className="col-span-5 lg:col-span-4 sticky top-20">
                        {cartPanelJSX}
                    </div>
                </div>
            </div>

            {/* Camera Barcode Scanner Modal */}
            {showScanner && (
                <BarcodeScannerModal
                    onDetected={(barcode) => {
                        setShowScanner(false);
                        setRackLocationInput(barcode);
                        fetchProductsInRack(barcode);
                    }}
                    onClose={() => setShowScanner(false)}
                />
            )}

            {/* QUANTITY INPUT POPUP MODAL */}
            {qtyModalProduct && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
                    <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl space-y-6 p-6 animate-scale-in">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-2">
                                <span className="p-2 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30">
                                    <ShoppingBag size={20} />
                                </span>
                                <h3 className="text-lg font-black text-white">ກຳນົດຈຳນວນຄຳຂໍສິນຄ້າ</h3>
                            </div>
                            <button
                                onClick={() => setQtyModalProduct(null)}
                                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 space-y-2">
                            <span className="font-mono text-xs text-orange-400 font-bold bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                                {qtyModalProduct.barcode_no}
                            </span>
                            <h4 className="text-base font-bold text-white leading-snug">
                                {qtyModalProduct.item_name}
                            </h4>
                            <div className="flex items-center gap-4 text-xs text-slate-300 pt-1">
                                <span>ໜ້າຮ້ານ: <strong className="text-amber-400 font-bold">{qtyModalProduct.qty}</strong></span>
                                <span>ຢູ່ສາງ: <strong className="text-blue-400 font-bold">{qtyModalProduct.warehouse_qty}</strong></span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block text-center">
                                ປ້ອນຈຳນວນທີ່ຕ້ອງການຂໍ (QTY)
                            </label>

                            <div className="flex items-center justify-center gap-3">
                                <button
                                    onClick={() => setQtyModalInput(prev => Math.max(1, (Number(prev) || 1) - 1))}
                                    className="w-14 h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-2xl border border-slate-700 transition-all flex items-center justify-center cursor-pointer"
                                >
                                    -
                                </button>

                                <input
                                    type="number"
                                    min="1"
                                    autoFocus
                                    value={qtyModalInput}
                                    onChange={(e) => setQtyModalInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') confirmQtyModal();
                                    }}
                                    className="w-32 h-14 bg-slate-950 border-2 border-orange-500/60 focus:border-orange-500 rounded-2xl text-center text-3xl font-black text-orange-400 outline-none shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />

                                <button
                                    onClick={() => setQtyModalInput(prev => (Number(prev) || 0) + 1)}
                                    className="w-14 h-14 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-black text-2xl transition-all flex items-center justify-center shadow-lg shadow-orange-500/20 cursor-pointer"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <button
                                onClick={() => setQtyModalProduct(null)}
                                className="flex-1 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-all cursor-pointer"
                            >
                                ຍົກເລີກ
                            </button>
                            <button
                                onClick={confirmQtyModal}
                                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-sm shadow-lg shadow-orange-500/20 transition-all active:scale-95 cursor-pointer"
                            >
                                ຕົກລົງ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
