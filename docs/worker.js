self.Module = {
    wasmBinaryFile: 'dist/image_compressor.wasm'
};

importScripts('dist/image_compressor.js');

self.onmessage = e => {
    switch (e.data.type) {
        case 'image':
            processImage(e.data.rgbData, e.data.width, e.data.height, e.data.fileSize, e.data.fileName);
            break;
    }
};

function processImage(rgbData, width, height, fileSize, fileName) {
    try {
        log(`Working...`);
        const buffer = Module._malloc(rgbData.byteLength);
        Module.HEAPU8.set(rgbData, buffer);
        if (rgbData.byteLength !== width * height * 4) {
            logError(`Invalid data length: ${rgbData.byteLength}, expected ${width * height * 4}`);
            return;
        }
        const compressedSizePointer = Module._malloc(4);
        const result = Module._compress(width, height, buffer, compressedSizePointer);
        if (result) {
            logError(`Compression error: ${result}`);
        } else {
            const compressedSize = Module.getValue(compressedSizePointer, 'i32', false);
            const percentage = (compressedSize / fileSize * 100).toFixed(1);
            log(`Compressed: ${compressedSize} bytes (${percentage}%)`);
            const compressed = new Uint8Array(compressedSize);
            compressed.set(Module.HEAPU8.subarray(buffer, buffer + compressedSize));
            self.postMessage({ type: 'result', result: compressed, fileName });
        }
        Module._free(buffer);
        Module._free(compressedSizePointer);
    } catch (e) {
        logError(e.toString());
    }
}

function log(msg) {
    self.postMessage({ type: 'log', msg });
}

function logError(msg) {
    self.postMessage({ type: 'logError', msg });
}
