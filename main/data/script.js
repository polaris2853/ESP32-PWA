
// --- DOM Element Selection ---
// Get references to key HTML elements for user interaction and output.
const grid = document.getElementById("grid");
const colorInput = document.getElementById("color");
const output = document.getElementById("output");
const swatches = document.querySelectorAll(".swatch");
const frameLabel = document.getElementById("frameLabel");
let isPainting = false; // Flag to track if the mouse is being held down for continuous drawing.

// --- Grid Creation and Drawing Logic ---
const pixels = [];
for (let i = 0; i < 56; i++) {
  const pixel = document.createElement("div");
  pixel.classList.add("pixel");
  pixel.dataset.index = i; // Store the pixel's index for easier reference.

  // Mouse down event: starts painting and colors the single pixel.
  pixel.addEventListener("mousedown", () => {
    isPainting = true;
    pixel.style.backgroundColor = colorInput.value;
    saveFrame(); // Save the state of the current frame after the change.
  });

  // Mouse over event: continues painting as long as the mouse is held down.
  pixel.addEventListener("mouseover", () => {
    if (isPainting) {
      pixel.style.backgroundColor = colorInput.value;
      saveFrame(); // Save the state of the current frame after the change.
    }
  });

  grid.appendChild(pixel);
  pixels.push(pixel);
}

// Global mouse up event: stops painting anywhere on the page.
document.body.addEventListener("mouseup", () => {
  isPainting = false;
});

// Swatch event listeners: allows users to select a color from a preset palette.
swatches.forEach(swatch => {
  swatch.addEventListener("click", () => {
    const color = window.getComputedStyle(swatch).backgroundColor;
    colorInput.value = rgbToHex(color);
  });
});

// Helper function to convert an RGB color string to a hex color string.
function rgbToHex(rgb) {
  const result = rgb.match(/\d+/g);
  if (!result || result.length < 3) return "#000000"; // Handle invalid input.
  return (
    "#" +
    result
      .slice(0, 3)
      .map(x => parseInt(x).toString(16).padStart(2, "0"))
      .join("")
  );
}

// --- Frame Management ---
let frames = [Array(56).fill("#000000")]; // An array to hold all animation frames.
let currentFrame = 0; // Index of the currently displayed frame.
let interval = null; // Variable to hold the animation interval ID.

// Renders a specific frame from the 'frames' array onto the grid.
function renderFrame(index) {
  if (!frames[index]) return; // Exit if the frame doesn't exist.
  frames[index].forEach((color, i) => {
    pixels[i].style.backgroundColor = color;
  });
  frameLabel.textContent = `Frame ${index + 1}`; // Update the frame number display.
}

// Saves the current state of the grid into the 'frames' array.
function saveFrame() {
  frames[currentFrame] = pixels.map(p => rgbToHex(p.style.backgroundColor));
}

// Clears the grid to all black.
function clearGrid() {
  pixels.forEach(p => (p.style.backgroundColor = "#000000"));
}

// --- Animation Controls ---
// Previous frame button: moves to the previous frame if one exists.
document.getElementById("prev").addEventListener("click", () => {
  if (currentFrame > 0) {
    saveFrame(); // Save changes to the current frame before switching.
    currentFrame--;
    renderFrame(currentFrame);
  }
});

// Next frame button: moves to the next frame if one exists.
document.getElementById("next").addEventListener("click", () => {
  if (currentFrame < frames.length - 1) {
    saveFrame(); // Save changes to the current frame before switching.
    currentFrame++;
    renderFrame(currentFrame);
  }
});

// Add frame button: adds a new, blank frame to the animation.
document.getElementById("add").addEventListener("click", () => {
  saveFrame();
  frames.push(Array(56).fill("#000000")); // Add a new blank frame with 56 pixels.
  currentFrame = frames.length - 1; // Set the current frame to the new one.
  renderFrame(currentFrame);
});

// Delete frame button: removes the current frame if there's more than one.
document.getElementById("delete").addEventListener("click", () => {
  if (frames.length > 1) {
    frames.splice(currentFrame, 1); // Remove the current frame from the array.
    currentFrame = Math.max(0, currentFrame - 1); // Adjust the current frame index.
    renderFrame(currentFrame);
  }
});

// Clear button: clears the current grid and saves the blank frame.
document.getElementById("clear").addEventListener("click", () => {
  clearGrid();
  saveFrame();
});

// Export button: saves the current frame, formats the JSON, and uploads it to the server.
document.getElementById("export").addEventListener("click", () => {
  saveFrame(); // Ensure the current frame's state is saved.
  output.value = JSON.stringify(frames, null, 2); // Display the formatted JSON for preview.

  // Fetch API call to send the JSON to the ESP32 server.
  fetch('/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(frames) // Send the unformatted JSON for efficiency.
  })
    .then(res => res.text())
    .then(text => console.log('Server says:', text))
    .catch(err => console.error('Upload failed:', err));
});

// Play button: starts the animation loop.
document.getElementById("play").addEventListener("click", () => {
  let i = 0;
  saveFrame(); // Save any unsaved changes before starting.
  if (interval) clearInterval(interval); // Clear any existing animation interval.
  interval = setInterval(() => {
    renderFrame(i); // Render the next frame.
    i = (i + 1) % frames.length; // Loop back to the first frame when the end is reached.
  }, 200); // The animation speed is set to 200 milliseconds per frame.
});

