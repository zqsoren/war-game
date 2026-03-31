import { useState } from 'react';
import { useWorldStore, type DiplomacyEventType } from '../store/WorldStore';

const EVENT_ICONS: Record<DiplomacyEventType, string> = {
  marriage: '💍', tribute: '💰', envoy: '📜',
  war_declaration: '🔥', peace_request: '🕊', betray: '🗡',
};

const EVENT_NAMES: Record<DiplomacyEventType, string> = {
  marriage: '求亲国书', tribute: '进贡书', envoy: '使臣来访',
  war_declaration: '宣战书', peace_request: '求和书', betray: '背叛檄文',
};

type ActionType = 'envoy' | 'marriage' | 'tribute' | 'war_declaration' | 'peace_request';

export default function DiplomacyPanel() {
  const factions = useWorldStore(state => state.factions);
  const diplomaticEvents = useWorldStore(state => state.diplomaticEvents);
  const respondToEvent = useWorldStore(state => state.respondToEvent);
  const sendDiplomaticAction = useWorldStore(state => state.sendDiplomaticAction);
  const playerFaction = factions['F_PLAYER'];

  const [activeTab, setActiveTab] = useState<'events' | 'actions' | 'relations'>('events');
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);

  if (!playerFaction) return null;

  const pendingEvents = diplomaticEvents.filter(e => e.toFactionId === 'F_PLAYER' && e.status === 'pending');
  const resolvedEvents = diplomaticEvents.filter(e => e.toFactionId === 'F_PLAYER' && e.status !== 'pending');

  const otherFactions = Object.values(factions).filter(f => !f.isPlayer);

  const getRelColor = (rel: number) => {
    if (rel >= 80) return '#4caf50';
    if (rel >= 60) return '#8bc34a';
    if (rel >= 40) return '#ffc107';
    return '#f44336';
  };

  const getRelLabel = (rel: number) => {
    if (rel >= 80) return '友好';
    if (rel >= 60) return '中立';
    if (rel >= 40) return '冷淡';
    return '敌意';
  };

  const handleAction = (type: ActionType, targetId: string) => {
    sendDiplomaticAction(type, targetId);
    setSelectedAction(null);
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
      {/* 标题 */}
      <div className="ministry-header" style={{ padding: '12px 14px', borderBottom: '2px solid var(--accent-gold)' }}>
        <span style={{ fontSize: '17px', color: 'var(--accent-gold)' }}>『鸿胪寺』</span>
        {pendingEvents.length > 0 && (
          <span style={{ background: 'var(--accent-red)', color: '#fff', borderRadius: '50%', padding: '1px 7px', fontSize: '11px', fontWeight: 'bold', marginLeft: '8px' }}>
            {pendingEvents.length}
          </span>
        )}
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--panel-border)' }}>
        {([['events', '国书'], ['actions', '外交'], ['relations', '邦交']] as const).map(([key, label]) => (
          <button key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            style={{
              flex: 1, padding: '6px', fontSize: '12px', cursor: 'pointer',
              background: activeTab === key ? 'rgba(207,170,110,0.1)' : 'transparent',
              color: activeTab === key ? 'var(--accent-gold)' : 'var(--text-dim)',
              border: 'none', borderBottom: activeTab === key ? '2px solid var(--accent-gold)' : '2px solid transparent',
              fontFamily: 'var(--font-family)'
            }}>
            {label}
            {key === 'events' && pendingEvents.length > 0 && ` (${pendingEvents.length})`}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {/* ===== 国书（事件列表） ===== */}
        {activeTab === 'events' && (
          <div style={{ padding: '8px' }}>
            {pendingEvents.length === 0 && resolvedEvents.length === 0 && (
              <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '20px', fontSize: '12px' }}>
                暂无外交往来
              </div>
            )}

            {pendingEvents.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--accent-gold)', marginBottom: '6px', fontWeight: 'bold' }}>
                  📮 待处理 ({pendingEvents.length})
                </div>
                {pendingEvents.map(evt => {
                  const fromF = factions[evt.fromFactionId];
                  const isHostile = evt.type === 'war_declaration' || evt.type === 'betray';
                  return (
                    <div key={evt.id} className="scroll-card" data-hostile={isHostile ? 'true' : undefined}>
                      <div className="scroll-top" />
                      <div className="scroll-body">
                        <div className="scroll-seal" style={{ background: fromF?.color || '#888' }}>
                          {EVENT_ICONS[evt.type]}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: isHostile ? 'var(--accent-red)' : 'var(--accent-gold)', marginBottom: '4px' }}>
                          {EVENT_NAMES[evt.type]}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-main)', marginBottom: '2px' }}>
                          来自 <b style={{ color: fromF?.color }}>{fromF?.name || '?'}</b>
                        </div>
                        {evt.payload?.message && (
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: '6px' }}>
                            「{evt.payload.message}」
                          </div>
                        )}
                        {evt.payload?.gold && (
                          <div style={{ fontSize: '11px', color: 'var(--accent-gold)' }}>
                            💰 贡金 {evt.payload.gold.toLocaleString()}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                          {evt.type !== 'betray' && (
                            <button className="btn btn-primary" onClick={() => respondToEvent(evt.id, true)}
                              style={{ fontSize: '11px', padding: '4px 12px', flex: 1 }}>
                              ✅ 接受
                            </button>
                          )}
                          <button className="btn" onClick={() => respondToEvent(evt.id, false)}
                            style={{ fontSize: '11px', padding: '4px 12px', flex: 1,
                              borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}>
                            {evt.type === 'betray' ? '⚔ 应战' : '❌ 拒绝'}
                          </button>
                        </div>
                      </div>
                      <div className="scroll-bottom" />
                    </div>
                  );
                })}
              </div>
            )}

            {resolvedEvents.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '6px' }}>
                  已处理 ({resolvedEvents.length})
                </div>
                {resolvedEvents.slice(0, 10).map(evt => {
                  const fromF = factions[evt.fromFactionId];
                  return (
                    <div key={evt.id} style={{ padding: '6px 8px', marginBottom: '4px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', fontSize: '11px', opacity: 0.7 }}>
                      <span style={{ color: fromF?.color }}>{fromF?.name}</span>
                      {' '}{EVENT_ICONS[evt.type]} {EVENT_NAMES[evt.type]}
                      {' → '}<span style={{ color: evt.status === 'accepted' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {evt.status === 'accepted' ? '已接受' : '已拒绝'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== 外交操作 ===== */}
        {activeTab === 'actions' && (
          <div style={{ padding: '8px' }}>
            {!selectedAction ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>选择外交行动:</div>
                <button className="btn" onClick={() => setSelectedAction('envoy')} style={{ fontSize: '12px', textAlign: 'left' }}>
                  📜 出使 <span style={{ color: 'var(--text-dim)', fontSize: '10px', marginLeft: '8px' }}>500金 / +5亲密</span>
                </button>
                <button className="btn" onClick={() => setSelectedAction('marriage')} style={{ fontSize: '12px', textAlign: 'left' }}>
                  💍 求亲 <span style={{ color: 'var(--text-dim)', fontSize: '10px', marginLeft: '8px' }}>5000金 / +15亲密</span>
                </button>
                <button className="btn" onClick={() => setSelectedAction('tribute')} style={{ fontSize: '12px', textAlign: 'left' }}>
                  💰 进贡 <span style={{ color: 'var(--text-dim)', fontSize: '10px', marginLeft: '8px' }}>3000金 / +10亲密</span>
                </button>
                <button className="btn" onClick={() => setSelectedAction('war_declaration')}
                  style={{ fontSize: '12px', textAlign: 'left', borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}>
                  🔥 宣战 <span style={{ fontSize: '10px', marginLeft: '8px' }}>-30亲密</span>
                </button>
                {playerFaction.atWarWith.length > 0 && (
                  <button className="btn" onClick={() => setSelectedAction('peace_request')}
                    style={{ fontSize: '12px', textAlign: 'left', borderColor: 'var(--accent-green)', color: 'var(--accent-green)' }}>
                    🕊 求和 <span style={{ fontSize: '10px', marginLeft: '8px' }}>仅对交战国</span>
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--accent-gold)' }}>
                    选择目标国:
                  </span>
                  <button className="btn" onClick={() => setSelectedAction(null)} style={{ padding: '2px 8px', fontSize: '11px' }}>
                    ← 返回
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {otherFactions
                    .filter(f => {
                      if (selectedAction === 'peace_request') return playerFaction.atWarWith.includes(f.id);
                      if (selectedAction === 'war_declaration') return !playerFaction.atWarWith.includes(f.id);
                      return !playerFaction.atWarWith.includes(f.id);
                    })
                    .map(f => {
                      const rel = playerFaction.relations[f.id] ?? 50;
                      return (
                        <button key={f.id} className="btn" onClick={() => handleAction(selectedAction, f.id)}
                          style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>
                            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: f.color, marginRight: 6 }} />
                            {f.name}
                          </span>
                          <span style={{ color: getRelColor(rel), fontSize: '11px' }}>
                            {rel} {getRelLabel(rel)}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== 邦交一览 ===== */}
        {activeTab === 'relations' && (
          <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {otherFactions.map(f => {
              const rel = playerFaction.relations[f.id] ?? 50;
              const atWar = playerFaction.atWarWith.includes(f.id);
              const fCities = Object.values(useWorldStore.getState().cities).filter(c => c.ownerId === f.id);
              return (
                <div key={f.id} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: f.color, marginRight: 6 }} />
                      {f.name}
                    </span>
                    <span style={{ fontSize: '11px', color: atWar ? 'var(--accent-red)' : getRelColor(rel), fontWeight: 'bold' }}>
                      {atWar ? '⚔ 交战' : getRelLabel(rel)}
                    </span>
                  </div>
                  {/* 亲密度条 */}
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
                    <div style={{ width: `${rel}%`, height: '100%', background: getRelColor(rel), borderRadius: '3px', transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)' }}>
                    <span>亲密度 {rel}</span>
                    <span>{fCities.length} 城</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
