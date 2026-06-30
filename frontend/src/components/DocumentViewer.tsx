import React, { useEffect, useState, useRef } from 'react';
import type { Document, Entity } from '../types';
import { EntityDecision } from '../types';
import { useSession } from '../store/SessionContext';

export const DocumentViewer: React.FC = () => {
  const { state, updateState } = useSession();
  const [doc, setDoc] = useState<Document | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [focusedEntityIndex, setFocusedEntityIndex] = useState<number>(-1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<{id: number, previous: EntityDecision}[]>([]);
  const toastTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (state.current_document_id) {
      fetch(`/api/documents/${state.current_document_id}`)
        .then(res => res.json())
        .then(data => {
          setDoc(data.document);
          setEntities(data.entities || []);
          setFocusedEntityIndex(-1);
        })
        .catch(console.error);
    } else {
      setDoc(null);
      setEntities([]);
    }
  }, [state.current_document_id]);

  useEffect(() => {
    const handleFocusEntity = (e: Event) => {
      const customEvent = e as CustomEvent<{entityId: number}>;
      const index = entities.findIndex(ent => ent.id === customEvent.detail.entityId);
      if (index !== -1) {
        setFocusedEntityIndex(index);
        document.getElementById(`ent-${customEvent.detail.entityId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    };

    window.addEventListener('focus-entity', handleFocusEntity);
    return () => window.removeEventListener('focus-entity', handleFocusEntity);
  }, [entities]);

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToastMessage(null), 8000);
  };

  const updateDecision = async (entityId: number, decision: EntityDecision, skipUndo: boolean = false) => {
    const entityIndex = entities.findIndex(e => e.id === entityId);
    if (entityIndex === -1) return;
    
    const previous = entities[entityIndex].decision;
    if (previous === decision) return;

    if (!skipUndo) {
      setUndoStack(prev => [...prev.slice(-19), { id: entityId, previous }]);
    }

    setEntities(prev => prev.map(e => e.id === entityId ? { ...e, decision } : e));
    
    try {
      await fetch(`/api/entities/${entityId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision })
      });
      updateState({ last_updated: Date.now() });
    } catch (e) {
      console.error(e);
      setEntities(prev => prev.map(e => e.id === entityId ? { ...e, decision: previous } : e));
    }
  };

  const undoLastAction = async () => {
    if (undoStack.length === 0) return;
    const lastAction = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    await updateDecision(lastAction.id, lastAction.previous, true);
    setToastMessage(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (!doc || entities.length === 0) return;

      const sortedEntities = [...entities].sort((a, b) => a.start_offset - b.start_offset);

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(focusedEntityIndex + 1, sortedEntities.length - 1);
        setFocusedEntityIndex(next);
        document.getElementById(`ent-${sortedEntities[next].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(focusedEntityIndex - 1, 0);
        setFocusedEntityIndex(prev);
        document.getElementById(`ent-${sortedEntities[prev].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (e.key === 'a' || e.key === 'A') {
        if (e.shiftKey) {
          e.preventDefault();
          const pending = entities.filter(ent => ent.decision === EntityDecision.PENDING);
          if (pending.length > 0) {
            pending.forEach(ent => updateDecision(ent.id, EntityDecision.APPROVED));
            showToast(`${pending.length} entities set to REDACT`);
          }
        } else if (focusedEntityIndex >= 0) {
          e.preventDefault();
          updateDecision(sortedEntities[focusedEntityIndex].id, EntityDecision.APPROVED);
          showToast(`Set to REDACT`);
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (focusedEntityIndex >= 0 && !e.shiftKey) {
          e.preventDefault();
          updateDecision(sortedEntities[focusedEntityIndex].id, EntityDecision.REJECTED);
          showToast(`Set to KEEP`);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undoLastAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedEntityIndex, entities, doc, undoStack]);

  if (!state.current_document_id) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white m-6 border border-gray-200/60 rounded-md border-dashed">
        <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
        </div>
        <p className="text-gray-500 text-sm font-medium">Select a document to review</p>
      </div>
    );
  }

  if (!doc) return <div className="flex-1 p-8 text-gray-500 text-sm">Loading document...</div>;

  let renderedText: React.ReactNode[] = [];
  let currentIndex = 0;
  
  const sortedEntities = [...entities].sort((a, b) => a.start_offset - b.start_offset);
  
  if (doc.text_content) {
    sortedEntities.forEach(ent => {
      if (ent.start_offset >= currentIndex) {
        renderedText.push(<span key={`text-${currentIndex}`}>{doc.text_content!.substring(currentIndex, ent.start_offset)}</span>);
        
        const isFocused = sortedEntities[focusedEntityIndex]?.id === ent.id;
        
        if (ent.decision === EntityDecision.APPROVED) {
          renderedText.push(
            <span key={`ent-${ent.id}`} id={`ent-${ent.id}`} className={`bg-black text-white px-1.5 py-0.5 rounded-sm mx-0.5 ${isFocused ? 'ring-2 ring-gray-400 ring-offset-2' : ''}`}>
              [REDACTED]
            </span>
          );
        } else {
          const isRejected = ent.decision === EntityDecision.REJECTED;
          renderedText.push(
            <span 
              key={`ent-${ent.id}`} 
              id={`ent-${ent.id}`}
              className={`px-1 mx-0.5 rounded-sm cursor-pointer transition-colors ${
                isRejected ? 'text-gray-400 line-through' : 'bg-amber-100/50 border-b border-amber-300 text-amber-900'
              } ${isFocused ? 'ring-2 ring-black ring-offset-2 bg-transparent border-transparent' : ''}`}
              onClick={() => {
                setFocusedEntityIndex(sortedEntities.findIndex(e => e.id === ent.id));
              }}
            >
              {doc.text_content!.substring(ent.start_offset, ent.end_offset)}
            </span>
          );
        }
        
        currentIndex = ent.end_offset;
      }
    });
    if (currentIndex < doc.text_content.length) {
      renderedText.push(<span key={`text-end`}>{doc.text_content.substring(currentIndex)}</span>);
    }
  }

  return (
    <div className="flex-1 bg-white mx-8 my-6 px-16 py-12 rounded-sm shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] overflow-y-auto font-sans leading-loose text-[15px] text-gray-700 whitespace-pre-wrap relative border border-gray-200/60 max-w-4xl self-center w-full">
      {renderedText.length > 0 ? renderedText : <span className="text-gray-400">No text content available for this document.</span>}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-2.5 rounded shadow-xl flex items-center gap-4 border border-gray-800">
          <span className="text-[13px] font-medium">{toastMessage}</span>
          <button
            onClick={undoLastAction}
            className="text-gray-400 font-medium text-[13px] hover:text-white px-2 py-0.5 rounded transition-colors"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
};
