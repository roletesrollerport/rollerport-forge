
const { createClient } = require('@supabase/supabase-js');
const url = 'https://vxqfqexeviwjycyrojww.supabase.co';
const key = 'sb_publishable_8aE2G0-yHdSeHEVdQge5Dg_TvEi7fIt';
const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('usuarios').select('*');
  if (error) {
    console.error(error);
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}
check();
