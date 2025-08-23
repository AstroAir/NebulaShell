import SftpClient from 'ssh2-sftp-client';
import { sshManager } from './ssh-manager';
import { logger } from './logger';
import { FileItem, DirectoryListing, FileTransferProgress, FileOperation, FileOperationResult } from '@/types/file-transfer';
import { EventEmitter } from 'events';

// Type for SFTP list item from ssh2-sftp-client
interface SFTPListItem {
  name: string;
  type: string;
  size: number;
  modifyTime: number;
  accessTime: number;
  rights: {
    user: string;
    group: string;
    other: string;
  };
  owner: number;
  group: number;
}

export class SFTPManager extends EventEmitter {
  private sftpClients: Map<string, SftpClient> = new Map();
  private activeTransfers: Map<string, FileTransferProgress> = new Map();

  async createSFTPConnection(sessionId: string): Promise<SftpClient> {
    try {
      const ssh = sshManager.getSSHConnection(sessionId);
      if (!ssh) {
        throw new Error('SSH connection not found');
      }

      const sftp = new SftpClient();
      
      // Use the existing SSH connection
      await sftp.connect({
        sock: (ssh as any).connection, // Access the underlying SSH2 connection
      });

      this.sftpClients.set(sessionId, sftp);
      logger.info('SFTP connection established', {}, sessionId);
      
      return sftp;
    } catch (error) {
      logger.error('Failed to create SFTP connection', { error: error instanceof Error ? error.message : 'Unknown error' }, sessionId);
      throw error;
    }
  }

  async getSFTPClient(sessionId: string): Promise<SftpClient> {
    let sftp = this.sftpClients.get(sessionId);
    
    if (!sftp) {
      sftp = await this.createSFTPConnection(sessionId);
    }

    return sftp;
  }

  async listDirectory(sessionId: string, path: string = '.'): Promise<DirectoryListing> {
    try {
      const sftp = await this.getSFTPClient(sessionId);
      const items = await sftp.list(path);
      
      const fileItems: FileItem[] = items.map((item: SFTPListItem) => ({
        name: item.name,
        path: `${path}/${item.name}`.replace(/\/+/g, '/'),
        type: item.type === 'd' ? 'directory' : 'file',
        size: item.size,
        modifiedTime: new Date(item.modifyTime),
        permissions: item.rights ? item.rights.toString() : '',
        owner: item.owner ? item.owner.toString() : '',
        group: item.group ? item.group.toString() : '',
      }));

      // Sort directories first, then files
      fileItems.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      const parentPath = path === '/' ? undefined : path.split('/').slice(0, -1).join('/') || '/';

      return {
        path,
        items: fileItems,
        parent: parentPath,
      };
    } catch (error) {
      logger.error('Failed to list directory', { path, error: error instanceof Error ? error.message : 'Unknown error' }, sessionId);
      throw error;
    }
  }

  async uploadFile(
    sessionId: string,
    localBuffer: Buffer,
    remotePath: string,
    fileName: string,
    onProgress?: (progress: FileTransferProgress) => void
  ): Promise<string> {
    const transferId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullRemotePath = `${remotePath}/${fileName}`.replace(/\/+/g, '/');

    try {
      const sftp = await this.getSFTPClient(sessionId);
      
      const progress: FileTransferProgress = {
        transferId,
        sessionId,
        fileName,
        direction: 'upload',
        transferred: 0,
        total: localBuffer.length,
        percentage: 0,
        speed: 0,
        status: 'transferring',
        startTime: new Date(),
      };

      this.activeTransfers.set(transferId, progress);
      
      if (onProgress) {
        onProgress(progress);
      }

      // Upload the file
      await sftp.put(localBuffer, fullRemotePath);

      // Update progress to completed
      progress.status = 'completed';
      progress.percentage = 100;
      progress.transferred = localBuffer.length;
      
      if (onProgress) {
        onProgress(progress);
      }

      this.activeTransfers.delete(transferId);
      logger.info('File uploaded successfully', { fileName, remotePath: fullRemotePath }, sessionId);

      return fullRemotePath;
    } catch (error) {
      const progress = this.activeTransfers.get(transferId);
      if (progress) {
        progress.status = 'error';
        progress.error = error instanceof Error ? error.message : 'Upload failed';
        if (onProgress) {
          onProgress(progress);
        }
      }
      
      logger.error('File upload failed', { fileName, remotePath: fullRemotePath, error: error instanceof Error ? error.message : 'Unknown error' }, sessionId);
      throw error;
    }
  }

