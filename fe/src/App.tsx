"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import {
  Upload,
  Trash2,
  Copy,
  Video,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Play,
  Calendar,
  HardDrive,
} from "lucide-react";

const API = "http://localhost:8000";

interface VideoFile {
  filename: string;
  originalName: string;
  size: number;
  uploadDate: string;
  url: string;
}

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

const formatDate = (date: string) =>
  new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  );
};

const Toast = ({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) => {
  useEffect(() => {
    const id = setTimeout(onClose, 4000);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <div className="fixed top-6 right-6 z-50 duration-300 animate-in slide-in-from-right-full">
      <div
        className={`
          px-6 py-4 flex items-center gap-3 rounded-xl shadow-lg backdrop-blur-sm border
          ${
            type === "success"
              ? "bg-emerald-500/90 border-emerald-400 text-white"
              : "bg-red-500/90 border-red-400 text-white"
          }
        `}
      >
        {type === "success" ? (
          <CheckCircle size={20} className="flex-shrink-0" />
        ) : (
          <AlertCircle size={20} className="flex-shrink-0" />
        )}
        <span className="font-medium">{message}</span>
      </div>
    </div>
  );
};

const VideoCard = ({
  video,
  onDelete,
  onCopy,
}: {
  video: VideoFile;
  onDelete: (filename: string) => void;
  onCopy: (filename: string) => void;
}) => {
  const [deleting, setDeleting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this video?")) return;
    setDeleting(true);
    await onDelete(video.filename);
    setDeleting(false);
  };

  return (
    <div
      className="overflow-hidden relative bg-white rounded-2xl border border-gray-100 shadow-sm transition-all duration-300 hover:border-gray-200 hover:shadow-xl group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="overflow-hidden relative">
        <video
          className="object-cover w-full h-48 transition-transform duration-300 group-hover:scale-105"
          controls={isHovered}
          preload="metadata"
          controlsList="nodownload"
          poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath fill='%23e5e7eb' d='M0 0h24v24H0z'/%3E%3C/svg%3E"
        >
          <source src={`${API}${video.url}`} type="video/mp4" />
        </video>
        {!isHovered && (
          <div className="flex absolute inset-0 justify-center items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-black/20">
            <div className="p-3 rounded-full bg-white/90 backdrop-blur-sm">
              <Play size={24} className="ml-1 text-gray-700" />
            </div>
          </div>
        )}
      </div>

      <div className="p-5">
        <h3
          className="mb-2 text-lg font-semibold text-gray-900 truncate"
          title={video.originalName}
        >
          {video.originalName}
        </h3>

        <div className="mb-4 space-y-2">
          <div className="flex gap-2 items-center text-sm text-gray-500">
            <Calendar size={14} />
            <span>{formatDate(video.uploadDate)}</span>
          </div>
          <div className="flex gap-2 items-center text-sm text-gray-500">
            <HardDrive size={14} />
            <span>{formatFileSize(video.size)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onCopy(video.filename)}
            className="flex flex-1 gap-2 justify-center items-center py-2.5 px-4 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-sm transition-all duration-200 hover:from-blue-600 hover:to-blue-700 hover:shadow-md"
          >
            <Copy size={16} />
            Copy Link
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex gap-2 justify-center items-center py-2.5 px-4 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-red-600 rounded-xl shadow-sm transition-all duration-200 hover:from-red-600 hover:to-red-700 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={16} />
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

const UploadZone = ({
  onUpload,
  uploading,
  progress,
}: {
  onUpload: (file: File) => void;
  uploading: boolean;
  progress: UploadProgress | null;
}) => {
  const [drag, setDrag] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = Array.from(e.dataTransfer.files).find(
      (f) => f.type === "video/mp4",
    );
    if (file) onUpload(file);
  };

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300
        ${
          drag
            ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-400 scale-[1.02]"
            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50/50"
        }
        ${uploading ? "opacity-50 pointer-events-none" : ""}
      `}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDrag(false);
      }}
      onDrop={handleDrop}
    >
      <div className="relative z-10">
        <div className="flex justify-center items-center mx-auto mb-6 w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl">
          <Video size={40} className="text-blue-600" />
        </div>

        <h3 className="mb-2 text-2xl font-bold text-gray-800">
          Upload MP4 Videos
        </h3>
        <p className="mx-auto mb-8 max-w-md text-gray-500">
          Drag and drop your video files here, or click the button below to
          browse and select files
        </p>

        <input
          type="file"
          accept="video/mp4"
          id="upload"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
          }}
        />
        <label
          htmlFor="upload"
          className="inline-flex gap-3 items-center py-4 px-8 font-semibold text-white bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 rounded-2xl shadow-lg transition-all duration-300 transform cursor-pointer hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 hover:shadow-xl hover:scale-105"
        >
          <Upload size={22} />
          Choose Video File
        </label>

        {progress && (
          <div className="mx-auto mt-8 max-w-md">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Uploading...
              </span>
              <span className="text-sm font-bold text-blue-600">
                {progress.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="overflow-hidden h-3 bg-gray-200 rounded-full">
              <div
                className="h-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {formatFileSize(progress.loaded)} of{" "}
              {formatFileSize(progress.total)}
            </p>
          </div>
        )}
      </div>

      {drag && (
        <div className="absolute inset-0 bg-gradient-to-br rounded-3xl from-blue-500/10 to-indigo-500/10" />
      )}
    </div>
  );
};

const App = () => {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const loadVideos = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/videos`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVideos(data);
    } catch {
      setToast({ message: "Failed to load videos", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const uploadVideo = (file: File) => {
    setUploading(true);
    setProgress({ loaded: 0, total: file.size, percentage: 0 });

    const formData = new FormData();
    formData.append("video", file);

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = (e.loaded / e.total) * 100;
        setProgress({ loaded: e.loaded, total: e.total, percentage: percent });
      }
    };

    xhr.onload = () => {
      setUploading(false);
      setProgress(null);
      if (xhr.status === 200) {
        setToast({ message: "Video uploaded successfully!", type: "success" });
        loadVideos();
      } else {
        const err = JSON.parse(xhr.responseText);
        setToast({ message: err.error || "Upload failed", type: "error" });
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setProgress(null);
      setToast({ message: "Upload failed: network error", type: "error" });
    };

    xhr.open("POST", `${API}/api/upload`);
    xhr.send(formData);
  };

  const deleteVideo = async (filename: string) => {
    try {
      const res = await fetch(`${API}/api/videos/${filename}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setToast({ message: "Video deleted successfully", type: "success" });
      loadVideos();
    } catch {
      setToast({ message: "Failed to delete video", type: "error" });
    }
  };

  const copyLink = async (filename: string) => {
    try {
      await navigator.clipboard.writeText(`${API}/videos/uploads/${filename}`);
      setToast({ message: "Link copied to clipboard!", type: "success" });
    } catch {
      setToast({ message: "Failed to copy link", type: "error" });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br via-blue-50 to-indigo-50 from-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-6 w-16 h-16 rounded-full border-4 border-blue-200 animate-spin border-t-blue-600" />
          <p className="text-xl font-semibold text-gray-700">
            Loading your videos...
          </p>
          <p className="mt-2 text-gray-500">Please wait a moment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br via-blue-50 to-indigo-50 from-slate-50">
      <div className="py-12 px-4">
        <div className="mx-auto max-w-7xl">
          <header className="mb-12 text-center">
            <div className="inline-flex gap-3 items-center mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl">
                <Video size={32} className="text-white" />
              </div>
              <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-800 to-gray-600">
                Video Manager
              </h1>
            </div>
            <p className="mx-auto max-w-2xl text-xl text-gray-600">
              Upload, organize, and share your MP4 videos with ease. Drag and
              drop to get started.
            </p>
          </header>

          <div className="mb-12">
            <UploadZone
              onUpload={uploadVideo}
              uploading={uploading}
              progress={progress}
            />
          </div>

          <section>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-800">
                  Your Videos
                </h2>
                <p className="mt-1 text-gray-600">
                  {videos.length} {videos.length === 1 ? "video" : "videos"} in
                  your library
                </p>
              </div>
              <button
                onClick={loadVideos}
                className="flex gap-2 items-center py-3 px-6 font-medium text-gray-700 bg-white rounded-xl border border-gray-200 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:shadow-md"
              >
                <RefreshCw size={18} />
                Refresh
              </button>
            </div>

            {videos.length === 0 ? (
              <div className="py-20 text-center">
                <div className="flex justify-center items-center mx-auto mb-6 w-24 h-24 bg-gray-100 rounded-3xl">
                  <Video size={48} className="text-gray-400" />
                </div>
                <h3 className="mb-2 text-2xl font-bold text-gray-500">
                  No videos yet
                </h3>
                <p className="mx-auto max-w-md text-lg text-gray-400">
                  Upload your first video to start building your library
                </p>
              </div>
            ) : (
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {videos.map((video) => (
                  <VideoCard
                    key={video.filename}
                    video={video}
                    onDelete={deleteVideo}
                    onCopy={copyLink}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default App;
