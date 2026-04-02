import { create } from 'zustand';

// ========================
// 类型定义
// ========================

export interface Faction {
  id: string;
  name: string;
  color: string;
  isPlayer: boolean;

  treasury: number;
  taxRate: 'low' | 'normal' | 'high';
  farmBonusActive: boolean;

  militaryStrategy: 'defend' | 'raid' | 'attack';
  conscriptionPolicy: 'none' | 'normal';

  officers: Officer[];

  // 亲密度：key = 对方 factionId，value = 0~100
  relations: Record<string, number>;

  // 战争状态
  atWarWith: string[];
}

export interface Officer {
  id: string;
  name: string;
  ambition: number;
  intelligence: number;
  command: number;
  loyalty: number;
  assignedCityId: string | null;
}

export type TerrainType = 'water' | 'sand' | 'grass' | 'forest' | 'mountain';

export interface City {
  id: string;
  name: string;
  ownerId: string | null;

  x: number;
  y: number;
  terrain: TerrainType;
  polygon: [number, number][];
  adjacencies: string[];

  population: number;
  troops: number;
  maxTroops: number;
  defense: number;
  maxDefense: number;
  loyalty: number;
  funds: number;
  troopRecoveryRate: number;
  hasMilitaryBase?: boolean; // 是否建有军镇
}

export interface MarchingArmy {
  id: string;
  fromCityId: string;
  toCityId: string;
  ownerId: string;
  troops: number;
  departTime: number;
  arriveTime: number;
  isPlayerOrder: boolean;
  isTransfer: boolean;
}

// 外交事件
export type DiplomacyEventType = 'marriage' | 'tribute' | 'envoy' | 'war_declaration' | 'peace_request' | 'betray';

export interface DiplomaticEvent {
  id: string;
  type: DiplomacyEventType;
  fromFactionId: string;
  toFactionId: string;
  status: 'pending' | 'accepted' | 'rejected';
  payload?: { gold?: number; message?: string };
  createdAt: { eraYear: number; eraMonth: number };
}

export interface GameLog {
  id: string;
  eraYear: number;
  eraMonth: number;
  timestamp: number;
  message: string;
  type: 'info' | 'economy' | 'military' | 'disaster' | 'diplomacy';
}

export interface WorldState {
  eraYear: number;
  eraMonth: number;
  lastTickTime: number;
  isPaused: boolean;
  gameSpeed: number;

  factions: Record<string, Faction>;
  cities: Record<string, City>;
  marchingArmies: MarchingArmy[];
  logs: GameLog[];
  diplomaticEvents: DiplomaticEvent[];

  // UI 控制
  selectedCityId: string | null;
  mapViewMode: 'political' | 'terrain';
  attackTargetId: string | null;
  showDeployModal: boolean;
  transferTargetId: string | null;
  showTransferModal: boolean;
  leftPanelTab: 'hub' | 'diplomacy'; // 中枢 / 鸿胪寺

  // 方法
  initWorld: (cities: Record<string, City>, factions: Record<string, Faction>) => void;
  addLog: (log: Omit<GameLog, 'id' | 'timestamp'>) => void;
  setSelectedCity: (cityId: string | null) => void;
  setMapViewMode: (mode: 'political' | 'terrain') => void;
  renameCity: (cityId: string, newName: string) => void;
  updatePolicy: (factionId: string, updates: Partial<Faction>) => void;
  cityAction: (cityId: string, actionType: 'relief' | 'repair' | 'forceDraft') => void;
  buildMilitaryBase: (cityId: string) => void;

  setAttackTarget: (cityId: string | null) => void;
  setShowDeployModal: (show: boolean) => void;
  setTransferTarget: (cityId: string | null) => void;
  setShowTransferModal: (show: boolean) => void;
  dispatchArmy: (fromCityId: string, toCityId: string, troops: number, isTransfer?: boolean) => void;

  // 战争
  declareWar: (factionAId: string, factionBId: string) => void;
  isAtWar: (factionAId: string, factionBId: string) => boolean;
  makePeace: (factionAId: string, factionBId: string) => void;

  // 外交
  changeRelation: (factionAId: string, factionBId: string, delta: number) => void;
  getRelation: (factionAId: string, factionBId: string) => number;
  addDiplomaticEvent: (event: Omit<DiplomaticEvent, 'id'>) => void;
  respondToEvent: (eventId: string, accept: boolean) => void;
  sendDiplomaticAction: (type: DiplomacyEventType, targetFactionId: string) => void;

