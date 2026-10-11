using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

namespace EBro.DeveloperDeviceRegistrar
{
    class Program
    {
        // ─── 시스템 보안 및 Supabase 설정 상수 (eBro 중앙 플랫폼 제어 DB) ──────────────
        private const string SUPABASE_URL = "https://nyfashwbdcepncpdwpdb.supabase.co";
        private const string SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZmFzaHdiZGNlcG5jcGR3cGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTUwMjgsImV4cCI6MjEwNjc3MTAyOH0.xw2XKKzjPj_HjQzPJDMKkkbaO7htojYioIMGt4l8VLM";
        private const string DEFAULT_MASTER_KEY = "ebro-dev-master-2026!";
        private const string EMERGENCY_BREAK_GLASS_KEY = "ebro-breakglass-recovery-2026!";

        static void Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            ConfigureSecurityProtocol();

            PrintBanner();

            try
            {
                // 1. 명령줄 옵션 파싱 (기본 실행 시 대화형 질문 없이 100% 완전 자동 원클릭 실행)
                var options = ParseArguments(args);

                // 2. 물리적 하드웨어 및 네트워크 MAC 정보 탐색
                Console.WriteLine("\n[1단계] 물리적 PC 하드웨어 및 네트워크 어댑터 분석 중...");
                var hardware = CollectHardwareInfo();
                DisplayHardwareInfo(hardware);

                if (hardware.MacAddresses.Count == 0)
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("❌ 유효한 물리적 네트워크 어댑터(MAC 주소)를 감지하지 못했습니다.");
                    Console.ResetColor();
                    WaitForKeyAndExit(1);
                    return;
                }

                // 수동 대화형 모드 플래그(--interactive 또는 -i)가 명시적으로 주어진 경우에만 입력 받음
                if (options.InteractiveMode)
                {
                    PromptForDetails(options, hardware);
                }

                // 3. 보안키 인증 검증
                if (options.MasterKey != DEFAULT_MASTER_KEY && options.MasterKey != EMERGENCY_BREAK_GLASS_KEY)
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("\n❌ [보안 실패] 입력된 물리 마스터 보안키가 유효하지 않습니다.");
                    Console.ResetColor();
                    WaitForKeyAndExit(1);
                    return;
                }

                bool isEmergency = (options.MasterKey == EMERGENCY_BREAK_GLASS_KEY);

                // 4. Supabase DB 영구 인가 대장에 자동 등록
                Console.WriteLine("\n[2단계] eBro ERP 중앙 제어 플랫폼 DB(Supabase) 영구 인가 대장에 자동 등록 중...");
                string nowIso = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
                int successCount = 0;
                string primaryDeviceId = "";

                // 감지된 모든 물리 MAC(이더넷, Wi-Fi 등)을 전원 등록하여 연결 방식(유선/무선)에 구애받지 않고 100% 자동 승인
                for (int i = 0; i < hardware.MacAddresses.Count; i++)
                {
                    string mac = hardware.MacAddresses[i];
                    string cleanMac = mac.Replace("-", "").ToUpper();
                    string deviceId = "DEV-PC-" + DateTime.Now.ToString("yyyyMMdd") + "-" + cleanMac;
                    if (i == 0) primaryDeviceId = deviceId;
                    string fingerprint = GenerateDeterministicFingerprint(hardware, mac);

                    var deviceProfile = new Dictionary<string, object>
                    {
                        { "id", deviceId },
                        { "developerId", options.DeveloperId },
                        { "developerName", options.DeveloperName },
                        { "machineName", hardware.MachineName },
                        { "macAddress", mac },
                        { "hardwareFingerprint", fingerprint },
                        { "platform", hardware.Platform },
                        { "status", "ACTIVE" },
                        { "isPrimary", (i == 0 && options.IsPrimary) },
                        { "emergencyBreakGlassUsed", isEmergency },
                        { "note", string.IsNullOrEmpty(options.Note) 
                            ? string.Format("공인 개발 단말기 원클릭 등록 ({0} / {1})", hardware.MachineName, hardware.AdapterNames[i])
                            : options.Note },
                        { "registeredAt", nowIso },
                        { "lastVerifiedAt", nowIso }
                    };

                    bool ok = RegisterToSupabase(deviceProfile, mac);
                    if (ok)
                    {
                        Console.ForegroundColor = ConsoleColor.Green;
                        Console.WriteLine("  ✅ [등록 완료] {0} ({1})", mac, hardware.AdapterNames[i]);
                        Console.ResetColor();
                        successCount++;
                    }
                    else
                    {
                        Console.ForegroundColor = ConsoleColor.Yellow;
                        Console.WriteLine("  ⚠️ [등록 지연] {0}", mac);
                        Console.ResetColor();
                    }
                }

