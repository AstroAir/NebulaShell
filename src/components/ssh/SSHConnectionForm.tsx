'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTerminal } from '@/components/terminal/TerminalContext';
import { SSHConnectionConfig } from '@/types/ssh';



interface SSHFormData {
  hostname: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  name?: string;
}

interface SSHConnectionFormProps {
  className?: string;
}

export function SSHConnectionForm({ className }: SSHConnectionFormProps) {
  const { connect, disconnect, connectionStatus } = useTerminal();
  const [authMethod, setAuthMethod] = useState<'password' | 'key'>('password');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SSHFormData>({
    defaultValues: {
      hostname: '',
      port: 22,
      username: '',
      password: '',
      privateKey: '',
      passphrase: '',
      name: '',
    },
  });

  const onSubmit = (data: SSHFormData) => {
    try {
      setError(null);
      setIsSubmitting(true);

      // Basic validation
      if (!data.hostname || !data.username) {
        setError('Hostname and username are required');
        setIsSubmitting(false);
        return;
      }

      if (authMethod === 'password' && !data.password) {
        setError('Password is required for password authentication');
        setIsSubmitting(false);
        return;
      }

      if (authMethod === 'key' && !data.privateKey) {
        setError('Private key is required for key authentication');
        setIsSubmitting(false);
        return;
      }

      const config: SSHConnectionConfig = {
        id: uuidv4(),
        hostname: data.hostname,
        port: data.port || 22,
        username: data.username,
        password: authMethod === 'password' ? data.password : undefined,
        privateKey: authMethod === 'key' ? data.privateKey : undefined,
        passphrase: data.passphrase,
        name: data.name || `${data.username}@${data.hostname}`,
      };

      connect(config);
      // Don't set isSubmitting to false here - let the connection status handle it
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setError(null);
    setIsSubmitting(false);
  };

  // Sync form state with connection status
  useEffect(() => {
    if (connectionStatus.status === 'error' && connectionStatus.message) {
      setError(connectionStatus.message);
      setIsSubmitting(false);
    } else if (connectionStatus.status === 'connected') {
      setError(null);
      setIsSubmitting(false);
    } else if (connectionStatus.status === 'connecting') {
      setError(null);
    } else if (connectionStatus.status === 'disconnected') {
      setIsSubmitting(false);
    }
  }, [connectionStatus.status, connectionStatus.message]);

  // Clear error when user starts typing (for better UX)
  const handleInputChange = () => {
    if (error && connectionStatus.status !== 'error') {
      setError(null);
    }
  };

  const isConnected = connectionStatus.status === 'connected';
  const isConnecting = connectionStatus.status === 'connecting' || isSubmitting;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>SSH Connection</CardTitle>
        <CardDescription>
          Connect to a remote server via SSH
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {connectionStatus.status === 'error' && connectionStatus.message && (
          <Alert variant="destructive">
            <AlertDescription>{connectionStatus.message}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="hostname">Hostname</Label>
              <Input
                id="hostname"
                placeholder="example.com"
                disabled={isConnected || isConnecting}
                {...form.register('hostname')}
                onChange={(e) => {
                  form.setValue('hostname', e.target.value);
                  handleInputChange();
                }}
              />
              {form.formState.errors.hostname && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.hostname.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                placeholder="22"
                disabled={isConnected || isConnecting}
                {...form.register('port', { valueAsNumber: true })}
              />
              {form.formState.errors.port && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.port.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="root"
              disabled={isConnected || isConnecting}
              {...form.register('username')}
              onChange={(e) => {
                form.setValue('username', e.target.value);
                handleInputChange();
              }}
            />
            {form.formState.errors.username && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.username.message}
              </p>
            )}
          </div>

          <Tabs value={authMethod} onValueChange={(value) => setAuthMethod(value as 'password' | 'key')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password" disabled={isConnected || isConnecting}>
                Password
              </TabsTrigger>
              <TabsTrigger value="key" disabled={isConnected || isConnecting}>
                Private Key
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="password" className="space-y-4">
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  disabled={isConnected || isConnecting}
                  {...form.register('password')}
                  onChange={(e) => {
                    form.setValue('password', e.target.value);
                    handleInputChange();
                  }}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="key" className="space-y-4">
              <div>
                <Label htmlFor="privateKey">Private Key</Label>
                <textarea
                  id="privateKey"
                  className="w-full min-h-[100px] p-2 border rounded-md resize-vertical"
                  placeholder="-----BEGIN PRIVATE KEY-----"
                  disabled={isConnected || isConnecting}
                  {...form.register('privateKey')}
                />
              </div>
              <div>
                <Label htmlFor="passphrase">Passphrase (optional)</Label>
                <Input
                  id="passphrase"
                  type="password"
                  placeholder="Enter passphrase if required"
                  disabled={isConnected || isConnecting}
                  {...form.register('passphrase')}
                />
              </div>
            </TabsContent>
          </Tabs>

          {form.formState.errors.password && (
            <p className="text-sm text-red-500">
              {form.formState.errors.password.message}
            </p>
          )}

          <div>
            <Label htmlFor="name">Connection Name (optional)</Label>
            <Input
              id="name"
              placeholder="My Server"
              disabled={isConnected || isConnecting}
              {...form.register('name')}
            />
          </div>

          <div className="flex gap-2">
            {!isConnected ? (
              <Button 
                type="submit" 
                disabled={isConnecting}
                className="flex-1"
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </Button>
            ) : (
              <Button 
                type="button" 
                variant="destructive"
                onClick={handleDisconnect}
                className="flex-1"
              >
                Disconnect
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
