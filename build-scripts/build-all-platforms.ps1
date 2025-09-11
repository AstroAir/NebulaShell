# WebTerminal Pro - Cross-Platform Build Script
# This script builds the application for all supported platforms

param(
    [string]$BuildType = "release",
    [switch]$SkipFrontend = $false,
    [switch]$SkipTests = $false,
    [string]$OutputDir = "./dist"
)

Write-Host "🚀 WebTerminal Pro - Cross-Platform Build Script" -ForegroundColor Cyan
Write-Host "Build Type: $BuildType" -ForegroundColor Yellow
Write-Host "Output Directory: $OutputDir" -ForegroundColor Yellow

# Create output directory
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# Function to check if command exists
function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Check prerequisites
Write-Host "🔍 Checking prerequisites..." -ForegroundColor Blue

$prerequisites = @(
    @{Name="node"; Command="node --version"},
    @{Name="pnpm"; Command="pnpm --version"},
    @{Name="cargo"; Command="cargo --version"},
    @{Name="rustc"; Command="rustc --version"}
)

foreach ($prereq in $prerequisites) {
    if (Test-Command $prereq.Name) {
        $version = Invoke-Expression $prereq.Command
        Write-Host "✅ $($prereq.Name): $version" -ForegroundColor Green
    } else {
        Write-Host "❌ $($prereq.Name) not found" -ForegroundColor Red
        exit 1
    }
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Build frontend
if (!$SkipFrontend) {
    Write-Host "🎨 Building frontend..." -ForegroundColor Blue
    pnpm build:frontend
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Frontend build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Frontend build completed" -ForegroundColor Green
}

# Run tests
if (!$SkipTests) {
    Write-Host "🧪 Running tests..." -ForegroundColor Blue
    Set-Location src-tauri
    cargo test --$BuildType
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Tests failed" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
    Set-Location ..
    Write-Host "✅ Tests passed" -ForegroundColor Green
}

# Build Tauri application
Write-Host "🔨 Building Tauri application..." -ForegroundColor Blue

$buildArgs = @("tauri", "build")
if ($BuildType -eq "debug") {
    $buildArgs += "--debug"
}

# Add platform-specific arguments
if ($IsWindows) {
    $buildArgs += "--target", "x86_64-pc-windows-msvc"
} elseif ($IsMacOS) {
    $buildArgs += "--target", "x86_64-apple-darwin"
    $buildArgs += "--target", "aarch64-apple-darwin"
} elseif ($IsLinux) {
    $buildArgs += "--target", "x86_64-unknown-linux-gnu"
}

pnpm @$buildArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Tauri build failed" -ForegroundColor Red
    exit 1
}

# Copy build artifacts
Write-Host "📋 Copying build artifacts..." -ForegroundColor Blue

$sourceDir = "src-tauri/target/release/bundle"
if ($BuildType -eq "debug") {
    $sourceDir = "src-tauri/target/debug/bundle"
}

if (Test-Path $sourceDir) {
    Copy-Item -Path "$sourceDir/*" -Destination $OutputDir -Recurse -Force
    Write-Host "✅ Build artifacts copied to $OutputDir" -ForegroundColor Green
} else {
    Write-Host "⚠️ No build artifacts found in $sourceDir" -ForegroundColor Yellow
}

# Generate checksums
Write-Host "🔐 Generating checksums..." -ForegroundColor Blue
Get-ChildItem -Path $OutputDir -Recurse -File | ForEach-Object {
    $hash = Get-FileHash -Path $_.FullName -Algorithm SHA256
    $checksumFile = "$($_.FullName).sha256"
    "$($hash.Hash.ToLower())  $($_.Name)" | Out-File -FilePath $checksumFile -Encoding UTF8
}

Write-Host "🎉 Build completed successfully!" -ForegroundColor Green
Write-Host "📁 Output directory: $OutputDir" -ForegroundColor Cyan

# Display build summary
Write-Host "`n📊 Build Summary:" -ForegroundColor Cyan
Get-ChildItem -Path $OutputDir -Recurse -File | ForEach-Object {
    $size = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  📄 $($_.Name) ($size MB)" -ForegroundColor White
}

Write-Host "`n🚀 Ready for distribution!" -ForegroundColor Green
