#!/bin/bash
# WebTerminal Pro - Cross-Platform Build Script (Unix/Linux/macOS)
# This script builds the application for all supported platforms

set -e

# Default values
BUILD_TYPE="release"
SKIP_FRONTEND=false
SKIP_TESTS=false
OUTPUT_DIR="./dist"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --build-type)
            BUILD_TYPE="$2"
            shift 2
            ;;
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "🚀 WebTerminal Pro - Cross-Platform Build Script"
echo "Build Type: $BUILD_TYPE"
echo "Output Directory: $OUTPUT_DIR"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "🔍 Checking prerequisites..."

prerequisites=("node" "pnpm" "cargo" "rustc")
for cmd in "${prerequisites[@]}"; do
    if command_exists "$cmd"; then
        version=$($cmd --version | head -n1)
        echo "✅ $cmd: $version"
    else
        echo "❌ $cmd not found"
        exit 1
    fi
done

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build frontend
if [ "$SKIP_FRONTEND" = false ]; then
    echo "🎨 Building frontend..."
    pnpm build:frontend
    echo "✅ Frontend build completed"
fi

# Run tests
if [ "$SKIP_TESTS" = false ]; then
    echo "🧪 Running tests..."
    cd src-tauri
    cargo test --$BUILD_TYPE
    cd ..
    echo "✅ Tests passed"
fi

# Build Tauri application
echo "🔨 Building Tauri application..."

BUILD_ARGS="tauri build"
if [ "$BUILD_TYPE" = "debug" ]; then
    BUILD_ARGS="tauri build --debug"
fi

# Add platform-specific arguments
case "$(uname -s)" in
    Darwin*)
        BUILD_ARGS="$BUILD_ARGS --target x86_64-apple-darwin --target aarch64-apple-darwin"
        ;;
    Linux*)
        BUILD_ARGS="$BUILD_ARGS --target x86_64-unknown-linux-gnu"
        ;;
    CYGWIN*|MINGW32*|MSYS*|MINGW*)
        BUILD_ARGS="$BUILD_ARGS --target x86_64-pc-windows-msvc"
        ;;
esac

pnpm $BUILD_ARGS

# Copy build artifacts
echo "📋 Copying build artifacts..."

SOURCE_DIR="src-tauri/target/release/bundle"
if [ "$BUILD_TYPE" = "debug" ]; then
    SOURCE_DIR="src-tauri/target/debug/bundle"
fi

if [ -d "$SOURCE_DIR" ]; then
    cp -r "$SOURCE_DIR"/* "$OUTPUT_DIR"/
    echo "✅ Build artifacts copied to $OUTPUT_DIR"
else
    echo "⚠️ No build artifacts found in $SOURCE_DIR"
fi

# Generate checksums
echo "🔐 Generating checksums..."
find "$OUTPUT_DIR" -type f -exec sh -c '
    for file; do
        sha256sum "$file" > "$file.sha256"
    done
' sh {} +

echo "🎉 Build completed successfully!"
echo "📁 Output directory: $OUTPUT_DIR"

# Display build summary
echo ""
echo "📊 Build Summary:"
find "$OUTPUT_DIR" -type f -not -name "*.sha256" | while read -r file; do
    size=$(du -h "$file" | cut -f1)
    basename_file=$(basename "$file")
    echo "  📄 $basename_file ($size)"
done

echo ""
echo "🚀 Ready for distribution!"
