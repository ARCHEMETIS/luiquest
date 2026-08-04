// ตัวเข้ารหัส QR Code ขนาดเล็ก (byte mode) — เขียนเองเพราะโปรเจกต์ไม่มี dependency สำหรับวาด QR
// และ "ห้ามเพิ่ม npm package" (ดูบรีฟ + package.json: มีแค่ react / react-dom / react-router-dom / supabase-js)
//
// รองรับเท่าที่ใช้จริง: byte mode, ECC ระดับ L/M, version 1–10 (ยาวสุด 216 ไบต์ที่ M)
// payload พร้อมเพย์ยาวประมาณ 70–90 ตัวอักษร → ตกที่ version 4–6 สบาย ๆ
// อ้างอิงอัลกอริทึมตามมาตรฐาน ISO/IEC 18004 (โครงเดียวกับไลบรารีของ Project Nayuki ที่เป็น public domain/MIT)
//
// ตารางค่าคงที่ถูกกากบาทกับค่าที่รู้กันดี: จำนวน data codeword ต่อ version ที่ระดับ M ต้องได้
// 16/28/44/64/86/108/124/154/182/216 และที่ระดับ L ต้องได้ 19/34/55/80/108/136/156/194/232/274 (ตรงแล้ว)

const MAX_VERSION = 10;

// จำนวน error-correction codeword ต่อ 1 block (index = version)
const ECC_CODEWORDS_PER_BLOCK = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
};

// จำนวน block ที่แบ่ง (index = version)
const NUM_ECC_BLOCKS = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
};

// บิตประจำระดับ ECC ที่ใช้ในข้อมูล format (L=01, M=00 ตามมาตรฐาน)
const ECC_FORMAT_BITS = { L: 1, M: 0 };

const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

const getBit = (x, i) => ((x >>> i) & 1) !== 0;

// จำนวน "โมดูลข้อมูลดิบ" (บิต) ของ version นั้น = พื้นที่ทั้งหมด ลบลายฟังก์ชัน
function numRawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function numDataCodewords(ver, ecc) {
  return (
    Math.floor(numRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[ecc][ver] * NUM_ECC_BLOCKS[ecc][ver]
  );
}

// ---- Reed–Solomon บน GF(2^8) (poly 0x11D) ----
function rsMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsComputeDivisor(degree) {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = rsMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = rsMultiply(root, 0x02);
  }
  return result;
}

function rsComputeRemainder(data, divisor) {
  const result = new Uint8Array(divisor.length);
  for (let k = 0; k < data.length; k += 1) {
    const factor = data[k] ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let i = 0; i < divisor.length; i += 1) result[i] ^= rsMultiply(divisor[i], factor);
  }
  return Array.from(result);
}

// ---- ต่อ ECC เข้าแต่ละ block แล้วสลับฟันปลา (interleave) ตามมาตรฐาน ----
function addEccAndInterleave(data, ver, ecc) {
  const numBlocks = NUM_ECC_BLOCKS[ecc][ver];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecc][ver];
  const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks = [];
  const rsDiv = rsComputeDivisor(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i += 1) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const eccBlock = rsComputeRemainder(dat, rsDiv);
    if (i < numShortBlocks) dat.push(0); // ช่องว่างเพื่อให้ index ตรงกันตอน interleave
    blocks.push(dat.concat(eccBlock));
  }

  const result = [];
  for (let i = 0; i < blocks[0].length; i += 1) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
    });
  }
  return result;
}

