import { useState } from 'react';
import { useWorldStore, cityDistance, calcTravelTime } from '../store/WorldStore';

interface TransferEntry {
  cityId: string;
  troops: number;
}

export default function TransferModal() {
  const showTransferModal = useWorldStore(state => state.showTransferModal);
  const transferTargetId = useWorldStore(state => state.transferTargetId);
  const cities = useWorldStore(state => state.cities);
  const dispatchArmy = useWorldStore(state => state.dispatchArmy);
  const setShowTransferModal = useWorldStore(state => state.setShowTransferModal);
  const setTransferTarget = useWorldStore(state => state.setTransferTarget);

  const [entries, setEntries] = useState<TransferEntry[]>([]);

  if (!showTransferModal || !transferTargetId) return null;

  const targetCity = cities[transferTargetId];
  if (!targetCity) return null;

  // 找相邻的己方城市
  const sourceCities = targetCity.adjacencies
    .map(id => cities[id])
    .filter(c => c && c.ownerId === 'F_PLAYER' && c.terrain !== 'water' && c.troops > 0 && c.id !== transferTargetId)
    .sort((a, b) => b.troops - a.troops);

  const handleClose = () => {
    setShowTransferModal(false);
    setTransferTarget(null);
    setEntries([]);
  };

  const getEntry = (cityId: string) => entries.find(e => e.cityId === cityId);

  const setTroops = (cityId: string, troops: number) => {
    setEntries(prev => {
      const existing = prev.find(e => e.cityId === cityId);
      if (existing) return prev.map(e => e.cityId === cityId ? { ...e, troops } : e);
      return [...prev, { cityId, troops }];
    });
  };

  const totalTransfer = entries.reduce((s, e) => s + e.troops, 0);

  const handleConfirm = () => {
    entries.forEach(entry => {
      if (entry.troops > 0) {
        dispatchArmy(entry.cityId, transferTargetId, entry.troops, true); // isTransfer = true
      }
    });
    handleClose();
  };

  return (
    <div className="deploy-overlay" onClick={handleClose}>
      <div className="deploy-modal glass-panel" onClick={e => e.stopPropagation()}>
        <div className="deploy-header">
          <div>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--accent-blue)' }}>
              📦 兵力调遣
            </span>
            <span style={{ fontSize: '20px', marginLeft: '12px', color: 'var(--accent-gold)' }}>
              → {targetCity.name}
            </span>
          </div>
          <button className="btn" onClick={handleClose} style={{ padding: '4px 12px' }}>✕</button>
        </div>

        <div className="deploy-enemy-info">
          <div className="deploy-stat">
            <span className="deploy-stat-label">现有守军</span>
            <span className="deploy-stat-value" style={{ color: 'var(--accent-gold)' }}>
              {targetCity.troops.toLocaleString()}
            </span>
          </div>
          <div className="deploy-stat">
            <span className="deploy-stat-label">人口</span>
            <span className="deploy-stat-value">{targetCity.population.toLocaleString()}</span>
          </div>
        </div>

        <div className="deploy-divider" />

        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', color: 'var(--accent-blue)' }}>
          选择调兵来源
        </div>

        {sourceCities.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', padding: '20px', textAlign: 'center' }}>
            附近没有可调兵的友方城市
          </div>
        ) : (
          <div className="deploy-city-list">
            {sourceCities.map(sc => {
              const dist = cityDistance(sc, targetCity);
              const travelSec = Math.round(calcTravelTime(dist) / 1000);
              const entry = getEntry(sc.id);
              const currentTroops = entry?.troops || 0;

              return (
                <div key={sc.id} className="deploy-city-row">
                  <div className="deploy-city-info">
                    <span className="deploy-city-name">{sc.name}</span>
                    <span className="deploy-city-meta">可调: <b>{sc.troops.toLocaleString()}</b></span>
                    <span className="deploy-city-meta">预计 <b>{travelSec}s</b></span>
                  </div>
                  <div className="deploy-city-slider">
                    <input type="range" min={0} max={sc.troops}
                      step={Math.max(1, Math.floor(sc.troops / 100))}
                      value={currentTroops}
                      onChange={e => setTroops(sc.id, parseInt(e.target.value))}
                      className="slider-input" />
                    <div className="deploy-troops-display">
                      <input type="number" min={0} max={sc.troops} value={currentTroops}
                        onChange={e => setTroops(sc.id, Math.max(0, Math.min(sc.troops, parseInt(e.target.value) || 0)))}
                        className="deploy-number-input" />
                      <button className="btn" style={{ padding: '2px 8px', fontSize: '11px' }}
                        onClick={() => setTroops(sc.id, sc.troops)}>全部</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="deploy-divider" />

        <div className="deploy-footer">
          <div>
            合计调兵: <b style={{ color: 'var(--accent-blue)', fontSize: '18px' }}>
              {totalTransfer.toLocaleString()}
            </b> 人
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn" onClick={handleClose}>取消</button>
            <button className="btn btn-primary" disabled={totalTransfer === 0}
              onClick={handleConfirm} style={{ fontSize: '16px', padding: '8px 24px' }}>
              📦 确认调遣
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
