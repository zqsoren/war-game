import { useWorldStore, type City, type Faction } from '../store/WorldStore';

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function roll(percent: number): boolean {
  return Math.random() * 100 < percent;
}

// ============================
// 高频循环：行军到达 + 兵力恢复
// ============================

let lastRealtimeUpdate = Date.now();

export function realtimeUpdate() {
  const state = useWorldStore.getState();
  if (state.isPaused) return;

  const now = Date.now();
  const deltaMs = now - lastRealtimeUpdate;
  lastRealtimeUpdate = now;

  // --- 1. 检查行军到达 ---
  const arrivedIds: string[] = [];
  state.marchingArmies.forEach(army => {
    if (now >= army.arriveTime) {
      arrivedIds.push(army.id);
      resolveBattle(army);
    }
  });

  if (arrivedIds.length > 0) {
    useWorldStore.setState(s => ({
      marchingArmies: s.marchingArmies.filter(a => !arrivedIds.includes(a.id))
    }));
  }

  // --- 2. 兵力自然恢复 ---
  if (deltaMs > 0) {
    const deltaMinutes = deltaMs / 60000;
    useWorldStore.setState(s => {
      const newCities = { ...s.cities };
      let changed = false;

      Object.values(newCities).forEach(city => {
        if (!city.ownerId || city.terrain === 'water') return;
        const faction = s.factions[city.ownerId];
        if (!faction) return;

        let rate = city.troopRecoveryRate;
        if (faction.conscriptionPolicy === 'normal') rate *= 1.8;

        const recoveryAmount = Math.floor(city.troops * rate * deltaMinutes);
        if (recoveryAmount > 0 && city.troops < city.maxTroops) {
          const newTroops = Math.min(city.maxTroops, city.troops + recoveryAmount);
          if (newTroops !== city.troops) {
            newCities[city.id] = { ...city, troops: newTroops };
            changed = true;
          }
        }
      });

      return changed ? { cities: newCities } : {};
    });
  }
}

// 战斗结算
function resolveBattle(army: { id: string; fromCityId: string; toCityId: string; ownerId: string; troops: number; isPlayerOrder: boolean; isTransfer: boolean }) {
  const state = useWorldStore.getState();
  const targetCity = state.cities[army.toCityId];
  if (!targetCity) return;

  const attackerFaction = state.factions[army.ownerId];
  const attackerName = attackerFaction?.name || '未知';

  // 友军调兵或目标已是己方 → 直接驻入
  if (army.isTransfer || targetCity.ownerId === army.ownerId) {
    useWorldStore.setState(s => ({
      cities: { ...s.cities, [army.toCityId]: { ...s.cities[army.toCityId], troops: s.cities[army.toCityId].troops + army.troops } }
    }));
    state.addLog({ eraYear: state.eraYear, eraMonth: state.eraMonth, message: `${army.troops.toLocaleString()} 名${army.isTransfer ? '调遣' : '援'}军抵达 ${targetCity.name}。`, type: 'military' });
    return;
  }

  const defenderFaction = targetCity.ownerId ? state.factions[targetCity.ownerId] : null;
  const defenderName = defenderFaction?.name || '无主';
  const defenderTroops = targetCity.troops;
  const attackerTroops = army.troops;

  if (attackerTroops > defenderTroops) {
    const surviving = attackerTroops - defenderTroops;
    useWorldStore.setState(s => {
      const tc = s.cities[army.toCityId];
      // 占领空城时给基础人口
      const newPop = tc.population <= 0 ? randomBetween(3000, 8000) : tc.population;
      return {
        cities: { ...s.cities, [army.toCityId]: {
          ...tc,
          ownerId: army.ownerId,
          troops: surviving,
          population: newPop,
          maxTroops: Math.floor(newPop * 0.2 + Math.floor(tc.defense * 0.3) * 1.0),
          defense: Math.floor(tc.defense * 0.3),
          loyalty: 40
        }}
      };
    });
    state.addLog({ eraYear: state.eraYear, eraMonth: state.eraMonth, message: `⚔️ 大捷！${attackerName} 以 ${attackerTroops.toLocaleString()} 破 ${defenderName} ${defenderTroops.toLocaleString()} 守军，攻占 ${targetCity.name}！残部 ${surviving.toLocaleString()} 人驻守。`, type: 'military' });
  } else if (attackerTroops === defenderTroops) {
    useWorldStore.setState(s => ({
      cities: { ...s.cities, [army.toCityId]: { ...s.cities[army.toCityId], troops: 0 } }
    }));
    state.addLog({ eraYear: state.eraYear, eraMonth: state.eraMonth, message: `⚔️ ${attackerName} 进攻 ${targetCity.name}，双方同归于尽！`, type: 'military' });
  } else {
    const surviving = defenderTroops - attackerTroops;
    useWorldStore.setState(s => ({
      cities: { ...s.cities, [army.toCityId]: { ...s.cities[army.toCityId], troops: surviving } }
    }));
    state.addLog({ eraYear: state.eraYear, eraMonth: state.eraMonth, message: `⚔️ ${attackerName} 以 ${attackerTroops.toLocaleString()} 兵攻打 ${targetCity.name}，未能攻克。${defenderName} 残余 ${surviving.toLocaleString()} 人。`, type: 'military' });
  }
}

