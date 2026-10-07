const { createClient } = require('@supabase/supabase-js');

const url = 'https://nyfashwbdcepncpdwpdb.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZmFzaHdiZGNlcG5jcGR3cGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTUwMjgsImV4cCI6MjEwNjc3MTAyOH0.xw2XKKzjPj_HjQzPJDMKkkbaO7htojYioIMGt4l8VLM';

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase
    .from('awp_shared_memories')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error("DB Error:", error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

check();
