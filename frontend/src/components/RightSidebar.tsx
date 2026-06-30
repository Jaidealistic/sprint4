import React, { useState, useEffect } from 'react';
import { useSession } from '../store/SessionContext';
import { ActivePanel, Entity } from '../types';

interface SearchResult {
  entity: Entity;
  document_id: number;
  document_filename: string;
}

export const RightSidebar: React.FC = () => {
  const { state, updateState } = useSession();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  const tabs = [
    { id: ActivePanel.ENTITIES, label: 'Entities' },
    { id: ActivePanel.SEARCH, label: 'Search' },
    { id: ActivePanel.AUDIT, label: 'Audit' },
  ];

  useEffect(() => {
    if (state.active_panel === ActivePanel.SEARCH && query.length > 0) {
      const delayDebounce = setTimeout(() => {
        fetch(`http://localhost:8000/api/search?q=${encodeURIComponent(query)}`)
          .then(res => res.json())
          .then(data => setResults(data.results || []))
          .catch(console.error);
      }, 300);
      return () => clearTimeout(delayDebounce);
    } else {
      setResults([]);
    }
  }, [query, state.active_panel]);

  // Handle `/` to focus search
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
    <aside className="w-80 bg-white border-l border-gray-200 h-full flex flex-col">
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => updateState({ active_panel: tab.id })}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              state.active_panel === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        {state.active_panel === ActivePanel.ENTITIES && (
          <div className="text-gray-500 text-sm text-center mt-10">No entities selected</div>
        )}
        {state.active_panel === ActivePanel.SEARCH && (
          <div className="flex flex-col gap-4">
            <input 
              id="global-search-input"
              type="text" 
              placeholder="Search entities (press / to focus)..." 
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {results.length > 0 ? (
              <div className="flex flex-col gap-2">
                {results.map((res, i) => (
                  <div 
                    key={i} 
                    className="p-3 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
                    onClick={() => updateState({ current_document_id: res.document_id })}
                  >
                    <div className="font-medium text-sm text-gray-900">{res.entity.text}</div>
                    <div className="text-xs text-gray-500 mt-1">Found in {res.document_filename}</div>
                  </div>
                ))}
              </div>
            ) : (
              query.length > 0 && <div className="text-gray-500 text-sm text-center mt-4">No results found</div>
            )}
            {query.length === 0 && <div className="text-gray-500 text-sm text-center mt-10">Type to search...</div>}
          </div>
        )}
        {state.active_panel === ActivePanel.AUDIT && (
          <div className="text-gray-500 text-sm text-center mt-10">Audit log empty</div>
        )}
      </div>
    </aside>
  );
};
