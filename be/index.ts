// server.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { mkdir, readdir, unlink, stat } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const app = new Hono();

// Types
interface VideoFile {
  filename: string;
  originalName: string;
  size: number;
  uploadDate: Date;
  url: string;
}

interface UploadResponse {
  message: string;
  filename: string;
  originalName: string;
  size: number;
  url: string;
}

// Configuration
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_EXTENSIONS = [".mp4"];

// Ensure uploads directory exists
async function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) {
    await mkdir(UPLOADS_DIR, { recursive: true });
    console.log("Created uploads directory:", UPLOADS_DIR);
  }
}

// Initialize uploads directory
await ensureUploadsDir();

// Middleware
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"], // React dev server ports
    credentials: true,
  }),
);

// Serve uploaded videos
app.use("/videos/*", serveStatic({ root: "./" }));

// Health check
app.get("/health", (c) => {
  return c.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Get all videos
app.get("/api/videos", async (c) => {
  try {
    const files = await readdir(UPLOADS_DIR);
    const videoFiles: VideoFile[] = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        const filePath = path.join(UPLOADS_DIR, file);
        const stats = await stat(filePath);

        // Extract original name from timestamp-prefixed filename
        const originalName = file.replace(/^\d+-/, "");

        videoFiles.push({
          filename: file,
          originalName,
          size: stats.size,
          uploadDate: stats.birthtime,
          url: `/videos/uploads/${file}`,
        });
      }
    }

    // Sort by upload date (newest first)
    videoFiles.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());

    return c.json(videoFiles);
  } catch (error) {
    console.error("Error reading videos:", error);
    return c.json({ error: "Failed to read videos" }, 500);
  }
});

// Upload video
app.post("/api/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("video") as File;

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return c.json(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        400,
      );
    }

    // Validate file extension
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return c.json({ error: "Only MP4 files are allowed" }, 400);
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    // Save file
    const arrayBuffer = await file.arrayBuffer();
    await Bun.write(filePath, arrayBuffer);

    const response: UploadResponse = {
      message: "File uploaded successfully",
      filename,
      originalName: file.name,
      size: file.size,
      url: `/videos/uploads/${filename}`,
    };

    return c.json(response);
  } catch (error) {
    console.error("Upload error:", error);
    return c.json({ error: "Upload failed" }, 500);
  }
});

// Delete video
app.delete("/api/videos/:filename", async (c) => {
  try {
    const filename = c.req.param("filename");

    // Security check - prevent path traversal
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return c.json({ error: "Invalid filename" }, 400);
    }

    const filePath = path.join(UPLOADS_DIR, filename);

    if (!existsSync(filePath)) {
      return c.json({ error: "Video not found" }, 404);
    }

    await unlink(filePath);
    return c.json({ message: "Video deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    return c.json({ error: "Failed to delete video" }, 500);
  }
});

// Stream video with range support
app.get("/api/stream/:filename", async (c) => {
  try {
    const filename = c.req.param("filename");

    // Security check
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return c.json({ error: "Invalid filename" }, 400);
    }

    const filePath = path.join(UPLOADS_DIR, filename);

    if (!existsSync(filePath)) {
      return c.json({ error: "Video not found" }, 404);
    }

    const file = Bun.file(filePath);
    const fileSize = file.size;
    const range = c.req.header("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const stream = file.slice(start, end + 1).stream();

      return new Response(stream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Content-Type": "video/mp4",
        },
      });
    } else {
      return new Response(file.stream(), {
        headers: {
          "Content-Length": fileSize.toString(),
          "Content-Type": "video/mp4",
        },
      });
    }
  } catch (error) {
    console.error("Stream error:", error);
    return c.json({ error: "Failed to stream video" }, 500);
  }
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Server error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = process.env.PORT || 8000;

console.log(`🚀 MP4 Server starting on http://localhost:${port}`);
console.log("📁 Upload directory:", UPLOADS_DIR);
console.log("📊 Max file size:", MAX_FILE_SIZE / 1024 / 1024, "MB");
console.log("🎬 Allowed formats:", ALLOWED_EXTENSIONS.join(", "));

export default {
  port,
  fetch: app.fetch,
};
console.log("Hello via Bun!");