// ---- UTF-8 (payload พร้อมเพย์เป็น ASCII ล้วน แต่รองรับไว้ให้ครบ) ----
function toUtf8Bytes(str) {
  const out = [];
  for (const ch of str) {
    let cp = ch.codePointAt(0);
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return out;
}

function charCountBits(ver) {
  return ver < 10 ? 8 : 16; // byte mode: version 1–9 ใช้ 8 บิต, 10 ขึ้นไปใช้ 16 บิต
}

/**
 * เข้ารหัสข้อความเป็นตาราง QR
 * @param {string} text
 * @param {{ ecc?: 'L'|'M' }} opts
 * @returns {{ size: number, modules: boolean[][] }} modules[y][x] = true คือช่องทึบ
 */
export function encodeQr(text, { ecc = 'M' } = {}) {
  if (!ECC_CODEWORDS_PER_BLOCK[ecc]) throw new Error(`ระดับ ECC ไม่รองรับ: ${ecc}`);
  const bytes = toUtf8Bytes(String(text ?? ''));

  // เลือก version ที่เล็กที่สุดที่ใส่ข้อมูลได้
  let version = 0;
  for (let v = 1; v <= MAX_VERSION; v += 1) {
    if (4 + charCountBits(v) + bytes.length * 8 <= numDataCodewords(v, ecc) * 8) {
      version = v;
      break;
    }
  }
  if (!version) throw new Error('ข้อมูลยาวเกินกว่าที่ตัวเข้ารหัสนี้รองรับ (สูงสุด version 10)');

  // ---- ต่อสายบิต: mode 0100 + ความยาว + ข้อมูล + ปิดท้าย + ไบต์เติม ----
  const bits = [];
  const appendBits = (val, len) => {
    for (let i = len - 1; i >= 0; i -= 1) bits.push((val >>> i) & 1);
  };
  appendBits(0b0100, 4);
  appendBits(bytes.length, charCountBits(version));
  bytes.forEach((b) => appendBits(b, 8));

  const capacityBits = numDataCodewords(version, ecc) * 8;
  appendBits(0, Math.min(4, capacityBits - bits.length)); // terminator
  appendBits(0, (8 - (bits.length % 8)) % 8); // ปัดให้เต็มไบต์
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) appendBits(pad, 8);

  const dataCodewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    dataCodewords.push(byte);
  }

  const allCodewords = addEccAndInterleave(dataCodewords, version, ecc);
  return drawMatrix(version, ecc, allCodewords);
}

function drawMatrix(version, ecc, codewords) {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));

  const setFn = (x, y, dark) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };

  // ลายจับเวลา (timing) แถว/คอลัมน์ที่ 6
  for (let i = 0; i < size; i += 1) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }

  // ลายมุม 3 มุม (finder) + เส้นคั่นรอบ ๆ
  const drawFinder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        setFn(cx + dx, cy + dy, dist !== 2 && dist !== 4);
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  // ลายเล็งตำแหน่ง (alignment)
  const alignPos = alignmentPatternPositions(version, size);
  const numAlign = alignPos.length;
  for (let i = 0; i < numAlign; i += 1) {
    for (let j = 0; j < numAlign; j += 1) {
      const skipCorner =
        (i === 0 && j === 0) || (i === 0 && j === numAlign - 1) || (i === numAlign - 1 && j === 0);
      if (skipCorner) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          setFn(alignPos[i] + dx, alignPos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  const drawFormatBits = (mask) => {
    const data = (ECC_FORMAT_BITS[ecc] << 3) | mask; // 5 บิต
    let rem = data;
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537); // BCH(15,5)
    const fmt = (((data << 10) | rem) ^ 0x5412) & 0x7fff;

    for (let i = 0; i <= 5; i += 1) setFn(8, i, getBit(fmt, i));
    setFn(8, 7, getBit(fmt, 6));
    setFn(8, 8, getBit(fmt, 7));
    setFn(7, 8, getBit(fmt, 8));
    for (let i = 9; i < 15; i += 1) setFn(14 - i, 8, getBit(fmt, i));

    for (let i = 0; i < 8; i += 1) setFn(size - 1 - i, 8, getBit(fmt, i));
    for (let i = 8; i < 15; i += 1) setFn(8, size - 15 + i, getBit(fmt, i));
    setFn(8, size - 8, true); // dark module (ทึบเสมอตามมาตรฐาน)
  };
  drawFormatBits(0); // ใส่ mask 0 ไปก่อน เดี๋ยวเลือก mask จริงได้แล้วค่อยเขียนทับ

  // ข้อมูล version (เฉพาะ version 7 ขึ้นไป)
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25); // BCH(18,6)
    const verBits = (version << 12) | rem;
    for (let i = 0; i < 18; i += 1) {
      const bit = getBit(verBits, i);
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFn(a, b, bit);
      setFn(b, a, bit);
    }
  }

  // ---- วางข้อมูลแบบซิกแซกจากมุมขวาล่าง (ข้ามคอลัมน์ที่ 6 ซึ่งเป็น timing) ----
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && i < codewords.length * 8) {
          modules[y][x] = getBit(codewords[i >>> 3], 7 - (i & 7));
          i += 1;
        }
        // บิตที่เหลือ (remainder bits) ปล่อยเป็นช่องขาวตามมาตรฐาน
      }
    }
  }

  // ---- ลองทั้ง 8 mask แล้วเลือกอันที่โทษน้อยสุด ----
  const applyMask = (mask) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (isFunction[y][x]) continue;
        let invert = false;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: invert = ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0; break;
        }
        if (invert) modules[y][x] = !modules[y][x];
      }
    }
  };

  let bestMask = 0;
  let minPenalty = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    applyMask(mask);
    drawFormatBits(mask);
    const penalty = penaltyScore(modules, size);
    if (penalty < minPenalty) {
      minPenalty = penalty;
      bestMask = mask;
    }
    applyMask(mask); // XOR ซ้ำ = ย้อนกลับ
  }
  applyMask(bestMask);
  drawFormatBits(bestMask);

  return { size, modules };
}

