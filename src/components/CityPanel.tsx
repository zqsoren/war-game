import { useState } from 'react';
import { useWorldStore } from '../store/WorldStore';

export default function CityPanel() {
  const selectedCityId = useWorldStore(state => state.selectedCityId);
  const cities = useWorldStore(state => state.cities);
  const factions = useWorldStore(state => state.factions);
  const cityAction = useWorldStore(state => state.cityAction);
  const marchingArmies = useWorldStore(state => state.marchingArmies);
  const setAttackTarget = useWorldStore(state => state.setAttackTarget);
  const setShowDeployModal = useWorldStore(state => state.setShowDeployModal);
  const setTransferTarget = useWorldStore(state => state.setTransferTarget);
  const setShowTransferModal = useWorldStore(state => state.setShowTransferModal);
  const renameCity = useWorldStore(state => state.renameCity);
  const buildMilitaryBase = useWorldStore(state => state.buildMilitaryBase);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  if (!selectedCityId || !cities[selectedCityId]) {
    return (
      <div className="glass-panel" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
        点击地图上的城池查看详情
        <br />
        <span style={{ fontSize: '11px', marginTop: '8px', display: 'block' }}>在势力视图下更易辨认领土</span>
      </div>
    );
  }

  const city = cities[selectedCityId];
  const owner = city.ownerId ? factions[city.ownerId] : null;
  const isPlayerCity = owner?.id === 'F_PLAYER';

  // 行军信息
  const incomingArmies = marchingArmies.filter(a => a.toCityId === city.id);
  const outgoingArmies = marchingArmies.filter(a => a.fromCityId === city.id);

  // 恢复率
  const baseRate = city.troopRecoveryRate * 100;
  const effectiveRate = owner?.conscriptionPolicy === 'normal' ? baseRate * 1.8 : baseRate;

  // 是否可进攻：非己方，且与己方领土相邻
  const isAttackable = !isPlayerCity && city.ownerId !== 'F_PLAYER' &&
    city.adjacencies.some(adjId => cities[adjId]?.ownerId === 'F_PLAYER');

  // 自己拥有的城市列表
  const playerOwnedCities = Object.values(cities).filter(c => c.ownerId === 'F_PLAYER');

  // 是否可调兵到此城
  let canReceiveTransfer = false;
  if (isPlayerCity) {
    const hasAdjSource = city.adjacencies.some(adjId => cities[adjId]?.ownerId === 'F_PLAYER' && cities[adjId]?.troops > 0);
    const hasBaseSource = city.hasMilitaryBase && playerOwnedCities.some(c => c.id !== city.id && c.hasMilitaryBase && c.troops > 0);
    canReceiveTransfer = Boolean(hasAdjSource || hasBaseSource);
  }

  // 军镇名额计算
  const capacity = Math.floor(playerOwnedCities.length / 5);
  const currentBases = playerOwnedCities.filter(c => c.hasMilitaryBase).length;
  const canBuildBase = Boolean(isPlayerCity && !city.hasMilitaryBase && (owner?.treasury ?? 0) >= 8000 && currentBases < capacity);

  // 战争状态
  const playerFaction = factions['F_PLAYER'];
  const warStatus = owner && !isPlayerCity && playerFaction?.atWarWith.includes(owner.id);

  const handleStartRename = () => {
    setRenameValue(city.name);
    setIsRenaming(true);
  };

  const handleConfirmRename = () => {
    if (renameValue.trim()) {
      renameCity(selectedCityId, renameValue);
    }
    setIsRenaming(false);
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', overflowY: 'auto' }}>
      {/* 标题 */}
      <div className="ministry-header" style={{ paddingBottom: '10px' }}>
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={handleConfirmRename}
            onKeyDown={e => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') setIsRenaming(false); }}
            maxLength={20}
            style={{
              fontSize: '18px', letterSpacing: '2px', color: owner?.color || '#888',
              background: 'rgba(0,0,0,0.4)', border: '1px solid var(--accent-gold)',
              borderRadius: '4px', padding: '2px 8px', outline: 'none',
              fontFamily: 'var(--font-family)', width: '140px'
            }}
          />
        ) : (
          <span style={{ fontSize: '20px', letterSpacing: '2px', color: owner?.color || '#888', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {city.name}
            {isPlayerCity && (
              <button onClick={handleStartRename}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--text-dim)', padding: '0 2px' }}
                title="重命名城市">
                ✏️
              </button>
            )}
          </span>
        )}
        {city.hasMilitaryBase && (
          <span style={{ fontSize: '13px', color: 'var(--accent-gold)', marginLeft: '6px' }} title="军镇：可与国内其他军镇无视距离直接调兵">🏕️军镇</span>
        )}
        <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
          [{owner ? owner.name : '叛贼'}]
          {warStatus && <span style={{ color: 'var(--accent-red)', marginLeft: '6px' }}>⚔交战中</span>}
        </span>
      </div>

      {/* 数据 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '13px' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>人口</div>
          <div style={{ fontFamily: 'monospace', fontSize: '16px' }}>{city.population.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>守军/上限</div>
          <div style={{ fontFamily: 'monospace', fontSize: '16px', color: 'var(--accent-red)' }}>
            {city.troops.toLocaleString()} <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>/{city.maxTroops.toLocaleString()}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>城防</div>
          <div style={{ fontFamily: 'monospace', fontSize: '16px', color: 'var(--accent-gold)' }}>
            {Math.floor(city.defense)}/{Math.floor(city.maxDefense)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>民心</div>
          <div style={{ fontFamily: 'monospace', fontSize: '16px' }}>{city.loyalty}%</div>
        </div>
      </div>

      {/* 恢复率 */}
      {isPlayerCity && (
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', borderTop: '1px solid var(--panel-border)', paddingTop: '6px' }}>
          兵力恢复: <b style={{ color: 'var(--accent-green)' }}>{effectiveRate.toFixed(1)}%</b>/min
          {owner?.conscriptionPolicy === 'normal' && <span style={{ color: 'var(--accent-gold)', marginLeft: '4px' }}>(募兵令)</span>}
        </div>
      )}

      {/* 行军情报 */}
      {(incomingArmies.length > 0 || outgoingArmies.length > 0) && (
        <div style={{ fontSize: '11px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', padding: '6px' }}>
          {incomingArmies.map(a => {
            const remaining = Math.max(0, Math.round((a.arriveTime - Date.now()) / 1000));
            const f = factions[a.ownerId];
            const isFriendly = a.ownerId === city.ownerId;
            return (
              <div key={a.id} style={{ color: isFriendly ? 'var(--accent-green)' : 'var(--accent-red)', marginBottom: '2px' }}>
                {a.isTransfer ? '📦 调兵' : isFriendly ? '📩 援军' : '⚠️ 敌军'} {f?.name} {a.troops.toLocaleString()}人 → {remaining}s
              </div>
            );
          })}
          {outgoingArmies.map(a => {
            const remaining = Math.max(0, Math.round((a.arriveTime - Date.now()) / 1000));
            return (
              <div key={a.id} style={{ color: 'var(--accent-gold)', marginBottom: '2px' }}>
                📤 {a.isTransfer ? '调兵' : '出征'} {a.troops.toLocaleString()}人 → {cities[a.toCityId]?.name} {remaining}s
              </div>
            );
          })}
        </div>
      )}

      {/* ===== 操作按钮 ===== */}
      {isPlayerCity && (
        <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ fontSize: '13px', marginBottom: '2px', color: 'var(--accent-gold)' }}>行辕指令</div>
          {/* 军镇建设按钮 */}
          {!city.hasMilitaryBase && (
            <button className="btn btn-primary"
              onClick={() => buildMilitaryBase(city.id)}
              disabled={!canBuildBase}
              style={{ fontSize: '12px', borderColor: 'var(--accent-gold)' }}
              title={currentBases >= capacity ? `军镇名额已满 (${currentBases}/${capacity})` : (owner?.treasury ?? 0) < 8000 ? '国库资金不足8000' : '花费8000金建设军镇'}>
              🛠️ 设为军镇 (8000金)
            </button>
          )}
          <button className="btn btn-primary" onClick={() => cityAction(city.id, 'relief')} style={{ fontSize: '12px' }}>
            开仓赈灾 (2000金/+30民心)
          </button>
          <button className="btn btn-primary" onClick={() => cityAction(city.id, 'repair')} style={{ fontSize: '12px' }}>
            修补城墙 (3000金/+500防)
          </button>
          <button className="btn" onClick={() => cityAction(city.id, 'forceDraft')}
            style={{ fontSize: '12px', borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}>
            ⚡ 强制募兵 (10%人口转兵/-15民心)
          </button>
          {canReceiveTransfer && (
            <button className="btn"
              onClick={() => { setTransferTarget(city.id); setShowTransferModal(true); }}
              style={{ fontSize: '12px', borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }}>
              📦 调集兵力至此城
            </button>
          )}
        </div>
      )}

      {/* 敌方城市：进攻按钮 */}
      {!isPlayerCity && isAttackable && (
        <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '10px' }}>
          <button className="btn"
            onClick={() => { setAttackTarget(city.id); setShowDeployModal(true); }}
            style={{
              width: '100%', fontSize: '14px', padding: '10px',
              borderColor: 'var(--accent-red)', color: 'var(--accent-red)',
              fontWeight: 'bold'
            }}>
            ⚔ 发起进攻
          </button>
          {warStatus && (
            <div style={{ fontSize: '11px', color: 'var(--accent-red)', marginTop: '6px', textAlign: 'center' }}>
              我军与 {owner?.name} 正处于交战状态
            </div>
          )}
        </div>
      )}

      {/* 敌方但不相邻：纯展示 */}
      {!isPlayerCity && !isAttackable && (
        <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '10px', color: 'var(--text-dim)', fontSize: '12px' }}>
          {city.ownerId ? '此城与我领土不接壤，暂无法进攻。' : '无主荒地。'}
        </div>
      )}
    </div>
  );
}
