import { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  Briefcase,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Gift,
  Heart,
  Home,
  Mail,
  MapPin,
  Menu,
  Package,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  X,
} from 'lucide-react';

import joahLogo from '../../assets/favicon-full-transparent.png';
import joahHeroMockup from '../../assets/landing/hero/joah-hero-mockup.webp';
import joahOperations from '../../assets/JoahHQcentercompressed.png';
import joahGiftsCategory from '../../assets/landing/products/joah-category-gifts.webp';
import joahAmbientLoop from '../../assets/landing/motion/joah-ambient-loop.mp4';
import joahRealTeamBriefing from '../../assets/landing/real/joah-real-team-briefing.webp';
import joahRealKitchenShelf from '../../assets/landing/real/joah-real-kitchen-shelf.webp';
import joahRealKitchenProducts from '../../assets/landing/real/joah-real-kitchen-products.webp';
import joahRealWarehouseTeam from '../../assets/landing/real/joah-real-warehouse-team.webp';
import joahRealStoreTeam from '../../assets/landing/real/joah-real-store-team.webp';
import joahRealCustomerService from '../../assets/landing/real/joah-real-customer-service.webp';

const branches = [
  { name: 'Talad Lao', address: 'Talad Lao, Vientiane', status: 'Open Now' },
  { name: 'Sivilai', address: 'Sivilai Road, Vientiane', status: 'Open Now' },
  { name: 'Vang Say', address: 'Vang Say, Vientiane', status: 'Open Now' },
  { name: 'Patuxay', address: 'Patuxay Area, Vientiane', status: 'Open Now' },
  { name: 'Phonsinuan', address: 'Phonsinuan, Vientiane', status: 'Open Now' },
];

const categories = [
  {
    icon: Home,
    number: '01',
    name: 'Household essentials',
    desc: 'Kitchenware, bathroom essentials, storage, cleaning and useful everyday products.',
    tone: 'orange',
  },
  {
    icon: Briefcase,
    number: '02',
    name: 'Office supplies',
    desc: 'Stationery, desk accessories, organizers and products for everyday work.',
    tone: 'blue',
  },
  {
    icon: Sparkles,
    number: '03',
    name: 'Cute & kawaii',
    desc: 'Adorable accessories, character items and playful products from Asia.',
    tone: 'yellow',
  },
  {
    icon: Gift,
    number: '04',
    name: 'Toys & plushies',
    desc: 'Toys, plushies, collectibles and thoughtful gifts for every occasion.',
    tone: 'rose',
  },
  {
    icon: Package,
    number: '05',
    name: 'Daily life',
    desc: 'Travel accessories, personal items, small gadgets and everyday essentials.',
    tone: 'green',
  },
  {
    icon: Heart,
    number: '06',
    name: 'Lifestyle & beauty',
    desc: 'Accessories, decor and lifestyle products made for modern everyday living.',
    tone: 'purple',
  },
];

const faqs = [
  {
    q: 'Where are your products sourced from?',
    a: 'We source products directly from Korea, Japan and China, focusing on practical, enjoyable and quality products at accessible prices.',
  },
  {
    q: 'Do you have branches across Vientiane?',
    a: 'Yes. JOAH currently has five branches across Vientiane, with more locations planned as the brand continues to grow.',
  },
  {
    q: 'What products do you carry?',
    a: 'Our collection includes household goods, office supplies, cute and kawaii items, toys, plushies, daily life products, accessories and lifestyle goods.',
  },
  {
    q: 'Are your prices really cheaper?',
    a: 'We work with direct sourcing and carefully select products so that customers can enjoy good quality without unnecessary markup.',
  },
];

const navItems = [
  { href: '#about', label: 'About' },
  { href: '#categories', label: 'Products' },
  { href: '#branches', label: 'Stores' },
  { href: '#faq', label: 'FAQ' },
];

