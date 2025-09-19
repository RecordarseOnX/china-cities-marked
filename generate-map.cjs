// generate-map.cjs
const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');

console.log("🚀 开始生成省市映射文件...");

try {
  // 指向你的 public 文件夹
  const publicDir = path.join(__dirname, 'public');
  const cityPath = path.join(publicDir, '中国_市.geojson');
  const provincePath = path.join(publicDir, '中国_省.geojson');
  const outputPath = path.join(publicDir, 'province-city-map.json');

  // 读取原始地理文件
  console.log("读取 GeoJSON 文件...");
  const cityData = JSON.parse(fs.readFileSync(cityPath, 'utf-8'));
  const provinceData = JSON.parse(fs.readFileSync(provincePath, 'utf-8'));

  const provinceToCitiesMap = new Map();

  // 执行一次性的、耗时的计算
  console.log("⏳ 开始进行地理空间计算... (这可能需要几秒钟)");
  for (const cityFeature of cityData.features) {
    const cityCentroid = turf.centroid(cityFeature); 
    for (const provinceFeature of provinceData.features) {
      if (turf.booleanPointInPolygon(cityCentroid, provinceFeature)) {
        const provinceName = provinceFeature.properties.name;
        const cityName = cityFeature.properties.name;
        if (!provinceToCitiesMap.has(provinceName)) {
          provinceToCitiesMap.set(provinceName, []);
        }
        provinceToCitiesMap.get(provinceName).push(cityName);
        break; 
      }
    }
  }

  // 将 Map 转换为可以存成 JSON 的数组格式
  const mapArray = Array.from(provinceToCitiesMap.entries());

  // 将最终结果写入到 public 文件夹下的新文件中
  fs.writeFileSync(outputPath, JSON.stringify(mapArray, null, 2));

  console.log(`\n✅ 成功！`);
  console.log(`映射文件已生成于: ${outputPath}`);
  console.log(`共处理了 ${cityData.features.length} 个城市，映射到 ${provinceToCitiesMap.size} 个省份。`);

} catch (error) {
  console.error("❌ 生成映射文件时发生错误:", error);
}