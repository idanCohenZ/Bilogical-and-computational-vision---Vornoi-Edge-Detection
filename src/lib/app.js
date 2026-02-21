const uploadInput = document.getElementById('upload');
const uploadArea = document.getElementById('uploadArea');
const sourceCanvas = document.getElementById('sourceCanvas');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');
const sCtx = sourceCanvas.getContext('2d');

uploadInput.addEventListener('change', function (e) {
    if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.onload = function () {
                sourceCanvas.width = img.width;
                sourceCanvas.height = img.height;
                sCtx.drawImage(img, 0, 0);

                if (window.setPicture) window.setPicture(event.target.result);

                uploadArea.style.display = 'none';
                sourceCanvas.style.display = 'block';
                resetBtn.style.display = 'block';
                downloadBtn.style.display = 'inline-block'; // Show centered button
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(this.files[0]);
    }
});

function resetImage() {
    location.reload(); 
}

function applyEffect(effectName) {
    switch (effectName) {
        case 'filter1': window.goToStage1(); break;
        case 'filter2': window.goToStage2(); break;
        case 'filter3': window.goToStage3(); break;
        case 'filter4': window.goToStage4(); break;
        case 'filter5': window.showSobel(); break;
    }
}

function downloadImage() {
    const p5Canvas = document.getElementById('vornoiCanvas');
    if (!p5Canvas) return;
    const link = document.createElement('a');
    link.download = 'voronoi_result.png';
    link.href = p5Canvas.toDataURL("image/png");
    link.click();
}