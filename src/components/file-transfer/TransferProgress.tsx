'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { X, Upload, Download, CheckCircle, XCircle, Clock } from 'lucide-react';
import { FileTransferProgress } from '@/types/file-transfer';
import { formatBytes, formatDuration } from '@/lib/utils';

interface TransferProgressProps {
  transfers: FileTransferProgress[];
  onCancelTransfer?: (transferId: string) => void;
  className?: string;
}

export function TransferProgress({ transfers, onCancelTransfer, className }: TransferProgressProps) {
  if (transfers.length === 0) {
    return null;
  }

  const getStatusIcon = (status: FileTransferProgress['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'transferring':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: FileTransferProgress['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'cancelled':
        return 'bg-gray-500';
      case 'transferring':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          File Transfers
        </CardTitle>
        <CardDescription>
          {transfers.filter(t => t.status === 'transferring').length} active transfers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-64 overflow-y-auto">
          {transfers.map((transfer) => (
            <div key={transfer.transferId} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {transfer.direction === 'upload' ? (
                    <Upload className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Download className="h-4 w-4 text-green-500" />
                  )}
                  <span className="font-medium truncate max-w-48">
                    {transfer.fileName}
                  </span>
                  {getStatusIcon(transfer.status)}
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {transfer.direction}
                  </Badge>
                  
                  {transfer.status === 'transferring' && onCancelTransfer && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCancelTransfer(transfer.transferId)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-2">
                <Progress 
                  value={transfer.percentage} 
                  className="h-2"
                />
              </div>

              {/* Transfer Details */}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {formatBytes(transfer.transferred)} / {formatBytes(transfer.total)}
                </span>
                
                <div className="flex items-center gap-2">
                  {transfer.status === 'transferring' && transfer.speed > 0 && (
                    <>
                      <span>{formatBytes(transfer.speed)}/s</span>
                      {transfer.estimatedTimeRemaining && (
                        <span>• {formatDuration(transfer.estimatedTimeRemaining)} left</span>
                      )}
                    </>
                  )}
                  
                  {transfer.status === 'completed' && (
                    <span className="text-green-600">Completed</span>
                  )}
                  
                  {transfer.status === 'error' && (
                    <span className="text-red-600" title={transfer.error}>
                      Error: {transfer.error?.substring(0, 30)}...
                    </span>
                  )}
                  
                  {transfer.status === 'cancelled' && (
                    <span className="text-gray-600">Cancelled</span>
                  )}
                </div>
              </div>

              {/* Status Bar */}
              <div className="mt-2">
                <div className={`h-1 rounded-full ${getStatusColor(transfer.status)}`} 
                     style={{ width: `${transfer.percentage}%` }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
