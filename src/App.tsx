import { useEffect, useState } from 'react';
import { useWorldStore } from './store/WorldStore';
import { generateWorld } from './utils/MapGenerator';
import { startTickEngine, stopTickEngine } from './engine/TickEngine';
import MapSurface from './components/MapSurface';
import CeoPanel from './components/CeoPanel';
import CityPanel from './components/CityPanel';
import LogPanel from './components/LogPanel';
import DeployModal from './components/DeployModal';
import TransferModal from './components/TransferModal';

type MobileTab = 'hub' | 'map' | 'city';

function App() {
  const [initialized, setInitialized] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('map');

  const eraYear = useWorldStore(state => state.eraYear);
  const eraMonth = useWorldStore(state => state.eraMonth);
  const isPaused = useWorldStore(state => state.isPaused);
  const mapViewMode = useWorldStore(state => state.mapViewMode);
  const marchingArmies = useWorldStore(state => state.marchingArmies);
  const saveGame = useWorldStore(state => state.saveGame);
  const diplomaticEvents = useWorldStore(state => state.diplomaticEvents);

  const pendingEvents = diplomaticEvents.filter(e => e.toFactionId === 'F_PLAYER' && e.status === 'pending');

  useEffect(() => {
    localStorage.removeItem('darkflow_save');
    const { cities, factions } = generateWorld();
    useWorldStore.getState().initWorld(cities, factions);
    setInitialized(true);

    startTickEngine();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        useWorldStore.setState({ isPaused: true });
        saveGame();
      } else {
        useWorldStore.setState({ isPaused: false });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopTickEngine();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (!initialized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#cfaa6e', fontWeight: 'bold', fontSize: '24px' }}>
        天地凝结中...
      </div>
    );
  }

  const attackArmies = marchingArmies.filter(a => !a.isTransfer).length;
  const transferArmies = marchingArmies.filter(a => a.isTransfer).length;

  return (
    <div className="layout-container">
      {/* 顶部卷轴 */}
      <div className="time-scroll-bar glass-panel">
        <span className="gold-text">大业 {eraYear} 年 {eraMonth} 月</span>
        {marchingArmies.length > 0 && (
          <span style={{ marginLeft: '14px', fontSize: '12px', color: 'var(--accent-red)' }}>
            {attackArmies > 0 && `⚔${attackArmies}`}
            {attackArmies > 0 && transferArmies > 0 && ' · '}
            {transferArmies > 0 && `📦${transferArmies}`}
            {' '}行进中
          </span>
        )}
      </div>

      {/* 左侧 */}
      <div className={`side-panel ${mobileTab === 'hub' ? 'mobile-visible' : ''}`}>
        <CeoPanel />
        <LogPanel />
      </div>

      {/* 地图 */}
      <div className={`map-container ${mobileTab === 'map' ? 'mobile-visible' : ''}`}>
        <MapSurface />
      </div>

      {/* 右侧 */}
      <div className={`side-panel ${mobileTab === 'city' ? 'mobile-visible' : ''}`}>
        <CityPanel />
        <div style={{ flexGrow: 1 }}></div>

        <div className="glass-panel" style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
          <div className="ministry-header" style={{ fontSize: '13px' }}>系统</div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button className={`btn ${mapViewMode === 'terrain' ? 'btn-primary' : ''}`}
              onClick={() => useWorldStore.setState({ mapViewMode: 'terrain' })}
              style={{ fontSize: '11px', flex: 1 }}>
              🏔 地形
            </button>
            <button className={`btn ${mapViewMode === 'political' ? 'btn-primary' : ''}`}
              onClick={() => useWorldStore.setState({ mapViewMode: 'political' })}
              style={{ fontSize: '11px', flex: 1 }}>
              🏴 势力
            </button>
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button className="btn" onClick={() => { saveGame(); alert('已存档') }}
              style={{ fontSize: '11px', flex: 1 }}>
              💾 存档
            </button>
            <button className="btn" onClick={() => {
              if (confirm('确定重新开始吗？')) {
                localStorage.removeItem('darkflow_save');
                const { cities, factions } = generateWorld();
                useWorldStore.getState().initWorld(cities, factions);
              }
            }} style={{ fontSize: '11px', flex: 1, color: 'var(--accent-red)' }}>
              🔄 新局
            </button>
          </div>
          {isPaused && <div style={{ color: 'var(--accent-red)', fontSize: '10px' }}>[冻结中]</div>}
        </div>
      </div>

      {/* 手机端底部导航 */}
      <div className="mobile-nav">
        <div className="mobile-nav-inner">
          <button className={`mobile-nav-btn ${mobileTab === 'hub' ? 'active' : ''}`} onClick={() => setMobileTab('hub')}>
            <span className="nav-icon">🏛</span>
            <span>中枢{pendingEvents.length > 0 ? ` (${pendingEvents.length})` : ''}</span>
          </button>
          <button className={`mobile-nav-btn ${mobileTab === 'map' ? 'active' : ''}`} onClick={() => setMobileTab('map')}>
            <span className="nav-icon">🗺</span>
            <span>地图</span>
          </button>
          <button className={`mobile-nav-btn ${mobileTab === 'city' ? 'active' : ''}`} onClick={() => setMobileTab('city')}>
            <span className="nav-icon">🏰</span>
            <span>城池</span>
          </button>
        </div>
      </div>

      <DeployModal />
      <TransferModal />
    </div>
  );
}

export default App;
