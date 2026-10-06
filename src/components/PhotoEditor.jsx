import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import Cropper from "react-easy-crop";
import { removeBackground } from "@imgly/background-removal";

/* =========================================================
   PHOTO PRESETS
========================================================= */

const PRESETS = {
  passport: {
    label: "Passport",
    width: 35,
    height: 45,
    ratio: 35 / 45,
  },

  visa: {
    label: "Visa",
    width: 50,
    height: 50,
    ratio: 1,
  },

  id: {
    label: "ID Photo",
    width: 25,
    height: 35,
    ratio: 25 / 35,
  },

  custom: {
    label: "Custom",
    width: 35,
    height: 45,
    ratio: 35 / 45,
  },
};

/* =========================================================
   IMAGE HELPERS
========================================================= */

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;

    image.src = url;
  });

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(blob);
  });

const dataUrlToImage = async (dataUrl) => {
  return await createImage(dataUrl);
};

/* =========================================================
   CROP IMAGE
========================================================= */

const getCroppedImage = async (
  imageSrc,
  pixelCrop,
  rotation = 0
) => {
  const image = await createImage(imageSrc);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas is not supported.");
  }

  const radians = (rotation * Math.PI) / 180;

  const rotatedWidth =
    Math.abs(
      Math.cos(radians) * image.width
    ) +
    Math.abs(
      Math.sin(radians) * image.height
    );

  const rotatedHeight =
    Math.abs(
      Math.sin(radians) * image.width
    ) +
    Math.abs(
      Math.cos(radians) * image.height
    );

  canvas.width = Math.round(rotatedWidth);
  canvas.height = Math.round(rotatedHeight);

  ctx.translate(
    canvas.width / 2,
    canvas.height / 2
  );

  ctx.rotate(radians);

  ctx.drawImage(
    image,
    -image.width / 2,
    -image.height / 2
  );

  const croppedCanvas =
    document.createElement("canvas");

  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  const croppedCtx =
    croppedCanvas.getContext("2d");

  if (!croppedCtx) {
    throw new Error("Canvas is not supported.");
  }

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return croppedCanvas.toDataURL("image/png");
};

/* =========================================================
   CLAMP
========================================================= */

const clamp = (value, min = 0, max = 255) => {
  return Math.min(
    max,
    Math.max(min, value)
  );
};

/* =========================================================
   IMAGE ADJUSTMENT PROCESSOR

   Brightness
   Contrast
   Saturation
   Warmth
   Highlights
   Shadows
   Sharpness
========================================================= */

