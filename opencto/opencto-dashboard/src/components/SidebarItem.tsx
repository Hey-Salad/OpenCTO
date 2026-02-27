import React from "react";
import { colors, spacing, typography } from "../theme/tokens";

export interface SidebarItemProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({ 
  label, 
  active = false, 
  onClick 
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const containerStyles: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: spacing.sm,
    padding: `${spacing.sm} ${spacing.md}`,
    cursor: "pointer",
    transition: "all 0.2s ease",
    borderLeft: active ? `3px solid ${colors.primary}` : "3px solid transparent",
    backgroundColor: active ? `${colors.primary}15` : (isHovered ? colors.surface2 : "transparent"),
    fontSize: typography.sizes.sm,
    fontWeight: active ? typography.weights.semibold : typography.weights.normal,
    fontFamily: typography.fonts.body,
    color: active ? colors.bodyText : colors.mutedText,
    borderRadius: "0 4px 4px 0",
  };

  return (
    <div 
      style={containerStyles}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        backgroundColor: active ? colors.primary : colors.mutedText,
        opacity: active ? 1 : 0.5
      }} />
      <span>{label}</span>
    </div>
  );
};

export default SidebarItem;
