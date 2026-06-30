import React from 'react';
import { LeftNav } from './components/LeftNav';
import { MainPanel } from './components/MainPanel';
import { RightSidebar } from './components/RightSidebar';
import { SessionProvider, useSession } from './store/SessionContext';
import { ExportDashboard } from './components/ExportDashboard';

const AppContent: React.FC = () => {
  const { state } = useSession();
  
  return (
    <div className="flex h-screen overflow-hidden bg-white text-gray-900 font-sans">
      <LeftNav />
      {state.is_exporting ? <ExportDashboard /> : (
        <>
          <MainPanel />
          <RightSidebar />
        </>
      )}
    </div>
  );
};

function App() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  );
}

export default App;
