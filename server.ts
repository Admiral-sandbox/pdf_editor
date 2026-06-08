import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up server-side Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY is not defined in the environment variables!");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

const ai = getGeminiClient();

// Configure body-parser to accept larger file payloads (scanned document images)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Document layout processor route
app.post("/api/process-document", async (req: express.Request, res: express.Response) => {
  try {
    const { image, languageHint } = req.body;
    
    if (!image) {
      res.status(400).json({ error: "Missing base64 document image data" });
      return;
    }

    // Clean base64 pattern (e.g. data:image/png;base64,xxxx)
    let base64Data = image;
    let mimeType = "image/jpeg";
    
    if (image.startsWith("data:")) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }

    const imagePart = {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    };

    const promptText = `
      You are highly accurate "Chnada OCR Layout reconstruction bot".
      Analyze the uploaded document image very carefully.
      
      Your goal is to perform a full high-fidelity layout reconstruction.
      1. Perform OCR in its native layout format (works for any language, including Kannada, Hindi, and English). Keep all original characters, words, sentences exactly as they are.
      2. Identify the dimensions of the document and bounding box coordinates for each component.
      3. For each textual and visual element, determine:
         - Id (unique string)
         - Type ('heading', 'text', 'divider', 'image')
         - Exact Text Content (keep empty for dividers/lines; for images, provide a short description like "[Logo Image]")
         - Bounding coordinates: x (left position, from 0 to page width), y (top position, from 0 to total document height)
         - Size coordinates: width, height (dimensions on the page scale)
         - Style attributes: approx fontSize in pixels (e.g., 14 for body text, 22-38 for headings), fontWeight ('normal' or 'bold'), fontStyle ('normal' or 'italic'), alignment ('left', 'center', 'right')
         - Hex Color (e.g. #0f172a or #2563eb, carefully extracted from the visual theme)
         
      Please map any coordinate positions using a standard grid width of 800 and 1050 per page. If the document visually consists of multiple pages joined vertically, the total height is 2100 (for 2 pages) or 3150 (for 3 pages). The vertical coordinate 'y' must range from 0 to the overall document height (e.g. page 1 is 0 to 1050, page 2 is 1050 to 2100, page 3 is 2100 to 3150).
      Make sure to return elements in visual top-to-bottom reading order, and capture everything without truncating any questions or content.
      ${languageHint ? `Instruction: Focus heavily on capturing correct characters for "${languageHint}".` : ""}
    `;

    const textPart = { text: promptText };

    const tryModels = [
      "gemini-2.5-flash",
      "gemini-1.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash"
    ];
    let lastError: any = null;
    let response: any = null;
    let successfulModel = "";

    modelLoop: for (const modelName of tryModels) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Attempting Gemini OCR Layout Analysis with model ${modelName} (Attempt ${attempt}/3)... (MimeType: ${mimeType})`);
          response = await ai.models.generateContent({
             model: modelName,
             contents: [imagePart, textPart],
             config: {
               responseMimeType: "application/json",
               responseSchema: {
                 type: Type.OBJECT,
                 properties: {
                   width: { type: Type.INTEGER, description: "Normalized grid width (always 800)" },
                   height: { type: Type.INTEGER, description: "Overall document grid height (e.g. 1050 for 1 page, 2100 for 2 pages, 3150 for 3 pages)" },
                   elements: {
                     type: Type.ARRAY,
                     items: {
                       type: Type.OBJECT,
                       properties: {
                         id: { type: Type.STRING },
                         type: { type: Type.STRING, description: "Must be 'text', 'heading', 'divider', or 'image'" },
                         content: { type: Type.STRING, description: "The literal OCR text read from document in original language. For divider, leave empty. For image describe it." },
                         x: { type: Type.NUMBER, description: "The horizontal left start position on the scale 0 to 800" },
                         y: { type: Type.NUMBER, description: "The vertical top start position on the scale 0 to the overall height (e.g., can go up to 2100 or 3150 depending on height)" },
                         width: { type: Type.NUMBER, description: "Width coordinate on the 800 scale" },
                         height: { type: Type.NUMBER, description: "Height coordinate of the element box" },
                         fontSize: { type: Type.INTEGER, description: "Visual pixel font size, typically 12 to 44" },
                         fontWeight: { type: Type.STRING, description: "'normal' or 'bold'" },
                         fontStyle: { type: Type.STRING, description: "'normal' or 'italic'" },
                         color: { type: Type.STRING, description: "Hex value color code matching original" },
                         alignment: { type: Type.STRING, description: "'left', 'center', or 'right'" }
                       },
                       required: ["id", "type", "content", "x", "y", "width", "height"]
                     }
                   }
                 },
                 required: ["width", "height", "elements"]
               }
             }
          });
          
          if (response && response.text) {
            successfulModel = modelName;
            break modelLoop;
          }
        } catch (err: any) {
          const errString = err.message ? String(err.message) : (typeof err === "object" ? JSON.stringify(err) : String(err));
          const lowercaseErr = errString.toLowerCase();
          const isHighDemand = lowercaseErr.includes("503") || 
                               lowercaseErr.includes("unavailable") || 
                               lowercaseErr.includes("high demand") ||
                               lowercaseErr.includes("429") ||
                               lowercaseErr.includes("rate limit") ||
                               lowercaseErr.includes("rate-limit") ||
                               lowercaseErr.includes("quota") ||
                               lowercaseErr.includes("exhausted") ||
                               lowercaseErr.includes("resource_exhausted") ||
                               err.status === 503 || 
                               err.status === 429 ||
                               err.status === "RESOURCE_EXHAUSTED" ||
                               err.status === "UNAVAILABLE" ||
                               err.statusCode === 503 ||
                               err.statusCode === 429;

          lastError = err;
          console.warn(`[OCR ERROR] Model ${modelName} failed on attempt ${attempt}/3:`, errString);

          if (isHighDemand) {
            console.warn(`[OCR FAILOVER] Model ${modelName} is busy, quota-exhausted, or rate-limited. Skipping remaining retries for this model to failover immediately.`);
            break; // Skip remaining attempts of this busy model to try the next model immediately
          }

          if (attempt < 3) {
            const waitTime = attempt * 1000;
            console.log(`[OCR RETRY] Waiting ${waitTime}ms before retry due to transient warning...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          } else {
            console.warn(`[OCR FAILOVER] Model ${modelName} fully exhausted after 3 attempts. Failing over to next model...`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("All tried models failed to extract document structure.");
    }

    const parsedResponse = JSON.parse(response.text || "{}");
    console.log(`Successfully processed document layout extraction using Chnada OCR with model ${successfulModel}.`);
    res.json(parsedResponse);
    
  } catch (error: any) {
    console.error("Error inside process-document route:", error);
    res.status(500).json({ 
      error: "Failed to parse document layout using Gemini Chnada OCR", 
      details: error.message || error 
    });
  }
});

// Configure Vite or Serve static assets
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite integration...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

setupServer();
