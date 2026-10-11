using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Security.Cryptography;
using System.Text;

namespace EBro.DeveloperDeviceRegistrar
{
    class Program
    {
        // ─── 시스템 보안 및 Supabase 설정 상수 ───────────────────────────────────────
        private const string SUPABASE_URL = "https://wywgkikkjgbnlljkkmnz.supabase.co";
        private const string SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5d2draWtramdibmxsamtrbW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcxMzgsImV4cCI6MjA5OTk0MzEzOH0.gSftxhQjFmWUQzikx-Q5UsdgNKSZISZqJvUGeLBOCqU";
        private const string DEFAULT_MASTER_KEY = "ebro-dev-master-2026!";
        private const string EMERGENCY_BREAK_GLASS_KEY = "ebro-breakglass-recovery-2026!";
        private const string DEFAULT_WEB_URL = "http://localhost:5174";
        private const int VAULT_CIPHER_KEY = 0x4f;
        private const string VAULT_PREFIX = "__EBRO_ENC__v1__";

        static void Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            ConfigureSecurityProtocol();

            PrintBanner();

            try
            {
                // 1. 명령줄 옵션 파싱 또는 대화형 정보 수집
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

                // 주 MAC 주소 선택
                string selectedMac = hardware.MacAddresses[0];
                if (hardware.MacAddresses.Count > 1 && !options.AutoMode)
                {
                    selectedMac = SelectMacAddress(hardware.MacAddresses);
                }

                // 3. 개발자 인가 정보 입력 (대화형 모드인 경우)
                if (!options.AutoMode)
                {
                    PromptForDetails(options, hardware);
                }

                // 4. 보안키 인증 검증
                if (options.MasterKey != DEFAULT_MASTER_KEY && options.MasterKey != EMERGENCY_BREAK_GLASS_KEY)
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("\n❌ [보안 실패] 입력된 물리 마스터 보안키가 유효하지 않습니다.");
                    Console.ResetColor();
                    WaitForKeyAndExit(1);
                    return;
                }

                bool isEmergency = (options.MasterKey == EMERGENCY_BREAK_GLASS_KEY);

                // 5. DB 등록 페이로드 구성
                Console.WriteLine("\n[2단계] eBro ERP 중앙 데이터베이스(Supabase) 등록 통신 준비...");
                string cleanMac = selectedMac.Replace("-", "");
                string macSuffix = cleanMac.Substring(Math.Max(0, cleanMac.Length - 6));
                string deviceId = "DEV-PC-" + DateTime.Now.ToString("yyyyMMdd") + "-" + macSuffix;
                string fingerprint = GenerateDeterministicFingerprint(hardware, selectedMac);

                string nowIso = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");

                var deviceProfile = new Dictionary<string, object>
                {
                    { "id", deviceId },
                    { "developerId", options.DeveloperId },
                    { "developerName", options.DeveloperName },
                    { "machineName", hardware.MachineName },
                    { "macAddress", selectedMac },
                    { "hardwareFingerprint", fingerprint },
                    { "platform", hardware.Platform },
                    { "status", "ACTIVE" },
                    { "isPrimary", options.IsPrimary },
                    { "emergencyBreakGlassUsed", isEmergency },
                    { "note", string.IsNullOrEmpty(options.Note) ? (isEmergency ? "비상 단말기 단일실행기 등록" : "공인 단말기 원클릭 단일실행기(eBroDevPCRegister.exe) 등록") : options.Note },
                    { "registeredAt", nowIso },
                    { "lastVerifiedAt", nowIso },
                    { "tenant_id", "tenant-giyeonlift" }
                };

                // 6. Supabase REST API 호출 (기존 등록 여부 조회 후 Upsert)
                Console.WriteLine("[3단계] Supabase DB `developer_authorized_devices` 테이블에 영구 저장 중...");
                bool dbSuccess = RegisterToSupabase(deviceProfile, selectedMac);

