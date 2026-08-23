import React, { useState, useEffect } from 'react';
import { Database, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DatabaseStatusProps {
  className?: string;
}

export const DatabaseStatus: React.FC<DatabaseStatusProps> = ({ className = '' }) => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    checkDatabaseConnection();
  }, []);

  const checkDatabaseConnection = async () => {
    try {
      setStatus('checking');
      
      // Check if environment variables are set
      if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder')) {
        throw new Error('Supabase configuration missing');
      }

      // Try to make a simple query
      const { error } = await supabase.from('profiles').select('count').limit(1);
      
      if (error) {
        throw error;
      }

      setStatus('connected');
      setError('');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
        return <Loader className="h-4 w-4 animate-spin text-blue-500" />;
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'checking':
        return 'Checking database connection...';
      case 'connected':
        return 'Database connected';
      case 'error':
        return `Database error: ${error}`;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'checking':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'connected':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${getStatusColor()} ${className}`}>
      <Database className="h-4 w-4" />
      {getStatusIcon()}
      <span>{getStatusText()}</span>
      {status === 'error' && (
        <button
          onClick={checkDatabaseConnection}
          className="ml-2 text-xs underline hover:no-underline"
        >
          Retry
        </button>
      )}
    </div>
  );
};