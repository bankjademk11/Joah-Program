import React, { useState, useEffect } from 'react';
import {
    Building2, ShieldCheck, CheckCircle2, Send, ChevronDown,
    ArrowLeft, ArrowRight, Check, Lock, Loader2, Plus, Minus
} from 'lucide-react';
import { supabase } from '../../../utils/supabaseClient';

const BRANCH_LIST = [
    'ຕະຫຼາດລາວ', 'ສີວິໄລ', 'ວັງຊາຍ', 'ໂພນສີນວນ',
    'ເມກ້າມໍ', 'ໂພນຕ້ອງ', 'ເທຣນນິ້ງ (Training)'
];

const EVAL_CRITERIA = [
    {
        id: 'leadership', category: 'ພາວະຜູ້ນຳ',
        title: 'ພາວະຜູ້ນຳ ແລະ ຄວາມເດັດຂາດໃນການຕັດສິນໃຈ',
        desc: 'ຄວາມສາມາດໃນການຊີ້ນຳ, ນຳພາທີມ, ແລະ ແກ້ໄຂບັນຫາໃນສະຖານະການກົດດັນ',
        options: [
            { id: 'lead_5', label: 'ຕັດສິນໃຈເດັດຂາດ, ຍຸດຕິທຳ ແລະ ເປັນທີ່ເພິ່ງພາໄດ້ສະເໝີ', score: 5 },
            { id: 'lead_4', label: 'ມີຄວາມເປັນຜູ້ນຳທີ່ດີ, ຮັບຟັງເຫດຜົນກ່ອນຕັດສິນໃຈ', score: 4 },
            { id: 'lead_3', label: 'ຕັດສິນໃຈໄດ້ປານກາງ, ບາງຄັ້ງຍັງລັງເລໃນວຽກສຳຄັນ', score: 3 },
            { id: 'lead_2', label: 'ມັກຫຼີກລ່ຽງການຕັດສິນໃຈ ປ່ອຍໃຫ້ທີມແກ້ໄຂເອງ', score: 2 }
        ]
    },
    {
        id: 'communication', category: 'ການສື່ສານ',
        title: 'ການສື່ສານ ແລະ ການຮັບຟັງຄວາມຄິດເຫັນຂອງລູກທີມ',
        desc: 'ການຖ່າຍທອດວຽກທີ່ຊັດເຈນ ແລະ ເປີດໂອກາດໃຫ້ພະນັກງານໄດ້ອອກສຽງ',
        options: [
            { id: 'comm_5', label: 'ສື່ສານຈະແຈ້ງ, ເວົ້າຈາສຸພາບ ແລະ ຮັບຟັງຄຳເຫັນຢ່າງເປີດກວ້າງ', score: 5 },
            { id: 'comm_4', label: 'ອະທິບາຍວຽກເຂົ້າໃຈງ່າຍ, ປຶກສາຫາລືໄດ້ສະດວກ', score: 4 },
            { id: 'comm_3', label: 'ສື່ສານພໍໃຊ້ໄດ້, ແຕ່ບາງຄັ້ງຄຳສັ່ງຍັງສັບສົນ', score: 3 },
            { id: 'comm_2', label: 'ບໍ່ຄ່ອຍຮັບຟັງຄຳເຫັນ ຫຼື ສື່ສານແບບສັ່ງການຝ່າຍດຽວ', score: 2 }
        ]
    },
    {
        id: 'support', category: 'ການຊ່ວຍເຫຼືອ',
        title: 'ການຊ່ວຍເຫຼືອ ແລະ ແກ້ໄຂບັນຫາໜ້າຮ້ານ',
        desc: 'ການລົງມາຊ່ວຍທີມເມື່ອລູກຄ້າແໜ້ນ ຫຼື ເມື່ອມີຂໍ້ຜິດພາດເກີດຂຶ້ນ',
        options: [
            { id: 'sup_5', label: 'ພ້ອມຊ່ວຍເຫຼືອທຸກເວລາ, ລົງມືແກ້ໄຂບັນຫາຄຽງຂ້າງທີມງານ', score: 5 },
            { id: 'sup_4', label: 'ໃຫ້ຄຳແນະນຳທີ່ດີ ແລະ ຊ່ວຍແກ້ໄຂບັນຫາໄດ້ທັນການ', score: 4 },
            { id: 'sup_3', label: 'ຊ່ວຍສະເພາະເມື່ອຮ້ອງຂໍ, ບໍ່ຄ່ອຍສັງເກດບັນຫາລ່ວງໜ້າ', score: 3 },
            { id: 'sup_2', label: 'ມັກປັດຄວາມຮັບຜິດຊອບ ຫຼື ບໍ່ຄ່ອຍຊ່ວຍແກ້ໄຂບັນຫາ', score: 2 }
        ]
    },
    {
        id: 'fairness', category: 'ຄວາມຍຸດຕິທຳ',
        title: 'ຄວາມຍຸດຕິທຳໃນການຈັດຕາຕະລາງ ແລະ ປະເມີນວຽກ',
        desc: 'ບໍ່ເລືອກປະຕິບັດ, ໃຫ້ໂອກາດ ແລະ ຄວາມເທົ່າທຽມແກ່ພະນັກງານທຸກຄົນ',
        options: [
            { id: 'fair_5', label: 'ຍຸດຕິທຳສູງສຸດ, ບໍ່ມີອະຄະຕິ, ຈັດກະ ແລະ ວຽກເທົ່າທຽມກັນ', score: 5 },
            { id: 'fair_4', label: 'ມີຄວາມຍຸດຕິທຳດີ, ປະຕິບັດຕາມກົດລະບຽບຢ່າງສະເໝີຕົ້ນສະເໝີປາຍ', score: 4 },
            { id: 'fair_3', label: 'ບາງຄັ້ງຍັງມີຄວາມລຳອຽງເລັກນ້ອຍໃນການຈັດວຽກ', score: 3 },
            { id: 'fair_2', label: 'ເລືອກປະຕິບັດຢ່າງເຫັນໄດ້ຊັດເຈນ, ຂາດຄວາມຍຸດຕິທຳ', score: 2 }
        ]
    },
    {
        id: 'motivation', category: 'ບັນຍາກາດ',
        title: 'ການສ້າງບັນຍາກາດ ແລະ ກຳລັງໃຈໃນການເຮັດວຽກ',
        desc: 'ເຮັດໃຫ້ບ່ອນເຮັດວຽກໜ້າຢູ່, ໃຫ້ກຽດ ແລະ ຍ້ອງຍໍເມື່ອທີມເຮັດວຽກດີ',
        options: [
            { id: 'mot_5', label: 'ສ້າງພະລັງບວກ, ໃຫ້ກຳລັງໃຈສະເໝີ ເຮັດໃຫ້ເຮັດວຽກຢ່າງມີຄວາມສຸກ', score: 5 },
            { id: 'mot_4', label: 'ບັນຍາກາດການເຮັດວຽກເປັນມິດ, ໃຫ້ກຽດເຊິ່ງກັນແລະກັນ', score: 4 },
            { id: 'mot_3', label: 'ບັນຍາກາດທຳມະດາ, ບໍ່ຄ່ອຍມີການຍ້ອງຍໍ ຫຼື ໃຫ້ກຳລັງໃຈ', score: 3 },
            { id: 'mot_2', label: 'ສ້າງຄວາມກົດດັນເກີນຄວາມຈຳເປັນ, ບັນຍາກາດເຄັ່ງຄຽດ', score: 2 }
        ]
    },
    {
        id: 'delegation', category: 'ການວາງແຜນ',
        title: 'ການວາງແຜນ ແລະ ແບ່ງປັນໜ້າທີ່ຄວາມຮັບຜິດຊອບ',
        desc: 'ວຽກມີລະບົບ, ບໍ່ເຮັດໃຫ້ໃຜຄົນໜຶ່ງໜັກເກີນໄປ, ຕິດຕາມວຽກຢ່າງເໝາະສົມ',
        options: [
            { id: 'del_5', label: 'ວາງແຜນຊັດເຈນ, ແບ່ງວຽກເໝາະສົມຕາມຄວາມສາມາດຂອງແຕ່ລະຄົນ', score: 5 },
            { id: 'del_4', label: 'ຈັດວຽກໄດ້ດີ, ຕິດຕາມຄວາມຄືບໜ້າຢ່າງຕໍ່ເນື່ອງ', score: 4 },
            { id: 'del_3', label: 'ການວາງແຜນຍັງກະທັນຫັນເລື້ອຍໆ, ແບ່ງວຽກຍັງບໍ່ຄ່ອຍສົມດຸນ', score: 3 },
            { id: 'del_2', label: 'ຂາດການວາງແຜນ, ວຽກສັບສົນ ແລະ ມັກເກີດວຽກຊ້ອນກັນ', score: 2 }
        ]
    }
];

