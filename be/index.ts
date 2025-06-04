import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { mkdir, readdir, unlink, stat } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import mime from "mime-types";

const app = new Hono();

// Types
interface UploadedFile {
  filename: string;
  originalName: string;
  size: number;
  uploadDate: Date;
  url: string;
  mimeType: string | false;
}

interface UploadResponse extends Omit<UploadedFile, "uploadDate"> {
  message: string;
}

// Configuration
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".ogg",
  ".mov",
  ".png",
  ".jpg",
  ".jpeg",
  ".pdf",
]; // customizable

// Ensure uploads directory exists
async function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) {
    await mkdir(UPLOADS_DIR, { recursive: true });
    console.log("Created uploads directory:", UPLOADS_DIR);
  }
}

await ensureUploadsDir();

// Middleware
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  }),
);

app.use("/files/*", serveStatic({ root: "./" }));

// Health check
app.get("/health", (c) => {
  return c.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Get all files
app.get("/api/files", async (c) => {
  try {
    const files = await readdir(UPLOADS_DIR);
    const uploadedFiles: UploadedFile[] = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        const filePath = path.join(UPLOADS_DIR, file);
        const stats = await stat(filePath);

        uploadedFiles.push({
          filename: file,
          originalName: file.replace(/^\d+-/, ""),
          size: stats.size,
          uploadDate: stats.birthtime,
          url: `/files/uploads/${file}`,
          mimeType: mime.lookup(ext),
        });
      }
    }

    uploadedFiles.sort(
      (a, b) => b.uploadDate.getTime() - a.uploadDate.getTime(),
    );

    return c.json(uploadedFiles);
  } catch (error) {
    console.error("Error reading files:", error);
    return c.json({ error: "Failed to read files" }, 500);
  }
});

// Upload file
app.post("/api/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;

    if (!file) return c.json({ error: "No file provided" }, 400);
    if (file.size > MAX_FILE_SIZE)
      return c.json(
        { error: `File too large. Limit is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        400,
      );

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext))
      return c.json({ error: `Extension ${ext} not allowed` }, 400);

    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    const arrayBuffer = await file.arrayBuffer();
    await Bun.write(filePath, arrayBuffer);

    const response: UploadResponse = {
      message: "File uploaded successfully",
      filename,
      originalName: file.name,
      size: file.size,
      url: `/files/uploads/${filename}`,
      mimeType: mime.lookup(ext),
    };

    return c.json(response);
  } catch (error) {
    console.error("Upload error:", error);
    return c.json({ error: "Upload failed" }, 500);
  }
});

// Delete file
app.delete("/api/files/:filename", async (c) => {
  try {
    const filename = c.req.param("filename");

    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return c.json({ error: "Invalid filename" }, 400);
    }

    const filePath = path.join(UPLOADS_DIR, filename);
    if (!existsSync(filePath)) return c.json({ error: "File not found" }, 404);

    await unlink(filePath);
    return c.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    return c.json({ error: "Failed to delete file" }, 500);
  }
});

// Stream file (if supported)
app.get("/api/stream/:filename", async (c) => {
  try {
    const filename = c.req.param("filename");

    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return c.json({ error: "Invalid filename" }, 400);
    }

    const filePath = path.join(UPLOADS_DIR, filename);
    if (!existsSync(filePath)) return c.json({ error: "File not found" }, 404);

    const file = Bun.file(filePath);
    const fileSize = file.size;
    const mimeType =
      mime.lookup(path.extname(filename)) || "application/octet-stream";
    const range = c.req.header("range");

    if (range && mimeType.startsWith("video/")) {
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const stream = file.slice(start, end + 1).stream();

      return new Response(stream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Content-Type": mimeType,
        },
      });
    }

    return new Response(file.stream(), {
      headers: {
        "Content-Length": fileSize.toString(),
        "Content-Type": mimeType,
      },
    });
  } catch (error) {
    console.error("Stream error:", error);
    return c.json({ error: "Failed to stream file" }, 500);
  }
});

// 404 & error handler
app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error("Server error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = process.env.PORT || 8000;

console.log(`🚀 Server running at http://localhost:${port}`);
console.log("📁 Upload directory:", UPLOADS_DIR);
console.log("📦 Max upload size:", MAX_FILE_SIZE / 1024 / 1024, "MB");
console.log("🎉 Allowed extensions:", ALLOWED_EXTENSIONS.join(", "));

export default {
  port,
  fetch: app.fetch,
};

console.log("Hello via Bun!");
