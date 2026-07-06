import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://hannljzygxnibtgbncng.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhhbm5sanp5Z3huaWJ0Z2JuY25nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MDIyMjQsImV4cCI6MjA5MzA3ODIyNH0.45zRekdktcHyB_Yn7fcyScwtTmhWP-Sa5pY9uNzrqMg";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  try {
    const { data: users, error: userErr } = await supabase.from('users').select('id').limit(1);
    if (userErr) throw userErr;
    const userId = users[0].id;

    const test1 = await supabase.from('notifications').insert([{
      user_id: userId,
      title: 'Test',
      read: false
    }]).select();
    console.log('Insert with read result:', test1);

  } catch (err) {
    console.error('Catch error:', err);
  }
}

main();
