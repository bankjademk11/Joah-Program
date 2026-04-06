import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filesToUpdate = [
    'src/components/features/store/StoreResultTable.jsx',
    'src/components/features/store/StoreDashboard.jsx',
];

filesToUpdate.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${filePath}, does not exist.`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // 🎨 Color Theme Replacements (Orange -> Emerald/Teal)
    content = content.replace(/joah-orange/g, 'emerald-500');
    content = content.replace(/orange-50/g, 'emerald-50');
    content = content.replace(/orange-500/g, 'emerald-500');
    content = content.replace(/orange-600/g, 'emerald-600');
    content = content.replace(/orange-900/g, 'emerald-900');

    // 💎 Advanced UI/UX Glows & Glassmorphism Upgrades
    // Action bar upgrade
    content = content.replace(/glass-card rounded-\[2\.5rem\] p-6 sm:p-8 flex/g, 
        'bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 flex shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-emerald-100/50 dark:border-emerald-900/30');
    
    // Table Area upgrade
    content = content.replace(/glass-card rounded-\[2\.5rem\] border-white\/50 shadow-2xl shadow-slate-200\/50/g,
        'bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.2)]');

    // Table Header upgrade
    content = content.replace(/tr className="bg-slate-50\/80/g, 
        'tr className="bg-gradient-to-b from-slate-50/90 to-white/90 dark:from-slate-800/90 dark:to-slate-900/90 border-b border-emerald-100 dark:border-emerald-900/20 shadow-sm"');

    // Row Hover effect upgrade
    content = content.replace(/hover:bg-joah-orange\/\[0\.03\] dark:hover:bg-joah-orange\/\[0\.05\]/g, 
        'hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 hover:shadow-md hover:-translate-y-0.5 z-0 hover:z-10 relative border-l-2 border-transparent hover:border-emerald-400');
    content = content.replace(/bg-joah-orange\/10 ring-2 ring-joah-orange/g, 
        'bg-gradient-to-r from-emerald-50/80 to-white dark:from-emerald-900/30 dark:to-slate-900 shadow-lg shadow-emerald-500/10 border-l-4 border-emerald-500');

    // Premium buttons
    content = content.replace(/btn-success/g, 
        'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-[0_8px_16px_-4px_rgba(16,185,129,0.4)] transition-all hover:-translate-y-0.5');

    // Button Icons and accents
    content = content.replace(/text-slate-400 hover:text-emerald-500 hover:bg-emerald-50/g,
        'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200');

    console.log(`Applying ultra-premium Emerald Theme to ${file}...`);
    fs.writeFileSync(filePath, content, 'utf8');
});

console.log('✅ UI/UX Premium Emerald Theme Update Complete!');
