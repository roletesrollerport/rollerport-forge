
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, data');
  
  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('--- User Data Debug ---');
  data.forEach(u => {
    const d = u.data || {};
    console.log(`ID: ${u.id} | Nome: ${d.nome} | Login: ${d.login} | Password in data: ${d.senha ? 'YES' : 'NO'}`);
  });
}

checkUsers();
