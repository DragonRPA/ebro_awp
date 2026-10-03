# agent/certs/sign-exe.ps1
$certPath = "d:\01.AntiGravity\Giyuen_Lift\agent\certs\KiyeunLift_CodeSign.pfx"
$pfxPass = "KiyeunLift@2026"
$targetExe = "d:\01.AntiGravity\Giyuen_Lift\agent\eBroAgent.exe"

$cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($certPath, $pfxPass)
$sig = Set-AuthenticodeSignature -FilePath $targetExe -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
Write-Host "Signature Status: $($sig.Status)"
Write-Host "Signer: $($sig.SignerCertificate.Subject)"
