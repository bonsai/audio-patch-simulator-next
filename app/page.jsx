'use client';
import React, { useEffect, useState, useRef } from 'react';
import PatchCanvas from '../components/PatchCanvas';

export default function Home() {
  const [config, setConfig] = useState(null);
  const [devices, setDevices] = useState([]);
  const [msg, setMsg] = useState({ text: '', type: '', show: false });
  const [sourceFilter, setSourceFilter] = useState('all');
  const [cableType, setCableType] = useState('rca');
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const msgTimer = useRef(null);

  useEffect(() => {
    fetch('/config.json')
      .then(r => r.json())
      .then(cfg => {
        setConfig(cfg);
        const devs = (cfg.units || []).map(u => ({
          ...u,
          x: u.init?.x ?? 0,
          y: u.init?.y ?? 0,
          w: u.init?.w || 120,
          h: u.init?.h || 60,
          ports: u.ports || [],
        }));
        setDevices(devs);
      });
  }, []);

  function showMessage(text, type) {
    setMsg({ text, type, show: true });
    clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(m => ({ ...m, show: false })), 4000);
  }

  function getVisibleDevices() {
    if (sourceFilter === 'all') return devices;
    return devices.map(d => {
      if (d.category === 'source' && d.id !== sourceFilter) {
        return { ...d, _hidden: true };
      }
      return d;
    });
  }

  function exportPatch() {
    if (!canvasRef.current) return;
    const patch = canvasRef.current.exportPatch?.() || { devices: [], cables: [] };
    const blob = new Blob([JSON.stringify(patch, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'patch.json'; a.click(); URL.revokeObjectURL(url);
  }

  function importPatchFile(e) {
    const file = e.target.files[0];
    if (!file || !canvasRef.current) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const patch = JSON.parse(ev.target.result);
        canvasRef.current.importPatch?.(patch);
        showMessage('PATCH読込完了', 'ok');
      } catch { showMessage('PATCH読込失敗', 'ng'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function clearAll() { canvasRef.current?.clearCables?.(); }
  function checkAll() { canvasRef.current?.checkAll?.(); }

  const msgBg = msg.type === 'ok' ? '#1b5e20' : msg.type === 'ng' ? '#b71c1c' : '#f57f17';
  const msgBorder = msg.type === 'ok' ? '#2e7d32' : msg.type === 'ng' ? '#c62828' : '#f9a825';
  const msgBoxBg = msg.type === 'ok' ? '#e8f5e9' : msg.type === 'ng' ? '#ffebee' : '#fffde7';

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{
        height: 42,
        background: '#1a1a1a',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: 10,
        fontSize: 13,
        color: '#ddd',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 8, borderRight: '1px solid #333', paddingRight: 10 }}>
          <button onClick={clearAll} style={btnStyle}>配線クリア</button>
          <button onClick={checkAll} style={btnStyle}>接続チェック</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderRight: '1px solid #333', paddingRight: 10 }}>
          <label style={{ fontSize: 11, color: '#aaa' }}>ソース:</label>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={selStyle}>
            <option value="all">すべて表示</option>
            <option value="pc">PC</option>
            <option value="phone">スマホ</option>
            <option value="mic">マイク</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderRight: '1px solid #333', paddingRight: 10 }}>
          <label style={{ fontSize: 11, color: '#aaa' }}>ケーブル:</label>
          <select value={cableType} onChange={e => setCableType(e.target.value)} style={selStyle}>
            <option value="rca">RCA 赤白</option>
            <option value="rca35">RCA→3.5mm</option>
            <option value="xlr">XLR</option>
            <option value="trs">TRS 6.35</option>
            <option value="ts">TS 6.35</option>
            <option value="speaker">スピーカーケーブル</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportPatch} style={btnStyle}>PATCH書出し</button>
          <button onClick={() => fileInputRef.current?.click()} style={btnStyle}>PATCH読込</button>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importPatchFile} />
        </div>

        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#666' }}>
          ポートをドラッグして接続 / デバイスをドラッグして移動 / ケーブルクリックで削除
        </span>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {config && devices.length > 0 && (
          <PatchCanvas
            ref={canvasRef}
            config={config}
            devices={getVisibleDevices()}
            onMessage={showMessage}
            onPatchChange={patch => console.log('patch changed', patch)}
          />
        )}
      </div>

      {/* Message Toast */}
      {msg.show && (
        <div style={{
          position: 'fixed',
          bottom: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 20px',
          fontSize: 13,
          border: `1px solid ${msgBorder}`,
          background: msgBoxBg,
          color: msgBg,
          zIndex: 200,
          pointerEvents: 'none',
          whiteSpace: 'pre-line',
          textAlign: 'center',
          maxWidth: '80%',
          borderRadius: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

const btnStyle = {
  background: '#2a2a2a',
  border: '1px solid #444',
  color: '#ddd',
  padding: '4px 12px',
  fontSize: 12,
  cursor: 'pointer',
  borderRadius: 3,
};

const selStyle = {
  background: '#222',
  border: '1px solid #444',
  color: '#ddd',
  padding: '3px 8px',
  fontSize: 12,
  borderRadius: 3,
};
