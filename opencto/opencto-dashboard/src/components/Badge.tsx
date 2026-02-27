import React from 'react';
import { colors, spacing, radii, typography } from '../theme/tokens';

export type BadgeStatus = 'PASS' | 'WARN' | 'BLOCK' | 'RUNNING' | 'PENDING';

export interface BadgeProps {
  status: BadgeStatus;
  children?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ status, children }) => {
  const getStatusStyles = (): React.CSSProperties => {
    switch (status) {
      case 'PASS':
        return {
          backgroundColor: `${colors.success}20`,
          color: colors.success,
          border: `1px solid ${colors.success}`,
        };
      case 'WARN':
        return {
          backgroundColor: `${colors.warning}20`,
          color: colors.warning,
          border: `1px solid ${colors.warning}`,
        };
      case 'BLOCK':
        return {
          backgroundColor: `${colors.error}20`,
          color: colors.error,
          border: `1px solid ${colors.error}`,
        };
      case 'RUNNING':
        return {
          backgroundColor: `${colors.info}20`,
          color: colors.info,
          border: `1px solid ${colors.info}`,
        };
      case 'PENDING':
        return {
          backgroundColor: `${colors.mutedText}20`,
          color: colors.mutedText,
          border: `1px solid ${colors.mutedText}`,
        };
      default:
        return {};
    }
  };

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: `${spacing.xs} ${spacing.sm}`,
    borderRadius: radii.sm,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    fontFamily: typography.fonts.body,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  return (
    <span style={{ ...baseStyles, ...getStatusStyles() }}>
      {children || status}
    </span>
  );
};
