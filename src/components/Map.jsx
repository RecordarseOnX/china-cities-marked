// src/components/Map.jsx

import React, { useEffect, useRef } from 'react';
import { MapContainer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { scaleSequential } from 'd3-scale';
import { interpolateSinebow } from 'd3-scale-chromatic';

// 创建多彩颜色比例尺
const colorScale = scaleSequential(interpolateSinebow);

// 多彩模式的颜色生成函数
function getColorfulColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const normalized = (Math.abs(hash) % 1000) / 1000;
  return colorScale(normalized);
}

// Map 组件接收一个新的 colorMode prop
function Map({ geojsonData, selectedCities, setCityLayers, onCityClick, colorMode }) {
  const geoJsonRef = useRef(null);
  
  // 根据 CSS 变量来决定线条颜色，这样能自动适应深色/浅色模式
  const lineRgb = getComputedStyle(document.documentElement).getPropertyValue('--map-line-color-rgb').trim();

  // 将 leaflet layer 实例映射到 state
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

  // 为每个城市图层绑定事件
  const onEachFeature = (feature, layer) => {
    const name = feature.properties.name;
    layer.bindTooltip(name, { className: 'custom-tooltip', permanent: false, follow: true, sticky: true });

    layer.on({
      mouseover: () => {
        const isSelected = selectedCities.has(name);
        // 【关键交互】如果是单色模式且城市已被选中，鼠标移入时加深颜色
        if (colorMode === 'single' && isSelected) {
          layer.setStyle({ fillColor: '#00b4d8' }); // 使用加深后的颜色
        } else if (!isSelected) {
          // 对于未选中的城市，无论何种模式，都显示半透明预览
          layer.setStyle({ fillOpacity: 0.3 });
        }
        layer.openTooltip();
      },
      mouseout: () => {
        const isSelected = selectedCities.has(name);
        // 【关键交互】如果是单色模式且城市已被选中，鼠标移出时恢复原色
        if (colorMode === 'single' && isSelected) {
          layer.setStyle({ fillColor: '#48cae4' }); // 恢复为基础单色
        } else if (!isSelected) {
          // 对于未选中的城市，恢复透明
          layer.setStyle({ fillOpacity: 0 });
        }
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
          key={JSON.stringify(geojsonData) + [...selectedCities].join(',') + colorMode} // 将 colorMode 加入 key
          data={geojsonData}
          style={feature => ({
            color: `rgb(${lineRgb})`,
            weight: 0.5,
            fillOpacity: selectedCities.has(feature.properties.name) ? 0.6 : 0,
            // 【关键逻辑】根据 colorMode 决定填充色
            fillColor: colorMode === 'single' 
              ? '#48cae4' // 单色模式
              : getColorfulColor(feature.properties.name) // 多彩模式
          })}
          onEachFeature={onEachFeature}
        />
      )}
    </MapContainer>
  );
}

export default Map;