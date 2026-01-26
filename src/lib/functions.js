
/**
 * Global variables for DOM elements and Contexts
 */
const uploadInput = document.getElementById('upload');
const uploadArea = document.getElementById('uploadArea');
const sourceCanvas = document.getElementById('sourceCanvas');
const outputCanvas = document.getElementById('outputCanvas');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');
const sCtx = sourceCanvas.getContext('2d');
const oCtx = outputCanvas.getContext('2d');

/**
 * Handle image upload and display
 */
uploadInput.addEventListener('change', function (e) {
    if (this.files && this.files[0]) {
        const reader = new FileReader();

        reader.onload = function (event) {
            const img = new Image();
            img.onload = function () {
                // Set canvas dimensions to match the image
                sourceCanvas.width = outputCanvas.width = img.width;
                sourceCanvas.height = outputCanvas.height = img.height;

                // Draw image on both canvases initially
                sCtx.drawImage(img, 0, 0);
                oCtx.drawImage(img, 0, 0);

                // UI Management: Hide upload area, show canvases and buttons
                uploadArea.style.display = 'none';
                sourceCanvas.style.display = 'block';
                outputCanvas.style.display = 'block';
                resetBtn.style.display = 'block';
                downloadBtn.style.display = 'block';
            };
            img.src = event.target.result;
            setPicture(img.src)
        };
        reader.readAsDataURL(this.files[0]);
    }
});

/**
 * Reset the application to its initial state
 */
function resetImage() {
    // Clear input value so the same image can be re-uploaded
    uploadInput.value = '';

    // Clear canvases
    sCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    oCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);

    // UI Management: Show upload area, hide others
    uploadArea.style.display = 'flex';
    sourceCanvas.style.display = 'none';
    outputCanvas.style.display = 'none';
    resetBtn.style.display = 'none';
    downloadBtn.style.display = 'none';
}

/**
 * Main function to route filter actions
 * @param {string} effectName - The name of the filter to apply
 */
function applyEffect(effectName) {
    if (!sourceCanvas.width) return; // Prevent action if no image is loaded

    // Get image data from source canvas (always work on original pixels)
    const imageData = sCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

    // Switch between filter functions
    switch (effectName) {
        case 'filter1':
            runFilter1(imageData);
            break;
        case 'filter2':
            runFilter2(imageData);
            break;
        case 'filter3':
            runFilter3(imageData);
            break;
        case 'filter4':
            runFilter4(imageData);
            break;
        case 'filter5':
            runFilter5(imageData);
            break;
    }

    // Output the processed data to the result canvas
    oCtx.putImageData(imageData, 0, 0);
}

/**
 * Download the processed image from the output canvas
 */
function downloadImage() {
    const link = document.createElement('a');
    link.download = 'processed_image.png';
    link.href = outputCanvas.toDataURL("image/png");
    link.click();
}

/** * --- FILTER LOGIC AREA ---
 * You can add your pixel manipulation logic inside these functions.
 */

function runFilter1(imageData) {
    console.log("Applying Filter 1...");
    // Add your logic here (e.g., Grayscale, Edge Detection)
}

function runFilter2(imageData) {
    console.log("Applying Filter 2...");
    // Add your logic here
}

function runFilter3(imageData) {
    console.log("Applying Filter 3...");
    // Add your logic here
}

function runFilter4(imageData) {
    console.log("Applying Filter 4...");
    // Add your logic here
}

function runFilter5(imageData) {
    console.log("Applying Filter 5...");
    // Add your logic here
}

function setPicture(source) {
    loadImage(source, img => {
      window.setPicture(img);
    });
}