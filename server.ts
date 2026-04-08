import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { YoutubeTranscript } from "youtube-transcript/dist/youtube-transcript.esm.js";
import ytdl from "@distube/ytdl-core";
import { GoogleGenAI } from "@google/genai";
import { Innertube, UniversalCache } from 'youtubei.js';

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // Initialize Gemini API for backend file uploads
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/transcript", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      
      const transcript = await YoutubeTranscript.fetchTranscript(url);
      res.json({ transcript });
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      const lowerError = errorMessage.toLowerCase();
      
      if (
        lowerError.includes("transcript is disabled") ||
        lowerError.includes("no transcripts are available") ||
        lowerError.includes("too many requests") ||
        lowerError.includes("video unavailable") ||
        lowerError.includes("captcha")
      ) {
        console.warn(`Transcript not available for ${req.query.url}: ${errorMessage}`);
        return res.json({ transcript: null, message: errorMessage });
      }
      
      console.error("Transcript error:", error);
      res.status(500).json({ error: errorMessage || "Failed to fetch transcript" });
    }
  });

  app.get("/api/video-context", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      console.log(`Fetching context for ${url}...`);
      
      // Extract video ID
      let videoId = url;
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname.includes('youtube.com')) {
          videoId = parsedUrl.searchParams.get('v') || videoId;
        } else if (parsedUrl.hostname.includes('youtu.be')) {
          videoId = parsedUrl.pathname.slice(1);
        }
      } catch (e) {
        // Ignore URL parsing errors and use the raw string
      }

      const yt = await Innertube.create({ cache: new UniversalCache(false) });
      const info = await yt.getInfo(videoId);
      
      const title = info.primary_info?.title?.toString() || info.basic_info?.title || "";
      const description = info.secondary_info?.description?.toString() || info.basic_info?.short_description || "";
      const author = info.basic_info?.channel?.name || "";
      
      let commentsText = "";
      try {
        const originalWarn = console.warn;
        console.warn = (...args) => {
          if (args[1] && args[1].message && args[1].message.includes('CommentFilterContextView')) return;
          originalWarn(...args);
        };
        try {
          const comments = await yt.getComments(videoId);
          if (comments && comments.contents && comments.contents.length > 0) {
            const commentStrings = comments.contents
              .slice(0, 20) // Get top 20 comments
              .map((c: any) => c.comment?.content?.toString())
              .filter((c: any) => c);
            commentsText = commentStrings.join("\n---\n");
          }
        } finally {
          console.warn = originalWarn;
        }
      } catch (e) {
        console.warn("Failed to fetch comments:", e);
      }

      res.json({
        title,
        author,
        description,
        comments: commentsText
      });
    } catch (error: any) {
      console.error("Video context error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch video context" });
    }
  });
      app.post("/api/generate", async (req, res) => {
  try {
    const { contents } = req.body;

    const model = ai.getGenerativeModel({
      model: "gemini-1.5-pro",
    });

    const result = await model.generateContent({
      contents: contents,
    });

    res.json({
      text: result.response.text(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI error" });
  }
});
  app.get("/api/audio-extract", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      console.log(`Extracting audio for ${url}...`);
      const info = await ytdl.getInfo(url);
      const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
      
      if (!format) {
        return res.status(400).json({ error: "No suitable audio format found" });
      }

      let tempPath = "";
      try {
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir);
        }
        
        tempPath = path.join(tempDir, `audio_${Date.now()}.mp4`);
        const stream = ytdl(url, { format });
        
        const fileStream = fs.createWriteStream(tempPath);
        stream.pipe(fileStream);
        
        await new Promise((resolve, reject) => {
          fileStream.on('finish', () => resolve(undefined));
          fileStream.on('error', reject);
          stream.on('error', reject);
        });

        console.log(`Audio downloaded to ${tempPath}. Uploading to Gemini...`);
        
        const uploadResult = await ai.files.upload({
          file: tempPath,
          config: {
            mimeType: 'audio/mp4',
          }
        });
        
        console.log(`Upload complete. File URI: ${uploadResult.uri}`);
        
        // Clean up temp file
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        
        res.json({ fileUri: uploadResult.uri, mimeType: uploadResult.mimeType });
      } catch (innerError) {
        // Clean up temp file on error
        if (tempPath && fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        throw innerError;
      }
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      if (errorMessage.includes("Sign in to confirm you’re not a bot") || errorMessage.includes("429")) {
        console.warn("Audio extraction blocked by YouTube anti-bot protection (IP banned).");
      } else {
        console.error("Audio extraction error:", errorMessage);
      }
      
      // Return a 503 Service Unavailable or 429 Too Many Requests to indicate it's blocked by YouTube
      res.status(503).json({ 
        error: "YouTube anti-bot protection blocked the audio download. Please rely on transcript or context analysis.",
        details: errorMessage
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
