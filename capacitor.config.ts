import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lahza.app',
  appName: 'لحظة | Lahza',
  webDir: 'dist/public',
  server: {
    url: 'https://lahza-production-e0af.up.railway.app/',
    cleartext: false
  }
};

export default config;
