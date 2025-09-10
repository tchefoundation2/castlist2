import React, { useState } from 'react';
import { useFarcasterSDKSimple } from '../hooks/useFarcasterSDKSimple';
import { useAuth } from '../hooks/useAuth';

const SDKDebug: React.FC = () => {
  const { isLoaded, isReady, hasActions } = useFarcasterSDKSimple();
  const { user, isAuthenticated } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Check if we're in Farcaster preview
  const isInFarcasterPreview = document.referrer.includes('farcaster.xyz') || 
                               window.location.href.includes('farcaster.xyz') ||
                               window.location.href.includes('ngrok');
                               
  // Check environment
  const isMiniApp = window.farcaster && typeof window.farcaster.signIn === 'function';
  const isWebApp = window.FarcasterAuthKit && window.FarcasterAuthKit.AuthKitProvider;

  // Only show in development or when there are issues
  if (process.env.NODE_ENV === 'production' && isReady) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white text-xs rounded-lg z-50 font-mono max-w-xs transition-all duration-300 ease-in-out">
      {/* Header with toggle button */}
      <div 
        className="flex items-center justify-between p-2 cursor-pointer hover:bg-black/60 rounded-t-lg"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="font-bold text-yellow-400">SDK Debug Panel</div>
        <div className="text-gray-400 hover:text-white transition-colors">
          {isCollapsed ? '▼' : '▲'}
        </div>
      </div>
      
      {/* Collapsible content */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
        isCollapsed ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'
      }`}>
        <div className="p-2 pt-0 space-y-1">
          <div>Environment: {isMiniApp ? '📱 Mini App' : isWebApp ? '🌐 Web App' : '💻 Development'}</div>
          <div>SDK Loaded: {isLoaded ? '✅' : '❌'}</div>
          <div>Has Actions: {hasActions ? '✅' : '❌'}</div>
          <div>SDK Ready: {isReady ? '✅' : '⏳'}</div>
          <div>Farcaster: {window.farcaster ? '✅' : '❌'}</div>
          <div>AuthKit: {window.FarcasterAuthKit ? '✅' : '❌'}</div>
          <div>Preview Mode: {isInFarcasterPreview ? '✅' : '❌'}</div>
          
          <div className="border-t border-gray-600 pt-1 mt-1">
            <div className="font-bold text-green-400">User Info:</div>
            <div>Authenticated: {isAuthenticated ? '✅' : '❌'}</div>
            {user && (
              <>
                <div>FID: {user.fid}</div>
                <div>Username: {user.username}</div>
                <div>ID: {user.id}</div>
                <div className="text-xs text-gray-400">
                  User Type: {
                    (user.id === 'dev-user-1' || user.fid === 12345 || user.username === 'preview_user') ? '🟡 Mock' : 
                    '🔴 Real'
                  }
                </div>
              </>
            )}
          </div>
          
          {window.farcaster?.actions && (
            <div>Actions: {Object.keys(window.farcaster.actions).join(', ')}</div>
          )}
          
          <div className="text-xs text-gray-400">
            URL: {window.location.href.substring(0, 30)}...
          </div>
          <div className="text-xs text-gray-400">
            Referrer: {document.referrer.substring(0, 30)}...
          </div>
        </div>
      </div>
    </div>
  );
};

export default SDKDebug;
