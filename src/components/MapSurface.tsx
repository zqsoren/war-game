import { useRef, useEffect, useState } from 'react';
import { useWorldStore } from '../store/WorldStore';

const TERRAIN_COLORS: Record<string, string> = {
  water: '#1a3a5c',
  sand: '#7a6e4d',
  grass: '#354a35',
  forest: '#1e3520',
  mountain: '#3e3830',
};

function generatePathString(polygon: [number, number][]) {
  if (!polygon || polygon.length === 0) return '';
  return polygon.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt[0]} ${pt[1]}`).join(' ') + ' Z';
}

export default function MapSurface() {
  const cities = useWorldStore(state => state.cities);
  const factions = useWorldStore(state => state.factions);
  const selectedCityId = useWorldStore(state => state.selectedCityId);
  const mapViewMode = useWorldStore(state => state.mapViewMode);
  const marchingArmies = useWorldStore(state => state.marchingArmies);
  const setSelectedCity = useWorldStore(state => state.setSelectedCity);

  const svgRef = useRef<SVGSVGElement>(null);

  const [, setFrame] = useState(0);
  useEffect(() => {
    let raf: number;
    const loop = () => { setFrame(f => f + 1); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleCityClick = (cityId: string) => {
    const city = cities[cityId];
    if (!city || city.terrain === 'water') return;
    setSelectedCity(cityId);
  };

  const isAttackable = (cityId: string): boolean => {
    const city = cities[cityId];
    if (!city || city.terrain === 'water' || city.ownerId === 'F_PLAYER') return false;
    return city.adjacencies.some(adjId => cities[adjId]?.ownerId === 'F_PLAYER');
  };

  const now = Date.now();

  return (
    <svg className="map-svg" viewBox="0 0 1000 800" ref={svgRef} style={{ background: TERRAIN_COLORS.water }}>
      <g>
        {Object.values(cities).map(city => {
          let fillAttr = TERRAIN_COLORS.grass;
          let opacityAttr = 1;

          if (mapViewMode === 'terrain') {
            fillAttr = TERRAIN_COLORS[city.terrain] || '#354a35';
            if (city.ownerId && city.terrain !== 'water') opacityAttr = 0.9;
          } else {
            // 势力视图：直接使用莫兰迪配色
            if (city.terrain === 'water') fillAttr = TERRAIN_COLORS.water;
            else if (city.ownerId && factions[city.ownerId]) fillAttr = factions[city.ownerId].color;
            else fillAttr = '#222222';
          }

          const isSelected = selectedCityId === city.id;
          const canAttack = isAttackable(city.id);

          return (
            <path
              key={city.id}
              className={`map-polygon ${isSelected ? 'selected' : ''} ${canAttack ? 'attackable' : ''} ${city.hasMilitaryBase ? 'military-base' : ''}`}
              d={generatePathString(city.polygon)}
              fill={fillAttr}
              fillOpacity={opacityAttr}
              onClick={() => handleCityClick(city.id)}
            >
              <title>
                {city.name} {city.ownerId ? `(${factions[city.ownerId]?.name || '无主'})` : ''}
                {'\n'}人口: {city.population.toLocaleString()} | 兵: {city.troops.toLocaleString()} | 民心: {city.loyalty}
                {canAttack ? '\n🗡️ 可进攻' : ''}
              </title>
            </path>
          );
        })}

        {/* 城市标记 */}
        {Object.values(cities).map(city => {
          if (city.terrain === 'water') return null;
          const isSelected = selectedCityId === city.id;
          const isPlayer = city.ownerId === 'F_PLAYER';

          return (
            <g key={`m_${city.id}`} style={{ pointerEvents: 'none' }}>
              <circle cx={city.x} cy={city.y} r={isSelected ? 5 : isPlayer ? 3.5 : 2}
                fill={isPlayer ? '#FFD700' : city.ownerId ? '#ccc' : '#555'} opacity={0.9} />
              {(isSelected || isPlayer) && (
                <text x={city.x} y={city.y - 8} fontSize={isSelected ? 11 : 9}
                  fill={isSelected ? '#FFD700' : 'rgba(255,255,255,0.7)'}
                  textAnchor="middle" fontWeight={isSelected ? 'bold' : 'normal'}
                  stroke="rgba(0,0,0,0.6)" strokeWidth={isSelected ? 2.5 : 2} paintOrder="stroke">
                  {city.name}
                </text>
              )}
              {city.hasMilitaryBase && (
                <text x={city.x + 8} y={city.y + 4} fontSize={10} textAnchor="start" pointerEvents="none">
                  🏕️
                </text>
              )}
            </g>
          );
        })}

        {/* 行军动画 — 增强可见性 */}
        {marchingArmies.map(army => {
          const from = cities[army.fromCityId];
          const to = cities[army.toCityId];
          if (!from || !to) return null;

          const totalTime = army.arriveTime - army.departTime;
          const elapsed = now - army.departTime;
          const progress = Math.min(1, Math.max(0, elapsed / totalTime));

          const cx = from.x + (to.x - from.x) * progress;
          const cy = from.y + (to.y - from.y) * progress;

          const faction = factions[army.ownerId];
          const color = faction?.color || '#fff';
          const isPlayer = army.ownerId === 'F_PLAYER';

          return (
            <g key={army.id} style={{ pointerEvents: 'none' }}>
              {/* 路线线 — 高亮 */}
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={color} strokeWidth={army.isTransfer ? 1.5 : 2}
                strokeDasharray={army.isTransfer ? '3 5' : '5 4'}
                opacity={0.7} />
              {/* 外圈光晕 */}
              <circle cx={cx} cy={cy} r={isPlayer ? 10 : 8} fill={color} opacity={0.15}>
                <animate attributeName="r" values={isPlayer ? "10;14;10" : "8;11;8"} dur="1.2s" repeatCount="indefinite" />
              </circle>
              {/* 行军点 */}
              <circle cx={cx} cy={cy} r={isPlayer ? 5 : 4} fill={color} opacity={1} stroke="#000" strokeWidth={1}>
                <animate attributeName="r" values={isPlayer ? "5;7;5" : "4;5;4"} dur="1s" repeatCount="indefinite" />
              </circle>
              {/* 兵力数字 — 带描边背景 */}
              <text x={cx} y={cy - 12} fontSize={10} fill="#fff" textAnchor="middle" fontWeight="bold"
                stroke="rgba(0,0,0,0.8)" strokeWidth={2.5} paintOrder="stroke">
                {army.isTransfer ? '📦' : '⚔'} {army.troops.toLocaleString()}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
