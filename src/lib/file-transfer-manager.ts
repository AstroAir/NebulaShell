'use client';

import { FileTransferItem } from '@/components/file-transfer/DragDropFileTransfer';

export interface FileTransferOptions {
  chunkSize?: number;
  maxConcurrentTransfers?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface FileTransferProgress {
  transferId: string;
  progress: number;
  speed: number;
  timeRemaining: number;
  bytesTransferred: number;
  totalBytes: number;
}

export interface FileTransferError {
  transferId: string;
  error: string;
  code?: string;
  retryable?: boolean;
}

export class FileTransferManager {
  private transfers: Map<string, FileTransferItem> = new Map();
  private activeTransfers: Set<string> = new Set();
  private abortControllers: Map<string, AbortController> = new Map();
  private options: Required<FileTransferOptions>;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(options: FileTransferOptions = {}) {
    this.options = {
      chunkSize: 1024 * 1024, // 1MB chunks
      maxConcurrentTransfers: 3,
      retryAttempts: 3,
      retryDelay: 1000,
      ...options,
    };
  }

  // Event system
  on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    this.eventListeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any) {
    this.eventListeners.get(event)?.forEach(callback => callback(data));
  }

  // Upload methods
  async uploadFiles(files: File[], remotePath: string = '~'): Promise<string[]> {
    const transferIds: string[] = [];

    for (const file of files) {
      const transferId = this.generateTransferId();
      const transfer: FileTransferItem = {
        id: transferId,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'pending',
        progress: 0,
        file,
        remotePath,
        direction: 'upload',
      };

      this.transfers.set(transferId, transfer);
      transferIds.push(transferId);
      this.emit('transferAdded', transfer);
    }

    // Start transfers respecting concurrency limit
    this.processTransferQueue();
    return transferIds;
  }

  async uploadFile(file: File, remotePath: string = '~'): Promise<string> {
    const [transferId] = await this.uploadFiles([file], remotePath);
    return transferId;
  }

  async downloadFile(remotePath: string, localName?: string): Promise<string> {
    const transferId = this.generateTransferId();
    const transfer: FileTransferItem = {
      id: transferId,
      name: localName || remotePath.split('/').pop() || 'download',
      size: 0, // Will be updated when we get file info
      type: 'application/octet-stream',
      status: 'pending',
      progress: 0,
      remotePath,
      direction: 'download',
    };

    this.transfers.set(transferId, transfer);
    this.emit('transferAdded', transfer);
    this.processTransferQueue();
    return transferId;
  }

  // Transfer control methods
  pauseTransfer(transferId: string): boolean {
    const transfer = this.transfers.get(transferId);
    if (!transfer || !['uploading', 'downloading'].includes(transfer.status)) {
      return false;
    }

    transfer.status = 'paused';
    this.activeTransfers.delete(transferId);
    this.abortControllers.get(transferId)?.abort();
    this.abortControllers.delete(transferId);
    
    this.emit('transferUpdated', transfer);
    this.processTransferQueue();
    return true;
  }

  resumeTransfer(transferId: string): boolean {
    const transfer = this.transfers.get(transferId);
    if (!transfer || transfer.status !== 'paused') {
      return false;
    }

    transfer.status = 'pending';
    this.emit('transferUpdated', transfer);
    this.processTransferQueue();
    return true;
  }

  cancelTransfer(transferId: string): boolean {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return false;

    this.activeTransfers.delete(transferId);
    this.abortControllers.get(transferId)?.abort();
    this.abortControllers.delete(transferId);
    this.transfers.delete(transferId);
    
    this.emit('transferCancelled', { transferId });
    this.processTransferQueue();
    return true;
  }

  retryTransfer(transferId: string): boolean {
    const transfer = this.transfers.get(transferId);
    if (!transfer || transfer.status !== 'error') {
      return false;
    }

    transfer.status = 'pending';
    transfer.progress = 0;
    transfer.error = undefined;
    
    this.emit('transferUpdated', transfer);
    this.processTransferQueue();
    return true;
  }

  // Queue management
  private processTransferQueue() {
    const pendingTransfers = Array.from(this.transfers.values())
      .filter(t => t.status === 'pending');

    const availableSlots = this.options.maxConcurrentTransfers - this.activeTransfers.size;

    for (let i = 0; i < Math.min(availableSlots, pendingTransfers.length); i++) {
      const transfer = pendingTransfers[i];
      this.startTransfer(transfer);
    }
  }

