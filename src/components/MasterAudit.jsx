import { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { fetchMasterFromSupabase } from '../utils/supabaseSync';
import {
    Database, Search, Filter, ArrowLeft, RefreshCw,
    AlertTriangle, CheckCircle, Info, Edit2, X,
    ChevronLeft, ChevronRight, Package, LayoutDashboard,
    ExternalLink, AlertCircle, HelpCircle
} from 'lucide-react';

const MasterAudit = ({ onBack, currentUser }) => {
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const itemsPerPage = 50; // Increased for better initial loading
    const rowRefs = useRef({});

    useEffect(() => {
        fetchMasterData();
    }, []);

    const fetchMasterData = async () => {
        setIsLoading(true);
        try {
            const data = await fetchMasterFromSupabase();
            setProducts(data || []);
        } catch (err) {
            console.error('Audit Fetch Error:', err);
            alert('ເກີດຂໍ້ຜິດພາດ: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const getRowAudit = (item) => {
        const issues = [];
        const cat1 = (item.category_1 || '').trim();
        const isMissingCat = !cat1 || cat1.includes('ຂໍ້ມູນ') || cat1 === '---';

        if (isMissingCat) {
            issues.push('ຂາດຂໍ້ມູນ Category 1');
        }

        if (!item.category_2 || item.category_2.includes('ຂໍ້ມູນ')) issues.push('ຂາດຂໍ້ມູນ Category 2');
        if (!item.product_name_la || item.product_name_la.includes('ຂໍ້ມູນ')) issues.push('ຂາດຂໍ້ມູນຊື່ສິນຄ້າ');
        if (!item.barcode) issues.push('ຂາດຂໍ້ມູນ Barcode');

        // Check if category is recognized
        const recognizedCats = ['KITCHEN', 'BEAUTY', 'STATIONERY', 'TOYS', 'CLEANING/BATH', 'INTERIOR', 'TOOL/DIGITAL', 'STORAGE', 'FASHION', 'SPORTS/LEISURE', 'SPORT LEISURE', 'SPORT'];
        const isCat1Valid = cat1 && recognizedCats.includes(cat1.toUpperCase());

        if (cat1 && !isMissingCat && !isCat1Valid) {
            issues.push(`ໝວດໝູ່ "${cat1}" ບໍ່ມີໃນລະບົບ`);
        }

        // --- Advanced Validation & Suggestion Logic ---
        const RACK_RULES = [
            { cats: ['KITCHEN'], pattern: /^((G0[1-8]|H0[2-4])-L[1-5]|ໂລພື້ນ\s?G(9|10|11))/i, label: 'G01-08-L1-5, H02-04-L1-5 ຫຼື G9-11' },
            { cats: ['BEAUTY'], pattern: /^(E0[1-4]-L[1-5]|ໂລພື້ນE\s?[578])/i, label: 'E01-04-L1-5 ຫຼື E5,7,8' },
            { cats: ['STATIONERY'], pattern: /^(S0[1235678]-L[1-5]|S10-L[1-4])/i, label: 'S01-08-L1-5 ຫຼື S10-L1-4' },
            { cats: ['TOYS'], pattern: /^S09-L[1-5]/i, label: 'S09-L1-5' },
            { cats: ['CLEANING/BATH'], pattern: /^(A0[1-35]-L[1-5]|A04-L[1-6])/i, label: 'A01-05 (A04 ຮອດ L6)' },
            { cats: ['INTERIOR'], pattern: /^(B01-L[1-3]|B0[2-4]-L[1-4])/i, label: 'B01-L1-3, B02-04-L1-4' },
            { cats: ['TOOL/DIGITAL'], pattern: /^F0[1-4]-L[1-5]/i, label: 'F01-04-L1-5' },
            { cats: ['STORAGE'], pattern: /^(D0[1-6]-L[1-5]|ໂລພື້ນ\s?D0?[78])/i, label: 'D01-06-L1-5 ຫຼື D07-08' },
            { cats: ['FASHION'], pattern: /^C0[1-4]-L[1-5]/i, label: 'C01-04-L1-5' },
            { cats: ['SPORTS/LEISURE', 'SPORT LEISURE', 'SPORT'], pattern: /^H01-L[1-5]/i, label: 'H01-L1-5' },
        ];

        const checkRackMatch = (cat1, rack) => {
            if (!cat1 || !rack) return { match: true };
            const c = cat1.toUpperCase().trim();
            const r = rack.toUpperCase().trim();

            const rule = RACK_RULES.find(rule => rule.cats.includes(c));
            if (rule) {
                return {
                    match: rule.pattern.test(r),
                    expected: rule.label
                };
            }
            return { match: true };
        };

        const suggestCategory = (rack) => {
            if (!rack) return null;
            const r = rack.toUpperCase().trim();
            const foundRule = RACK_RULES.find(rule => rule.pattern.test(r));
            return foundRule ? foundRule.cats[0] : null;
        };

        const rackCheck = checkRackMatch(item.category_1, item.rack_location);
        const categorySuggestion = suggestCategory(item.rack_location);

        if (item.rack_location && item.rack_location.trim() !== '' && !item.rack_location.includes('ຂໍ້ມູນ')) {
            if (!rackCheck.match) {
                issues.push(`ຕຳແໜ່ງ Rack ບໍ່ກົງກັບໝວດໝູ່ (ຂໍ້ມູນປັດຈຸບັນຢູ່ Rack ${item.rack_location})`);
            }
        }

        const isProblematic = issues.length > 0;
        return {
            status: isProblematic ? 'incomplete' : 'complete',
            issues: issues,
            rackCheck: rackCheck,
            categorySuggestion: categorySuggestion,
            label: isProblematic ? 'ພົບບັນຫາ' : 'ສົມບູນ 100%',
            color: isProblematic ? 'text-amber-500' : 'text-emerald-500',
            bg: isProblematic ? 'bg-amber-500/10' : 'bg-emerald-500/10'
        };
    };

    const filteredProducts = products.filter(p => {
        const audit = getRowAudit(p);
        const matchesSearch =
            (p.barcode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.product_name_la || '').toLowerCase().includes(searchTerm.toLowerCase());

        let matchesFilter = true;
        if (filter === 'complete') matchesFilter = audit.status === 'complete';
        else if (filter === 'incomplete') matchesFilter = audit.issues.some(i => i.startsWith('ຂາດ') && !i.includes('Rack'));
        else if (filter === 'wrong_cat') matchesFilter = audit.issues.some(i => i.includes('ບໍ່ມີໃນລະບົບ'));
        else if (filter === 'no_rack') matchesFilter = !p.rack_location || p.rack_location.trim() === '';
        else if (filter === 'problematic') matchesFilter = audit.status === 'incomplete';

        return matchesSearch && matchesFilter;
    });

    // Reset page on search/filter
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filter]);

    // Auto-scroll logic for items
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

    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentItems = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

    if (isLoading && products.length === 0) {
        return (
            <div className="w-full flex flex-col items-center justify-center py-40 gap-8 animate-fade-in">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-slate-100 dark:border-slate-800 border-t-joah-orange animate-spin"></div>
                    <Database className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-joah-orange" size={32} />
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">ກຳລັງເຊື່ອມຕໍ່ຖານຂໍ້ມູນ...</h3>
                    <p className="text-slate-400 font-bold tracking-widest text-[10px] uppercase animate-pulse">Connecting to Supabase Cloud</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl animate-fade-in-up space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-400 hover:text-joah-orange transition-colors mb-4 group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-xs font-black uppercase tracking-widest">ກັບຄືນໜ້າຫຼັກ</span>
                    </button>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-4">
                        <Database className="text-joah-orange" size={36} />
                        ກວດສອບພື້ນຖານຂໍ້ມູນ <span className="text-joah-orange">(Master Data Audit)</span>
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">
                        ວິເຄາະຄວາມສົມບູນຂອງຂໍ້ມູນສິນຄ້າທັງໝົດໃນລະບົບ Cloud
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={fetchMasterData}
                        className="btn-secondary !rounded-2xl h-14"
                    >
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 w-full max-w-7xl">
                <div className="glass-card p-8 rounded-[2rem] border-white/50 relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                        <Database size={120} />
                    </div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Total Master Items</p>
                    <h3 className="text-4xl font-black text-slate-900 dark:text-white">{products.length}</h3>
                </div>
                <div className="glass-card p-8 rounded-[2rem] border-white/50 relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 text-emerald-500 opacity-5 group-hover:scale-110 transition-transform duration-500">
                        <CheckCircle size={120} />
                    </div>
                    <p className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-2">Complete Records</p>
                    <h3 className="text-4xl font-black text-emerald-600 dark:text-emerald-400">
                        {products.filter(p => getRowAudit(p).status === 'complete').length}
                    </h3>
                </div>
                <div className="glass-card p-8 rounded-[2rem] border-white/50 relative overflow-hidden group border-amber-500/20">
                    <div className="absolute -right-4 -bottom-4 text-amber-500 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <AlertTriangle size={120} />
                    </div>
                    <p className="text-xs font-black text-amber-500 uppercase tracking-widest mb-2">Incomplete Data</p>
                    <h3 className="text-4xl font-black text-amber-600 dark:text-amber-400">
                        {products.filter(p => {
                            const audit = getRowAudit(p);
                            return audit.status === 'incomplete';
                        }).length}
                    </h3>
                </div>
                <div className="glass-card p-8 rounded-[2rem] border-white/50 relative overflow-hidden group border-rose-500/20">
                    <div className="absolute -right-4 -bottom-4 text-rose-500 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Info size={120} />
                    </div>
                    <p className="text-xs font-black text-rose-500 uppercase tracking-widest mb-2">Unrecognized Category</p>
                    <h3 className="text-4xl font-black text-rose-600 dark:text-rose-400">
                        {products.filter(p => getRowAudit(p).issues.some(i => i.includes('ບໍ່ມີໃນລະບົບ'))).length}
                    </h3>
                </div>
            </div>

            {/* Main Audit Table */}
            <div className="glass-card rounded-[2.5rem] border-white/50 shadow-2xl overflow-hidden">
                {/* Table Actions */}
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row gap-6">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-joah-orange transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="ຄົ້ນຫາບາໂຄ້ດ ຫຼື ຊື່ສິນຄ້າ..."
                            className="input-field pl-14 h-14 font-bold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-4">
                        <div className="relative">
                            <select
                                className="input-field pl-6 pr-12 h-14 appearance-none font-bold min-w-[200px]"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            >
                                <option value="all">ທັງໝົດ (All Products)</option>
                                <option value="complete">✅ ຂໍ້ມູນສົມບູນ 100%</option>
                                <option value="incomplete">⚠️ ຂໍ້ມູນບໍ່ຄົບຖ້ວນ (ຂາດຊື່/ບາໂຄ້ດ)</option>
                                <option value="no_rack">📍 ບໍ່ມີຂໍ້ມູນ Rack (No Rack)</option>
                                <option value="wrong_cat">❌ ໝວດໝູ່ບໍ່ຖືກຕ້ອງ (Wrong Cat)</option>
                                <option value="problematic">🔍 ລວມບັນຫາທັງໝົດ</option>
                            </select>
                            <Filter className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    </div>
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 dark:bg-slate-800/50">
                                <th className="px-8 py-6 text-[11px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">Barcode</th>
                                <th className="px-6 py-6 text-[11px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">Product Name (LA)</th>
                                <th className="px-6 py-6 text-[11px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">Rack Map</th>
                                <th className="px-6 py-6 text-[11px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">Categories</th>
                                <th className="px-6 py-6 text-[11px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 text-center">Status</th>
                                <th className="px-8 py-6 text-[11px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 text-right">Audit Findings</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="6" className="p-8"><div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-xl w-full"></div></td>
                                    </tr>
                                ))
                            ) : currentItems.length > 0 ? currentItems.map((item) => {
                                const audit = getRowAudit(item);
                                return (
                                    <tr
                                        key={item.barcode}
                                        ref={el => rowRefs.current[item.barcode] = el}
                                        className={`transition-all duration-500 cursor-pointer group ${searchTerm === item.barcode ? 'bg-joah-orange/10 ring-2 ring-joah-orange shadow-lg z-10 relative' : 'hover:bg-joah-orange/[0.03] dark:hover:bg-joah-orange/[0.05]'}`}
                                        onClick={() => setSelectedProduct(item)}
                                    >
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{item.barcode}</span>
                                                <ExternalLink size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{item.product_name_la}</p>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">{item.rack_location || 'No Rack'}</span>
                                                <span className={`text-[9px] font-bold ${audit.rackCheck?.match ? 'text-emerald-500' : 'text-rose-500 animate-pulse'}`}>
                                                    {audit.rackCheck?.match ? '✓ Rack กົງ' : '✗ Rack ຜິດ'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">{item.category_1 || 'No Cat-1'}</span>
                                                <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400 opacity-60">{item.category_2 || 'No Cat-2'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${audit.status === 'complete' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                                {audit.status === 'complete' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                                                {audit.label}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex flex-col items-end gap-1">
                                                {audit.issues.length > 0 ? (
                                                    audit.issues.slice(0, 2).map((issue, idx) => (
                                                        <span key={idx} className="text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-500/20">{issue}</span>
                                                    ))
                                                ) : (
                                                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20">Data is Correct</span>
                                                )}
                                                {audit.issues.length > 2 && <span className="text-[9px] text-slate-400 font-bold">+{audit.issues.length - 2} more...</span>}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            }) : (
                                <tr>
                                    <td colSpan="6" className="py-24 text-center">
                                        <div className="flex flex-col items-center gap-4 text-slate-300">
                                            <Package size={64} strokeWidth={1} />
                                            <p className="text-sm font-black uppercase tracking-widest">No Records Found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

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

            {/* Diagnostic Modal */}
            {selectedProduct && (() => {
                const audit = getRowAudit(selectedProduct);
                return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedProduct(null)}></div>
                        <div className="relative glass-card w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl animate-scale-in">
                            {/* Modal Header */}
                            <div className={`p-10 ${audit.status === 'complete' ? 'bg-emerald-500/10' : 'bg-amber-500/10'} border-b border-slate-100 dark:border-slate-800`}>
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${audit.status === 'complete' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {audit.status === 'complete' ? <CheckCircle size={32} /> : <AlertCircle size={32} />}
                                    </div>
                                    <button onClick={() => setSelectedProduct(null)} className="p-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 text-slate-400 transition-colors">
                                        <X size={24} />
                                    </button>
                                </div>
                                <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">ລາຍລະອຽດການກວດສອບ</h3>
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{selectedProduct.barcode}</p>
                            </div>

                            {/* Modal Content */}
                            <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                {/* Product Info Grid */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ຊື່ສິນຄ້າ (Product Name)</p>
                                        <p className="text-base font-bold text-slate-800 dark:text-white">{selectedProduct.product_name_la || '---'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ໝວດໝູ່ (Category 1)</p>
                                        <p className="text-base font-bold text-slate-800 dark:text-white">{selectedProduct.category_1 || '---'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ໝວດໝູ່ຍ່ອຍ (Category 2)</p>
                                        <p className="text-base font-bold text-slate-800 dark:text-white">{selectedProduct.category_2 || '---'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ຈຳນວນໃນລະບົບ (Qty)</p>
                                        <p className="text-base font-bold text-slate-800 dark:text-white">{selectedProduct.qty || 0}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ຕຳແໜ່ງ Rack (Rack Location)</p>
                                        <div className="flex items-center gap-2">
                                            <p className={`text-base font-black ${audit.rackCheck?.match ? 'text-slate-800 dark:text-white' : 'text-rose-500 animate-pulse'}`}>
                                                {selectedProduct.rack_location || '---'}
                                            </p>
                                            {!audit.rackCheck?.match && (
                                                <span className="px-2 py-0.5 bg-rose-100 text-rose-600 rounded-lg text-[9px] font-black uppercase">Wrong Location</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Audit Results */}
                                <div className="space-y-4">
                                    <h4 className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">
                                        <HelpCircle size={16} className="text-joah-orange" />
                                        ຜົນການວິເຄາະຂໍ້ມູນ
                                    </h4>

                                    <div className="space-y-3">
                                        {audit.issues.length > 0 ? audit.issues.map((issue, idx) => (
                                            <div key={idx} className="flex flex-col gap-3 p-6 rounded-3xl bg-rose-50 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/10">
                                                <div className="flex items-start gap-4">
                                                    <div className="mt-0.5 text-rose-500"><AlertTriangle size={18} /></div>
                                                    <div>
                                                        <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{issue}</p>
                                                        <p className="text-xs text-rose-600/60 dark:text-rose-400/60 mt-1">
                                                            {issue.includes('Rack') ? 'ລະບົບພົບວ່າສິນຄ້ານີ້ວາງຢູ່ໃນຕຳແໜ່ງທີ່ບໍ່ກົງກັບໝວດໝູ່. ກະລຸນາຍ້າຍສິນຄ້າ ຫຼື ປ່ຽນໝວດໝູ່ໃຫ້ຖືກຕ້ອງ.' :
                                                                issue.includes('ໝວດໝູ່') ? 'ໝວດໝູ່ທີ່ເລືອກບໍ່ມີໃນລະບົບມາດຕະຖານ. ລະບົບໄດ້ທຳການກວດສອບ ແລະ ປຽບທຽບໃຫ້ອັດຕະໂນມັດແລ້ວ.' :
                                                                    'ຂໍ້ມູນສ່ວນນີ້ມີຄວາມຈຳເປັນໃນການຄຳນວນລາຍງານ, ກະລຸນາເພີ່ມຂໍ້ມູນໃຫ້ຄົບຖ້ວນ'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {(issue.includes('Rack') || issue.includes('ຂາດຂໍ້ມູນ Rack')) && (
                                                    <div className="mt-2 space-y-3">
                                                        {audit.rackCheck?.expected && (
                                                            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border-2 border-dashed border-rose-200 dark:border-rose-500/20">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ຕຳແໜ່ງທີ່ຄວນໄປຢູ່ (Target Rack)</p>
                                                                <p className="text-sm font-black text-rose-600 dark:text-rose-400 uppercase">
                                                                    ➡️ ຄວນຢູ່ Rack: <span className="underline decoration-2 underline-offset-4 bg-rose-50 dark:bg-rose-500/10 px-2 rounded-md">{audit.rackCheck.expected}</span>
                                                                </p>
                                                            </div>
                                                        )}
                                                        {audit.categorySuggestion && !audit.rackCheck?.match && (
                                                            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-500/20">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ໝວດໝູ່ທີ່ແນະນຳ (Suggested Category)</p>
                                                                <p className="text-sm font-black text-amber-600 dark:text-amber-400 uppercase">
                                                                    💡 ອີງຕາມ Rack "{selectedProduct.rack_location}", ໝວດໝູ່ຄວນເປັນ: <span className="bg-amber-50 dark:bg-amber-500/10 px-2 rounded-md">{audit.categorySuggestion}</span>
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )) : (
                                            <div className="flex items-start gap-4 p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10">
                                                <div className="mt-0.5 text-emerald-500"><CheckCircle size={18} /></div>
                                                <div>
                                                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">ຂໍ້ມູນສົມບູນ 100%</p>
                                                    <p className="text-xs text-emerald-600/60 dark:text-emerald-400/60 mt-1">ຂໍ້ມູນສິນຄ້ານີ້ມີຄວາມພ້ອມສຳລັບການນຳໄປກວດສອບພາກສະໜາມ</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Footer Action */}
                                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                                        💡 ຄຳແນະນຳ: ຫາກຕ້ອງການແກ້ໄຂຂໍ້ມູນ, ກະລຸນາໄປທີ່ເມນູ "ຈັດການສິນຄ້າ" ແລ້ວຄົ້ນຫາບາໂຄ້ດນີ້ເພື່ອປັບປ່ຽນຂໍ້ມູນໃຫ້ຖືກຕ້ອງ.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default MasterAudit;
