document.addEventListener('DOMContentLoaded', init);

const worker = new Worker('worker.js');
worker.onmessage = e => {
    switch (e.data.type) {
        case 'log':
            log(e.data.msg);
            break;
        case 'logError':
            logError(e.data.msg);
            break;
        case 'result':
            showResult(e.data.result, e.data.fileName);
            break;
    }
};

function init() {
    const inputFile = document.querySelector('#input-file');
    inputFile.onchange = e => {
        const file = e.target.files[0];
        processFile(file);
    };

    const dragTarget = document.querySelector('.drag-target');
    const dragError = document.querySelector('.drag-error');
    dragTarget.onclick = () => {
        inputFile.value = '';
        inputFile.click();
    };
    dragTarget.ondragover = e => {
        e.preventDefault();
        dragTarget.classList.add('dragged');
        dragError.style.display = 'none';
    };
    dragTarget.ondragleave = e => {
        e.preventDefault();
        dragTarget.classList.remove('dragged');
    };
    dragTarget.ondrop = e => {
        e.preventDefault();
        dragTarget.classList.remove('dragged');
        for (const file of e.dataTransfer.files) {
            processFile(file);
            break;
        }
    };
}

let logEl;
let logStart;

function initLog() {
    logEl = document.querySelector('.log');
    logEl.innerHTML = '';
    logStart = performance.now();
}

function log(msg) {
    let logTime = Math.round(performance.now() - logStart).toString();
    while (logTime.length < 5) {
        logTime = ' ' + logTime;
    }
    logEl.innerHTML += `[${logTime}ms] ${msg}\n`;
}

function logError(msg) {
    log('ERROR ' + msg);
}

function processFile(file) {
    initLog();
    const dragError = document.querySelector('.drag-error');
    if (file.type != 'image/png') {
        dragError.innerHTML = 'We support only PNG files.';
        dragError.style.display = 'block';
        return;
    }
    log('Loading file data');
    const reader = new FileReader();
    reader.onload = e => {
        const result = e.target.result;
        const fileName = file.name;
        const fileSize = result.byteLength;
        log(`File data loaded: ${fileName}, ${fileSize} bytes`);
        processImage(result, file.name);
    };
    reader.onerror = () => {
        dragError.innerHTML = 'Cannot load image.';
        dragError.style.display = 'block';
    };
    reader.readAsArrayBuffer(file);
}

function processImage(data, fileName) {
    const imagesAreaEl = document.querySelector('.images');
    imagesAreaEl.innerHTML = '';
    const workAreaEl = document.querySelector('.work');
    workAreaEl.style.display = 'flex';
    const fileSize = data.byteLength;
    appendImageToImages(data, 'img-original').then(imageEl => {
        const width = imageEl.width;
        const height = imageEl.height;
        log(`Image decoded: ${width}x${height}`);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.drawImage(imageEl, 0, 0);
        const rgbData = context.getImageData(0, 0, width, height).data;
        log(`Converted to RGB data: ${rgbData.byteLength} bytes`);
        worker.postMessage({ type: 'image', rgbData, width, height, fileSize, fileName });
    }).catch(e => {
        logError(e);
    });
}

function showResult(result, fileName) {
    appendImageToImages(result, 'img-result');
    const compressedBlob = new Blob([result], { type: 'image/png' });
    const url = URL.createObjectURL(compressedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName.replace('.png', '.min.png');
    link.style = 'display: none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}

function appendImageToImages(data) {
    return new Promise((resolve, reject) => {
        const dataView = new Uint8Array(data);
        const blob = new Blob([dataView], { type: 'image/png' });
        const imageUrl = URL.createObjectURL(blob);
        const imageEl = document.createElement('img');
        imageEl.style.display = 'none';
        imageEl.src = imageUrl;
        imageEl.onload = e => {
            URL.revokeObjectURL(imageUrl);
            imageEl.style.display = 'block';
            resolve(imageEl);
        };
        imageEl.onerror = e => {
            reject('Error loading image, maybe it\'s not in PNG format?');
        };
        const imagesAreaEl = document.querySelector('.images');
        imagesAreaEl.appendChild(imageEl);
    });
}
