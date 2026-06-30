import React, { useEffect, useState } from 'react';
import type { Document } from '../types';
import { RiskTier } from '../types';
import { useSession } from '../store/SessionContext';

export const LeftNav: React.FC = () => {
  const { state, updateState } = useSession();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [expandedBucket, setExpandedBucket] = useState<RiskTier | 'all'>('all');

  useEffect(() => {
    const fetchDocs = () => {
      fetch('/api/status/batch')
        .then(res => res.json())
        .then(data => {
          if (data.documents) setDocuments(data.documents);
        })
        .catch(console.error);
    };
    fetchDocs();
    const interval = setInterval(fetchDocs, 3000);
    return () => clearInterval(interval);
  }, []);

  const needsAttention = documents.filter(d => d.risk_tier === RiskTier.NEEDS_ATTENTION);
  const quickReview = documents.filter(d => d.risk_tier === RiskTier.QUICK_REVIEW);
  const ready = documents.filter(d => d.risk_tier === RiskTier.READY);

  const renderDocumentList = (docs: Document[]) => (
    <ul className="mt-1 space-y-0.5 pl-6">
      {docs.map(doc => (
        <li key={doc.id}>
          <button
            onClick={() => updateState({ current_document_id: doc.id })}
            className={`w-full text-left px-2 py-1.5 rounded-md text-[13px] truncate transition-colors ${
              state.current_document_id === doc.id
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
            title={doc.filename}
          >
            {doc.filename}
          </button>
        </li>
      ))}
    </ul>
  );

  const BucketHeader = ({
    label, count, tier, colorClass
  }: { label: string; count: number; tier: RiskTier; colorClass: string }) => (
    <li className="mb-4">
      <button
        onClick={() => setExpandedBucket(prev => prev === tier ? 'all' : tier)}
        className="w-full text-left px-2 py-1.5 rounded-md flex justify-between items-center hover:bg-gray-50 transition-colors group"
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-1.5 h-1.5 rounded-full ${colorClass}`} />
          <span className="text-[13px] font-medium text-gray-700">{label}</span>
        </div>
        <span className="text-xs text-gray-400 font-mono">{count}</span>
      </button>
      {(expandedBucket === tier || expandedBucket === 'all') && renderDocumentList(
        tier === RiskTier.NEEDS_ATTENTION ? needsAttention :
        tier === RiskTier.QUICK_REVIEW ? quickReview : ready
      )}
    </li>
  );

  return (
    <nav className="w-64 bg-[#fbfbfa] h-full flex flex-col border-r border-gray-200/80">
      <div className="px-6 py-8">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-black rounded-[3px] flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-[1px]" />
          </div>
          <h1 className="text-sm font-semibold text-gray-900 tracking-tight">Maestro</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        <ul>
          <BucketHeader label="Needs Attention" count={needsAttention.length} tier={RiskTier.NEEDS_ATTENTION} colorClass="bg-red-400" />
          <BucketHeader label="Quick Review" count={quickReview.length} tier={RiskTier.QUICK_REVIEW} colorClass="bg-amber-400" />
          <BucketHeader label="Ready" count={ready.length} tier={RiskTier.READY} colorClass="bg-green-400" />
        </ul>
      </div>

      <div className="p-4 flex flex-col gap-2">
        <button
          onClick={() => updateState({ current_document_id: null, is_exporting: false })}
          className="w-full text-[13px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-4 py-2 rounded-md transition-colors"
        >
          Upload files
        </button>
        <button
          onClick={() => updateState({ is_exporting: true })}
          className="w-full text-[13px] font-medium text-white bg-black hover:bg-gray-800 px-4 py-2 rounded-md transition-colors shadow-sm"
        >
          Export batch
        </button>
      </div>
    </nav>
  );
};
