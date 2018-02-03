#include <iostream>
#include <emscripten.h>
#include <libimagequant.h>
#include <png.h>

struct WriteState {
    png_size_t output_file_size;
    unsigned char* output_file_data;
};

static void png_write_callback(png_structp png, png_bytep data, png_size_t length) {
    struct WriteState *write_state = (struct WriteState *)png_get_io_ptr(png);
    memcpy(&write_state->output_file_data[write_state->output_file_size], data, length);
    write_state->output_file_size += length;
}

int main() {
    return 0;
}

extern "C" {
    int compress(
        int width,
        int height,
        int maxColors,
        float dithering,
        void* data,
        int* output_size
    ) {
        *output_size = 0;
        int data_size = width * height * 4;
        liq_attr *attr = liq_attr_create();
        liq_image *image = liq_image_create_rgba(attr, data, width, height, 0);
        liq_result *res;
        if (liq_set_max_colors(attr, maxColors) != LIQ_OK) {
            fprintf(stderr, "liq_set_max_colors failed\n");
            return 1;
        }
        if (liq_image_quantize(image, attr, &res) != LIQ_OK) {
            fprintf(stderr, "Quantization failed\n");
            return 1;
        }
        if (dithering > 0) {
            if (liq_set_dithering_level(res, dithering) != LIQ_OK) {
                fprintf(stderr, "liq_set_dithering_level failed\n");
                return 1;
            }
        }

        liq_write_remapped_image(res, image, data, data_size);
        const liq_palette *pal = liq_get_palette(res);

        png_structp png = png_create_write_struct(PNG_LIBPNG_VER_STRING, NULL, NULL, NULL);
        if (!png) {
            fprintf(stderr, "Can't create png\n");
            return 2;
        }

        png_infop info = png_create_info_struct(png);
        if (!info) {
            fprintf(stderr, "Can't create png info\n");
            return 2;
        }

        if (setjmp(png_jmpbuf(png))) {
            fprintf(stderr, "Can't set png_jmpbuf\n");
            return 2;
        }

        png_set_IHDR(
            png,
            info,
            width, height,
            8,
            PNG_COLOR_TYPE_PALETTE,
            PNG_INTERLACE_NONE,
            PNG_COMPRESSION_TYPE_DEFAULT,
            PNG_FILTER_TYPE_DEFAULT
        );
        png_set_filter(png, PNG_FILTER_TYPE_BASE, PNG_FILTER_VALUE_NONE);

        png_set_compression_level(png, 9);
        png_set_compression_window_bits(png, 15);
        png_set_compression_mem_level(png, 8);
        png_set_compression_method(png, 8);
        // png_set_compression_strategy(png, 2);

        png_color palette[pal->count];
        png_byte trans[pal->count];
        unsigned int num_trans = 0;
        for (int i = 0; i < pal->count; i++) {
            palette[i] = (png_color) {
                .red = pal->entries[i].r,
                .green = pal->entries[i].g,
                .blue = pal->entries[i].b,
            };
            trans[i] = pal->entries[i].a;
            if (pal->entries[i].a < 255) {
                num_trans = i + 1;
            }
        }
        png_set_PLTE(png, info, palette, pal->count);
        if (num_trans > 0) {
            png_set_tRNS(png, info, trans, num_trans, NULL);
        }

        struct WriteState write_state;
        write_state = (struct WriteState) {
            .output_file_data = new unsigned char[data_size],
            .output_file_size = 0
        };

        png_bytep row_pointers[height];
        int rowbytes = png_get_rowbytes(png, info);
        for (int row = 0; row < height; row++) {
            row_pointers[row] = (unsigned char*)data + row * rowbytes;
        }

        png_set_write_fn(png, &write_state, png_write_callback, NULL);

        png_write_info(png, info);
        png_write_image(png, row_pointers);
        png_write_end(png, NULL);

        memcpy(data, write_state.output_file_data, write_state.output_file_size);
        free(write_state.output_file_data);
        *output_size = write_state.output_file_size;

        liq_result_destroy(res);
        liq_image_destroy(image);
        liq_attr_destroy(attr);
        return 0;
    }
}
