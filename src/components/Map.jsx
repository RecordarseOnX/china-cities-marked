import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, GeoJSON, useMap, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { scaleSequential } from 'd3-scale';
import { interpolateSinebow } from 'd3-scale-chromatic';
import * as turf from '@turf/turf';

// ==============================
// --- 辅助函数 ---
// ==============================
const colorScale = scaleSequential(interpolateSinebow);

function getColorfulColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const normalized = (Math.abs(hash) % 1000) / 1000;
  return colorScale(normalized);
}

// ==============================
// --- SVG 滤镜定义 ---
// ==============================
const WaterFilter = () => {
  return (
    <svg style={{ display: 'none' }}>
      <defs>
        <filter id="waterWave">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02"
            numOctaves="1"
            result="turbulence"
          >
            <animate
              attributeName="baseFrequency"
              from="0.02"
              to="0.05"
              dur="3s"
              repeatCount="indefinite"
              values="0.02;0.05;0.03;0.05;0.02"
              keyTimes="0;0.25;0.5;0.75;1"
            />
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="turbulence"
            scale="15"
            xChannelSelector="R"
            yChannelSelector="G"
          >
            <animate
              attributeName="scale"
              from="10"
              to="20"
              dur="3s"
              repeatCount="indefinite"
              values="10;20;15;20;10"
              keyTimes="0;0.25;0.5;0.75;1"
            />
          </feDisplacementMap>
        </filter>
      </defs>
    </svg>
  );
};

// ==============================
// --- 缩放处理组件 ---
// ==============================
function ZoomHandler({ setActiveLayer, ZOOM_THRESHOLD, isZoomSwitchEnabled }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const handleZoomEnd = () => {
      if (!isZoomSwitchEnabled) return;
      const currentZoom = map.getZoom();
      setActiveLayer(prev => {
        if (currentZoom < ZOOM_THRESHOLD && prev !== 'province') return 'province';
        if (currentZoom >= ZOOM_THRESHOLD && prev !== 'city') return 'city';
        return prev;
      });
    };

    const initialOrToggleCheck = () => {
      if (isZoomSwitchEnabled) {
        const currentZoom = map.getZoom();
        setActiveLayer(currentZoom < ZOOM_THRESHOLD ? 'province' : 'city');
      } else {
        setActiveLayer('city');
      }
    };

    initialOrToggleCheck();
    map.on('zoomend', handleZoomEnd);

    return () => map.off('zoomend', handleZoomEnd);
  }, [map, setActiveLayer, ZOOM_THRESHOLD, isZoomSwitchEnabled]);

  return null;
}

// ==============================
// --- 省份多边形组件 ---
// ==============================
const ProvincePolygon = ({ feature, progressData, onProvinceClick, colorMode }) => {
  const provinceName = feature.properties.name;
  const progress = progressData?.progress || 0;
  const fullRef = useRef(null);
  const waterRef = useRef(null);

  const lineRgb = getComputedStyle(document.documentElement)
    .getPropertyValue('--map-line-color-rgb')
    .trim();

  // 处理 full Polygon / MultiPolygon positions
  let fullPositions = [];
  if (feature.geometry.type === 'Polygon') {
    fullPositions = L.GeoJSON.coordsToLatLngs(feature.geometry.coordinates, 1);
  } else if (feature.geometry.type === 'MultiPolygon') {
    fullPositions = feature.geometry.coordinates.map(polygon =>
      L.GeoJSON.coordsToLatLngs(polygon, 1)
    );
  }

  const eventHandlers = {
    mouseover: e => {
      e.target.bringToFront();
      e.target.bindTooltip(provinceName, {
        className: 'custom-tooltip',
        permanent: false,
        sticky: true,
      }).openTooltip();
      // 如果是水位模式且水位未满，添加水面波动滤镜
      if (colorMode !== 'single' && progress < 1 && waterRef.current && waterRef.current._path) {
        waterRef.current._path.style.filter = 'url(#waterWave)';
      }
    },
    mouseout: e => {
      e.target.closeTooltip();
      // 如果是水位模式，移除水面波动滤镜
      if (colorMode !== 'single' && waterRef.current && waterRef.current._path) {
        waterRef.current._path.style.filter = 'none';
      }
    },
    click: () => onProvinceClick(feature),
  };

  if (colorMode === 'single') {
    // 浓度模式（原版）
    const fillColor = progress > 0 ? `rgba(0, 180, 216, ${progress})` : 'transparent';

    return (
      <Polygon
        positions={fullPositions}
        pathOptions={{
          color: `rgb(${lineRgb})`,
          weight: 0.5,
          fillColor,
          fillOpacity: 1,
        }}
        eventHandlers={eventHandlers}
      />
    );
  } else {
    // 水位模式
    let waterPositions = [];
    if (progress > 0) {
      try {
        const bbox = turf.bbox(feature);
        const [minLng, minLat, maxLng, maxLat] = bbox;
        const waterLat = minLat + progress * (maxLat - minLat);
        const clipBbox = [minLng, minLat, maxLng, waterLat];
        const clippedFeature = turf.bboxClip(feature, clipBbox);

        if (clippedFeature.geometry.type === 'Polygon') {
          waterPositions = L.GeoJSON.coordsToLatLngs(clippedFeature.geometry.coordinates, 1);
        } else if (clippedFeature.geometry.type === 'MultiPolygon') {
          waterPositions = clippedFeature.geometry.coordinates.map(polygon =>
            L.GeoJSON.coordsToLatLngs(polygon, 1)
          );
        }
      } catch (e) {
        console.error('Error clipping province:', e);
        // Fallback to no water if clipping fails
      }
    }

    return (
      <>
        {/* 水位填充层 */}
        {progress > 0 && waterPositions.length > 0 && (
          <Polygon
            ref={waterRef}
            positions={waterPositions}
            pathOptions={{
              color: 'transparent',
              weight: 0,
              fillColor: 'rgba(0, 180, 216, 1)',
              fillOpacity: 1,
            }}
          />
        )}
        {/* 省份边框层 */}
        <Polygon
          ref={fullRef}
          positions={fullPositions}
          pathOptions={{
            color: `rgb(${lineRgb})`,
            weight: 0.5,
            fillColor: 'transparent',
            fillOpacity: 1,
          }}
          eventHandlers={eventHandlers}
        />
      </>
    );
  }
};

