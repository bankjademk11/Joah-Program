import React, { useState, useEffect, useRef } from 'react';
import joahLogo from '../assets/Joah.jpeg';
import joahWarehouseImg from '../assets/joah warehosue.png';
import LoadingOverlay from './LoadingOverlay';
import elephantMascot from '../assets/elephant_perfect_transparent_v2 (1).gif';
import { User, ArrowRight, Loader2, Lock, MapPin, Phone } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

const Login = ({ onLogin }) => {
    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Register State
    const [isRegistering, setIsRegistering] = useState(false);
    const [regEmployeeId, setRegEmployeeId] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [regWorkplace, setRegWorkplace] = useState('front'); // Default to front store

    const inputRef = useRef(null);

    // Auto-focus input on mount
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const handleRegister = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // Run API call + minimum 4s delay in parallel
            const [result] = await Promise.all([
                supabase
                    .from('employees')
                    .insert([{
                        employee_id: regEmployeeId.trim().toUpperCase(),
                        password: regPassword,
                        name: regEmployeeId.trim(),
                        role: 'staff',
                        workplace: regWorkplace
                    }]),
                new Promise(resolve => setTimeout(resolve, 4000))
            ]);

            if (result.error) throw result.error;

            alert('✅ ລົງທະບຽນສຳເລັດ! ສາມາດເຂົ້າສູ່ລະບົບໄດ້ທັນທີ.');
            setIsRegistering(false);
            setEmployeeId(regEmployeeId);
        } catch (err) {
            setError('ບໍ່ສາມາດລົງທະບຽນໄດ້: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if (!password || password.trim() === '') {
            setError('ກະລຸນາໃສ່ລະຫັດຜ່ານ ');
            setIsLoading(false);
            return;
        }

        try {
            // Run API call + minimum 4s delay in parallel
            const [{ data: employee, error: dbError }] = await Promise.all([
                supabase
                    .from('employees')
                    .select('*')
                    .ilike('employee_id', employeeId.trim())
                    .maybeSingle(),
                new Promise(resolve => setTimeout(resolve, 4000))
            ]);

            if (dbError || !employee) {
                throw new Error('ລະຫັດພະນັກງານບໍ່ຖືກຕ້ອງ ຫຼື ບໍ່ມີສິດເຂົ້າໃນລະບົບ');
            }

            localStorage.setItem('joah_employee_id', employee.employee_id);
            localStorage.setItem('joah_employee_name', employee.name || employee.employee_id);
            localStorage.setItem('joah_employee_role', employee.role);
            localStorage.setItem('joah_employee_workplace', employee.workplace || 'front');

            onLogin({
                id: employee.employee_id,
                name: employee.name || employee.employee_id,
                role: employee.role,
                workplace: employee.workplace || 'front'
            });

        } catch (err) {
            setError(err.message);
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white dark:bg-slate-950 font-inter relative overflow-hidden bg-blueprint-grid">
            {/* 🐘 Elephant Mascot Loading Overlay */}
            <LoadingOverlay
                isVisible={isLoading}
                message={isRegistering ? 'ກຳລັງລົງທະບຽນ' : 'ກຳລັງເຂົ້າສູ່ລະບົບ'}
            />
            {/* === LEFT SIDE: Image Section === */}
            <div className="hidden lg:flex lg:w-[58%] relative overflow-hidden bg-slate-100">
                <img
                    src={joahWarehouseImg}
                    alt="Joah Warehouse"
                    className="absolute inset-0 w-full h-full object-cover animate-scale-slow"
                />
                {/* Logo Overlay - Frame Removed */}
                <div className="absolute top-12 left-12 z-20">
                    <img
                        src={joahLogo}
                        alt="Joah Logo"
                        className="w-32 h-auto object-contain drop-shadow-2xl filter brightness-110 transform hover:scale-105 transition-transform duration-500"
                    />
                </div>
                {/* Motivational Text */}
                <div className="absolute bottom-24 left-16 right-16 z-20 text-white drop-shadow-2xl">
                    <h2 className="text-6xl font-black mb-6 leading-tight tracking-tighter">
                        <span className="text-white drop-shadow-2xl">Smart Logistics</span> <br />
                        <span className="text-white drop-shadow-2xl">Efficiency Redefined</span> <br />
                        <span className="text-5xl text-joah-orange drop-shadow-[0_0_15px_rgba(249,115,22,0.4)] whitespace-nowrap">Store Warehouse Management</span>
                    </h2>
                    <p className="text-xl font-medium opacity-90 max-w-xl leading-relaxed">
                        ເຊື່ອມໂຍງທຸກຂໍ້ມູນ ຈັດການທຸກຄັງສິນຄ້າ ດ້ວຍລະບົບອັດສະລິຍະ ຈາກ JOAH ENTERPRISE
                    </p>
                </div>
                {/* Dark Gradient Overlay for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            </div>

            {/* === RIGHT SIDE: Form Section === */}
            <div className="flex-1 flex items-center justify-center p-8 md:p-16 lg:px-20 relative overflow-hidden">
                {/* Background Decor Blobs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-orange-100/40 dark:bg-orange-950/20 blur-[120px] animate-blob-pulse" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-blue-100/30 dark:bg-blue-950/20 blur-[100px] animate-blob-pulse" style={{ animationDelay: '2s' }} />
                </div>

                <div className="w-full max-w-md relative z-10 animate-fade-in-up">
                    {/* Header */}
                    <div className="mb-8 text-center lg:text-left">
                        <div className="flex items-center gap-3 mb-6 lg:hidden justify-center">
                            <img src={joahLogo} alt="Logo" className="w-12 h-auto drop-shadow-md" />
                            <span className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">JOAH TOOLS</span>
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                            {isRegistering ? 'ສ້າງບັນຊີ' : 'ຍິນດີຕ້ອນຮັບ'}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">
                            {isRegistering ? 'ປ້ອນຂໍ້ມູນເພື່ອຂໍສິດເຂົ້າໃຊ້ງານ' : 'ສະແກນ ຫຼື ພິມລະຫັດພະນັກງານເພື່ອເຂົ້າສູ່ລະບົບ'}
                        </p>
                    </div>

                    {isRegistering ? (
                        /* REGISTER FORM */
                        <form onSubmit={handleRegister} className="space-y-4">
                            {/* Address Dropdown */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">ສາຂາ / BRANCH</label>
                                <div className="relative group">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-joah-orange transition-colors duration-300 pointer-events-none z-10">
                                        <MapPin size={20} />
                                    </div>
                                    <select
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        className="w-full h-14 pl-14 pr-10 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:border-joah-orange/50 focus:bg-white dark:focus:bg-slate-900 outline-none text-lg font-bold text-slate-800 dark:text-white appearance-none cursor-pointer"
                                        required
                                    >
                                        <option value="" disabled>ເລືອກສາຂາ...</option>
                                        <option value="ຕະຫຼາດລາວ">ຕະຫຼາດລາວ</option>
                                        <option value="ສີວິໄລ">ສີວິໄລ</option>
                                        <option value="ວັງຊາຍ">ວັງຊາຍ</option>
                                        <option value="ໂພນສີນວນ">ໂພນສີນວນ</option>
                                    </select>
                                    {/* Custom Dropdown Arrow */}
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                        <ArrowRight size={18} className="rotate-90" />
                                    </div>
                                </div>
                            </div>

                            {/* Phone */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">ເບີໂທ / PHONE</label>
                                <div className="relative group">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-2 text-slate-400 group-focus-within:text-joah-orange transition-colors duration-300">
                                        <Phone size={20} />
                                        <span className="font-black text-sm text-slate-500 group-focus-within:text-joah-orange">+856</span>
                                    </div>
                                    <input
                                        type="tel"
                                        placeholder="20 xxxxxxxx"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full h-14 pl-24 pr-6 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:border-joah-orange/50 focus:bg-white dark:focus:bg-slate-900 outline-none text-lg font-bold text-slate-800 dark:text-white placeholder:text-slate-300"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Employee ID */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">ລະຫັດພະນັກງານ / ID</label>
                                <div className="relative group">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-joah-orange transition-colors duration-300">
                                        <User size={20} />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="ລະຫັດພະນັກງານ"
                                        value={regEmployeeId}
                                        onChange={(e) => setRegEmployeeId(e.target.value)}
                                        className="w-full h-14 pl-14 pr-6 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:border-joah-orange/50 focus:bg-white dark:focus:bg-slate-900 outline-none text-lg font-bold text-slate-800 dark:text-white placeholder:text-slate-300 uppercase"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">ລະຫັດຜ່ານ / PASS</label>
                                <div className="relative group">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-joah-orange transition-colors duration-300">
                                        <Lock size={20} />
                                    </div>
                                    <input
                                        type="password"
                                        placeholder="ຕັ້ງລະຫັດຜ່ານ..."
                                        value={regPassword}
                                        onChange={(e) => setRegPassword(e.target.value)}
                                        className="w-full h-14 pl-14 pr-6 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:border-joah-orange/50 focus:bg-white dark:focus:bg-slate-900 outline-none text-lg font-bold text-slate-800 dark:text-white placeholder:text-slate-300"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Workplace Selection */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">ແຜນກ / DEPARTMENT</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setRegWorkplace('front')}
                                        className={`h-12 rounded-xl font-bold transition-all ${regWorkplace === 'front'
                                            ? 'bg-joah-orange text-white shadow-lg'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        ໜ້າຮ້ານ
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRegWorkplace('back')}
                                        className={`h-12 rounded-xl font-bold transition-all ${regWorkplace === 'back'
                                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        ຫລັງຮ້ານ
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-14 mt-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-2xl font-black text-lg shadow-xl shadow-slate-900/20 transition-all duration-300 transform hover:-translate-y-1 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                            >
                                {isLoading ? <Loader2 className="animate-spin" size={24} /> : 'ລົງທະບຽນ'}
                            </button>

                            <div className="text-center pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsRegistering(false)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xs transition-colors"
                                >
                                    ມີບັນຊີແລ້ວ? <span className="text-joah-orange underline decoration-2 underline-offset-4">ເຂົ້າສູ່ລະບົບ</span>
                                </button>
                            </div>
                        </form>
                    ) : (
                        /* LOGIN FORM */
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Employee ID Field */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">ລະຫັດພະນັກງານ / EMPLOYEE ID</label>
                                <div className="relative group">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-joah-orange transition-colors duration-300">
                                        <User size={24} />
                                    </div>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        placeholder="Scan ID or Type..."
                                        value={employeeId}
                                        onChange={(e) => setEmployeeId(e.target.value)}
                                        className="w-full h-20 pl-16 pr-6 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-[1.5rem] focus:border-joah-orange/50 focus:bg-white dark:focus:bg-slate-900 focus:shadow-2xl focus:shadow-orange-500/10 transition-all duration-300 outline-none text-2xl font-black text-slate-800 dark:text-white placeholder:text-slate-300 tracking-wider"
                                        required
                                        autoComplete="off"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">ລະຫັດຜ່ານ / PASSWORD</label>
                                <div className="relative group">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-joah-orange transition-colors duration-300">
                                        <Lock size={24} />
                                    </div>
                                    <input
                                        type="password"
                                        placeholder="Enter Password..."
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full h-20 pl-16 pr-6 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-[1.5rem] focus:border-joah-orange/50 focus:bg-white dark:focus:bg-slate-900 focus:shadow-2xl focus:shadow-orange-500/10 transition-all duration-300 outline-none text-2xl font-black text-slate-800 dark:text-white placeholder:text-slate-300 tracking-wider"
                                        required
                                        autoComplete="off"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-2xl border border-rose-100 dark:border-rose-900/30 flex items-center gap-3 animate-shake">
                                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-16 bg-joah-orange hover:bg-orange-600 text-white rounded-[1.25rem] font-black text-xl shadow-2xl shadow-orange-500/40 hover:shadow-orange-500/60 transition-all duration-300 transform hover:-translate-y-1 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-4 group overflow-hidden"
                            >
                                {isLoading ? (
                                    <Loader2 className="animate-spin" size={28} />
                                ) : (
                                    <>
                                        <span>ເຂົ້າສູ່ລະບົບ</span>
                                        <div className="bg-white/20 p-1.5 rounded-lg group-hover:translate-x-2 transition-transform duration-300">
                                            <ArrowRight size={20} />
                                        </div>
                                    </>
                                )}
                            </button>

                            <div className="text-center pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsRegistering(true)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xs transition-colors"
                                >
                                    ຍັງບໍ່ມີບັນຊີ? <span className="text-joah-orange underline decoration-2 underline-offset-4">ລົງທະບຽນໃໝ່</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Footer */}
                    <div className="mt-20 text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
                            Warehouse Validation System v4.0 <br />
                            <span className="text-slate-300 dark:text-slate-700">Digital Transformation of Supply Chain</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
