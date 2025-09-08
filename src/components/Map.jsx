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
// --- 省份多边形组件 (无变化) ---
const ProvincePolygon = ({ feature, progressData, onProvinceClick, colorMode, globalWaterLat }) => {
  const provinceName = feature.properties.name;
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

  if (colorMode === 'single') {
    const provinceOwnProgress = progressData?.progress ?? 0;
    if (provinceOwnProgress <= 0) {
      return (
        <Polygon positions={fullPositions} pathOptions={{ color: `rgb(${lineRgb})`, weight: 0.5, fillColor: 'transparent' }} eventHandlers={{ click: () => onProvinceClick(feature), mouseover: e => e.target.bindTooltip(tooltipText, { className: 'custom-tooltip', permanent: false, sticky: true }).openTooltip(), mouseout: e => e.target.closeTooltip() }} />
      );
    }
    const minColor = [202, 240, 248], maxColor = [0, 180, 216];
    let p_remapped = 0; 
    if (provinceOwnProgress > 0.5) p_remapped = (provinceOwnProgress - 0.5) * 2;
    const p_final = Math.pow(p_remapped, 0.6);
    const interpolateColor = minColor.map((start, i) => Math.round(start + (maxColor[i] - start) * p_final));
    const fillColor = `rgb(${interpolateColor.join(',')})`;
    return (
      <Polygon positions={fullPositions} pathOptions={{ color: `rgb(${lineRgb})`, weight: 0.5, fillColor, fillOpacity: 1 }} eventHandlers={{ click: () => onProvinceClick(feature), mouseover: e => e.target.bindTooltip(tooltipText, { className: 'custom-tooltip', permanent: false, sticky: true }).openTooltip(), mouseout: e => e.target.closeTooltip() }} />
    );
  }

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
          <Polygon positions={waterPositions} pathOptions={{ color: 'transparent', weight: 0, fillColor: '#00b4d8', fillOpacity: 0.7 }} />
        )}
        <Polygon positions={fullPositions} pathOptions={{ color: `rgb(${lineRgb})`, weight: 0.5, fillColor: 'transparent' }} eventHandlers={{ click: () => onProvinceClick(feature), mouseover: e => e.target.bindTooltip(tooltipText, { className: 'custom-tooltip', permanent: false, sticky: true }).openTooltip(), mouseout: e => e.target.closeTooltip() }} />
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

  // ▼▼▼ 【核心修改】在这里为城市添加悬停事件 ▼▼▼
  const onEachCityFeature = (feature, layer) => {
    const name = feature.properties.name;
    
    // 绑定悬浮提示 (Tooltip)
    layer.bindTooltip(name, { className: 'custom-tooltip', permanent: false, follow: true, sticky: true });

    // 绑定所有事件监听
    layer.on({
      // 鼠标移入事件
      mouseover: (e) => {
        const currentLayer = e.target;
        // 仅当这个城市【未被】点亮时，才应用悬停效果
        if (!selectedCities.has(name)) {
          currentLayer.setStyle({
            fillOpacity: 0.4 // 设置一个半透明度作为高亮
          });
        }
      },
      // 鼠标移出事件
      mouseout: (e) => {
        const currentLayer = e.target;
        // 仅当这个城市【未被】点亮时，才恢复其样式
        if (!selectedCities.has(name)) {
          // 使用 resetStyle 可以安全地将其恢复到 <GeoJSON> 组件 style 属性定义的原始状态
          cityGeoJsonRef.current.resetStyle(currentLayer);
        }
      },
      // 点击事件 (保留原有逻辑)
      click: e => {
        e.target.closeTooltip();
        onCityClick(name);
      },
    });
  };
  // ▲▲▲ 【核心修改】结束 ▲▲▲

  return (
    <MapContainer center={[35, 105]} zoom={4} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
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
            // 初始样式：已点亮的城市有 0.6 的不透明度，未点亮的为 0
            fillOpacity: selectedCities.has(feature.properties.name) ? 0.6 : 0,
            fillColor: colorMode === 'single' ? '#48cae4' : getColorfulColor(feature.properties.name),
          })}
          onEachFeature={onEachCityFeature} // 应用我们修改过的事件处理器
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