const processImageAdjustments = async (
  imageUrl,
  adjustments
) => {
  const image = await dataUrlToImage(
    imageUrl
  );

  const canvas = document.createElement(
    "canvas"
  );

  canvas.width = image.width;
  canvas.height = image.height;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!ctx) {
    throw new Error("Canvas is not supported.");
  }

  ctx.drawImage(
    image,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const imageData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const data = imageData.data;

  const {
    brightness,
    contrast,
    saturation,
    warmth,
    highlights,
    shadows,
    sharpness,
  } = adjustments;

  /* -----------------------------------------
     BASIC VALUES
  ----------------------------------------- */

  const brightnessAmount =
    brightness * 2.55;

  const contrastFactor =
    (259 * (contrast + 255)) /
    (255 * (259 - contrast));

  const saturationFactor =
    1 + saturation / 100;

  const warmthAmount =
    warmth * 1.35;

  const highlightAmount =
    highlights / 100;

  const shadowAmount =
    shadows / 100;

  /* -----------------------------------------
     FIRST PASS
  ----------------------------------------- */

  for (
    let i = 0;
    i < data.length;
    i += 4
  ) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    const alpha = data[i + 3];

    /* Keep transparent pixels transparent */
    if (alpha === 0) {
      continue;
    }

    /* Brightness */
    r += brightnessAmount;
    g += brightnessAmount;
    b += brightnessAmount;

    /* Contrast */
    r =
      contrastFactor *
        (r - 128) +
      128;

    g =
      contrastFactor *
        (g - 128) +
      128;

    b =
      contrastFactor *
        (b - 128) +
      128;

    /* Saturation */
    const gray =
      0.299 * r +
      0.587 * g +
      0.114 * b;

    r =
      gray +
      (r - gray) *
        saturationFactor;

    g =
      gray +
      (g - gray) *
        saturationFactor;

    b =
      gray +
      (b - gray) *
        saturationFactor;

    /* Warmth */
    r += warmthAmount;
    b -= warmthAmount;

    /* Highlights / Shadows */
    const luminance =
      0.299 * r +
      0.587 * g +
      0.114 * b;

    if (
      luminance > 128 &&
      highlightAmount !== 0
    ) {
      const strength =
        ((luminance - 128) / 127) *
        highlightAmount *
        55;

      r += strength;
      g += strength;
      b += strength;
    }

    if (
      luminance < 128 &&
      shadowAmount !== 0
    ) {
      const strength =
        ((128 - luminance) / 128) *
        shadowAmount *
        55;

      r += strength;
      g += strength;
      b += strength;
    }

    data[i] = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }

  /* -----------------------------------------
     SHARPNESS
  ----------------------------------------- */

  if (sharpness !== 0) {
    const original = new Uint8ClampedArray(
      data
    );

    const width = canvas.width;
    const height = canvas.height;

    const strength =
      sharpness / 100;

    for (
      let y = 1;
      y < height - 1;
      y++
    ) {
      for (
        let x = 1;
        x < width - 1;
        x++
      ) {
        const index =
          (y * width + x) * 4;

        const top =
          ((y - 1) * width + x) * 4;

        const bottom =
          ((y + 1) * width + x) * 4;

        const left =
          (y * width + x - 1) * 4;

        const right =
          (y * width + x + 1) * 4;

        for (let channel = 0; channel < 3; channel++) {
          const center =
            original[
              index + channel
            ];

          const neighbour =
            (
              original[
                top + channel
              ] +
              original[
                bottom + channel
              ] +
              original[
                left + channel
              ] +
              original[
                right + channel
              ]
            ) / 4;

          const sharpened =
            center +
            (center - neighbour) *
              strength;

          data[
            index + channel
          ] = clamp(
            sharpened
          );
        }
      }
    }
  }

  ctx.putImageData(
    imageData,
    0,
    0
  );

  return canvas.toDataURL(
    "image/png"
  );
};

/* =========================================================
   COMPONENT
========================================================= */

