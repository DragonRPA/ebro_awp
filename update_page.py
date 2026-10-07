import os
import re

filepath = 'src/pages/TenantManagementPage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = r"""  useEffect\(\(\) => \{
    fetchTenants\(\);
  \}, \[\]\);"""

replacement = """  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (isModalOpen && editingTenant && modalTab === 'AGENTS') {
      const fetchHeartbeats = async () => {
        setIsLoadingHeartbeats(true);
        try {
          const tenantId = (editingTenant.tenantCode === 'GIYEONLIFT' || editingTenant.tenantCode === 'GIYEUN') ? 'giyeun' : editingTenant.tenantCode.toLowerCase();
          const { data, error } = await supabase
            .from('agent_heartbeats')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('last_seen_at', { ascending: false });
            
          if (!error && data) {
            setTenantHeartbeats(data);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setIsLoadingHeartbeats(false);
        }
      };
      
      fetchHeartbeats();
      const intervalId = setInterval(fetchHeartbeats, 15000);
      return () => clearInterval(intervalId);
    }
  }, [isModalOpen, editingTenant, modalTab]);"""

content = re.sub(target, replacement, content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Added useEffect to TenantManagementPage.tsx")
