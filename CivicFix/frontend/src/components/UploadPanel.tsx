import React, { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Loader2, Sparkles, Upload, X } from "lucide-react";
import { IssueType } from "../types";

interface UploadPanelProps {
  onVerify: (beforeFile: File, afterFile: File, issueType: IssueType) => void;
  loading: boolean;
  activeStep: number;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const UploadPanel: React.FC<UploadPanelProps> = ({ onVerify, loading, activeStep }) => {
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string | null>(null);
  const [afterPreview, setAfterPreview] = useState<string | null>(null);
  const [issueType, setIssueType] = useState<IssueType>("pothole");
  const [validationError, setValidationError] = useState<string | null>(null);

  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = (file: File, type: "before" | "after") => {
    setValidationError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setValidationError(`Invalid file format for ${file.name}. Only JPEG, PNG, and WebP are supported.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setValidationError(`File ${file.name} is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Limit is 10MB.`);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    if (type === "before") {
      setBeforeFile(file);
      setBeforePreview(previewUrl);
    } else {
      setAfterFile(file);
      setAfterPreview(previewUrl);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, type: "before" | "after") => {
    e.preventDefault();
    if (loading) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0], type);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleClear = (type: "before" | "after") => {
    if (type === "before") {
      setBeforeFile(null);
      setBeforePreview(null);
      if (beforeInputRef.current) beforeInputRef.current.value = "";
    } else {
      setAfterFile(null);
      setAfterPreview(null);
      if (afterInputRef.current) afterInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!beforeFile || !afterFile) {
      setValidationError("Please provide both BEFORE and AFTER photographs to proceed.");
      return;
    }
    setValidationError(null);
    onVerify(beforeFile, afterFile, issueType);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 sm:p-6 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-navy-900 flex items-center gap-2">
            Contractor Proof Submission
          </h2>
          <p className="text-xs text-slate-500">
            Upload citizen complaint photo and contractor's claimed resolution photo
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="issue-type" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
            Civic Work:
          </label>
          <select
            id="issue-type"
            value={issueType}
            onChange={(e) => setIssueType(e.target.value as IssueType)}
            disabled={loading}
            className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-800 focus:border-transparent transition"
          >
            <option value="pothole">Pothole Repair</option>
            <option value="garbage">Garbage Clean-up</option>
            <option value="drain">Storm Drain Desilting</option>
            <option value="other">Other Civic Maintenance</option>
          </select>
        </div>
      </div>

      {validationError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* BEFORE PHOTO DROPZONE */}
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>1. BEFORE PHOTO (Complaint)</span>
              {beforeFile && (
                <span className="text-[11px] font-normal text-slate-400">
                  {(beforeFile.size / 1024).toFixed(0)} KB
                </span>
              )}
            </span>
            <div
              onDrop={(e) => handleDrop(e, "before")}
              onDragOver={handleDragOver}
              onClick={() => !beforePreview && beforeInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl h-52 flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all overflow-hidden ${
                beforePreview
                  ? "border-emerald-400 bg-slate-900"
                  : "border-slate-300 hover:border-navy-700 bg-slate-50/60 hover:bg-slate-50"
              }`}
            >
              <input
                ref={beforeInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={loading}
                onChange={(e) => e.target.files?.[0] && validateAndSetFile(e.target.files[0], "before")}
              />

              {beforePreview ? (
                <>
                  <img
                    src={beforePreview}
                    alt="Before repair preview"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClear("before");
                    }}
                    disabled={loading}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition shadow"
                    title="Remove image"
                    aria-label="Remove before image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/65 text-white text-[10px] rounded font-medium backdrop-blur-sm">
                    BEFORE PHOTO
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-600 mb-2">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    Click to select or drag & drop photo
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    JPG, PNG or WebP (max 10MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* AFTER PHOTO DROPZONE */}
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>2. AFTER PHOTO (Claimed Fix)</span>
              {afterFile && (
                <span className="text-[11px] font-normal text-slate-400">
                  {(afterFile.size / 1024).toFixed(0)} KB
                </span>
              )}
            </span>
            <div
              onDrop={(e) => handleDrop(e, "after")}
              onDragOver={handleDragOver}
              onClick={() => !afterPreview && afterInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl h-52 flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all overflow-hidden ${
                afterPreview
                  ? "border-emerald-400 bg-slate-900"
                  : "border-slate-300 hover:border-navy-700 bg-slate-50/60 hover:bg-slate-50"
              }`}
            >
              <input
                ref={afterInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={loading}
                onChange={(e) => e.target.files?.[0] && validateAndSetFile(e.target.files[0], "after")}
              />

              {afterPreview ? (
                <>
                  <img
                    src={afterPreview}
                    alt="After repair preview"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClear("after");
                    }}
                    disabled={loading}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition shadow"
                    title="Remove image"
                    aria-label="Remove after image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/65 text-white text-[10px] rounded font-medium backdrop-blur-sm">
                    AFTER PHOTO
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-600 mb-2">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    Click to select or drag & drop photo
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    JPG, PNG or WebP (max 10MB)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LOADING ANIMATED PROGRESS STEPS */}
        {loading && (
          <div className="p-4 bg-navy-900 text-white rounded-xl shadow-inner space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-saffron animate-spin" />
                Processing Verification Pipeline...
              </span>
              <span className="text-saffron-light">BBMP CivicFix Engine</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* Step 1 */}
              <div
                className={`p-2 rounded-lg border text-xs flex items-center gap-2 transition-all ${
                  activeStep >= 1
                    ? "bg-navy-800 border-saffron/60 text-white"
                    : "bg-navy-950/50 border-white/10 text-slate-400"
                }`}
              >
                {activeStep > 1 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : activeStep === 1 ? (
                  <Loader2 className="w-4 h-4 text-saffron animate-spin flex-shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-slate-500 flex items-center justify-center text-[10px]">
                    1
                  </span>
                )}
                <span className="font-medium">1. Checking Metadata</span>
              </div>

              {/* Step 2 */}
              <div
                className={`p-2 rounded-lg border text-xs flex items-center gap-2 transition-all ${
                  activeStep >= 2
                    ? "bg-navy-800 border-saffron/60 text-white"
                    : "bg-navy-950/50 border-white/10 text-slate-400"
                }`}
              >
                {activeStep > 2 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : activeStep === 2 ? (
                  <Loader2 className="w-4 h-4 text-saffron animate-spin flex-shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-slate-500 flex items-center justify-center text-[10px]">
                    2
                  </span>
                )}
                <span className="font-medium">2. Aligning Images</span>
              </div>

              {/* Step 3 */}
              <div
                className={`p-2 rounded-lg border text-xs flex items-center gap-2 transition-all ${
                  activeStep >= 3
                    ? "bg-navy-800 border-saffron/60 text-white"
                    : "bg-navy-950/50 border-white/10 text-slate-400"
                }`}
              >
                {activeStep === 3 ? (
                  <Loader2 className="w-4 h-4 text-saffron animate-spin flex-shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-slate-500 flex items-center justify-center text-[10px]">
                    3
                  </span>
                )}
                <span className="font-medium">3. Auditing with AI</span>
              </div>
            </div>
          </div>
        )}

        {/* SUBMIT BUTTON */}
        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            disabled={loading || !beforeFile || !afterFile}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-saffron ${
              loading || !beforeFile || !afterFile
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-saffron hover:bg-saffron-dark text-white hover:shadow"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying Proof-of-Fix...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Run Verification Audit
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
