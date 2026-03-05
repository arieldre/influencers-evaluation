import React, { useState, useCallback } from 'react';

export default function FileUpload({ onFileLoaded }) {
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => onFileLoaded(e.target.result, file.name);
    reader.readAsArrayBuffer(file);
  }, [onFileLoaded]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  return (
    <div
      className={`upload-zone ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.xls';
        input.onchange = (e) => handleFile(e.target.files[0]);
        input.click();
      }}
    >
      <p style={{ fontSize: '1.2rem', marginBottom: 8 }}>
        📁 Drop your Excel file here or click to browse
      </p>
      <p style={{ color: '#888', fontSize: '0.85rem' }}>
        Supports .xlsx / .xls — auto-detects sheet and start row
      </p>
    </div>
  );
}
