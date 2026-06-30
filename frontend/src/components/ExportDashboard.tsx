import React, { useEffect, useState } from 'react';
import { useSession } from '../store/SessionContext';

interface ExportPreview {
  reviewed: number;
  auto_approved: number;
  manual_review: number;
  ocr_warning: number;
}

export const ExportDashboard: React.FC = () => {
  const { updateState } = useSession();
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch('http://localhost:8000/api/export/preview')
      .then(res => res.json())
      .then(data => setPreview(data))
      .catch(console.error);
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('http://localhost:8000/api/export', { method: 'POST' });
      if (!res.ok) throw new Error('Export failed');
      
      // Download the zip
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'maestro_export.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      updateState({ is_exporting: false });
    } catch (e) {
      console.error(e);
      alert('Export failed.');
    } finally {
      setExporting(false);
    }
  };

  if (!preview) return <div className="flex-1 flex items-center justify-center">Loading preview...</div>;

  return (
    <div className="flex-1 bg-white flex flex-col items-center justify-center p-8">
      <div className="max-w-xl w-full bg-gray-50 border border-gray-200 rounded-lg p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">End-of-Day Safety Check</h2>
        
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600">Documents reviewed</span>
            <span className="font-semibold text-gray-900">{preview.reviewed}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600">Auto-approved by rules</span>
            <span className="font-semibold text-gray-900">{preview.auto_approved}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600">Manual-review required</span>
            <span className="font-semibold text-yellow-600">{preview.manual_review}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600">OCR warnings</span>
            <span className="font-semibold text-red-600">{preview.ocr_warning}</span>
          </div>
        </div>
        
        <p className="text-sm text-gray-500 mb-6">
          Only clean or reviewed documents will be included in the export. Documents needing attention are skipped safely. 
          Metadata will be stripped from all exported PDFs.
        </p>
        
        <div className="flex gap-4">
          <button 
            className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded hover:bg-gray-100 transition-colors"
            onClick={() => updateState({ is_exporting: false })}
            disabled={exporting}
          >
            Cancel
          </button>
          <button 
            className="flex-1 bg-blue-600 text-white font-medium py-2 rounded shadow hover:bg-blue-700 transition-colors disabled:opacity-50"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exporting...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};
