/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
export const runtime = 'nodejs';

import { NextResponse, NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import OcrWrapper from "../../../scripts/index.js"; // Updated import

// Interfaces for OCR response
export interface OCRResult {
  bbox: number[][];
  text: string;
  confidence: number;
}

export interface Paragraph {
  text: string;
  bbox: number[][];
  score: number;
  item_count: number;
  individual_items: {
    bbox: number[][];
    text: string;
    score: number;
  }[];
}

export interface ProcessedImage {
  buffer: Buffer;
  path: string;
  metadata: {
    originalSize: number;
    processedSize: number;
    dimensions: { width: number; height: number };
    processingTime: number;
    compressionRatio: number;
    qualityEnhancement: string;
  };
}

export interface ResponsePayloadSuccess {
  status: "success";
  data: OCRResult[];
  paragraphs: Paragraph[];
  stats: {
    total_lines: number;
    total_paragraphs: number;
    processing_time: string;
    image_size: number;
    average_confidence: string;
    high_confidence_ratio: string;
  };
  memory_usage: {
    before: number;
    beforeOCR: number;
    afterOCR: number;
  };
  metadata: {
    processingTime: number;
    ocrTime: number;
    imageProcessing: ProcessedImage["metadata"];
    requestId: string;
    textCount: number;
    language: string;
  };
}

export interface ResponsePayloadError {
  status: "error";
  error: string;
  code?: string;
  requestId?: string;
}

// Performance settings (no memory limits)
const PERFORMANCE_SETTINGS = {
  maxProcessedWidth: 1600, // Higher for better OCR accuracy
  maxProcessedHeight: 1600,
  jpegQuality: 85, // Higher quality for better text recognition
  ocrTimeout: 60000, // Increased timeout for better accuracy
  targetDPI: 300 // Target DPI for optimal OCR
} as const;

// Global OCR instance
let globalOCR: OcrWrapper | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    external: Math.round(usage.external / 1024 / 1024),
    rss: Math.round(usage.rss / 1024 / 1024)
  };
}

function forceMemoryCleanup() {
  if (global.gc) {
    global.gc();
  }
}

async function initializeOCR(language: string | undefined): Promise<void> {
  if (globalOCR) return;

  console.log("🚀 Initializing OCR with multi-language support...");
  const memBefore = getMemoryUsage();

  globalOCR = new OcrWrapper();
  await globalOCR.init(language || "en");

  const memAfter = getMemoryUsage();
  console.log(`✅ OCR initialized: ${memBefore.rss}MB -> ${memAfter.rss}MB`);
}

async function getOCRInstance(language: string): Promise<OcrWrapper> {
  if (!globalOCR) {
    if (!isInitializing) {
      isInitializing = true;
      initPromise = initializeOCR(language);
      await initPromise;
      isInitializing = false;
    } else if (initPromise) {
      await initPromise;
    }
  }

  if (!globalOCR) {
    throw new Error("OCR initialization failed");
  }

  return globalOCR;
}

