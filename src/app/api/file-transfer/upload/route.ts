import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// File upload size limit (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Allowed file types (can be configured)
const ALLOWED_TYPES = [
  'text/',
  'image/',
  'application/json',
  'application/javascript',
  'application/typescript',
  'application/pdf',
  'application/zip',
  'application/x-tar',
  'application/gzip',
];

interface UploadResponse {
  success: boolean;
  message: string;
  filePath?: string;
  size?: number;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const remotePath = formData.get('remotePath') as string || '~';

    // Validate file
    if (!file) {
      return NextResponse.json({
        success: false,
        message: 'No file provided',
        error: 'MISSING_FILE',
      }, { status: 400 });
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        error: 'FILE_TOO_LARGE',
      }, { status: 400 });
    }

    // Check file type
    const isAllowedType = ALLOWED_TYPES.some(type => file.type.startsWith(type));
    if (!isAllowedType) {
      return NextResponse.json({
        success: false,
        message: 'File type not allowed',
        error: 'INVALID_FILE_TYPE',
      }, { status: 400 });
    }

    // Sanitize filename
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Determine upload directory
    const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    const userUploadDir = join(uploadDir, 'user-uploads'); // In production, use user ID
    
    // Create directory if it doesn't exist
    if (!existsSync(userUploadDir)) {
      await mkdir(userUploadDir, { recursive: true });
    }

    // Create unique filename to avoid conflicts
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${sanitizedFileName}`;
    const filePath = join(userUploadDir, uniqueFileName);

    // Convert file to buffer and write
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    await writeFile(filePath, buffer);

    // Log upload for monitoring
    console.log(`File uploaded: ${uniqueFileName} (${file.size} bytes)`);

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      filePath: `/uploads/user-uploads/${uniqueFileName}`,
      size: file.size,
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Upload failed',
      error: 'UPLOAD_ERROR',
    }, { status: 500 });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
