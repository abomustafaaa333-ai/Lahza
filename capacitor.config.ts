import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lahza.app',
  appName: 'لحظة | Lahza',
  webDir: 'dist/public',
  server: {
    url: 'https://lahza.vibenest.net/',
    cleartext: false,
    allowNavigation: ['lahza.vibenest.net']
  }
};

export default config;