  // 存档
  saveGame: () => void;
  loadGame: () => boolean;
}

function genId() {
  return Math.random().toString(36).substring(2, 10);
}

export function cityDistance(a: City, b: City): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

const MARCH_SPEED = 1.67;

export function calcTravelTime(dist: number): number {
  return Math.max(3000, (dist / MARCH_SPEED) * 1000);
}

// 亲密度变化值
const RELATION_DELTA: Record<string, number> = {
  marriage_accept: 15,
  marriage_reject: -5,
  tribute_accept: 10,
  tribute_reject: -3,
  envoy_accept: 5,
  envoy_reject: -2,
  war_declaration: -30,
  attack: -10,
  peace_accept: 20,
  peace_reject: -5,
  betray: -50,
};

// 外交操作金费
const DIPLO_COST: Record<string, number> = {
  marriage: 5000,
  tribute: 3000,
  envoy: 500,
};

export const useWorldStore = create<WorldState>((set, get) => ({
  eraYear: 1,
  eraMonth: 1,
  lastTickTime: Date.now(),
  isPaused: false,
  gameSpeed: 1,

  factions: {},
  cities: {},
  marchingArmies: [],
  logs: [],
  diplomaticEvents: [],

  selectedCityId: null,
  mapViewMode: 'terrain',
  attackTargetId: null,
  showDeployModal: false,
  transferTargetId: null,
  showTransferModal: false,
  leftPanelTab: 'hub',

  initWorld: (cities, factions) => set({
    cities, factions,
    marchingArmies: [],
    diplomaticEvents: [],
    eraYear: 1, eraMonth: 1,
    logs: [{
      id: genId(), eraYear: 1, eraMonth: 1,
      timestamp: Date.now(),
      message: '天下大势，合久必分。新的纪元开始了。',
      type: 'info'
    }]
  }),

  addLog: (logPayload) => set((state) => ({
    logs: [{
      ...logPayload, id: genId(), timestamp: Date.now()
    }, ...state.logs].slice(0, 200)
  })),

  setSelectedCity: (id) => set({ selectedCityId: id }),
  setMapViewMode: (mode) => set({ mapViewMode: mode }),

  renameCity: (cityId, newName) => set((state) => {
    const city = state.cities[cityId];
    if (!city || city.ownerId !== 'F_PLAYER') return state;
    const trimmed = newName.trim().slice(0, 20);
    if (!trimmed) return state;
    return { cities: { ...state.cities, [cityId]: { ...city, name: trimmed } } };
  }),

  updatePolicy: (factionId, updates) => set((state) => {
    const faction = state.factions[factionId];
    if (!faction) return state;
    return { factions: { ...state.factions, [factionId]: { ...faction, ...updates } } };
  }),

  setAttackTarget: (cityId) => set({ attackTargetId: cityId }),
  setShowDeployModal: (show) => set({ showDeployModal: show }),
  setTransferTarget: (cityId) => set({ transferTargetId: cityId }),
  setShowTransferModal: (show) => set({ showTransferModal: show }),

  // ======== 亲密度 ========
  changeRelation: (factionAId, factionBId, delta) => set((state) => {
    const fA = state.factions[factionAId];
    const fB = state.factions[factionBId];
    if (!fA || !fB) return state;
    const curA = fA.relations[factionBId] ?? 50;
    const curB = fB.relations[factionAId] ?? 50;
    return {
      factions: {
        ...state.factions,
        [factionAId]: { ...fA, relations: { ...fA.relations, [factionBId]: Math.max(0, Math.min(100, curA + delta)) } },
        [factionBId]: { ...fB, relations: { ...fB.relations, [factionAId]: Math.max(0, Math.min(100, curB + delta)) } },
      }
    };
  }),

  getRelation: (factionAId, factionBId) => {
    const fA = get().factions[factionAId];
    return fA ? (fA.relations[factionBId] ?? 50) : 50;
  },

  // ======== 宣战/停战 ========
  declareWar: (factionAId, factionBId) => set((state) => {
    const fA = state.factions[factionAId];
    const fB = state.factions[factionBId];
    if (!fA || !fB) return state;
    if (fA.atWarWith.includes(factionBId)) return state;
    return {
      factions: {
        ...state.factions,
        [factionAId]: { ...fA, atWarWith: [...fA.atWarWith, factionBId] },
        [factionBId]: { ...fB, atWarWith: [...fB.atWarWith, factionAId], militaryStrategy: 'attack' },
      }
    };
  }),

  isAtWar: (factionAId, factionBId) => {
    const fA = get().factions[factionAId];
    return fA ? fA.atWarWith.includes(factionBId) : false;
  },

  makePeace: (factionAId, factionBId) => set((state) => {
    const fA = state.factions[factionAId];
    const fB = state.factions[factionBId];
    if (!fA || !fB) return state;
    return {
      factions: {
        ...state.factions,
        [factionAId]: { ...fA, atWarWith: fA.atWarWith.filter(id => id !== factionBId) },
        [factionBId]: { ...fB, atWarWith: fB.atWarWith.filter(id => id !== factionAId) },
      }
    };
  }),

  // ======== 外交事件 ========
  addDiplomaticEvent: (event) => set((state) => ({
    diplomaticEvents: [{ ...event, id: genId() }, ...state.diplomaticEvents]
  })),

  respondToEvent: (eventId, accept) => {
    const state = get();
    const event = state.diplomaticEvents.find(e => e.id === eventId);
    if (!event || event.status !== 'pending') return;

    const newStatus = accept ? 'accepted' : 'rejected';

    set(s => ({
      diplomaticEvents: s.diplomaticEvents.map(e =>
        e.id === eventId ? { ...e, status: newStatus } : e
      )
    }));

    // 亲密度影响
    const key = `${event.type}_${accept ? 'accept' : 'reject'}`;
    const delta = RELATION_DELTA[key] || 0;
    if (delta !== 0) get().changeRelation(event.fromFactionId, event.toFactionId, delta);

    // 特殊行为
    if (event.type === 'peace_request' && accept) {
      get().makePeace(event.fromFactionId, event.toFactionId);
      get().changeRelation(event.fromFactionId, event.toFactionId, RELATION_DELTA.peace_accept);
      get().addLog({
        eraYear: state.eraYear, eraMonth: state.eraMonth,
        message: `🕊 接受 ${state.factions[event.fromFactionId]?.name} 的求和，刀兵止息。`,
        type: 'diplomacy'
      });
    } else if (event.type === 'war_declaration') {
      // 宣战书无论接受拒绝都会开战（只是外交态度不同）
      get().declareWar(event.fromFactionId, event.toFactionId);
    } else if (event.type === 'tribute' && accept && event.payload?.gold) {
      // 收贡金
      set(s => ({
        factions: {
          ...s.factions,
          [event.toFactionId]: {
            ...s.factions[event.toFactionId],
            treasury: s.factions[event.toFactionId].treasury + (event.payload?.gold || 0)
          }
        }
      }));
    }

    const fromName = state.factions[event.fromFactionId]?.name || '?';
    const typeNames: Record<string, string> = {
      marriage: '求亲', tribute: '进贡', envoy: '使臣来访',
      peace_request: '求和', war_declaration: '宣战', betray: '背叛'
    };
    get().addLog({
      eraYear: state.eraYear, eraMonth: state.eraMonth,
      message: `${accept ? '✅' : '❌'} ${accept ? '接受' : '拒绝'}了 ${fromName} 的${typeNames[event.type] || '外交请求'}。`,
      type: 'diplomacy'
    });
  },

  // 玩家主动外交
  sendDiplomaticAction: (type, targetFactionId) => {
    const state = get();
    const player = state.factions['F_PLAYER'];
    const target = state.factions[targetFactionId];
    if (!player || !target) return;

    const cost = DIPLO_COST[type] || 0;
    if (player.treasury < cost) {
      get().addLog({ eraYear: state.eraYear, eraMonth: state.eraMonth, message: `国库不足，无法执行外交行动。`, type: 'info' });
      return;
    }

    // 扣费
    if (cost > 0) {
      set(s => ({
        factions: {
          ...s.factions,
          F_PLAYER: { ...s.factions.F_PLAYER, treasury: s.factions.F_PLAYER.treasury - cost }
        }
      }));
    }

    const typeNames: Record<string, string> = {
      marriage: '求亲', tribute: '进贡', envoy: '出使', war_declaration: '宣战', peace_request: '求和'
    };

    if (type === 'war_declaration') {
      get().declareWar('F_PLAYER', targetFactionId);
      get().changeRelation('F_PLAYER', targetFactionId, RELATION_DELTA.war_declaration);
      get().addLog({
        eraYear: state.eraYear, eraMonth: state.eraMonth,
        message: `🔥 大楚正式向 ${target.name} 宣战！`,
        type: 'diplomacy'
      });
      return;
    }

    if (type === 'peace_request') {
      // 对方根据亲密度决定是否接受
      const rel = get().getRelation('F_PLAYER', targetFactionId);
      const acceptChance = Math.min(80, rel + 10);
      const accepted = Math.random() * 100 < acceptChance;
      if (accepted) {
        get().makePeace('F_PLAYER', targetFactionId);
        get().changeRelation('F_PLAYER', targetFactionId, RELATION_DELTA.peace_accept);
        get().addLog({ eraYear: state.eraYear, eraMonth: state.eraMonth, message: `🕊 ${target.name} 接受求和，战事平息。`, type: 'diplomacy' });
      } else {
        get().changeRelation('F_PLAYER', targetFactionId, RELATION_DELTA.peace_reject);
        get().addLog({ eraYear: state.eraYear, eraMonth: state.eraMonth, message: `❌ ${target.name} 拒绝求和！`, type: 'diplomacy' });
      }
      return;
    }

    // envoy / marriage / tribute：AI 根据亲密度决定接受
    const rel = get().getRelation('F_PLAYER', targetFactionId);
    const baseAccept = type === 'envoy' ? 80 : type === 'tribute' ? 70 : 50;
    const acceptChance = Math.min(95, baseAccept + (rel - 50) * 0.5);
    const accepted = Math.random() * 100 < acceptChance;

    const acceptKey = `${type}_${accepted ? 'accept' : 'reject'}`;
    const delta = RELATION_DELTA[acceptKey] || 0;
    get().changeRelation('F_PLAYER', targetFactionId, delta);

    if (type === 'tribute' && accepted) {
      // 贡金给对方
      set(s => ({
        factions: {
          ...s.factions,
          [targetFactionId]: { ...s.factions[targetFactionId], treasury: s.factions[targetFactionId].treasury + cost }
        }
      }));
    }

    get().addLog({
      eraYear: state.eraYear, eraMonth: state.eraMonth,
      message: `${accepted ? '✅' : '❌'} 向 ${target.name} ${typeNames[type]}${accepted ? '成功' : '被拒'}。${delta > 0 ? `亲密+${delta}` : delta < 0 ? `亲密${delta}` : ''}`,
      type: 'diplomacy'
    });
  },

  buildMilitaryBase: (cityId) => {
    const state = get();
    const city = state.cities[cityId];
    if (!city || !city.ownerId || city.hasMilitaryBase) return;
    const faction = state.factions[city.ownerId];
    if (!faction || faction.treasury < 8000) return;

    // 检查名额限制（国家总城池数 / 5）
    const ownedCities = Object.values(state.cities).filter(c => c.ownerId === faction.id);
    const capacity = Math.floor(ownedCities.length / 5);
    const currentBases = ownedCities.filter(c => c.hasMilitaryBase).length;
    if (currentBases >= capacity) return;

    set(s => ({
      factions: { ...s.factions, [faction.id]: { ...s.factions[faction.id], treasury: faction.treasury - 8000 } },
      cities: { ...s.cities, [cityId]: { ...s.cities[cityId], hasMilitaryBase: true } },
    }));
    get().addLog({ eraYear: state.eraYear, eraMonth: state.eraMonth, message: `🛠️ ${faction.name} 在 ${city.name} 建成军镇。`, type: 'economy' });
  },

  // ======== 行军 ========
  dispatchArmy: (fromCityId, toCityId, troops, isTransfer = false) => {
    const state = get();
    const fromCity = state.cities[fromCityId];
    const toCity = state.cities[toCityId];
    if (!fromCity || !toCity || fromCity.troops < troops || troops <= 0) return;

    const dist = cityDistance(fromCity, toCity);
    const travelTime = calcTravelTime(dist);
    const now = Date.now();

    const army: MarchingArmy = {
      id: genId(), fromCityId, toCityId,
      ownerId: fromCity.ownerId!,
      troops, departTime: now, arriveTime: now + travelTime,
      isPlayerOrder: fromCity.ownerId === 'F_PLAYER',
      isTransfer
    };

    // 进攻 → 自动宣战 + 亲密度下降
    if (!isTransfer && toCity.ownerId && toCity.ownerId !== fromCity.ownerId) {
      if (!state.factions[fromCity.ownerId!]?.atWarWith.includes(toCity.ownerId)) {
        get().declareWar(fromCity.ownerId!, toCity.ownerId);
        get().changeRelation(fromCity.ownerId!, toCity.ownerId, RELATION_DELTA.war_declaration);
        const aName = state.factions[fromCity.ownerId!]?.name || '?';
        const dName = state.factions[toCity.ownerId]?.name || '?';
        get().addLog({ eraYear: state.eraYear, eraMonth: state.eraMonth, message: `🔥 ${aName} 向 ${dName} 正式宣战！边境烽烟四起！`, type: 'diplomacy' });
      }
      get().changeRelation(fromCity.ownerId!, toCity.ownerId, RELATION_DELTA.attack);
    }

    set((s) => ({
      cities: { ...s.cities, [fromCityId]: { ...s.cities[fromCityId], troops: s.cities[fromCityId].troops - troops } },
      marchingArmies: [...s.marchingArmies, army]
    }));

    const seconds = Math.round(travelTime / 1000);
    const verb = isTransfer ? '调遣' : '出兵';
    const suffix = isTransfer ? '增援' : '讨伐';
    get().addLog({ eraYear: state.eraYear, eraMonth: state.eraMonth, message: `${fromCity.name} ${verb} ${troops.toLocaleString()} 人${suffix} ${toCity.name}，约 ${seconds}s 后抵达。`, type: 'military' });
  },

  // ======== 城市指令 ========
  cityAction: (cityId, actionType) => set((state) => {
    const city = state.cities[cityId];
    if (!city || !city.ownerId) return state;
    const faction = state.factions[city.ownerId];
    if (!faction) return state;

    const newCity = { ...city };
    const newFaction = { ...faction };

    if (actionType === 'relief') {
      if (newFaction.treasury >= 2000) {
        newFaction.treasury -= 2000;
        newCity.loyalty = Math.min(100, newCity.loyalty + 30);
        get().addLog({ eraYear: state.eraYear, eraMonth: state.eraMonth, message: `拨发赈灾款至 ${city.name}，民心大振。`, type: 'economy' });
      }
    } else if (actionType === 'repair') {
      if (newFaction.treasury >= 3000) {
        newFaction.treasury -= 3000;
        newCity.maxDefense += 500;
        newCity.defense += 500;
        get().addLog({ eraYear: state.eraYear, eraMonth: state.eraMonth, message: `${city.name} 修缮城防，城墙更加坚固了。`, type: 'economy' });
      }
    } else if (actionType === 'forceDraft') {
      const drafted = Math.floor(newCity.population * 0.10);
      if (drafted > 0) {
        newCity.population -= drafted;
        newCity.troops += drafted;
        newCity.maxTroops = Math.floor(newCity.population * 0.2 + newCity.defense * 1.0);
        newCity.loyalty = Math.max(0, newCity.loyalty - 15);
        get().addLog({ eraYear: state.eraYear, eraMonth: state.eraMonth, message: `${city.name} 强制征兵 ${drafted.toLocaleString()} 人，百姓怨声载道。`, type: 'military' });
      }
    }

    return {
      cities: { ...state.cities, [cityId]: newCity },
      factions: { ...state.factions, [city.ownerId]: newFaction }
    };
  }),

  // ======== 存档 ========
  saveGame: () => {
    const state = get();
    const saveData = {
      eraYear: state.eraYear, eraMonth: state.eraMonth,
      factions: state.factions, cities: state.cities,
      marchingArmies: state.marchingArmies,
      logs: state.logs.slice(0, 50),
      diplomaticEvents: state.diplomaticEvents.slice(0, 50),
    };
    try { localStorage.setItem('darkflow_save', JSON.stringify(saveData)); } catch { /* */ }
  },

  loadGame: () => {
    try {
      const raw = localStorage.getItem('darkflow_save');
      if (!raw) return false;
      const data = JSON.parse(raw);
      set({
        eraYear: data.eraYear, eraMonth: data.eraMonth,
        factions: data.factions, cities: data.cities,
        marchingArmies: data.marchingArmies || [],
        logs: data.logs || [],
        diplomaticEvents: data.diplomaticEvents || [],
      });
      return true;
    } catch { return false; }
  }
}));