                if (!dbSuccess)
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("❌ DB 저장 과정에서 오류가 발생했습니다. 네트워크 연결 상태를 확인하십시오.");
                    Console.ResetColor();
                    WaitForKeyAndExit(1);
                    return;
                }

                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("✅ [DB 저장 완료] Supabase 영구 인가 대장에 성공적으로 등록/갱신되었습니다!");
                Console.ResetColor();

                // 7. 로컬 단말기 암호화 바인딩 토큰 생성
                string tokenPayload = string.Format(
                    "{{\"id\":\"{0}\",\"deviceId\":\"{0}\",\"macAddress\":\"{1}\",\"hardwareFingerprint\":\"{2}\",\"status\":\"ACTIVE\",\"sealedAt\":\"{3}\"}}",
                    deviceId, selectedMac, fingerprint, nowIso
                );
                string encryptedToken = EncryptSecret(tokenPayload);

                // 8. 웹 브라우저 자동 바인딩 및 런처 링크 제공
                string bindUrl = string.Format(
                    "{0}/?dev_bind_id={1}&dev_token={2}&dev_mac={3}",
                    options.WebUrl.TrimEnd('/'),
                    Uri.EscapeDataString(deviceId),
                    Uri.EscapeDataString(encryptedToken),
                    Uri.EscapeDataString(selectedMac)
                );

                PrintSuccessReceipt(deviceProfile, bindUrl, isEmergency);

                // 9. 브라우저 즉시 실행 여부
                bool openBrowser = options.AutoMode;
                if (!options.AutoMode)
                {
                    Console.Write("\n🌐 지금 바로 웹 브라우저를 열어 eBro ERP에 연결하시겠습니까? (Y/N, 기본값: Y): ");
                    string ans = Console.ReadLine();
                    openBrowser = string.IsNullOrEmpty(ans) || ans.Trim().ToUpper() == "Y";
                }

