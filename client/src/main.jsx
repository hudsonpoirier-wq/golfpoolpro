import React from 'react';
import { createRoot } from 'react-dom/client';
import GolfPoolPro from './GolfPoolPro_v2.jsx';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ marginBottom: '12px' }}>Frontend Error</h1>
          <p style={{ marginBottom: '8px' }}>
            The app crashed while rendering. Copy the message below.
          </p>
          <pre
            style={{
              background: '#f6f6f6',
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '12px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <GolfPoolPro />
    </AppErrorBoundary>
  </React.StrictMode>
);
