require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('reports').select('id, treatment_plan').not('treatment_plan', 'is', null).limit(1);
  if (error) {
    console.error(error);
  } else if (data && data.length > 0) {
    console.log(JSON.stringify(data[0].treatment_plan, null, 2));
  } else {
    console.log("No non-null treatment_plans found.");
  }
}
check();
