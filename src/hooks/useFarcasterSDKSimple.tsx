import { useEffect, useState } from 'react';

declare global {
  interface Window {
    farcaster?: {
      signIn: () => Promise<{ fid: number; username: string; pfp_url: string; message: string; signature: string; nonce: string; } | { error: string; }>;
      getUser: () => Promise<{ fid: number; username: string; pfp_url: string; } | null>;
      actions?: {
        ready: () => void;
      };
      quickAuth?: {
        getToken: () => Promise<{ token: string; }>;
        fetch: (url: string, options?: RequestInit) => Promise<Response>;
      };
    };
  }
}

export interface FarcasterSDKInfo {
  isLoaded: boolean;
  isReady: boolean;
  hasActions: boolean;
}

export const useFarcasterSDKSimple = (): FarcasterSDKInfo => {
  const [sdkInfo, setSdkInfo] = useState<FarcasterSDKInfo>({
    isLoaded: false,
    isReady: false,
    hasActions: false
  });

  useEffect(() => {
    const checkSDK = () => {
      const isLoaded = !!window.farcaster;
      const hasActions = !!(window.farcaster?.actions);
      const isReady = isLoaded && hasActions; // SDK is ready if loaded and has actions

      setSdkInfo({
        isLoaded,
        isReady,
        hasActions
      });
    };

    // Check immediately and periodically
    checkSDK();
    
    // Check a few more times in case SDK loads asynchronously
    const timeouts = [
      setTimeout(checkSDK, 100),
      setTimeout(checkSDK, 500),
      setTimeout(checkSDK, 1000)
    ];
    
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return sdkInfo;
};
