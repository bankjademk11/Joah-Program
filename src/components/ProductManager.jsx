import { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { logInventoryHistory } from '../utils/supabaseSync';
import {
    Plus, Save, X, Edit2, Trash2, Search, Package,
    ArrowLeft, Loader2, CheckCircle, AlertCircle, Database, History, Calendar, User, ArrowRight,
    ChevronLeft, ChevronRight
} from 'lucide-react';

const ProductManager = ({ onBack, currentUser, initialBarcode }) => {
    // Basic States
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'history'

    // Form States (Moved up to be accessible by Effect)
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        barcode: '',
        product_name_la: '',
        item_name: '',
        category_1: '',
        category_2: '',
        qty: 0
    });

    useEffect(() => {
        if (initialBarcode) {
            setFormData({
                barcode: initialBarcode,
                product_name_la: '',
                item_name: '',
                category_1: '',
                category_2: '',
                qty: 0
            });
            setShowForm(true);
        }
    }, [initialBarcode]);

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [barcodeFilter, setBarcodeFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Form States
    const [editingProduct, setEditingProduct] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // History States
    const [historyLogs, setHistoryLogs] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;
    const rowRefs = useRef({});

    useEffect(() => {
        setCurrentPage(1); // Reset page on mode switch
        if (viewMode === 'list') {
            fetchProducts();
        } else {
            fetchHistory();
        }
    }, [viewMode]);

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('master_data')
                .select('*')
                .order('barcode', { ascending: true });

            if (error) throw error;
            setProducts(data || []);
        } catch (err) {
            console.error('Error fetching products:', err);
            alert('ເກີດຂໍ້ຜິດພາດໃນການໂຫຼດຂໍ້ມູນ: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('master_products_logs')
                .select('*')
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setHistoryLogs(data || []);
        } catch (err) {
            console.error('Error fetching history:', err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const logOperation = async (type, barcode, name, oldData = null, newData = null) => {
        try {
            await supabase.from('master_products_logs').insert([{
                operation_type: type,
                barcode_no: barcode,
                item_name: name,
                old_data: oldData,
                new_data: newData,
                updated_by: currentUser?.name || 'Unknown'
            }]);
        } catch (err) {
            console.error('Failed to log operation:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setCurrentPage(1);

        try {
            if (editingProduct) {
                // Update existing product
                const { error } = await supabase
                    .from('master_data')
                    .update({
                        barcode: formData.barcode,
                        product_name_la: formData.product_name_la,
                        item_name: formData.item_name,
                        category_1: formData.category_1,
                        category_2: formData.category_2,
                        qty: formData.qty,
                        updated_at: new Date().toISOString(),
                        updated_by: currentUser?.name || 'Unknown'
                    })
                    .eq('barcode', editingProduct.barcode);

                if (error) throw error;

                // Log to Inventory History if Qty or Name changed
                await logInventoryHistory({
                    barcode: formData.barcode,
                    itemName: formData.product_name_la,
                    oldQty: editingProduct.qty,
                    newQty: formData.qty,
                    updatedBy: currentUser?.name || 'Unknown'
                });

                // Log Detail to Master Logs
                await logOperation('UPDATE', formData.barcode, formData.product_name_la, editingProduct, formData);
            } else {
                // Insert new product
                const { error } = await supabase
                    .from('master_data')
                    .insert([{
                        barcode: formData.barcode,
                        product_name_la: formData.product_name_la,
                        item_name: formData.item_name,
                        category_1: formData.category_1,
                        category_2: formData.category_2,
                        qty: formData.qty,
                        updated_by: currentUser?.name || 'Unknown'
                    }]);

                if (error) throw error;

                // Log to Inventory History
                await logInventoryHistory({
                    barcode: formData.barcode,
                    itemName: formData.product_name_la,
                    oldQty: 0,
                    newQty: formData.qty,
                    updatedBy: currentUser?.name || 'Unknown'
                });

                // Log Detail to Master Logs
                await logOperation('INSERT', formData.barcode, formData.product_name_la, null, formData);
            }

            alert(`✅ ${editingProduct ? 'ອັບເດດ' : 'ເພີ່ມ'}ສິນຄ້າສຳເລັດ!`);

            resetForm();
            fetchProducts();
        } catch (err) {
            console.error('Error saving product:', err);
            alert('❌ ບໍ່ສາມາດບັນທຶກໄດ້: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (product) => {
        setEditingProduct(product);
        setFormData({
            barcode: product.barcode,
            product_name_la: product.product_name_la || '',
            item_name: product.item_name || '',
            category_1: product.category_1 || '',
            category_2: product.category_2 || '',
            qty: product.qty || 0
        });
        setShowForm(true);
    };

    const handleDelete = async (product) => {
        if (!confirm('ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບສິນຄ້ານີ້?')) return;

        try {
            const { error } = await supabase
                .from('master_data')
                .delete()
                .eq('barcode', product.barcode);

            if (error) throw error;

            // Log Delete to Master Logs
            await logOperation('DELETE', product.barcode, product.product_name_la, product, null);

            // Log to Inventory History
            await logInventoryHistory({
                barcode: product.barcode,
                itemName: product.product_name_la,
                oldQty: product.qty,
                newQty: 0,
                updatedBy: currentUser?.name || 'Unknown'
            });

            alert('✅ ລຶບສິນຄ້າສຳເລັດ!');
            fetchProducts();
        } catch (err) {
            console.error('Error deleting product:', err);
            alert('❌ ບໍ່ສາມາດລຶບໄດ້: ' + err.message);
        }
    };

    const resetForm = () => {
        setFormData({
            barcode: '',
            product_name_la: '',
            item_name: '',
            category_1: '',
            category_2: '',
            qty: 0
        });
        setEditingProduct(null);
        setShowForm(false);
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = (p.product_name_la || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.item_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.barcode || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBarcode = !barcodeFilter || (p.barcode || '').toLowerCase().includes(barcodeFilter.toLowerCase());

        // Date Check
        // Date Check (Master data might not have date fields, skipping if not present)
        const itemDate = p.created_at ? new Date(p.created_at).setHours(0, 0, 0, 0) : null;
        const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
        const end = endDate ? new Date(endDate).setHours(0, 0, 0, 0) : null;
        const matchesDate = (!start || (itemDate && itemDate >= start)) && (!end || (itemDate && itemDate <= end));

        return matchesSearch && matchesBarcode && matchesDate;
    });

    // Reset pagination on search
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, barcodeFilter, startDate, endDate]);


    // Auto-scroll logic for exact barcode search
    useEffect(() => {
        if (searchTerm && searchTerm.length >= 4) {
            const exactMatch = products.find(r => r.barcode === searchTerm);
            if (exactMatch && rowRefs.current[exactMatch.barcode]) {
                rowRefs.current[exactMatch.barcode].scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }
    }, [searchTerm, products]);

    const filteredHistory = historyLogs.filter(log => {
        const matchesSearch = (log.product_name_la || log.item_name)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.updated_by?.toLowerCase().includes(searchTerm.toLowerCase());

        const logDate = new Date(log.updated_at).setHours(0, 0, 0, 0);
        const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
        const end = endDate ? new Date(endDate).setHours(0, 0, 0, 0) : null;
        const matchesDate = (!start || logDate >= start) && (!end || logDate <= end);

        return matchesSearch && matchesDate;
    });

    const activeList = viewMode === 'list' ? filteredProducts : filteredHistory;
    const totalPages = Math.ceil(activeList.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentItems = activeList.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white">
                                {viewMode === 'list' ? 'ຈັດການສິນຄ້າ' : 'ປະຫວັດການຈັດການ'}
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
                                {viewMode === 'list' ? 'Product Management' : 'Audit Logs & History'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={() => setViewMode(viewMode === 'list' ? 'history' : 'list')}
                            className={`flex-1 md:flex-none px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2 ${viewMode === 'history'
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/20 dark:border-indigo-900'
                                : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
                                }`}
                        >
                            {viewMode === 'list' ? <History size={18} /> : <Package size={18} />}
                            <span>{viewMode === 'list' ? 'ເບິ່ງປະຫວັດ' : 'ເບິ່ງລາຍການສິນຄ້າ'}</span>
                        </button>

                        {viewMode === 'list' && (
                            <button
                                onClick={() => setShowForm(true)}
                                className="flex-1 md:flex-none btn-primary flex items-center justify-center gap-2 !py-3.5"
                            >
                                <Plus size={20} />
                                <span className="hidden sm:inline">ເພີ່ມສິນຄ້າໃໝ່</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Toolbar / Filters */}
                <div className="glass-card rounded-[2rem] p-6 mb-8 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Search */}
                        <div className="relative md:col-span-2">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ ຫຼື ບາໂຄ້ດ..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && currentItems.length === 0 && searchTerm.length >= 5) {
                                        if (window.confirm(`ບໍ່ພົບບາໂຄ້ດ [${searchTerm}], ທ່ານຕ້ອງການເພີ່ມເປັນສິນຄ້າໃໝ່ເລີຍບໍ່?`)) {
                                            setFormData({
                                                barcode: searchTerm,
                                                product_name_la: '',
                                                item_name: '',
                                                category_1: '',
                                                category_2: '',
                                                qty: 0
                                            });
                                            setEditingProduct(null);
                                            setShowForm(true);
                                        }
                                    }
                                }}
                                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-joah-orange outline-none transition-all font-bold text-sm"
                            />
                        </div>

                        {/* Date Range */}
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full pl-4 pr-2 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-joah-orange outline-none text-xs font-bold"
                                />
                                <span className="absolute -top-2 left-3 px-1 bg-white dark:bg-slate-900 text-[9px] font-black text-slate-400 uppercase">From</span>
                            </div>
                            <div className="relative flex-1">
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full pl-4 pr-2 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-joah-orange outline-none text-xs font-bold"
                                />
                                <span className="absolute -top-2 left-3 px-1 bg-white dark:bg-slate-900 text-[9px] font-black text-slate-400 uppercase">To</span>
                            </div>
                        </div>

                        {/* Barcode Specific Filter (Optional UI) */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Barcode Filter..."
                                value={barcodeFilter}
                                onChange={(e) => setBarcodeFilter(e.target.value)}
                                className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-joah-orange outline-none transition-all font-bold text-sm"
                            />
                            <span className="absolute -top-2 left-3 px-1 bg-white dark:bg-slate-900 text-[9px] font-black text-slate-400 uppercase">Barcode</span>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                {viewMode === 'list' ? (
                    isLoading ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-4">
                            <Loader2 className="animate-spin text-joah-orange" size={48} />
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Loading Products...</p>
                        </div>
                    ) : (
                        <div className="glass-card rounded-[2rem] overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b-2 border-slate-100 dark:border-slate-800">
                                        <tr>
                                            <th className="px-6 py-6 text-left text-xs sm:text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">Barcode</th>
                                            <th className="px-6 py-6 text-left text-xs sm:text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">ຊື່ສິນค้า</th>
                                            <th className="px-6 py-6 text-left text-xs sm:text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">ໝວດໝູ່ 1</th>
                                            <th className="px-6 py-6 text-left text-xs sm:text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">ໝວດໝູ່ 2</th>
                                            <th className="px-6 py-6 text-left text-xs sm:text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">ໂລເຄຊັ້ນ</th>
                                            <th className="px-6 py-6 text-center text-xs sm:text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">ຈຳນວນ</th>
                                            <th className="px-6 py-6 text-left text-xs sm:text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">Updated By</th>
                                            <th className="px-6 py-6 text-right text-xs sm:text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                        {viewMode === 'list' && currentItems.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="px-6 py-24 text-center">
                                                    <div className="flex flex-col items-center gap-6 animate-fade-in">
                                                        <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 shadow-inner">
                                                            <Package size={40} strokeWidth={1.5} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-lg font-black text-slate-800 dark:text-white">ບໍ່ພົບຂໍ້ມູນສິນຄ້າ</p>
                                                            {searchTerm.length > 0 ? (
                                                                <p className="text-sm font-bold text-slate-400">ບໍ່ພົບຜົນການຄົ້ນຫາສຳລັບ: <span className="text-joah-orange font-mono underline decoration-2 underline-offset-4">{searchTerm}</span></p>
                                                            ) : (
                                                                <p className="text-sm font-bold text-slate-400 tracking-widest uppercase">ກະລຸນາລອງຄົ້ນຫາຄືນໃໝ່ ຫຼື ເພີ່ມສິນຄ້າໃໝ່</p>
                                                            )}
                                                        </div>
                                                        {searchTerm.length >= 5 && (
                                                            <button
                                                                onClick={() => {
                                                                    setFormData({
                                                                        barcode: searchTerm,
                                                                        product_name_la: '',
                                                                        item_name: '',
                                                                        category_1: '',
                                                                        category_2: '',
                                                                        qty: 0
                                                                    });
                                                                    setEditingProduct(null);
                                                                    setShowForm(true);
                                                                }}
                                                                className="btn-primary py-4 px-10 rounded-2xl shadow-xl shadow-orange-500/20 group transform hover:scale-105 active:scale-95 transition-all"
                                                            >
                                                                <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                                                                <span className="font-black">ເພີ່ມເປັນສິນຄ້າໃໝ່ດ້ວຍບາໂຄ້ດນີ້</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            currentItems.map((product) => (
                                                <tr
                                                    key={product.barcode}
                                                    ref={el => rowRefs.current[product.barcode] = el}
                                                    className={`transition-all duration-500 group ${searchTerm === product.barcode ? 'bg-joah-orange/10 ring-2 ring-joah-orange shadow-lg z-10 relative' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                                                >
                                                    <td className="px-6 py-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-base font-black font-mono text-slate-900 dark:text-white">{product.barcode}</span>
                                                            {product.updated_at && (
                                                                <span className="text-xs text-slate-500 font-bold uppercase tracking-tight mt-1">{new Date(product.updated_at).toLocaleDateString()}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-6">
                                                        <span className="text-base font-bold text-slate-800 dark:text-slate-100">{product.product_name_la}</span>
                                                    </td>
                                                    <td className="px-6 py-6">
                                                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{product.category_1 || '-'}</span>
                                                    </td>
                                                    <td className="px-6 py-6">
                                                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{product.category_2 || '-'}</span>
                                                    </td>
                                                    <td className="px-6 py-6 text-center">
                                                        <span className="text-2xl font-black text-joah-orange drop-shadow-sm">{product.qty}</span>
                                                    </td>
                                                    <td className="px-6 py-6">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 shadow-sm"><User size={14} /></div>
                                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{product.updated_by || 'System'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-6 text-right">
                                                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleEdit(product)}
                                                                className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100 dark:border-blue-900/30"
                                                            >
                                                                <Edit2 size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(product)}
                                                                className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-rose-100 dark:border-rose-900/30"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            <div className="p-8 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/50">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Showing <span className="text-slate-700 dark:text-slate-300">{Math.min(startIndex + 1, filteredProducts.length)}-{Math.min(startIndex + itemsPerPage, filteredProducts.length)}</span> of <span className="text-slate-700 dark:text-slate-300">{filteredProducts.length}</span> items</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="btn-secondary !p-3.5 !rounded-2xl disabled:opacity-30 self-center">
                                        <ChevronLeft size={20} />
                                    </button>
                                    <div className="flex items-center px-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] font-black text-slate-800 dark:text-white shadow-inner">
                                        PAGE {currentPage} / {totalPages || 1}
                                    </div>
                                    <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="btn-secondary !p-3.5 !rounded-2xl disabled:opacity-30 self-center">
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                ) : (
                    /* History Mode */
                    isLoadingHistory ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-4">
                            <Loader2 className="animate-spin text-indigo-500" size={48} />
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Loading History...</p>
                        </div>
                    ) : (
                        <div className="glass-card rounded-[2rem] overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b-2 border-slate-100 dark:border-slate-800">
                                        <tr>
                                            <th className="px-6 py-6 text-left text-xs sm:text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">Time</th>
                                            <th className="px-6 py-6 text-left text-xs sm:text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">Type</th>
                                            <th className="px-6 py-6 text-left text-xs sm:text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">Item Detail</th>
                                            <th className="px-6 py-6 text-left text-xs sm:text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">User</th>
                                            <th className="px-6 py-6 text-right text-xs sm:text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                        {viewMode === 'history' && currentItems.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-20 text-center text-slate-400">
                                                    <History size={48} className="mx-auto mb-4 opacity-50" />
                                                    <p className="font-bold">ບໍ່ມີປະຫວັດການຈັດການສິນຄ້າ</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            currentItems.map((log) => (
                                                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                                    <td className="px-6 py-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-base font-bold text-slate-800 dark:text-slate-100">{new Date(log.updated_at).toLocaleDateString()}</span>
                                                            <span className="text-xs text-slate-500 font-mono font-bold mt-1">{new Date(log.updated_at).toLocaleTimeString()}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-6">
                                                        <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${log.operation_type === 'INSERT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-900/50' :
                                                            log.operation_type === 'UPDATE' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-900/50' :
                                                                'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-900/50'
                                                            }`}>
                                                            {log.operation_type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-base font-black font-mono text-slate-900 dark:text-white leading-none">{log.barcode}</span>
                                                            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-1.5">{log.product_name_la || log.item_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-6">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500 border border-indigo-100 dark:border-indigo-900/50"><User size={14} /></div>
                                                            <span className="text-sm font-black text-slate-800 dark:text-slate-200">{log.updated_by}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-6 text-right">
                                                        <button
                                                            onClick={() => console.log('Log Detail:', log)}
                                                            className="p-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-slate-200 dark:border-slate-700"
                                                        >
                                                            <Search size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls for History */}
                            <div className="p-8 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/50">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Showing <span className="text-slate-700 dark:text-slate-300">{Math.min(startIndex + 1, activeList.length)}-{Math.min(startIndex + itemsPerPage, activeList.length)}</span> of <span className="text-slate-700 dark:text-slate-300">{activeList.length}</span> items</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="btn-secondary !p-3.5 !rounded-2xl disabled:opacity-30 self-center">
                                        <ChevronLeft size={20} />
                                    </button>
                                    <div className="flex items-center px-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] font-black text-slate-800 dark:text-white shadow-inner">
                                        PAGE {currentPage} / {totalPages || 1}
                                    </div>
                                    <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="btn-secondary !p-3.5 !rounded-2xl disabled:opacity-30 self-center">
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                )}

                {/* Form Modal (Unchanged Layout, Just Functional Check) */}
                {showForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-950/40 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] p-10 border-2 border-slate-200 dark:border-slate-800 shadow-2xl animate-scale-in">
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white">
                                        {editingProduct ? 'ແກ້ໄຂສິນຄ້າ' : 'ເພີ່ມສິນຄ້າໃໝ່'}
                                    </h2>
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-2">Master Data Entry Form</p>
                                </div>
                                <button onClick={resetForm} className="p-4 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-3xl transition-all shadow-inner">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 ml-1">Barcode *</label>
                                        <input
                                            type="text"
                                            value={formData.barcode}
                                            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                            className="input-field !text-lg !py-4 font-bold border-2 focus:border-joah-orange"
                                            required
                                            disabled={editingProduct !== null}
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 ml-1">ຊື່ສິນຄ້າ (Lao)</label>
                                        <input
                                            type="text"
                                            value={formData.product_name_la}
                                            onChange={(e) => setFormData({ ...formData, product_name_la: e.target.value })}
                                            className="input-field !text-lg !py-4 font-bold border-2 focus:border-joah-orange"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 ml-1">ຊື່ສິນຄ້າ (English)</label>
                                        <input
                                            type="text"
                                            value={formData.item_name}
                                            onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                                            className="input-field !text-lg !py-4 font-bold border-2 focus:border-joah-orange"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 ml-1">ຈຳນວນ</label>
                                        <input
                                            type="number"
                                            value={formData.qty}
                                            onChange={(e) => setFormData({ ...formData, qty: Number(e.target.value) })}
                                            className="input-field !text-lg !py-4 font-bold border-2 focus:border-joah-orange"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 ml-1">ໝວດໝູ່ 1</label>
                                        <input
                                            type="text"
                                            value={formData.category_1}
                                            onChange={(e) => setFormData({ ...formData, category_1: e.target.value })}
                                            className="input-field !text-lg !py-4 font-bold border-2 focus:border-joah-orange"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 ml-1">ໝວດໝູ່ 2</label>
                                        <input
                                            type="text"
                                            value={formData.category_2}
                                            onChange={(e) => setFormData({ ...formData, category_2: e.target.value })}
                                            className="input-field !text-lg !py-4 font-bold border-2 focus:border-joah-orange"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-6">
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="flex-1 h-16 rounded-2xl border-2 border-slate-200 dark:border-slate-800 font-black text-sm uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-600 dark:text-slate-400"
                                    >
                                        ຍົກເລີກ
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="flex-1 btn-primary h-16 flex items-center justify-center gap-3 text-base"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="animate-spin" size={24} />
                                        ) : (
                                            <Save size={24} />
                                        )}
                                        <span>{editingProduct ? 'ອັບເດດຂໍ້ມູນ' : 'ບັນທຶກສິນຄ້າ'}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductManager;
