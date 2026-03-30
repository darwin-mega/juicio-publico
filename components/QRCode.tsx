'use client';

// ============================================================
// components/QRCode.tsx
// Componente de QR usando qrcode.react (ya instalado).
// Renderiza un QR SVG con estilo oscuro acorde al diseño.
// ============================================================

import { QRCodeSVG } from 'qrcode.react';

interface QRCodeProps {
  value: string;
  size?: number;
}

export default function QRCode({ value, size = 180 }: QRCodeProps) {
  return (
    <div
      style={{
        background: '#ffffff',
        padding: 12,
        borderRadius: 12,
        display: 'inline-block',
        lineHeight: 0,
      }}
    >
      <QRCodeSVG
        value={value}
        size={size - 24}
        bgColor="#ffffff"
        fgColor="#1a1a2e"
        level="M"
        includeMargin={false}
      />
    </div>
  );
}
