import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://frbweyvhfrxxkjoolakh.supabase.co';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyYndleXZoZnJ4eGtqb29sYWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NzM2NTYsImV4cCI6MjA5NTI0OTY1Nn0.d5syhFoBhaGJ0VCEWUZ58I8LU6xLnh7UvYsHRhEzFtI';

// Check if URL is fully valid (starts with http:// or https:// and doesn't contain placeholders)
const isValidUrl = typeof rawUrl === 'string' && 
                   (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) && 
                   !rawUrl.includes('placeholder-project');

const isValidKey = typeof rawKey === 'string' && 
                   rawKey.trim().length > 0 && 
                   !rawKey.includes('placeholder');

if (!isValidUrl || !isValidKey) {
  console.warn(
    'Theory11 DTR Warning: Missing or invalid Supabase connection parameters. ' +
    'Using fallback parameters.'
  );
}

const supabaseUrl = isValidUrl ? rawUrl : 'https://frbweyvhfrxxkjoolakh.supabase.co';
const supabaseAnonKey = isValidKey ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyYndleXZoZnJ4eGtqb29sYWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NzM2NTYsImV4cCI6MjA5NTI0OTY1Nn0.d5syhFoBhaGJ0VCEWUZ58I8LU6xLnh7UvYsHRhEzFtI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
