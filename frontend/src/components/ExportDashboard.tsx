import React, { useEffect, useState } from 'react';
import { useSession } from '../store/SessionContext';

interface ExportPreview {
  reviewed: number;
  auto_approved: number;
  manual_review: number;
  ocr_warning: number;
  total: number;
}

export const ExportDashboard: React.FC = () => {
  const { state, updateState } = useSession();
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  useEffect(() => {
    fetch('/api/export/preview')
      .then(res => res.json())
      .then(data => setPreview(data))
      .catch(console.error);
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/export', { method: 'POST' });
      const blob = await res.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `maestro_export_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      setExportComplete(true);
    } catch (e) {
      console.error(e);
      setIsExporting(false);
    }
  };

  if (exportComplete) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#fafafa]">
        <div className="max-w-md w-full bg-white rounded-md p-8 shadow-sm border border-gray-200/60 text-center">
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Export Complete</h2>
          <p className="text-gray-500 text-[14px] mb-8">The ZIP file containing the redacted documents, audit log, and manifest has been downloaded.</p>
          <button
            onClick={() => updateState({ is_exporting: false })}
            className="px-6 py-2 bg-black text-white text-[13px] font-medium rounded hover:bg-gray-800 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!preview) {
    return <div className="flex-1 flex items-center justify-center bg-[#fafafa] text-gray-500 text-sm">Loading preview...</div>;
  }

  const pendingCount = preview.total - preview.reviewed;
  const isReadyToExport = preview.reviewed > 0;

  return (
    <div className="flex-1 flex items-center justify-center bg-[#fafafa] p-8">
      <div className="max-w-lg w-full">
        
        <div className="mb-8">
          <button 
            onClick={() => updateState({ is_exporting: false })}
            className="flex items-center text-[13px] text-gray-400 hover:text-gray-900 transition-colors mb-6"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Back to review
          </button>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">End-of-Day Check</h2>
          <p className="text-[14px] text-gray-500">Review your session metrics before generating the final export batch.</p>
        </div>

        <div className="bg-white rounded-md border border-gray-200/80 shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center py-3 border-b border-gray-100">
            <span className="text-[14px] text-gray-600">Eligible for export</span>
            <span className="font-semibold text-gray-900">{preview.reviewed}</span>
          </div>
          {pendingCount > 0 && (
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-[14px] text-gray-600">Still pending review</span>
              <span className="font-semibold text-amber-500">{pendingCount}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-3 border-b border-gray-100">
            <span className="text-[14px] text-gray-600">Clean docs (no PII)</span>
            <span className="font-semibold text-gray-900">{preview.auto_approved}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-100">
            <span className="text-[14px] text-gray-600">Docs requiring manual review</span>
            <span className="font-semibold text-amber-500">{preview.manual_review}</span>
          </div>
          {preview.ocr_warning > 0 && (
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-[14px] text-red-500">OCR warnings</span>
              <span className="font-semibold text-red-500">{preview.ocr_warning}</span>
            </div>
          )}
        </div>

        <div className="bg-gray-50 rounded-md p-5 text-[13px] text-gray-500 mb-8 space-y-2 border border-gray-100">
          <div className="flex gap-2 items-start"><div className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 shrink-0"/><span>Metadata will be completely stripped from all PDFs.</span></div>
          <div className="flex gap-2 items-start"><div className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 shrink-0"/><span>Redacted entities are visually black-boxed and text removed.</span></div>
          <div className="flex gap-2 items-start"><div className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 shrink-0"/><span>Includes a full audit CSV and manifest.json.</span></div>
          {pendingCount > 0 && (
            <div className="flex gap-2 items-start text-amber-600 mt-4"><div className="w-1 h-1 bg-amber-500 rounded-full mt-1.5 shrink-0"/><span>{pendingCount} documents with unreviewed entities will be excluded.</span></div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button 
            onClick={() => updateState({ is_exporting: false })}
            className="px-4 py-2 text-[13px] text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleExport}
            disabled={!isReadyToExport || isExporting}
            className={`px-5 py-2 rounded-md text-[13px] font-medium transition-all ${
              !isReadyToExport 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-black text-white hover:bg-gray-800 shadow-sm'
            }`}
          >
            {isExporting ? 'Generating ZIP...' : `Export ${preview.reviewed} Documents`}
          </button>
        </div>

      </div>
    </div>
  );
};
