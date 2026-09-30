Add-Type -AssemblyName System.Drawing
$imgPath = 'C:\Users\이정용\.gemini\antigravity\brain\3aeebfee-9292-4f4f-8045-27ff8e667b37\.user_uploaded\media_1790742684936.png'
$bmp = [System.Drawing.Bitmap]::FromFile($imgPath)
Write-Host "Width: $($bmp.Width), Height: $($bmp.Height)"

function Show-Pixel($name, $x, $y) {
    $c = $bmp.GetPixel($x, $y)
    Write-Host "$name ($x, $y): R=$($c.R), G=$($c.G), B=$($c.B) [Hex: #$($c.R.ToString('X2'))$($c.G.ToString('X2'))$($c.B.ToString('X2'))]"
}

Show-Pixel "Top background" 100 40
Show-Pixel "Bank card area" 100 100
Show-Pixel "Filter area" 100 170
Show-Pixel "Table header" 100 230
Show-Pixel "Table row 1 (left col)" 80 270
Show-Pixel "Table row 1 (bank col)" 110 270
Show-Pixel "Table row 1 (date col)" 170 270
Show-Pixel "Table row 1 (name col)" 260 270
Show-Pixel "Table row 1 (memo col)" 700 270
Show-Pixel "Table row 1 text color" 260 268
Show-Pixel "Bottom bar" 200 ($bmp.Height - 15)

$bmp.Dispose()
