(() => {
  "use strict";

  const hub = window.GiteeModelAdapters;
  if (!hub) throw new Error("GiteeModelAdapters is not initialized");

  function unique(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = JSON.stringify(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function genericVideoVariants(body) {
    const variants = [{ ...body }];
    const compact = {
      model: body.model,
      prompt: body.prompt,
      ...(body.resolution ? { resolution: body.resolution } : {}),
      ...(body.duration !== undefined ? { duration: body.duration } : {}),
      ...(body.ratio ? { ratio: body.ratio } : {}),
      ...(body.seed !== undefined ? { seed: body.seed } : {}),
      ...(body.negative_prompt ? { negative_prompt: body.negative_prompt } : {}),
      ...(body.image ? { image: body.image } : {}),
      ...(body.first_frame ? { first_frame: body.first_frame } : {}),
      ...(body.image_url ? { image_url: body.image_url } : {})
    };
    variants.push(compact);
    if (body.ratio) {
      const aspect = { ...compact, aspect_ratio: body.ratio };
      delete aspect.ratio;
      variants.push(aspect);
    }
    if (body.image && typeof body.image === "string") {
      const firstFrame = { ...compact, first_frame: body.image };
      delete firstFrame.image;
      const imageUrl = { ...compact, image_url: body.image };
      delete imageUrl.image;
      variants.push(firstFrame, imageUrl);
    }
    if (body.first_frame && typeof body.first_frame === "string") {
      const imageUrl = { ...compact, image_url: body.first_frame };
      delete imageUrl.first_frame;
      variants.push(imageUrl);
    }
    const minimal = { ...compact };
    delete minimal.seed;
    delete minimal.negative_prompt;
    variants.push(minimal);
    return unique(variants);
  }

  hub.register("generic-video", {
    task: "video",
    defaultEndpoint: "async/videos/generations",
    uiProfile: "generic",
    i2vFormMode: "generic",
    t2vPreferLegacy: false,
    parameters: {
      i2v: [
        { key: "resolution", label: "清晰度", type: "select", sourceId: "mmI2VResolution", options: ["720P", "480P"], default: "720P" },
        { key: "ratio", label: "画面比例", type: "select", sourceId: "mmI2VRatio", options: ["16:9", "9:16", "1:1"], default: "16:9" },
        { key: "duration", label: "视频时长", type: "number", sourceId: "mmI2VDuration", min: 1, max: 30, step: 1, default: 5 },
        { key: "seed", label: "Seed（-1=随机）", type: "number", sourceId: "wanSeed", min: -1, max: 2147483647, step: 1, default: -1, advanced: true },
        { key: "openUrl", label: "完成后打开 file_url", type: "checkbox", sourceId: "wanOpenUrl", advanced: true }
      ],
      t2v: [
        { key: "ratio", label: "画面比例", type: "select", sourceId: "hyAspect", options: ["16:9", "9:16", "1:1"], default: "16:9" },
        { key: "resolution", label: "清晰度", type: "select", sourceId: "mmT2VResolution", options: ["720P", "480P", "1080P"], default: "720P" },
        { key: "duration", label: "视频时长", type: "number", sourceId: "mmT2VDuration", min: 1, max: 30, step: 1, default: 5 },
        { key: "seed", label: "Seed", type: "number", sourceId: "hySeed", min: 1, max: 2147483647, step: 1, default: 1, advanced: true },
        { key: "openUrl", label: "完成后打开 file_url", type: "checkbox", sourceId: "hyOpenUrl", advanced: true }
      ]
    },
    jsonVariants: genericVideoVariants
  });

  hub.register("wan-i2v", {
    task: "i2v",
    defaultEndpoint: "async/videos/image-to-video",
    uiProfile: "wan",
    i2vFormMode: "wan",
    segmentSeconds: 5,
    parameters: [
      { key: "preset", label: "生成预设", type: "select", sourceId: "wanPreset", options: "source", triggerClickId: "btnWanApplyPreset", help: "切换后自动应用预设参数。" },
      { key: "resolutionPreset", label: "清晰度与画幅", type: "select", sourceId: "wanResPreset", options: "source" },
      { key: "duration", label: "视频时长", type: "number", sourceId: "wanDuration", min: 0.5, max: 60, step: 0.5, default: 5, help: "超过 5 秒时继续使用原有分段生成逻辑。" },
      { key: "width", label: "宽度", type: "number", sourceId: "wanW", min: 64, max: 2048, step: 8, default: 832, advanced: true },
      { key: "height", label: "高度", type: "number", sourceId: "wanH", min: 64, max: 2048, step: 8, default: 480, advanced: true },
      { key: "seed", label: "Seed（-1=随机）", type: "number", sourceId: "wanSeed", min: -1, max: 2147483647, step: 1, default: -1, advanced: true },
      { key: "steps", label: "推理步数", type: "number", sourceId: "wanSteps", min: 1, max: 100, step: 1, default: 30, advanced: true },
      { key: "guidance", label: "Guidance Scale", type: "number", sourceId: "wanGuidance", min: 0, max: 20, step: 0.5, default: 5, advanced: true },
      { key: "fps", label: "FPS", type: "number", sourceId: "wanFps", min: 1, max: 60, step: 1, default: 24, advanced: true },
      { key: "frames", label: "num_frames", type: "number", sourceId: "wanFrames", min: 1, max: 300, step: 1, default: 120, advanced: true },
      { key: "autoFrames", label: "num_frames 自动 = FPS×5s", type: "checkbox", sourceId: "wanAutoFrames", advanced: true },
      { key: "watermark", label: "watermark 水印", type: "checkbox", sourceId: "wanWatermark", advanced: true },
      { key: "promptExtend", label: "prompt_extend 自动扩写", type: "checkbox", sourceId: "wanPromptExtend", advanced: true },
      { key: "zip", label: "多段时自动打包 ZIP", type: "checkbox", sourceId: "wanZipSegments", advanced: true },
      { key: "openUrl", label: "完成后打开 file_url", type: "checkbox", sourceId: "wanOpenUrl", advanced: true }
    ],
    jsonVariants: genericVideoVariants
  });

  hub.register("hunyuan-t2v", {
    task: "t2v",
    defaultEndpoint: "async/videos/generations",
    uiProfile: "hunyuan",
    t2vPreferLegacy: true,
    parameters: [
      { key: "ratio", label: "画面比例", type: "select", sourceId: "hyAspect", options: "source" },
      { key: "frames", label: "视频帧数", type: "number", sourceId: "hyFrames", min: 81, max: 241, step: 1, default: 241 },
      { key: "seed", label: "Seed", type: "number", sourceId: "hySeed", min: 1, max: 2147483647, step: 1, default: 1, advanced: true },
      { key: "steps", label: "推理步数", type: "number", sourceId: "hySteps", min: 1, max: 10, step: 1, default: 10, advanced: true },
      { key: "fps", label: "FPS", type: "number", sourceId: "hyFps", min: 1, max: 24, step: 1, default: 24, advanced: true },
      { key: "openUrl", label: "完成后打开 file_url", type: "checkbox", sourceId: "hyOpenUrl", advanced: true }
    ],
    jsonVariants(body) { return [{ ...body }]; }
  });
})();
