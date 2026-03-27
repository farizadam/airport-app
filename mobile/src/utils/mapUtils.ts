import { Platform, Linking, Alert } from 'react-native';
import * as Device from 'expo-device';

// We are now forcing OpenStreetMap (OSM) usage, but we keep the key logic 
// in case we need to revert or use it for other Google APIs (like Places/Geocoding) 
// if the user desires, though the prompt implies "only map with oppensource".
// For now, we force the MAP VIEW to be OSM.
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

/**
 * Determines if the app should operate in "Google Maps Mode" for the MapView provider.
 * 
 * CHANGE: Forced to FALSE to use OpenStreetMap tiles via UrlTile.
 */
export const isGoogleMapsEnabled = (): boolean => {
  return false;
};

/**
 * Opens the location in the user's preferred map app (Google Maps, Apple Maps, etc.)
 * Works on iOS, Android (Samsung, Pixel), and Huawei (via intent).
 */
export const openExternalMap = (latitude: number, longitude: number, label: string = 'Location') => {
  const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
  const latLng = `${latitude},${longitude}`;
  const labelEncoded = encodeURIComponent(label);
  
  let url = '';
  
  if (Platform.OS === 'ios') {
    // Apple Maps format
    url = `maps:?q=${labelEncoded}&ll=${latitude},${longitude}`;
  } else {
    // Android format (Universal geo intent - works with GMap, Waze, Huawei Petal Maps)
    url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${labelEncoded})`;
  }

  Linking.canOpenURL(url).then(supported => {
    if (supported) {
      return Linking.openURL(url);
    } else {
      openGoogleMapsWeb(latitude, longitude);
    }
  }).catch(err => {
    console.error('An error occurred', err);
    openGoogleMapsWeb(latitude, longitude);
  });
};

/**
 * Specifically opens OpenStreetMap Web fallback
 */
export const openGoogleMapsWeb = (latitude: number, longitude: number) => {
   // Fallback to OpenStreetMap website
   const browserUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
   Linking.openURL(browserUrl);
};