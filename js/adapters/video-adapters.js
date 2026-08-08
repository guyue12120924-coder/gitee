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
    jsonVariants: genericVideoVariants
  });

  hub.register("wan-i2v", {
    task: "i2v",
    defaultEndpoint: "async/videos/image-to-video",
    uiProfile: "wan",
    i2vFormMode: "wan",
    segmentSeconds: 5,
    jsonVariants: genericVideoVariants
  });

  hub.register("hunyuan-t2v", {
    task: "t2v",
    defaultEndpoint: "async/videos/generations",
    uiProfile: "hunyuan",
    t2vPreferLegacy: true,
    jsonVariants(body) { return [{ ...body }]; }
  });
})();
