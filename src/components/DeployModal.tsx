import { useState } from 'react';
import { useWorldStore, cityDistance, calcTravelTime } from '../store/WorldStore';

interface DeployEntry {
  cityId: string;
  troops: number;
}

export default function DeployModal() {
  const showDeployModal = useWorldStore(state => state.showDeployModal);
  const attackTargetId = useWorldStore(state => state.attackTargetId);
  const cities = useWorldStore(state => state.cities);
  const factions = useWorldStore(state => state.factions);
  const dispatchArmy = useWorldStore(state => state.dispatchArmy);
  const setShowDeployModal = useWorldStore(state => state.setShowDeployModal);
  const setAttackTarget = useWorldStore(state => state.setAttackTarget);

  const [deployEntries, setDeployEntries] = useState<DeployEntry[]>([]);

  if (!showDeployModal || !attackTargetId) return null;

  const targetCity = cities[attackTargetId];
  if (!targetCity) return null;
  const defenderFaction = targetCity.ownerId ? factions[targetCity.ownerId] : null;

  // 找出与目标城相邻的己方城市
  const playerCities = targetCity.adjacencies
    .map(id => cities[id])
    .filter(c => c && c.ownerId === 'F_PLAYER' && c.terrain !== 'water' && c.troops > 0)
    .sort((a, b) => a.troops - b.troops)
    .reverse();

  // 初始化 deployEntries（如果还是空的）
  if (deployEntries.length === 0 && playerCities.length > 0) {
    // 不使用 setState 在渲染中，用 useEffect 替代
  }

  const handleClose = () => {
    setShowDeployModal(false);
    setAttackTarget(null);
    setDeployEntries([]);
  };

  const getEntry = (cityId: string) => deployEntries.find(e => e.cityId === cityId);

  const setTroops = (cityId: string, troops: number) => {
    setDeployEntries(prev => {
      const existing = prev.find(e => e.cityId === cityId);
      if (existing) {
        return prev.map(e => e.cityId === cityId ? { ...e, troops } : e);
      }
      return [...prev, { cityId, troops }];
    });
  };

  const totalDeployed = deployEntries.reduce((sum, e) => sum + e.troops, 0);

  const handleConfirm = () => {
    deployEntries.forEach(entry => {
      if (entry.troops > 0) {
        dispatchArmy(entry.cityId, attackTargetId, entry.troops);
      }
    });
    handleClose();
  };

  return (
    <div className="deploy-overlay" onClick={handleClose}>
      <div className="deploy-modal glass-panel" onClick={e => e.stopPropagation()}>
        {/* 标题区 */}
        <div className="deploy-header">
          <div>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--accent-red)' }}>
              ⚔ 进攻目标
            </span>
            <span style={{ fontSize: '22px', marginLeft: '12px', color: defenderFaction?.color || '#888' }}>
              {targetCity.name}
            </span>
            <span style={{ fontSize: '14px', marginLeft: '8px', color: 'var(--text-dim)' }}>
              [{defenderFaction?.name || '无主'}]
            </span>
          </div>
          <button className="btn" onClick={handleClose} style={{ padding: '4px 12px' }}>✕</button>
        </div>

        {/* 敌情 */}
        <div className="deploy-enemy-info">
          <div className="deploy-stat">
            <span className="deploy-stat-label">守军兵力</span>
            <span className="deploy-stat-value" style={{ color: 'var(--accent-red)' }}>
              {targetCity.troops.toLocaleString()}
            </span>
          </div>
          <div className="deploy-stat">
            <span className="deploy-stat-label">城防</span>
            <span className="deploy-stat-value" style={{ color: 'var(--accent-gold)' }}>
              {Math.floor(targetCity.defense).toLocaleString()}
            </span>
          </div>
          <div className="deploy-stat">
            <span className="deploy-stat-label">人口</span>
            <span className="deploy-stat-value">
              {targetCity.population.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="deploy-divider" />

        {/* 调兵列表 */}
        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--accent-gold)' }}>
          选择出兵城市与兵力
        </div>

        {playerCities.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', padding: '20px', textAlign: 'center' }}>
            无可用的相邻城市可进攻此地
          </div>
        ) : (
          <div className="deploy-city-list">
            {playerCities.map(city => {
              const dist = cityDistance(city, targetCity);
              const travelMs = calcTravelTime(dist);
              const travelSec = Math.round(travelMs / 1000);
              const entry = getEntry(city.id);
              const currentTroops = entry?.troops || 0;
              const maxAvail = city.troops;

              return (
                <div key={city.id} className="deploy-city-row">
                  <div className="deploy-city-info">
                    <span className="deploy-city-name">{city.name}</span>
                    <span className="deploy-city-meta">
                      可用兵力: <b>{maxAvail.toLocaleString()}</b>
                    </span>
                    <span className="deploy-city-meta">
                      距离: {Math.round(dist)} | 预计 <b>{travelSec}秒</b>
                    </span>
                  </div>
                  <div className="deploy-city-slider">
                    <input
                      type="range"
                      min={0}
                      max={maxAvail}
                      step={Math.max(1, Math.floor(maxAvail / 100))}
                      value={currentTroops}
                      onChange={e => setTroops(city.id, parseInt(e.target.value))}
                      className="slider-input"
                    />
                    <div className="deploy-troops-display">
                      <input
                        type="number"
                        min={0}
                        max={maxAvail}
                        value={currentTroops}
                        onChange={e => {
                          const v = Math.max(0, Math.min(maxAvail, parseInt(e.target.value) || 0));
                          setTroops(city.id, v);
                        }}
                        className="deploy-number-input"
                      />
                      <button
                        className="btn"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                        onClick={() => setTroops(city.id, maxAvail)}
                      >全部</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="deploy-divider" />

        {/* 底部操作栏 */}
        <div className="deploy-footer">
          <div>
            合计出兵: <b style={{ color: 'var(--accent-gold)', fontSize: '18px' }}>
              {totalDeployed.toLocaleString()}
            </b> 人
            {totalDeployed > targetCity.troops && (
              <span style={{ color: 'var(--accent-green)', marginLeft: '12px', fontSize: '13px' }}>
                ✓ 兵力优势，可破城
              </span>
            )}
            {totalDeployed > 0 && totalDeployed <= targetCity.troops && (
              <span style={{ color: 'var(--accent-red)', marginLeft: '12px', fontSize: '13px' }}>
                ✗ 兵力不足，无法攻克
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn" onClick={handleClose}>取消</button>
            <button
              className="btn btn-primary"
              disabled={totalDeployed === 0}
              onClick={handleConfirm}
              style={{ fontSize: '16px', padding: '8px 24px' }}
            >
              ⚔ 确认出兵
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
