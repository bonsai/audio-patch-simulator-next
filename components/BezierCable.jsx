'use client';
import React, { useState } from 'react';

export default function BezierCable({ path, color, glow, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <path
      d={path}
      fill="none"
      stroke={color}
      strokeWidth={hover ? 3.5 : 2.2}
      style={{
        filter: glow ? 'drop-shadow(0 0 2px ' + color + ')' : 'none',
        pointerEvents: 'stroke',
        cursor: 'pointer',
        transition: 'stroke-width 0.1s'
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    />
  );
}
