// A self-executing function to create a private scope
(function () {
  // Define the module system locally
  var exports = {};
  var module = { exports: exports };

  // https://github.com/deanm/omggif
  //
  // Permission is hereby granted, free of charge, to any person obtaining a copy
  // of this software and associated documentation files (the "Software"), to
  // deal in the Software without restriction, including without limitation the
  // rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
  // sell copies of the Software, and to permit persons to whom the Software is
  // furnished to do so, subject to the following conditions:
  //
  // The above copyright notice and this permission notice shall be included in
  // all copies or substantial portions of the Software.
  //
  // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  // FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  // LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
  // FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
  // IN THE SOFTWARE.
  //
  // omggif is a JavaScript implementation of a GIF 89a encoder and decoder,
  // including animation and compression.  It does not rely on any specific
  // underlying system, so should run in the browser, Node, or Plask.

  "use strict";

  function GifWriter(buf, width, height, gopts) {
    var p = 0;

    var gopts = gopts === undefined ? {} : gopts;
    var loop_count = gopts.loop === undefined ? null : gopts.loop;
    var global_palette = gopts.palette === undefined ? null : gopts.palette;

    if (width <= 0 || height <= 0 || width > 65535 || height > 65535)
      throw new Error("Width/Height invalid.");

    function check_palette_and_num_colors(palette) {
      var num_colors = palette.length;
      if (num_colors < 2 || num_colors > 256 || num_colors & (num_colors - 1)) {
        throw new Error(
          "Invalid code/color length, must be power of 2 and 2 .. 256.");
      }
      return num_colors;
    }

    // - Header.
    buf[p++] = 0x47; buf[p++] = 0x49; buf[p++] = 0x46;  // GIF
    buf[p++] = 0x38; buf[p++] = 0x39; buf[p++] = 0x61;  // 89a

    // Handling of Global Color Table (palette) and background index.
    var gp_num_colors_pow2 = 0;
    var background = 0;
    if (global_palette !== null) {
      var gp_num_colors = check_palette_and_num_colors(global_palette);
      while (gp_num_colors >>= 1) ++gp_num_colors_pow2;
      gp_num_colors = 1 << gp_num_colors_pow2;
      --gp_num_colors_pow2;
      if (gopts.background !== undefined) {
        background = gopts.background;
        if (background >= gp_num_colors)
          throw new Error("Background index out of range.");

        if (background === 0)
          throw new Error("Background index explicitly passed as 0.");
      }
    }

    // - Logical Screen Descriptor.
    // NOTE(deanm): w/h apparently ignored by implementations, but set anyway.
    buf[p++] = width & 0xff; buf[p++] = width >> 8 & 0xff;
    buf[p++] = height & 0xff; buf[p++] = height >> 8 & 0xff;
    // NOTE: Indicates 0-bpp original color resolution (unused?).
    buf[p++] = (global_palette !== null ? 0x80 : 0) |  // Global Color Table Flag.
      gp_num_colors_pow2;  // NOTE: No sort flag (unused?).
    buf[p++] = background;  // Background Color Index.
    buf[p++] = 0;  // Pixel aspect ratio (unused?).

    // - Global Color Table
    if (global_palette !== null) {
      for (var i = 0, il = global_palette.length; i < il; ++i) {
        var rgb = global_palette[i];
        buf[p++] = rgb >> 16 & 0xff;
        buf[p++] = rgb >> 8 & 0xff;
        buf[p++] = rgb & 0xff;
      }
    }

    if (loop_count !== null) {  // Netscape block for looping.
      if (loop_count < 0 || loop_count > 65535)
        throw new Error("Loop count invalid.")
      // Extension code, label, and length.
      buf[p++] = 0x21; buf[p++] = 0xff; buf[p++] = 0x0b;
      // NETSCAPE2.0
      buf[p++] = 0x4e; buf[p++] = 0x45; buf[p++] = 0x54; buf[p++] = 0x53;
      buf[p++] = 0x43; buf[p++] = 0x41; buf[p++] = 0x50; buf[p++] = 0x45;
      buf[p++] = 0x32; buf[p++] = 0x2e; buf[p++] = 0x30;
      // Sub-block
      buf[p++] = 0x03; buf[p++] = 0x01;
      buf[p++] = loop_count & 0xff; buf[p++] = loop_count >> 8 & 0xff;
      buf[p++] = 0x00;  // Terminator.
    }


    var ended = false;

    this.addFrame = function (x, y, w, h, indexed_pixels, opts) {
      if (ended === true) { --p; ended = false; }  // Un-end.

      opts = opts === undefined ? {} : opts;

      // TODO(deanm): Bounds check x, y.  Do they need to be within the virtual
      // canvas width/height, I imagine?
      if (x < 0 || y < 0 || x > 65535 || y > 65535)
        throw new Error("x/y invalid.")

      if (w <= 0 || h <= 0 || w > 65535 || h > 65535)
        throw new Error("Width/Height invalid.")

      if (indexed_pixels.length < w * h)
        throw new Error("Not enough pixels for the frame size.");

      var using_local_palette = true;
      var palette = opts.palette;
      if (palette === undefined || palette === null) {
        using_local_palette = false;
        palette = global_palette;
      }

      if (palette === undefined || palette === null)
        throw new Error("Must supply either a local or global palette.");

      var num_colors = check_palette_and_num_colors(palette);

      // Compute the min_code_size (power of 2), destroying num_colors.
      var min_code_size = 0;
      while (num_colors >>= 1) ++min_code_size;
      num_colors = 1 << min_code_size;  // Now we can easily get it back.

      var delay = opts.delay === undefined ? 0 : opts.delay;

      var disposal = opts.disposal === undefined ? 0 : opts.disposal;
      if (disposal < 0 || disposal > 3)  // 4-7 is reserved.
        throw new Error("Disposal out of range.");

      var use_transparency = false;
      var transparent_index = 0;
      if (opts.transparent !== undefined && opts.transparent !== null) {
        use_transparency = true;
        transparent_index = opts.transparent;
        if (transparent_index < 0 || transparent_index >= num_colors)
          throw new Error("Transparent color index.");
      }

      if (disposal !== 0 || use_transparency || delay !== 0) {
        // - Graphics Control Extension
        buf[p++] = 0x21; buf[p++] = 0xf9;  // Extension / Label.
        buf[p++] = 4;  // Byte size.

        buf[p++] = disposal << 2 | (use_transparency === true ? 1 : 0);
        buf[p++] = delay & 0xff; buf[p++] = delay >> 8 & 0xff;
        buf[p++] = transparent_index;  // Transparent color index.
        buf[p++] = 0;  // Block Terminator.
      }

      // - Image Descriptor
      buf[p++] = 0x2c;  // Image Seperator.
      buf[p++] = x & 0xff; buf[p++] = x >> 8 & 0xff;  // Left.
      buf[p++] = y & 0xff; buf[p++] = y >> 8 & 0xff;  // Top.
      buf[p++] = w & 0xff; buf[p++] = w >> 8 & 0xff;
      buf[p++] = h & 0xff; buf[p++] = h >> 8 & 0xff;
      // NOTE: No sort flag (unused?).
      // TODO(deanm): Support interlace.
      buf[p++] = using_local_palette === true ? (0x80 | (min_code_size - 1)) : 0;

      // - Local Color Table
      if (using_local_palette === true) {
        for (var i = 0, il = palette.length; i < il; ++i) {
          var rgb = palette[i];
          buf[p++] = rgb >> 16 & 0xff;
          buf[p++] = rgb >> 8 & 0xff;
          buf[p++] = rgb & 0xff;
        }
      }

      p = GifWriterOutputLZWCodeStream(
        buf, p, min_code_size < 2 ? 2 : min_code_size, indexed_pixels);

      return p;
    };

    this.end = function () {
      if (ended === false) {
        buf[p++] = 0x3b;  // Trailer.
        ended = true;
      }
      return p;
    };

    this.getOutputBuffer = function () { return buf; };
    this.setOutputBuffer = function (v) { buf = v; };
    this.getOutputBufferPosition = function () { return p; };
    this.setOutputBufferPosition = function (v) { p = v; };
  }

  // Main compression routine, palette indexes -> LZW code stream.
  // |index_stream| must have at least one entry.
  function GifWriterOutputLZWCodeStream(buf, p, min_code_size, index_stream) {
    buf[p++] = min_code_size;
    var cur_subblock = p++;  // Pointing at the length field.

    var clear_code = 1 << min_code_size;
    var code_mask = clear_code - 1;
    var eoi_code = clear_code + 1;
    var next_code = eoi_code + 1;

    var cur_code_size = min_code_size + 1;  // Number of bits per code.
    var cur_shift = 0;
    // We have at most 12-bit codes, so we should have to hold a max of 19
    // bits here (and then we would write out).
    var cur = 0;

    function emit_bytes_to_buffer(bit_block_size) {
      while (cur_shift >= bit_block_size) {
        buf[p++] = cur & 0xff;
        cur >>= 8; cur_shift -= 8;
        if (p === cur_subblock + 256) {  // Finished a subblock.
          buf[cur_subblock] = 255;
          cur_subblock = p++;
        }
      }
    }

    function emit_code(c) {
      cur |= c << cur_shift;
      cur_shift += cur_code_size;
      emit_bytes_to_buffer(8);
    }

    // Output code for the current contents of the index buffer.
    var ib_code = index_stream[0] & code_mask;  // Load first input index.
    var code_table = {};  // Key'd on our 20-bit "tuple".

    emit_code(clear_code);  // Spec says first code should be a clear code.

    // First index already loaded, process the rest of the stream.
    for (var i = 1, il = index_stream.length; i < il; ++i) {
      var k = index_stream[i] & code_mask;
      var cur_key = ib_code << 8 | k;  // (prev, k) unique tuple.
      var cur_code = code_table[cur_key];  // buffer + k.

      // Check if we have to create a new code table entry.
      if (cur_code === undefined) {  // We don't have buffer + k.

        cur |= ib_code << cur_shift;
        cur_shift += cur_code_size;
        while (cur_shift >= 8) {
          buf[p++] = cur & 0xff;
          cur >>= 8; cur_shift -= 8;
          if (p === cur_subblock + 256) {  // Finished a subblock.
            buf[cur_subblock] = 255;
            cur_subblock = p++;
          }
        }

        if (next_code === 4096) {  // Table full, need a clear.
          emit_code(clear_code);
          next_code = eoi_code + 1;
          cur_code_size = min_code_size + 1;
          code_table = {};
        } else {  // Table not full, insert a new entry.

          if (next_code >= (1 << cur_code_size)) ++cur_code_size;
          code_table[cur_key] = next_code++;  // Insert into code table.
        }

        ib_code = k;  // Index buffer to single input k.
      } else {
        ib_code = cur_code;  // Index buffer to sequence in code table.
      }
    }

    emit_code(ib_code);  // There will still be something in the index buffer.
    emit_code(eoi_code);  // End Of Information.

    // Flush / finalize the sub-blocks stream to the buffer.
    emit_bytes_to_buffer(1);

    if (cur_subblock + 1 === p) {  // Started but unused.
      buf[cur_subblock] = 0;
    } else {  // Started and used, write length and additional terminator block.
      buf[cur_subblock] = p - cur_subblock - 1;
      buf[p++] = 0;
    }
    return p;
  }

  function GifReader(buf) {
    var p = 0;

    // - Header (GIF87a or GIF89a).
    if (buf[p++] !== 0x47 || buf[p++] !== 0x49 || buf[p++] !== 0x46 ||
      buf[p++] !== 0x38 || (buf[p++] + 1 & 0xfd) !== 0x38 || buf[p++] !== 0x61) {
      throw new Error("Invalid GIF 87a/89a header.");
    }

    // - Logical Screen Descriptor.
    var width = buf[p++] | buf[p++] << 8;
    var height = buf[p++] | buf[p++] << 8;
    var pf0 = buf[p++];  // <Packed Fields>.
    var global_palette_flag = pf0 >> 7;
    var num_global_colors_pow2 = pf0 & 0x7;
    var num_global_colors = 1 << (num_global_colors_pow2 + 1);
    var background = buf[p++];
    buf[p++];  // Pixel aspect ratio (unused?).

    var global_palette_offset = null;
    var global_palette_size = null;

    if (global_palette_flag) {
      global_palette_offset = p;
      global_palette_size = num_global_colors;
      p += num_global_colors * 3;  // Seek past palette.
    }

    var no_eof = true;

    var frames = [];

    var delay = 0;
    var transparent_index = null;
    var disposal = 0;  // 0 - No disposal specified.
    var loop_count = null;

    this.width = width;
    this.height = height;

    while (no_eof && p < buf.length) {
      switch (buf[p++]) {
        case 0x21:  // Graphics Control Extension Block
          switch (buf[p++]) {
            case 0xff:  // Application specific block
              // Try if it's a Netscape block (with animation loop counter).
              if (buf[p] !== 0x0b ||  // 21 FF already read, check block size.
                // NETSCAPE2.0
                buf[p + 1] == 0x4e && buf[p + 2] == 0x45 && buf[p + 3] == 0x54 &&
                buf[p + 4] == 0x53 && buf[p + 5] == 0x43 && buf[p + 6] == 0x41 &&
                buf[p + 7] == 0x50 && buf[p + 8] == 0x45 && buf[p + 9] == 0x32 &&
                buf[p + 10] == 0x2e && buf[p + 11] == 0x30 &&
                // Sub-block
                buf[p + 12] == 0x03 && buf[p + 13] == 0x01 && buf[p + 16] == 0) {
                p += 14;
                loop_count = buf[p++] | buf[p++] << 8;
                p++;  // Skip terminator.
              } else {  // We don't know what it is, just try to get past it.
                p += 12;
                while (true) {  // Seek through subblocks.
                  var block_size = buf[p++];
                  // Bad block size (ex: undefined from an out of bounds read).
                  if (!(block_size >= 0)) throw Error("Invalid block size");
                  if (block_size === 0) break;  // 0 size is terminator
                  p += block_size;
                }
              }
              break;

            case 0xf9:  // Graphics Control Extension
              if (buf[p++] !== 0x4 || buf[p + 4] !== 0)
                throw new Error("Invalid graphics extension block.");
              var pf1 = buf[p++];
              delay = buf[p++] | buf[p++] << 8;
              transparent_index = buf[p++];
              if ((pf1 & 1) === 0) transparent_index = null;
              disposal = pf1 >> 2 & 0x7;
              p++;  // Skip terminator.
              break;

            case 0xfe:  // Comment Extension.
              while (true) {  // Seek through subblocks.
                var block_size = buf[p++];
                // Bad block size (ex: undefined from an out of bounds read).
                if (!(block_size >= 0)) throw Error("Invalid block size");
                if (block_size === 0) break;  // 0 size is terminator
                // console.log(buf.slice(p, p+block_size).toString('ascii'));
                p += block_size;
              }
              break;

            default:
              throw new Error(
                "Unknown graphic control label: 0x" + buf[p - 1].toString(16));
          }
          break;

        case 0x2c:  // Image Descriptor.
          var x = buf[p++] | buf[p++] << 8;
          var y = buf[p++] | buf[p++] << 8;
          var w = buf[p++] | buf[p++] << 8;
          var h = buf[p++] | buf[p++] << 8;
          var pf2 = buf[p++];
          var local_palette_flag = pf2 >> 7;
          var interlace_flag = pf2 >> 6 & 1;
          var num_local_colors_pow2 = pf2 & 0x7;
          var num_local_colors = 1 << (num_local_colors_pow2 + 1);
          var palette_offset = global_palette_offset;
          var palette_size = global_palette_size;
          var has_local_palette = false;
          if (local_palette_flag) {
            var has_local_palette = true;
            palette_offset = p;  // Override with local palette.
            palette_size = num_local_colors;
            p += num_local_colors * 3;  // Seek past palette.
          }

          var data_offset = p;

          p++;  // codesize
          while (true) {
            var block_size = buf[p++];
            // Bad block size (ex: undefined from an out of bounds read).
            if (!(block_size >= 0)) throw Error("Invalid block size");
            if (block_size === 0) break;  // 0 size is terminator
            p += block_size;
          }

          frames.push({
            x: x, y: y, width: w, height: h,
            has_local_palette: has_local_palette,
            palette_offset: palette_offset,
            palette_size: palette_size,
            data_offset: data_offset,
            data_length: p - data_offset,
            transparent_index: transparent_index,
            interlaced: !!interlace_flag,
            delay: delay,
            disposal: disposal
          });
          break;

        case 0x3b:  // Trailer Marker (end of file).
          no_eof = false;
          break;

        default:
          throw new Error("Unknown gif block: 0x" + buf[p - 1].toString(16));
          break;
      }
    }

    this.numFrames = function () {
      return frames.length;
    };

    this.loopCount = function () {
      return loop_count;
    };

    this.frameInfo = function (frame_num) {
      if (frame_num < 0 || frame_num >= frames.length)
        throw new Error("Frame index out of range.");
      return frames[frame_num];
    }

    this.decodeAndBlitFrameBGRA = function (frame_num, pixels) {
      var frame = this.frameInfo(frame_num);
      var num_pixels = frame.width * frame.height;
      var index_stream = new Uint8Array(num_pixels);  // At most 8-bit indices.
      GifReaderLZWOutputIndexStream(
        buf, frame.data_offset, index_stream, num_pixels);
      var palette_offset = frame.palette_offset;

      var trans = frame.transparent_index;
      if (trans === null) trans = 256;

      var framewidth = frame.width;
      var framestride = width - framewidth;
      var xleft = framewidth;  // Number of subrect pixels left in scanline.

      // Output indicies of the top left and bottom right corners of the subrect.
      var opbeg = ((frame.y * width) + frame.x) * 4;
      var opend = ((frame.y + frame.height) * width + frame.x) * 4;
      var op = opbeg;

      var scanstride = framestride * 4;

      // Use scanstride to skip past the rows when interlacing.  This is skipping
      // 7 rows for the first two passes, then 3 then 1.
      if (frame.interlaced === true) {
        scanstride += width * 4 * 7;  // Pass 1.
      }

      var interlaceskip = 8;  // Tracking the row interval in the current pass.

      for (var i = 0, il = index_stream.length; i < il; ++i) {
        var index = index_stream[i];

        if (xleft === 0) {  // Beginning of new scan line
          op += scanstride;
          xleft = framewidth;
          if (op >= opend) { // Catch the wrap to switch passes when interlacing.
            scanstride = framestride * 4 + width * 4 * (interlaceskip - 1);
            // interlaceskip / 2 * 4 is interlaceskip << 1.
            op = opbeg + (framewidth + framestride) * (interlaceskip << 1);
            interlaceskip >>= 1;
          }
        }

        if (index === trans) {
          op += 4;
        } else {
          var r = buf[palette_offset + index * 3];
          var g = buf[palette_offset + index * 3 + 1];
          var b = buf[palette_offset + index * 3 + 2];
          pixels[op++] = b;
          pixels[op++] = g;
          pixels[op++] = r;
          pixels[op++] = 255;
        }
        --xleft;
      }
    };

    // I will go to copy and paste hell one day...
    this.decodeAndBlitFrameRGBA = function (frame_num, pixels) {
      var frame = this.frameInfo(frame_num);
      var num_pixels = frame.width * frame.height;
      var index_stream = new Uint8Array(num_pixels);  // At most 8-bit indices.
      GifReaderLZWOutputIndexStream(
        buf, frame.data_offset, index_stream, num_pixels);
      var palette_offset = frame.palette_offset;

      var trans = frame.transparent_index;
      if (trans === null) trans = 256;

      var framewidth = frame.width;
      var framestride = width - framewidth;
      var xleft = framewidth;  // Number of subrect pixels left in scanline.

      // Output indicies of the top left and bottom right corners of the subrect.
      var opbeg = ((frame.y * width) + frame.x) * 4;
      var opend = ((frame.y + frame.height) * width + frame.x) * 4;
      var op = opbeg;

      var scanstride = framestride * 4;

      if (frame.interlaced === true) {
        scanstride += width * 4 * 7;  // Pass 1.
      }

      var interlaceskip = 8;  // Tracking the row interval in the current pass.

      for (var i = 0, il = index_stream.length; i < il; ++i) {
        var index = index_stream[i];

        if (xleft === 0) {  // Beginning of new scan line
          op += scanstride;
          xleft = framewidth;
          if (op >= opend) { // Catch the wrap to switch passes when interlacing.
            scanstride = framestride * 4 + width * 4 * (interlaceskip - 1);
            // interlaceskip / 2 * 4 is interlaceskip << 1.
            op = opbeg + (framewidth + framestride) * (interlaceskip << 1);
            interlaceskip >>= 1;
          }
        }

        if (index === trans) {
          op += 4;
        } else {
          var r = buf[palette_offset + index * 3];
          var g = buf[palette_offset + index * 3 + 1];
          var b = buf[palette_offset + index * 3 + 2];
          pixels[op++] = r;
          pixels[op++] = g;
          pixels[op++] = b;
          pixels[op++] = 255;
        }
        --xleft;
      }
    };
  }

  function GifReaderLZWOutputIndexStream(code_stream, p, output, output_length) {
    var min_code_size = code_stream[p++];

    var clear_code = 1 << min_code_size;
    var eoi_code = clear_code + 1;
    var next_code = eoi_code + 1;

    var cur_code_size = min_code_size + 1;  // Number of bits per code.

    var code_mask = (1 << cur_code_size) - 1;
    var cur_shift = 0;
    var cur = 0;

    var op = 0;  // Output pointer.

    var subblock_size = code_stream[p++];

    var code_table = new Int32Array(4096);  // Can be signed, we only use 20 bits.

    var prev_code = null;  // Track code-1.

    while (true) {
      // Read up to two bytes, making sure we always 12-bits for max sized code.
      while (cur_shift < 16) {
        if (subblock_size === 0) break;  // No more data to be read.

        cur |= code_stream[p++] << cur_shift;
        cur_shift += 8;

        if (subblock_size === 1) {  // Never let it get to 0 to hold logic above.
          subblock_size = code_stream[p++];  // Next subblock.
        } else {
          --subblock_size;
        }
      }

      if (cur_shift < cur_code_size)
        break;

      var code = cur & code_mask;
      cur >>= cur_code_size;
      cur_shift -= cur_code_size;

      if (code === clear_code) {

        next_code = eoi_code + 1;
        cur_code_size = min_code_size + 1;
        code_mask = (1 << cur_code_size) - 1;

        // Don't update prev_code ?
        prev_code = null;
        continue;
      } else if (code === eoi_code) {
        break;
      }

      var chase_code = code < next_code ? code : prev_code;

      // Chase what we will output, either {CODE} or {CODE-1}.
      var chase_length = 0;
      var chase = chase_code;
      while (chase > clear_code) {
        chase = code_table[chase] >> 8;
        ++chase_length;
      }

      var k = chase;

      var op_end = op + chase_length + (chase_code !== code ? 1 : 0);
      if (op_end > output_length) {
        console.log("Warning, gif stream longer than expected.");
        return;
      }

      // Already have the first byte from the chase, might as well write it fast.
      output[op++] = k;

      op += chase_length;
      var b = op;  // Track pointer, writing backwards.

      if (chase_code !== code)  // The case of emitting {CODE-1} + k.
        output[op++] = k;

      chase = chase_code;
      while (chase_length--) {
        chase = code_table[chase];
        output[--b] = chase & 0xff;  // Write backwards.
        chase >>= 8;  // Pull down to the prefix code.
      }

      if (prev_code !== null && next_code < 4096) {
        code_table[next_code++] = prev_code << 8 | k;

        if (next_code >= code_mask + 1 && cur_code_size < 12) {
          ++cur_code_size;
          code_mask = code_mask << 1 | 1;
        }
      }

      prev_code = code;
    }

    if (op !== output_length) {
      console.log("Warning, gif stream shorter than expected.");
    }

    return output;
  }

  // CommonJS.
  try { exports.GifWriter = GifWriter; exports.GifReader = GifReader } catch (e) { }

  // Expose the functionality to the global scope
  // by attaching it to the 'window' object.
  window.omggif = module.exports;
})();

// Now, 'omggif' is a global variable and ready to be used.
console.log(typeof omggif);

