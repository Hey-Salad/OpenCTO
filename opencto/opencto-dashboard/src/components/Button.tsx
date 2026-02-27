import React from "react";
import { colors, spacing, radii, typography } from "../theme/tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "outline-danger";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = "primary", 
  children, 
  style,
  ...props 
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const getVariantStyles = (): React.CSSProperties => {
    const base = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: `${spacing.sm} ${spacing.md}`,
      borderRadius: radii.md,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      fontFamily: typography.fonts.body,
      cursor: "pointer",
      transition: "all 0.2s ease",
      outline: "none",
      border: "none",
    };

    switch (variant) {
      case "primary":
        return {
          ...base,
          backgroundColor: colors.primary,
          color: colors.base,
          border: `1px solid ${colors.primary}`,
          boxShadow: isHovered ? `0 2px 8px ${colors.primary}40` : "none",
        };
      case "secondary":
        return {
          ...base,
          backgroundColor: colors.surface2,
          color: colors.bodyText,
          border: `1px solid ${colors.border}`,
          boxShadow: isHovered ? `0 2px 8px ${colors.surface2}40` : "none",
        };
      case "ghost":
        return {
          ...base,
          backgroundColor: "transparent",
          color: colors.bodyText,
          border: "none",
        };
      case "danger":
        return {
          ...base,
          backgroundColor: colors.error,
          color: colors.base,
          border: `1px solid ${colors.error}`,
          boxShadow: isHovered ? `0 2px 8px ${colors.error}40` : "none",
        };
      case "outline":
        return {
          ...base,
          backgroundColor: "transparent",
          color: colors.bodyText,
          border: `1px solid ${colors.border}`,
        };
      case "outline-danger":
        return {
          ...base,
          backgroundColor: "transparent",
          color: colors.error,
          border: `1px solid ${colors.error}`,
        };
      default:
        return base;
    }
  };

  const buttonStyles = getVariantStyles();

  return (
    <button
      style={{ ...buttonStyles, ...style }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