function alignmentPatternPositions(ver, size) {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

// ---- คะแนนโทษ 4 ข้อตามมาตรฐาน (ใช้เลือก mask ที่อ่านง่ายที่สุด) ----
function penaltyScore(modules, size) {
  let result = 0;

  const addHistory = (runLength, history) => {
    if (history[0] === 0) runLength += size; // ขอบขาวรอบ QR
    history.pop();
    history.unshift(runLength);
  };
  const countPatterns = (history) => {
    const n = history[1];
    const core = n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
    return (
      (core && history[0] >= n * 4 && history[6] >= n ? 1 : 0) +
      (core && history[6] >= n * 4 && history[0] >= n ? 1 : 0)
    );
  };
  const terminateAndCount = (runColor, runLength, history) => {
    let len = runLength;
    if (runColor) {
      addHistory(len, history);
      len = 0;
    }
    len += size;
    addHistory(len, history);
    return countPatterns(history);
  };

  for (let y = 0; y < size; y += 1) {
    let runColor = false;
    let runLen = 0;
    const history = [0, 0, 0, 0, 0, 0, 0];
    for (let x = 0; x < size; x += 1) {
      if (modules[y][x] === runColor) {
        runLen += 1;
        if (runLen === 5) result += PENALTY_N1;
        else if (runLen > 5) result += 1;
      } else {
        addHistory(runLen, history);
        if (!runColor) result += countPatterns(history) * PENALTY_N3;
        runColor = modules[y][x];
        runLen = 1;
      }
    }
    result += terminateAndCount(runColor, runLen, history) * PENALTY_N3;
  }

  for (let x = 0; x < size; x += 1) {
    let runColor = false;
    let runLen = 0;
    const history = [0, 0, 0, 0, 0, 0, 0];
    for (let y = 0; y < size; y += 1) {
      if (modules[y][x] === runColor) {
        runLen += 1;
        if (runLen === 5) result += PENALTY_N1;
        else if (runLen > 5) result += 1;
      } else {
        addHistory(runLen, history);
        if (!runColor) result += countPatterns(history) * PENALTY_N3;
        runColor = modules[y][x];
        runLen = 1;
      }
    }
    result += terminateAndCount(runColor, runLen, history) * PENALTY_N3;
  }

  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) {
        result += PENALTY_N2;
      }
    }
  }

  let dark = 0;
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) if (modules[y][x]) dark += 1;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  return result + k * PENALTY_N4;
}

/**
 * แปลงตาราง QR เป็น path เดียวสำหรับ <svg> (เบากว่าวาด <rect> ทีละช่องหลายพันอัน)
 * @returns {string} d ของ <path> โดย 1 โมดูล = 1 หน่วยพิกัด
 */
export function qrToSvgPath({ size, modules }) {
  let d = '';
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (modules[y][x]) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return d;
}
