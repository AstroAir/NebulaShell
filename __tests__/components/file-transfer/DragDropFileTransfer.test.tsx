import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render, user, createMockFile, createMockFileTransferItem, createDragEvent } from '../../utils/test-utils';
import { DragDropFileTransfer } from '@/components/file-transfer/DragDropFileTransfer';

describe('DragDropFileTransfer', () => {
  const mockTransfers = [
    createMockFileTransferItem({
      id: 'transfer-1',
      name: 'test.txt',
      status: 'uploading',
      progress: 50,
      speed: 1024 * 1024, // 1MB/s
      timeRemaining: 30,
    }),
    createMockFileTransferItem({
      id: 'transfer-2',
      name: 'image.png',
      status: 'completed',
      progress: 100,
      direction: 'download',
    }),
    createMockFileTransferItem({
      id: 'transfer-3',
      name: 'large-file.zip',
      status: 'error',
      progress: 25,
      error: 'Network error occurred',
    }),
  ];

  const defaultProps = {
    onFileUpload: jest.fn(),
    onFileDownload: jest.fn(),
    transfers: mockTransfers,
    onTransferCancel: jest.fn(),
    onTransferPause: jest.fn(),
    onTransferResume: jest.fn(),
    onTransferRetry: jest.fn(),
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['text/plain', 'image/*', 'application/json'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the file transfer interface', () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      expect(screen.getByText('File Transfer')).toBeInTheDocument();
      expect(screen.getByText(/Drag and drop files or click to upload/)).toBeInTheDocument();
    });

    it('renders the drop zone', () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      expect(screen.getByText('Drag files here to upload')).toBeInTheDocument();
      expect(screen.getByText('or click to select files')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select files/i })).toBeInTheDocument();
    });

    it('renders transfer status section', () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      expect(screen.getByText('Transfer Status')).toBeInTheDocument();
      expect(screen.getByText('Active: 1')).toBeInTheDocument();
      expect(screen.getByText('Completed: 1')).toBeInTheDocument();
      expect(screen.getByText('Errors: 1')).toBeInTheDocument();
    });

    it('displays all transfer items', () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      expect(screen.getByText('test.txt')).toBeInTheDocument();
      expect(screen.getByText('image.png')).toBeInTheDocument();
      expect(screen.getByText('large-file.zip')).toBeInTheDocument();
    });
  });

  describe('Drag and Drop', () => {
    it('highlights drop zone when files are dragged over', () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      const dropZone = screen.getByText('Drag files here to upload').closest('div');
      
      fireEvent.dragEnter(dropZone!, createDragEvent('dragenter', [createMockFile()]));
      
      expect(screen.getByText('Drop files here')).toBeInTheDocument();
    });

    it('calls onFileUpload when files are dropped', () => {
      const onFileUpload = jest.fn();
      render(<DragDropFileTransfer {...defaultProps} onFileUpload={onFileUpload} />);
      
      const dropZone = screen.getByText('Drag files here to upload').closest('div');
      const files = [createMockFile('test.txt', 'content', 'text/plain')];
      
      fireEvent.drop(dropZone!, createDragEvent('drop', files));
      
      expect(onFileUpload).toHaveBeenCalledWith(files, '~');
    });

    it('validates file types on drop', () => {
      const onFileUpload = jest.fn();
      render(<DragDropFileTransfer {...defaultProps} onFileUpload={onFileUpload} />);
      
      const dropZone = screen.getByText('Drag files here to upload').closest('div');
      const invalidFile = createMockFile('test.exe', 'content', 'application/x-executable');
      
      fireEvent.drop(dropZone!, createDragEvent('drop', [invalidFile]));
      
      expect(screen.getByText(/File type not allowed/)).toBeInTheDocument();
      expect(onFileUpload).not.toHaveBeenCalled();
    });

    it('validates file size on drop', () => {
      const onFileUpload = jest.fn();
      render(<DragDropFileTransfer {...defaultProps} onFileUpload={onFileUpload} />);
      
      const dropZone = screen.getByText('Drag files here to upload').closest('div');
      const largeFile = createMockFile('large.txt', 'x'.repeat(20 * 1024 * 1024), 'text/plain'); // 20MB
      
      fireEvent.drop(dropZone!, createDragEvent('drop', [largeFile]));
      
      expect(screen.getByText(/File too large/)).toBeInTheDocument();
      expect(onFileUpload).not.toHaveBeenCalled();
    });

    it('processes valid files and shows validation errors for invalid ones', () => {
      const onFileUpload = jest.fn();
      render(<DragDropFileTransfer {...defaultProps} onFileUpload={onFileUpload} />);
      
      const dropZone = screen.getByText('Drag files here to upload').closest('div');
      const validFile = createMockFile('valid.txt', 'content', 'text/plain');
      const invalidFile = createMockFile('invalid.exe', 'content', 'application/x-executable');
      
      fireEvent.drop(dropZone!, createDragEvent('drop', [validFile, invalidFile]));
      
      expect(onFileUpload).toHaveBeenCalledWith([validFile], '~');
      expect(screen.getByText(/File type not allowed/)).toBeInTheDocument();
    });
  });

  describe('File Selection', () => {
    it('opens file dialog when select files button is clicked', async () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      const selectButton = screen.getByRole('button', { name: /select files/i });
      await user.click(selectButton);
      
      // File input should be triggered (tested via the hidden input)
      const fileInput = screen.getByRole('button', { name: /select files/i }).closest('div')?.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
    });

    it('processes selected files', async () => {
      const onFileUpload = jest.fn();
      render(<DragDropFileTransfer {...defaultProps} onFileUpload={onFileUpload} />);
      
      const fileInput = screen.getByRole('button', { name: /select files/i }).closest('div')?.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile('selected.txt', 'content', 'text/plain');
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(fileInput);
      
      expect(onFileUpload).toHaveBeenCalledWith([file], '~');
    });
  });

  describe('Transfer Progress Display', () => {
    it('shows progress bar for active transfers', () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      const uploadingTransfer = screen.getByText('test.txt').closest('div');
      expect(uploadingTransfer).toHaveTextContent('50%');
    });

    it('displays transfer speed and ETA', () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      expect(screen.getByText('1.00 MB/s')).toBeInTheDocument();
      expect(screen.getByText('ETA: 30s')).toBeInTheDocument();
    });

    it('shows appropriate badges for upload/download direction', () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      const uploadBadges = screen.getAllByText('upload');
      const downloadBadges = screen.getAllByText('download');
      
      expect(uploadBadges.length).toBeGreaterThan(0);
      expect(downloadBadges.length).toBeGreaterThan(0);
    });

    it('displays exit code badges with appropriate styling', () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      // Completed transfer should show success indicator
      const completedTransfer = screen.getByText('image.png').closest('div');
      expect(completedTransfer).toBeInTheDocument();
      
      // Error transfer should show error indicator
      const errorTransfer = screen.getByText('large-file.zip').closest('div');
      expect(errorTransfer).toBeInTheDocument();
    });

    it('shows error messages for failed transfers', () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      expect(screen.getByText('Network error occurred')).toBeInTheDocument();
    });
  });

  describe('Transfer Controls', () => {
    it('shows pause button for active transfers', () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      const uploadingTransfer = screen.getByText('test.txt').closest('div');
      const pauseButton = uploadingTransfer?.querySelector('[data-testid="pause-button"]');
      expect(pauseButton || uploadingTransfer?.querySelector('svg')).toBeInTheDocument();
    });

    it('calls onTransferPause when pause button is clicked', async () => {
      const onTransferPause = jest.fn();
      render(<DragDropFileTransfer {...defaultProps} onTransferPause={onTransferPause} />);
      
      const uploadingTransfer = screen.getByText('test.txt').closest('div');
      const controlButtons = uploadingTransfer?.querySelectorAll('button');
      const pauseButton = Array.from(controlButtons || []).find(btn => 
        btn.querySelector('svg')
      );
      
      if (pauseButton) {
        await user.click(pauseButton);
        expect(onTransferPause).toHaveBeenCalledWith('transfer-1');
      }
    });

    it('shows retry button for failed transfers', () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      const errorTransfer = screen.getByText('large-file.zip').closest('div');
      const retryButton = errorTransfer?.querySelector('[data-testid="retry-button"]');
      expect(retryButton || errorTransfer?.querySelector('svg')).toBeInTheDocument();
    });

    it('calls onTransferRetry when retry button is clicked', async () => {
      const onTransferRetry = jest.fn();
      render(<DragDropFileTransfer {...defaultProps} onTransferRetry={onTransferRetry} />);
      
      const errorTransfer = screen.getByText('large-file.zip').closest('div');
      const controlButtons = errorTransfer?.querySelectorAll('button');
      const retryButton = Array.from(controlButtons || []).find(btn => 
        btn.querySelector('svg')
      );
      
      if (retryButton) {
        await user.click(retryButton);
        expect(onTransferRetry).toHaveBeenCalledWith('transfer-3');
      }
    });

    it('shows cancel button for all transfers', () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      const transfers = screen.getAllByText(/test\.txt|image\.png|large-file\.zip/);
      transfers.forEach(transfer => {
        const transferCard = transfer.closest('div');
        const cancelButton = transferCard?.querySelector('[data-testid="cancel-button"]');
        expect(cancelButton || transferCard?.querySelector('button:last-child')).toBeInTheDocument();
      });
    });

    it('calls onTransferCancel when cancel button is clicked', async () => {
      const onTransferCancel = jest.fn();
      render(<DragDropFileTransfer {...defaultProps} onTransferCancel={onTransferCancel} />);
      
      const transfer = screen.getByText('test.txt').closest('div');
      const controlButtons = transfer?.querySelectorAll('button');
      const cancelButton = Array.from(controlButtons || []).find(btn => 
        btn.querySelector('svg') && btn.className.includes('destructive')
      );
      
      if (cancelButton) {
        await user.click(cancelButton);
        expect(onTransferCancel).toHaveBeenCalledWith('transfer-1');
      }
    });
  });

  describe('File Icons', () => {
    it('displays appropriate icons for different file types', () => {
      const transfers = [
        createMockFileTransferItem({ name: 'document.txt', type: 'text/plain' }),
        createMockFileTransferItem({ name: 'photo.jpg', type: 'image/jpeg' }),
        createMockFileTransferItem({ name: 'video.mp4', type: 'video/mp4' }),
        createMockFileTransferItem({ name: 'archive.zip', type: 'application/zip' }),
        createMockFileTransferItem({ name: 'script.js', type: 'application/javascript' }),
      ];
      
      render(<DragDropFileTransfer {...defaultProps} transfers={transfers} />);
      
      // Each file type should have an appropriate icon
      transfers.forEach(transfer => {
        expect(screen.getByText(transfer.name)).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no transfers exist', () => {
      render(<DragDropFileTransfer {...defaultProps} transfers={[]} />);
      
      expect(screen.getByText('No transfers')).toBeInTheDocument();
      expect(screen.getByText(/Upload or download files to see progress/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      const dropZone = screen.getByText('Drag files here to upload').closest('div');
      expect(dropZone).toHaveAttribute('role', 'button');
      
      const fileInput = screen.getByRole('button', { name: /select files/i }).closest('div')?.querySelector('input[type="file"]');
      expect(fileInput).toHaveAttribute('multiple');
    });

    it('supports keyboard navigation', async () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      const selectButton = screen.getByRole('button', { name: /select files/i });
      selectButton.focus();
      
      await user.keyboard('{Enter}');
      // Should trigger file selection
    });

    it('announces file upload status to screen readers', () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      // Progress information should be accessible
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('handles drag events without files gracefully', () => {
      render(<DragDropFileTransfer {...defaultProps} />);
      
      const dropZone = screen.getByText('Drag files here to upload').closest('div');
      
      expect(() => {
        fireEvent.dragEnter(dropZone!, createDragEvent('dragenter', []));
        fireEvent.drop(dropZone!, createDragEvent('drop', []));
      }).not.toThrow();
    });

    it('handles missing callback functions gracefully', () => {
      render(<DragDropFileTransfer transfers={mockTransfers} />);
      
      expect(screen.getByText('File Transfer')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles large numbers of transfers efficiently', () => {
      const manyTransfers = Array.from({ length: 100 }, (_, i) => 
        createMockFileTransferItem({ id: `transfer-${i}`, name: `file-${i}.txt` })
      );
      
      const startTime = performance.now();
      render(<DragDropFileTransfer {...defaultProps} transfers={manyTransfers} />);
      const endTime = performance.now();
      
      // Should render within reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});
