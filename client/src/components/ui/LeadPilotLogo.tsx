// LeadPilotLogo.tsx
import React from "react";

export const LeadPilotLogo: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="36" height="36" rx="8" fill="#2563eb" />
    <path d="M20 10 L30 20 L20 30 L10 20 Z" fill="#fff" />
    <circle cx="20" cy="20" r="5" fill="#2563eb" stroke="#fff" strokeWidth="2" />
  </svg>
);
