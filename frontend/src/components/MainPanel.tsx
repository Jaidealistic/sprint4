import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSession } from '../store/SessionContext';
import { DocumentViewer } from './DocumentViewer';

export const MainPanel: React.FC = () => {
  const { state } = useSession();
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Handle file upload to /api/documents
    const formData = new FormData();
    acceptedFiles.forEach(file => formData.append('files', file));
    try {
      await fetch('/api/documents', {
        method: 'POST',
        body: formData
      });
      // Optionally trigger a refresh
    } catch (e) {
      console.error(e);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: !!state.current_document_id });

  return (
    <main className="flex-1 bg-gray-200 h-full flex flex-col relative overflow-hidden">
      <div 
        {...getRootProps()} 
        className={`absolute inset-0 flex items-center justify-center transition-colors z-50 ${
          isDragActive ? 'bg-blue-50/90 border-4 border-blue-500 border-dashed' : 'pointer-events-none'
        }`}
      >
        <input {...getInputProps()} />
        {isDragActive && (
          <div className="bg-white p-8 rounded-xl shadow-2xl flex flex-col items-center">
            <p className="text-xl font-bold text-blue-600">Drop the case files here...</p>
          </div>
        )}
      </div>

      {state.current_document_id ? (
        <DocumentViewer />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
           <div 
             {...getRootProps()} 
             className="w-full max-w-2xl h-64 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 bg-white shadow-sm pointer-events-auto"
           >
             <input {...getInputProps()} />
             <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
             </svg>
             <p className="text-lg font-medium text-gray-700">Drag & drop case files here</p>
             <p className="text-sm text-gray-500 mt-2">or click to select files</p>
           </div>
        </div>
      )}
    </main>
  );
};
