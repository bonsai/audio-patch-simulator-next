'use client';
import React from 'react';

function PortIcon({ type, color, size = 12 }) {
  const s = { width: size, height: size };
  if (type === 'rca') {
    return (
      <g>
        <circle r={size/2} fill="none" stroke={color || '#888'} strokeWidth="1.5" />
        <circle r={size/4} fill={color || '#ccc'} />
      </g>
    );
  }
  if (type === 'xlr') {
    return (
      <g>
        <circle r={size/2 + 1} fill="none" stroke="#8B4513" strokeWidth="2" />
        <circle r={2} fill="#aaa" cx="-2" cy="-1" />
        <circle r={2} fill="#aaa" cx="2" cy="-1" />
        <circle r={2} fill="#aaa" cx="0" cy="2" />
      </g>
    );
  }
  if (type === 'jack35') {
    return (
      <g>
        <rect x={-size/2} y={-size/3} width={size} height={size*0.6} rx="2" fill="none" stroke="#2e7d32" strokeWidth="1.5" />
        <line x1={-size/2 - 2} y1={0} x2={-size/2} y2={0} stroke="#aaa" strokeWidth="2" />
      </g>
    );
  }
  if (type === 'terminal') {
    return <circle r={size/2 - 1} fill="#333" stroke="#666" strokeWidth="1" strokeDasharray="2 1" />;
  }
  return <circle r={size/2} fill="none" stroke="#888" strokeWidth="1.5" />;
}

export default function DeviceNode({ dev, style, onDeviceDown, onPortDown, onPortUp }) {
  return (
    <g transform={`translate(${dev.x},${dev.y})`}
       style={{ cursor: 'grab' }}
       onMouseDown={e => onDeviceDown(e, dev)}
       onTouchStart={e => onDeviceDown(e.touches[0], dev)}
    >
      <rect x={0} y={0} width={dev.w} height={dev.h}
        fill={style.deviceFill || '#111'}
        stroke={style.deviceStroke || '#444'}
        strokeWidth={style.deviceStrokeWidth || 1}
      />
      <text x={6} y={15}
        fill={style.deviceTitleFill || '#fff'}
        fontSize={style.deviceTitleFontSize || 11}
        fontWeight="bold"
        style={{ pointerEvents: 'none', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}
      >
        {dev.name}
      </text>
      {(dev.ports || []).map(p => {
        let cx, cy;
        switch (p.side) {
          case 'left':   cx = 0; cy = p.yoff; break;
          case 'right':  cx = dev.w; cy = p.yoff; break;
          case 'top':    cx = p.xoff; cy = 0; break;
          case 'bottom': cx = p.xoff; cy = dev.h; break;
          default: cx = p.xoff ?? 30; cy = p.yoff ?? 0;
        }
        return (
          <g key={p.id} transform={`translate(${cx},${cy})`}
             style={{ cursor: 'crosshair' }}
             onMouseDown={e => { e.stopPropagation(); onPortDown(e, p.id); }}
             onMouseUp={e => { e.stopPropagation(); onPortUp(e, p.id); }}
             onTouchStart={e => { e.stopPropagation(); onPortDown(e.touches[0], p.id); }}
             onTouchEnd={e => { e.stopPropagation(); onPortUp(e.changedTouches[0], p.id); }}
          >
            <PortIcon type={p.type} color={p.color || '#888'} />
            <text
              x={p.side === 'left' ? 10 : p.side === 'right' ? -10 : 0}
              y={p.side === 'top' ? -8 : p.side === 'bottom' ? 14 : 3}
              textAnchor={p.side === 'left' ? 'start' : p.side === 'right' ? 'end' : 'middle'}
              fill={style.portLabelFill || '#ccc'}
              fontSize={style.portLabelFontSize || 9}
              style={{ pointerEvents: 'none', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}
            >
              {p.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
