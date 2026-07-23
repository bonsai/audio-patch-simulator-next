'use client';
import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import BezierCable from './BezierCable';
import DeviceNode from './DeviceNode';

function toSVGPoint(svg, clientX, clientY) {
  if (!svg) return { x: 0, y: 0 };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  return ctm ? pt.matrixTransform(ctm.inverse()) : { x: clientX, y: clientY };
}

function bezier(a, b) {
  const dy = Math.max(Math.abs(b.y - a.y) * 0.5, 30);
  return `M${a.x} ${a.y} C${a.x} ${a.y + dy}, ${b.x} ${b.y - dy}, ${b.x} ${b.y}`;
}

function getPortXY(dev, port) {
  let cx, cy;
  switch (port.side) {
    case 'left':   cx = 0; cy = port.yoff; break;
    case 'right':  cx = dev.w; cy = port.yoff; break;
    case 'top':    cx = port.xoff; cy = 0; break;
    case 'bottom': cx = port.xoff; cy = dev.h; break;
    default: cx = port.xoff ?? 30; cy = port.yoff ?? 0;
  }
  return { x: dev.x + cx, y: dev.y + cy };
}

function buildPortMap(devices) {
  const map = {};
  devices.forEach(d => {
    (d.ports || []).forEach(p => {
      map[p.id] = { ...p, device: d };
    });
  });
  return map;
}

function validatePair(portMap, from, to, rules) {
  const pf = portMap[from];
  const pt = portMap[to];
  if (!pf || !pt) return { ok: false, reason: '不明なポート' };
  if (pf.device.id === pt.device.id) return { ok: false, reason: '同じ機器への接続' };
  const sf = pf.signal;
  const st = pt.signal;

  const key = (sf === 'phono' && st === 'phono') ? 'phono_to_phono'
    : (sf === 'line' && st === 'line') ? 'line_to_line'
    : (sf === 'mic' && st === 'mic') ? 'mic_to_mic'
    : (sf === 'ground' && st === 'ground') ? 'ground_to_ground'
    : (sf === 'speaker' && st === 'speaker') ? 'speaker_to_speaker'
    : (sf === 'phono' && (st === 'line' || st === 'mic')) ? 'phono_to_line'
    : ((sf === 'line' || sf === 'mic') && st === 'phono') ? 'line_to_phono'
    : (sf === 'line' && st === 'mic') ? 'line_to_mic'
    : (sf === 'mic' && st === 'line') ? 'mic_to_line'
    : (sf === 'speaker' && st !== 'speaker') ? 'speaker_to_line'
    : (sf !== 'speaker' && st === 'speaker') ? 'speaker_to_line'
    : 'line_to_line';

  if (rules[key]) return rules[key];
  if (sf === st) return { ok: true, note: `${sf}→${sf} 接続` };
  return { ok: false, reason: `${sf} と ${st} のレベル・端子形状が異なります` };
}

