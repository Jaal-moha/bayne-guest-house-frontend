import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { JetBrains_Mono, Schibsted_Grotesk } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/Toast';

const sans = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-schibsted' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${sans.variable} ${mono.variable} font-sans`}>
      <AuthProvider>
        <ToastProvider>
          <Component {...pageProps} />
        </ToastProvider>
      </AuthProvider>
    </div>
  );
}
