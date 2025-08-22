// src/components/Map.jsx

import React, { useEffect, useRef } from 'react';
import { MapContainer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { scaleSequential } from 'd3-scale';
import { interpolateSinebow } from 'd3-scale-chromatic';

const colorScale = scaleSequential(interpolateSinebow);

function getColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const normalized = (Math.abs(hash) % 1000) / 1000;
  return colorScale(normalized);
}

function Map({ geojsonData, selectedCities, setCityLayers, onCityClick }) {
  const geoJsonRef = useRef(null);

  useEffect(() => {
    if (geojsonData && geoJsonRef.current) {
      const layersMap = {};
      geoJsonRef.current.eachLayer(layer => {
        const name = layer.feature.properties.name;
        layersMap[name] = layer;
      });
      setCityLayers(layersMap);
    }
  }, [geojsonData, setCityLayers]);

  const onEachFeature = (feature, layer) => {
    const name = feature.properties.name;
    layer.bindTooltip(name, { className: 'custom-tooltip', permanent: false, follow: true, sticky: true });
    layer.on({
      mouseover: () => {
        if (!selectedCities.has(name)) layer.setStyle({ fillOpacity: 0.3 });
        layer.openTooltip();
      },
      mouseout: () => {
        if (!selectedCities.has(name)) layer.setStyle({ fillOpacity: 0 });
        layer.closeTooltip();
      },
      click: (e) => {
        e.target.closeTooltip();
        onCityClick(name);
      }
    });
  };

  return (
    <MapContainer 
      center={[35, 105]} 
      zoom={4} 
      style={{ height: '100%', width: '100%' }} 
      zoomControl={false}
      attributionControl={false}
    >
      {geojsonData && (
        <GeoJSON
          ref={geoJsonRef}
          key={JSON.stringify(geojsonData) + [...selectedCities].join(',')}
          data={geojsonData}
          style={feature => ({
            color: `rgb(var(--map-line-color-rgb))`, 
            weight: 0.6,
            fillOpacity: selectedCities.has(feature.properties.name) ? 0.6 : 0,
            fillColor: getColor(feature.properties.name)
          })}
          onEachFeature={onEachFeature}
        />
      )}
    </MapContainer>
  );
}

export default Map;