const PatchCanvas = forwardRef(function PatchCanvas({ config, devices: initialDevices, onMessage, onPatchChange }, ref) {
  const svgRef = useRef(null);
  const [devices, setDevices] = useState(initialDevices || []);
  const [cables, setCables] = useState([]);
  const [tempLine, setTempLine] = useState(null);
  const [draggingDevice, setDraggingDevice] = useState(null);

  const portMap = buildPortMap(devices);
  const rules = config?.rules || {};
  const style = config?.style || {};

  useImperativeHandle(ref, () => ({
    clearCables: () => { setCables([]); onMessage?.('配線をクリアしました', 'ok'); onPatchChange?.({ devices, cables: [] }); },
    checkAll: () => {
      const checked = cables.map(c => {
        const res = validatePair(portMap, c.from, c.to, rules);
        return { ...c, ok: res.ok };
      });
      setCables(checked);
      const bad = checked.filter(c => !c.ok);
      if (bad.length) onMessage?.(`問題: ${bad.length}件の不適切な接続`, 'ng');
      else onMessage?.(`全${checked.length}件 OK`, 'ok');
    },
    exportPatch: () => ({ devices: devices.map(d => ({ id: d.id, x: d.x, y: d.y })), cables: cables.map(c => ({ from: c.from, to: c.to })) }),
    importPatch: (patch) => {
      if (patch.devices) {
        setDevices(prev => prev.map(d => {
          const pd = patch.devices.find(p => p.id === d.id);
          return pd ? { ...d, x: pd.x, y: pd.y } : d;
        }));
      }
      if (patch.cables) {
        setCables(patch.cables.map((c, i) => {
          const res = validatePair(portMap, c.from, c.to, rules);
          return {
            id: c.id || (Date.now() + i),
            from: c.from, to: c.to,
            ok: res.ok,
            color: res.ok ? '#4caf50' : '#f44336',
            ground: portMap[c.from]?.signal === 'ground' || portMap[c.to]?.signal === 'ground'
          };
        }));
      }
    },
  }));

  // デバイス更新
  useEffect(() => { setDevices(initialDevices); }, [initialDevices]);

  // Device dragging
  const onDeviceDown = useCallback((e, dev) => {
    if (e.button !== 0) return;
    e.preventDefault?.();
    setDraggingDevice({
      id: dev.id,
      ox: e.clientX,
      oy: e.clientY,
      x: dev.x,
      y: dev.y,
    });
  }, []);

  const onPortDown = useCallback((e, portId) => {
    const svg = svgRef.current;
    const c = toSVGPoint(svg, e.clientX, e.clientY);
    setTempLine({ from: portId, x: c.x, y: c.y });
  }, []);

  useEffect(() => {
    function onMove(e) {
      if (draggingDevice) {
        const dx = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - draggingDevice.ox;
        const dy = (e.clientY ?? e.touches?.[0]?.clientY ?? 0) - draggingDevice.oy;
        setDevices(prev => prev.map(d => d.id === draggingDevice.id ? { ...d, x: draggingDevice.x + dx, y: draggingDevice.y + dy } : d));
      }
      if (tempLine) {
        const cx = e.clientX ?? e.touches?.[0]?.clientX ?? tempLine.x;
        const cy = e.clientY ?? e.touches?.[0]?.clientY ?? tempLine.y;
        const pt = toSVGPoint(svgRef.current, cx, cy);
        setTempLine(t => t ? { ...t, x: pt.x, y: pt.y } : null);
      }
    }
    function onUp(e) {
      if (draggingDevice) {
        setDraggingDevice(null);
        onPatchChange?.({ devices, cables });
      }
      if (tempLine) {
        setTempLine(null);
      }
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [draggingDevice, tempLine, devices, cables, onPatchChange]);

  function onPortUp(e, portId) {
    if (!tempLine || !tempLine.from) return;
    if (portId === tempLine.from) { setTempLine(null); return; }
    const exists = cables.some(c =>
      (c.from === tempLine.from && c.to === portId) || (c.from === portId && c.to === tempLine.from)
    );
    if (exists) { onMessage('すでに接続されています', 'warn'); setTempLine(null); return; }
    addCable(tempLine.from, portId);
    setTempLine(null);
  }

  function addCable(from, to) {
    const okResult = validatePair(portMap, from, to, rules);
    const isL = from.includes('_l') || to.includes('_l') || from.includes('l_in') || to.includes('l_in');
    const isR = from.includes('_r') || to.includes('_r') || from.includes('r_in') || to.includes('r_in');
    const isGround = portMap[from]?.signal === 'ground' || portMap[to]?.signal === 'ground';
    let color = okResult.ok ? '#4caf50' : '#f44336';
    if (isL && !isGround) color = '#2196f3';
    if (isR && !isGround) color = '#f44336';
    if (isGround) color = '#9e9e9e';

    setCables(prev => {
      const next = [...prev, { id: Date.now() + Math.random(), from, to, color, ok: okResult.ok, ground: isGround }];
      onPatchChange?.({ devices, cables: next });
      return next;
    });

    if (okResult.ok) onMessage?.('接続成立', 'ok');
    else onMessage?.('不適切な接続: ' + (okResult.reason || ''), 'ng');
  }

  function removeCable(id) {
    setCables(prev => {
      const next = prev.filter(c => c.id !== id);
      onPatchChange?.({ devices, cables: next });
      return next;
    });
  }

  return (
    <svg ref={svgRef} width="100%" height="100%" style={{ background: style.bgColor || '#0a0a0a' }}>
      {/* Grid */}
      <defs>
        <pattern id="grid" width={style.gridStep || 20} height={style.gridStep || 20} patternUnits="userSpaceOnUse">
          <path d={`M ${style.gridStep || 20} 0 L 0 0 0 ${style.gridStep || 20}`} fill="none" stroke={style.gridColor || '#222'} strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* Cables */}
      {cables.map(c => {
        const pf = portMap[c.from];
        const pt = portMap[c.to];
        if (!pf || !pt) return null;
        const a = getPortXY(pf.device, pf);
        const b = getPortXY(pt.device, pt);
        return (
          <BezierCable key={c.id}
            path={bezier(a, b)}
            color={c.ok ? c.color : '#f44336'}
            glow={c.ground}
            onClick={() => removeCable(c.id)}
          />
        );
      })}

      {/* Temp line */}
      {tempLine && portMap[tempLine.from] && (() => {
        const a = getPortXY(portMap[tempLine.from].device, portMap[tempLine.from]);
        const b = { x: tempLine.x, y: tempLine.y };
        return (
          <path d={bezier(a, b)} stroke="#666" strokeWidth="2" strokeDasharray="4 3" fill="none" />
        );
      })()}

      {/* Devices */}
      {devices.filter(d => !d._hidden).map(dev => (
        <DeviceNode key={dev.id} dev={dev} style={style}
          onDeviceDown={onDeviceDown}
          onPortDown={onPortDown}
          onPortUp={onPortUp}
        />
      ))}
    </svg>
  );
});

export default PatchCanvas;
