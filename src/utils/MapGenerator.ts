import { Delaunay } from 'd3-delaunay';
import { createNoise2D } from 'simplex-noise';
import { type City, type Faction, type TerrainType } from '../store/WorldStore';

const WIDTH = 1000;
const HEIGHT = 800;
const POINT_COUNT = 300; // 较多的点以产生细致的地块

const FACTIONS = [
  { id: 'F_PLAYER', name: '玩家(大楚)', color: '#FF3333', isPlayer: true, targetCount: 10 },
  { id: 'F_AI1', name: '赵', color: '#3355FF', isPlayer: false, targetCount: 20 },
  { id: 'F_AI2', name: '宋', color: '#11AA66', isPlayer: false, targetCount: 15 },
  { id: 'F_AI3', name: '钱', color: '#DDAA11', isPlayer: false, targetCount: 25 },
  { id: 'F_AI4', name: '明', color: '#AA33AA', isPlayer: false, targetCount: 18 },
  { id: 'F_AI5', name: '越', color: '#33AADD', isPlayer: false, targetCount: 12 },
  { id: 'F_AI6', name: '秦', color: '#111111', isPlayer: false, targetCount: 30 },
  { id: 'F_AI7', name: '齐', color: '#FF8833', isPlayer: false, targetCount: 15 },
  { id: 'F_AI8', name: '燕', color: '#888888', isPlayer: false, targetCount: 15 },
];

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateWorld() {
  const noise2D = createNoise2D();
  
  // 1. 生成随机点位
  const points = Float64Array.from({ length: POINT_COUNT * 2 }, (_, i) => {
    return i % 2 === 0 ? Math.random() * WIDTH : Math.random() * HEIGHT;
  });
  
  // 2. 德劳内三角剖分与维诺图
  const delaunay = new Delaunay(points);
  const voronoi = delaunay.voronoi([0, 0, WIDTH, HEIGHT]);
  
  // 3. 构建 Cities
  interface PrepCity {
    id: string;
    x: number;
    y: number;
    terrain: TerrainType;
    polygon: [number, number][];
    adjacencies: string[];
    ownerId: string | null;
  }
  
  const rawCities: PrepCity[] = [];
  
  for (let i = 0; i < POINT_COUNT; i++) {
    const x = points[i * 2];
    const y = points[i * 2 + 1];
    
    // 多边形顶点
    const poly = voronoi.cellPolygon(i);
    if (!poly) continue; // 边缘点可能没闭合
    
    // 相邻性
    const neighborsGen = voronoi.neighbors(i);
    const adjacencies: string[] = [];
    for (const n of neighborsGen) {
      adjacencies.push(`C_${n}`);
    }
    
    // 地形生成 (以缩放噪声映射)
    const nv = noise2D(x / 300, y / 300); // -1 to 1
    let terrain: TerrainType = 'grass';
    if (nv < -0.3) terrain = 'water';
    else if (nv < -0.15) terrain = 'sand';
    else if (nv < 0.2) terrain = 'grass';
    else if (nv < 0.5) terrain = 'forest';
    else terrain = 'mountain';
    
    rawCities.push({
      id: `C_${i}`,
      x, y,
      terrain,
      polygon: poly,
      adjacencies,
      ownerId: null
    });
  }
  
  // 4. 国家领土接种 (BFS 算法分配)
  // 分别随机抽取起始点
  let availableIdx = new Set(rawCities.filter(c => c.terrain !== 'water').map(c => c.id));
  
  const citiesObj: Record<string, City> = {};
  rawCities.forEach(rc => {
    // 叛贼城给基础人口，不会是0
    const rebelPop = rc.terrain === 'water' ? 0 : getRandomInt(1000, 5000);
    citiesObj[rc.id] = {
      ...rc,
      name: `邑${rc.id.split('_')[1]}`,
      population: rebelPop,
      troops: Math.floor(rebelPop * 0.05),
      maxTroops: Math.floor(rebelPop * 0.3),
      defense: 2000,
      maxDefense: 2000,
      loyalty: 100,
      funds: 0,
      troopRecoveryRate: 0.10
    };
  });

  const factionsObj: Record<string, Faction> = {};

  // 先创建所有势力
  FACTIONS.forEach(fDef => {
    factionsObj[fDef.id] = {
      id: fDef.id,
      name: fDef.name,
      color: fDef.color,
      isPlayer: fDef.isPlayer,
      treasury: 0,
      taxRate: 'normal',
      farmBonusActive: false,
      militaryStrategy: fDef.isPlayer ? 'defend' : (['defend', 'raid', 'attack'][getRandomInt(0, 2)] as 'defend' | 'raid' | 'attack'),
      conscriptionPolicy: 'none',
      officers: [],
      relations: {},
      atWarWith: []
    };
    
    // 给随机找个陆地起点
    const availArr = Array.from(availableIdx);
    if (availArr.length === 0) return;
    const startId = availArr[Math.floor(Math.random() * availArr.length)];
    
    let allocated = 0;
    const queue = [startId];
    
    while(queue.length > 0 && allocated < fDef.targetCount) {
      const curId = queue.shift()!;
      if (!availableIdx.has(curId)) continue;
      
      // 占领
      availableIdx.delete(curId);
      citiesObj[curId].ownerId = fDef.id;
      allocated++;
      
      // 资源初始化
      const pop = getRandomInt(10000, 50000);
      citiesObj[curId].population = pop;
      citiesObj[curId].troops = Math.floor(pop * (getRandomInt(5, 15) / 100));
      citiesObj[curId].maxTroops = Math.floor(pop * 0.3);
      citiesObj[curId].loyalty = 100;
      factionsObj[fDef.id].treasury += getRandomInt(5000, 20000);
      
      // 扩散到相邻
      const neighbors = citiesObj[curId].adjacencies;
      for (const n of neighbors) {
        if (availableIdx.has(n) && !queue.includes(n) && citiesObj[n].terrain !== 'water') {
          queue.push(n);
        }
      }
    }
  });

  // 初始化各国间亲密度为 50（中立）
  const factionIds = Object.keys(factionsObj);
  factionIds.forEach(aId => {
    factionIds.forEach(bId => {
      if (aId !== bId) {
        factionsObj[aId].relations[bId] = 50;
      }
    });
  });

  return { cities: citiesObj, factions: factionsObj };
}
