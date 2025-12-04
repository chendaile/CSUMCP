import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

type ApiMeta = {
  service?: string;
  routes?: string[];
};

type FetchState = 'loading' | 'ready' | 'error';

const routeTag = (route: string): string => {
  if (route.includes('jwc')) return '教务';
  if (route.includes('library')) return '图书馆';
  if (route.includes('ecard')) return '校园卡';
  if (route.includes('bus')) return '通勤';
  return '服务';
};

const prettify = (text: string) => {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

function App() {
  const [metaState, setMetaState] = useState<FetchState>('loading');
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [requestUrl, setRequestUrl] = useState('/api/meta');
  const [responseText, setResponseText] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [visiblePanels, setVisiblePanels] = useState({
    status: false,
    routes: false,
    console: false,
  });
  const statusRef = useRef<HTMLDivElement | null>(null);
  const routesRef = useRef<HTMLDivElement | null>(null);
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const scrollToConsole = () => {
    if (consoleRef.current) {
      consoleRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    refreshMeta();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisiblePanels((prev) => {
              const key = entry.target.getAttribute('data-panel-key') as
                | 'status'
                | 'routes'
                | 'console'
                | null;
              if (!key || prev[key]) return prev;
              return { ...prev, [key]: true };
            });
          }
        });
      },
      { threshold: 0.2 }
    );

    [statusRef, routesRef, consoleRef].forEach((ref) => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => observer.disconnect();
  }, []);

  const refreshMeta = async () => {
    setMetaState('loading');
    setResponseText('');
    try {
      const res = await fetch('/api/meta');
      const data: ApiMeta = await res.json();
      setMeta(data);
      setMetaState('ready');
      setRequestUrl('/api/meta');
      setLastUpdated(new Date().toLocaleTimeString());
      setResponseText(JSON.stringify(data, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMetaState('error');
      setResponseText(`加载失败: ${message}`);
    }
  };

  const callApi = async () => {
    setIsCalling(true);
    setResponseText('');
    try {
      const res = await fetch(requestUrl);
      const text = await res.text();
      setResponseText(prettify(text));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResponseText(`请求失败: ${message}`);
    } finally {
      setIsCalling(false);
    }
  };

  const statusLabel = useMemo(() => {
    if (metaState === 'loading') return '加载中';
    if (metaState === 'ready') return '在线';
    return '不可用';
  }, [metaState]);

  const accentBadge = useMemo(() => {
    if (metaState === 'ready') return 'Live';
    if (metaState === 'loading') return 'Syncing';
    return 'Offline';
  }, [metaState]);

  return (
    <div className="page">
      <header className="hero">
        <div className="hero__bg" />
        <div className="hero__content">
          <h1 className="title">CSUMCP</h1>
          <p className="subtitle">
            中南大学 CSU 校园 API × MCP 代理：教务、图书馆、校车、校园卡一站式接入，可本地调用也可走 MCP。
          </p>
          <div className="hero__actions">
            <button className="btn btn-primary" onClick={scrollToConsole}>
              进入 API 控制台
            </button>
            <a className="btn btn-ghost" href="https://github.com/chendaile/CSUMCP" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a className="btn btn-ghost" href="https://www.npmjs.com/package/csu-mcp" target="_blank" rel="noreferrer">
              NPM
            </a>
          </div>
        </div>
      </header>

      <main className="content">
        <section
          className={`panel status-card reveal ${visiblePanels.status ? 'is-visible' : ''}`}
          ref={statusRef}
          data-panel-key="status"
        >
          <div className="status-main">
            <div>
              <p className="label">服务状态</p>
              <div className="status-row">
                <span className={`status-dot status-${metaState}`} />
                <h2 className="status-text">{statusLabel}</h2>
                <span className="status-chip">{accentBadge}</span>
              </div>
              <p className="hint">
                {meta?.service ?? 'CSU MCP'} · {meta?.routes?.length ?? 0} 条路由
              </p>
            </div>
            <div className="status-meta">
              <div>
                <p className="label">最近同步</p>
                <p className="metric">{lastUpdated ?? '等待中'}</p>
              </div>
              <div>
                <p className="label">测试入口</p>
                <p className="metric">/api/meta</p>
              </div>
            </div>
          </div>
          <div className="status-actions">
          </div>
        </section>

        <section
          id="routes"
          className={`panel reveal ${visiblePanels.routes ? 'is-visible' : ''}`}
          ref={routesRef}
          data-panel-key="routes"
        >
          <div className="panel-header">
            <div>
              <p className="label">接口目录</p>
              <h2 className="section-title">Routes · 服务列表</h2>
            </div>
          </div>

          <div className="routes-grid">
            {(meta?.routes ?? []).map((route) => (
              <article key={route} className="route-card">
                <div className="route-top">
                  <span className="tag">{routeTag(route)}</span>
                  <button className="tiny-btn" onClick={() => setRequestUrl(route)}>
                    填入
                  </button>
                </div>
                <p className="route-path">{route}</p>
                <p className="hint">
                  请根据占位符补充 id / pwd / term 等参数，然后在下方控制台直接调用。
                </p>
              </article>
            ))}
            {(meta?.routes ?? []).length === 0 && (
              <div className="empty">暂无路由数据，请刷新或检查服务。</div>
            )}
          </div>
        </section>

        <section
          id="console"
          className={`panel console reveal ${visiblePanels.console ? 'is-visible' : ''}`}
          ref={consoleRef}
          data-panel-key="console"
        >
          <div className="panel-header">
            <div>
              <p className="label">Live Console</p>
              <h2 className="section-title">直接请求 API</h2>
            </div>
            <div className="header-actions">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setRequestUrl('/api/meta');
                  refreshMeta();
                }}
              >
                重新同步 /api/meta
              </button>
              <span className="pill subtle">实时预览</span>
            </div>
          </div>

          <div className="console-form">
            <div className="field">
              <label>Request URL</label>
              <input
                className="input"
                value={requestUrl}
                onChange={(e) => setRequestUrl(e.target.value)}
                placeholder="/api/meta 或其它完整路径"
              />
            </div>

            <div className="console-actions">
              <button className="btn btn-ghost" onClick={() => setResponseText('')}>
                清空结果
              </button>
              <button className="btn btn-primary" onClick={callApi} disabled={isCalling}>
                {isCalling ? '请求中…' : '发送请求'}
              </button>
            </div>
          </div>

          <div className="response">
            <div className="response-bar">
              <p className="label">Response</p>
              <span className="pill subtle">实时</span>
            </div>
            <pre className="response-text">
              {responseText || '等待请求，或点击上方“重新同步 /api/meta”快速查看服务健康状态。'}
            </pre>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
