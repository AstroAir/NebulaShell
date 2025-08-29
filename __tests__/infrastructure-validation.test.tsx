import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Simple test component to validate infrastructure
const TestComponent = ({ onButtonClick }: { onButtonClick?: () => void }) => {
  const [count, setCount] = React.useState(0);
  
  return (
    <div>
      <h1>Test Infrastructure</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
      <button onClick={onButtonClick}>External Action</button>
      <input placeholder="Type here" />
    </div>
  );
};

describe('Test Infrastructure Validation', () => {
  it('renders components correctly', () => {
    render(<TestComponent />);
    
    expect(screen.getByText('Test Infrastructure')).toBeInTheDocument();
    expect(screen.getByText('Count: 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Increment' })).toBeInTheDocument();
  });

  it('handles state updates', () => {
    render(<TestComponent />);
    
    const button = screen.getByRole('button', { name: 'Increment' });
    fireEvent.click(button);
    
    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });

  it('handles user interactions with userEvent', async () => {
    const user = userEvent.setup();
    render(<TestComponent />);
    
    const button = screen.getByRole('button', { name: 'Increment' });
    await user.click(button);
    await user.click(button);
    
    expect(screen.getByText('Count: 2')).toBeInTheDocument();
  });

  it('handles input interactions', async () => {
    const user = userEvent.setup();
    render(<TestComponent />);
    
    const input = screen.getByPlaceholderText('Type here');
    await user.type(input, 'Hello World');
    
    expect(input).toHaveValue('Hello World');
  });

  it('handles mock functions', () => {
    const mockFn = jest.fn();
    render(<TestComponent onButtonClick={mockFn} />);
    
    const button = screen.getByRole('button', { name: 'External Action' });
    fireEvent.click(button);
    
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('handles async operations', async () => {
    const user = userEvent.setup();
    const mockFn = jest.fn();
    
    render(<TestComponent onButtonClick={mockFn} />);
    
    const button = screen.getByRole('button', { name: 'External Action' });
    await user.click(button);
    
    expect(mockFn).toHaveBeenCalled();
  });

  it('validates TypeScript integration', () => {
    // TypeScript compilation validates types
    const props: { onButtonClick?: () => void } = {
      onButtonClick: jest.fn()
    };
    
    render(<TestComponent {...props} />);
    expect(screen.getByText('Test Infrastructure')).toBeInTheDocument();
  });

  it('validates Jest matchers', () => {
    const array = [1, 2, 3];
    const object = { name: 'test', value: 42 };
    
    expect(array).toHaveLength(3);
    expect(array).toContain(2);
    expect(object).toHaveProperty('name', 'test');
    expect(object.value).toBeGreaterThan(40);
  });

  it('validates async/await patterns', async () => {
    const promise = Promise.resolve('success');
    const result = await promise;
    
    expect(result).toBe('success');
  });

  it('validates error handling', () => {
    const throwError = () => {
      throw new Error('Test error');
    };
    
    expect(throwError).toThrow('Test error');
  });
});

describe('React Testing Library Features', () => {
  it('validates query methods', () => {
    render(<TestComponent />);
    
    // getBy - throws if not found
    expect(screen.getByText('Test Infrastructure')).toBeInTheDocument();
    
    // queryBy - returns null if not found
    expect(screen.queryByText('Non-existent')).toBeNull();
    
    // findBy - async, waits for element
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('validates accessibility queries', () => {
    render(<TestComponent />);
    
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Increment' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument();
  });

  it('validates custom matchers', () => {
    render(<TestComponent />);
    
    const heading = screen.getByRole('heading');
    expect(heading).toBeInTheDocument();
    expect(heading).toBeVisible();
    expect(heading).toHaveTextContent('Test Infrastructure');
  });
});
