Add-Type -AssemblyName System.Drawing
$targetPath = 'C:\Users\이정용\.gemini\antigravity\brain\3aeebfee-9292-4f4f-8045-27ff8e667b37\.user_uploaded\media_1790742684936.png'
$fs = [System.IO.File]::OpenRead($targetPath)
$bmp = [System.Drawing.Bitmap]::FromStream($fs)

Write-Host "Width = $($bmp.Width), Height = $($bmp.Height)"

$points = @(
    @{ Name = 'Page Background'; X = 50; Y = 40 },
    @{ Name = 'Bank Card 1'; X = 100; Y = 80 },
    @{ Name = 'Filter Panel'; X = 100; Y = 170 },
    @{ Name = 'Table Header'; X = 100; Y = 230 },
    @{ Name = 'Table Row 1 (Left Col)'; X = 50; Y = 280 },
    @{ Name = 'Table Row 1 (Date Col)'; X = 180; Y = 280 },
    @{ Name = 'Table Row 1 (Name Col)'; X = 280; Y = 280 },
    @{ Name = 'Table Row 1 (Right Col)'; X = 700; Y = 280 },
    @{ Name = 'Table Row 2 (Name Col)'; X = 280; Y = 320 },
    @{ Name = 'Bottom Bar'; X = 200; Y = ($bmp.Height - 15) }
)

foreach ($pt in $points) {
    $c = $bmp.GetPixel($pt.X, $pt.Y)
    $hex = "#{0:X2}{1:X2}{2:X2}" -f $c.R, $c.G, $c.B
    Write-Host ("[{0}] at ({1}, {2}) => RGB({3}, {4}, {5}) / Hex: {6}" -f $pt.Name, $pt.X, $pt.Y, $c.R, $c.G, $c.B, $hex)
}

$bmp.Dispose()
$fs.Dispose()
