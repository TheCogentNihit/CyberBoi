"use client";

import { useCallback, useState, useRef } from "react";

const MAX_APK_SIZE = 150 * 1024 * 1024; // 150 MB

interface ApkDropzoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ApkDropzone({ onFileSelected, disabled }: ApkDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);

      if (!file.name.toLowerCase().endsWith(".apk")) {
        setError("Only .apk files are accepted");
        return;
      }

      if (file.size > MAX_APK_SIZE) {
        setError(`File exceeds ${MAX_APK_SIZE / (1024 * 1024)} MB limit`);
        return;
      }

      if (file.size === 0) {
        setError("File is empty");
        return;
      }

      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [disabled, validateAndSelect]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  return (
    <div className="space-y-3">
      <div
        className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : dragOver
            ? "border-primary bg-primary/10 glow-cyan"
            : "border-border hover:border-primary/50 hover:bg-accent/50 cursor-pointer"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".apk"
          className="hidden"
          onChange={handleChange}
          disabled={disabled}
        />

        <div className="flex flex-col items-center gap-3">
          {/* Upload icon */}
          <div className={`rounded-full p-3 transition-colors ${dragOver ? "bg-primary/20" : "bg-muted"}`}>
            <svg
              className={`h-8 w-8 transition-colors ${dragOver ? "text-primary" : "text-muted-foreground"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>

          {selectedFile ? (
            <div className="space-y-1">
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                Drop your APK here or click to browse
              </p>
              <p className="text-sm text-muted-foreground">
                Accepts .apk files up to {MAX_APK_SIZE / (1024 * 1024)} MB
              </p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-cyber-red/30 bg-cyber-red/10 px-4 py-2 text-sm text-cyber-red">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