                if (openBrowser)
                {
                    Console.WriteLine("🚀 기본 웹 브라우저를 호출하여 eBro ERP 공인 바인딩을 실행합니다...");
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = bindUrl,
                        UseShellExecute = true
                    });
                }

                Console.ForegroundColor = ConsoleColor.Cyan;
                Console.WriteLine("\n✨ 등록 작업이 성공적으로 완결되었습니다.");
                Console.ResetColor();
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

        // ─── 배너 및 UI ─────────────────────────────────────────────────────────────
        private static void PrintBanner()
        {
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("================================================================================");
            Console.WriteLine("   🛡️   eBro ERP - 개발자 공인 PC 원클릭 등록 프로그램 (eBroDevPCRegister)   ");
            Console.WriteLine("================================================================================");
            Console.ResetColor();
            Console.WriteLine("  [목적]");
            Console.WriteLine("   • 개발자 PC 고장, 파손, 도난/분실 시 신규/대체 PC에 즉시 개발자 권한 부여");
            Console.WriteLine("   • 신규 개발자 입사 시 해당 개발자의 물리적 PC를 공인 개발자 단말기로 추가");
            Console.WriteLine("   • 물리적 MAC 주소 및 하드웨어 지문을 수집하여 eBro 중앙 DB에 영구 등록");
            Console.WriteLine("--------------------------------------------------------------------------------");
        }

        private static void DisplayHardwareInfo(HardwareInfo hw)
        {
            Console.WriteLine("  • 컴퓨터 이름(Hostname): " + hw.MachineName);
            Console.WriteLine("  • 운영체제(OS Platform): " + hw.OsVersion + " (" + hw.Platform + ")");
            Console.WriteLine("  • CPU 논리 프로세서 수 : " + hw.ProcessorCount + " Cores");
            Console.WriteLine("  • 감지된 물리적 MAC 목록:");
            for (int i = 0; i < hw.MacAddresses.Count; i++)
            {
                Console.WriteLine("     [{0}] {1} ({2})", i + 1, hw.MacAddresses[i], hw.AdapterNames[i]);
            }
        }

        private static string SelectMacAddress(List<string> macs)
        {
            Console.Write("\n사용할 주 MAC 어댑터 번호를 선택하십시오 (기본값: 1): ");
            string input = Console.ReadLine();
            int idx;
            if (int.TryParse(input, out idx) && idx >= 1 && idx <= macs.Count)
            {
                return macs[idx - 1];
            }
            return macs[0];
        }

        private static void PromptForDetails(CliOptions options, HardwareInfo hw)
        {
            Console.WriteLine("\n[기본 정보 확인 및 입력 (Enter 키를 누르면 기본값이 적용됩니다)]");

            Console.Write("  1. 개발자 성명 (기본값: {0}): ", options.DeveloperName);
            string devName = Console.ReadLine();
            if (!string.IsNullOrWhiteSpace(devName)) options.DeveloperName = devName.Trim();

            Console.Write("  2. 개발자 로그인 ID (기본값: {0}): ", options.DeveloperId);
            string devId = Console.ReadLine();
            if (!string.IsNullOrWhiteSpace(devId)) options.DeveloperId = devId.Trim();

            Console.Write("  3. 주 개발 PC로 지정하시겠습니까? (Y/N, 기본값: N): ");
            string isPrimaryInput = Console.ReadLine();
            options.IsPrimary = (!string.IsNullOrEmpty(isPrimaryInput) && isPrimaryInput.Trim().ToUpper() == "Y");

            Console.Write("  4. 마스터 보안 인증키 (기본 인증키 적용: Enter): ");
            string keyInput = Console.ReadLine();
            if (!string.IsNullOrWhiteSpace(keyInput)) options.MasterKey = keyInput.Trim();

            Console.Write("  5. eBro ERP 웹 주소 (기본값: {0}): ", options.WebUrl);
            string urlInput = Console.ReadLine();
            if (!string.IsNullOrWhiteSpace(urlInput)) options.WebUrl = urlInput.Trim();
        }

        private static void PrintSuccessReceipt(Dictionary<string, object> dev, string bindUrl, bool isEmergency)
        {
            Console.WriteLine("\n================================================================================");
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("🎉  [등록 완결] 현재 PC가 eBro ERP 공인 개발자 단말기로 승인되었습니다!");
            Console.ResetColor();
            Console.WriteLine("================================================================================");
            Console.WriteLine("  • 공인 단말기 식별 ID : " + dev["id"]);
            Console.WriteLine("  • 컴퓨터 이름         : " + dev["machineName"]);
            Console.WriteLine("  • 물리 MAC 주소       : " + dev["macAddress"]);
            Console.WriteLine("  • 하드웨어 고유 지문  : " + dev["hardwareFingerprint"]);
            Console.WriteLine("  • 개발자 명칭 / ID    : " + dev["developerName"] + " (" + dev["developerId"] + ")");
            Console.WriteLine("  • 등록 상태           : " + dev["status"] + (isEmergency ? " (비상 마스터 인증)" : " (정상 공인)"));
            Console.WriteLine("  • 영구 DB 보존 위치   : Supabase table 'developer_authorized_devices'");
            Console.WriteLine("--------------------------------------------------------------------------------");
            Console.WriteLine("🔑 이제 브라우저에서 'admin' 또는 관리자 계정으로 로그인하시면 즉시 통과됩니다.");
            Console.WriteLine("================================================================================");
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

            foreach (NetworkInterface nic in NetworkInterface.GetAllNetworkInterfaces())
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

                // D4-AB-61-46-47-82 규격 포맷팅
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
                    info.AdapterNames.Add(nic.Name + " - " + nic.Description);
                }
            }

            // 만약 가상 어댑터 필터 때문에 비어있다면 전체 중 유효한 첫 번째 인터페이스라도 수집
            if (info.MacAddresses.Count == 0)
            {
                foreach (NetworkInterface nic in NetworkInterface.GetAllNetworkInterfaces())
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

        // ─── Supabase REST 통신 ───────────────────────────────────────────────────
        private static bool RegisterToSupabase(Dictionary<string, object> device, string macAddress)
        {
            try
            {
                // 1. 기존 기기 확인 (동일 MAC 주소 존재 여부 조회)
                string queryUrl = string.Format("{0}/rest/v1/developer_authorized_devices?macAddress=eq.{1}&select=id", SUPABASE_URL, macAddress);
                string existingId = null;

                try
                {
                    var getReq = (HttpWebRequest)WebRequest.Create(queryUrl);
                    getReq.Method = "GET";
                    getReq.Headers["apikey"] = SUPABASE_ANON_KEY;
                    getReq.Headers["Authorization"] = "Bearer " + SUPABASE_ANON_KEY;
                    getReq.ContentType = "application/json";

                    using (var res = (HttpWebResponse)getReq.GetResponse())
                    using (var reader = new StreamReader(res.GetResponseStream()))
                    {
                        string body = reader.ReadToEnd();
                        if (body.StartsWith("[") && body.Length > 2)
                        {
                            // "id":"DEV-PC-..." 파싱
                            int idIdx = body.IndexOf("\"id\":");
                            if (idIdx != -1)
                            {
                                int valStart = body.IndexOf('"', idIdx + 5);
                                if (valStart != -1)
                                {
                                    int valEnd = body.IndexOf('"', valStart + 1);
                                    if (valEnd != -1)
                                    {
                                        existingId = body.Substring(valStart + 1, valEnd - valStart - 1);
                                    }
                                }
                            }
                        }
                    }
                }
                catch (Exception qEx)
                {
                    Console.WriteLine("  (기존 등록 조회 알림: " + qEx.Message + ")");
                }

                if (!string.IsNullOrEmpty(existingId))
                {
                    Console.WriteLine("  ➔ 동일 MAC 주소의 기존 등록 기기 발견 (ID: {0}). 해당 레코드를 갱신합니다.", existingId);
                    device["id"] = existingId;
                }

                // 2. Upsert 수행 (POST with Prefer: resolution=merge-duplicates)
                string postUrl = SUPABASE_URL + "/rest/v1/developer_authorized_devices";
                var req = (HttpWebRequest)WebRequest.Create(postUrl);
                req.Method = "POST";
                req.Headers["apikey"] = SUPABASE_ANON_KEY;
                req.Headers["Authorization"] = "Bearer " + SUPABASE_ANON_KEY;
                req.Headers["Prefer"] = "resolution=merge-duplicates,return=representation";
                req.ContentType = "application/json; charset=utf-8";

                string jsonPayload = BuildJson(device);
                byte[] byteData = Encoding.UTF8.GetBytes(jsonPayload);
                req.ContentLength = byteData.Length;

                using (Stream stream = req.GetRequestStream())
                {
                    stream.Write(byteData, 0, byteData.Length);
                }

                using (var res = (HttpWebResponse)req.GetResponse())
                {
                    return (res.StatusCode == HttpStatusCode.OK ||
                            res.StatusCode == HttpStatusCode.Created ||
                            res.StatusCode == HttpStatusCode.NoContent);
                }
            }
            catch (WebException webEx)
            {
                string respBody = "";
                if (webEx.Response != null)
                {
                    using (var r = new StreamReader(webEx.Response.GetResponseStream()))
                    {
                        respBody = r.ReadToEnd();
                    }
                }
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("  [Supabase 통신 응답]: " + webEx.Message + " " + respBody);
                Console.ResetColor();
                return false;
            }
            catch (Exception ex)
            {
                Console.WriteLine("  [DB 등록 예외]: " + ex.Message);
                return false;
            }
        }

        // ─── eBro 볼트 암호화 엔진 (JavaScript encryptSecret 호환) ─────────────────
        private static string EncryptSecret(string plainText)
        {
            if (string.IsNullOrEmpty(plainText)) return "";
            try
            {
                byte[] utf8Bytes = Encoding.UTF8.GetBytes(plainText);
                byte[] masked = new byte[utf8Bytes.Length];
                for (int i = 0; i < utf8Bytes.Length; i++)
                {
                    masked[i] = (byte)(utf8Bytes[i] ^ (VAULT_CIPHER_KEY + (i % 7)));
                }
                string b64 = Convert.ToBase64String(masked);

                string checksum;
                using (SHA256 sha = SHA256.Create())
                {
                    byte[] hash = sha.ComputeHash(utf8Bytes);
                    StringBuilder sb = new StringBuilder();
                    for (int i = 0; i < hash.Length; i++) sb.Append(hash[i].ToString("x2"));
                    checksum = sb.ToString().Substring(0, 8);
                }

                return string.Format("{0}{1}__{2}", VAULT_PREFIX, checksum, b64);
            }
            catch
            {
                return plainText;
            }
        }

        // ─── 경량 JSON 직렬화 ────────────────────────────────────────────────────
        private static string BuildJson(Dictionary<string, object> dict)
        {
            StringBuilder sb = new StringBuilder();
            sb.Append("{");
            bool first = true;
            foreach (var kvp in dict)
            {
                if (!first) sb.Append(",");
                first = false;

                sb.Append("\"").Append(kvp.Key).Append("\":");
                if (kvp.Value == null)
                {
                    sb.Append("null");
                }
                else if (kvp.Value is bool)
                {
                    sb.Append(((bool)kvp.Value) ? "true" : "false");
                }
                else if (kvp.Value is int || kvp.Value is long)
                {
                    sb.Append(kvp.Value);
                }
                else
                {
                    sb.Append("\"").Append(EscapeJson(kvp.Value.ToString())).Append("\"");
                }
            }
            sb.Append("}");
            return sb.ToString();
        }

        private static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n");
        }

        private static void ConfigureSecurityProtocol()
        {
            try
            {
                // TLS 1.2 (3072) 및 TLS 1.3 강제 활성화
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
            public bool AutoMode = false;
            public string DeveloperName = "대표 개발자";
            public string DeveloperId = "sys-admin";
            public bool IsPrimary = false;
            public string MasterKey = DEFAULT_MASTER_KEY;
            public string WebUrl = DEFAULT_WEB_URL;
            public string Note = "";
        }

        private static CliOptions ParseArguments(string[] args)
        {
            var opt = new CliOptions();
            for (int i = 0; i < args.Length; i++)
            {
                string arg = args[i].ToLower();
                if (arg == "--auto" || arg == "-y")
                {
                    opt.AutoMode = true;
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
                else if (arg == "--url" && i + 1 < args.Length)
                {
                    opt.WebUrl = args[++i];
                }
                else if (arg == "--primary")
                {
                    opt.IsPrimary = true;
                }
                else if (arg == "--note" && i + 1 < args.Length)
                {
                    opt.Note = args[++i];
                }
                else if (arg == "--help" || arg == "-h")
                {
                    Console.WriteLine("사용법: eBroDevPCRegister.exe [옵션]");
                    Console.WriteLine("  --auto, -y           대화형 프롬프트 없이 감지된 기본값으로 즉시 등록");
                    Console.WriteLine("  --name <이름>        등록할 개발자 성명 (기본값: '대표 개발자')");
                    Console.WriteLine("  --id <아이디>        개발자 로그인 ID (기본값: 'sys-admin')");
                    Console.WriteLine("  --primary            주 개발 워크스테이션으로 등록");
                    Console.WriteLine("  --key <보안키>       마스터 보안키 (기본값: 'ebro-dev-master-2026!')");
                    Console.WriteLine("  --url <ERP웹주소>    eBro ERP 접속 URL (기본값: 'http://localhost:5174')");
                    Console.WriteLine("  --note <메모>        인가 사유 또는 등록 비고");
                    Environment.Exit(0);
                }
            }
            return opt;
        }

        private static void WaitForKeyAndExit(int exitCode)
        {
            Console.WriteLine("\n[종료하려면 아무 키나 누르십시오...]");
            try { Console.ReadKey(); } catch { }
            Environment.Exit(exitCode);
        }
    }
}
