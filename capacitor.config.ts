import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mudhonai.minuteman',
  appName: 'Minuteman',
  webDir: 'dist',
  server: {
    url: 'https://7b116ff6-ebf6-4655-9dc2-fd36adf2a949.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    BackgroundGeolocation: {
      backgroundMessage: "Minuteman erfasst deinen Standort im Hintergrund für automatisches Stempeln.",
      backgroundTitle: "Standortverfolgung aktiv"
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF"
    }
  },
  ios: {
    contentInset: 'always'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
