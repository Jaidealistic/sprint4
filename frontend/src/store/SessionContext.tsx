import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { SessionState } from '../types';
import { ActivePanel } from '../types';

const defaultState: SessionState = {
  id: 1,
  current_document_id: null,
  scroll_position: 0,
  zoom_level: 1,
  active_filter: null,
  active_panel: ActivePanel.ENTITIES,
  last_updated: new Date().toISOString(),
  is_exporting: false
};

interface SessionContextType {
  state: SessionState;
  updateState: (updates: Partial<SessionState>) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [state, setState] = useState<SessionState>(() => {
    const saved = localStorage.getItem('maestro_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return defaultState;
      }
    }
    return defaultState;
  });

  useEffect(() => {
    localStorage.setItem('maestro_session', JSON.stringify(state));
  }, [state]);

  const updateState = (updates: Partial<SessionState>) => {
    setState(prev => ({
      ...prev,
      ...updates,
      last_updated: new Date().toISOString()
    }));
  };

  return (
    <SessionContext.Provider value={{ state, updateState }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
