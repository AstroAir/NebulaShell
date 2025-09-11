'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check, X, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

interface InputEnhancedProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  hint?: string;
  loading?: boolean;
  icon?: React.ReactNode;
  onClear?: () => void;
}

export const InputEnhanced = React.forwardRef<HTMLInputElement, InputEnhancedProps>(
  ({ className, type, label, error, success, hint, loading, icon, onClear, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const [isFocused, setIsFocused] = React.useState(false);
    const hasValue = props.value !== undefined && props.value !== '';

    return (
      <div className="relative w-full">
        {label && (
          <label
            className={cn(
              'absolute left-3 transition-all duration-200 pointer-events-none z-10',
              isFocused || hasValue
                ? 'top-0 -translate-y-1/2 text-xs bg-background px-1'
                : 'top-1/2 -translate-y-1/2 text-sm',
              error ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {label}
          </label>
        )}
        
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {icon}
            </div>
          )}
          
          <input
            type={type === 'password' && showPassword ? 'text' : type}
            className={cn(
              'flex h-11 w-full rounded-lg border bg-transparent px-3 py-2 text-sm transition-all duration-200',
              'file:border-0 file:bg-transparent file:text-sm file:font-medium',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              icon && 'pl-10',
              (type === 'password' || onClear || loading) && 'pr-10',
              error && 'border-destructive focus-visible:ring-destructive',
              success && 'border-green-500 focus-visible:ring-green-500',
              !error && !success && 'border-input hover:border-accent',
              className
            )}
            ref={ref}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
          />
          
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {loading && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
            
            {type === 'password' && !loading && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            )}
            
            {onClear && hasValue && !loading && type !== 'password' && (
              <button
                type="button"
                onClick={onClear}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            
            {success && !loading && (
              <Check className="w-4 h-4 text-green-500" />
            )}
            
            {error && !loading && (
              <AlertCircle className="w-4 h-4 text-destructive" />
            )}
          </div>
        </div>
        
        {(error || hint) && (
          <p className={cn(
            'mt-1.5 text-xs',
            error ? 'text-destructive' : 'text-muted-foreground'
          )}>
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);

InputEnhanced.displayName = 'InputEnhanced';

// Animated Input with floating label
interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ className, label, error, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const hasValue = props.value !== undefined && props.value !== '';

    return (
      <div className="relative">
        <input
          className={cn(
            'peer flex h-12 w-full rounded-lg border bg-transparent px-3 pt-4 pb-1 text-sm transition-all duration-200',
            'placeholder-transparent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive focus-visible:ring-destructive',
            !error && 'border-input hover:border-accent',
            className
          )}
          placeholder={label}
          ref={ref}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        <label
          className={cn(
            'absolute left-3 transition-all duration-200 pointer-events-none',
            'peer-placeholder-shown:text-base peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2',
            'peer-focus:text-xs peer-focus:top-2 peer-focus:translate-y-0',
            (isFocused || hasValue) && 'text-xs top-2 translate-y-0',
            !isFocused && !hasValue && 'text-base top-1/2 -translate-y-1/2',
            error ? 'text-destructive' : 'text-muted-foreground peer-focus:text-primary'
          )}
        >
          {label}
        </label>
        {error && (
          <p className="mt-1.5 text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

FloatingInput.displayName = 'FloatingInput';

// Search Input with suggestions
interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  suggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
  loading?: boolean;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, suggestions = [], onSuggestionSelect, loading, ...props }, ref) => {
    const [showSuggestions, setShowSuggestions] = React.useState(false);
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
      } else if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault();
        onSuggestionSelect?.(suggestions[highlightedIndex]);
        setShowSuggestions(false);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    };

    return (
      <div className="relative w-full">
        <InputEnhanced
          ref={ref}
          className={className}
          loading={loading}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={handleKeyDown}
          {...props}
        />
        
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-auto rounded-lg border bg-popover shadow-lg z-50">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                className={cn(
                  'w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors',
                  index === highlightedIndex && 'bg-accent text-accent-foreground'
                )}
                onMouseDown={() => {
                  onSuggestionSelect?.(suggestion);
                  setShowSuggestions(false);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
