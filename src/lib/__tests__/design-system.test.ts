import {
  cn,
  spacing,
  spacingX,
  gap,
  padding,
  margin,
  typography,
  fontWeight,
  colors,
  textColors,
  borderColors,
  buttonVariants,
  cardVariants,
  loadingStates,
  focusStates,
  hoverStates,
  responsive,
  layout,
  animations
} from '../design-system';

describe('Design System', () => {
  describe('cn (className utility)', () => {
    it('should merge class names correctly', () => {
      expect(cn('px-2 py-1', 'text-sm')).toBe('px-2 py-1 text-sm');
    });

    it('should handle conditional classes', () => {
      expect(cn('base-class', true && 'conditional-class')).toBe('base-class conditional-class');
      expect(cn('base-class', false && 'conditional-class')).toBe('base-class');
    });

    it('should handle Tailwind conflicts with twMerge', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4');
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    });

    it('should handle empty inputs', () => {
      expect(cn()).toBe('');
      expect(cn('')).toBe('');
      expect(cn(null, undefined)).toBe('');
    });

    it('should handle arrays and objects', () => {
      expect(cn(['px-2', 'py-1'])).toBe('px-2 py-1');
      expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500');
    });

    it('should handle complex combinations', () => {
      const result = cn(
        'base-class',
        ['array-class-1', 'array-class-2'],
        { 'conditional-true': true, 'conditional-false': false },
        'final-class'
      );
      expect(result).toBe('base-class array-class-1 array-class-2 conditional-true final-class');
    });
  });

  describe('Spacing Tokens', () => {
    it('should provide correct spacing values', () => {
      expect(spacing.xs).toBe('space-y-1');
      expect(spacing.sm).toBe('space-y-2');
      expect(spacing.md).toBe('space-y-4');
      expect(spacing.lg).toBe('space-y-6');
      expect(spacing.xl).toBe('space-y-8');
      expect(spacing['2xl']).toBe('space-y-12');
      expect(spacing['3xl']).toBe('space-y-16');
    });

    it('should provide correct horizontal spacing values', () => {
      expect(spacingX.xs).toBe('space-x-1');
      expect(spacingX.sm).toBe('space-x-2');
      expect(spacingX.md).toBe('space-x-4');
      expect(spacingX.lg).toBe('space-x-6');
      expect(spacingX.xl).toBe('space-x-8');
      expect(spacingX['2xl']).toBe('space-x-12');
      expect(spacingX['3xl']).toBe('space-x-16');
    });

    it('should provide correct gap values', () => {
      expect(gap.xs).toBe('gap-1');
      expect(gap.sm).toBe('gap-2');
      expect(gap.md).toBe('gap-4');
      expect(gap.lg).toBe('gap-6');
      expect(gap.xl).toBe('gap-8');
      expect(gap['2xl']).toBe('gap-12');
      expect(gap['3xl']).toBe('gap-16');
    });

    it('should provide correct padding values', () => {
      expect(padding.xs).toBe('p-1');
      expect(padding.sm).toBe('p-2');
      expect(padding.md).toBe('p-4');
      expect(padding.lg).toBe('p-6');
      expect(padding.xl).toBe('p-8');
      expect(padding['2xl']).toBe('p-12');
      expect(padding['3xl']).toBe('p-16');
    });

    it('should provide correct margin values', () => {
      expect(margin.xs).toBe('m-1');
      expect(margin.sm).toBe('m-2');
      expect(margin.md).toBe('m-4');
      expect(margin.lg).toBe('m-6');
      expect(margin.xl).toBe('m-8');
      expect(margin['2xl']).toBe('m-12');
      expect(margin['3xl']).toBe('m-16');
    });
  });

  describe('Typography Tokens', () => {
    it('should provide correct typography values', () => {
      expect(typography.xs).toBe('text-xs leading-4');
      expect(typography.sm).toBe('text-sm leading-5');
      expect(typography.base).toBe('text-base leading-6');
      expect(typography.lg).toBe('text-lg leading-7');
      expect(typography.xl).toBe('text-xl leading-8');
      expect(typography['2xl']).toBe('text-2xl leading-9');
      expect(typography['3xl']).toBe('text-3xl leading-10');
      expect(typography['4xl']).toBe('text-4xl leading-none');
    });

    it('should provide correct font weight values', () => {
      expect(fontWeight.normal).toBe('font-normal');
      expect(fontWeight.medium).toBe('font-medium');
      expect(fontWeight.semibold).toBe('font-semibold');
      expect(fontWeight.bold).toBe('font-bold');
    });
  });

  describe('Color Tokens', () => {
    it('should provide semantic color combinations', () => {
      expect(colors.background).toBe('bg-background text-foreground');
      expect(colors.card).toBe('bg-card text-card-foreground');
      expect(colors.popover).toBe('bg-popover text-popover-foreground');
      expect(colors.primary).toBe('bg-primary text-primary-foreground');
      expect(colors.secondary).toBe('bg-secondary text-secondary-foreground');
      expect(colors.muted).toBe('bg-muted text-muted-foreground');
      expect(colors.accent).toBe('bg-accent text-accent-foreground');
      expect(colors.destructive).toBe('bg-destructive text-destructive-foreground');
    });
  });

  describe('Border Colors', () => {
    it('should provide correct border color values', () => {
      expect(borderColors.default).toBe('border-border');
      expect(borderColors.input).toBe('border-input');
      expect(borderColors.primary).toBe('border-primary');
      expect(borderColors.secondary).toBe('border-secondary');
      expect(borderColors.muted).toBe('border-muted');
      expect(borderColors.accent).toBe('border-accent');
      expect(borderColors.destructive).toBe('border-destructive');
    });
  });

  describe('Text Colors', () => {
    it('should provide correct text color values', () => {
      expect(textColors.foreground).toBe('text-foreground');
      expect(textColors.muted).toBe('text-muted-foreground');
      expect(textColors.primary).toBe('text-primary');
      expect(textColors.secondary).toBe('text-secondary-foreground');
      expect(textColors.accent).toBe('text-accent-foreground');
      expect(textColors.destructive).toBe('text-destructive');
    });
  });

  describe('Animation Tokens', () => {
    it('should provide correct animation values', () => {
      expect(animations.fadeIn).toBe('animate-in fade-in duration-200');
      expect(animations.fadeOut).toBe('animate-out fade-out duration-200');
      expect(animations.slideIn).toBe('animate-in slide-in-from-bottom duration-300');
      expect(animations.slideOut).toBe('animate-out slide-out-to-bottom duration-300');
      expect(animations.scaleIn).toBe('animate-in zoom-in-95 duration-200');
      expect(animations.scaleOut).toBe('animate-out zoom-out-95 duration-200');
    });
  });

  describe('Layout Tokens', () => {
    it('should provide correct layout utilities', () => {
      expect(layout.container).toBe('container mx-auto px-4');
      expect(layout.section).toBe('py-8 lg:py-12');
    });

    it('should provide correct grid utilities', () => {
      expect(layout.grid.cols1).toBe('grid grid-cols-1');
      expect(layout.grid.cols2).toBe('grid grid-cols-1 md:grid-cols-2');
      expect(layout.grid.cols3).toBe('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3');
      expect(layout.grid.cols4).toBe('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4');
    });

    it('should provide correct flex utilities', () => {
      expect(layout.flex.center).toBe('flex items-center justify-center');
      expect(layout.flex.between).toBe('flex items-center justify-between');
      expect(layout.flex.start).toBe('flex items-center justify-start');
      expect(layout.flex.end).toBe('flex items-center justify-end');
      expect(layout.flex.col).toBe('flex flex-col');
      expect(layout.flex.colCenter).toBe('flex flex-col items-center justify-center');
    });
  });

  describe('Button Variants', () => {
    it('should provide correct button variant values', () => {
      expect(buttonVariants.default).toBe('bg-primary text-primary-foreground hover:bg-primary/90');
      expect(buttonVariants.destructive).toBe('bg-destructive text-destructive-foreground hover:bg-destructive/90');
      expect(buttonVariants.outline).toBe('border border-input bg-background hover:bg-accent hover:text-accent-foreground');
      expect(buttonVariants.secondary).toBe('bg-secondary text-secondary-foreground hover:bg-secondary/80');
      expect(buttonVariants.ghost).toBe('hover:bg-accent hover:text-accent-foreground');
      expect(buttonVariants.link).toBe('text-primary underline-offset-4 hover:underline');
    });
  });

  describe('Card Variants', () => {
    it('should provide correct card variant values', () => {
      expect(cardVariants.default).toBe('bg-card text-card-foreground border shadow-sm');
      expect(cardVariants.elevated).toBe('bg-card text-card-foreground border shadow-md');
      expect(cardVariants.outlined).toBe('bg-card text-card-foreground border-2');
      expect(cardVariants.ghost).toBe('bg-transparent');
    });
  });

  describe('Loading States', () => {
    it('should provide correct loading state values', () => {
      expect(loadingStates.skeleton).toBe('animate-pulse bg-muted rounded');
      expect(loadingStates.spinner).toBe('animate-spin');
      expect(loadingStates.pulse).toBe('animate-pulse');
    });
  });

  describe('Focus States', () => {
    it('should provide correct focus state values', () => {
      expect(focusStates.default).toBe('focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2');
      expect(focusStates.destructive).toBe('focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2');
      expect(focusStates.none).toBe('focus:outline-none');
    });
  });

  describe('Hover States', () => {
    it('should provide correct hover state values', () => {
      expect(hoverStates.default).toBe('hover:bg-accent hover:text-accent-foreground');
      expect(hoverStates.destructive).toBe('hover:bg-destructive/90');
      expect(hoverStates.muted).toBe('hover:bg-muted');
    });
  });

  describe('Responsive Utilities', () => {
    it('should provide correct responsive values', () => {
      expect(responsive.mobile).toBe('block sm:hidden');
      expect(responsive.tablet).toBe('hidden sm:block lg:hidden');
      expect(responsive.desktop).toBe('hidden lg:block');
      expect(responsive.mobileTablet).toBe('block lg:hidden');
      expect(responsive.tabletDesktop).toBe('hidden sm:block');
    });
  });

  describe('Token Consistency', () => {
    it('should have consistent token structure across spacing utilities', () => {
      const spacingKeys = Object.keys(spacing);
      const gapKeys = Object.keys(gap);
      const paddingKeys = Object.keys(padding);
      const marginKeys = Object.keys(margin);

      expect(spacingKeys).toEqual(gapKeys);
      expect(spacingKeys).toEqual(paddingKeys);
      expect(spacingKeys).toEqual(marginKeys);
    });

    it('should have consistent typography token structure', () => {
      const typographyKeys = Object.keys(typography);
      expect(typographyKeys).toContain('xs');
      expect(typographyKeys).toContain('sm');
      expect(typographyKeys).toContain('base');
      expect(typographyKeys).toContain('lg');
      expect(typographyKeys).toContain('xl');
    });
  });

  describe('Integration with Tailwind', () => {
    it('should work with cn utility for complex class combinations', () => {
      const complexClasses = cn(
        layout.flex.center,
        padding.md,
        colors.primary,
        'rounded-lg',
        'shadow-md'
      );

      expect(complexClasses).toContain('flex');
      expect(complexClasses).toContain('items-center');
      expect(complexClasses).toContain('justify-center');
      expect(complexClasses).toContain('p-4');
      expect(complexClasses).toContain('bg-primary');
      expect(complexClasses).toContain('text-primary-foreground');
      expect(complexClasses).toContain('rounded-lg');
      expect(complexClasses).toContain('shadow-md');
    });

    it('should handle conflicting classes properly', () => {
      const result = cn(padding.sm, padding.lg, margin.xs, margin.xl);

      // Should resolve conflicts with later values taking precedence
      expect(result).toContain('p-6'); // padding.lg should override padding.sm
      expect(result).toContain('m-8'); // margin.xl should override margin.xs
    });
  });
});
