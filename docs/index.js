window.Module = {
    wasmBinaryFile: "dist/image_compressor.wasm",
    postRun() {
        init();
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

function processFile(file) {
    const dragError = document.querySelector('.drag-error');
    if (file.type != 'image/png') {
        dragError.innerHTML = 'We support only PNG files.';
        dragError.style.display = 'block';
        return;
    }
    console.log('Loading image');
    const reader = new FileReader();
    reader.onload = e => {
        const result = e.target.result;
        processImage(result, file.name);
    };
    reader.onerror = () => {
        dragError.innerHTML = 'Cannot load image.';
        dragError.style.display = 'block';
    };
    reader.readAsArrayBuffer(file);
}

function processImage(data, fileName) {
    const fileSize = data.byteLength;
    console.log(`Image loaded: ${fileName}, ${fileSize} bytes`);
    const dataView = new Uint8Array(data);
    const blob = new Blob([dataView], { type: 'image/png' });
    const imageUrl = URL.createObjectURL(blob);
    const imageEl = document.createElement('img');
    imageEl.onload = e => {
        const width = imageEl.width;
        const height = imageEl.height;
        console.log(`Image decoded: ${width}x${height}`);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.drawImage(imageEl, 0, 0);
        const rgbData = context.getImageData(0, 0, width, height).data;
        console.log(`Converted to RGB data: ${rgbData.byteLength} bytes`);
        const buffer = Module._malloc(rgbData.byteLength);
        Module.HEAPU8.set(rgbData, buffer);
        if (rgbData.byteLength !== width * height * 4) {
            throw 'Invalid data length';
        }
        console.log(`Working...`);
        const compressedSizePointer = Module._malloc(4);
        const result = Module._compress(width, height, buffer, compressedSizePointer);
        if (result) {
            console.log(`Compression error: ${result}`);
        } else {
            const compressedSize = Module.getValue(compressedSizePointer, 'i32', false);
            const percentage = (compressedSize / fileSize * 100).toFixed(1);
            console.log(`Compressed: ${compressedSize} bytes (${percentage}%)`);
            const compressed = new Uint8Array(compressedSize);
            compressed.set(Module.HEAPU8.subarray(buffer, buffer + compressedSize));
            const compressedBlob = new Blob([compressed], { type: 'image/png' });
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
        Module._free(buffer);
        Module._free(compressedSizePointer);
    };
    imageEl.style.display = 'none';
    imageEl.src = imageUrl;
}