// Stop button: stops the animation loop.
document.getElementById("stop").addEventListener("click", () => {
  clearInterval(interval); // Stop the interval.
  interval = null; // Reset the interval variable.
});

// Last Session button: load the last session saved in saved.json
document.getElementById("loadLastAni").addEventListener("click", () => {
  fetch('/loadLastAni', {
    method: 'GET'
  })
    .then(response => response.text())
    .then(data => {
      console.log('Server response:', data);
      alert('Last saved animation loaded on ESP32!');
    })
    .catch((error) => {
      console.error('Error:', error);
      alert('Failed to load last saved animation.');
    });
});

// Initial render: display the very first frame when the page loads.
renderFrame(currentFrame);

//Brightness controller
document.getElementById('brightnessSlider').addEventListener('change', function () {
  const brightnessValue = this.value;

  // Send the new brightness value to the ESP32
  fetch(`/setBrightness?value=${brightnessValue}`)
    .then(response => response.text())
    .then(data => console.log(data))
    .catch(error => console.error('Error:', error));
});

// Converting images to 8x8 grid to put on the matrix
document.getElementById('imageInput').addEventListener('change', handleImageUpload);
function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;;

  const reader = new FileReader();

  if (file.type === 'image/gif') {
    reader.onload = function (e) {

      const arrayBuffer = e.target.result;
      const buffer = new Uint8Array(arrayBuffer);
      const gifReader = new omggif.GifReader(buffer);

      const decodedFrames = processGifFrames(gifReader);
      uploadFrames(decodedFrames);
    };

    reader.onerror = function (e) {
      alert(Error);
    };

    reader.readAsArrayBuffer(file);
  } else {
    // Existing static image logic
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        const frameData = processImage(img);
        uploadFrames([frameData]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}
//This function is for processing a GIF
function processGifFrames(gifReader) {
  const allFrameHexColors = [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 8;
  canvas.height = 7;

  const gifWidth = gifReader.width;
  const gifHeight = gifReader.height;

  // Create a buffer for the entire GIF frame
  const frameBuffer = new Uint8ClampedArray(gifWidth * gifHeight * 4);

  for (let i = 0; i < gifReader.numFrames(); i++) {
    // Decode the current frame's pixel data into the buffer
    gifReader.decodeAndBlitFrameRGBA(i, frameBuffer);

    // Create an ImageData object from the decoded data
    const imageData = new ImageData(frameBuffer, gifWidth, gifHeight);

    // Draw this frame onto our small 8x8 canvas, which resizes it
    ctx.clearRect(0, 0, 8, 7); // Clear the canvas before drawing
    // The imageData object cannot be drawn directly, so we create a temporary canvas to draw it
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = gifWidth;
    tempCanvas.height = gifHeight;
    tempCtx.putImageData(imageData, 0, 0);

    // Now draw the tempCanvas content to our 8x8 canvas
    ctx.drawImage(tempCanvas, 0, 0, 8, 7);

    // Get the pixel data from the 8x8 canvas
    const smallImageData = ctx.getImageData(0, 0, 8, 7);
    const pixelData = smallImageData.data;

    const frameHexColors = [];
    for (let j = 0; j < pixelData.length; j += 4) {
      const r = pixelData[j];
      const g = pixelData[j + 1];
      const b = pixelData[j + 2];
      const toHex = (c) => c.toString(16).padStart(2, '0');
      frameHexColors.push(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
    }

    // Store the result for this frame
    allFrameHexColors.push(frameHexColors);
  }

  return allFrameHexColors;
}

// This function is for processing a single, static image (like a JPG or PNG).
// It takes an already loaded Image object as its input.
function processImage(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 8;
  canvas.height = 8;

  // Draw the loaded image onto our 8x8 canvas, resizing it to fit.
  ctx.drawImage(img, 0, 0, 8, 8);

  // Get the pixel data from the canvas.
  const imageData = ctx.getImageData(0, 0, 8, 8);
  const pixelData = imageData.data;

  const frameHexColors = [];
  // Loop through the pixel data, skipping the alpha channel (i += 4).
  for (let i = 0; i < pixelData.length; i += 4) {
    const r = pixelData[i];
    const g = pixelData[i + 1];
    const b = pixelData[i + 2];
    const toHex = (c) => c.toString(16).padStart(2, '0');
    frameHexColors.push(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
  }

  // Return the final array of hex colors for this single-frame image.
  return frameHexColors;
}

// This function is responsible for sending the processed frames to the ESP32 server.
function uploadFrames(frames) {
  // Convert the array of frames into a JSON string.
  const jsonData = JSON.stringify(frames);
  const outputElement = document.getElementById('output');

  // Display the formatted JSON in the textarea for the user to see.
  outputElement.value = JSON.stringify(frames, null, 2);

  // Use the Fetch API to send a POST request to the ESP32's /upload endpoint.
  fetch('/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // Tell the server we are sending plain text.
    body: jsonData
  })
    .then(response => response.text())
    .then(data => {
      // Log the server's response to the console.
      console.log('Server response:', data);
      alert('Animation uploaded!');
    })
    .catch((error) => {
      // Catch and report any network or fetch-related errors.
      console.error('Error:', error);
      alert('Failed to upload animation.');
    });
}