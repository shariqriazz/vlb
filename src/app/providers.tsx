'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ThemeProviderProps } from 'next-themes';

export function Providers({ children, ...props }: ThemeProviderProps) {
  // Pass down any additional props to the provider
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props} // Spread remaining props
    >
      {children}
    </NextThemesProvider>
  );
}