const toneStyles = {
  orange: 'bg-[#fff0e8] text-[#ed641c] group-hover:bg-[#ed641c] group-hover:text-white',
  blue: 'bg-[#eaf2f8] text-[#1f5578] group-hover:bg-[#1f5578] group-hover:text-white',
  yellow: 'bg-[#fff7d7] text-[#9a7210] group-hover:bg-[#e4b52a] group-hover:text-white',
  rose: 'bg-[#fcecf0] text-[#b64b68] group-hover:bg-[#b64b68] group-hover:text-white',
  green: 'bg-[#eaf5eb] text-[#3c8451] group-hover:bg-[#3c8451] group-hover:text-white',
  purple: 'bg-[#f1ecfb] text-[#7654a7] group-hover:bg-[#7654a7] group-hover:text-white',
};

const visualCards = [
  { image: joahRealKitchenShelf, eyebrow: 'Inside the store', title: 'Small upgrades, big comfort', tone: 'orange', href: '#categories' },
  { image: joahRealKitchenProducts, eyebrow: 'Made to discover', title: 'More useful than expected', tone: 'blue', href: '#categories' },
  { image: joahGiftsCategory, eyebrow: 'For your people', title: 'Give a little JOAH', tone: 'yellow', href: '#branches' },
];

const businessCards = [
  { image: joahRealTeamBriefing, label: 'Our people', title: 'A team that shows up for every detail.' },
  { image: joahRealWarehouseTeam, label: 'Our operations', title: 'A smarter flow from shelf to store.' },
  { image: joahRealCustomerService, label: 'Our service', title: 'A warmer way to discover something new.' },
];