  private async startTransfer(transfer: FileTransferItem) {
    this.activeTransfers.add(transfer.id);
    const abortController = new AbortController();
    this.abortControllers.set(transfer.id, abortController);

    try {
      if (transfer.direction === 'upload') {
        await this.performUpload(transfer, abortController.signal);
      } else {
        await this.performDownload(transfer, abortController.signal);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        this.handleTransferError(transfer, error.message);
      }
    } finally {
      this.activeTransfers.delete(transfer.id);
      this.abortControllers.delete(transfer.id);
      this.processTransferQueue();
    }
  }

  private async performUpload(transfer: FileTransferItem, signal: AbortSignal) {
    if (!transfer.file) throw new Error('No file to upload');

    transfer.status = 'uploading';
    this.emit('transferUpdated', transfer);

    const formData = new FormData();
    formData.append('file', transfer.file);
    formData.append('remotePath', transfer.remotePath || '~');

    const startTime = Date.now();
    let lastProgressTime = startTime;
    let lastBytesTransferred = 0;

    try {
      const response = await fetch('/api/file-transfer/upload', {
        method: 'POST',
        body: formData,
        signal,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      // For chunked uploads, we'd implement progress tracking here
      // This is a simplified version
      transfer.progress = 100;
      transfer.status = 'completed';
      this.emit('transferCompleted', transfer);
      
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        throw error;
      }
    }
  }

  private async performDownload(transfer: FileTransferItem, signal: AbortSignal) {
    transfer.status = 'downloading';
    this.emit('transferUpdated', transfer);

    try {
      const response = await fetch('/api/file-transfer/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          remotePath: transfer.remotePath,
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        transfer.size = parseInt(contentLength, 10);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const chunks: Uint8Array[] = [];
      let receivedLength = 0;
      const startTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        // Update progress
        if (transfer.size > 0) {
          transfer.progress = (receivedLength / transfer.size) * 100;
          
          // Calculate speed and ETA
          const elapsed = (Date.now() - startTime) / 1000;
          transfer.speed = receivedLength / elapsed;
          
          if (transfer.speed > 0) {
            transfer.timeRemaining = (transfer.size - receivedLength) / transfer.speed;
          }
          
          this.emit('transferProgress', {
            transferId: transfer.id,
            progress: transfer.progress,
            speed: transfer.speed,
            timeRemaining: transfer.timeRemaining,
            bytesTransferred: receivedLength,
            totalBytes: transfer.size,
          });
        }
      }

      // Create blob and trigger download
      const blob = new Blob(chunks);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = transfer.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      transfer.progress = 100;
      transfer.status = 'completed';
      this.emit('transferCompleted', transfer);
      
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        throw error;
      }
    }
  }

  private handleTransferError(transfer: FileTransferItem, errorMessage: string) {
    transfer.status = 'error';
    transfer.error = errorMessage;
    this.emit('transferError', {
      transferId: transfer.id,
      error: errorMessage,
      retryable: true,
    });
  }

  private generateTransferId(): string {
    return `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Getters
  getTransfer(transferId: string): FileTransferItem | undefined {
    return this.transfers.get(transferId);
  }

  getAllTransfers(): FileTransferItem[] {
    return Array.from(this.transfers.values());
  }

  getActiveTransfers(): FileTransferItem[] {
    return Array.from(this.transfers.values())
      .filter(t => ['pending', 'uploading', 'downloading'].includes(t.status));
  }

  getCompletedTransfers(): FileTransferItem[] {
    return Array.from(this.transfers.values())
      .filter(t => t.status === 'completed');
  }

  getErrorTransfers(): FileTransferItem[] {
    return Array.from(this.transfers.values())
      .filter(t => t.status === 'error');
  }

  // Statistics
  getTransferStats() {
    const transfers = this.getAllTransfers();
    const totalSize = transfers.reduce((sum, t) => sum + t.size, 0);
    const completedSize = transfers
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.size, 0);
    
    return {
      total: transfers.length,
      completed: transfers.filter(t => t.status === 'completed').length,
      active: this.activeTransfers.size,
      errors: transfers.filter(t => t.status === 'error').length,
      totalSize,
      completedSize,
      completionRate: transfers.length > 0 ? (transfers.filter(t => t.status === 'completed').length / transfers.length) * 100 : 0,
    };
  }

  // Cleanup
  clearCompletedTransfers() {
    const completed = this.getCompletedTransfers();
    completed.forEach(transfer => {
      this.transfers.delete(transfer.id);
    });
    this.emit('transfersCleared', { count: completed.length });
  }

  clearAllTransfers() {
    // Cancel active transfers
    this.activeTransfers.forEach(transferId => {
      this.cancelTransfer(transferId);
    });
    
    this.transfers.clear();
    this.emit('allTransfersCleared', {});
  }
}

export const fileTransferManager = new FileTransferManager();