export default function PhotoEditor({
  photo,
  onSave,
  onBack,
}) {
  /* =======================================================
     BASIC EDITOR STATE
  ======================================================= */

  const [
    selectedPreset,
    setSelectedPreset,
  ] = useState("passport");

  const [crop, setCrop] = useState({
    x: 0,
    y: 0,
  });

  const [zoom, setZoom] = useState(1);

  const [
    rotation,
    setRotation,
  ] = useState(0);

  const [
    croppedAreaPixels,
    setCroppedAreaPixels,
  ] = useState(null);

  const [
    saving,
    setSaving,
  ] = useState(false);

  /* =======================================================
     BACKGROUND STATE
  ======================================================= */

  const [
    removingBackground,
    setRemovingBackground,
  ] = useState(false);

  const [
    backgroundRemoved,
    setBackgroundRemoved,
  ] = useState(false);

  const [
    backgroundColor,
    setBackgroundColor,
  ] = useState("#ffffff");

  const [
    showColorPicker,
    setShowColorPicker,
  ] = useState(false);

  const [
    backgroundColorApplied,
    setBackgroundColorApplied,
  ] = useState(false);

  /*
    transparentImage:
    Current transparent/cutout version.

    processedImage:
    Current visible image.
  */

  const [
    transparentImage,
    setTransparentImage,
  ] = useState(null);

  const [
    processedImage,
    setProcessedImage,
  ] = useState(null);

  /* =======================================================
     EDIT / ADJUSTMENT STATE
  ======================================================= */

  const [
    adjustments,
    setAdjustments,
  ] = useState({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    warmth: 0,
    highlights: 0,
    shadows: 0,
    sharpness: 0,
  });

  const [
    applyingAdjustment,
    setApplyingAdjustment,
  ] = useState(false);

  /*
    This stores the image BEFORE the current
    adjustments are baked.

    This prevents brightness changes from
    repeatedly stacking on top of themselves.
  */

  const adjustmentBaseRef =
    useRef(null);

  const adjustmentJobRef =
    useRef(0);

  /* =======================================================
     EDITOR MODE
  ======================================================= */

  const [
    editorMode,
    setEditorMode,
  ] = useState("crop");

  const [
    brushMode,
    setBrushMode,
  ] = useState("erase");

  const [
    brushSize,
    setBrushSize,
  ] = useState(40);

  /* =======================================================
     HISTORY
  ======================================================= */

  const [
    history,
    setHistory,
  ] = useState([]);

  /* =======================================================
     REFS
  ======================================================= */

  const canvasRef =
    useRef(null);

  const drawingRef =
    useRef(false);

  const restoreImageRef =
    useRef(null);

  /* =======================================================
     PRESET
  ======================================================= */

  const preset =
    PRESETS[selectedPreset];

  const changePreset = (value) => {
    setSelectedPreset(value);

    setCrop({
      x: 0,
      y: 0,
    });

    setZoom(1);
    setRotation(0);

    setCroppedAreaPixels(null);
  };

  /* =======================================================
     CROP COMPLETE
  ======================================================= */

  const onCropComplete =
    useCallback(
      (_, croppedPixels) => {
        setCroppedAreaPixels(
          croppedPixels
        );
      },
      []
    );

  /* =======================================================
     LOAD RESTORE IMAGE
  ======================================================= */

  useEffect(() => {
    const source =
      transparentImage ||
      photo?.url;

    if (!source) {
      return;
    }

    const image =
      new Image();

    image.onload = () => {
      restoreImageRef.current =
        image;
    };

    image.src = source;
  }, [
    transparentImage,
    photo,
  ]);

  /* =======================================================
     INITIALIZE MANUAL CANVAS
  ======================================================= */

  const initializeCanvas =
    useCallback(
      async (imageUrl) => {
        const canvas =
          canvasRef.current;

        if (!canvas || !imageUrl) {
          return;
        }

        try {
          const image =
            await dataUrlToImage(
              imageUrl
            );

          canvas.width =
            image.width;

          canvas.height =
            image.height;

          const ctx =
            canvas.getContext(
              "2d"
            );

          if (!ctx) {
            return;
          }

          ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
          );

          ctx.globalCompositeOperation =
            "source-over";

          ctx.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
          );

          const snapshot =
            canvas.toDataURL(
              "image/png"
            );

          setProcessedImage(
            snapshot
          );

          if (
            backgroundRemoved
          ) {
            setTransparentImage(
              snapshot
            );
          }

          setHistory([
            snapshot,
          ]);
        } catch (error) {
          console.error(
            "Canvas initialization failed:",
            error
          );
        }
      },
      [backgroundRemoved]
    );

  /* =======================================================
     GET CANVAS POINT
  ======================================================= */

  const getCanvasPoint = (
    event
  ) => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return {
        x: 0,
        y: 0,
      };
    }

    const rect =
      canvas.getBoundingClientRect();

    const scaleX =
      canvas.width /
      rect.width;

    const scaleY =
      canvas.height /
      rect.height;

    return {
      x:
        (event.clientX -
          rect.left) *
        scaleX,

      y:
        (event.clientY -
          rect.top) *
        scaleY,
    };
  };

  /* =======================================================
     DRAW / ERASE / RESTORE
  ======================================================= */

  const drawAtPoint =
    useCallback(
      (point) => {
        const canvas =
          canvasRef.current;

        if (!canvas) {
          return;
        }

        const ctx =
          canvas.getContext(
            "2d"
          );

        if (!ctx) {
          return;
        }

        const radius =
          brushSize / 2;

        /* ERASE */

        if (
          brushMode === "erase"
        ) {
          ctx.save();

          ctx.globalCompositeOperation =
            "destination-out";

          ctx.beginPath();

          ctx.arc(
            point.x,
            point.y,
            radius,
            0,
            Math.PI * 2
          );

          ctx.fill();

          ctx.restore();
        }

        /* RESTORE */

        if (
          brushMode === "restore"
        ) {
          const source =
            restoreImageRef.current;

          if (!source) {
            return;
          }

          ctx.save();

          ctx.globalCompositeOperation =
            "source-over";

          ctx.beginPath();

          ctx.arc(
            point.x,
            point.y,
            radius,
            0,
            Math.PI * 2
          );

          ctx.clip();

          ctx.drawImage(
            source,
            0,
            0,
            canvas.width,
            canvas.height
          );

          ctx.restore();
        }

        const currentImage =
          canvas.toDataURL(
            "image/png"
          );

        setProcessedImage(
          currentImage
        );

        if (
          backgroundRemoved
        ) {
          setTransparentImage(
            currentImage
          );
        }
      },
      [
        brushMode,
        brushSize,
        backgroundRemoved,
      ]
    );

  /* =======================================================
     START DRAWING
  ======================================================= */

  const startDrawing = (
    event
  ) => {
    event.preventDefault();

    drawingRef.current =
      true;

    const point =
      getCanvasPoint(event);

    drawAtPoint(point);
  };

  /* =======================================================
     DRAW
  ======================================================= */

  const draw = (event) => {
    if (
      !drawingRef.current
    ) {
      return;
    }

    event.preventDefault();

    const point =
      getCanvasPoint(event);

    drawAtPoint(point);
  };

  /* =======================================================
     STOP DRAWING
  ======================================================= */

  const stopDrawing = () => {
    if (
      !drawingRef.current
    ) {
      return;
    }

    drawingRef.current =
      false;

    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const snapshot =
      canvas.toDataURL(
        "image/png"
      );

    setProcessedImage(
      snapshot
    );

    if (
      backgroundRemoved
    ) {
      setTransparentImage(
        snapshot
      );
    }

    /*
      Manual editing becomes the
      new adjustment base.

      Existing adjustment values are
      reset because the current image
      already contains the visual result.
    */

    adjustmentBaseRef.current =
      snapshot;

    setAdjustments({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      warmth: 0,
      highlights: 0,
      shadows: 0,
      sharpness: 0,
    });

    setHistory(
      (previous) => {
        const last =
          previous[
            previous.length - 1
          ];

        if (
          last === snapshot
        ) {
          return previous;
        }

        return [
          ...previous,
          snapshot,
        ];
      }
    );
  };

  /* =======================================================
     UNDO
  ======================================================= */

  const undo = async () => {
    if (
      history.length <= 1
    ) {
      return;
    }

    const newHistory =
      history.slice(0, -1);

    const restoredUrl =
      newHistory[
        newHistory.length - 1
      ];

    setHistory(
      newHistory
    );

    setProcessedImage(
      restoredUrl
    );

    if (
      backgroundRemoved
    ) {
      setTransparentImage(
        restoredUrl
      );
    }

    adjustmentBaseRef.current =
      restoredUrl;

    setAdjustments({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      warmth: 0,
      highlights: 0,
      shadows: 0,
      sharpness: 0,
    });

    await initializeCanvas(
      restoredUrl
    );
  };

  /* =======================================================
     AUTO REMOVE BACKGROUND
  ======================================================= */

  const handleAutoRemove =
    async () => {
      if (!photo?.url) {
        return;
      }

      try {
        setRemovingBackground(
          true
        );

        const result =
          await removeBackground(
            photo.url
          );

        const transparentUrl =
          await blobToDataUrl(
            result
          );

        setTransparentImage(
          transparentUrl
        );

        setProcessedImage(
          transparentUrl
        );

        setBackgroundRemoved(
          true
        );

        setBackgroundColorApplied(
          false
        );

        /*
          New adjustment base
        */

        adjustmentBaseRef.current =
          transparentUrl;

        setAdjustments({
          brightness: 0,
          contrast: 0,
          saturation: 0,
          warmth: 0,
          highlights: 0,
          shadows: 0,
          sharpness: 0,
        });

        setEditorMode(
          "background"
        );

        setTimeout(() => {
          initializeCanvas(
            transparentUrl
          );
        }, 100);
      } catch (error) {
        console.error(
          "Background removal failed:",
          error
        );

        alert(
          "Background remove nahi ho paya. Please try again."
        );
      } finally {
        setRemovingBackground(
          false
        );
      }
    };

  /* =======================================================
     MANUAL ERASER
  ======================================================= */

  const handleManualEraser =
    () => {
      setEditorMode(
        "background"
      );

      const source =
        transparentImage ||
        processedImage ||
        photo?.url;

      if (
        backgroundRemoved
      ) {
        adjustmentBaseRef.current =
          transparentImage ||
          source;
      }

      setTimeout(() => {
        initializeCanvas(
          source
        );
      }, 100);
    };

  /* =======================================================
     COMPOSITE TRANSPARENT IMAGE
     WITH BACKGROUND COLOR
  ======================================================= */

  const applyColorToImage =
    async (
      transparentUrl,
      color
    ) => {
      const image =
        await dataUrlToImage(
          transparentUrl
        );

      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width =
        image.width;

      canvas.height =
        image.height;

      const ctx =
        canvas.getContext(
          "2d"
        );

      if (!ctx) {
        return transparentUrl;
      }

      ctx.fillStyle =
        color;

      ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      ctx.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
      );

      return canvas.toDataURL(
        "image/png"
      );
    };

  /* =======================================================
     APPLY BACKGROUND COLOR
  ======================================================= */

  const applyBackgroundColor =
    async (color) => {
      const source =
        transparentImage ||
        processedImage ||
        photo?.url;

      if (!source) {
        return;
      }

      try {
        /*
          Keep transparent source untouched.
        */

        const result =
          await applyColorToImage(
            source,
            color
          );

        setProcessedImage(
          result
        );

        setBackgroundColor(
          color
        );

        setBackgroundColorApplied(
          true
        );

        setShowColorPicker(
          false
        );
      } catch (error) {
        console.error(
          "Background color failed:",
          error
        );
      }
    };

  /* =======================================================
     APPLY MANUAL BACKGROUND EDITING
  ======================================================= */

  const applyBackgroundEditing =
    () => {
      const canvas =
        canvasRef.current;

      if (!canvas) {
        return;
      }

      const url =
        canvas.toDataURL(
          "image/png"
        );

      setTransparentImage(
        url
      );

      /*
        If a background color was already
        selected, recreate the visible
        preview with that color.
      */

      if (
        backgroundColorApplied
      ) {
        applyColorToImage(
          url,
          backgroundColor
        ).then((result) => {
          setProcessedImage(
            result
          );
        });
      } else {
        setProcessedImage(
          url
        );
      }

      setBackgroundRemoved(
        true
      );

      /*
        New image becomes the base
        for future adjustments.
      */

      adjustmentBaseRef.current =
        url;

      setAdjustments({
        brightness: 0,
        contrast: 0,
        saturation: 0,
        warmth: 0,
        highlights: 0,
        shadows: 0,
        sharpness: 0,
      });

      setEditorMode(
        "crop"
      );

      setCrop({
        x: 0,
        y: 0,
      });

      setZoom(1);
    };

  /* =======================================================
     LIVE ADJUSTMENT
  ======================================================= */

  const handleAdjustmentChange =
    async (
      key,
      value
    ) => {
      const numericValue =
        Number(value);

      const nextAdjustments = {
        ...adjustments,
        [key]: numericValue,
      };

      setAdjustments(
        nextAdjustments
      );

      /*
        Select the correct base image.

        Important:
        We do NOT use processedImage here
        because it may already contain a
        background color.
      */

      if (
        !adjustmentBaseRef.current
      ) {
        adjustmentBaseRef.current =
          backgroundRemoved
            ? transparentImage ||
              processedImage ||
              photo?.url
            : photo?.url;
      }

      const baseImage =
        adjustmentBaseRef.current;

      if (!baseImage) {
        return;
      }

      const currentJob =
        ++adjustmentJobRef.current;

      try {
        setApplyingAdjustment(
          true
        );

        const adjustedTransparent =
          await processImageAdjustments(
            baseImage,
            nextAdjustments
          );

        /*
          Ignore old async results.

          This prevents slider dragging
          from showing an older frame.
        */

        if (
          currentJob !==
          adjustmentJobRef.current
        ) {
          return;
        }

        /*
          Store adjusted transparent
          version.
        */

        if (
          backgroundRemoved
        ) {
          setTransparentImage(
            adjustedTransparent
          );
        }

        /*
          If background color is active,
          composite the adjusted subject
          over that background.
        */

        if (
          backgroundRemoved &&
          backgroundColorApplied
        ) {
          const visibleImage =
            await applyColorToImage(
              adjustedTransparent,
              backgroundColor
            );

          if (
            currentJob !==
            adjustmentJobRef.current
          ) {
            return;
          }

          setProcessedImage(
            visibleImage
          );
        } else {
          setProcessedImage(
            adjustedTransparent
          );
        }
      } catch (error) {
        console.error(
          "Image adjustment failed:",
          error
        );
      } finally {
        if (
          currentJob ===
          adjustmentJobRef.current
        ) {
          setApplyingAdjustment(
            false
          );
        }
      }
    };

  /* =======================================================
     RESET ADJUSTMENTS
  ======================================================= */

  const resetAdjustments =
    async () => {
      adjustmentJobRef.current++;

      const baseImage =
        adjustmentBaseRef.current ||
        (backgroundRemoved
          ? transparentImage ||
            photo?.url
          : photo?.url);

      if (!baseImage) {
        return;
      }

      const resetValues = {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        warmth: 0,
        highlights: 0,
        shadows: 0,
        sharpness: 0,
      };

      setAdjustments(
        resetValues
      );

      setApplyingAdjustment(
        true
      );

      try {
        setTransparentImage(
          backgroundRemoved
            ? baseImage
            : null
        );

        if (
          backgroundRemoved &&
          backgroundColorApplied
        ) {
          const result =
            await applyColorToImage(
              baseImage,
              backgroundColor
            );

          setProcessedImage(
            result
          );
        } else {
          setProcessedImage(
            baseImage
          );
        }
      } finally {
        setApplyingAdjustment(
          false
        );
      }
    };

  /* =======================================================
     SAVE / CONTINUE
  ======================================================= */

  const handleSave =
    async () => {
      if (
        !croppedAreaPixels
      ) {
        alert(
          "Please crop/select the photo area first."
        );

        return;
      }

      try {
        setSaving(true);

        const sourceImage =
          backgroundRemoved &&
          processedImage
            ? processedImage
            : photo.url;

        const result =
          await getCroppedImage(
            sourceImage,
            croppedAreaPixels,
            rotation
          );

        onSave({
          ...photo,

          editedUrl:
            result,

          sizeType:
            selectedPreset,

          width:
            preset.width,

          height:
            preset.height,

          backgroundRemoved:
            backgroundRemoved,

          adjustments,
        });
      } catch (error) {
        console.error(
          "Save failed:",
          error
        );

        alert(
          "Photo save nahi ho payi. Please try again."
        );
      } finally {
        setSaving(false);
      }
    };

  /* =======================================================
     BACKGROUND COLORS
  ======================================================= */

  const backgroundColors = [
    {
      label: "White",
      value: "#ffffff",
    },
    {
      label: "Sky Blue",
      value: "#87ceeb",
    },
    {
      label: "Light Blue",
      value: "#dbeafe",
    },
    {
      label: "Light Green",
      value: "#dcfce7",
    },
    {
      label: "Light Pink",
      value: "#fce7f3",
    },
    {
      label: "Gray",
      value: "#e5e7eb",
    },
  ];

  /* =======================================================
     ADJUSTMENT CONTROLS
  ======================================================= */

  const adjustmentControls = [
    {
      key: "brightness",
      label: "☀ Brightness",
      min: -100,
      max: 100,
      step: 1,
    },

    {
      key: "contrast",
      label: "◐ Contrast",
      min: -100,
      max: 100,
      step: 1,
    },

    {
      key: "saturation",
      label: "🎨 Saturation",
      min: -100,
      max: 100,
      step: 1,
    },

    {
      key: "warmth",
      label: "🌡 Warmth",
      min: -100,
      max: 100,
      step: 1,
    },

    {
      key: "highlights",
      label: "☼ Highlights",
      min: -100,
      max: 100,
      step: 1,
    },

    {
      key: "shadows",
      label: "◐ Shadows",
      min: -100,
      max: 100,
      step: 1,
    },

    {
      key: "sharpness",
      label: "✦ Sharpness",
      min: 0,
      max: 100,
      step: 1,
    },
  ];

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="photo-editor">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="photo-editor-header">
        <div>
          <h1>
            Photo Editor
          </h1>

          <p>
            Edit your photo and prepare
            it for printing.
          </p>
        </div>

        <button
          type="button"
          className="back-button"
          onClick={onBack}
        >
          ← Back
        </button>
      </div>

      {/* =================================================
          PHOTO SIZE
      ================================================= */}

      <div className="editor-section">

        <h3>
          Photo Size
        </h3>

        <div className="preset-grid">

          {Object.entries(
            PRESETS
          ).map(
            ([
              key,
              item,
            ]) => (
              <button
                key={key}
                type="button"
                className={
                  selectedPreset ===
                  key
                    ? "preset-button active"
                    : "preset-button"
                }
                onClick={() =>
                  changePreset(
                    key
                  )
                }
              >
                <strong>
                  {item.label}
                </strong>

                <span>
                  {item.width} ×{" "}
                  {item.height} mm
                </span>
              </button>
            )
          )}

        </div>
      </div>

      {/* =================================================
          MAIN EDITOR
      ================================================= */}

      <div className="editor-layout">

        {/* =================================================
            PREVIEW
        ================================================= */}

        <div className="editor-preview">

          <div
            className="preview-stage"
            style={{
              position:
                "relative",
              overflow:
                "hidden",
            }}
          >

            {/* CROP MODE */}

            {editorMode ===
              "crop" && (
              <Cropper
                image={
                  backgroundRemoved &&
                  processedImage
                    ? processedImage
                    : photo.url
                }
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={
                  preset.ratio
                }
                onCropChange={
                  setCrop
                }
                onZoomChange={
                  setZoom
                }
                onRotationChange={
                  setRotation
                }
                onCropComplete={
                  onCropComplete
                }
                objectFit="contain"
              />
            )}

            {/* MANUAL BACKGROUND EDITOR */}

            {editorMode ===
              "background" && (
              <div
                className="manual-editor"
                style={{
                  width: "100%",
                  height: "100%",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  overflow:
                    "auto",
                  background:
                    "repeating-conic-gradient(#eeeeee 0% 25%, #ffffff 0% 50%) 50% / 24px 24px",
                  padding: "20px",
                }}
              >
                <canvas
                  ref={canvasRef}
                  onPointerDown={
                    startDrawing
                  }
                  onPointerMove={
                    draw
                  }
                  onPointerUp={
                    stopDrawing
                  }
                  onPointerCancel={
                    stopDrawing
                  }
                  onPointerLeave={
                    stopDrawing
                  }
                  style={{
                    maxWidth:
                      "100%",
                    maxHeight:
                      "100%",
                    width: "auto",
                    height: "auto",
                    objectFit:
                      "contain",
                    cursor:
                      brushMode ===
                      "erase"
                        ? "crosshair"
                        : "cell",
                    touchAction:
                      "none",
                    boxShadow:
                      "0 20px 50px rgba(0,0,0,0.25)",
                  }}
                />
              </div>
            )}

          </div>
        </div>

        {/* =================================================
            CONTROLS
        ================================================= */}

        <div className="editor-controls">

          {/* =================================================
              EDIT PHOTO / ADJUSTMENTS
          ================================================= */}

          <div className="control-card">

            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap: "10px",
                marginBottom:
                  "14px",
              }}
            >
              <div>
                <h3
                  style={{
                    marginBottom:
                      "4px",
                  }}
                >
                  Edit Photo
                </h3>

                <span
                  style={{
                    fontSize:
                      "11px",
                    opacity:
                      0.55,
                  }}
                >
                  Live adjustments
                </span>
              </div>

              {applyingAdjustment && (
                <span
                  style={{
                    fontSize:
                      "11px",
                    color:
                      "#7fa2ff",
                  }}
                >
                  Updating...
                </span>
              )}
            </div>

            {/* ADJUSTMENT SLIDERS */}

            {adjustmentControls.map(
              (control) => (
                <div
                  key={
                    control.key
                  }
                  className="slider-control"
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                    }}
                  >
                    <label>
                      {
                        control.label
                      }
                    </label>

                    <span
                      style={{
                        minWidth:
                          "36px",
                        textAlign:
                          "right",
                        fontSize:
                          "12px",
                        opacity:
                          0.7,
                      }}
                    >
                      {
                        adjustments[
                          control.key
                        ]
                      }
                    </span>
                  </div>

                  <input
                    type="range"
                    min={
                      control.min
                    }
                    max={
                      control.max
                    }
                    step={
                      control.step
                    }
                    value={
                      adjustments[
                        control.key
                      ]
                    }
                    onChange={(
                      event
                    ) =>
                      handleAdjustmentChange(
                        control.key,
                        event.target
                          .value
                      )
                    }
                  />
                </div>
              )
            )}

            <button
              type="button"
              className="control-button"
              onClick={
                resetAdjustments
              }
              style={{
                width:
                  "100%",
                marginTop:
                  "4px",
              }}
            >
              ↺ Reset Adjustments
            </button>

          </div>

          {/* =================================================
              BACKGROUND
          ================================================= */}

          <div className="control-card">

            <h3>
              Background
            </h3>

            <div className="control-buttons">

              <button
                type="button"
                className="control-button"
                onClick={
                  handleAutoRemove
                }
                disabled={
                  removingBackground
                }
              >
                {removingBackground
                  ? "Removing..."
                  : "Remove Background"}
              </button>

              <button
                type="button"
                className="control-button"
                onClick={
                  handleManualEraser
                }
              >
                Manual Eraser
              </button>

            </div>
          </div>

          {/* =================================================
              MANUAL TOOLS
          ================================================= */}

          {editorMode ===
            "background" && (
            <div className="control-card">

              <h3>
                Manual Eraser
              </h3>

              <div className="control-buttons">

                <button
                  type="button"
                  className={
                    brushMode ===
                    "erase"
                      ? "control-button active"
                      : "control-button"
                  }
                  onClick={() =>
                    setBrushMode(
                      "erase"
                    )
                  }
                >
                  Erase
                </button>

                <button
                  type="button"
                  className={
                    brushMode ===
                    "restore"
                      ? "control-button active"
                      : "control-button"
                  }
                  onClick={() =>
                    setBrushMode(
                      "restore"
                    )
                  }
                >
                  Restore
                </button>

              </div>

              <div className="brush-size-control">

                <label>
                  Brush Size:{" "}
                  {brushSize}px
                </label>

                <input
                  type="range"
                  min="5"
                  max="150"
                  value={
                    brushSize
                  }
                  onChange={(
                    event
                  ) =>
                    setBrushSize(
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                />

              </div>

              <div className="control-buttons">

                <button
                  type="button"
                  className="control-button"
                  onClick={undo}
                  disabled={
                    history.length <=
                    1
                  }
                >
                  ↶ Undo
                </button>

                <button
                  type="button"
                  className="control-button primary"
                  onClick={
                    applyBackgroundEditing
                  }
                >
                  Save Manual Edit
                </button>

              </div>

              <p
                style={{
                  fontSize:
                    "12px",
                  opacity:
                    0.7,
                  marginTop:
                    "10px",
                }}
              >
                Erase ya Restore
                karne ke baad
                "Save Manual Edit"
                click karo.
              </p>

            </div>
          )}

          {/* =================================================
              BACKGROUND COLORS
          ================================================= */}

          {backgroundRemoved && (
            <div className="control-card">

              <h3>
                Background Color
              </h3>

              <div
                className="background-color-grid"
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(3, 1fr)",
                  gap: "8px",
                }}
              >

                {backgroundColors.map(
                  (item) => (
                    <button
                      key={
                        item.value
                      }
                      type="button"
                      className="background-color-button"
                      onClick={() =>
                        applyBackgroundColor(
                          item.value
                        )
                      }
                    >
                      <span
                        style={{
                          display:
                            "block",
                          width:
                            "28px",
                          height:
                            "28px",
                          borderRadius:
                            "50%",
                          background:
                            item.value,
                          border:
                            "1px solid #aaa",
                          margin:
                            "0 auto 5px",
                        }}
                      />

                      <span>
                        {item.label}
                      </span>
                    </button>
                  )
                )}

              </div>

              {/* CUSTOM COLOR */}

              <div
                style={{
                  marginTop:
                    "12px",
                }}
              >
                <button
                  type="button"
                  className="control-button"
                  onClick={() =>
                    setShowColorPicker(
                      !showColorPicker
                    )
                  }
                >
                  Custom Color
                </button>

                {showColorPicker && (
                  <div
                    style={{
                      marginTop:
                        "10px",
                      display:
                        "flex",
                      gap: "10px",
                      alignItems:
                        "center",
                    }}
                  >
                    <input
                      type="color"
                      value={
                        backgroundColor
                      }
                      onChange={(
                        event
                      ) => {
                        const color =
                          event
                            .target
                            .value;

                        setBackgroundColor(
                          color
                        );

                        applyBackgroundColor(
                          color
                        );
                      }}
                    />

                    <span>
                      {
                        backgroundColor
                      }
                    </span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* =================================================
              CROP CONTROLS
          ================================================= */}

          {editorMode ===
            "crop" && (
            <div className="control-card">

              <h3>
                Adjust Crop
              </h3>

              <div className="slider-control">

                <label>
                  Zoom
                </label>

                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={(
                    event
                  ) =>
                    setZoom(
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                />

              </div>

              <div className="slider-control">

                <label>
                  Rotation
                </label>

                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={
                    rotation
                  }
                  onChange={(
                    event
                  ) =>
                    setRotation(
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                />

              </div>

            </div>
          )}

        </div>
      </div>

      {/* =================================================
          FOOTER
      ================================================= */}

      <div className="editor-footer">

        <button
          type="button"
          className="secondary-button"
          onClick={onBack}
        >
          Cancel
        </button>

        {editorMode ===
          "background" && (
          <button
            type="button"
            className="secondary-button"
            onClick={
              applyBackgroundEditing
            }
          >
            Save Edit
          </button>
        )}

        <button
          type="button"
          className="generate-button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving
            ? "Saving..."
            : "Save & Continue →"}
        </button>

      </div>

    </div>
  );
}