import React, { useState } from "react";
import { colors, spacing, borders, typography, radii } from "../theme/tokens";

export interface TopBarProps {
  title?: string;
  userEmail?: string;
  userPlan?: string;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  title = "OpenCTO", 
  userEmail = "peter@heysalad.io",
  userPlan = "Team Plan"
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const containerStyles: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "64px",
    padding: `0 ${spacing.xl}`,
    backgroundColor: colors.surface,
    borderBottom: borders.thin,
    position: "sticky",
    top: 0,
    zIndex: 100,
  };

  const titleStyles: React.CSSProperties = {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    fontFamily: typography.fonts.display,
    color: colors.bodyText,
    letterSpacing: "-0.5px",
  };

  const accentStyles: React.CSSProperties = {
    color: colors.primary,
  };

  const userSectionStyles: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: spacing.md,
  };

  const userInfoStyles: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
  };

  const emailStyles: React.CSSProperties = {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.bodyText,
  };

  const planStyles: React.CSSProperties = {
    fontSize: typography.sizes.xs,
    color: colors.mutedText,
  };

  const avatarStyles: React.CSSProperties = {
    width: "40px",
    height: "40px",
    borderRadius: radii.full,
    backgroundColor: colors.surface2,
    border: `2px solid ${isHovered ? colors.primary : colors.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: typography.sizes.lg,
    color: colors.bodyText,
    cursor: "pointer",
    transition: "all 0.2s ease",
  };

  return (
    <div style={containerStyles}>
      <h1 style={titleStyles}>
        {title.split("CTO")[0]}
        <span style={accentStyles}>CTO</span>
      </h1>
      
      <div style={userSectionStyles}>
        <div style={userInfoStyles}>
          <span style={emailStyles}>{userEmail}</span>
          <span style={planStyles}>{userPlan}</span>
        </div>
        
        <div 
          style={avatarStyles}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => console.log("Avatar clicked")}
        >
          P
        </div>
      </div>
    </div>
  );
};

export default TopBar;
