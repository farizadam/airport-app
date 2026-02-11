import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

interface LeafletMapProps {
  mode: 'picker' | 'view';
  initialRegion?: { latitude: number; longitude: number; zoom?: number };
  markers?: Array<{
    id: string;
    latitude: number;
    longitude: number;
    title?: string;
    type?: 'ride' | 'request' | 'airport';
  }>;
  selectedId?: string; // New prop to highlight specific marker
  routeCoordinates?: Array<{ latitude: number; longitude: number }>; // New prop for route
  onRegionChange?: (region: { 
    latitude: number; 
    longitude: number;
    bounds?: {
      northEast: { lat: number; lng: number };
      southWest: { lat: number; lng: number };
    }
  }) => void;
  onMarkerClick?: (id: string) => void;
  onMapClick?: () => void;
  onLocationFound?: (location: { latitude: number; longitude: number }) => void;
  onLocationError?: (error: string) => void;
  // If true, shows a static "target" pin in the center for picking
  showCenterMarker?: boolean; 
}

export interface LeafletMapRef {
  locateUser: () => void;
}

const LeafletMap = forwardRef<LeafletMapRef, LeafletMapProps>(({
  mode,
  initialRegion,
  markers = [],
  selectedId, // Destructure selectedId
  routeCoordinates = [], // Default empty
  onRegionChange,
  onMarkerClick,
  onMapClick,
  onLocationFound,
  onLocationError,
  showCenterMarker
}, ref) => {
  const webViewRef = useRef<WebView>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  useImperativeHandle(ref, () => ({
    locateUser: () => {
      if (webViewRef.current && isMapReady) {
        webViewRef.current.injectJavaScript('locateUser(); true;');
      }
    }
  }));

  // Default to Morocco center if no region provided
  const startLat = initialRegion?.latitude || 31.7917;
  const startLng = initialRegion?.longitude || -7.0926;
  const startZoom = initialRegion?.zoom || 13;

  const htmlContent = React.useMemo(() => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
      <style>
        body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #f8f9fa; }
        #map { width: 100%; height: 100vh; }
        
        /* Custom Marker Styles */
        .marker-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .marker-ride { background-color: #007AFF; }
        .marker-request { background-color: #FF9500; }
        .marker-inner {
            width: 8px;
            height: 8px;
            background-color: white;
            border-radius: 50%;
        }
        
        /* Selected Airport Style */
        .selected-airport-icon {
            font-size: 24px;
            text-align: center;
            line-height: 24px;
            filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.5));
        }

        /* Center Target Marker (for picker mode) */
        #center-marker {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 32px;
            height: 32px;
            margin-top: -32px; /* Bottom of pin at center */
            margin-left: -16px;
            z-index: 1000;
            pointer-events: none;
            display: none;
        }
        #center-marker::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 4px;
            height: 4px;
            background: rgba(0,0,0,0.3);
            border-radius: 50%;
            box-shadow: 0 0 4px 2px rgba(0,0,0,0.3);
        }
        .pin {
            width: 30px;
            height: 30px;
            border-radius: 50% 50% 50% 0;
            background: #FF3B30;
            position: absolute;
            transform: rotate(-45deg);
            left: 50%;
            top: 50%;
            margin: -20px 0 0 -20px;
        }
        .pin::after {
            content: "";
            width: 14px;
            height: 14px;
            margin: 8px 0 0 8px;
            background: #fff;
            position: absolute;
            border-radius: 50%;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      ${showCenterMarker ? '<div id="center-marker" style="display: block;"><div class="pin"></div></div>' : ''}

      <script>
        var map = L.map('map', {
            zoomControl: false,
            attributionControl: false
        }).setView([${startLat}, ${startLng}], ${startZoom});

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        // Layers
        var markersLayer = L.layerGroup().addTo(map);
        var routeLayer = L.layerGroup().addTo(map);

        function updateMarkers(markersData, currentSelectedId) {
            markersLayer.clearLayers();
            markersData.forEach(function(m) {
                var isSelected = currentSelectedId && (m.id === currentSelectedId);
                
                if (isSelected) {
                    // Custom Airplane Icon for Selected Airport
                    var icon = L.divIcon({
                        className: 'selected-airport-icon',
                        html: '✈️', // Airplane emoji,
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    });
                    
                    var marker = L.marker([m.latitude, m.longitude], {
                        icon: icon,
                        zIndexOffset: 1000 // Ensure it's on top
                    });
                    
                    if (m.title) {
                        marker.bindTooltip(m.title, { direction: 'top', offset: [0, -15], permanent: true });
                    }
                    
                    marker.on('click', function() {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'markerClick',
                            id: m.id
                        }));
                    });
                    marker.addTo(markersLayer);
                    
                } else {
                    // Standard Circle Markers for others
                    var color;
                    if (m.type === 'ride') color = '#007AFF';
                    else if (m.type === 'request') color = '#FF9500';
                    else if (m.type === 'airport') color = '#10B981'; // Green for airports
                    else color = '#007AFF';

                    var marker = L.circleMarker([m.latitude, m.longitude], {
                        radius: m.type === 'airport' ? 6 : 8,
                        fillColor: color,
                        color: '#fff',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 1
                    });
                    
                    if (m.title) {
                        marker.bindTooltip(m.title, { direction: 'top', offset: [0, -5] });
                    }

                    marker.on('click', function() {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'markerClick',
                            id: m.id
                        }));
                    });
                    marker.addTo(markersLayer);
                }
            });
        }
        
        function updateRoute(routeData) {
            routeLayer.clearLayers();
            if (!routeData || routeData.length < 2) return;
            
            // Use OSRM to get actual road route instead of straight line
            var start = routeData[0];
            var end = routeData[routeData.length - 1];
            
            // Build waypoints string for OSRM (lng,lat format)
            var waypoints = routeData.map(function(c) {
                return c.longitude + ',' + c.latitude;
            }).join(';');
            
            var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' + waypoints + '?overview=full&geometries=geojson';
            
            fetch(osrmUrl)
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    routeLayer.clearLayers();
                    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                        var coords = data.routes[0].geometry.coordinates.map(function(c) {
                            return [c[1], c[0]]; // GeoJSON is [lng, lat], Leaflet needs [lat, lng]
                        });
                        var polyline = L.polyline(coords, {
                            color: '#3B82F6',
                            weight: 5,
                            opacity: 0.8,
                            smoothFactor: 1
                        }).addTo(routeLayer);
                        
                        // Add direction arrow decorations using simple markers
                        if (coords.length > 1) {
                            // Add start marker
                            L.circleMarker(coords[0], {
                                radius: 6,
                                fillColor: '#22C55E',
                                color: '#fff',
                                weight: 2,
                                fillOpacity: 1
                            }).addTo(routeLayer);
                            
                            // Add end marker
                            L.circleMarker(coords[coords.length - 1], {
                                radius: 6,
                                fillColor: '#EF4444',
                                color: '#fff',
                                weight: 2,
                                fillOpacity: 1
                            }).addTo(routeLayer);
                        }
                        
                        try {
                            map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
                        } catch(e) {}
                    } else {
                        // Fallback to straight line if OSRM fails
                        drawStraightRoute(routeData);
                    }
                })
                .catch(function(err) {
                    console.log('OSRM routing failed, falling back to straight line:', err);
                    drawStraightRoute(routeData);
                });
        }
        
        function drawStraightRoute(routeData) {
            routeLayer.clearLayers();
            var latlngs = routeData.map(function(c) { return [c.latitude, c.longitude]; });
            var polyline = L.polyline(latlngs, {
                color: '#3B82F6', 
                weight: 5,
                opacity: 0.8,
                dashArray: '10, 10'
            }).addTo(routeLayer);
            
            try {
                map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
            } catch(e) {}
        }

        // Initialize with empty data - logic will inject data
        updateMarkers([], null);
        updateRoute([]);

        // Events
        map.on('moveend', function() {
            var center = map.getCenter();
            var bounds = map.getBounds();
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'regionChange',
                latitude: center.lat,
                longitude: center.lng,
                zoom: map.getZoom(),
                bounds: {
                    northEast: bounds.getNorthEast(),
                    southWest: bounds.getSouthWest()
                }
            }));
        });

        map.on('click', function() {
             window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'mapClick'
            }));
        });

        // Function to get user's location using browser geolocation
        function locateUser() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'locatingUser'
            }));
            
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    function(position) {
                        var lat = position.coords.latitude;
                        var lng = position.coords.longitude;
                        
                        // Move map to user location
                        map.setView([lat, lng], 15);
                        
                        // Notify React Native
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'locationFound',
                            latitude: lat,
                            longitude: lng
                        }));
                    },
                    function(error) {
                        var message = 'Location error';
                        switch(error.code) {
                            case error.PERMISSION_DENIED:
                                message = 'Location permission denied';
                                break;
                            case error.POSITION_UNAVAILABLE:
                                message = 'Location unavailable';
                                break;
                            case error.TIMEOUT:
                                message = 'Location request timed out';
                                break;
                        }
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'locationError',
                            message: message
                        }));
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 15000,
                        maximumAge: 0
                    }
                );
            } else {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'locationError',
                    message: 'Geolocation not supported'
                }));
            }
        }
        
        // Expose to be called from React Native
        window.locateUser = locateUser;

      </script>
    </body>
    </html>
  `, [startLat, startLng, startZoom, showCenterMarker]);

  // Update map when markers props change
  useEffect(() => {
    if (webViewRef.current && isMapReady) {
      const script = `updateMarkers(${JSON.stringify(markers)}, ${JSON.stringify(selectedId)}); true;`;
      webViewRef.current.injectJavaScript(script);
    }
  }, [markers, isMapReady, selectedId]);
  
  // Update map when route props change
  useEffect(() => {
    if (webViewRef.current && isMapReady) {
      const script = `updateRoute(${JSON.stringify(routeCoordinates)}); true;`;
      webViewRef.current.injectJavaScript(script);
    }
  }, [routeCoordinates, isMapReady]);

  // Update center if initialRegion changes (mostly for search results)
  const lastRegionRef = useRef<LeafletMapProps['initialRegion']>();
  useEffect(() => {
      if (webViewRef.current && isMapReady && initialRegion) {
        // Check if region actually changed to avoid infinite loops with inline objects
        const last = lastRegionRef.current;
        if (last && 
            Math.abs(last.latitude - initialRegion.latitude) < 0.0001 && 
            Math.abs(last.longitude - initialRegion.longitude) < 0.0001 &&
            last.zoom === initialRegion.zoom) {
          return;
        }
        lastRegionRef.current = initialRegion;

        // We use setView with animation
        const script = `map.setView([${initialRegion.latitude}, ${initialRegion.longitude}], ${initialRegion.zoom || 15}); true;`;
        webViewRef.current.injectJavaScript(script);
      }
  }, [initialRegion, isMapReady]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'regionChange':
          if (onRegionChange) {
            onRegionChange({ latitude: data.latitude, longitude: data.longitude });
          }
          break;
        case 'markerClick':
          if (onMarkerClick) {
            onMarkerClick(data.id);
          }
          break;
        case 'mapClick':
          if (onMapClick) {
            onMapClick();
          }
          break;
        case 'locatingUser':
          // User location request started (can show a loading indicator in parent)
          console.log('📍 WebView is locating user...');
          break;
        case 'locationFound':
          console.log(`📍 WebView location found: ${data.latitude}, ${data.longitude}`);
          if (onLocationFound) {
             onLocationFound({ latitude: data.latitude, longitude: data.longitude });
          }
          break;
        case 'locationError':
          console.log(`📍 WebView location error: ${data.message}`);
          if (onLocationError) {
              onLocationError(data.message);
          }
          break;
      }
    } catch (e) {
      console.error("Error parsing map message", e);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        onMessage={handleMessage}
        onLoadEnd={() => setIsMapReady(true)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        geolocationEnabled={true} // Enable Geolocation API in WebView
        renderLoading={() => <ActivityIndicator size="large" color="#007AFF" style={styles.loading} />}
        androidLayerType="hardware"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -10,
    marginTop: -10,
  }
});

export default LeafletMap;