const LandingPage = ({ onBack }) => {
  const [openFaq, setOpenFaq] = useState(0);
  const [activeBranch, setActiveBranch] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className="min-h-screen overflow-hidden bg-[#f7f4ee] text-[#171717] selection:bg-orange-200 selection:text-orange-950">
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrollY > 24
          ? 'border-b border-black/[0.07] bg-[#f7f4ee]/90 shadow-[0_8px_30px_rgba(32,25,16,0.05)] backdrop-blur-xl'
          : 'bg-transparent'
          }`}
      >
        <div className="mx-auto flex h-[78px] max-w-[1360px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <a href="#top" className="group flex h-[70px] w-[240px] sm:w-[320px] items-center justify-center overflow-hidden rounded-2xl border border-black/[0.08] bg-white/90 p-0 shadow-[0_8px_24px_rgba(43,32,20,0.08)] backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(43,32,20,0.12)]" aria-label="JOAH home" onClick={closeMenu}>
            <img src={joahLogo} alt="JOAH logo" className="h-full w-full object-contain scale-[2.2] transition-transform duration-300 group-hover:scale-[2.3]" />
          </a>

          <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary navigation">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="text-[13px] font-semibold text-black/50 transition-colors hover:text-[#ed641c]">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a href="#branches" className="hidden items-center gap-2 rounded-full bg-[#171717] px-5 py-3 text-[13px] font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-[#ed641c] sm:inline-flex">
              Find a store <ArrowRight size={15} />
            </a>
            <button type="button" aria-label={isMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen((open) => !open)} className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/70 lg:hidden">
              {isMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="border-t border-black/[0.07] bg-[#f7f4ee] px-5 pb-6 pt-4 lg:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} onClick={closeMenu} className="rounded-2xl px-4 py-3 text-base font-bold hover:bg-white">
                  {item.label}
                </a>
              ))}
              <a href="#branches" onClick={closeMenu} className="mt-2 inline-flex items-center justify-between rounded-2xl bg-[#171717] px-4 py-3 text-sm font-bold text-white">
                Find a store <ArrowRight size={16} />
              </a>
            </nav>
          </div>
        )}
      </header>

      <main id="top">
        <section className="relative px-5 pb-12 pt-[118px] sm:px-8 lg:px-12 lg:pb-20 lg:pt-[150px]">
          <div className="pointer-events-none absolute -right-24 top-16 h-[520px] w-[520px] rounded-full bg-[#ffd8b8]/50 blur-3xl" />
          <div className="pointer-events-none absolute -left-28 top-[38%] h-[360px] w-[360px] rounded-full bg-[#d8e8f0]/60 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(35,35,35,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(35,35,35,0.035)_1px,transparent_1px)] [background-size:42px_42px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />

          <div className="relative mx-auto grid max-w-[1360px] items-center gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20">
            <div className="max-w-2xl" style={{ transform: `translateY(${Math.min(scrollY * 0.035, 18)}px)` }}>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/55 shadow-sm backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ed641c]" />
                Useful things. Little joys.
              </div>

              <h1 className="max-w-3xl text-[4.2rem] font-black leading-[0.88] tracking-[-0.08em] sm:text-7xl lg:text-[7.2rem]">
                Find your
                <br />
                <span className="text-[#ed641c]">everyday</span>
                <br />
                <span className="relative inline-block">favorites<span className="absolute -right-6 -top-2 text-2xl font-normal text-[#ed641c] sm:-right-8 sm:-top-3 sm:text-4xl">✳</span></span>
              </h1>

              <p className="mt-8 max-w-xl text-[15px] leading-7 text-black/55 sm:text-lg sm:leading-8">
                JOAH brings practical, fun and beautiful everyday products from Korea, Japan and China into one easy-to-shop destination in Vientiane.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a href="#categories" className="group inline-flex items-center justify-center gap-3 rounded-full bg-[#171717] px-7 py-4 text-sm font-bold text-white shadow-[0_12px_24px_rgba(23,23,23,0.14)] transition-all hover:-translate-y-1 hover:bg-[#ed641c] active:scale-[0.98]">
                  Explore products <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </a>
                <a href="#about" className="inline-flex items-center justify-center gap-3 rounded-full border border-black/10 bg-white/70 px-7 py-4 text-sm font-bold text-black transition-all hover:-translate-y-1 hover:border-black/20 hover:bg-white active:scale-[0.98]">
                  Our story <ArrowDownRight size={17} />
                </a>
              </div>

              <div className="mt-11 flex flex-wrap items-center gap-x-7 gap-y-4 text-sm">
                <div className="flex -space-x-2">
                  {['🇰🇷', '🇯🇵', '🇨🇳'].map((flag) => <span key={flag} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#f7f4ee] bg-white text-sm shadow-sm">{flag}</span>)}
                </div>
                <span className="font-semibold text-black/45">Sourced across Asia</span>
                <span className="hidden h-5 w-px bg-black/10 sm:block" />
                <span className="font-black text-black/75">5 <span className="font-semibold text-black/40">stores in Vientiane</span></span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[620px] lg:justify-self-end">
              <div className="absolute -left-7 top-8 z-10 hidden -rotate-6 rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-[0_16px_35px_rgba(50,35,20,0.12)] sm:block">
                <div className="flex items-center gap-2.5">
                  <img src={joahRealStoreTeam} alt="JOAH store team" width="64" height="64" loading="eager" decoding="async" className="h-9 w-9 rounded-xl object-cover" />
                  <div><div className="text-xs font-black">Real people, real JOAH</div><div className="mt-0.5 text-[10px] text-black/40">Made for our stores</div></div>
                </div>
              </div>
              <div className="absolute -bottom-5 -right-4 z-10 hidden rotate-3 rounded-2xl bg-[#1f5578] px-4 py-3 text-white shadow-[0_16px_35px_rgba(31,85,120,0.2)] sm:block">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-white/55">JOAH mood</div>
                <div className="mt-1 text-sm font-black">Useful. Fun. Affordable.</div>
              </div>
              <div className="relative joah-float overflow-hidden rounded-[2rem] bg-[#e8ddd0] p-2.5 shadow-[0_28px_70px_rgba(59,39,18,0.16)] sm:rounded-[2.5rem] sm:p-3">
                <div className="overflow-hidden rounded-[1.55rem] sm:rounded-[2rem]">
                  <img src={joahRealStoreTeam} alt="JOAH team welcoming customers inside the store" width="1153" height="1280" fetchPriority="high" decoding="async" className="h-auto w-full object-cover transition-transform duration-700 hover:scale-[1.025]" />
                </div>
              </div>
              <div className="pointer-events-none absolute -right-7 top-8 z-10 h-24 w-24 rounded-full border-[12px] border-[#ed641c]/20 joah-orbit" />
              <div className="pointer-events-none absolute -left-5 bottom-10 z-10 h-12 w-12 rounded-full bg-[#e4b52a]/80 joah-orbit" />
              <div className="pointer-events-none absolute -bottom-10 left-[14%] h-20 w-2/3 rounded-full bg-[#ed641c]/15 blur-2xl" />
            </div>
          </div>
        </section>

        <section className="border-y border-black/[0.07] bg-[#171717] text-white">
          <div className="overflow-hidden py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/65">
            <div className="joah-marquee-track flex w-max items-center gap-x-5 px-5 sm:gap-x-8 sm:px-8 lg:px-12">
              {[0, 1].map((loop) => <div key={loop} className="flex items-center gap-x-5 sm:gap-x-8"><span className="text-[#ff9a5c]">From Asia, with joy</span><span className="text-white/20">•</span><span>Korea</span><span className="text-white/20">•</span><span>Japan</span><span className="text-white/20">•</span><span>China</span><span className="text-white/20">•</span><span>Vientiane</span><span className="text-[#ff9a5c]">From Asia, with joy</span><span className="text-white/20">•</span></div>)}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#1f5578] px-5 py-20 text-white sm:px-8 lg:px-12 lg:py-28">
          <div className="pointer-events-none absolute -left-28 -top-24 h-80 w-80 rounded-full border-[34px] border-white/10 joah-orbit" />
          <div className="pointer-events-none absolute -bottom-32 right-10 h-96 w-96 rounded-full border-[42px] border-[#ff9a5c]/20 joah-orbit" />
          <div className="relative mx-auto grid max-w-[1360px] items-center gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-24">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ffcf8d]">A little JOAH in motion</div>
              <h2 className="mt-5 max-w-xl text-4xl font-black leading-[0.94] tracking-[-0.065em] sm:text-6xl">The feeling of finding something just right.</h2>
              <p className="mt-7 max-w-lg text-base leading-8 text-white/70 sm:text-lg">Take a slower look. Our world is full of warm textures, useful details and small surprises worth bringing home.</p>
              <div className="mt-9 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/75"><span className="rounded-full border border-white/20 bg-white/10 px-3 py-2">Warm finds</span><span className="rounded-full border border-white/20 bg-white/10 px-3 py-2">Everyday joy</span><span className="rounded-full border border-white/20 bg-white/10 px-3 py-2">Made to discover</span></div>
            </div>
            <div className="relative overflow-hidden rounded-[2.2rem] border border-white/20 bg-black/10 p-2 shadow-[0_24px_70px_rgba(8,35,55,0.25)]">
              <video className="aspect-video w-full rounded-[1.8rem] object-cover" autoPlay muted loop playsInline preload="metadata" poster={joahHeroMockup} aria-label="Ambient JOAH product tabletop video"><source src={joahAmbientLoop} type="video/mp4" />Your browser does not support the video tag.</video>
              <div className="pointer-events-none absolute bottom-5 left-5 flex items-center gap-2 rounded-full bg-[#171717]/65 px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-white backdrop-blur"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff9a5c]" /> Live the little things</div>
            </div>
          </div>
        </section>

        <section className="bg-[#f7f4ee] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1360px]">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ed641c]">The people behind JOAH</div><h2 className="mt-4 max-w-2xl text-4xl font-black leading-[0.94] tracking-[-0.065em] sm:text-6xl">Good business starts<br />with good people.</h2></div><p className="max-w-sm text-sm leading-7 text-black/50">From our warehouse team to every store floor, people are at the heart of how JOAH moves.</p></div>
            <div className="mt-12 grid gap-4 md:grid-cols-12 md:items-stretch">
              {businessCards.map((card, index) => (
                <article key={card.title} className={`group relative min-h-[360px] overflow-hidden rounded-[2rem] bg-black md:col-span-4 ${index === 1 ? 'md:translate-y-8' : ''}`}>
                  <img src={card.image} alt={card.title} width="1400" height="933" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105 group-hover:brightness-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-7"><div className="mb-3 inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] backdrop-blur">{card.label}</div><h3 className="max-w-xs text-2xl font-black leading-tight tracking-[-0.05em]">{card.title}</h3></div>
                  <div className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur transition-all duration-300 group-hover:rotate-[-45deg] group-hover:opacity-100"><ArrowRight size={17} /></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="mx-auto grid max-w-[1360px] gap-14 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:gap-24">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ed641c]">01 / The JOAH idea</div>
              <h2 className="mt-5 max-w-xl text-4xl font-black leading-[0.94] tracking-[-0.065em] sm:text-6xl">A little more joy in the everyday.</h2>
              <p className="mt-7 max-w-lg text-base leading-8 text-black/55 sm:text-lg">
                JOAH is a multi-branch retail brand focused on products that make everyday life easier, more enjoyable and a little more fun.
              </p>
              <p className="mt-5 max-w-lg text-base leading-8 text-black/55 sm:text-lg">
                We source from trusted suppliers across <strong className="font-bold text-black">Korea, Japan and China</strong>, then bring useful, delightful finds together under one roof.
              </p>
              <div className="mt-9 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-3">
                {[['5', 'Vientiane stores'], ['3', 'Source countries'], ['∞', 'Things to discover']].map(([value, label]) => (
                  <div key={label} className="rounded-2xl border border-black/10 bg-white/65 p-4">
                    <div className="text-2xl font-black tracking-[-0.05em]">{value}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase leading-4 tracking-[0.12em] text-black/35">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 rounded-[2.7rem] border border-dashed border-[#ed641c]/25" />
              <div className="relative overflow-hidden rounded-[2.2rem] bg-[#d9eaf3] p-2 shadow-[0_24px_65px_rgba(37,70,91,0.12)]">
                <img src={joahOperations} alt="JOAH connected store and operations illustration" width="1044" height="510" loading="lazy" decoding="async" className="h-auto w-full rounded-[1.8rem] object-cover" />
              </div>
              <div className="absolute -bottom-7 left-5 rounded-2xl bg-white px-5 py-4 shadow-[0_18px_35px_rgba(29,29,29,0.12)] sm:left-10">
                <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf5eb] text-[#3c8451]"><Check size={17} /></div><div><div className="text-xs font-black">One place, many good finds</div><div className="mt-1 text-[10px] text-black/40">Selected for everyday life</div></div></div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#fff1e7] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="pointer-events-none absolute -left-20 top-12 h-48 w-48 rounded-full bg-[#ffcfad]/70 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-[#c9ddeb]/70 blur-3xl" />
          <div className="relative mx-auto max-w-[1360px]">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div><div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ed641c]">A JOAH kind of day</div><h2 className="mt-4 max-w-2xl text-4xl font-black leading-[0.94] tracking-[-0.065em] sm:text-6xl">There&apos;s always room<br />for one more good thing.</h2></div>
              <p className="max-w-sm text-sm leading-7 text-black/50">Three moods. One happy place. Explore the little details that make a home, desk or gift feel more like you.</p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {visualCards.map((card, index) => (
                <a key={card.title} href={card.href} className={`group relative overflow-hidden rounded-[1.8rem] bg-white shadow-[0_16px_40px_rgba(63,39,18,0.09)] ${index === 1 ? 'md:-translate-y-6' : ''}`}>
                  <div className="aspect-[4/3] overflow-hidden"><img src={card.image} alt={card.title} width="1400" height="933" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /></div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-5 pb-5 pt-16 text-white sm:px-6 sm:pb-6"><div className="flex items-end justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/70">{card.eyebrow}</div><div className="mt-2 text-xl font-black leading-tight tracking-[-0.04em]">{card.title}</div></div><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur transition-all group-hover:bg-[#ed641c] group-hover:rotate-[-45deg]"><ArrowRight size={17} /></span></div></div>
                  <span className={`absolute left-5 top-5 h-2.5 w-2.5 rounded-full ${card.tone === 'orange' ? 'bg-[#ed641c]' : card.tone === 'blue' ? 'bg-[#1f5578]' : 'bg-[#e4b52a]'} shadow-[0_0_0_6px_rgba(255,255,255,0.28)]`} />
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="categories" className="border-y border-black/[0.07] bg-white px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-[1360px]">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div><div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ed641c]">02 / Browse the mix</div><h2 className="mt-4 text-4xl font-black tracking-[-0.065em] sm:text-6xl">Shop by feeling.</h2></div>
              <p className="max-w-md text-sm leading-7 text-black/45">From useful everyday essentials to little things that simply make you smile.</p>
            </div>

            <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <a key={category.number} href="#branches" className="group rounded-[1.6rem] border border-black/[0.08] bg-[#f7f4ee]/70 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-black/10 hover:bg-white hover:shadow-[0_18px_40px_rgba(43,32,20,0.08)] sm:p-8">
                    <div className="flex items-start justify-between"><div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors duration-300 ${toneStyles[category.tone]}`}><Icon size={20} strokeWidth={1.9} /></div><span className="text-xs font-black text-black/20">{category.number}</span></div>
                    <h3 className="mt-10 text-xl font-black tracking-[-0.035em]">{category.name}</h3>
                    <p className="mt-3 max-w-sm text-sm leading-7 text-black/45">{category.desc}</p>
                    <div className="mt-7 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#ed641c] transition-transform group-hover:translate-x-1">Explore <ArrowRight size={13} /></div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <section id="branches" className="px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="mx-auto grid max-w-[1360px] gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ed641c]">03 / Come by</div>
              <h2 className="mt-5 max-w-lg text-4xl font-black leading-[0.94] tracking-[-0.065em] sm:text-6xl">Good finds are closer than you think.</h2>
              <p className="mt-7 max-w-md text-base leading-8 text-black/50">Visit one of our five Vientiane branches and discover the latest products in person.</p>
              <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-bold shadow-sm"><Clock3 size={16} className="text-[#ed641c]" /> Open daily · 9:00 AM – 10:00 PM</div>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-black/[0.08] bg-white shadow-[0_20px_55px_rgba(43,32,20,0.06)]">
              <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
                <div className="border-b border-black/[0.07] lg:border-b-0 lg:border-r">
                  {branches.map((branch, index) => (
                    <button type="button" key={branch.name} onClick={() => setActiveBranch(index)} aria-pressed={activeBranch === index} className={`flex w-full items-center justify-between border-b border-black/[0.07] px-5 py-4 text-left transition-colors last:border-b-0 sm:px-6 sm:py-5 ${activeBranch === index ? 'bg-[#171717] text-white' : 'bg-white text-black hover:bg-[#f7f4ee]'}`}>
                      <div className="flex items-center gap-3 sm:gap-4"><span className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-black ${activeBranch === index ? 'bg-[#ed641c] text-white' : 'bg-[#f2eee7] text-black/40'}`}>{String(index + 1).padStart(2, '0')}</span><span className="text-sm font-black">{branch.name}</span></div><ArrowRight size={15} className={activeBranch === index ? 'text-[#ff9a5c]' : 'text-black/20'} />
                    </button>
                  ))}
                </div>
                <div className="relative min-h-[320px] bg-[#eaf2f8] p-7 sm:p-10">
                  <div className="absolute right-7 top-7 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1f5578] shadow-sm"><MapPin size={17} /></div>
                  <div className="flex h-full flex-col justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35">Selected branch</div><h3 className="mt-5 pr-12 text-3xl font-black tracking-[-0.05em]">{branches[activeBranch].name}</h3><p className="mt-3 max-w-xs text-sm leading-7 text-black/50">{branches[activeBranch].address}</p></div><div className="mt-10 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-emerald-500" /><div><div className="text-xs font-black">{branches[activeBranch].status}</div><div className="mt-1 text-[10px] text-black/35">Open daily</div></div></div><Phone size={16} className="text-black/30" /></div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="border-t border-black/[0.07] bg-white px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="mx-auto max-w-4xl">
            <div className="text-center"><div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ed641c]">04 / Good to know</div><h2 className="mt-4 text-4xl font-black tracking-[-0.065em] sm:text-6xl">Questions, answered.</h2></div>
            <div className="mt-12 overflow-hidden rounded-[1.8rem] border border-black/[0.08]">
              {faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                return <div key={faq.q} className="border-b border-black/[0.07] last:border-b-0"><button type="button" onClick={() => setOpenFaq(isOpen ? null : index)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-5 px-5 py-6 text-left sm:px-8"><span className="text-sm font-black sm:text-base">{faq.q}</span>{isOpen ? <ChevronUp size={18} className="shrink-0 text-[#ed641c]" /> : <ChevronDown size={18} className="shrink-0 text-black/30" />}</button><div className={`grid transition-all duration-300 ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}><div className="overflow-hidden"><p className="px-5 pb-7 text-sm leading-7 text-black/50 sm:px-8">{faq.a}</p></div></div></div>;
              })}
            </div>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="relative mx-auto max-w-[1360px] overflow-hidden rounded-[2.4rem] bg-[#ed641c] px-7 py-14 text-white sm:px-12 lg:px-20 lg:py-20">
            <div className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full border-[38px] border-white/10" /><div className="pointer-events-none absolute -bottom-28 right-40 h-52 w-52 rounded-full border-[24px] border-white/10" />
            <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end"><div><div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/65">Your next good find is waiting</div><h2 className="mt-4 max-w-3xl text-4xl font-black leading-[0.92] tracking-[-0.07em] sm:text-6xl lg:text-7xl">Make room for<br />a little JOAH.</h2><p className="mt-6 max-w-xl text-sm leading-7 text-white/75 sm:text-base">Discover products from Asia at your nearest JOAH store in Vientiane.</p></div><div className="flex flex-col gap-3 sm:flex-row lg:flex-col"><a href="#branches" className="inline-flex items-center justify-center gap-3 rounded-full bg-[#171717] px-6 py-4 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-white hover:text-[#171717]"><MapPin size={17} /> Find a store</a><button type="button" onClick={onBack} className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-white/10">Back to system</button></div></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/[0.07] bg-[#171717] px-5 py-14 text-white sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1360px]"><div className="grid gap-12 md:grid-cols-[1.2fr_0.7fr_0.9fr]"><div><div className="inline-block overflow-hidden rounded-2xl border border-white/10 bg-white p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.15)]"><img src={joahLogo} alt="JOAH logo" width="140" height="52" loading="lazy" className="h-[52px] w-auto object-contain" /></div>
          <p className="mt-6 max-w-md text-sm leading-7 text-white/40">Practical, fun and beautiful everyday products from Korea, Japan and China — carefully selected for life in Vientiane.</p></div><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Explore</div><div className="mt-5 flex flex-col gap-3">{navItems.map((item) => <a key={item.href} href={item.href} className="text-sm text-white/55 transition-colors hover:text-white">{item.label}</a>)}<button type="button" onClick={onBack} className="text-left text-sm text-white/55 transition-colors hover:text-white">Staff portal</button></div></div><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Contact</div><div className="mt-5 flex flex-col gap-4"><div className="flex items-center gap-3 text-sm text-white/50"><Phone size={15} className="text-[#ff9a5c]" /><span>+856 20 76926138</span></div><div className="flex items-center gap-3 text-sm text-white/50"><Mail size={15} className="text-[#ff9a5c]" /><span>bankprogram@gmail.com</span></div><div className="flex items-start gap-3 text-sm leading-6 text-white/50"><Clock3 size={15} className="mt-1 shrink-0 text-[#ff9a5c]" /><span>Open daily<br />9:00 AM – 10:00 PM</span></div></div></div></div><div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} JOAH Company. All rights reserved.</p><p>Crafted with care by Santisouk Laxayphone</p></div></div>
      </footer>
    </div>
  );
};

export default LandingPage;
