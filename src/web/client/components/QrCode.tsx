import { QRCodeSVG } from "qrcode.react";

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QrCode({ value, size = 200, className }: QrCodeProps) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="M"
      className={className}
    />
  );
}
