
import { createClient } from '@supabase/supabase-js';

const url = 'https://vxqfqexeviwjycyrojww.supabase.co';
const key = 'sb_publishable_8aE2G0-yHdSeHEVdQge5Dg_TvEi7fIt';
const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('usuarios').select('login, senha, nivel');
  if (error) {
    console.error(error);
    return;
  }
  console.log('--- USERS ---');
  data.forEach(u => console.log(`${u.login} | ${u.senha} | ${u.nivel}`));
}
check();
