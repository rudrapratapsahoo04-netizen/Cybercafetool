
import { useState } from "react";

import "./index.css";

import PhotoEditor from "./components/PhotoEditor";
import SheetGenerator from "./components/SheetGenerator";

function App() {
  const [photo, setPhoto] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [editedPhoto, setEditedPhoto] = useState(null);
  const [showSheetGenerator, setShowSheetGenerator] =
    useState(false);

  const handleFile = (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    const imageUrl = URL.createObjectURL(file);

    setPhoto({
      file,
      url: imageUrl,
      name: file.name,
    });

    setEditedPhoto(null);
    setShowSheetGenerator(false);
  };

  const handleInput = (e) => {
    handleFile(e.target.files?.[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);

    handleFile(e.dataTransfer.files?.[0]);
  };

  const removePhoto = () => {
    if (photo?.url) {
      URL.revokeObjectURL(photo.url);
    }

    setPhoto(null);
    setEditedPhoto(null);
    setShowSheetGenerator(false);
  };

  const handleSave = (result) => {
    setEditedPhoto(result);
    setShowSheetGenerator(false);
  };

  /*
   * ------------------------------------------------
   * PHOTO EDITOR
   * ------------------------------------------------
   */

  if (photo && !editedPhoto) {
    return (
      <div className="app">
        <div className="background-glow glow-one"></div>
        <div className="background-glow glow-two"></div>

        <header className="navbar">
          <div className="brand">
            <div className="brand-icon">✦</div>

            <div>
              <h1>PhotoCraft</h1>
              <span>CYBER CAFE STUDIO</span>
            </div>
          </div>

          <div className="status">
            <span className="status-dot"></span>
            READY
          </div>
        </header>

        <main className="main">
          <PhotoEditor
            photo={photo}
            onBack={removePhoto}
            onSave={handleSave}
          />
        </main>

        <footer>
          PhotoCraft · Fast Photo Processing for Cyber Cafes
        </footer>
      </div>
    );
  }

  /*
   * ------------------------------------------------
   * MAIN APPLICATION
   * ------------------------------------------------
   */

  return (
    <div className="app">
      <div className="background-glow glow-one"></div>
      <div className="background-glow glow-two"></div>

      <header className="navbar">
        <div className="brand">
          <div className="brand-icon">✦</div>

          <div>
            <h1>PhotoCraft</h1>
            <span>CYBER CAFE STUDIO</span>
          </div>
        </div>

        <div className="status">
          <span className="status-dot"></span>
          READY
        </div>
      </header>

      <main className="main">

        {/* ------------------------------------------
            HOME PAGE
        ------------------------------------------ */}

        {!editedPhoto && (
          <>
            <section className="hero">
              <div className="hero-badge">
                ⚡ FAST PHOTO PROCESSING
              </div>

              <h2>
                Create perfect
                <span> photos in seconds.</span>
              </h2>

              <p>
                Passport photos, ID photos and
                custom photo sheets — simple,
                fast and print-ready.
              </p>
            </section>

            <label
              className={`upload-box ${
                dragging ? "dragging" : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => {
                setDragging(false);
              }}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleInput}
                hidden
              />

              <div className="upload-icon">
                ↑
              </div>

              <h3>
                Upload your photo
              </h3>

              <p>
                Drag & drop your image here
                <br />
                or{" "}
                <strong>
                  browse from computer
                </strong>
              </p>

              <div className="supported">
                JPG · JPEG · PNG · WEBP
              </div>
            </label>

            <div className="features">

              <div className="feature-card">
                <div>📐</div>

                <h4>
                  Any Size
                </h4>

                <p>
                  Passport, ID or custom
                  dimensions
                </p>
              </div>

              <div className="feature-card">
                <div>✨</div>

                <h4>
                  Background
                </h4>

                <p>
                  Automatic & manual
                  background tools
                </p>
              </div>

              <div className="feature-card">
                <div>🖨️</div>

                <h4>
                  Print Ready
                </h4>

                <p>
                  Generate sheets and
                  print instantly
                </p>
              </div>

            </div>
          </>
        )}

        {/* ------------------------------------------
            PHOTO READY / SHEET GENERATOR
        ------------------------------------------ */}

        {editedPhoto && !showSheetGenerator && (
          <div className="result-page">

            <div className="editor-top">

              <div>
                <div className="hero-badge">
                  PHOTO READY
                </div>

                <h2>
                  Your Photo
                </h2>

                <p>
                  Your selected photo size is
                  ready for the next step.
                </p>
              </div>

              <button
                className="secondary-button"
                onClick={removePhoto}
              >
                ← Start Again
              </button>

            </div>

            <div className="result-card">

              <div className="result-image">
                <img
                  src={editedPhoto.editedUrl}
                  alt="Edited"
                />
              </div>

              <div className="result-info">

                <span>
                  PHOTO SIZE
                </span>

                <h3>
                  {editedPhoto.width} ×{" "}
                  {editedPhoto.height} mm
                </h3>

                <p>
                  {editedPhoto.sizeType}
                </p>

                <button
                  className="generate-button"
                  onClick={() => {
                    setShowSheetGenerator(true);
                  }}
                >
                  Continue to Sheet →
                </button>

              </div>

            </div>
          </div>
        )}

        {/* ------------------------------------------
            SHEET GENERATOR
        ------------------------------------------ */}

        {editedPhoto && showSheetGenerator && (
          <SheetGenerator
            photo={editedPhoto}
            onBack={() => {
              setShowSheetGenerator(false);
            }}
            onStartAgain={removePhoto}
          />
        )}

      </main>

      <footer>
        PhotoCraft · Fast Photo Processing for Cyber Cafes
      </footer>
    </div>
  );
}

export default App;
