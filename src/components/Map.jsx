import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, GeoJSON, useMap, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { scaleSequential } from 'd3-scale';
import { interpolateSinebow } from 'd3-scale-chromatic';
import * as turf from '@turf/turf';

// ==============================
// --- 辅助函数 (无变化) ---
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
// --- SVG 滤镜定义 (无变化) ---
const WaterFilter = () => (
  <svg style={{ display: 'none' }}>
    <defs>
      <filter id="waterWave">
        <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="1" result="turbulence" />
        <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="15" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  </svg>
);

// ==============================
// --- 缩放处理组件 (无变化) ---
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
const ProvincePolygon = ({ feature, progressData, onProvinceClick, colorMode, globalWaterLat }) => {
  const provinceName = feature.properties.name;
  const fullRef = useRef(null);
  const lineRgb = getComputedStyle(document.documentElement).getPropertyValue('--map-line-color-rgb').trim();

  let fullPositions = [];
  if (feature.geometry.type === 'Polygon') {
    fullPositions = L.GeoJSON.coordsToLatLngs(feature.geometry.coordinates, 1);
  } else if (feature.geometry.type === 'MultiPolygon') {
    fullPositions = feature.geometry.coordinates.map(polygon => L.GeoJSON.coordsToLatLngs(polygon, 1));
  }

  let tooltipText = provinceName;
  if (progressData && progressData.cities) {
    const totalCities = progressData.cities.size || 0;
    const visitedCities = [...progressData.cities.values()].filter(Boolean).length;
    if (totalCities > 0) {
      tooltipText += ` (${visitedCities}/${totalCities})`;
    }
  }


// ================== 单色模式优化 ==================
if (colorMode === 'single') {
  const provinceOwnProgress = progressData?.progress ?? 0;

  if (provinceOwnProgress <= 0) {
    // 未点亮地区完全不渲染
    return (
      <Polygon
        ref={fullRef}
        positions={fullPositions}
        pathOptions={{ color: `rgb(${lineRgb})`, weight: 0.5, fillColor: 'transparent', fillOpacity: 0 }}
        eventHandlers={{
          click: () => onProvinceClick(feature),
          mouseover: e => e.target.bindTooltip(tooltipText, { className: 'custom-tooltip', permanent: false, sticky: true }).openTooltip(),
          mouseout: e => e.target.closeTooltip(),
        }}
      />
    );
  }

  // 有进度省份颜色渐变
  const minColor = [230, 245, 255];  // 超淡蓝，非常低完成度
  const maxColor = [0, 180, 216];    // 最浓蓝，高完成度
  const interpolateColor = minColor.map((start, i) =>
    Math.round(start + (maxColor[i] - start) * provinceOwnProgress)
  );
  const fillColor = `rgb(${interpolateColor.join(',')})`;

  const pathOptions = {
    color: `rgb(${lineRgb})`,
    weight: 0.5,
    fillColor: fillColor,
    fillOpacity: 1, // 固定不透明度
  };

  return (
    <Polygon
      ref={fullRef}
      positions={fullPositions}
      pathOptions={pathOptions}
      eventHandlers={{
        click: () => onProvinceClick(feature),
        mouseover: e => e.target.bindTooltip(tooltipText, { className: 'custom-tooltip', permanent: false, sticky: true }).openTooltip(),
        mouseout: e => e.target.closeTooltip(),
      }}
    />
  );
}



  // ================== 彩色模式（全国统一水位） ==================
  if (colorMode === 'colorful') {
    let waterPositions = [];
    if (globalWaterLat > 20) {
      try {
        const bbox = turf.bbox(feature);
        const [minLng, minLat, maxLng, maxLat] = bbox;
        const waterLatForClipping = Math.min(globalWaterLat, maxLat);
        if (waterLatForClipping > minLat) {
          const clipBbox = [minLng, minLat, maxLng, waterLatForClipping];
          const clippedFeature = turf.bboxClip(feature, clipBbox);
          if (clippedFeature.geometry.type === 'Polygon') {
            waterPositions = L.GeoJSON.coordsToLatLngs(clippedFeature.geometry.coordinates, 1);
          } else if (clippedFeature.geometry.type === 'MultiPolygon') {
            waterPositions = clippedFeature.geometry.coordinates.map(p => L.GeoJSON.coordsToLatLngs(p, 1));
          }
        }
      } catch (e) { console.error('Province water clip error:', provinceName, e); }
    }

    return (
      <>
        {waterPositions.length > 0 && (
          <Polygon
            positions={waterPositions}
            pathOptions={{ color: 'transparent', weight: 0, fillColor: 'rgba(0,180,216,1)', fillOpacity: 1 }}
          />
        )}
        <Polygon
          ref={fullRef}
          positions={fullPositions}
          pathOptions={{ color: `rgb(${lineRgb})`, weight: 0.5, fillColor: 'transparent' }}
          eventHandlers={{
            click: () => onProvinceClick(feature),
            mouseover: e => e.target.bindTooltip(tooltipText, { className: 'custom-tooltip', permanent: false, sticky: true }).openTooltip(),
            mouseout: e => e.target.closeTooltip(),
          }}
        />
      </>
    );
  }

  return null;
};

// ==============================
// --- 主 Map 组件 ---
function Map({
  cityGeojsonData, provinceGeojsonData, selectedCities, setCityLayers,
  onCityClick, onProvinceClick, colorMode, provinceProgress, onMapLoad,
  isZoomSwitchEnabled, globalWaterLat
}) {
  const [activeLayer, setActiveLayer] = useState('city');
  const cityGeoJsonRef = useRef(null);
  const ZOOM_THRESHOLD = 5;

  function MapInstanceSetter() {
    const map = useMap();
    useEffect(() => { if (map) onMapLoad(map); }, [map]);
    return null;
  }

  useEffect(() => {
    if (activeLayer === 'city' && cityGeoJsonRef.current) {
      const layersMap = {};
      cityGeoJsonRef.current.eachLayer(layer => { layersMap[layer.feature.properties.name] = layer; });
      setCityLayers(layersMap);
    } else {
      setCityLayers({});
    }
  }, [activeLayer, cityGeojsonData, setCityLayers]);

  const onEachCityFeature = (feature, layer) => {
    const name = feature.properties.name;
    layer.bindTooltip(name, { className: 'custom-tooltip', permanent: false, follow: true, sticky: true });
    layer.on({ click: e => { e.target.closeTooltip(); onCityClick(name); } });
  };

  return (
    <MapContainer center={[35, 105]} zoom={4} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
      <WaterFilter />
      <MapInstanceSetter />
      <ZoomHandler setActiveLayer={setActiveLayer} ZOOM_THRESHOLD={ZOOM_THRESHOLD} isZoomSwitchEnabled={isZoomSwitchEnabled} />
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
            fillColor: colorMode === 'single' ? '#48cae4' : getColorfulColor(feature.properties.name),
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
              globalWaterLat={globalWaterLat}
            />
          ))}
        </>
      )}
    </MapContainer>
  );
}

export default Map;
