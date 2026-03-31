import { useWorldStore } from '../store/WorldStore';
import DiplomacyPanel from './DiplomacyPanel';

export default function CeoPanel() {
  const playerFactionId = 'F_PLAYER';
  const faction = useWorldStore(state => state.factions[playerFactionId]);
  const factions = useWorldStore(state => state.factions);
  const updatePolicy = useWorldStore(state => state.updatePolicy);
  const eraYear = useWorldStore(state => state.eraYear);
  const eraMonth = useWorldStore(state => state.eraMonth);
  const addLog = useWorldStore(state => state.addLog);
  const cities = useWorldStore(state => state.cities);
  const marchingArmies = useWorldStore(state => state.marchingArmies);
  const leftPanelTab = useWorldStore(state => state.leftPanelTab);
  const diplomaticEvents = useWorldStore(state => state.diplomaticEvents);

  if (!faction) return null;

  const playerCities = Object.values(cities).filter(c => c.ownerId === playerFactionId);
  const totalPop = playerCities.reduce((s, c) => s + c.population, 0);
  const totalTroops = playerCities.reduce((s, c) => s + c.troops, 0);
  const playerArmies = marchingArmies.filter(a => a.ownerId === playerFactionId);
  const pendingEvents = diplomaticEvents.filter(e => e.toFactionId === 'F_PLAYER' && e.status === 'pending');

  const warEnemies = faction.atWarWith.map(id => factions[id]).filter(Boolean);

  // Tab 切换
  const setTab = (tab: 'hub' | 'diplomacy') => useWorldStore.setState({ leftPanelTab: tab });

  if (leftPanelTab === 'diplomacy') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Tab 工具栏 */}
        <div style={{ display: 'flex', marginBottom: '2px' }}>
          <button className="btn" onClick={() => setTab('hub')}
            style={{ flex: 1, fontSize: '11px', borderRadius: '6px 0 0 0', padding: '6px' }}>
            中枢
          </button>
          <button className="btn btn-primary" onClick={() => setTab('diplomacy')}
            style={{ flex: 1, fontSize: '11px', borderRadius: '0 6px 0 0', padding: '6px', position: 'relative' }}>
            鸿胪寺
            {pendingEvents.length > 0 && (
              <span style={{ position: 'absolute', top: 2, right: 4, background: 'var(--accent-red)', color: '#fff', borderRadius: '50%', padding: '0 5px', fontSize: '9px' }}>
                {pendingEvents.length}
              </span>
            )}
          </button>
        </div>
        <DiplomacyPanel />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Tab 工具栏 */}
      <div style={{ display: 'flex', marginBottom: '2px' }}>
        <button className="btn btn-primary" onClick={() => setTab('hub')}
          style={{ flex: 1, fontSize: '11px', borderRadius: '6px 0 0 0', padding: '6px' }}>
          中枢
        </button>
        <button className="btn" onClick={() => setTab('diplomacy')}
          style={{ flex: 1, fontSize: '11px', borderRadius: '0 6px 0 0', padding: '6px', position: 'relative' }}>
          鸿胪寺
          {pendingEvents.length > 0 && (
            <span style={{ position: 'absolute', top: 2, right: 4, background: 'var(--accent-red)', color: '#fff', borderRadius: '50%', padding: '0 5px', fontSize: '9px' }}>
              {pendingEvents.length}
            </span>
          )}
        </button>
      </div>

      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0', overflowY: 'auto' }}>
        {/* 概况 */}
        <div className="ministry-header" style={{ padding: '12px 14px', borderBottom: '2px solid var(--accent-gold)' }}>
          <span style={{ fontSize: '17px', color: 'var(--accent-gold)' }}>『天朝中枢』</span>
          <span style={{ fontSize: '13px' }}>💰 {faction.treasury.toLocaleString()}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2px', padding: '6px 14px', fontSize: '11px' }}>
          <div>
            <div style={{ color: 'var(--text-dim)' }}>城池</div>
            <div style={{ fontFamily: 'monospace', fontSize: '15px' }}>{playerCities.length}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)' }}>总人口</div>
            <div style={{ fontFamily: 'monospace', fontSize: '15px' }}>{totalPop.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)' }}>总兵力</div>
            <div style={{ fontFamily: 'monospace', fontSize: '15px', color: 'var(--accent-red)' }}>{totalTroops.toLocaleString()}</div>
          </div>
        </div>

        {playerArmies.length > 0 && (
          <div style={{ padding: '2px 14px', fontSize: '11px', color: 'var(--accent-gold)' }}>
            ⚔ {playerArmies.filter(a => !a.isTransfer).length} 出征 · 📦 {playerArmies.filter(a => a.isTransfer).length} 调遣
          </div>
        )}

        {warEnemies.length > 0 && (
          <div style={{ padding: '4px 14px', fontSize: '11px', background: 'rgba(211,47,47,0.1)', borderTop: '1px solid var(--accent-red)' }}>
            <span style={{ color: 'var(--accent-red)', fontWeight: 'bold' }}>🔥 交战:</span>
            {warEnemies.map(e => (
              <span key={e.id} style={{ marginLeft: '6px', color: e.color, fontWeight: 'bold' }}>{e.name}</span>
            ))}
          </div>
        )}

        {/* 户部 */}
        <div className="ministry-card" style={{ borderTop: '1px solid var(--panel-border)' }}>
          <div className="ministry-header" style={{ fontSize: '13px' }}>戶部</div>
          <div>
            <div style={{ display: 'flex', gap: '5px' }}>
              {(['low', 'normal', 'high'] as const).map(rate => (
                <button key={rate} className={`btn ${faction.taxRate === rate ? 'btn-primary' : ''}`}
                  onClick={() => updatePolicy(playerFactionId, { taxRate: rate })}
                  style={{ fontSize: '11px', padding: '3px 8px' }}>
                  {rate === 'low' ? '低赋' : rate === 'normal' ? '常轨' : '苛政'}
                </button>
              ))}
            </div>
          </div>
          <button className={`btn ${faction.farmBonusActive ? 'btn-primary' : ''}`}
            onClick={() => updatePolicy(playerFactionId, { farmBonusActive: !faction.farmBonusActive })}
            style={{ fontSize: '11px' }}>
            {faction.farmBonusActive ? '✓ 农桑令' : '推行《农桑令》'}
          </button>
          <div style={{ fontSize: '9px', color: 'var(--text-dim)' }}>
            ⚠ 民心达100时人口才会自然增长
          </div>
        </div>

        {/* 兵部 */}
        <div className="ministry-card" style={{ borderTop: '1px solid var(--panel-border)' }}>
          <div className="ministry-header" style={{ fontSize: '13px' }}>兵部</div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button className={`btn ${faction.conscriptionPolicy === 'none' ? 'btn-primary' : ''}`}
              onClick={() => updatePolicy(playerFactionId, { conscriptionPolicy: 'none' })}
              style={{ fontSize: '11px', padding: '3px 8px' }}>
              休养生息
            </button>
            <button className={`btn ${faction.conscriptionPolicy === 'normal' ? 'btn-primary' : ''}`}
              onClick={() => {
                updatePolicy(playerFactionId, { conscriptionPolicy: 'normal' });
                addLog({ eraYear, eraMonth, message: '颁布《募兵令》，恢复率 +80%！', type: 'military' });
              }}
              style={{ fontSize: '11px', padding: '3px 8px' }}>
              📜 募兵令(+80%)
            </button>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
            恢复率: {faction.conscriptionPolicy === 'normal' ? '18%' : '10%'}/min
          </div>
        </div>
      </div>
    </div>
  );
}
