import { useMemo, useState } from "react";
import jsPDF from "jspdf";

const PRESET_SHEETS = {
  a4: {
    label: "A4",
    width: 210,
    height: 297,
  },
  a5: {
    label: "A5",
    width: 148,
    height: 210,
  },
  "4x6": {
    label: "4 × 6",
    width: 101.6,
    height: 152.4,
  },
  "5x7": {
    label: "5 × 7",
    width: 127,
    height: 177.8,
  },
};

const QUICK_COPIES = [4, 6, 8, 12, 20, 30];

export default function SheetGenerator({
  photo,
  onBack,
  onStartAgain,
}) {
  const [sheetType, setSheetType] = useState("a4");

  const [customWidth, setCustomWidth] = useState(210);
  const [customHeight, setCustomHeight] = useState(297);

  const [copies, setCopies] = useState(8);
  const [gap, setGap] = useState(3);
  const [margin, setMargin] = useState(8);

  const [previewPage, setPreviewPage] = useState(0);

  // Deleted pages are stored here.
  const [deletedPages, setDeletedPages] = useState([]);

  // Used for Undo.
  const [lastDeletedPage, setLastDeletedPage] =
    useState(null);

  const [printing, setPrinting] = useState(false);

  const sheet = useMemo(() => {
    if (sheetType === "custom") {
      return {
        label: "Custom",
        width: Number(customWidth) || 100,
        height: Number(customHeight) || 100,
      };
    }

    return PRESET_SHEETS[sheetType];
  }, [
    sheetType,
    customWidth,
    customHeight,
  ]);

  /*
   * Calculate how many photos fit on one page.
   */
  const layout = useMemo(() => {
    const photoWidth = Number(photo.width);
    const photoHeight = Number(photo.height);

    const availableWidth = Math.max(
      1,
      sheet.width - margin * 2
    );

    const availableHeight = Math.max(
      1,
      sheet.height - margin * 2
    );

    const columns = Math.max(
      1,
      Math.floor(
        (availableWidth + gap) /
          (photoWidth + gap)
      )
    );

    const rows = Math.max(
      1,
      Math.floor(
        (availableHeight + gap) /
          (photoHeight + gap)
      )
    );

    const perPage =
      columns * rows;

    const normalPages = Math.max(
      1,
      Math.ceil(copies / perPage)
    );

    const activePages = Array.from(
      { length: normalPages },
      (_, index) => index
    ).filter(
      (pageIndex) =>
        !deletedPages.includes(pageIndex)
    );

    return {
      columns,
      rows,
      perPage,
      normalPages,
      activePages,
      pages: activePages.length,
    };
  }, [
    photo,
    sheet,
    copies,
    gap,
    margin,
    deletedPages,
  ]);

  /*
   * Make sure preview page always points
   * to an existing active page.
   */
  const safePreviewPage = Math.min(
    previewPage,
    Math.max(
      0,
      layout.activePages.length - 1
    )
  );

  const currentActualPage =
    layout.activePages[
      safePreviewPage
    ] ?? 0;

  /*
   * Photo positions inside one sheet.
   */
  const getPhotoPositions = () => {
    const positions = [];

    for (
      let row = 0;
      row < layout.rows;
      row++
    ) {
      for (
        let column = 0;
        column < layout.columns;
        column++
      ) {
        const x =
          margin +
          column *
            (photo.width + gap);

        const y =
          margin +
          row *
            (photo.height + gap);

        positions.push({
          x,
          y,
        });
      }
    }

    return positions;
  };

  const positions =
    getPhotoPositions();

  /*
   * Get photos belonging to current page.
   *
   * Deleted pages are skipped and the remaining
   * photos are automatically re-packed.
   */
  const getPagePhotoItems = (
    pageNumber
  ) => {
    const start =
      pageNumber * layout.perPage;

    const end = Math.min(
      start + layout.perPage,
      copies
    );

    return Array.from(
      {
        length: Math.max(
          0,
          end - start
        ),
      },
      (_, index) => ({
        position:
          positions[index],
        number:
          start + index + 1,
      })
    );
  };

  /*
   * Current preview photos.
   */
  const previewItems =
    getPagePhotoItems(
      currentActualPage
    );

  /*
   * Delete currently selected page.
   */
  const deleteCurrentPage = () => {
    if (
      layout.activePages.length <= 1
    ) {
      alert(
        "Kam se kam ek page rehna chahiye."
      );
      return;
    }

    const pageToDelete =
      currentActualPage;

    setDeletedPages((current) => {
      if (
        current.includes(pageToDelete)
      ) {
        return current;
      }

      return [
        ...current,
        pageToDelete,
      ].sort((a, b) => a - b);
    });

    setLastDeletedPage(
      pageToDelete
    );

    setPreviewPage((current) =>
      Math.max(
        0,
        Math.min(
          current,
          layout.activePages.length - 2
        )
      )
    );
  };

  /*
   * Undo last page deletion.
   */
  const undoDelete = () => {
    if (
      lastDeletedPage === null
    ) {
      return;
    }

    setDeletedPages((current) =>
      current.filter(
        (page) =>
          page !== lastDeletedPage
      )
    );

    setLastDeletedPage(null);
  };

  /*
   * Restore all deleted pages.
   */
  const restoreAllPages = () => {
    setDeletedPages([]);
    setLastDeletedPage(null);
    setPreviewPage(0);
  };

  const handleSheetChange = (
    type
  ) => {
    setSheetType(type);
    setPreviewPage(0);
    setDeletedPages([]);
    setLastDeletedPage(null);
  };

  const handleCopiesChange = (
    value
  ) => {
    const safeValue = Math.min(
      500,
      Math.max(
        1,
        Number(value) || 1
      )
    );

    setCopies(safeValue);

    /*
     * Copy count changed, so old deleted
     * page references are no longer safe.
     */
    setDeletedPages([]);
    setLastDeletedPage(null);
    setPreviewPage(0);
  };

  const resetSettings = () => {
    setSheetType("a4");

    setCustomWidth(210);
    setCustomHeight(297);

    setCopies(8);
    setGap(3);
    setMargin(8);

    setPreviewPage(0);

    setDeletedPages([]);
    setLastDeletedPage(null);
  };

  /*
   * Create printable canvas for one active page.
   */
  const createSheetCanvas = async (
    activePageIndex
  ) => {
    const DPI = 150;

    const mmToPx = (mm) =>
      Math.round(
        (mm / 25.4) * DPI
      );

    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width =
      mmToPx(sheet.width);

    canvas.height =
      mmToPx(sheet.height);

    const ctx =
      canvas.getContext("2d");

    if (!ctx) {
      throw new Error(
        "Canvas context unavailable"
      );
    }

    ctx.fillStyle =
      "#ffffff";

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    const image =
      await loadImage(
        photo.editedUrl
      );

    const scale =
      canvas.width /
      sheet.width;

    /*
     * activePageIndex means page number
     * in the visible/remaining page list.
     */
    const actualPageIndex =
      layout.activePages[
        activePageIndex
      ];

    if (
      actualPageIndex === undefined
    ) {
      return canvas;
    }

    /*
     * IMPORTANT:
     *
     * We calculate the photos based on the
     * active page position, not the deleted
     * page number.
     *
     * Therefore deleted pages are removed
     * and photos automatically re-pack.
     */
    const pageStart =
      activePageIndex *
      layout.perPage;

    const pageEnd =
      Math.min(
        pageStart +
          layout.perPage,
        copies
      );

    for (
      let index = pageStart;
      index < pageEnd;
      index++
    ) {
      const positionIndex =
        index - pageStart;

      const position =
        positions[
          positionIndex
        ];

      if (!position) {
        break;
      }

      ctx.drawImage(
        image,

        Math.round(
          position.x * scale
        ),

        Math.round(
          position.y * scale
        ),

        Math.round(
          photo.width * scale
        ),

        Math.round(
          photo.height * scale
        )
      );
    }

    return canvas;
  };

  /*
   * DOWNLOAD PDF
   */
  const downloadPDF = async () => {
    try {
      setPrinting(true);

      const pdf =
        new jsPDF({
          orientation:
            sheet.width >
            sheet.height
              ? "landscape"
              : "portrait",

          unit: "mm",

          format: [
            sheet.width,
            sheet.height,
          ],
        });

      for (
        let page = 0;
        page <
        layout.activePages.length;
        page++
      ) {
        if (page > 0) {
          pdf.addPage([
            sheet.width,
            sheet.height,
          ]);
        }

        const canvas =
          await createSheetCanvas(
            page
          );

        const image =
          canvas.toDataURL(
            "image/jpeg",
            0.95
          );

        pdf.addImage(
          image,
          "JPEG",
          0,
          0,
          sheet.width,
          sheet.height
        );
      }

      pdf.save(
        `photo-sheet-${sheet.label}.pdf`
      );
    } catch (error) {
      console.error(
        "PDF ERROR:",
        error
      );

      alert(
        "PDF generate nahi ho paya."
      );
    } finally {
      setPrinting(false);
    }
  };

  /*
   * PRINT
   */
  const printSheet = async () => {
    let printWindow = null;

    try {
      setPrinting(true);

      const images = [];

      for (
        let page = 0;
        page <
        layout.activePages.length;
        page++
      ) {
        const canvas =
          await createSheetCanvas(
            page
          );

        images.push(
          canvas.toDataURL(
            "image/png"
          )
        );
      }

      printWindow =
        window.open(
          "",
          "_blank"
        );

      if (!printWindow) {
        alert(
          "Popup blocked hai. Browser popup allow karo."
        );

        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>

        <html>
          <head>
            <title>
              Photo Sheet
            </title>

            <style>
              @page {
                size:
                  ${sheet.width}mm
                  ${sheet.height}mm;

                margin: 0;
              }

              * {
                box-sizing:
                  border-box;
              }

              html,
              body {
                margin: 0;
                padding: 0;
                background:
                  white;
              }

              .page {
                width:
                  ${sheet.width}mm;

                height:
                  ${sheet.height}mm;

                page-break-after:
                  always;
              }

              .page:last-child {
                page-break-after:
                  auto;
              }

              img {
                width: 100%;
                height: 100%;
                display: block;
              }
            </style>
          </head>

          <body>
            ${images
              .map(
                (image) => `
                  <div class="page">
                    <img
                      src="${image}"
                    />
                  </div>
                `
              )
              .join("")}
          </body>
        </html>
      `);

      printWindow.document.close();

      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    } catch (error) {
      console.error(
        "PRINT ERROR:",
        error
      );

      if (printWindow) {
        printWindow.close();
      }

      alert(
        "Print sheet prepare nahi ho payi."
      );
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="sheet-generator">

      {/* HEADER */}

      <div className="editor-top">

        <div>
          <div className="hero-badge">
            SHEET GENERATOR
          </div>

          <h2>
            Create Print-Ready Sheet
          </h2>

          <p>
            Photo size aur sheet size
            separately choose karein.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={onBack}
        >
          ← Back to Photo
        </button>

      </div>

      <div className="sheet-layout">

        {/* PREVIEW */}

        <div className="sheet-preview-panel">

          <div className="sheet-preview-header">

            <div>
              <span>
                PREVIEW
              </span>

              <strong>
                {sheet.label} Sheet
              </strong>
            </div>

            <div className="page-count">
              {layout.activePages.length}{" "}
              {layout.activePages
                .length === 1
                ? "Page"
                : "Pages"}
            </div>

          </div>

          {/* PAGE NAVIGATION */}

          <div className="sheet-preview-toolbar">

            <button
              className="secondary-button"
              disabled={
                safePreviewPage === 0
              }
              onClick={() =>
                setPreviewPage(
                  (page) =>
                    Math.max(
                      0,
                      page - 1
                    )
                )
              }
            >
              ← Previous
            </button>

            <span>
              Page{" "}
              {safePreviewPage + 1}
              {" / "}
              {layout.activePages.length}
            </span>

            <button
              className="secondary-button"
              disabled={
                safePreviewPage >=
                layout.activePages.length -
                  1
              }
              onClick={() =>
                setPreviewPage(
                  (page) =>
                    Math.min(
                      layout.activePages.length -
                        1,
                      page + 1
                    )
                )
              }
            >
              Next →
            </button>

          </div>

          {/* PAGE ACTIONS */}

          <div className="page-actions">

            <button
              className="danger-button"
              onClick={
                deleteCurrentPage
              }
              disabled={
                layout.activePages
                  .length <= 1
              }
            >
              🗑 Delete Page
            </button>

            <button
              className="secondary-button"
              onClick={undoDelete}
              disabled={
                lastDeletedPage ===
                null
              }
            >
              ↩ Undo Delete
            </button>

            {deletedPages.length >
              0 && (
              <button
                className="secondary-button"
                onClick={
                  restoreAllPages
                }
              >
                ↻ Restore All
              </button>
            )}

          </div>

          {/* SHEET */}

          <div className="sheet-preview-area">

            <div
              className="sheet-preview"
              style={{
                aspectRatio:
                  `${sheet.width} / ${sheet.height}`,
              }}
            >

              {previewItems.map(
                (item) => {
                  const left =
                    (item.position.x /
                      sheet.width) *
                    100;

                  const top =
                    (item.position.y /
                      sheet.height) *
                    100;

                  const width =
                    (photo.width /
                      sheet.width) *
                    100;

                  const height =
                    (photo.height /
                      sheet.height) *
                    100;

                  return (
                    <img
                      key={
                        item.number
                      }
                      src={
                        photo.editedUrl
                      }
                      alt={`Photo ${item.number}`}
                      className="sheet-photo"
                      style={{
                        left:
                          `${left}%`,
                        top:
                          `${top}%`,
                        width:
                          `${width}%`,
                        height:
                          `${height}%`,
                      }}
                    />
                  );
                }
              )}

            </div>

          </div>

          <div className="sheet-info">

            <span>
              {photo.sizeType.toUpperCase()}
            </span>

            <strong>
              {photo.width} ×{" "}
              {photo.height} mm
            </strong>

            <span>
              →
            </span>

            <strong>
              {sheet.label}
            </strong>

            <span>
              →
            </span>

            <strong>
              {copies} Copies
            </strong>

          </div>

        </div>

        {/* CONTROLS */}

        <div className="sheet-controls">

          {/* SHEET SIZE */}

          <div className="control-section">

            <div className="card-label">
              SHEET SIZE
            </div>

            <div className="sheet-size-grid">

              {Object.entries(
                PRESET_SHEETS
              ).map(
                ([key, item]) => (
                  <button
                    key={key}
                    className={
                      sheetType === key
                        ? "sheet-size-button selected"
                        : "sheet-size-button"
                    }
                    onClick={() =>
                      handleSheetChange(
                        key
                      )
                    }
                  >
                    <strong>
                      {item.label}
                    </strong>

                    <small>
                      {item.width} ×{" "}
                      {item.height} mm
                    </small>
                  </button>
                )
              )}

              <button
                className={
                  sheetType ===
                  "custom"
                    ? "sheet-size-button selected"
                    : "sheet-size-button"
                }
                onClick={() =>
                  handleSheetChange(
                    "custom"
                  )
                }
              >
                <strong>
                  Custom
                </strong>

                <small>
                  Your own size
                </small>
              </button>

            </div>

          </div>

          {/* CUSTOM SIZE */}

          {sheetType ===
            "custom" && (
            <div className="control-section">

              <div className="card-label">
                CUSTOM SHEET SIZE
              </div>

              <div className="custom-size-grid">

                <label>
                  Width

                  <div className="number-input">

                    <input
                      type="number"
                      min="30"
                      max="500"
                      step="0.1"
                      value={
                        customWidth
                      }
                      onChange={(e) => {
                        setCustomWidth(
                          Number(
                            e.target.value
                          )
                        );

                        setPreviewPage(
                          0
                        );
                      }}
                    />

                    <span>
                      mm
                    </span>

                  </div>
                </label>

                <label>
                  Height

                  <div className="number-input">

                    <input
                      type="number"
                      min="30"
                      max="500"
                      step="0.1"
                      value={
                        customHeight
                      }
                      onChange={(e) => {
                        setCustomHeight(
                          Number(
                            e.target.value
                          )
                        );

                        setPreviewPage(
                          0
                        );
                      }}
                    />

                    <span>
                      mm
                    </span>

                  </div>
                </label>

              </div>

            </div>
          )}

          {/* COPIES */}

          <div className="control-section">

            <div className="control-heading">

              <span>
                COPIES
              </span>

              <strong>
                {copies}
              </strong>

            </div>

            <input
              type="range"
              min="1"
              max="500"
              value={copies}
              onChange={(e) =>
                handleCopiesChange(
                  e.target.value
                )
              }
            />

            <div className="copy-buttons">

              {QUICK_COPIES.map(
                (value) => (
                  <button
                    key={value}
                    className={
                      copies === value
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      handleCopiesChange(
                        value
                      )
                    }
                  >
                    {value}
                  </button>
                )
              )}

            </div>

            <div className="custom-copy-row">

              <input
                type="number"
                min="1"
                max="500"
                value={copies}
                onChange={(e) =>
                  handleCopiesChange(
                    e.target.value
                  )
                }
              />

              <span>
                copies
              </span>

            </div>

          </div>

          {/* GAP */}

          <div className="control-section">

            <div className="control-heading">

              <span>
                PHOTO GAP
              </span>

              <strong>
                {gap} mm
              </strong>

            </div>

            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={gap}
              onChange={(e) =>
                setGap(
                  Number(
                    e.target.value
                  )
                )
              }
            />

          </div>

          {/* MARGIN */}

          <div className="control-section">

            <div className="control-heading">

              <span>
                SHEET MARGIN
              </span>

              <strong>
                {margin} mm
              </strong>

            </div>

            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={margin}
              onChange={(e) =>
                setMargin(
                  Number(
                    e.target.value
                  )
                )
              }
            />

          </div>

          {/* SUMMARY */}

          <div className="sheet-summary">

            <div>
              <span>
                Photos / Sheet
              </span>

              <strong>
                {layout.perPage}
              </strong>
            </div>

            <div>
              <span>
                Total Copies
              </span>

              <strong>
                {copies}
              </strong>
            </div>

            <div>
              <span>
                Active Pages
              </span>

              <strong>
                {
                  layout.activePages
                    .length
                }
              </strong>
            </div>

          </div>

          {/* DELETE STATUS */}

          {deletedPages.length >
            0 && (
            <div className="deleted-pages-info">
              🗑{" "}
              {deletedPages.length}{" "}
              page
              {deletedPages.length >
              1
                ? "s"
                : ""}{" "}
              removed.
              <span>
                Photos automatically
                re-arranged.
              </span>
            </div>
          )}

          {/* PDF */}

          <button
            className="generate-button"
            onClick={
              downloadPDF
            }
            disabled={printing}
          >
            {printing
              ? "Preparing..."
              : "📥 Download PDF"}
          </button>

          {/* PRINT */}

          <button
            className="secondary-button full-button"
            onClick={
              printSheet
            }
            disabled={printing}
          >
            🖨️ Print Sheet
          </button>

          {/* RESET */}

          <button
            className="secondary-button full-button"
            onClick={
              resetSettings
            }
            disabled={printing}
          >
            ↺ Reset Settings
          </button>

          {/* NEW PHOTO */}

          <button
            className="secondary-button full-button"
            onClick={
              onStartAgain
            }
            disabled={printing}
          >
            ↻ Start New Photo
          </button>

        </div>

      </div>

    </div>
  );
}

function loadImage(src) {
  return new Promise(
    (resolve, reject) => {
      const image =
        new Image();

      image.onload = () =>
        resolve(image);

      image.onerror = reject;

      image.src = src;
    }
  );
}