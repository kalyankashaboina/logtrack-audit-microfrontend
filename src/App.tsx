// analytics/src/App.tsx
import AnalyticsWidget from "./AuditWidget";

export default function App() {
  return (
    <div style={{ padding: 20 }}>
      <h2>Analytics Remote Preview</h2>
      <p style={{ color: "#666", marginBottom: 16 }}>
        This is the standalone preview of the audit microfrontend.
        <br/>In the real app, the Host loads this via module federation.
      </p>

      <AnalyticsWidget />
    </div>
  );
}
