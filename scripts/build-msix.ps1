<#
.SYNOPSIS
  Builds a Microsoft Store MSIX package from the release build of the desktop app.

.DESCRIPTION
  1. Builds the Tauri release binary (unless -SkipBuild).
  2. Stages shunbo-desktop.exe, its WebView2 loader and tile assets into a package folder.
  3. Fills the manifest with the Partner Center identity values and the app version.
  4. Runs makeappx (Windows SDK) to produce Shunbo_<version>_x64.msix.
  5. Optionally signs with a self-signed certificate for local install testing (-SelfSign).
     Store submissions are signed by Microsoft; do NOT upload a self-signed package.

.PARAMETER IdentityName        From Partner Center: e.g. 12345YourName.Shunbo
.PARAMETER Publisher           From Partner Center: e.g. CN=12345678-ABCD-...
.PARAMETER PublisherDisplay    From Partner Center: your publisher display name

.EXAMPLE
  .\scripts\build-msix.ps1 -IdentityName "12345Enan.Shunbo" -Publisher "CN=00000000-0000-0000-0000-000000000000" -PublisherDisplay "Enan" -SelfSign
#>
param(
  [Parameter(Mandatory = $true)] [string] $IdentityName,
  [Parameter(Mandatory = $true)] [string] $Publisher,
  [Parameter(Mandatory = $true)] [string] $PublisherDisplay,
  [switch] $SkipBuild,
  [switch] $SelfSign
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$desktop = Join-Path $root "apps\desktop"
$tauriDir = Join-Path $desktop "src-tauri"
$conf = Get-Content (Join-Path $tauriDir "tauri.conf.json") | ConvertFrom-Json
$version = "$($conf.version).0"   # MSIX needs four parts
$out = Join-Path $tauriDir "target\msix"
$pkg = Join-Path $out "package"

# Windows SDK tools
$kits = "C:\Program Files (x86)\Windows Kits\10\bin"
$sdkVer = Get-ChildItem $kits -Directory | Where-Object { $_.Name -match '^10\.' } | Sort-Object Name -Descending | Select-Object -First 1
if (-not $sdkVer) { throw "Windows 10 SDK not found under $kits. Install it from the Visual Studio Installer (Individual components → Windows 10/11 SDK)." }
$makeappx = Join-Path $sdkVer.FullName "x64\makeappx.exe"
$signtool = Join-Path $sdkVer.FullName "x64\signtool.exe"
if (-not (Test-Path $makeappx)) { throw "makeappx.exe not found at $makeappx" }

if (-not $SkipBuild) {
  Write-Host "Building release binary..."
  Push-Location $desktop
  npm run tauri build -- --no-bundle
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw "tauri build failed" }
  Pop-Location
}

# Stage files
if (Test-Path $pkg) { Remove-Item $pkg -Recurse -Force }
New-Item -ItemType Directory -Force (Join-Path $pkg "Assets") | Out-Null
Copy-Item (Join-Path $tauriDir "target\release\shunbo-desktop.exe") $pkg
$icons = Join-Path $tauriDir "icons"
Copy-Item (Join-Path $icons "StoreLogo.png") (Join-Path $pkg "Assets\StoreLogo.png")
Copy-Item (Join-Path $icons "Square150x150Logo.png") (Join-Path $pkg "Assets\Square150x150Logo.png")
Copy-Item (Join-Path $icons "Square44x44Logo.png") (Join-Path $pkg "Assets\Square44x44Logo.png")
Copy-Item (Join-Path $icons "Square310x310Logo.png") (Join-Path $pkg "Assets\LargeTile.png")
Copy-Item (Join-Path $icons "Square71x71Logo.png") (Join-Path $pkg "Assets\SmallTile.png")
Copy-Item (Join-Path $icons "Square310x150Logo.png") (Join-Path $pkg "Assets\Wide310x150Logo.png")

# Manifest
$manifest = Get-Content (Join-Path $desktop "msix\AppxManifest.xml") -Raw
$manifest = $manifest.Replace("IDENTITY_NAME", $IdentityName).Replace("IDENTITY_PUBLISHER_DISPLAY", $PublisherDisplay).Replace("IDENTITY_PUBLISHER", $Publisher).Replace("VERSION_PLACEHOLDER", $version)
Set-Content (Join-Path $pkg "AppxManifest.xml") $manifest -Encoding utf8

# Package
$msix = Join-Path $out "Shunbo_$($conf.version)_x64.msix"
if (Test-Path $msix) { Remove-Item $msix -Force }
& $makeappx pack /d $pkg /p $msix /o
if ($LASTEXITCODE -ne 0) { throw "makeappx failed" }
Write-Host "Package: $msix"

if ($SelfSign) {
  $pfx = Join-Path $out "shunbo-selfsign.pfx"
  if (-not (Test-Path $pfx)) {
    Write-Host "Creating self-signed certificate for local testing (subject must equal Publisher)..."
    $cert = New-SelfSignedCertificate -Type Custom -Subject $Publisher -KeyUsage DigitalSignature -FriendlyName "Shunbo local test" -CertStoreLocation "Cert:\CurrentUser\My" -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")
    $pwd = ConvertTo-SecureString -String "shunbo-local" -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $pwd | Out-Null
    Write-Host "To install the test package, first trust the cert: Import-PfxCertificate -FilePath $pfx -CertStoreLocation Cert:\LocalMachine\Root -Password (ConvertTo-SecureString 'shunbo-local' -AsPlainText -Force)  (run as admin)"
  }
  & $signtool sign /fd SHA256 /a /f $pfx /p "shunbo-local" $msix
  if ($LASTEXITCODE -ne 0) { throw "signtool failed" }
  Write-Host "Signed for local testing. Install with: Add-AppxPackage $msix"
}
