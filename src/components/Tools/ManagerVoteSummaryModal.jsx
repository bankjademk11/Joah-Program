import React, { useState, useEffect, useMemo } from 'react';
import {
  Star, Building2, Users, TrendingUp, RefreshCw, Search,
  MessageSquare, Eye, X, Loader2
} from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';

const BRANCH_LIST = [
  'ຕະຫຼາດລາວ', 'ສີວິໄລ', 'ວັງຊາຍ', 'ໂພນສີນວນ',
  'ເມກ້າມໍ', 'ໂພນຕ້ອງ', 'ເທຣນນິ້ງ (Training)'
];

const EVAL_CRITERIA_MAP = {
  leadership: {
    category: 'ພາວະຜູ້ນຳ & ການຕັດສິນໃຈ',
    title: 'ພາວະຜູ້ນຳ ແລະ ຄວາມເດັດຂາດໃນການຕັດສິນໃຈ',
    options: {
      lead_5: { text: 'ຕັດສິນໃຈເດັດຂາດ, ຍຸດຕິທຳ ແລະ ເປັນທີ່ເພິ່ງພາໄດ້ສະເໝີ', score: 5 },
      lead_4: { text: 'ມີຄວາມເປັນຜູ້ນຳທີ່ດີ, ຮັບຟັງເຫດຜົນກ່ອນຕັດສິນໃຈ', score: 4 },
      lead_3: { text: 'ຕັດສິນໃຈໄດ້ປານກາງ, ບາງຄັ້ງຍັງລັງເລໃນວຽກສຳຄັນ', score: 3 },
      lead_2: { text: 'ມັກຫຼີກລ່ຽງການຕັດສິນໃຈ ປ່ອຍໃຫ້ທີມແກ້ໄຂເອງ', score: 2 }
    }
  },
  communication: {
    category: 'ການສື່ສານ & ຮັບຟັງ',
    title: 'ການສື່ສານ ແລະ ການຮັບຟັງຄວາມຄິດເຫັນຂອງລູກທີມ',
    options: {
      comm_5: { text: 'ສື່ສານຈະແຈ້ງ, ເວົ້າຈາສຸພາບ ແລະ ຮັບຟັງຄຳເຫັນຢ່າງເປີດກວ້າງ', score: 5 },
      comm_4: { text: 'ອະທິບາຍວຽກເຂົ້າໃຈງ່າຍ, ປຶກສາຫາລືໄດ້ສະດວກ', score: 4 },
      comm_3: { text: 'ສື່ສານພໍໃຊ້ໄດ້, ແຕ່ບາງຄັ້ງຄຳສັ່ງຍັງສັບສົນ', score: 3 },
      comm_2: { text: 'ບໍ່ຄ່ອຍຮັບຟັງຄຳເຫັນ ຫຼື ສື່ສານແບບສັ່ງການຝ່າຍດຽວ', score: 2 }
    }
  },
  support: {
    category: 'ການຊ່ວຍເຫຼືອ & ແກ້ໄຂບັນຫາ',
    title: 'ການຊ່ວຍເຫຼືອ ແລະ ແກ້ໄຂບັນຫາໜ້າຮ້ານ',
    options: {
      sup_5: { text: 'ພ້ອມຊ່ວຍເຫຼືອທຸກເວລາ, ລົງມືແກ້ໄຂບັນຫາຄຽງຂ້າງທີມງານ', score: 5 },
      sup_4: { text: 'ໃຫ້ຄຳແນະນຳທີ່ດີ ແລະ ຊ່ວຍແກ້ໄຂບັນຫາໄດ້ທັນການ', score: 4 },
      sup_3: { text: 'ຊ່ວຍສະເພາະເມື່ອຮ້ອງຂໍ, ບໍ່ຄ່ອຍສັງເກດບັນຫາລ່ວງໜ້າ', score: 3 },
      sup_2: { text: 'ມັກປັດຄວາມຮັບຜິດຊອບ ຫຼື ບໍ່ຄ່ອຍຊ່ວຍແກ້ໄຂບັນຫາ', score: 2 }
    }
  },
  fairness: {
    category: 'ຄວາມຍຸດຕິທຳ & ຄວາມໂປ່ງໃສ',
    title: 'ຄວາມຍຸດຕິທຳໃນການຈັດຕາຕະລາງ ແລະ ປະເມີນວຽກ',
    options: {
      fair_5: { text: 'ຍຸດຕິທຳສູງສຸດ, ບໍ່ມີອະຄະຕິ, ຈັດກະ ແລະ ວຽກເທົ່າທຽມກັນ', score: 5 },
      fair_4: { text: 'ມີຄວາມຍຸດຕິທຳດີ, ປະຕິບັດຕາມກົດລະບຽບຢ່າງສະເໝີຕົ້ນສະເໝີປາຍ', score: 4 },
      fair_3: { text: 'ບາງຄັ້ງຍັງມີຄວາມລຳອຽງເລັກນ້ອຍໃນການຈັດວຽກ', score: 3 },
      fair_2: { text: 'ເລືອກປະຕິບັດຢ່າງເຫັນໄດ້ຊັດເຈນ, ຂາດຄວາມຍຸດຕິທຳ', score: 2 }
    }
  },
  motivation: {
    category: 'ກຳລັງໃຈ & ບັນຍາກາດການເຮັດວຽກ',
    title: 'ການສ້າງບັນຍາກາດ ແລະ ກຳລັງໃຈໃນການເຮັດວຽກ',
    options: {
      mot_5: { text: 'ສ້າງພະລັງບວກ, ໃຫ້ກຳລັງໃຈສະເໝີ ເຮັດໃຫ້ເຮັດວຽກຢ່າງມີຄວາມສຸກ', score: 5 },
      mot_4: { text: 'ບັນຍາກາດການເຮັດວຽກເປັນມິດ, ໃຫ້ກຽດເຊິ່ງກັນແລະກັນ', score: 4 },
      mot_3: { text: 'ບັນຍາກາດທຳມະດາ, ບໍ່ຄ່ອຍມີການຍ້ອງຍໍ ຫຼື ໃຫ້ກຳລັງໃຈ', score: 3 },
      mot_2: { text: 'ສ້າງຄວາມກົດດັນເກີນຄວາມຈຳເປັນ, ບັນຍາກາດເຄັ່ງຄຽດ', score: 2 }
    }
  },
  delegation: {
    category: 'ການວາງແຜນ & ກະຈາຍວຽກ',
    title: 'ການວາງແຜນ ແລະ ແບ່ງປັນໜ້າທີ່ຄວາມຮັບຜິດຊອບ',
    options: {
      del_5: { text: 'ວາງແຜນຊັດເຈນ, ແບ່ງວຽກເໝາະສົມຕາມຄວາມສາມາດຂອງແຕ່ລະຄົນ', score: 5 },
      del_4: { text: 'ຈັດວຽກໄດ້ດີ, ຕິດຕາມຄວາມຄືບໜ້າຢ່າງຕໍ່ເນື່ອງ', score: 4 },
      del_3: { text: 'ການວາງແຜນຍັງກະທັນຫັນເລື້ອຍໆ, ແບ່ງວຽກຍັງບໍ່ຄ່ອຍສົມດຸນ', score: 3 },
      del_2: { text: 'ຂາດການວາງແຜນ, ວຽກສັບສົນ ແລະ ມັກເກີດວຽກຊ້ອນກັນ', score: 2 }
    }
  }
};

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800';