// ==============================
// --- 主 Map 组件 ---
// ==============================
function Map({
  cityGeojsonData,
  provinceGeojsonData,
  selectedCities,
  setCityLayers,
  onCityClick,
  onProvinceClick,
  colorMode,
  provinceProgress,
  onMapLoad,
  isZoomSwitchEnabled,
}) {
  const [activeLayer, setActiveLayer] = useState('city');
  const cityGeoJsonRef = useRef(null);
  const ZOOM_THRESHOLD = 5;

  // --- Map 实例绑定 ---
  function MapInstanceSetter() {
    const map = useMap();
    useEffect(() => {
      if (map) onMapLoad(map);
    }, [map]);
    return null;
  }

  // --- 更新城市图层引用 ---
  useEffect(() => {
    if (activeLayer === 'city' && cityGeoJsonRef.current) {
      const layersMap = {};
      cityGeoJsonRef.current.eachLayer(layer => {
        layersMap[layer.feature.properties.name] = layer;
      });
      setCityLayers(layersMap);
    } else {
      setCityLayers({});
    }
  }, [activeLayer, cityGeojsonData, setCityLayers]);

  // --- 城市 feature 事件绑定 ---
  const onEachCityFeature = (feature, layer) => {
    const name = feature.properties.name;

    layer.bindTooltip(name, {
      className: 'custom-tooltip',
      permanent: false,
      follow: true,
      sticky: true,
    });

    layer.on({
      mouseover: () => {
        const isSelected = selectedCities.has(name);
        if (colorMode === 'single' && isSelected) {
          layer.setStyle({ fillColor: '#00b4d8' });
        } else if (!isSelected) {
          layer.setStyle({ fillOpacity: 0.3 });
        }
        layer.openTooltip();
      },
      mouseout: () => {
        const isSelected = selectedCities.has(name);
        if (colorMode === 'single' && isSelected) {
          layer.setStyle({ fillColor: '#48cae4' });
        } else if (!isSelected) {
          layer.setStyle({ fillOpacity: 0 });
        }
        layer.closeTooltip();
      },
      click: e => {
        e.target.closeTooltip();
        onCityClick(name);
      },
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
      <WaterFilter />
      <MapInstanceSetter />
      <ZoomHandler
        setActiveLayer={setActiveLayer}
        ZOOM_THRESHOLD={ZOOM_THRESHOLD}
        isZoomSwitchEnabled={isZoomSwitchEnabled}
      />

      {/* 城市层 */}
      {cityGeojsonData && (!isZoomSwitchEnabled || activeLayer === 'city') && (
        <GeoJSON
          ref={cityGeoJsonRef}
          key={'city-' + [...selectedCities].join(',') + colorMode}
          data={cityGeojsonData}
          style={feature => ({
            color: `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--map-line-color-rgb').trim()})`,
            weight: 0.5,
            fillOpacity: selectedCities.has(feature.properties.name) ? 0.6 : 0,
            fillColor:
              colorMode === 'single'
                ? '#48cae4'
                : getColorfulColor(feature.properties.name),
          })}
          onEachFeature={onEachCityFeature}
        />
      )}

      {/* 省份层 */}
      {provinceGeojsonData && isZoomSwitchEnabled && activeLayer === 'province' && (
        <>
          {provinceGeojsonData.features.map((feature, index) => (
            <ProvincePolygon
              key={`${feature.properties.name}-${index}`}
              feature={feature}
              progressData={provinceProgress.get(feature.properties.name)}
              onProvinceClick={onProvinceClick}
              colorMode={colorMode}
            />
          ))}
        </>
      )}
    </MapContainer>
  );
}

export default Map;