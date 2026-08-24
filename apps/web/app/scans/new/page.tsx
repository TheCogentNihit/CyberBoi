"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ApkDropzone } from "@/components/upload/ApkDropzone";
import { UploadProgressBar } from "@/components/upload/UploadProgressBar";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Button } from "@/components/ui/button";
import { createScan, uploadApk, startScan } from "@/lib/api-client";
import type { ScanProfile } from "@/lib/types";

const PROFILES: { value: ScanProfile; label: string; description: string }[] = [
  { value: "quick", label: "Quick", description: "Fast scan — basic checks only" },
  { value: "standard", label: "Standard", description: "Balanced analysis coverage" },
  { value: "full", label: "Full", description: "Comprehensive analysis — all checks" },
];

export default function NewScanPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<ScanProfile>("full");
  const [step, setStep] = useState<"idle" | "uploading" | "queuing" | "done">("idle");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelected = useCallback((f: File) => {
    setFile(f);
    setError(null);
  }, []);

  const handleStartScan = useCallback(async () => {
    if (!file) return;
    setError(null);

    try {
      // Step 1: Create scan
      setStep("uploading");
      const { scan_id } = await createScan(file.name);

      // Step 2: Upload APK with progress
      setUploadPercent(0);
      await uploadApk(scan_id, file, (percent) => setUploadPercent(percent));

      // Step 3: Start scan
      setStep("queuing");
      await startScan(scan_id, profile);

      // Step 4: Redirect
      setStep("done");
      router.push(`/scans/${scan_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setStep("idle");
    }
  }, [file, profile, router]);

  const isProcessing = step === "uploading" || step === "queuing" || step === "done";

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      className="mx-auto max-w-2xl space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants} className="text-center space-y-2 mb-8">
        <h2 className="text-4xl font-bold tracking-tight">New Analysis</h2>
        <p className="text-muted-foreground text-lg">
          Upload an Android APK file for deep security introspection
        </p>
      </motion.div>

      {/* Dropzone */}
      <motion.div variants={itemVariants}>
        <SpotlightCard className="p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">1</span>
            Select File
          </h3>
          <ApkDropzone onFileSelected={handleFileSelected} disabled={isProcessing} />
        </SpotlightCard>
      </motion.div>

      {/* Profile selector */}
      <motion.div variants={itemVariants}>
        <SpotlightCard className="p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">2</span>
            Scan Profile
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {PROFILES.map((p) => (
              <button
                key={p.value}
                onClick={() => !isProcessing && setProfile(p.value)}
                disabled={isProcessing}
                className={`group relative overflow-hidden rounded-xl border p-5 text-left transition-all duration-300 ${
                  profile === p.value
                    ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(120,255,200,0.15)]"
                    : "border-border/50 hover:border-primary/40 hover:bg-accent/30"
                } ${isProcessing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                {profile === p.value && (
                  <motion.div 
                    layoutId="profile-active-bg"
                    className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent"
                    initial={false}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className="relative z-10 flex items-center gap-3 mb-2">
                  <div
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      profile === p.value
                        ? "border-primary"
                        : "border-muted-foreground/40 group-hover:border-primary/50"
                    }`}
                  >
                    {profile === p.value && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="h-2.5 w-2.5 rounded-full bg-primary" 
                      />
                    )}
                  </div>
                  <span className={`font-semibold ${profile === p.value ? "text-primary" : "text-foreground"}`}>
                    {p.label}
                  </span>
                </div>
                <p className="relative z-10 text-xs text-muted-foreground leading-relaxed">
                  {p.description}
                </p>
              </button>
            ))}
          </div>
        </SpotlightCard>
      </motion.div>

      <AnimatePresence mode="popLayout">
        {/* Upload progress & Queuing spinner combined */}
        {(step === "uploading" || step === "queuing") && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: "auto", scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <SpotlightCard className="p-8 border-primary/30 bg-primary/5">
              {step === "uploading" ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-primary animate-pulse">Uploading APK securely...</span>
                    <span>{uploadPercent}%</span>
                  </div>
                  <UploadProgressBar percent={uploadPercent} label="" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 space-y-4">
                  <div className="relative h-12 w-12">
                    <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-2 w-2 bg-primary rounded-full animate-ping"></div>
                    </div>
                  </div>
                  <span className="text-lg font-medium text-primary">Initializing Sandbox...</span>
                  <p className="text-sm text-muted-foreground">Queuing for analysis engine</p>
                </div>
              )}
            </SpotlightCard>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <div className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive backdrop-blur-sm">
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="font-medium">{error}</span>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto border-destructive/50 hover:bg-destructive/20 text-destructive"
                onClick={() => {
                  setError(null);
                  setStep("idle");
                }}
              >
                Try Again
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start button */}
      <motion.div variants={itemVariants} className="pt-4">
        <Button
          size="lg"
          className={`w-full h-14 text-lg font-bold transition-all duration-300 ${
            !file || isProcessing 
              ? "opacity-50" 
              : "hover:scale-[1.02] shadow-[0_0_20px_rgba(120,255,200,0.3)] hover:shadow-[0_0_30px_rgba(120,255,200,0.5)]"
          }`}
          disabled={!file || isProcessing}
          onClick={handleStartScan}
        >
          {isProcessing ? (
            <span className="flex items-center gap-3">
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing Request...
            </span>
          ) : (
            <span className="flex items-center gap-2 tracking-wide">
              <svg className="h-6 w-6 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              Initiate Analysis
            </span>
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}
