import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lahza.app',
  appName: 'لحظة | Lahza',
  webDir: 'dist/public',
  server: {
    url: 'https://app-6ab5ab21.deploy.meerasolution.com/',
    cleartext: false,
    allowNavigation: ['app-6ab5ab21.deploy.meerasolution.com']
  }
};

export default config;
