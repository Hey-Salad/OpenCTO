import { useState } from "react";
import TopBar from "./components/TopBar";
import SidebarItem from "./components/SidebarItem";
import Badge from "./components/Badge";
import Button from "./components/Button";
import Card from "./components/Card";
import { colors, spacing, typography, layout } from "./theme/tokens";
import "./App.css";

function App() {
  const [activeNav, setActiveNav] = useState("jobs");

  const navItems = [
    { id: "jobs", label: "Jobs Stream" },
    { id: "voice", label: "Voice" },
    { id: "compliance", label: "Compliance" },
    { id: "metrics", label: "Metrics" },
    { id: "settings", label: "Settings" },
  ];

  const agentItems = [
    { id: "orchestrator", label: "Orchestrator" },
    { id: "planning", label: "Planning" },
    { id: "compliance", label: "Compliance" },
    { id: "worker", label: "Worker" },
    { id: "code-review", label: "Code Review" },
    { id: "incident", label: "Incident" },
    { id: "voice", label: "Voice" },
  ];

  const messages = [
    { role: "orchestrator", time: "10:24 AM", text: "Starting job #42: Code review for mobile_app repository" },
    { role: "worker", time: "10:25 AM", text: "Analyzing 15 files in mobile_app repository..." },
    { role: "compliance", time: "10:26 AM", text: "Checking policy compliance for deployment..." },
    { role: "worker", time: "10:27 AM", text: "Found 3 potential security issues in authentication flow" },
  ];

  const getRoleColor = (role: string) => {
    switch (role) {
      case "orchestrator": return colors.success;
      case "worker": return colors.info;
      case "compliance": return colors.warning;
      default: return colors.mutedText;
    }
  };

  return (
    <div style={{ 
      backgroundColor: colors.background, 
      color: colors.bodyText,
      fontFamily: typography.fonts.body,
      height: "100vh",
      display: "flex",
      flexDirection: "column"
    }}>
      <TopBar />
      
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left Sidebar */}
        <div style={{ 
          width: layout.sidebar.left,
          backgroundColor: colors.surface,
          borderRight: `1px solid ${colors.border}`,
          paddingTop: spacing.xl,
          overflowY: "auto"
        }}>
          <div style={{ padding: `0 ${spacing.lg}`, marginBottom: spacing.xl }}>
            <div style={{ 
              fontSize: typography.sizes.xs,
              textTransform: "uppercase",
              letterSpacing: "1px",
              color: colors.mutedText,
              marginBottom: spacing.sm
            }}>
              Navigation
            </div>
            {navItems.map((item) => (
              <SidebarItem
                key={item.id}
                label={item.label}
                active={activeNav === item.id}
                onClick={() => setActiveNav(item.id)}
              />
            ))}
          </div>

          <div style={{ padding: `0 ${spacing.lg}`, marginBottom: spacing.xl }}>
            <div style={{ 
              fontSize: typography.sizes.xs,
              textTransform: "uppercase",
              letterSpacing: "1px",
              color: colors.mutedText,
              marginBottom: spacing.sm
            }}>
              Agents
            </div>
            {agentItems.map((item) => (
              <SidebarItem
                key={item.id}
                label={item.label}
                active={false}
                onClick={() => {}}
              />
            ))}
          </div>
        </div>

        {/* Center Stream */}
        <div style={{ 
          flex: 1,
          padding: `${spacing.xl} ${spacing.lg}`,
          overflowY: "auto"
        }}>
          <div style={{ marginBottom: spacing.xl }}>
            <h1 style={{ 
              fontFamily: typography.fonts.display,
              fontSize: typography.sizes.xxl,
              marginBottom: spacing.md
            }}>
              Jobs Stream
            </h1>
            <p style={{ color: colors.mutedText }}>
              Real-time updates from all agents and jobs
            </p>
          </div>

          {messages.map((msg, index) => (
            <div key={index} style={{ 
              padding: spacing.lg,
              borderBottom: `1px solid ${colors.border}`,
              marginBottom: spacing.md
            }}>
              <div style={{ 
                display: "flex",
                alignItems: "center",
                gap: spacing.sm,
                marginBottom: spacing.sm
              }}>
                <span style={{
                  display: "inline-block",
                  padding: `${spacing.xs} ${spacing.sm}`,
                  borderRadius: "4px",
                  fontSize: typography.sizes.xs,
                  fontWeight: typography.weights.semibold,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  backgroundColor: getRoleColor(msg.role),
                  color: colors.background
                }}>
                  {msg.role}
                </span>
                <span style={{ 
                  fontSize: typography.sizes.xs,
                  color: colors.mutedText
                }}>
                  {msg.time}
                </span>
              </div>
              <div>{msg.text}</div>
            </div>
          ))}

          {/* Session Ended Divider */}
          <div style={{ 
            textAlign: "center",
            padding: `${spacing.xl} 0`,
            color: colors.mutedText,
            fontSize: typography.sizes.sm,
            position: "relative",
            margin: `${spacing.xl} 0`
          }}>
            <span style={{ 
              position: "relative",
              backgroundColor: colors.background,
              padding: `0 ${spacing.md}`
            }}>
              SESSION ENDED
            </span>
            <div style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: "1px",
              backgroundColor: colors.border,
              zIndex: -1
            }} />
          </div>

          {/* Human Approval Card */}
          <Card accentColor={colors.secondary}>
            <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }}>
              <span style={{ color: colors.warning, fontSize: "20px" }}>⚠</span>
              <h2 style={{ 
                fontFamily: typography.fonts.body,
                fontSize: typography.sizes.lg,
                fontWeight: typography.weights.bold
              }}>
                Human Approval Required
              </h2>
            </div>
            
            <div style={{ 
              fontSize: typography.sizes.sm,
              color: colors.mutedText,
              marginBottom: spacing.lg,
              lineHeight: 1.6
            }}>
              <span>Risk Level: </span>
              <span style={{ color: colors.error, fontWeight: typography.weights.semibold }}>DANGEROUS</span>
              <span> • Tool: </span>
              <span style={{ color: colors.bodyText }}>deploy_production</span>
              <span> • Job: </span>
              <span style={{ color: colors.bodyText }}>#42</span>
            </div>

            <div style={{ display: "flex", gap: spacing.sm }}>
              <Button variant="secondary">View Diff</Button>
              <Button variant="danger">Deny</Button>
              <Button variant="primary">Approve</Button>
            </div>
          </Card>
        </div>

        {/* Right Config Panel */}
        <div style={{ 
          width: layout.sidebar.right,
          backgroundColor: colors.surface,
          borderLeft: `1px solid ${colors.border}`,
          padding: `${spacing.xl} ${spacing.lg}`,
          overflowY: "auto"
        }}>
          <div style={{ marginBottom: spacing.xl }}>
            <h3 style={{ 
              fontSize: typography.sizes.lg,
              fontWeight: typography.weights.semibold,
              marginBottom: spacing.lg
            }}>
              Configuration
            </h3>

            <div style={{ marginBottom: spacing.lg }}>
              <label style={{ 
                display: "block",
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.medium,
                marginBottom: spacing.sm,
                color: colors.bodyText
              }}>
                Approval Mode
              </label>
              <select style={{
                width: "100%",
                padding: `${spacing.sm} ${spacing.md}`,
                backgroundColor: colors.surface2,
                border: `1px solid ${colors.border}`,
                borderRadius: "6px",
                color: colors.bodyText,
                fontSize: typography.sizes.sm,
                cursor: "pointer"
              }}>
                <option>Auto-approve SAFE</option>
                <option>Require approval for RESTRICTED+</option>
                <option>Manual approval all</option>
              </select>
            </div>

            <div style={{ marginBottom: spacing.lg }}>
              <label style={{ 
                display: "block",
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.medium,
                marginBottom: spacing.sm,
                color: colors.bodyText
              }}>
                Agent Count
              </label>
              <input 
                type="range" 
                min="1" 
                max="10" 
                defaultValue="3"
                style={{
                  width: "100%",
                  height: "6px",
                  backgroundColor: colors.surface2,
                  borderRadius: "3px",
                  outline: "none",
                  cursor: "pointer"
                }}
              />
              <div style={{ 
                fontSize: typography.sizes.xs,
                color: colors.mutedText,
                marginTop: spacing.xs
              }}>
                3 active agents
              </div>
            </div>

            <div style={{ marginBottom: spacing.lg }}>
              <div style={{ 
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: spacing.md,
                padding: `${spacing.sm} 0`
              }}>
                <span style={{ 
                  fontSize: typography.sizes.sm,
                  fontWeight: typography.weights.medium,
                  color: colors.bodyText
                }}>
                  Auto-retry failed jobs
                </span>
                <label style={{ display: "inline-block", position: "relative" }}>
                  <input type="checkbox" defaultChecked style={{ display: "none" }} />
                  <span style={{
                    display: "inline-block",
                    width: "44px",
                    height: "24px",
                    backgroundColor: colors.primary,
                    borderRadius: "12px",
                    position: "relative",
                    cursor: "pointer",
                    transition: "background-color 0.2s"
                  }}>
                    <span style={{
                      position: "absolute",
                      top: "2px",
                      left: "2px",
                      width: "20px",
                      height: "20px",
                      backgroundColor: colors.base,
                      borderRadius: "50%",
                      transition: "transform 0.2s",
                      transform: "translateX(20px)"
                    }} />
                  </span>
                </label>
              </div>

              <div style={{ 
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: `${spacing.sm} 0`
              }}>
                <span style={{ 
                  fontSize: typography.sizes.sm,
                  fontWeight: typography.weights.medium,
                  color: colors.bodyText
                }}>
                  Notify on completion
                </span>
                <label style={{ display: "inline-block", position: "relative" }}>
                  <input type="checkbox" style={{ display: "none" }} />
                  <span style={{
                    display: "inline-block",
                    width: "44px",
                    height: "24px",
                    backgroundColor: colors.surface2,
                    borderRadius: "12px",
                    position: "relative",
                    cursor: "pointer",
                    transition: "background-color 0.2s"
                  }}>
                    <span style={{
                      position: "absolute",
                      top: "2px",
                      left: "2px",
                      width: "20px",
                      height: "20px",
                      backgroundColor: colors.base,
                      borderRadius: "50%",
                      transition: "transform 0.2s"
                    }} />
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
