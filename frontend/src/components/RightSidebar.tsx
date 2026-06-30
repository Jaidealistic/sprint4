import React, { useEffect, useState } from 'react';
import type { Entity, AuditLog } from '../types';
import { ActivePanel } from '../types';
import { useSession } from '../store/SessionContext';

export const RightSidebar: React.FC = () => {
  const { state, updateState } = useSession();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const tabs = [
    { id: ActivePanel.ENTITIES, label: 'Entities' },
    { id: ActivePanel.SEARCH, label: 'Search' },
    { id: ActivePanel.AUDIT, label: 'Audit' },
  ];

  useEffect(() => {
    if (state.active_panel === ActivePanel.ENTITIES && state.current_document_id) {
      fetch(`/api/documents/${state.current_document_id}`)
        .then(res => res.json())
        .then(data => {
          if (data.entities) setEntities(data.entities);
        })
        .catch(console.error);
    } else if (state.active_panel === ActivePanel.AUDIT) {
      fetch('/api/audit')
        .then(res => res.json())
        .then(data => setAuditLogs(data.audit_logs || []))
        .catch(console.error);
    }
  }, [state.active_panel, state.last_updated, state.current_document_id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        if (document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          updateState({ active_panel: ActivePanel.SEARCH });
          setTimeout(() => document.getElementById('global-search-input')?.focus(), 50);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [updateState]);

  return (
    <aside className="w-80 bg-[#fbfbfa] border-l border-gray-200/80 h-full flex flex-col">
      <div className="flex px-4 pt-4 border-b border-gray-200/60">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => updateState({ active_panel: tab.id })}
            className={`mr-6 pb-2 text-[13px] font-medium transition-colors border-b-[1.5px] ${
              state.active_panel === tab.id
                ? 'border-black text-black'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {state.active_panel === ActivePanel.ENTITIES && (
          <div className="flex flex-col gap-3">
            {!state.current_document_id ? (
              <div className="text-gray-400 text-[13px] text-center mt-12">No document open</div>
            ) : entities.length === 0 ? (
              <div className="text-gray-400 text-[13px] text-center mt-12">No entities in this document</div>
            ) : (
              entities.map(ent => (
                <div
                  key={ent.id}
                  className="group flex flex-col gap-1 cursor-pointer"
                  onClick={() => window.dispatchEvent(new CustomEvent('focus-entity', { detail: { entityId: ent.id } }))}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-[13px] text-gray-900 leading-tight group-hover:underline decoration-gray-300 underline-offset-2">{ent.text}</span>
                    <span className={`text-[10px] font-medium tracking-wide uppercase mt-0.5 ${
                      ent.decision === 'approved' ? 'text-black' :
                      ent.decision === 'rejected' ? 'text-gray-400 line-through' : 'text-amber-500'
                    }`}>
                      {ent.decision === 'approved' ? 'REDACT' : ent.decision === 'rejected' ? 'KEEP' : 'PENDING'}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400">{ent.type}</span>
                </div>
              ))
            )}
          </div>
        )}

        {state.active_panel === ActivePanel.SEARCH && (
          <div className="flex flex-col h-full">
            <div className="relative mb-4">
              <span className="absolute left-3 top-2.5 text-gray-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </span>
              <input 
                id="global-search-input"
                type="text" 
                placeholder="Search entities... (/)"
                className="w-full bg-white border border-gray-200/80 rounded-md py-1.5 pl-8 pr-3 text-[13px] focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-shadow placeholder-gray-400"
              />
            </div>
            <div className="flex-1 flex items-center justify-center text-gray-400 text-[13px]">
              Search not connected
            </div>
          </div>
        )}

        {state.active_panel === ActivePanel.AUDIT && (
          <div className="flex flex-col gap-4">
            {auditLogs.length === 0 ? (
              <div className="text-gray-400 text-[13px] text-center mt-12">No decisions recorded yet</div>
            ) : (
              auditLogs.map(log => (
                <div key={log.id} className="text-[13px] flex flex-col gap-1 pb-4 border-b border-gray-100 last:border-0">
                  <div className="flex justify-between text-gray-400 text-[11px]">
                    <span>{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <span className="font-mono">#{log.entity_id}</span>
                  </div>
                  <div className="text-gray-600">
                    <span className="line-through text-gray-400">{log.previous_value}</span>
                    <span className="mx-1.5">→</span>
                    <span className={`font-medium ${log.new_value === 'approved' ? 'text-black' : 'text-gray-500'}`}>
                      {log.new_value === 'approved' ? 'REDACT' : 'KEEP'}
                    </span>
                  </div>
                  {log.reason && <div className="text-gray-400 text-[12px] italic">{log.reason}</div>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
