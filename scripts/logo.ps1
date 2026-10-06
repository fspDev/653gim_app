# Genera las variantes del logo y los íconos de la app a partir del logo original del 653.
# Uso (Windows): powershell -File scripts/logo.ps1   (el original está en marca/logo653-original.png)
#   src/assets/logo653.png         logo completo, para fondo claro
#   src/assets/logo653-oscuro.png  logo completo, para fondo oscuro (los grises pasan a claros)
#   src/assets/marca653.png        sin "gym & fitness", para encabezados chicos
#   src/assets/marca653-oscuro.png
#   public/                        favicon e íconos de la app (marca sobre blanco)
param([string]$Origen = 'marca/logo653-original.png')

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$src = New-Object System.Drawing.Bitmap ((Resolve-Path $Origen).Path)

# Recortes medidos sobre el original de 894 x 894 (escalados si cambia el tamaño).
$k = $src.Width / 894
function Rect($x0, $y0, $x1, $y1) { New-Object System.Drawing.Rectangle ([int]($x0 * $k)), ([int]($y0 * $k)), ([int](($x1 - $x0) * $k)), ([int](($y1 - $y0) * $k)) }
$completo = Rect 180 221 713 706
$marca = Rect 180 221 713 638

function Crop($rect) {
  $out = New-Object System.Drawing.Bitmap $rect.Width, $rect.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $rect.Width, $rect.Height), $rect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $out
}

# Fondo oscuro: los píxeles grises (poca saturación) se aclaran conservando el brillo del degradé; el rojo queda igual.
function Oscuro($bmp) {
  $out = $bmp.Clone()
  for ($x = 0; $x -lt $out.Width; $x++) {
    for ($y = 0; $y -lt $out.Height; $y++) {
      $c = $out.GetPixel($x, $y)
      if ($c.A -eq 0) { continue }
      $max = [Math]::Max($c.R, [Math]::Max($c.G, $c.B)); $min = [Math]::Min($c.R, [Math]::Min($c.G, $c.B))
      if ($max - $min -lt 40) {
        $v = [int][Math]::Min(255, 255 - $max * 0.55)
        $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($c.A, $v, $v, $v))
      }
    }
  }
  $out
}

# Achica con buena calidad y lo centra en un lienzo cuadrado.
function Icono($bmp, $size, $escala, $fondo) {
  $out = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml($fondo))
  $w = $size * $escala
  $h = $w * $bmp.Height / $bmp.Width
  $g.DrawImage($bmp, [single](($size - $w) / 2), [single](($size - $h) / 2), [single]$w, [single]$h)
  $g.Dispose()
  $out
}

# Achica a un ancho dado, manteniendo la proporción.
function Ancho($bmp, $w) {
  $h = [int][Math]::Round($w * $bmp.Height / $bmp.Width)
  $out = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($bmp, 0, 0, $w, $h)
  $g.Dispose()
  $out
}

function Guardar($bmp, $ruta) { $bmp.Save((Join-Path (Get-Location) $ruta), [System.Drawing.Imaging.ImageFormat]::Png) }

New-Item -ItemType Directory -Force src/assets | Out-Null
$full = Crop $completo
$mark = Crop $marca
# El logo se muestra a menos de 400 px: se guarda a 2x de eso para pantallas densas.
$fullChico = Ancho $full 640
$markChico = Ancho $mark 320
Guardar $fullChico 'src/assets/logo653.png'
Guardar (Oscuro $fullChico) 'src/assets/logo653-oscuro.png'
Guardar $markChico 'src/assets/marca653.png'
Guardar (Oscuro $markChico) 'src/assets/marca653-oscuro.png'

Guardar (Icono $mark 64 0.86 '#ffffff') 'public/favicon.png'
Guardar (Icono $mark 192 0.76 '#ffffff') 'public/pwa-192x192.png'
Guardar (Icono $mark 512 0.76 '#ffffff') 'public/pwa-512x512.png'
# Maskable: el sistema recorta hasta un círculo del 80 %; la marca queda bien adentro.
Guardar (Icono $mark 512 0.56 '#ffffff') 'public/maskable-512x512.png'
Guardar (Icono $mark 180 0.76 '#ffffff') 'public/apple-touch-icon.png'

$src.Dispose()
Write-Output 'Logo e íconos generados.'