async function enhanceImageForOCR(inputBuffer: Buffer): Promise<ProcessedImage> {
  const start = Date.now();

  const meta = await sharp(inputBuffer, {
    limitInputPixels: 16777216, // Very high limit for quality
    sequentialRead: true,
  }).metadata();

  if (!meta.width || !meta.height) throw new Error("Invalid image metadata");

  let width = Math.floor(meta.width);
  let height = Math.floor(meta.height);

  console.log(`📐 Original image: ${width}x${height}, Size: ${(inputBuffer.length / 1024 / 1024).toFixed(2)}MB`);

  // Calculate optimal size for OCR - prioritize quality
  const maxDim = Math.min(PERFORMANCE_SETTINGS.maxProcessedWidth, PERFORMANCE_SETTINGS.maxProcessedHeight);
  const scaleFactor = Math.min(maxDim / width, maxDim / height, 1.0); // No downscaling if already small

  width = Math.floor(width * scaleFactor);
  height = Math.floor(height * scaleFactor);

  console.log(`🎯 Target size for OCR: ${width}x${height}`);

  // Advanced image processing pipeline for optimal OCR
  const processedBuffer = await sharp(inputBuffer, {
    limitInputPixels: 16777216,
    sequentialRead: true
  })
    .resize(width, height, {
      kernel: sharp.kernel.lanczos3, // Highest quality resampling
      withoutEnlargement: true,
      fastShrinkOnLoad: false // Better quality
    })
    .normalize({
      lower: 10,
      upper: 90 // Better contrast range
    })
    .sharpen({
      sigma: 0.5,
      m1: 1,
      m2: 0.3,
      x1: 1,
      y2: 5,
      y3: 10
    })
    .jpeg({
      quality: PERFORMANCE_SETTINGS.jpegQuality,
      progressive: false,
      mozjpeg: true,
      chromaSubsampling: '4:4:4'
    })
    .toBuffer();

  const uploadDir = "/tmp";
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const imagePath = path.join(uploadDir, `ocr_enhanced_${Date.now()}.jpg`);
  fs.writeFileSync(imagePath, processedBuffer);

  const processingTime = Date.now() - start;
  const compressionRatio = Math.round((1 - processedBuffer.length / inputBuffer.length) * 100);

  console.log(`✨ Image enhanced: ${(processedBuffer.length / 1024 / 1024).toFixed(2)}MB, Processing: ${processingTime}ms`);

  return {
    buffer: processedBuffer,
    path: imagePath,
    metadata: {
      originalSize: inputBuffer.length,
      processedSize: processedBuffer.length,
      dimensions: { width, height },
      processingTime,
      compressionRatio,
      qualityEnhancement: "High-quality sharpening and contrast enhancement"
    }
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  let imagePath: string | null = null;

  console.log(`🔍 OCR Request started: ${requestId}`);

  try {
    // Log memory usage for monitoring (no limits)
    const memoryBefore = getMemoryUsage();
    console.log(`💾 Memory before processing: ${memoryBefore.rss}MB RSS, ${memoryBefore.heapUsed}MB Heap`);

    // Determine how the image was sent (JSON/base64/url vs formData file upload)
    let buffer: Buffer;
    let language = "en";
    let cropRegion = null;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json();
      language = body.language || "en";
      cropRegion = body.cropRegion;

      if (body.imageBase64) {
        const base64Data = body.imageBase64.split(",")[1];
        buffer = Buffer.from(base64Data, "base64");
      } else if (body.imageUrl) {
        const response = await fetch(body.imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else {
        return NextResponse.json({ error: "No image provided" }, { status: 400 });
      }
    } else {
      const formData = await req.formData();
      const fileField = formData.get("file");

      if (!fileField || !(fileField instanceof Blob)) {
        console.log(`❌ No valid file provided for request: ${requestId}`);
        return NextResponse.json<ResponsePayloadError>({
          status: "error",
          error: "No valid file provided"
        }, { status: 400 });
      }

      const uploadedFile = fileField as File;
      if (!uploadedFile.type?.startsWith?.("image/")) {
        console.log(`❌ Invalid file type for request: ${requestId}`);
        return NextResponse.json<ResponsePayloadError>({
          status: "error",
          error: "Please upload an image file"
        }, { status: 400 });
      }

      console.log(`📁 Processing file: ${uploadedFile.name}, Type: ${uploadedFile.type}, Size: ${(uploadedFile.size / 1024 / 1024).toFixed(2)}MB`);

      buffer = Buffer.from(await uploadedFile.arrayBuffer());
      language = (formData.get("language") as string) || "en";
    }

    let processedImage: ProcessedImage;
    try {
      console.log(`🖼️ Starting image enhancement...`);
      processedImage = await enhanceImageForOCR(buffer);
      imagePath = processedImage.path;
      console.log(`✅ Image enhancement completed in ${processedImage.metadata.processingTime}ms`);

      // Handle crop region if provided
      if (cropRegion && cropRegion.x !== undefined && cropRegion.y !== undefined && cropRegion.width && cropRegion.height) {
        console.log(`✂️ Cropping image to region: ${JSON.stringify(cropRegion)}`);
        const croppedBuffer = await sharp(processedImage.path)
          .extract({
            left: Math.max(0, Math.round(cropRegion.x)),
            top: Math.max(0, Math.round(cropRegion.y)),
            width: Math.round(cropRegion.width),
            height: Math.round(cropRegion.height)
          })
          .jpeg({ quality: PERFORMANCE_SETTINGS.jpegQuality })
          .toBuffer();

        // Save cropped image
        const croppedPath = path.join("/tmp", `ocr_cropped_${Date.now()}.jpg`);
        fs.writeFileSync(croppedPath, croppedBuffer);
        imagePath = croppedPath; // Use cropped image for OCR
        console.log(`✅ Image cropped successfully`);
      }
    } catch (e) {
      console.error(`❌ Image processing failed:`, e);
      return NextResponse.json<ResponsePayloadError>({
        status: "error",
        error: "Failed to process image. The image might be corrupted or in an unsupported format."
      }, { status: 500 });
    }

    // Optional memory cleanup
    forceMemoryCleanup();
    const memoryBeforeOCR = getMemoryUsage();
    console.log(`💾 Memory before OCR: ${memoryBeforeOCR.rss}MB RSS`);

    try {
      // language variable was already determined earlier from JSON or formData
      const ocrInstance = await getOCRInstance(language);
      const ocrStart = Date.now();

      console.log(`🔤 Starting OCR processing with language: ${language}...`);

      // Pass language to OCR
      const ocrResult = await ocrInstance.readText(imagePath, language);
      const ocrDuration = Date.now() - ocrStart;

      console.log(`✅ OCR completed in ${ocrDuration}ms`);
      console.log(`📊 OCR Results: ${ocrResult.data?.length || 0} text lines, ${ocrResult.paragraphs?.length || 0} paragraphs`);

      forceMemoryCleanup();
      const memoryAfterOCR = getMemoryUsage();

      const totalDuration = Date.now() - startTime;

      const successPayload: ResponsePayloadSuccess = {
        status: "success",
        data: ocrResult.data || [],
        paragraphs: ocrResult.paragraphs || [],
        stats: {
          total_lines: ocrResult.data?.length || 0,
          total_paragraphs: ocrResult.paragraphs?.length || 0,
          processing_time: `${(totalDuration / 1000).toFixed(3)}s`,
          image_size: processedImage.metadata.originalSize,
          average_confidence: ocrResult.stats?.average_confidence || "0.000",
          high_confidence_ratio: ocrResult.stats?.high_confidence_ratio || "0/0"
        },
        memory_usage: {
          before: memoryBefore.rss,
          beforeOCR: memoryBeforeOCR.rss,
          afterOCR: memoryAfterOCR.rss
        },
        metadata: {
          processingTime: totalDuration,
          ocrTime: ocrDuration,
          imageProcessing: processedImage.metadata,
          requestId,
          textCount: ocrResult.data?.length || 0,
          language
        }
      };

      console.log(`🎉 Request ${requestId} completed successfully in ${totalDuration}ms`);
      return NextResponse.json(successPayload);
    } catch (ocrError) {
      const msg = (ocrError as Error).message ?? "OCR processing failed";
      console.error(`❌ OCR processing error:`, ocrError);

      if (msg.includes("timeout")) {
        return NextResponse.json<ResponsePayloadError>({
          status: "error",
          error: "OCR processing took too long. Try a smaller image or check server resources.",
          requestId
        }, { status: 500 });
      }
      return NextResponse.json<ResponsePayloadError>({
        status: "error",
        error: "OCR processing failed. The image might not contain readable text or the OCR service is unavailable.",
        requestId
      }, { status: 500 });
    }
  } catch (err) {
    const message = (err as Error).message ?? "Server error occurred";
    console.error(`💥 Server error for request ${requestId}:`, err);
    return NextResponse.json<ResponsePayloadError>({
      status: "error",
      error: message,
      requestId
    }, { status: 500 });
  } finally {
    // Cleanup temporary file
    if (imagePath && fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
        console.log(`🧹 Cleaned up temporary file: ${imagePath}`);
      } catch (_) {
        console.log(`⚠️ Could not clean up temporary file: ${imagePath}`);
      }
    }

    // Final memory cleanup
    forceMemoryCleanup();
    const finalMemory = getMemoryUsage();
    console.log(`💾 Final memory usage: ${finalMemory.rss}MB RSS`);
    console.log(`🔚 Request ${requestId} finished`);
  }
}

// Optional: Add health check endpoint
export async function GET(req: NextRequest): Promise<NextResponse> {
  const memoryUsage = getMemoryUsage();

  return NextResponse.json({
    status: "healthy",
    memory_usage: memoryUsage,
    ocr_initialized: globalOCR !== null,
    timestamp: new Date().toISOString()
  });
}