import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User } from '../types';
import { getOrCreateUserProfile } from '../services/supabaseService';

// Define the Farcaster SDK type on the window object for TypeScript
declare global {
  interface Window {
    // Mini App SDK (inside Farcaster mobile/web app)
    farcaster?: {
      signIn: () => Promise<{ fid: number; username: string; pfp_url: string; message: string; signature: string; nonce: string; } | { error: string }>;
      getUser: () => Promise<{ fid: number; username: string; pfp_url: string; } | null>;
      actions?: {
        ready: () => void;
      };
      quickAuth?: {
        getToken: () => Promise<{ token: string; }>;
        fetch: (url: string, options?: RequestInit) => Promise<Response>;
      };
    };
  // Web App SDK (standalone web app)
  FarcasterAuthKit?: {
    AuthKitProvider: any;
    SignInButton: any;
    useProfile: any;
    useSignIn: any;
    QRCode: any;
  };
  }
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: () => Promise<{error?: any}>;
  logout: () => Promise<void>;
  loginAsMockUser: (user: User) => void; // For development only
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check for an existing Farcaster session when the app loads
  useEffect(() => {
    const checkFarcasterSession = async () => {
      setIsLoading(true);
      try {
        // Check if we're in a Farcaster mini app environment
        const isMiniApp = window.farcaster && window.farcaster.signIn;
        // Check if we're in a standalone web app environment
        const isWebApp = window.FarcasterAuthKit && window.FarcasterAuthKit.AuthKitProvider;
        
        console.log("🔍 Environment detection:");
        console.log("  - isMiniApp:", isMiniApp);
        console.log("  - isWebApp:", isWebApp);
        console.log("  - window.farcaster:", !!window.farcaster);
        console.log("  - window.FarcasterAuthKit:", !!window.FarcasterAuthKit);
        
        if (isMiniApp && window.farcaster) {
          console.log("📱 Mini App environment detected - using window.farcaster");
          
          const farcasterUser = await window.farcaster.getUser();
          if (farcasterUser) {
            const profile = await getOrCreateUserProfile(farcasterUser);
            setUser(profile);
          }
        } else if (isWebApp && window.FarcasterAuthKit) {
          console.log("🌐 Web App environment detected - using FarcasterAuthKit");
          // AuthKit user handling is done in the FarcasterAuthKit component
          console.log("AuthKit user handling done in component");
        } else {
          // In dev mode, don't auto-login. Let the user choose from the login page.
          console.warn("Farcaster SDK not found. Displaying developer login options.");
        }
      } catch (e) {
        console.error("Error checking Farcaster session:", e);
      } finally {
        setIsLoading(false);
      }
    };
    checkFarcasterSession();
  }, []);

  const login = async () => {
    setIsLoading(true);
    try {
      // Check environment
      const isMiniApp = window.farcaster && window.farcaster.signIn;
      const isWebApp = window.FarcasterAuthKit && window.FarcasterAuthKit.AuthKitProvider;
      
      if (isMiniApp) {
        console.log("📱 Mini App login - using window.farcaster");
      } else if (isWebApp) {
        console.log("🌐 Web App login - using FarcasterAuthKit");
      }
      
      if (!isMiniApp && !isWebApp) {
        // Development mode: use mock user
        console.warn("Farcaster SDK not available. Using development mode.");
        const mockUser: User = {
          id: 'dev-user-1',
          fid: 1,
          username: 'farcaster.eth',
          pfp_url: 'https://i.imgur.com/34Iodlt.jpg',
          email: 'dev@example.com'
        };
        setUser(mockUser);
        setIsLoading(false);
        return {};
      }
      
      if (isMiniApp && window.farcaster) {
        // Mini App login
        const result = await window.farcaster.signIn();
        
        if ('error' in result) {
          throw new Error(result.error);
        }
        
        const profile = await getOrCreateUserProfile(result);
        setUser(profile);
        
      } else if (isWebApp && window.FarcasterAuthKit) {
        // Web App login
        // AuthKit doesn't have signIn() - it uses SignInButton component
        // This will be handled by the FarcasterAuthKit component
        console.log("AuthKit detected but signIn() not available - using component instead");
        throw new Error("AuthKit login must be handled by component");
      } else {
        throw new Error("No Farcaster SDK available");
      }
      
      setIsLoading(false);
      return {};
    } catch (error) {
      console.error("Farcaster login failed:", error);
      setIsLoading(false);
      return { error };
    }
  };

  const logout = async () => {
    // In a Farcaster context, "logging out" just means clearing local state.
    setUser(null);
  };
  
  const loginAsMockUser = (mockUser: User) => {
    console.log("Logging in as mock user:", mockUser.username);
    setUser(mockUser);
  };


  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
    loginAsMockUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};