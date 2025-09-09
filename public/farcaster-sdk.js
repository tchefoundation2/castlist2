console.log("🚀 Farcaster SDK script starting...");
console.log("🔍 Document ready state:", document.readyState);
console.log("🔍 Current URL:", window.location.href);

(async () => {
  try {
    console.log("🔍 Checking for existing Farcaster SDK...");
    
    // Check if Farcaster already injected SDK
    if (window.farcaster && window.farcaster.actions) {
      console.log("✅ Farcaster SDK already injected by client");
      // Call ready() immediately
      if (window.farcaster.actions.ready) {
        window.farcaster.actions.ready();
        console.log("✅ sdk.actions.ready() called on injected SDK");
      }
    } else {
      console.log("⚠️ No Farcaster SDK injected by client");
      
      // Try to load Mini App SDK for development
      try {
        console.log("🔄 Loading Mini App SDK from ESM...");
        const { sdk } = await import('https://esm.sh/@farcaster/miniapp-sdk');
        window.farcaster = sdk;
        console.log("✅ Farcaster Mini App SDK loaded from ESM");
        
        // Call ready() immediately
        if (sdk.actions && sdk.actions.ready) {
          sdk.actions.ready();
          console.log("✅ sdk.actions.ready() called from ESM SDK");
        }
      } catch (error) {
        console.log("⚠️ Mini App SDK not available:", error);
      }
    }
    
    // Load AuthKit for web apps (always try)
    try {
      console.log("🔄 Loading AuthKit from local node_modules...");
      
      const authKitModule = await import('/node_modules/@farcaster/auth-kit/dist/index.js');
      console.log("🔍 AuthKit module loaded:", authKitModule);
      
      const { AuthKitProvider, SignInButton, useProfile, useSignIn, QRCode } = authKitModule;
      console.log("🔍 Destructured components:", { AuthKitProvider, SignInButton, useProfile, useSignIn, QRCode });
      
      window.FarcasterAuthKit = {
        AuthKitProvider,
        SignInButton,
        useProfile,
        useSignIn,
        QRCode
      };
      console.log("✅ Farcaster AuthKit loaded with useSignIn and QRCode");
      console.log("🔍 window.FarcasterAuthKit:", window.FarcasterAuthKit);
      console.log("🔍 AuthKitProvider type:", typeof window.FarcasterAuthKit.AuthKitProvider);
    } catch (error) {
      console.error("❌ Local AuthKit loading failed:", error);
      console.error("❌ Error details:", error.message);
      console.error("❌ Error stack:", error.stack);
    }
    
    console.log("✅ Farcaster SDK script completed");
  } catch (error) {
    console.error("❌ Farcaster SDK script failed:", error);
  }
})();
