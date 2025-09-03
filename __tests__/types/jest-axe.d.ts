declare module 'jest-axe' {
  import { AxeResults } from 'axe-core';

  export function axe(element: Element | Document, options?: any): Promise<AxeResults>;
  
  export const toHaveNoViolations: {
    toHaveNoViolations(received: AxeResults): {
      message(): string;
      pass: boolean;
    };
  };

  export function configureAxe(options?: any): (element: Element | Document, options?: any) => Promise<AxeResults>;
}

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveNoViolations(): R;
    }
  }
}
