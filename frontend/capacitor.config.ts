import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.autotracker.app',
  appName: 'AutoTracker',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
};

export default config;
