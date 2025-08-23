import { SSHConnectionConfig } from './ssh';

export interface ConnectionProfile {
  id: string;
  name: string;
  description?: string;
  config: Omit<SSHConnectionConfig, 'id'>;
  tags: string[];
  favorite: boolean;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
  useCount: number;
  color?: string;
  icon?: string;
}

export interface ProfileGroup {
  id: string;
  name: string;
  description?: string;
  color?: string;
  profiles: string[]; // Profile IDs
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectionHistory {
  id: string;
  profileId?: string;
  config: SSHConnectionConfig;
  connectedAt: Date;
  disconnectedAt?: Date;
  duration?: number; // in seconds
  success: boolean;
  error?: string;
}

export interface QuickConnectEntry {
  hostname: string;
  username: string;
  port: number;
  lastUsed: Date;
  useCount: number;
}

export interface ProfileImportExport {
  version: string;
  exportedAt: Date;
  profiles: ConnectionProfile[];
  groups: ProfileGroup[];
}

export interface ProfileSearchFilter {
  query?: string;
  tags?: string[];
  favorite?: boolean;
  groupId?: string;
  sortBy?: 'name' | 'lastUsed' | 'useCount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
