'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Badge import removed as not currently used
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Folder, 
  File, 
  Upload, 
  Download, 
  RefreshCw, 
  // Plus, Edit, MoreHorizontal - removed as not currently used
  Trash2,
  ArrowUp,
  FolderPlus
} from 'lucide-react';
import { FileItem, DirectoryListing, FileTransferProgress } from '@/types/file-transfer';
import { useTerminal } from '@/components/terminal/TerminalContext';
import { formatBytes, formatDate } from '@/lib/utils';

interface FileBrowserProps {
  className?: string;
}

export function FileBrowser({ className }: FileBrowserProps) {
  const { sessionId } = useTerminal();
  const [currentPath, setCurrentPath] = useState('/');
  const [directoryListing, setDirectoryListing] = useState<DirectoryListing | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useState<FileTransferProgress[]>([]); // transfers state removed as not currently used
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);

  const loadDirectory = useCallback(async (path: string) => {
    if (!sessionId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/sftp/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, path }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setDirectoryListing(data.listing);
        setCurrentPath(path);
      } else {
        setError(data.error || 'Failed to load directory');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      loadDirectory(currentPath);
    }
  }, [sessionId, loadDirectory, currentPath]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!sessionId) return;

    for (const file of acceptedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);
      formData.append('remotePath', currentPath);

      try {
        const response = await fetch('/api/sftp/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        
        if (data.success) {
          // Refresh directory listing
          loadDirectory(currentPath);
        } else {
          setError(data.error || 'Upload failed');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    }
  }, [sessionId, currentPath, loadDirectory]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
  });

  const handleFileClick = (file: FileItem) => {
    if (file.type === 'directory') {
      loadDirectory(file.path);
    } else {
      // Toggle selection for files
      setSelectedFiles(prev => 
        prev.includes(file.path) 
          ? prev.filter(p => p !== file.path)
          : [...prev, file.path]
      );
    }
  };

  const handleDownload = async (filePath: string) => {
    if (!sessionId) return;

    try {
      const response = await fetch('/api/sftp/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, remotePath: filePath }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const fileName = filePath.split('/').pop() || 'download';
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const data = await response.json();
        setError(data.error || 'Download failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleCreateFolder = async () => {
    if (!sessionId || !newFolderName.trim()) return;

    try {
      const response = await fetch('/api/sftp/operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          operation: {
            type: 'create_directory',
            source: `${currentPath}/${newFolderName}`.replace(/\/+/g, '/'),
          },
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setNewFolderName('');
        setShowNewFolder(false);
        loadDirectory(currentPath);
      } else {
        setError(data.error || 'Failed to create folder');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const handleDelete = async (filePath: string) => {
    if (!sessionId) return;

    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const response = await fetch('/api/sftp/operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          operation: {
            type: 'delete',
            source: filePath,
          },
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        loadDirectory(currentPath);
        setSelectedFiles(prev => prev.filter(p => p !== filePath));
      } else {
        setError(data.error || 'Failed to delete item');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  const navigateUp = () => {
    if (directoryListing?.parent) {
      loadDirectory(directoryListing.parent);
    }
  };

  if (!sessionId) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>File Browser</CardTitle>
          <CardDescription>Connect to a server to browse files</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Folder className="h-5 w-5" />
          File Browser
        </CardTitle>
        <CardDescription>
          Browse and manage files on the remote server
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Navigation Bar */}
        <div className="flex items-center gap-2 mb-4 p-2 bg-muted rounded-lg">
          <Button
            variant="outline"
            size="sm"
            onClick={navigateUp}
            disabled={!directoryListing?.parent}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          
          <div className="flex-1 text-sm font-mono bg-background px-2 py-1 rounded border">
            {currentPath}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDirectory(currentPath)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewFolder(true)}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>

        {/* New Folder Input */}
        {showNewFolder && (
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
            <Button variant="outline" onClick={() => setShowNewFolder(false)}>
              Cancel
            </Button>
          </div>
        )}

        {/* File Drop Zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-4 mb-4 transition-colors ${
            isDragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/25'
          }`}
        >
          <input {...getInputProps()} />
          <div className="text-center">
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {isDragActive
                ? 'Drop files here to upload'
                : 'Drag and drop files here, or click to select files'}
            </p>
          </div>
        </div>

        {/* File List */}
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
              Loading...
            </div>
          ) : directoryListing?.items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Empty directory
            </div>
          ) : (
            directoryListing?.items.map((file) => (
              <div
                key={file.path}
                className={`flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer ${
                  selectedFiles.includes(file.path) ? 'bg-primary/10' : ''
                }`}
                onClick={() => handleFileClick(file)}
              >
                {file.type === 'directory' ? (
                  <Folder className="h-4 w-4 text-blue-500" />
                ) : (
                  <File className="h-4 w-4 text-gray-500" />
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {file.type === 'file' && formatBytes(file.size)} • {formatDate(file.modifiedTime)}
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {file.type === 'file' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(file.path);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(file.path);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
