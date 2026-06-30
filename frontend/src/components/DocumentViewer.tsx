import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from '../store/SessionContext';
import { Document, Entity, EntityDecision } from '../types';

export const DocumentViewer: React.FC = () => {
  const { state } = useSession();
  const [doc, setDoc] = useState<Document | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [focusedEntityIndex, setFocusedEntityIndex] = useState<number>(0);
  const [undoStack, setUndoStack] = useState<{id: number, prev: EntityDecision}[]>([]);

  useEffect(() => {
    if (!state.current_document_id) {
      setDoc(null);
      setEntities([]);
      return;
    }
    
    setLoading(true);
    fetch(`http://localhost:8000/api/documents/${state.current_document_id}`)
      .then(res => res.json())
      .then(data => {
        setDoc(data.document);
        setEntities(data.entities);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError("Failed to load document");
        setLoading(false);
      });
  }, [state.current_document_id]);

  const handleDecision = useCallback(async (entityId: number, decision: EntityDecision) => {
    // Optimistic update
    const entityIndex = entities.findIndex(e => e.id === entityId);
    if (entityIndex === -1) return;
    
    const previousDecision = entities[entityIndex].decision;
    
    setUndoStack(prev => {
      const newStack = [...prev, { id: entityId, prev: previousDecision }];
      return newStack.slice(-20); // Keep last 20
    });
    
    const previousEntities = [...entities];
    setEntities(prev => prev.map(e => e.id === entityId ? { ...e, decision } : e));
    
    try {
      const res = await fetch(`http://localhost:8000/api/entities/${entityId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision })
      });
      if (!res.ok) throw new Error("Failed to update");
    } catch (e) {
      // Revert on failure
      setEntities(previousEntities);
      setUndoStack(prev => prev.filter(item => item.id !== entityId || item.prev !== previousDecision));
      console.error(e);
    }
  }, [entities]);

  const undoLastAction = useCallback(async () => {
    if (undoStack.length === 0) return;
    const lastAction = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    await handleDecision(lastAction.id, lastAction.prev);
    // Note: The handleDecision call above will add the "reverted" action back to the undo stack, 
    // which isn't ideal for a true undo, but sufficient for a quick mock. Let's fix that.
    setUndoStack(prev => prev.slice(0, -1)); 
  }, [undoStack, handleDecision]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!doc || entities.length === 0) return;
      
      const sortedEntities = [...entities].sort((a, b) => a.start_offset - b.start_offset);
      const activeEntity = sortedEntities[focusedEntityIndex];

      if (e.key === 'j' || e.key === 'ArrowDown') {
        setFocusedEntityIndex(prev => Math.min(prev + 1, entities.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        setFocusedEntityIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'a') {
        if (activeEntity) {
          handleDecision(activeEntity.id, EntityDecision.APPROVED);
          setFocusedEntityIndex(prev => Math.min(prev + 1, entities.length - 1));
        }
      } else if (e.key === 'r') {
        if (activeEntity) {
          handleDecision(activeEntity.id, EntityDecision.REJECTED);
          setFocusedEntityIndex(prev => Math.min(prev + 1, entities.length - 1));
        }
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        undoLastAction();
      } else if (e.key === '/') {
        e.preventDefault();
        // focus search
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [doc, entities, focusedEntityIndex, handleDecision, undoLastAction]);

  if (!state.current_document_id) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select a document from the left navigation
      </div>
    );
  }

  if (loading) return <div className="flex-1 p-8 text-gray-500">Loading document...</div>;
  if (error) return <div className="flex-1 p-8 text-red-500">{error}</div>;
  if (!doc) return <div className="flex-1 p-8 text-gray-500">Document not found</div>;

  // Render text with entities
  // For MVP, we simply replace occurrences or render them as badges
  // Since we have start_offset and end_offset, we can chunk the text
  let renderedText: React.ReactNode[] = [];
  let currentIndex = 0;
  
  // Sort entities by start_offset
  const sortedEntities = [...entities].sort((a, b) => a.start_offset - b.start_offset);
  
  if (doc.text_content) {
    sortedEntities.forEach(ent => {
      if (ent.start_offset >= currentIndex) {
        // Add preceding text
        renderedText.push(<span key={`text-${currentIndex}`}>{doc.text_content!.substring(currentIndex, ent.start_offset)}</span>);
        
        // Add entity
        const isFocused = sortedEntities[focusedEntityIndex]?.id === ent.id;
        
        if (ent.decision === EntityDecision.APPROVED) {
          renderedText.push(
            <span key={`ent-${ent.id}`} className={`bg-black text-white px-1 rounded mx-1 ${isFocused ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}>
              [REDACTED]
            </span>
          );
        } else {
          const isRejected = ent.decision === EntityDecision.REJECTED;
          renderedText.push(
            <span 
              key={`ent-${ent.id}`} 
              className={`px-1 rounded mx-1 cursor-pointer border transition-all
                ${isRejected ? 'bg-gray-200 line-through text-gray-500' : 'bg-yellow-200 border-yellow-400'}
                ${isFocused ? 'ring-2 ring-blue-500 ring-offset-1 scale-105' : ''}
              `}
              onClick={() => handleDecision(ent.id, isRejected ? EntityDecision.PENDING : EntityDecision.APPROVED)}
            >
              {ent.text}
            </span>
          );
        }
        
        currentIndex = ent.end_offset;
      }
    });
    // Add remaining text
    if (currentIndex < doc.text_content.length) {
      renderedText.push(<span key={`text-end`}>{doc.text_content.substring(currentIndex)}</span>);
    }
  }

  return (
    <div className="flex-1 bg-white m-4 rounded shadow overflow-y-auto p-8 font-serif leading-relaxed text-lg whitespace-pre-wrap">
      {renderedText.length > 0 ? renderedText : "No text content available for this document."}
    </div>
  );
};