// ============================
// 低频 Tick：经济/人口/AI 外交 + 战争
// ============================

export function advanceTick() {
  const store = useWorldStore.getState();
  const { cities, factions, eraYear, eraMonth } = store;

  let newMonth = eraMonth + 2;
  let newYear = eraYear;
  if (newMonth > 12) { newMonth = 1; newYear += 1; }

  const nextCities: Record<string, City> = JSON.parse(JSON.stringify(cities));
  const nextFactions: Record<string, Faction> = JSON.parse(JSON.stringify(factions));
  const newLogs: Omit<import('../store/WorldStore').GameLog, 'id' | 'timestamp'>[] = [];

  // ========== 经济与人口 ==========
  Object.values(nextCities).forEach((city) => {
    if (!city.ownerId || city.terrain === 'water') return;
    const faction = nextFactions[city.ownerId];
    if (!faction) return;

    let loyaltyBonus = 0;
    let taxRateFactor = 0.03;

    if (faction.taxRate === 'low') {
      taxRateFactor = 0.021; loyaltyBonus += 2;
    } else if (faction.taxRate === 'high') {
      taxRateFactor = 0.045; loyaltyBonus -= 5;
    }

    city.loyalty = Math.max(0, Math.min(100, city.loyalty + loyaltyBonus));

    if (faction.taxRate === 'high' && roll(10)) {
      city.loyalty -= 20;
      city.loyalty = Math.max(0, city.loyalty);
      newLogs.push({ eraYear: newYear, eraMonth: newMonth, message: `${city.name}爆发抗税运动，民心大溃！`, type: 'disaster' });
    }

    // ★ 核心规则：民心 === 100 才增长人口
    if (city.loyalty === 100) {
      const rpBase = randomBetween(5, 20) / 1000;
      const pBonus = faction.farmBonusActive ? 0.005 : 0;
      city.population = Math.floor(city.population * (1 + rpBase + pBonus));
    }
    city.maxTroops = Math.floor(city.population * 0.2 + city.defense * 1.0);

    const governor = faction.officers.find(o => o.assignedCityId === city.id);
    const governorIntBonus = governor ? governor.intelligence / 100 : 0;
    const income = Math.floor(city.population * taxRateFactor * (1 + governorIntBonus));
    faction.treasury += income;
  });

  // ========== AI 外交决策 + 战争行为 ==========
  const allFactionIds = Object.keys(nextFactions);

  Object.values(nextFactions).forEach(faction => {
    if (faction.isPlayer) return;
    const myCities = Object.values(nextCities).filter(c => c.ownerId === faction.id);
    if (myCities.length === 0) return;

    const myTotalTroops = myCities.reduce((s, c) => s + c.troops, 0);

    // --- 背叛检查 ---
    allFactionIds.forEach(otherId => {
      if (otherId === faction.id) return;
      const rel = faction.relations[otherId] ?? 50;
      if (rel >= 80 && !faction.atWarWith.includes(otherId) && roll(5)) {
        // 背叛！
        faction.relations[otherId] = Math.max(0, rel - 50);
        const otherF = nextFactions[otherId];
        if (otherF) {
          otherF.relations[faction.id] = Math.max(0, (otherF.relations[faction.id] ?? 50) - 50);
          if (!faction.atWarWith.includes(otherId)) faction.atWarWith.push(otherId);
          if (!otherF.atWarWith.includes(faction.id)) otherF.atWarWith.push(faction.id);
        }
        newLogs.push({ eraYear: newYear, eraMonth: newMonth, message: `🗡 ${faction.name} 背叛了 ${otherF?.name || '?'}！两国骤然交战！`, type: 'diplomacy' });

        // 如果对方是玩家，发送外交事件
        if (otherId === 'F_PLAYER') {
          useWorldStore.getState().addDiplomaticEvent({
            type: 'betray', fromFactionId: faction.id, toFactionId: 'F_PLAYER',
            status: 'pending', payload: { message: `${faction.name} 撕毁盟约，突然宣战！` },
            createdAt: { eraYear: newYear, eraMonth: newMonth }
          });
        }
      }
    });

    // --- 求和检查（交战中且弱势） ---
    faction.atWarWith.forEach(enemyId => {
      const enemy = nextFactions[enemyId];
      if (!enemy) return;
      const enemyCities = Object.values(nextCities).filter(c => c.ownerId === enemyId);
      const enemyTroops = enemyCities.reduce((s, c) => s + c.troops, 0);

      if (myTotalTroops < enemyTroops * 0.5 && roll(30)) {
        if (enemyId === 'F_PLAYER') {
          // 向玩家求和 → 事件
          useWorldStore.getState().addDiplomaticEvent({
            type: 'peace_request', fromFactionId: faction.id, toFactionId: 'F_PLAYER',
            status: 'pending', payload: { message: `${faction.name} 派使者前来求和。` },
            createdAt: { eraYear: newYear, eraMonth: newMonth }
          });
          newLogs.push({ eraYear: newYear, eraMonth: newMonth, message: `🕊 ${faction.name} 向我朝请求停战！`, type: 'diplomacy' });
        } else {
          // AI vs AI 求和：50% 接受
          if (roll(50)) {
            faction.atWarWith = faction.atWarWith.filter(id => id !== enemyId);
            enemy.atWarWith = enemy.atWarWith.filter(id => id !== faction.id);
            faction.relations[enemyId] = Math.min(100, (faction.relations[enemyId] ?? 50) + 20);
            enemy.relations[faction.id] = Math.min(100, (enemy.relations[faction.id] ?? 50) + 20);
            newLogs.push({ eraYear: newYear, eraMonth: newMonth, message: `🕊 ${faction.name} 与 ${enemy.name} 达成和议，战事平息。`, type: 'diplomacy' });
          }
        }
      }
    });

    // --- 和平时外交互动 ---
    if (faction.atWarWith.length === 0 && roll(20)) {
      // 对随机一个AI国进行外交
      const targets = allFactionIds.filter(id => id !== faction.id && !faction.atWarWith.includes(id));
      if (targets.length > 0) {
        const targetId = targets[randomBetween(0, targets.length - 1)];
        const target = nextFactions[targetId];
        if (target) {
          const actionRoll = randomBetween(1, 100);
          let actionType: string;
          if (actionRoll <= 40) actionType = 'envoy'; // 40% 出使
          else if (actionRoll <= 70) actionType = 'tribute'; // 30% 进贡
          else actionType = 'marriage'; // 30% 通婚

          if (targetId === 'F_PLAYER') {
            // 向玩家发起外交事件
            const gold = actionType === 'tribute' ? randomBetween(1000, 3000) : undefined;
            const typeNames: Record<string, string> = { envoy: '使臣来访', tribute: '进贡', marriage: '求亲' };
            useWorldStore.getState().addDiplomaticEvent({
              type: actionType as 'envoy' | 'tribute' | 'marriage',
              fromFactionId: faction.id, toFactionId: 'F_PLAYER',
              status: 'pending',
              payload: { gold, message: `${faction.name} ${typeNames[actionType]}` },
              createdAt: { eraYear: newYear, eraMonth: newMonth }
            });
            newLogs.push({ eraYear: newYear, eraMonth: newMonth, message: `📜 ${faction.name} 遣使前来${typeNames[actionType]}。`, type: 'diplomacy' });
          } else {
            // AI vs AI 自动结算
            const relDeltas: Record<string, number> = { envoy: 5, tribute: 10, marriage: 15 };
            const delta = relDeltas[actionType] || 5;
            faction.relations[targetId] = Math.min(100, (faction.relations[targetId] ?? 50) + delta);
            target.relations[faction.id] = Math.min(100, (target.relations[faction.id] ?? 50) + delta);
          }
        }
      }
    }

    // --- 亲密度衰减（交战中每回合 -3） ---
    faction.atWarWith.forEach(enemyId => {
      faction.relations[enemyId] = Math.max(0, (faction.relations[enemyId] ?? 50) - 3);
    });

    // ========== 军事行为（基于亲密度） ==========
    if (faction.atWarWith.length > 0) {
      // 战争模式：集结 + 进攻
      faction.atWarWith.forEach(enemyId => {
        const borderCities = myCities.filter(c =>
          c.adjacencies.some(adjId => nextCities[adjId]?.ownerId === enemyId)
        );
        const inlandCities = myCities.filter(c =>
          !c.adjacencies.some(adjId => {
            const adj = nextCities[adjId];
            return adj && adj.ownerId && adj.ownerId !== faction.id;
          }) && c.troops > 1000
        );

        inlandCities.forEach(inland => {
          if (borderCities.length === 0) return;
          const transferAmount = Math.floor(inland.troops * 0.3);
          if (transferAmount > 500) {
            const target = borderCities[randomBetween(0, borderCities.length - 1)];
            inland.troops -= transferAmount;
            target.troops += transferAmount;
          }
        });

        borderCities.forEach(bc => {
          if (bc.troops < 1500 || !roll(50)) return;

          const enemyTargets = bc.adjacencies
            .map(id => nextCities[id])
            .filter(c => c && c.ownerId === enemyId);
          if (enemyTargets.length === 0) return;

          const target = enemyTargets[randomBetween(0, enemyTargets.length - 1)];
          const sendTroops = Math.floor(bc.troops * (randomBetween(40, 70) / 100));
          if (sendTroops < 500) return;

          dispatchAIArmy(bc, target, sendTroops, faction.id);
          bc.troops -= sendTroops;
          newLogs.push({ eraYear: newYear, eraMonth: newMonth, message: `⚠ ${faction.name} 从 ${bc.name} 派 ${sendTroops.toLocaleString()} 兵反攻 ${target.name}！`, type: 'military' });
        });
      });
    } else {
      // 和平时根据亲密度决定是否进攻
      const aiCities = myCities.filter(c => c.troops > 2000);
      if (aiCities.length > 0) {
        const sourceCity = aiCities[randomBetween(0, aiCities.length - 1)];
        const enemies = sourceCity.adjacencies
          .map(id => nextCities[id])
          .filter(c => c && c.ownerId && c.ownerId !== faction.id && c.terrain !== 'water');

        enemies.forEach(target => {
          if (!target.ownerId) return;
          const rel = faction.relations[target.ownerId] ?? 50;

          // 基于亲密度的进攻概率
          let attackChance = 0;
          if (rel >= 80) attackChance = 5;
          else if (rel >= 60) attackChance = 10;
          else if (rel >= 40) attackChance = 30;
          else attackChance = 50;

          if (roll(attackChance)) {
            const sendTroops = Math.floor(sourceCity.troops * (randomBetween(30, 50) / 100));
            if (sendTroops > 500 && sourceCity.troops - sendTroops > 500) {
              // 宣战
              if (!faction.atWarWith.includes(target.ownerId)) {
                faction.atWarWith.push(target.ownerId);
                const tgt = nextFactions[target.ownerId];
                if (tgt && !tgt.atWarWith.includes(faction.id)) tgt.atWarWith.push(faction.id);
                faction.relations[target.ownerId] = Math.max(0, (faction.relations[target.ownerId] ?? 50) - 30);
                if (tgt) tgt.relations[faction.id] = Math.max(0, (tgt.relations[faction.id] ?? 50) - 30);

                if (target.ownerId === 'F_PLAYER') {
                  useWorldStore.getState().addDiplomaticEvent({
                    type: 'war_declaration', fromFactionId: faction.id, toFactionId: 'F_PLAYER',
                    status: 'pending', payload: { message: `${faction.name} 正式向我朝宣战！` },
                    createdAt: { eraYear: newYear, eraMonth: newMonth }
                  });
                }
                newLogs.push({ eraYear: newYear, eraMonth: newMonth, message: `🔥 ${faction.name} 向 ${tgt?.name || '?'} 宣战！`, type: 'diplomacy' });
              }

              dispatchAIArmy(sourceCity, target, sendTroops, faction.id);
              sourceCity.troops -= sendTroops;
              newLogs.push({ eraYear: newYear, eraMonth: newMonth, message: `${faction.name} 从 ${sourceCity.name} 派 ${sendTroops.toLocaleString()} 兵征讨 ${target.name}！`, type: 'military' });
            }
          }
        });
      }
    }
  });

  // ========== 提交状态 ==========
  useWorldStore.setState({
    eraYear: newYear, eraMonth: newMonth,
    cities: nextCities, factions: nextFactions,
    lastTickTime: Date.now()
  });

  newLogs.forEach(entry => store.addLog(entry));
  if (newLogs.length === 0) {
    store.addLog({ eraYear: newYear, eraMonth: newMonth, message: '两月荏苒，天下大势平稳流逝。', type: 'info' });
  }

  useWorldStore.getState().saveGame();
}

