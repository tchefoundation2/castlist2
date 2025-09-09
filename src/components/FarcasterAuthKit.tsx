import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { AuthKitProvider, useSignIn, QRCode } from '@farcaster/auth-kit';

// Types are declared in useAuth.tsx

// Configure AuthKit
const config = {
  domain: 'castlist.netlify.app',
  siweUri: 'https://castlist.netlify.app/login',
  rpcUrl: 'https://mainnet.optimism.io',
  relay: 'https://relay.farcaster.xyz',
};

const LoginWithQR: React.FC = () => {
  const { loginAsMockUser } = useAuth();
  
  const { signIn, url, data } = useSignIn({
    onSuccess: (res: any) => {
      console.log('User authenticated:', res);
      const { fid, username } = res;
      // Set user in context with real data
      if (fid && username) {
        loginAsMockUser({
          id: fid.toString(),
          fid: fid,
          username: username,
          pfp_url: '', // Will be filled by the app
          email: `${username}@farcaster.xyz`
        });
      }
    },
    onError: (error: any) => {
      console.error('Authentication error:', error);
    },
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-gray-800 dark:text-gray-200 p-4 bg-gradient-to-br from-primary-50 via-purple-50 to-blue-100 bg-300% animate-gradient dark:from-gray-900 dark:via-gray-900 dark:to-black">
      <div className="text-center animate-fadeIn w-full max-w-sm">
        <h1 className="text-5xl font-bold text-gray-900 dark:text-gray-50 mb-3">
          Castlist
        </h1>
        <h2 className="text-xl font-medium text-primary-700 dark:text-primary-400 mb-4">
          Transform your Readings into a Social Journey
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-10 text-base">
          Please sign in with Farcaster to continue.
        </p>
        
        <div className="mt-10">
          <button
            onClick={signIn}
            className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center gap-3 mx-auto"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Sign in with Farcaster
          </button>
          
          {url && (
            <div className="mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
              <p className="text-gray-700 dark:text-gray-300 mb-4 text-sm">
                Escaneie este QR code com o aplicativo Farcaster no seu celular:
              </p>
              <div className="flex justify-center">
                <QRCode uri={url} />
              </div>
            </div>
          )}
          
          {data?.username && (
            <div className="mt-4 p-4 bg-green-100 dark:bg-green-900 rounded-lg">
              <p className="text-green-800 dark:text-green-200">
                Olá, {data.username}!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FarcasterAuthKit: React.FC = () => {
  console.log("🔍 FarcasterAuthKit component loaded with direct imports");
  
  return (
    <AuthKitProvider config={config}>
      <LoginWithQR />
    </AuthKitProvider>
  );
};

export default FarcasterAuthKit;