const STEP_NAMES = [...EVAL_CRITERIA.map(c => c.category), 'ຄະແນນລວມ'];
const TOTAL_STEPS = 7;

/* ───────── small shared pieces ───────── */
function Notice({ icon, tone, title, children, onBack }) {
    const toneCls = tone === 'ok'
        ? 'bg-emerald-100 text-emerald-800'
        : 'bg-rose-100 text-rose-700';
    return (
        <div className="max-w-xl mx-auto my-auto w-full bg-white rounded-[28px] border border-stone-200 shadow-[0_20px_60px_-30px_rgba(16,35,31,0.35)] p-8 sm:p-12 text-center space-y-5">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${toneCls}`}>{icon}</div>
            <h2 className="text-2xl font-bold text-[#10231F]">{title}</h2>
            <div className="text-sm text-stone-600 leading-relaxed space-y-2">{children}</div>
            {onBack && (
                <button onClick={onBack}
                    className="mt-2 px-7 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">
                    ກັບສູ່ໜ້າຫຼັກ
                </button>
            )}
        </div>
    );
}

/* ───────── main component ───────── */
export default function ManagerEvaluation({ onBack, currentUser, isAdmin = false }) {
    const userBranch = currentUser?.branch_id || localStorage.getItem('joah_branch_id') || 'ຕະຫຼາດລາວ';
    const [selectedBranch, setSelectedBranch] = useState(userBranch);

    const [hasAlreadyVoted, setHasAlreadyVoted] = useState(false);
    const [isCheckingVoted, setIsCheckingVoted] = useState(true);
    const [votedBranch, setVotedBranch] = useState(null);
    const [votedAt, setVotedAt] = useState(null);

    const [currentStep, setCurrentStep] = useState(0);
    const [overallRating, setOverallRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [criteriaAnswers, setCriteriaAnswers] = useState({});
    const [showCustomInput, setShowCustomInput] = useState({});
    const [customRemarks, setCustomRemarks] = useState({});
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getVoterIdentifier = () => {
        const empId = currentUser?.id || currentUser?.employee_id || localStorage.getItem('joah_employee_id');
        if (empId) return `emp_${String(empId).trim().toUpperCase()}`;
        let t = localStorage.getItem('joah_anon_voter_token');
        if (!t) {
            t = 'anon_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
            localStorage.setItem('joah_anon_voter_token', t);
        }
        return t;
    };

    useEffect(() => {
        let isMounted = true;
        const check = async () => {
            setIsCheckingVoted(true);
            const voterToken = getVoterIdentifier();
            try {
                const { data, error } = await supabase
                    .from('manager_votes')
                    .select('id, branch_id, created_at')
                    .eq('voter_token', voterToken)
                    .limit(1);
                if (!isMounted) return;
                if (!error && data && data.length > 0) {
                    setHasAlreadyVoted(true);
                    setVotedBranch(data[0].branch_id);
                    setVotedAt(data[0].created_at);
                    localStorage.setItem('joah_has_voted_manager', 'true');
                    if (data[0].branch_id) localStorage.setItem('joah_voted_branch', data[0].branch_id);
                } else {
                    setHasAlreadyVoted(false);
                    setVotedBranch(null);
                    setVotedAt(null);
                    localStorage.removeItem('joah_has_voted_manager');
                    localStorage.removeItem('joah_voted_branch');
                }
            } catch (err) {
                console.error('[Check Voted Error]', err);
                if (isMounted) setHasAlreadyVoted(false);
            } finally {
                if (isMounted) setIsCheckingVoted(false);
            }
        };
        check();
        return () => { isMounted = false; };
    }, [currentUser]);

    const handleSelectOption = (cid, oid) => {
        setCriteriaAnswers(p => ({ ...p, [cid]: oid }));
    };

    const handleToggleCustom = (cid) => {
        setShowCustomInput(prev => {
            const next = !prev[cid];
            if (next) setCriteriaAnswers(p => ({ ...p, [cid]: 'other' }));
            return { ...prev, [cid]: next };
        });
    };

    const handleReset = () => {
        setOverallRating(0); setHoverRating(0);
        setCriteriaAnswers({}); setShowCustomInput({}); setCustomRemarks({});
        setCurrentStep(0); setIsSubmitted(false);
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (hasAlreadyVoted) {
            alert('ທ່ານໄດ້ໃຊ້ສິດໂຫວດຮຽບຮ້ອຍແລ້ວ! ລະບົບອະນຸຍາດໃຫ້ 1 ທ່ານ ໂຫວດໄດ້ພຽງ 1 ຄັ້ງເທົ່ານັ້ນ');
            return;
        }
        if (overallRating === 0) {
            alert('ກະລຸນາເລືອກຄະແນນລວມ (1-10) ກ່ອນກົດຢືນຢັນການໂຫວດ!');
            return;
        }
        setIsSubmitting(true);
        try {
            const now = new Date();
            const voteMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const voterToken = getVoterIdentifier();

            const { data: existingVotes } = await supabase
                .from('manager_votes').select('id, branch_id')
                .eq('voter_token', voterToken).limit(1);

            if (existingVotes && existingVotes.length > 0) {
                setHasAlreadyVoted(true);
                setVotedBranch(existingVotes[0].branch_id);
                localStorage.setItem('joah_has_voted_manager', 'true');
                if (existingVotes[0].branch_id) localStorage.setItem('joah_voted_branch', existingVotes[0].branch_id);
                alert('ທ່ານໄດ້ໃຊ້ສິດໂຫວດຮຽບຮ້ອຍແລ້ວ! ລະບົບອະນຸຍາດໃຫ້ 1 ທ່ານ ໂຫວດໄດ້ພຽງ 1 ຄັ້ງເທົ່ານັ້ນ');
                setIsSubmitting(false);
                return;
            }

            const { error } = await supabase.from('manager_votes').insert([{
                branch_id: selectedBranch,
                manager_id: `MGR-${selectedBranch}`,
                manager_name: `Manager ສາຂາ ${selectedBranch}`,
                overall_score: overallRating,
                criteria_scores: criteriaAnswers,
                custom_remarks: customRemarks,
                voter_token: voterToken,
                vote_month: voteMonth
            }]);
            if (error) { console.error('[Vote Submit Error]', error); throw error; }

            localStorage.setItem('joah_has_voted_manager', 'true');
            localStorage.setItem('joah_voted_branch', selectedBranch);
            setVotedBranch(selectedBranch);
            setHasAlreadyVoted(true);
            setIsSubmitted(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            console.error('[Submit Error]', err);
            alert('ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກຜົນໂຫວດ: ' + (err.message || 'ກະລຸນາກວດສອບອິນເຕີເນັດ'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const canProceed = () => {
        if (currentStep <= 5) return Boolean(criteriaAnswers[EVAL_CRITERIA[currentStep].id]);
        return overallRating > 0;
    };

    // furthest step the voter may open: every step before it must be answered
    const firstUnanswered = EVAL_CRITERIA.findIndex(c => !criteriaAnswers[c.id]);
    const maxReachable = firstUnanswered === -1 ? 6 : firstUnanswered;

    const goTo = (i) => {
        if (i <= maxReachable) { setCurrentStep(i); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    };
    const handleNext = () => {
        if (currentStep < 6) { setCurrentStep(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        else handleSubmit();
    };
    const handlePrev = () => {
        if (currentStep > 0) { setCurrentStep(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    };

    const shownRating = hoverRating || overallRating;
    const ratingLabel = (n) =>
        n === 0 ? 'ເລືອກຄະແນນ 1 ຫາ 10'
            : n <= 3 ? 'ຕ້ອງປັບປຸງດ່ວນ'
                : n <= 5 ? 'ປານກາງ'
                    : n <= 7 ? 'ດີ'
                        : n <= 9 ? 'ດີຫຼາຍ' : 'ດີເລີດທີ່ສຸດ';

    const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800';

    return (
        <div className="min-h-screen w-full bg-[#EDF1EE] text-[#10231F] font-lao antialiased flex flex-col pb-12">

            {/* ── header ── */}
            <header className="sticky top-0 z-40 bg-[#EDF1EE]/95 backdrop-blur-md border-b border-stone-300/80 shadow-xs">
                <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        {onBack && (
                            <button onClick={onBack} title="ກັບຄືນໜ້າຫຼັກ"
                                className={`p-2.5 sm:p-3 rounded-2xl bg-white border border-stone-300 text-stone-600 hover:text-emerald-800 hover:border-emerald-800 shadow-xs transition-all ${focusRing}`}>
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        <div className="min-w-0">
                            <h1 className="text-lg sm:text-2xl font-bold truncate text-[#10231F]">ໂຫວດປະເມີນຜູ້ຈັດການສາຂາ</h1>
                            <p className="text-xs sm:text-sm text-stone-500 hidden sm:block">ລະບົບປະເມີນແບບປິດລັບ · 1 ທ່ານ / 1 ສິດໂຫວດ</p>
                        </div>
                    </div>

                    <div className="flex items-center bg-white border border-stone-300 rounded-2xl px-4 py-2.5 shadow-xs shrink-0">
                        <Building2 size={18} className="text-emerald-800 mr-2.5" />
                        {!hasAlreadyVoted && !isSubmitted ? (
                            <div className="relative inline-flex items-center">
                                <select value={selectedBranch}
                                    onChange={(e) => { setSelectedBranch(e.target.value); handleReset(); }}
                                    aria-label="ເລືອກສາຂາ"
                                    className="bg-transparent text-sm sm:text-base font-bold pr-7 focus:outline-none cursor-pointer appearance-none text-[#10231F]">
                                    {BRANCH_LIST.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                                <ChevronDown size={16} className="absolute right-0 pointer-events-none text-stone-500" />
                            </div>
                        ) : (
                            <span className="text-sm sm:text-base font-bold text-emerald-800">{votedBranch || selectedBranch}</span>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 lg:px-12 pt-6 sm:pt-8 flex-1 flex flex-col justify-center">

                {isCheckingVoted ? (
                    <div className="my-auto text-center py-28 space-y-4">
                        <Loader2 size={38} className="animate-spin text-emerald-800 mx-auto" />
                        <p className="text-base text-stone-600">ກຳລັງກວດສອບສິດການໂຫວດ...</p>
                    </div>

                ) : hasAlreadyVoted && !isSubmitted ? (
                    <Notice tone="ok" icon={<ShieldCheck size={36} />} onBack={onBack}
                        title="ທ່ານໄດ້ໃຊ້ສິດໂຫວດແລ້ວ">
                        <p className="font-bold text-base text-emerald-800">ໂຫວດໃຫ້ Manager ສາຂາ {votedBranch || selectedBranch}</p>
                        <p className="text-sm">ພະນັກງານ 1 ທ່ານ ໂຫວດໄດ້ພຽງ 1 ຄັ້ງ ເພື່ອໃຫ້ຜົນໂຫວດຍຸດຕິທຳ ແລະ ໂປ່ງໃສ.</p>
                    </Notice>

                ) : isSubmitted ? (
                    <Notice tone="ok" icon={<CheckCircle2 size={38} />} onBack={onBack}
                        title="ບັນທຶກຜົນໂຫວດແລ້ວ">
                        <p className="text-base">ຂອບໃຈທີ່ປະເມີນ Manager ສາຂາ {selectedBranch}. ຜົນໂຫວດຂອງທ່ານຖືກບັນທຶກລົງຖານຂໍ້ມູນແລ້ວ.</p>
                    </Notice>

                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-stretch my-auto">

                        {/* ── left: ballot summary + step list ── */}
                        <aside className="lg:col-span-4 flex flex-col justify-between space-y-4 lg:space-y-5">
                            <div className="space-y-4">
                                <div className="bg-[#10231F] text-white rounded-[28px] p-6 sm:p-8 shadow-md">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-800/80 text-emerald-200 text-xs font-bold tracking-wider uppercase mb-2">
                                        ບັດໂຫວດປະເມີນ
                                    </span>
                                    <h2 className="text-2xl sm:text-3xl font-extrabold mt-1 leading-tight tracking-tight">
                                        Manager<br />ສາຂາ {selectedBranch}
                                    </h2>
                                    <p className="text-sm sm:text-base text-emerald-100/80 mt-3 leading-relaxed">
                                        ຕອບ 6 ຄຳຖາມດ້ານຕ່າງໆ ແລ້ວໃຫ້ຄະແນນລວມ 1 ຫາ 10 ດາວ
                                    </p>
                                </div>

                                <nav aria-label="ຂັ້ນຕອນ" className="bg-white rounded-[28px] border border-stone-200/90 shadow-sm p-4">
                                    <ol className="space-y-1.5">
                                        {STEP_NAMES.map((name, i) => {
                                            const done = i < 6 ? Boolean(criteriaAnswers[EVAL_CRITERIA[i].id]) : overallRating > 0;
                                            const active = currentStep === i;
                                            const locked = i > maxReachable;
                                            return (
                                                <li key={name}>
                                                    <button type="button" onClick={() => goTo(i)} disabled={locked}
                                                        aria-current={active ? 'step' : undefined}
                                                        className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-left text-sm sm:text-base transition-all disabled:cursor-not-allowed ${focusRing} ${active ? 'bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                                                            : locked ? 'text-stone-400' : 'text-stone-700 hover:bg-stone-50'
                                                            }`}>
                                                        <span className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs sm:text-sm font-bold ${done ? 'bg-emerald-800 text-white'
                                                            : active ? 'border-2 border-emerald-800 text-emerald-800 bg-white'
                                                                : 'border border-stone-300 text-stone-400'
                                                            }`}>
                                                            {done ? <Check size={15} strokeWidth={3} /> : i + 1}
                                                        </span>
                                                        <span className="truncate">{name}</span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                </nav>
                            </div>

                            <div className="flex items-center gap-3 px-3 py-2 text-xs sm:text-sm text-stone-600 leading-relaxed bg-white/70 rounded-2xl border border-stone-200">
                                <Lock size={18} className="shrink-0 text-emerald-800" />
                                <p>ລະບົບເກັບຜົນໂຫວດເປັນຄວາມລັບບໍ່ລະບຸຜູ້ໂຫວດແຕ່ລະທ່ານໂຫວດໄດ້ພຽງ 1 ຄັ້ງ.ຂໍໃຫ້ໂຫວດຕາມຄວາມຮູ້ສຶກໂປ່ງໃສເເລະເປັນຈິງ</p>
                            </div>
                        </aside>

                        {/* ── right: question card ── */}
                        <section className="lg:col-span-8 bg-white rounded-[32px] border border-stone-200 shadow-[0_20px_60px_-35px_rgba(16,35,31,0.25)] p-6 sm:p-10 lg:p-12 min-h-[580px] flex flex-col justify-between">

                            <div className="flex-1">
                                {currentStep <= 5 && (() => {
                                    const c = EVAL_CRITERIA[currentStep];
                                    const otherOpen = Boolean(showCustomInput[c.id]);
                                    return (
                                        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
                                            <div className="border-b border-stone-200 pb-5">
                                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-bold uppercase tracking-wider mb-2">
                                                    <span>ຄຳຖາມ {currentStep + 1} ຈາກ 6 · {c.category}</span>
                                                </div>
                                                <h3 className="text-2xl sm:text-3xl font-extrabold text-[#10231F] mt-1 leading-snug tracking-tight">
                                                    {c.title}
                                                </h3>
                                                <p className="text-sm sm:text-base text-stone-600 mt-2 leading-relaxed">
                                                    {c.desc}
                                                </p>
                                            </div>

                                            <div role="radiogroup" aria-label={c.title} className="space-y-3 pt-1">
                                                {c.options.map(opt => {
                                                    const sel = criteriaAnswers[c.id] === opt.id;
                                                    return (
                                                        <button key={opt.id} type="button" role="radio" aria-checked={sel}
                                                            onClick={() => handleSelectOption(c.id, opt.id)}
                                                            className={`w-full text-left px-5 py-4 sm:py-5 rounded-2xl border-2 flex items-center gap-4 transition-all active:scale-[0.995] cursor-pointer ${focusRing} ${sel ? 'border-emerald-800 bg-emerald-50/90 shadow-xs ring-2 ring-emerald-800/10'
                                                                : 'border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50/50'
                                                                }`}>
                                                            <span className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center border-2 transition-all ${sel ? 'bg-emerald-800 border-emerald-800 text-white' : 'border-stone-300 bg-white'
                                                                }`}>
                                                                {sel && <Check size={18} strokeWidth={3} />}
                                                            </span>
                                                            <span className={`text-base sm:text-lg leading-relaxed ${sel ? 'font-bold text-emerald-950' : 'text-stone-800'}`}>
                                                                {opt.label}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div className="pt-2">
                                                <button type="button" onClick={() => handleToggleCustom(c.id)}
                                                    aria-expanded={otherOpen}
                                                    className={`inline-flex items-center gap-2 text-sm sm:text-base font-bold py-1.5 px-2 rounded-xl transition-colors cursor-pointer ${focusRing} ${otherOpen ? 'text-emerald-800 bg-emerald-50' : 'text-stone-600 hover:text-emerald-800'
                                                        }`}>
                                                    {otherOpen ? <Minus size={18} /> : <Plus size={18} />}
                                                    ຂຽນຄວາມຄິດເຫັນເພີ່ມເຕີມ ຫຼື ເຫດຜົນເອງ
                                                </button>
                                                {otherOpen && (
                                                    <textarea
                                                        value={customRemarks[c.id] || ''}
                                                        onChange={(e) => setCustomRemarks(p => ({ ...p, [c.id]: e.target.value }))}
                                                        placeholder="ພິມຄວາມຄິດເຫັນ ຫຼື ເຫດຜົນຂອງທ່ານສຳລັບຄຳຖາມນີ້..."
                                                        rows={3}
                                                        className="select-text mt-3 w-full bg-stone-50 border-2 border-stone-200 rounded-2xl p-4 text-sm sm:text-base placeholder-stone-400 focus:outline-none focus:border-emerald-800 resize-none leading-relaxed transition-all"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {currentStep === 6 && (
                                    <div className="space-y-8 animate-in fade-in duration-200">
                                        <div className="border-b border-stone-200 pb-5">
                                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-bold uppercase tracking-wider mb-2">
                                                <span>ຂັ້ນຕອນສຸດທ້າຍ · ຄະແນນລວມ</span>
                                            </div>
                                            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#10231F] mt-1 leading-snug tracking-tight">
                                                ໂດຍລວມແລ້ວ ທ່ານພໍໃຈ Manager ສາຂາ {selectedBranch} ຫຼາຍປານໃດ?
                                            </h3>
                                            <p className="text-sm sm:text-base text-stone-600 mt-2">
                                                ເລືອກຄະແນນ 1 ດາວ (ຕ້ອງປັບປຸງດ່ວນ) ຫາ 10 ດາວ (ດີເລີດທີ່ສຸດ)
                                            </p>
                                        </div>

                                        <div className="flex items-end gap-5 bg-stone-50 p-6 rounded-3xl border border-stone-200">
                                            <span className="text-7xl sm:text-9xl font-extrabold leading-none tabular-nums text-emerald-800">
                                                {shownRating || '–'}
                                            </span>
                                            <div className="pb-3 text-stone-600 space-y-1">
                                                <span className="block text-sm text-stone-400 font-bold uppercase tracking-wider">ຄະແນນເຕັມ 10</span>
                                                <span className="block font-extrabold text-stone-900 text-lg sm:text-2xl">{ratingLabel(shownRating)}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div role="radiogroup" aria-label="ຄະແນນລວມ 1 ຫາ 10" className="grid grid-cols-5 sm:grid-cols-10 gap-2 sm:gap-2.5">
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => {
                                                    const sel = overallRating === n;
                                                    const filled = shownRating >= n;
                                                    return (
                                                        <button key={n} type="button" role="radio" aria-checked={sel}
                                                            onClick={() => setOverallRating(n)}
                                                            onMouseEnter={() => setHoverRating(n)}
                                                            onMouseLeave={() => setHoverRating(0)}
                                                            onFocus={() => setHoverRating(n)}
                                                            onBlur={() => setHoverRating(0)}
                                                            className={`h-14 sm:h-16 rounded-2xl border-2 text-lg sm:text-xl font-bold tabular-nums transition-all active:scale-95 cursor-pointer ${focusRing} ${sel ? 'bg-emerald-800 border-emerald-800 text-white shadow-md'
                                                                : filled ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                                                                    : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'
                                                                }`}>
                                                            {n}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex justify-between text-xs sm:text-sm font-semibold text-stone-500 mt-2.5 px-2">
                                                <span>1 = ຕ້ອງປັບປຸງດ່ວນ</span>
                                                <span>10 = ດີເລີດທີ່ສຸດ</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* actions */}
                            <div className="pt-6 sm:pt-8 mt-8 border-t border-stone-200 flex items-center justify-between gap-4">
                                <button type="button" onClick={handlePrev} disabled={currentStep === 0 || isSubmitting}
                                    className={`px-6 py-3.5 sm:px-7 sm:py-4 rounded-2xl border-2 border-stone-300 text-stone-700 hover:border-stone-500 hover:text-stone-900 text-sm sm:text-base font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer ${focusRing}`}>
                                    <ArrowLeft size={18} />
                                    ຍ້ອນກັບ
                                </button>

                                {currentStep < 6 ? (
                                    <button type="button" onClick={handleNext} disabled={!canProceed()}
                                        className={`px-8 py-3.5 sm:px-10 sm:py-4 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white text-sm sm:text-base font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2.5 cursor-pointer ${focusRing}`}>
                                        <span>ຖັດໄປ</span>
                                        <ArrowRight size={18} />
                                    </button>
                                ) : (
                                    <button type="button" onClick={handleSubmit}
                                        disabled={isSubmitting || overallRating === 0 || firstUnanswered !== -1}
                                        className={`px-9 py-3.5 sm:px-12 sm:py-4 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white text-sm sm:text-base font-bold shadow-lg transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2.5 cursor-pointer ${focusRing}`}>
                                        {isSubmitting
                                            ? <><Loader2 size={18} className="animate-spin" /><span>ກຳລັງບັນທຶກ...</span></>
                                            : <><Send size={18} /><span>ສົ່ງຜົນໂຫວດ</span></>}
                                    </button>
                                )}
                            </div>
                        </section>
                    </div>
                )}
            </main>
        </div>
    );
}
