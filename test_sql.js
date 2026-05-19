import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ydtgcxfcjxpkpqtxukns.supabase.co';
const supabaseAnonKey = 'sb_publishable_2bhfJQyav05a8ts1YeZzwg_iqxEmrqP';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSql() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: 'select 1;' });
  console.log("RPC exec_sql:", data, error);
}

testSql();
