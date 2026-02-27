import React from 'react';
import { colors, spacing, radii, borders } from '../theme/tokens';

export interface CardProps {
  children: React.ReactNode;
  accentColor?: string;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, accentColor, style }) => {
  const baseStyles: React.CSSProperties = {
    backgroundColor: colors.surface,
    border: borders.thin,
    borderRadius: radii.md,
    padding: spacing.md,
    borderLeft: accentColor ? `3px solid ${accentColor}` : undefined,
  };

  return (
    <div style={{ ...baseStyles, ...style }}>
      {children}
    </div>
  );
};
