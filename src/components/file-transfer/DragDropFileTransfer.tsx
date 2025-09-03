'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  Download, 
  File, 
  Folder, 
  X, 
  CheckCircle, 
  AlertCircle,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  FileText,
  Image,
  Archive,
  Code,
  Music,
  Video
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccessibility } from '@/components/accessibility/AccessibilityProvider';

export interface FileTransferItem {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'downloading' | 'completed' | 'error' | 'paused';
  progress: number;
  speed?: number;
  timeRemaining?: number;
  error?: string;
  file?: File;
  remotePath?: string;
  direction: 'upload' | 'download';
}

interface DragDropFileTransferProps {
  onFileUpload?: (files: File[], remotePath?: string) => void;
  onFileDownload?: (remotePath: string, localPath?: string) => void;
  transfers?: FileTransferItem[];
  onTransferCancel?: (transferId: string) => void;
  onTransferPause?: (transferId: string) => void;
  onTransferResume?: (transferId: string) => void;
  onTransferRetry?: (transferId: string) => void;
  className?: string;
  maxFileSize?: number; // in bytes
  allowedTypes?: string[];
  remotePath?: string;
}

export function DragDropFileTransfer({
  onFileUpload,
  onFileDownload,
  transfers = [],
  onTransferCancel,
  onTransferPause,
  onTransferResume,
  onTransferRetry,
  className,
  maxFileSize = 100 * 1024 * 1024, // 100MB default
  allowedTypes,
  remotePath = '~',
}: DragDropFileTransferProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const { announce } = useAccessibility();

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const newCount = prev - 1;
      if (newCount <= 0) {
        setIsDragOver(false);
      }
      return newCount;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const validateFiles = (files: File[]): { valid: File[]; errors: string[] } => {
    const valid: File[] = [];
    const newErrors: string[] = [];

    files.forEach(file => {
      // Check file size
      if (file.size > maxFileSize) {
        newErrors.push(`${file.name}: File too large (max ${formatFileSize(maxFileSize)})`);
        return;
      }

      // Check file type
      if (allowedTypes && allowedTypes.length > 0) {
        const isAllowed = allowedTypes.some(type => {
          if (type.startsWith('.')) {
            return file.name.toLowerCase().endsWith(type.toLowerCase());
          }
          // Handle wildcard types like 'image/*'
          if (type.endsWith('/*')) {
            const baseType = type.slice(0, -2);
            return file.type && file.type.startsWith(baseType);
          }
          // Handle exact type matches, with fallback for empty file.type
          return file.type && file.type === type;
        });

        if (!isAllowed) {
          newErrors.push(`${file.name}: File type not allowed`);
          return;
        }
      }

      valid.push(file);
    });

    return { valid, errors: newErrors };
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragCounter(0);

    if (!e.dataTransfer?.files) {
      announce('No files detected in drop event', 'assertive');
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const { valid, errors: validationErrors } = validateFiles(files);
    
    setErrors(validationErrors);
    
    if (valid.length > 0) {
      onFileUpload?.(valid, remotePath);
      announce(`${valid.length} files queued for upload`);
    }

    if (validationErrors.length > 0) {
      announce(`${validationErrors.length} files rejected due to validation errors`, 'assertive');
    }
  }, [onFileUpload, remotePath, maxFileSize, allowedTypes, announce]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const { valid, errors: validationErrors } = validateFiles(files);
    
    setErrors(validationErrors);
    
    if (valid.length > 0) {
      onFileUpload?.(valid, remotePath);
      announce(`${valid.length} files selected for upload`);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatFileSize(bytesPerSecond)}/s`;
  };

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const getFileIcon = (fileName: string, fileType: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (fileType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (fileType.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (fileType.startsWith('audio/')) return <Music className="h-4 w-4" />;
    
    switch (extension) {
      case 'zip':
      case 'rar':
      case 'tar':
      case 'gz':
        return <Archive className="h-4 w-4" />;
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
      case 'py':
      case 'java':
      case 'cpp':
      case 'c':
        return <Code className="h-4 w-4" />;
      case 'txt':
      case 'md':
      case 'json':
      case 'xml':
        return <FileText className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: FileTransferItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const activeTransfers = transfers.filter(t => 
    ['pending', 'uploading', 'downloading'].includes(t.status)
  );
  const completedTransfers = transfers.filter(t => t.status === 'completed');
  const errorTransfers = transfers.filter(t => t.status === 'error');

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          File Transfer
        </CardTitle>
        <CardDescription>
          Drag and drop files or click to upload. Download files from the remote server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop Zone */}
        <div
          ref={dropZoneRef}
          aria-describedby="drop-zone-description"
          aria-label="Drag files here to upload or click to select files"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
            isDragOver
              ? 'border-primary bg-primary/10'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          )}
        >
          <div className="flex flex-col items-center gap-4">
            <Upload className={cn(
              'h-12 w-12',
              isDragOver ? 'text-primary' : 'text-muted-foreground'
            )} />
            <div>
              <p className="text-lg font-medium">
                {isDragOver ? 'Drop files here' : 'Drag files here to upload'}
              </p>
              <p className="text-sm text-muted-foreground">
                or click to select files
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2"
            >
              Select Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept={allowedTypes?.join(',')}
              aria-label="Select files for upload"
            />
            <div id="drop-zone-description" className="sr-only">
              Drag and drop files here to upload them, or click to open file selection dialog.
              Maximum file size: {Math.round(maxFileSize / (1024 * 1024))}MB.
              {allowedTypes && ` Allowed types: ${allowedTypes.join(', ')}`}
            </div>
          </div>
        </div>

        {/* Validation Errors */}
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                {errors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Transfer Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Transfer Status</h4>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Active: {activeTransfers.length}</span>
              <span>Completed: {completedTransfers.length}</span>
              {errorTransfers.length > 0 && (
                <span className="text-red-500">Errors: {errorTransfers.length}</span>
              )}
            </div>
          </div>

          <ScrollArea className="h-64">
            <div className="space-y-2">
              {transfers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No transfers</p>
                  <p className="text-sm">Upload or download files to see progress here</p>
                </div>
              ) : (
                transfers.map((transfer) => (
                  <Card key={transfer.id} className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {getFileIcon(transfer.name, transfer.type)}
                          <span className="font-medium truncate">{transfer.name}</span>
                          <Badge 
                            variant={transfer.direction === 'upload' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {transfer.direction === 'upload' ? (
                              <Upload className="h-3 w-3 mr-1" />
                            ) : (
                              <Download className="h-3 w-3 mr-1" />
                            )}
                            {transfer.direction}
                          </Badge>
                          {getStatusIcon(transfer.status)}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {transfer.status === 'uploading' || transfer.status === 'downloading' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onTransferPause?.(transfer.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          ) : transfer.status === 'paused' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onTransferResume?.(transfer.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          ) : transfer.status === 'error' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onTransferRetry?.(transfer.id)}
                              className="h-8 w-8 p-0"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          ) : null}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onTransferCancel?.(transfer.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {transfer.status !== 'completed' && transfer.status !== 'error' && (
                        <div className="space-y-1">
                          <Progress value={transfer.progress} className="h-2" />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{Math.round(transfer.progress)}%</span>
                            <div className="flex items-center gap-2">
                              <span>{formatFileSize(transfer.size)}</span>
                              {transfer.speed && (
                                <span>{formatSpeed(transfer.speed)}</span>
                              )}
                              {transfer.timeRemaining && (
                                <span>ETA: {formatTimeRemaining(transfer.timeRemaining)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {transfer.status === 'error' && transfer.error && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            {transfer.error}
                          </AlertDescription>
                        </Alert>
                      )}

                      {transfer.remotePath && (
                        <div className="text-xs text-muted-foreground">
                          Remote: {transfer.remotePath}
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>

      {/* Status region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {transfers.length > 0 && `${activeTransfers.length} active transfers, ${completedTransfers.length} completed`}
      </div>
    </Card>
  );
}