  async downloadFile(
    sessionId: string,
    remotePath: string,
    onProgress?: (progress: FileTransferProgress) => void
  ): Promise<Buffer> {
    const transferId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fileName = remotePath.split('/').pop() || 'unknown';

    try {
      const sftp = await this.getSFTPClient(sessionId);

      // Get file stats to determine size
      const stats = await sftp.stat(remotePath);

      const progress: FileTransferProgress = {
        transferId,
        sessionId,
        fileName,
        direction: 'download',
        transferred: 0,
        total: stats.size,
        percentage: 0,
        speed: 0,
        status: 'transferring',
        startTime: new Date(),
      };

      this.activeTransfers.set(transferId, progress);

      if (onProgress) {
        onProgress(progress);
      }

      // Download the file
      const buffer = await sftp.get(remotePath) as Buffer;

      // Update progress to completed
      progress.status = 'completed';
      progress.percentage = 100;
      progress.transferred = buffer.length;

      if (onProgress) {
        onProgress(progress);
      }

      this.activeTransfers.delete(transferId);
      logger.info('File downloaded successfully', { fileName, remotePath }, sessionId);

      return buffer;
    } catch (error) {
      const progress = this.activeTransfers.get(transferId);
      if (progress) {
        progress.status = 'error';
        progress.error = error instanceof Error ? error.message : 'Download failed';
        if (onProgress) {
          onProgress(progress);
        }
      }

      logger.error('File download failed', { fileName, remotePath, error: error instanceof Error ? error.message : 'Unknown error' }, sessionId);
      throw error;
    }
  }

  async performFileOperation(sessionId: string, operation: FileOperation): Promise<FileOperationResult> {
    try {
      const sftp = await this.getSFTPClient(sessionId);
      
      switch (operation.type) {
        case 'create_directory':
          await sftp.mkdir(operation.source, true);
          logger.info('Directory created', { path: operation.source }, sessionId);
          return { success: true, message: 'Directory created successfully' };
          
        case 'delete':
          const stats = await sftp.stat(operation.source);
          if (stats.isDirectory) {
            await sftp.rmdir(operation.source, true);
          } else {
            await sftp.delete(operation.source);
          }
          logger.info('File/directory deleted', { path: operation.source }, sessionId);
          return { success: true, message: 'Deleted successfully' };
          
        case 'rename':
          if (!operation.destination) {
            throw new Error('Destination path required for rename operation');
          }
          await sftp.rename(operation.source, operation.destination);
          logger.info('File/directory renamed', { from: operation.source, to: operation.destination }, sessionId);
          return { success: true, message: 'Renamed successfully' };
          
        default:
          throw new Error(`Unsupported operation: ${operation.type}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Operation failed';
      logger.error('File operation failed', { operation: operation.type, source: operation.source, error: errorMessage }, sessionId);
      return { success: false, error: errorMessage };
    }
  }

  async closeSFTPConnection(sessionId: string): Promise<void> {
    const sftp = this.sftpClients.get(sessionId);
    if (!sftp) {
      throw new Error('SFTP connection not found');
    }

    try {
      await sftp.end();
      this.sftpClients.delete(sessionId);
      logger.info('SFTP connection closed', {}, sessionId);
    } catch (error) {
      logger.error('Error closing SFTP connection', { error: error instanceof Error ? error.message : 'Unknown error' }, sessionId);
      throw error;
    }
  }

  getActiveTransfers(): FileTransferProgress[] {
    return Array.from(this.activeTransfers.values());
  }

  cancelTransfer(transferId: string): boolean {
    const transfer = this.activeTransfers.get(transferId);
    if (transfer && transfer.status === 'transferring') {
      transfer.status = 'cancelled';
      this.activeTransfers.delete(transferId);
      return true;
    }
    return false;
  }
}

export const sftpManager = new SFTPManager();
