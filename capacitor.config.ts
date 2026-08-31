import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lahza.app',
  appName: 'لحظة | Lahza',
  webDir: 'dist/public',
  server: {
    url: 'https://lahza-production-e0af.up.railway.app/',
    cleartext: false,
    allowNavigation: ['lahza-production-e0af.up.railway.app']
  }
};

export default config;
