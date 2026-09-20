const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://wywgkikkjgbnlljkkmnz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5d2draWtramdibmxsamtrbW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcxMzgsImV4cCI6MjA5OTk0MzEzOH0.gSftxhQjFmWUQzikx-Q5UsdgNKSZISZqJvUGeLBOCqU');
async function run() {
  const { data, error } = await supabase.rpc('execute_sql', { query: 'SELECT 1;' });
  console.log('execute_sql:', {data, error});
}
run();
