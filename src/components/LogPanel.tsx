import { useWorldStore } from '../store/WorldStore';

export default function LogPanel() {
  const logs = useWorldStore(state => state.logs);

  return (
    <div className="glass-panel log-panel-fixed">
      <div className="ministry-header" style={{ padding: '10px 14px 6px', flexShrink: 0 }}>
        <span style={{ fontSize: '14px' }}>急递奏报</span>
        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{logs.length}条</span>
      </div>
      <div className="log-stream">
        {logs.map(log => (
          <div key={log.id} className={`log-entry log-type-${log.type}`}>
            <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginBottom: '2px' }}>
              大业{log.eraYear}年{log.eraMonth}月
            </div>
            <div style={{ fontSize: '11px' }}>{log.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