// AI 派军辅助
function dispatchAIArmy(from: City, to: City, troops: number, ownerId: string) {
  const dist = Math.sqrt((from.x - to.x) ** 2 + (from.y - to.y) ** 2);
  const travelMs = Math.max(3000, (dist / 1.67) * 1000);
  const now = Date.now();
  useWorldStore.setState(s => ({
    marchingArmies: [...s.marchingArmies, {
      id: Math.random().toString(36).substring(2, 10),
      fromCityId: from.id, toCityId: to.id,
      ownerId, troops,
      departTime: now, arriveTime: now + travelMs,
      isPlayerOrder: false, isTransfer: false
    }]
  }));
}

// ============================
// 引擎控制器
// ============================

let tickTimer: number | null = null;
let realtimeTimer: number | null = null;

export function startTickEngine() {
  if (tickTimer) return;
  realtimeTimer = window.setInterval(() => realtimeUpdate(), 500);

  const scheduleNext = () => {
    if (useWorldStore.getState().isPaused) {
      tickTimer = window.setTimeout(scheduleNext, 1000);
      return;
    }
    advanceTick();
    const speed = useWorldStore.getState().gameSpeed || 1;
    const base = randomBetween(7 * 60 * 1000, 10 * 60 * 1000);
    tickTimer = window.setTimeout(scheduleNext, Math.floor(base / speed));
  };

  const speed = useWorldStore.getState().gameSpeed || 1;
  tickTimer = window.setTimeout(scheduleNext, Math.floor(randomBetween(7 * 60 * 1000, 10 * 60 * 1000) / speed));
}

export function stopTickEngine() {
  if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
  if (realtimeTimer) { clearInterval(realtimeTimer); realtimeTimer = null; }
}
