# WASM Image compressor

This is a PNG image compressor working in browser, built with WebAssembly.

## Libraries used

- [libimagequant](https://pngquant.org/lib/)
- [libpng](http://www.libpng.org/pub/png/libpng.html)
- [zlib](http://www.zlib.net)

## Building

Prerequisties:
- Git
- Emscripten
- WebAssembly Toolchain
- CMake

```bash
git clone --recursive git@github.com:antelle/wasm-image-compressor.git
cd wasm-image-compressor
./build.sh
```

## License

[GPLv3](LICENSE)