export default function ManagerVoteSummaryModal({ isOpen, onClose }) {
  const [votes, setVotes] = useState([]);
  const [employeesMap, setEmployeesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVoteDetail, setSelectedVoteDetail] = useState(null);

  const fetchVoteData = async () => {
    setLoading(true);
    try {
      const { data: voteData, error: voteErr } = await supabase
        .from('manager_votes')
        .select('*')
        .order('created_at', { ascending: false });
      if (voteErr) throw voteErr;
      setVotes(voteData || []);

      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .select('employee_id, name, role, workplace, branch_id');

      if (!empErr && empData) {
        const empLookup = {};
        empData.forEach(e => {
          if (e.employee_id) {
            empLookup[e.employee_id.toUpperCase()] = e;
            empLookup[`EMP_${e.employee_id.toUpperCase()}`] = e;
          }
        });
        setEmployeesMap(empLookup);
      }
    } catch (err) {
      console.error('[Fetch Votes Error]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isOpen) fetchVoteData(); }, [isOpen]);

  const availableMonths = useMemo(() => {
    const set = new Set();
    votes.forEach(v => { if (v.vote_month) set.add(v.vote_month); });
    return Array.from(set).sort().reverse();
  }, [votes]);

  const filteredVotes = useMemo(() => {
    return votes.filter(v => {
      if (selectedBranchFilter !== 'ALL' && v.branch_id !== selectedBranchFilter) return false;
      if (selectedMonthFilter !== 'ALL' && v.vote_month !== selectedMonthFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const branchMatch = (v.branch_id || '').toLowerCase().includes(q);
        const managerMatch = (v.manager_name || '').toLowerCase().includes(q);
        const tokenMatch = (v.voter_token || '').toLowerCase().includes(q);
        const empInfo = employeesMap[(v.voter_token || '').toUpperCase()];
        const empNameMatch = empInfo && empInfo.name.toLowerCase().includes(q);
        if (!branchMatch && !managerMatch && !tokenMatch && !empNameMatch) return false;
      }
      return true;
    });
  }, [votes, selectedBranchFilter, selectedMonthFilter, searchQuery, employeesMap]);

  const branchStats = useMemo(() => {
    const stats = {};
    BRANCH_LIST.forEach(b => { stats[b] = { count: 0, totalScore: 0, avgScore: '0.0' }; });
    votes.forEach(v => {
      const b = v.branch_id;
      if (b && stats[b]) {
        stats[b].count += 1;
        stats[b].totalScore += Number(v.overall_score || 0);
      }
    });
    Object.keys(stats).forEach(b => {
      stats[b].avgScore = stats[b].count > 0 ? (stats[b].totalScore / stats[b].count).toFixed(1) : '0.0';
    });
    return stats;
  }, [votes]);

  const totalVotesCount = votes.length;
  const avgSystemScore = totalVotesCount > 0
    ? (votes.reduce((acc, v) => acc + Number(v.overall_score || 0), 0) / totalVotesCount).toFixed(1)
    : '0.0';

  const topBranchText = useMemo(() => {
    let maxB = '-', maxC = 0;
    Object.entries(branchStats).forEach(([b, s]) => { if (s.count > maxC) { maxC = s.count; maxB = b; } });
    return maxC > 0 ? `${maxB} (${maxC} ສຽງ)` : 'ຍັງບໍ່ມີ';
  }, [branchStats]);

  const remarkCount = votes.filter(v => v.custom_remarks && Object.values(v.custom_remarks).some(r => r && r.trim())).length;

  const findEmp = (token) => {
    const raw = token.startsWith('emp_') ? token.replace('emp_', '') : token;
    return employeesMap[raw.toUpperCase()] || employeesMap[token.toUpperCase()];
  };

  if (!isOpen) return null;

  const kpis = [
    { label: 'ຈຳນວນຜູ້ໂຫວດທັງໝົດ', value: totalVotesCount, unit: 'ທ່ານ', icon: <Users size={16} /> },
    { label: 'ຄະແນນສະເລ່ຍລວມ', value: avgSystemScore, unit: '/ 10', icon: <Star size={16} /> },
    { label: 'ສາຂາທີ່ຖືກໂຫວດຫຼາຍສຸດ', value: topBranchText, small: true, icon: <TrendingUp size={16} /> },
    { label: 'ມີຄວາມຄິດເຫັນເພີ່ມເຕີມ', value: remarkCount, unit: 'ລາຍການ', icon: <MessageSquare size={16} /> }
  ];

  return (
    <div className="fixed inset-0 z-[10000] bg-[#10231F]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 font-lao text-[#10231F]">
      <div className="bg-[#EDF1EE] rounded-[28px] w-full max-w-7xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">

        {/* header */}
        <div className="px-6 py-4 border-b border-stone-300/70 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold truncate">ສະຫຼຸບຜົນໂຫວດ Manager ສາຂາ</h2>
            <p className="text-xs text-stone-500 mt-0.5">ສຳລັບ GM ແລະ HQ ເທົ່ານັ້ນ</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={fetchVoteData} disabled={loading} title="ໂຫຼດຂໍ້ມູນໃໝ່" aria-label="ໂຫຼດຂໍ້ມູນໃໝ່"
              className={`p-2.5 rounded-xl bg-white border border-stone-300 text-stone-600 hover:text-emerald-800 hover:border-emerald-800 transition-colors ${focusRing}`}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} title="ປິດ" aria-label="ປິດ"
              className={`p-2.5 rounded-xl bg-white border border-stone-300 text-stone-600 hover:text-rose-700 hover:border-rose-600 transition-colors ${focusRing}`}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map(k => (
              <div key={k.label} className="bg-white rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>{k.label}</span>
                  <span className="text-emerald-800">{k.icon}</span>
                </div>
                <div className={`mt-2 font-bold text-emerald-800 tabular-nums ${k.small ? 'text-lg truncate' : 'text-3xl'}`}>
                  {k.value}
                  {k.unit && <span className="text-xs font-normal text-stone-500 ml-1">{k.unit}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* branch overview */}
          <section className="bg-white rounded-[24px] border border-stone-200 p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Building2 size={16} className="text-emerald-800" />
                ຄະແນນສະເລ່ຍລາຍສາຂາ
              </h3>
              <span className="text-xs text-stone-500">ກົດທີ່ສາຂາເພື່ອກັ່ນຕອງ</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {BRANCH_LIST.map(b => {
                const s = branchStats[b];
                const sel = selectedBranchFilter === b;
                return (
                  <button key={b} onClick={() => setSelectedBranchFilter(sel ? 'ALL' : b)} aria-pressed={sel}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-colors ${focusRing} ${sel ? 'border-emerald-800 bg-emerald-50' : 'border-stone-200 bg-white hover:border-stone-400'
                      }`}>
                    <div className="text-xs font-bold truncate">{b}</div>
                    <div className="mt-2 text-2xl font-bold tabular-nums text-emerald-800">{s.avgScore}</div>
                    <div className="h-1.5 rounded-full bg-stone-200 mt-2 overflow-hidden">
                      <div className="h-full bg-emerald-700 rounded-full" style={{ width: `${Number(s.avgScore) * 10}%` }} />
                    </div>
                    <div className="text-xs text-stone-500 mt-2">{s.count} ສຽງ</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ຄົ້ນຫາຊື່ຜູ້ໂຫວດ, ລະຫັດພະນັກງານ ຫຼື ສາຂາ"
                  className="w-full bg-white border border-stone-300 rounded-xl pl-9 pr-3 py-2.5 text-sm placeholder-stone-400 focus:outline-none focus:border-emerald-800" />
              </div>
              <label className="flex items-center bg-white border border-stone-300 rounded-xl px-3 py-2.5 text-sm">
                <span className="text-stone-500 mr-2">ສາຂາ</span>
                <select value={selectedBranchFilter} onChange={e => setSelectedBranchFilter(e.target.value)}
                  className="bg-transparent font-bold focus:outline-none cursor-pointer">
                  <option value="ALL">ທຸກສາຂາ</option>
                  {BRANCH_LIST.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              {availableMonths.length > 0 && (
                <label className="flex items-center bg-white border border-stone-300 rounded-xl px-3 py-2.5 text-sm">
                  <span className="text-stone-500 mr-2">ເດືອນ</span>
                  <select value={selectedMonthFilter} onChange={e => setSelectedMonthFilter(e.target.value)}
                    className="bg-transparent font-bold focus:outline-none cursor-pointer">
                    <option value="ALL">ທຸກເດືອນ</option>
                    {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
              )}
            </div>
            <p className="text-sm text-stone-500">
              ສະແດງ <span className="font-bold text-emerald-800">{filteredVotes.length}</span> ຈາກ {totalVotesCount} ລາຍການ
            </p>
          </div>

          {/* table */}
          <div className="bg-white rounded-[24px] border border-stone-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-stone-500 text-xs border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4 font-bold">#</th>
                    <th className="py-3 px-4 font-bold">ສາຂາທີ່ໂຫວດ</th>
                    <th className="py-3 px-4 font-bold">ຜູ້ໂຫວດ</th>
                    <th className="py-3 px-4 font-bold text-center">ຄະແນນລວມ</th>
                    <th className="py-3 px-4 font-bold">ຄະແນນ 6 ດ້ານ</th>
                    <th className="py-3 px-4 font-bold">ຂໍ້ສະເໜີ</th>
                    <th className="py-3 px-4 font-bold">ວັນທີ</th>
                    <th className="py-3 px-4 font-bold text-center">ລາຍລະອຽດ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr><td colSpan="8" className="py-14 text-center text-stone-500">
                      <Loader2 size={26} className="animate-spin text-emerald-800 mx-auto mb-2" />
                      ກຳລັງໂຫຼດຜົນໂຫວດ...
                    </td></tr>
                  ) : filteredVotes.length === 0 ? (
                    <tr><td colSpan="8" className="py-14 text-center text-stone-500">ບໍ່ພົບຜົນໂຫວດຕາມເງື່ອນໄຂທີ່ເລືອກ</td></tr>
                  ) : (
                    filteredVotes.map((vote, index) => {
                      const token = vote.voter_token || '';
                      const emp = findEmp(token);
                      const scores = vote.criteria_scores || {};
                      const hasAnyRemark = Object.values(vote.custom_remarks || {}).some(r => r && r.trim());

                      return (
                        <tr key={vote.id || index} className="hover:bg-emerald-50/50 transition-colors">
                          <td className="py-3 px-4 text-stone-400 tabular-nums">{index + 1}</td>

                          <td className="py-3 px-4">
                            <div className="font-bold">{vote.branch_id}</div>
                            <div className="text-xs text-stone-500">{vote.manager_name || `Manager ສາຂາ ${vote.branch_id}`}</div>
                          </td>

                          <td className="py-3 px-4">
                            {emp ? (
                              <>
                                <div className="font-bold">{emp.name}
                                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-normal">{emp.role}</span>
                                </div>
                                <div className="text-xs text-stone-500">ID {emp.employee_id} · ສາຂາ {emp.branch_id || '-'}</div>
                              </>
                            ) : (
                              <>
                                <div className="text-stone-600">{token.startsWith('emp_') ? token.replace('emp_', 'EMP-') : 'ອຸປະກອນບໍ່ລະບຸຊື່'}</div>
                                <div className="text-xs text-stone-400 font-mono">{token.substring(0, 16)}...</div>
                              </>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-baseline gap-0.5 font-bold text-emerald-800 text-lg tabular-nums">
                              {vote.overall_score || 0}<span className="text-xs font-normal text-stone-400">/10</span>
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex gap-1">
                              {Object.entries(EVAL_CRITERIA_MAP).map(([cId, info]) => {
                                const ans = scores[cId];
                                const opt = info.options[ans];
                                return (
                                  <span key={cId} title={`${info.category}: ${opt ? opt.score : ans === 'other' ? 'ອື່ນໆ' : 'ບໍ່ເລືອກ'}`}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold tabular-nums ${opt ? (opt.score >= 4 ? 'bg-emerald-100 text-emerald-800' : opt.score === 3 ? 'bg-stone-100 text-stone-700' : 'bg-rose-100 text-rose-700')
                                        : 'bg-stone-50 text-stone-400'
                                      }`}>
                                    {opt ? opt.score : ans === 'other' ? '…' : '–'}
                                  </span>
                                );
                              })}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {hasAnyRemark ? (
                              <span className="inline-flex items-center gap-1 text-emerald-800 text-xs font-bold">
                                <MessageSquare size={13} />ມີ
                              </span>
                            ) : <span className="text-stone-400 text-xs">ບໍ່ມີ</span>}
                          </td>

                          <td className="py-3 px-4 text-xs text-stone-500 tabular-nums whitespace-nowrap">
                            {vote.created_at ? new Date(vote.created_at).toLocaleString('lo-LA', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button onClick={() => setSelectedVoteDetail(vote)}
                              className={`px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-bold text-stone-700 hover:bg-emerald-800 hover:border-emerald-800 hover:text-white transition-colors inline-flex items-center gap-1.5 ${focusRing}`}>
                              <Eye size={13} />ເບິ່ງ
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* detail modal */}
        {selectedVoteDetail && (() => {
          const vote = selectedVoteDetail;
          const token = vote.voter_token || '';
          const emp = findEmp(token);
          const scores = vote.criteria_scores || {};
          const remarks = vote.custom_remarks || {};

          return (
            <div className="fixed inset-0 z-[10010] bg-[#10231F]/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setSelectedVoteDetail(null)}>
              <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
                className="bg-white rounded-[28px] max-w-2xl w-full max-h-[88vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl">

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-emerald-800">Manager ສາຂາ {vote.branch_id}</p>
                    <h3 className="text-xl font-bold mt-1">ລາຍລະອຽດຜົນໂຫວດ</h3>
                    <p className="text-xs text-stone-500 mt-1 tabular-nums">
                      {vote.created_at ? new Date(vote.created_at).toLocaleString() : ''}
                    </p>
                  </div>
                  <button onClick={() => setSelectedVoteDetail(null)} aria-label="ປິດ"
                    className={`p-2 rounded-xl border border-stone-300 text-stone-500 hover:text-stone-900 ${focusRing}`}>
                    <X size={16} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-[#10231F] text-white">
                  <div className="min-w-0">
                    <p className="text-xs text-emerald-200/80">ຜູ້ໂຫວດ</p>
                    {emp ? (
                      <>
                        <p className="font-bold text-base mt-1">{emp.name}
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-white/10 font-normal">{emp.role}</span>
                        </p>
                        <p className="text-xs text-emerald-100/70 mt-0.5">
                          ລະຫັດ {emp.employee_id} · ສາຂາ {emp.branch_id} · {emp.workplace}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm mt-1">{token.startsWith('emp_') ? `ລະຫັດພະນັກງານ ${token.replace('emp_', '')}` : 'ອຸປະກອນບໍ່ລະບຸຊື່'}</p>
                        <p className="text-xs text-emerald-100/60 font-mono mt-0.5 break-all">{token}</p>
                      </>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-emerald-200/80">ຄະແນນລວມ</p>
                    <p className="text-4xl font-bold tabular-nums leading-none mt-1">{vote.overall_score || 0}</p>
                    <p className="text-xs text-emerald-100/60 mt-1">ຈາກ 10</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {Object.entries(EVAL_CRITERIA_MAP).map(([critId, info], idx) => {
                    const selId = scores[critId];
                    const option = info.options[selId];
                    const customTxt = remarks[critId];
                    return (
                      <div key={critId} className="rounded-2xl border border-stone-200 p-4 space-y-2.5">
                        <div>
                          <p className="text-xs text-stone-500">{idx + 1}. {info.category}</p>
                          <p className="text-sm font-bold mt-0.5">{info.title}</p>
                        </div>

                        {option ? (
                          <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-3">
                            <span className="w-8 h-8 shrink-0 rounded-lg bg-emerald-800 text-white flex items-center justify-center font-bold tabular-nums">
                              {option.score}
                            </span>
                            <span className="text-sm text-emerald-950 leading-relaxed">{option.text}</span>
                          </div>
                        ) : selId === 'other' ? (
                          <p className="text-sm rounded-xl bg-stone-50 p-3 text-stone-700">ເລືອກ "ອື່ນໆ" (ຂຽນຄຳຕອບເອງ)</p>
                        ) : (
                          <p className="text-sm rounded-xl bg-stone-50 p-3 text-stone-400">ບໍ່ໄດ້ລະບຸ</p>
                        )}

                        {customTxt && customTxt.trim() && (
                          <div className="rounded-xl border-l-4 border-emerald-700 bg-stone-50 p-3">
                            <p className="text-xs text-stone-500 mb-0.5">ຄວາມຄິດເຫັນເພີ່ມເຕີມ</p>
                            <p className="text-sm text-stone-800 leading-relaxed">{customTxt}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end">
                  <button onClick={() => setSelectedVoteDetail(null)}
                    className={`px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-bold transition-colors ${focusRing}`}>
                    ປິດ
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
