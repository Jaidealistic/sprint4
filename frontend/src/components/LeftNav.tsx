import React, { useEffect, useState } from 'react';
import { Document, RiskTier } from '../types';
import { useSession } from '../store/SessionContext';

export const LeftNav: React.FC = () => {
  const { state, updateState } = useSession();
  const [documents, setDocuments] = useState<Document[]>([]);
  
  useEffect(() => {
    fetch('http://localhost:8000/api/status/batch')
      .then(res => res.json())
      .then(data => {
        if (data.documents) {
          setDocuments(data.documents);
        }
      })
      .catch(console.error);
  }, []);

  const needsAttention = documents.filter(d => d.risk_tier === RiskTier.NEEDS_ATTENTION);
  const quickReview = documents.filter(d => d.risk_tier === RiskTier.QUICK_REVIEW);
  const ready = documents.filter(d => d.risk_tier === RiskTier.READY);

  return (
    <nav className="w-64 bg-gray-50 border-r border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-800">Maestro</h1>
        <div className="mt-2 text-sm text-gray-600 font-medium">
          {needsAttention.length} docs need attention, {ready.length} clear
        </div>
      </div>
      <div className="p-4 flex-1">
        <ul className="space-y-2">
          <li>
            <button className="w-full text-left px-3 py-2 rounded-md bg-red-50 text-red-700 font-medium hover:bg-red-100 flex justify-between">
              <span>Needs Attention</span>
              <span className="bg-red-200 text-red-800 text-xs px-2 py-1 rounded-full">{needsAttention.length}</span>
            </button>
          </li>
          <li>
            <button className="w-full text-left px-3 py-2 rounded-md text-yellow-700 font-medium hover:bg-yellow-50 flex justify-between">
              <span>Quick Review</span>
              <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">{quickReview.length}</span>
            </button>
          </li>
          <li>
            <button className="w-full text-left px-3 py-2 rounded-md text-green-700 font-medium hover:bg-green-50 flex justify-between">
              <span>Ready</span>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">{ready.length}</span>
            </button>
          </li>
        </ul>
      </div>
      <div className="p-4 border-t border-gray-200">
        <button 
          onClick={() => updateState({ is_exporting: true })}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition-colors"
        >
          End-of-Day Check
        </button>
      </div>
    </nav>
  );
};