                if (successCount == 0)
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("\n❌ DB 저장 과정에서 오류가 발생했습니다. 네트워크 연결 상태를 확인하십시오.");
                    Console.ResetColor();
                    WaitForKeyAndExit(1);
                    return;
                }

                // 5. 등록 영수증 표출
                PrintSuccessReceipt(hardware.MachineName, primaryDeviceId, options.DeveloperName, options.DeveloperId, successCount, isEmergency);
                WaitForKeyAndExit(0);
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("\n🚨 치명적 오류 발생: " + ex.Message);
                Console.WriteLine(ex.StackTrace);
                Console.ResetColor();
                WaitForKeyAndExit(1);
            }
        }

        // ─── 배너 및 영수증 ─────────────────────────────────────────────────────────
        private static void PrintBanner()
        {
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("================================================================================");
            Console.WriteLine("   🛡️   eBro ERP - 개발자 공인 PC 원클릭 등록 프로그램 (eBroDevPCRegister)   ");
            Console.WriteLine("================================================================================");
            Console.ResetColor();
            Console.WriteLine("  [원클릭 자동 등록 안내]");
            Console.WriteLine("   • 현재 PC의 하드웨어 및 모든 물리 네트워크 어댑터(MAC)를 자동 감지합니다.");
            Console.WriteLine("   • 질의응답 없이 eBro 중앙 제어 플랫폼 DB에 1초 만에 영구 공인 등록을 완료합니다.");
            Console.WriteLine("--------------------------------------------------------------------------------");
        }

        private static void DisplayHardwareInfo(HardwareInfo hw)
        {
            Console.WriteLine("  • 컴퓨터 이름 (Hostname): " + hw.MachineName);
            Console.WriteLine("  • 운영체제 (OS Platform): " + hw.OsVersion + " (" + hw.Platform + ")");
            Console.WriteLine("  • CPU 논리 프로세서 수 : " + hw.ProcessorCount + " Cores");
            Console.WriteLine("  • 감지된 물리적 MAC 목록 (총 {0}개 어댑터 자동 일괄 인가):", hw.MacAddresses.Count);
            for (int i = 0; i < hw.MacAddresses.Count; i++)
            {
                Console.WriteLine("     [{0}] {1} ({2})", i + 1, hw.MacAddresses[i], hw.AdapterNames[i]);
            }
        }

        private static void PrintSuccessReceipt(string machineName, string primaryDeviceId, string devName, string devId, int count, bool isEmergency)
        {
            Console.WriteLine("\n================================================================================");
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("🎉  [등록 완결] 현재 PC가 eBro ERP 공인 개발자 단말기로 영구 승인되었습니다!");
            Console.ResetColor();
            Console.WriteLine("================================================================================");
            Console.WriteLine("  • 공인 단말기 식별 ID : " + primaryDeviceId);
            Console.WriteLine("  • 컴퓨터 이름 (Hostname): " + machineName);
            Console.WriteLine("  • 개발자 명칭 / ID    : " + devName + " (" + devId + ")");
            Console.WriteLine("  • 등록된 물리 어댑터  : 총 " + count + "개 (이더넷 / Wi-Fi 상호 승인)");
            Console.WriteLine("  • 승인 상태           : ACTIVE " + (isEmergency ? "(비상 마스터 인증)" : "(정상 공인)"));
            Console.WriteLine("  • 영구 DB 보존 위치   : eBro 본사 중앙 제어 플랫폼 (nyfashwbdcepncpdwpdb.supabase.co)");
            Console.WriteLine("--------------------------------------------------------------------------------");
            Console.WriteLine("🔑 이제 웹 브라우저에서 eBro ERP에 접속하시면 개발자 보안 인증이 자동 통과됩니다.");
            Console.WriteLine("================================================================================");
        }

        private static void PromptForDetails(CliOptions options, HardwareInfo hw)
        {
            Console.WriteLine("\n[수동 커스텀 정보 입력 (Enter 키를 누르면 기본값이 적용됩니다)]");

            Console.Write("  1. 개발자 성명 (기본값: {0}): ", options.DeveloperName);
            string devName = Console.ReadLine();
            if (!string.IsNullOrWhiteSpace(devName)) options.DeveloperName = devName.Trim();

            Console.Write("  2. 개발자 로그인 ID (기본값: {0}): ", options.DeveloperId);
            string devId = Console.ReadLine();
            if (!string.IsNullOrWhiteSpace(devId)) options.DeveloperId = devId.Trim();

            Console.Write("  3. 주 개발 PC로 지정하시겠습니까? (Y/N, 기본값: Y): ");
            string isPrimaryInput = Console.ReadLine();
            if (!string.IsNullOrWhiteSpace(isPrimaryInput))
            {
                options.IsPrimary = (isPrimaryInput.Trim().ToUpper() == "Y");
            }

            Console.Write("  4. 마스터 보안 인증키 (기본 인증키 적용: Enter): ");
            string keyInput = Console.ReadLine();
            if (!string.IsNullOrWhiteSpace(keyInput)) options.MasterKey = keyInput.Trim();
        }

        // ─── 네트워크 및 하드웨어 탐색 ─────────────────────────────────────────────
        private class HardwareInfo
        {
            public string MachineName;
            public string OsVersion;
            public string Platform;
            public int ProcessorCount;
            public List<string> MacAddresses = new List<string>();
            public List<string> AdapterNames = new List<string>();
        }

        private static HardwareInfo CollectHardwareInfo()
        {
            var info = new HardwareInfo
            {
                MachineName = Environment.MachineName,
                OsVersion = Environment.OSVersion.ToString(),
                Platform = Environment.Is64BitOperatingSystem ? "Win32/x86_64" : "Win32/x86",
                ProcessorCount = Environment.ProcessorCount
            };

            var allNics = NetworkInterface.GetAllNetworkInterfaces();
            var validNics = new List<NetworkInterface>();

            foreach (NetworkInterface nic in allNics)
            {
                // 루프백, 터널 어댑터 제외
                if (nic.NetworkInterfaceType == NetworkInterfaceType.Loopback ||
                    nic.NetworkInterfaceType == NetworkInterfaceType.Tunnel)
                {
                    continue;
                }

                // 가상머신, 도커 가상 어댑터 배제 필터
                string desc = nic.Description.ToLower();
                string name = nic.Name.ToLower();
                if (desc.Contains("virtual") || desc.Contains("pseudo") || desc.Contains("vpn") ||
                    name.Contains("vethernet") || desc.Contains("hyper-v") || desc.Contains("docker"))
                {
                    continue;
                }

                string rawMac = nic.GetPhysicalAddress().ToString();
                if (string.IsNullOrEmpty(rawMac) || rawMac == "000000000000") continue;

                validNics.Add(nic);
            }

            // 우선순위 정렬: 현재 연결(Up) 상태 우선, 이더넷/와이파이 우선, 블루투스 후순위
            validNics.Sort((a, b) =>
            {
                int scoreA = (a.OperationalStatus == OperationalStatus.Up ? 100 : 0) +
                             (a.NetworkInterfaceType == NetworkInterfaceType.Ethernet ? 50 : 0) +
                             (a.NetworkInterfaceType == NetworkInterfaceType.Wireless80211 ? 40 : 0) -
                             (a.Description.ToLower().Contains("bluetooth") ? 80 : 0);
                int scoreB = (b.OperationalStatus == OperationalStatus.Up ? 100 : 0) +
                             (b.NetworkInterfaceType == NetworkInterfaceType.Ethernet ? 50 : 0) +
                             (b.NetworkInterfaceType == NetworkInterfaceType.Wireless80211 ? 40 : 0) -
                             (b.Description.ToLower().Contains("bluetooth") ? 80 : 0);
                return scoreB.CompareTo(scoreA);
            });

            foreach (var nic in validNics)
            {
                string rawMac = nic.GetPhysicalAddress().ToString();
                var sb = new StringBuilder();
                for (int i = 0; i < rawMac.Length; i++)
                {
                    sb.Append(rawMac[i]);
                    if (i % 2 == 1 && i < rawMac.Length - 1) sb.Append("-");
                }
                string formattedMac = sb.ToString().ToUpper();

                if (!info.MacAddresses.Contains(formattedMac))
                {
                    info.MacAddresses.Add(formattedMac);
                    string statusTag = (nic.OperationalStatus == OperationalStatus.Up) ? " [활성]" : "";
                    info.AdapterNames.Add(nic.Name + " - " + nic.Description + statusTag);
                }
            }

            // 예외적으로 가상 어댑터 필터 때문에 비어있다면 물리 주소가 있는 첫 번째라도 수집
            if (info.MacAddresses.Count == 0)
            {
                foreach (NetworkInterface nic in allNics)
                {
                    if (nic.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                    string rawMac = nic.GetPhysicalAddress().ToString();
                    if (!string.IsNullOrEmpty(rawMac) && rawMac != "000000000000")
                    {
                        var sb = new StringBuilder();
                        for (int i = 0; i < rawMac.Length; i++)
                        {
                            sb.Append(rawMac[i]);
                            if (i % 2 == 1 && i < rawMac.Length - 1) sb.Append("-");
                        }
                        info.MacAddresses.Add(sb.ToString().ToUpper());
                        info.AdapterNames.Add(nic.Name);
                        break;
                    }
                }
            }

            return info;
        }

        private static string GenerateDeterministicFingerprint(HardwareInfo hw, string mac)
        {
            string seed = string.Format("{0}:{1}:{2}:{3}", hw.MachineName, mac, hw.ProcessorCount, hw.Platform);
            using (SHA256 sha = SHA256.Create())
            {
                byte[] hashBytes = sha.ComputeHash(Encoding.UTF8.GetBytes(seed));
                string hex = BitConverter.ToString(hashBytes).Replace("-", "").ToUpper();
                return string.Format("HW-{0}-{1}-{2}C", hex.Substring(0, 4), hex.Substring(4, 4), hw.ProcessorCount);
            }
        }

        // ─── Supabase REST 통신 (이중화 영구 보존) ──────────────────────────────────
        private static bool RegisterToSupabase(Dictionary<string, object> device, string macAddress)
        {
            bool saved = false;
            var ser = new JavaScriptSerializer();

            // 1. developer_authorized_devices 전용 테이블 시도
            try
            {
                string postUrl = SUPABASE_URL + "/rest/v1/developer_authorized_devices";
                var req = (HttpWebRequest)WebRequest.Create(postUrl);
                req.Method = "POST";
                req.Headers["apikey"] = SUPABASE_ANON_KEY;
                req.Headers["Authorization"] = "Bearer " + SUPABASE_ANON_KEY;
                req.Headers["Prefer"] = "resolution=merge-duplicates,return=representation";
                req.ContentType = "application/json; charset=utf-8";

                string jsonPayload = ser.Serialize(device);
                byte[] byteData = Encoding.UTF8.GetBytes(jsonPayload);
                req.ContentLength = byteData.Length;

                using (Stream stream = req.GetRequestStream())
                {
                    stream.Write(byteData, 0, byteData.Length);
                }

                using (var res = (HttpWebResponse)req.GetResponse())
                {
                    if (res.StatusCode == HttpStatusCode.OK ||
                        res.StatusCode == HttpStatusCode.Created ||
                        res.StatusCode == HttpStatusCode.NoContent)
                    {
                        saved = true;
                    }
                }
            }
            catch
            {
                // 전용 테이블 미존재 시 중앙 메타 저장으로 자동 폴백
            }

            // 2. 중앙 플랫폼 테넌트 글로벌 메타(tenants.features.developerAuthorizedDevices) 영구 동기화
            try
            {
                string getUrl = SUPABASE_URL + "/rest/v1/tenants?select=id,features&limit=1";
                var getReq = (HttpWebRequest)WebRequest.Create(getUrl);
                getReq.Method = "GET";
                getReq.Headers["apikey"] = SUPABASE_ANON_KEY;
                getReq.Headers["Authorization"] = "Bearer " + SUPABASE_ANON_KEY;
                getReq.ContentType = "application/json";

                string body = "";
                using (var res = (HttpWebResponse)getReq.GetResponse())
                using (var reader = new StreamReader(res.GetResponseStream()))
                {
                    body = reader.ReadToEnd();
                }

                var rows = ser.Deserialize<List<Dictionary<string, object>>>(body);
                if (rows != null && rows.Count > 0)
                {
                    var tenant = rows[0];
                    string tenantId = tenant["id"].ToString();
                    var features = tenant.ContainsKey("features") && tenant["features"] is Dictionary<string, object>
                        ? (Dictionary<string, object>)tenant["features"]
                        : new Dictionary<string, object>();

                    var devList = features.ContainsKey("developerAuthorizedDevices") && features["developerAuthorizedDevices"] is ArrayList
                        ? (ArrayList)features["developerAuthorizedDevices"]
                        : new ArrayList();

                    // 기존 동일 MAC 또는 동일 ID 기기 찾기
                    int foundIdx = -1;
                    for (int i = 0; i < devList.Count; i++)
                    {
                        if (devList[i] is Dictionary<string, object>)
                        {
                            var d = (Dictionary<string, object>)devList[i];
                            if (d.ContainsKey("macAddress") && d["macAddress"].ToString().ToUpper().Replace(":", "-") == macAddress.ToUpper().Replace(":", "-"))
                            {
                                foundIdx = i;
                                break;
                            }
                            if (d.ContainsKey("id") && d["id"].ToString() == device["id"].ToString())
                            {
                                foundIdx = i;
                                break;
                            }
                        }
                    }

                    if (foundIdx >= 0)
                    {
                        devList[foundIdx] = device;
                    }
                    else
                    {
                        devList.Insert(0, device);
                    }

                    features["developerAuthorizedDevices"] = devList;

                    // PATCH tenants
                    string patchUrl = SUPABASE_URL + "/rest/v1/tenants?id=eq." + Uri.EscapeDataString(tenantId);
                    var patchReq = (HttpWebRequest)WebRequest.Create(patchUrl);
                    patchReq.Method = "PATCH";
                    patchReq.Headers["apikey"] = SUPABASE_ANON_KEY;
                    patchReq.Headers["Authorization"] = "Bearer " + SUPABASE_ANON_KEY;
                    patchReq.Headers["Prefer"] = "return=representation";
                    patchReq.ContentType = "application/json; charset=utf-8";

                    string patchJson = ser.Serialize(new Dictionary<string, object> { { "features", features } });
                    byte[] patchBytes = Encoding.UTF8.GetBytes(patchJson);
                    patchReq.ContentLength = patchBytes.Length;

                    using (Stream pStream = patchReq.GetRequestStream())
                    {
                        pStream.Write(patchBytes, 0, patchBytes.Length);
                    }

                    using (var pRes = (HttpWebResponse)patchReq.GetResponse())
                    {
                        if (pRes.StatusCode == HttpStatusCode.OK ||
                            pRes.StatusCode == HttpStatusCode.NoContent)
                        {
                            saved = true;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("  [중앙 플랫폼 메타 저장 알림]: " + ex.Message);
            }

            return saved;
        }

        private static void ConfigureSecurityProtocol()
        {
            try
            {
                ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | (SecurityProtocolType)12288 | SecurityProtocolType.Tls12;
            }
            catch
            {
                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            }
        }

        // ─── CLI 옵션 및 헬퍼 ────────────────────────────────────────────────────
        private class CliOptions
        {
            public bool InteractiveMode = false;
            public string DeveloperName = "대표 개발자";
            public string DeveloperId = "sys-admin";
            public bool IsPrimary = true;
            public string MasterKey = DEFAULT_MASTER_KEY;
            public string Note = "";
        }

        private static CliOptions ParseArguments(string[] args)
        {
            var opt = new CliOptions();
            for (int i = 0; i < args.Length; i++)
            {
                string arg = args[i].ToLower();
                if (arg == "--interactive" || arg == "-i")
                {
                    opt.InteractiveMode = true;
                }
                else if (arg == "--name" && i + 1 < args.Length)
                {
                    opt.DeveloperName = args[++i];
                }
                else if (arg == "--id" && i + 1 < args.Length)
                {
                    opt.DeveloperId = args[++i];
                }
                else if (arg == "--key" && i + 1 < args.Length)
                {
                    opt.MasterKey = args[++i];
                }
                else if (arg == "--secondary")
                {
                    opt.IsPrimary = false;
                }
                else if (arg == "--note" && i + 1 < args.Length)
                {
                    opt.Note = args[++i];
                }
                else if (arg == "--help" || arg == "-h")
                {
                    Console.WriteLine("eBro ERP - 개발자 공인 PC 원클릭 등록기 (eBroDevPCRegister)");
                    Console.WriteLine("사용법: eBroDevPCRegister.exe [옵션]");
                    Console.WriteLine("  (인자 없이 실행 시 모든 하드웨어를 자동 감지하여 1초 만에 중앙 DB 등록 완결)");
                    Console.WriteLine("");
                    Console.WriteLine("옵션:");
                    Console.WriteLine("  --interactive, -i    수동 대화형 입력 모드");
                    Console.WriteLine("  --name <이름>        등록할 개발자 성명 (기본값: '대표 개발자')");
                    Console.WriteLine("  --id <아이디>        개발자 로그인 ID (기본값: 'sys-admin')");
                    Console.WriteLine("  --key <보안키>       마스터 보안키 (기본값: 내장 마스터키)");
                    Console.WriteLine("  --note <메모>        인가 사유 또는 등록 비고");
                    Environment.Exit(0);
                }
            }
            return opt;
        }

        private static void WaitForKeyAndExit(int exitCode)
        {
            try
            {
                if (Environment.UserInteractive && !Console.IsInputRedirected)
                {
                    Console.WriteLine("\n[종료하려면 아무 키나 누르십시오...]");
                    Console.ReadKey();
                }
            }
            catch { }
            Environment.Exit(exitCode);
        }
    }
}
