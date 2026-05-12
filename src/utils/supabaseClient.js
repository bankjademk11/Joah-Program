import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://avqdpddpomlapxcqxnmk.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cWRwZGRwb21sYXB4Y3F4bm1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTgxNjYsImV4cCI6MjA4NDgzNDE2Nn0.K9Wxj98llzXokHDm-J5iZ4HqHc3eEyJgTeCwScV0n8o';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
