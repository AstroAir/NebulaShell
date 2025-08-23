export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modifiedTime: Date;
  permissions: string;
  owner: string;
  group: string;
}

export interface DirectoryListing {
  path: string;
  items: FileItem[];
  parent?: string;
}

export interface FileTransferRequest {
  sessionId: string;
  localPath?: string;
  remotePath: string;
  direction: 'upload' | 'download';
  fileName: string;
  fileSize?: number;
}

export interface FileTransferProgress {
  transferId: string;
  sessionId: string;
  fileName: string;
  direction: 'upload' | 'download';
  transferred: number;
  total: number;
  percentage: number;
  speed: number; // bytes per second
  status: 'pending' | 'transferring' | 'completed' | 'error' | 'cancelled';
  error?: string;
  startTime: Date;
  estimatedTimeRemaining?: number;
}

export interface FileTransferState {
  transfers: FileTransferProgress[];
  currentDirectory: string;
  directoryListing: DirectoryListing | null;
  selectedFiles: string[];
  isLoading: boolean;
  error: string | null;
}

export interface SFTPCapabilities {
  canUpload: boolean;
  canDownload: boolean;
  canCreateDirectory: boolean;
  canDelete: boolean;
  canRename: boolean;
  maxFileSize: number;
  supportedExtensions: string[];
}

export interface FileOperation {
  type: 'create_directory' | 'delete' | 'rename' | 'copy' | 'move';
  source: string;
  destination?: string;
  sessionId: string;
}

export interface FileOperationResult {
  success: boolean;
  message?: string;
  error?: string;
}
